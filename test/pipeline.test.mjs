import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { titleMatches, extractPrice, postKind } from "../scripts/lib/text.mjs";
import { parseEcbXml } from "../scripts/lib/ecb.mjs";
import { normalizeItem, toEur } from "../scripts/lib/ebay.mjs";
import { aggregate, updateEbayState } from "../scripts/lib/aggregate.mjs";
import { describe as stats } from "../scripts/lib/stats.mjs";
import { run } from "../scripts/update-market.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIX = path.join(ROOT, "test", "fixtures");
const quiet = { log() {}, warn() {} };

test("filtre des titres : bonne référence, exclusions et annonces douteuses", () => {
  const match = { any: ["79030n"], none: ["79030b"] };
  assert.equal(titleMatches("TUDOR M79030N-0001 Full set", match), true);
  assert.equal(titleMatches("Tudor m 79030 N", match), true);
  assert.equal(titleMatches("Tudor 79030B blue", match), false);
  assert.equal(titleMatches("Replica Tudor 79030N", match), false);
  assert.equal(titleMatches("Tudor Pelagos", match), false);
});

test("extraction du prix et du type d'annonce Reddit", () => {
  assert.deepEqual(extractPrice("[WTS] Tudor 79030N - $2,999"), { value: 2999, currency: "USD" });
  assert.deepEqual(extractPrice("[WTS] Tudor 3150 USD shipped"), { value: 3150, currency: "USD" });
  assert.deepEqual(extractPrice("[WTS] BB58 - 2.900 €"), { value: 2900, currency: "EUR" });
  assert.equal(extractPrice("[WTS] Tudor 79030N"), null);
  assert.equal(postKind("[WTS/WTT] x"), "WTS");
  assert.equal(postKind("[WTB] x"), "WTB");
  assert.equal(postKind("Question"), null);
});

test("lecture du flux BCE", async () => {
  const p = parseEcbXml(await readFile(path.join(FIX, "ecb.xml"), "utf8"));
  assert.equal(p.date, "2026-10-30");
  assert.equal(p.rates.USD, 1.165);
});

test("normalisation eBay : conversion en euros, état, pièces détachées exclues", () => {
  const rates = { USD: 1.165 };
  const used = normalizeItem({ itemId: "1", title: "x", price: { value: "3150", currency: "USD" }, conditionId: "3000" }, { id: "EBAY_US", currency: "USD" }, rates);
  assert.equal(used.priceEur, Math.round(3150 / 1.165));
  assert.equal(used.condition, "used");
  assert.equal(normalizeItem({ itemId: "2", price: { value: "10", currency: "EUR" }, conditionId: "7000" }, { id: "EBAY_FR", currency: "EUR" }, rates), null);
  assert.equal(toEur(100, "EUR", rates), 100);
});

test("statistiques : quartiles", () => {
  const s = stats([1, 2, 3, 4, 5]);
  assert.equal(s.median, 3);
  assert.equal(s.q1, 2);
  assert.equal(s.q3, 4);
});

const REF = { id: "x", anchor: { market: 2500, low: 2300, high: 2800, date: "2026-11-01" }, hype: { score: 50 } };

test("lissage : la cote part de l'étude et se rapproche des annonces", () => {
  const items = [2700, 2750, 2800, 2850, 2900, 2950].map((p, i) => ({ id: String(i), priceEur: p, condition: "used", created: "2026-10-01T00:00:00Z" }));
  const r = aggregate({ ref: REF, ebay: { items, complete: true }, reddit: null, now: "2026-11-02T06:00:00Z" });
  const obs = 2825 * 0.92; // médiane des prix demandés moins 8 %
  assert.ok(r.live.market > 2500 && r.live.market < obs, `cote ${r.live.market}`);
  assert.equal(r.live.nObs, 6);
  assert.equal(r.history[0].seed, true);
  assert.equal(r.history.at(-1).d, "2026-11-02");
});

test("sans observation, la cote reste inchangée et est signalée comme ancienne", () => {
  const r = aggregate({ ref: REF, ebay: null, reddit: null, prevLive: { market: 2550, low: 2300, high: 2800 }, now: "2026-11-02T06:00:00Z" });
  assert.equal(r.live.market, 2550);
  assert.equal(r.live.stale, true);
});

test("suivi eBay : une annonce disparue avant sa fin compte comme écoulée", () => {
  const s1 = updateEbayState(null, [{ id: "a", created: "2026-10-01T00:00:00Z", end: "2027-01-01T00:00:00Z", priceEur: 2600 }], true, "2026-11-01T00:00:00Z");
  const s2 = updateEbayState(s1, [], true, "2026-11-05T00:00:00Z");
  assert.equal(s2.gone.length, 1);
  assert.equal(s2.gone[0].id, "a");
  // Recherche incomplète : on ne conclut rien
  const s3 = updateEbayState(s1, [], false, "2026-11-05T00:00:00Z");
  assert.equal(s3.gone.length, 0);
});

test("délai de vente estimé dès 5 annonces écoulées, tendance 30 jours depuis l'historique", () => {
  const gone = Array.from({ length: 6 }, (_, i) => ({ id: String(i), created: "2026-10-01T00:00:00Z", gone: `2026-10-${11 + i}T00:00:00Z`, price: 2600 }));
  const state = { active: {}, gone, trackingSince: "2026-09-01T00:00:00Z" };
  const history = [{ d: "2026-10-01", mk: 2400 }];
  const r = aggregate({ ref: REF, ebay: { items: [], complete: true }, reddit: null, prevLive: { market: 2500 }, history, ebayState: state, now: "2026-11-02T06:00:00Z" });
  assert.equal(r.live.daysN, 6);
  assert.equal(r.live.days, 12.5);
  assert.equal(r.live.trend30, 4.2);
});

test("exécution complète avec données simulées, deux passages", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "cote-"));
  const refs = JSON.parse(await readFile(path.join(ROOT, "data", "references.json"), "utf8")).slice(0, 2);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "references.json"), JSON.stringify(refs));
  const m1 = await run({ dataDir: dir, mockDir: FIX, now: "2026-11-02T06:00:00Z", log: quiet });
  assert.equal(m1.sources.ecb.status, "ok");
  assert.equal(m1.fx.rates.USD, 1.165);
  assert.equal(m1.sources.ebay.status, "ok");
  const live = m1.refs["tudor-79030n"];
  // 3 annonces d'occasion eBay valides (FR, DE, US : même fixture) + 3 annonces Reddit [WTS] avec prix
  assert.equal(live.redditWts30, 3);
  assert.equal(live.redditWtb30, 1);
  assert.ok(live.nObs >= 6, `nObs ${live.nObs}`);
  // Médiane des prix demandés 2 704 € → cote observée 2 488 € : la cote de l'étude (2 512 €) descend vers elle
  assert.ok(live.market < 2512 && live.market > 2487, `cote ${live.market}`);
  assert.equal(live.askNewMedian, 3190);
  const m2 = await run({ dataDir: dir, mockDir: FIX, now: "2026-11-02T12:00:00Z", log: quiet });
  const hist = JSON.parse(await readFile(path.join(dir, "history.json"), "utf8"));
  assert.equal(hist["tudor-79030n"].filter((p) => p.d === "2026-11-02").length, 1);
  assert.ok(m2.refs["tudor-79030n"].market <= live.market);
});
