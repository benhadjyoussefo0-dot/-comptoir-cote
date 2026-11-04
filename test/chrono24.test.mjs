import { test } from "node:test";
// Le script tourne dans un contexte vm : ses tableaux ont un autre prototype, d'où Array.from avant comparaison.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const code = await readFile(path.join(ROOT, "site", "chrono24.js"), "utf8");

function load() {
  const store = {};
  const window = {
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); }
    }
  };
  vm.runInNewContext(code, { window });
  return window.Chrono24;
}

// Extrait de page de résultats Chrono24 (fr) copiée avec Ctrl+A, Ctrl+C.
const PAGE_FR = `Chrono24
Rechercher
Filtres
Prix
Moins de 2 000 €
2 000 € - 3 000 €
Plus de 3 000 €
128 annonces
Trier par : Pertinence
Tudor Black Bay Fifty-Eight M79030N-0001
2021 · Boîte et papiers d'origine
3 150 €
+ 30 € de frais de port
Allemagne
Tudor Black Bay 58 79030N
2 890 €
+ 45 € de frais de port
France
Bracelet acier pour Tudor Black Bay 58
350 €
Tudor Black Bay Fifty-Eight 79030N Full Set 2023
3 290 €
Livraison gratuite
Tudor 79030N
2 950 €
Tudor Black Bay 58 Noire 79030N
3 050 €
Tudor M79030N
2 990 €
Tudor BB58 79030N 2020
2 850 €
Tudor Black Bay 58 79030N
3 100 €
Tudor Black Bay 58 79030N
5 900 €
Tudor Black Bay 58 79030N or jaune
9 800 €
Tudor BB58 79030N
Prix sur demande`;

test("Chrono24 : prix d'une page copiée, sans frais de port, filtres ni prix hors sujet", () => {
  const C = load();
  const r = C.parsePasted(PAGE_FR, { anchor: 2512 });
  assert.deepEqual(Array.from(r.prices), [2850, 2890, 2950, 2990, 3050, 3100, 3150, 3290]);
  assert.equal(r.dropped.shipping, 2);
  assert.equal(r.dropped.filter, 4);
  assert.equal(r.dropped.range, 2);     // bracelet à 350 € et version or à 9 800 €
  assert.equal(r.dropped.outlier, 1);   // 5 900 €
  assert.equal(r.total, 128);
  assert.equal(r.mode, "page");
});

test("Chrono24 : formats anglais, dollars convertis, liste simple", () => {
  const C = load();
  const en = C.parsePasted("Tudor 79030N €3,150 shipped\nTudor 79030N $3,400\nTudor 79030N €2,990.00", { usdRate: 1.1172 });
  assert.deepEqual(Array.from(en.prices), [2990, 3043, 3150]);
  const noFx = C.parsePasted("Tudor 79030N $3,400", {});
  assert.equal(noFx.prices.length, 0);
  assert.equal(noFx.dropped.currency, 1);
  const plain = C.parsePasted("2450 2600\n2 750; 2.890", {});
  assert.deepEqual(Array.from(plain.prices), [2450, 2600, 2750, 2890]);
  assert.equal(plain.mode, "liste");
});

test("Chrono24 : résumé, poids selon l'ancienneté et fusion avec la cote", () => {
  const C = load();
  const now = Date.parse("2026-11-04T20:00:00Z");
  const rel = C.summarize([2850, 2890, 2950, 2990, 3050, 3100, 3150, 3290], 128, "2026-11-04T19:00:00Z");
  assert.equal(rel.median, 3020);
  assert.equal(rel.n, 8);
  assert.equal(C.weightOf(rel, now), 0.5);                                   // 8 / (8 + 8)
  assert.equal(C.weightOf({ ...rel, date: "2026-08-01T00:00:00Z" }, now), 0); // trop ancien
  const b = C.blend({ mk: 2512, low: 2400, high: 2650 }, rel, now);
  assert.equal(Math.round(b.mk), Math.round(2512 + 0.5 * (3020 * 0.92 - 2512)));
  assert.equal(b.weight, 0.5);
  const none = C.blend({ mk: 2512, low: 2400, high: 2650 }, null, now);
  assert.equal(none.mk, 2512);
});

test("Chrono24 : relevés conservés par référence, 20 au plus", () => {
  const C = load();
  for (let i = 0; i < 22; i++) C.save("tudor-79030n", C.summarize([3000 + i, 3100, 3200], null, `2026-11-${String(i % 28 + 1).padStart(2, "0")}T10:00:00Z`));
  assert.equal(C.list("tudor-79030n").length, 20);
  assert.equal(C.latest("tudor-79030n").prices[0], 3021);
  C.removeLast("tudor-79030n");
  assert.equal(C.list("tudor-79030n").length, 19);
  assert.equal(C.latest("seiko-spb143"), null);
  assert.match(C.searchUrl("Tudor 79030N"), /^https:\/\/www\.chrono24\.fr\/search\/index\.htm\?dosearch=true&query=Tudor%2079030N$/);
});
