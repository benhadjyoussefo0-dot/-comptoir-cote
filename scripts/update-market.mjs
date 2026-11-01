#!/usr/bin/env node
// Mise à jour des données de marché. Lancé par GitHub Actions toutes les 6 heures.
// Usage : node scripts/update-market.mjs [--mock fixtures] [--now 2026-11-02T06:00:00Z]
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchEcb } from "./lib/ecb.mjs";
import { collectEbay } from "./lib/ebay.mjs";
import { collectReddit } from "./lib/reddit.mjs";
import { aggregate } from "./lib/aggregate.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data");

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : null;
}

async function readJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  return JSON.parse(await readFile(file, "utf8"));
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value, null, 1) + "\n");
}

// Remplace le réseau par des fichiers locaux (tests et démonstration).
function mockFetch(dir, refs) {
  const reply = (body, ok = true) => ({ ok, status: ok ? 200 : 404, json: async () => body, text: async () => (typeof body === "string" ? body : JSON.stringify(body)) });
  return async (url) => {
    const u = new URL(url);
    if (u.hostname.includes("ecb.europa.eu")) return reply(await readFile(path.join(dir, "ecb.xml"), "utf8"));
    if (u.pathname.includes("oauth2/token") || u.pathname.includes("access_token")) return reply({ access_token: "mock" });
    if (u.hostname === "api.ebay.com") {
      const ref = refs.find((r) => r.queries && r.queries.ebay === u.searchParams.get("q"));
      const f = ref && path.join(dir, "ebay", `${ref.id}.json`);
      return reply(f && existsSync(f) ? JSON.parse(await readFile(f, "utf8")) : { total: 0, itemSummaries: [] });
    }
    if (u.hostname === "oauth.reddit.com") {
      const q = u.searchParams.get("q") || "";
      const ref = refs.find((r) => r.queries && q === `title:(${r.queries.reddit})`);
      const f = ref && path.join(dir, "reddit", `${ref.id}.json`);
      return reply(f && existsSync(f) ? JSON.parse(await readFile(f, "utf8")) : { data: { children: [] } });
    }
    return reply({}, false);
  };
}

export async function run({ dataDir = DATA, mockDir = null, now = new Date().toISOString(), env = process.env, log = console } = {}) {
  const refs = await readJson(path.join(dataDir, "references.json"), []);
  const prevMarket = await readJson(path.join(dataDir, "market.json"), { refs: {} });
  const history = await readJson(path.join(dataDir, "history.json"), {});
  const ebayState = await readJson(path.join(dataDir, "state", "ebay.json"), {});
  const fetchImpl = mockDir ? mockFetch(mockDir, refs) : fetch;
  const runEnv = mockDir
    ? { EBAY_CLIENT_ID: "m", EBAY_CLIENT_SECRET: "m", REDDIT_CLIENT_ID: "m", REDDIT_CLIENT_SECRET: "m", REDDIT_DELAY_MS: "0" }
    : env;

  const sources = {};

  // Taux de change
  let fx = prevMarket.fx || { rates: { USD: 1.1683 }, date: "2026-08-20", source: "valeur de l'étude" };
  try {
    const ecb = await fetchEcb(fetchImpl);
    fx = { rates: { USD: ecb.rates.USD, GBP: ecb.rates.GBP, CHF: ecb.rates.CHF, JPY: ecb.rates.JPY }, date: ecb.date, source: "BCE" };
    sources.ecb = { status: "ok", message: `1 € = ${ecb.rates.USD} $ (${ecb.date})` };
  } catch (e) {
    sources.ecb = { status: "erreur", message: e.message };
  }

  // Annonces
  let ebay = { byRef: {} };
  try {
    ebay = await collectEbay(fetchImpl, runEnv, refs, fx.rates, log);
    sources.ebay = { status: ebay.status, message: ebay.message };
  } catch (e) {
    sources.ebay = { status: "erreur", message: e.message };
  }
  let reddit = { byRef: {} };
  try {
    reddit = await collectReddit(fetchImpl, runEnv, refs, fx.rates, log);
    sources.reddit = { status: reddit.status, message: reddit.message };
  } catch (e) {
    sources.reddit = { status: "erreur", message: e.message };
  }

  // Agrégation
  const outRefs = {};
  const outHistory = {};
  const outState = {};
  for (const ref of refs) {
    const r = aggregate({
      ref,
      ebay: ebay.byRef[ref.id] || null,
      reddit: reddit.byRef[ref.id] || null,
      prevLive: prevMarket.refs && prevMarket.refs[ref.id],
      history: history[ref.id] || [],
      ebayState: ebayState[ref.id],
      now,
    });
    outRefs[ref.id] = r.live;
    outHistory[ref.id] = r.history;
    if (r.state) outState[ref.id] = r.state;
    else if (ebayState[ref.id]) outState[ref.id] = ebayState[ref.id];
  }

  const market = { updatedAt: now, fx, sources, refs: outRefs };
  await writeJson(path.join(dataDir, "market.json"), market);
  await writeJson(path.join(dataDir, "history.json"), outHistory);
  await writeJson(path.join(dataDir, "state", "ebay.json"), outState);
  log.log(`Mise à jour terminée : ${refs.length} références · BCE ${sources.ecb.status} · eBay ${sources.ebay.status} · Reddit ${sources.reddit.status}`);
  return market;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run({ mockDir: arg("--mock"), now: arg("--now") || new Date().toISOString() }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
