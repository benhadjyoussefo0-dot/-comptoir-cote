import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const code = await readFile(path.join(ROOT, "site", "js", "referentiel.js"), "utf8");
const window = {};
vm.runInNewContext(code, { window });
const R = window.Referentiel;
const REFS = JSON.parse(await readFile(path.join(ROOT, "data", "references.json"), "utf8"));
// Le script tourne dans un contexte vm : on repasse les tableaux par JSON avant de les comparer.
const plain = (v) => JSON.parse(JSON.stringify(v));

const docs = REFS.map((r) => ({
  id: r.id, brand: r.brand, collection: r.collection, model: r.model, ref: r.ref,
  aliases: r.aliases, nicknames: r.nicknames, equivalents: r.equivalents,
  cote: r.anchor.market, trend12: r.study.trend, risk: 40, confidence: "Faible",
  production: r.status.startsWith("En production") ? "En production" : "Arrêtée ou inconnue",
  diam: parseFloat(String(r.specs.diam).replace(",", ".")), material: r.specs.mat
}));

test("normalisation : préfixe M, suffixe de variante, suffixe Seiko", () => {
  assert.deepEqual(plain(R.refForms("M79030N-0001")), ["m79030n0001", "m79030n", "79030n0001", "79030n"]);
  assert.deepEqual(plain(R.refForms("SPB143J1")), ["spb143j1", "spb143"]);
  assert.deepEqual(plain(R.refForms("IW328201")), ["iw328201"]);
  assert.equal(R.compact(" m 79030 n-0001 "), "m79030n0001");
});

test("rapprochement : formes d'écriture, équivalent régional, surnom, titre d'annonce", () => {
  const P = REFS.map(R.prepare);
  const id = (q) => (R.match(P, q) || {}).ref?.id || null;
  for (const q of ["M79030N-0001", "79030N", "m79030n", "Tudor 79030 N"]) assert.equal(id(q), "tudor-79030n", q);
  assert.equal(id("SBDC101"), "seiko-spb143");                      // équivalent japonais
  assert.equal(R.match(P, "SBDC101").why, "équivalent régional");
  assert.equal(id("62MAS"), "seiko-spb143");                         // surnom
  assert.equal(id("Mark XX"), "iwc-iw328201");
  assert.equal(id("IW388102"), "iwc-pilot-chrono-41");               // seconde référence de la même fiche
  assert.equal(id("TUDOR M79030N-0001 Black Bay 58 full set 2021"), "tudor-79030n");
  assert.equal(id("Rolex Submariner 124060"), null);                 // aucune fiche : pas de rapprochement forcé
  assert.equal(R.match(P, "M79030N-0001").confidence, "élevé");
});

test("tolérance aux fautes : une lettre ou un chiffre", () => {
  const P = REFS.map(R.prepare);
  assert.equal(R.match(P, "79031N").ref.id, "tudor-79030n");
  assert.equal(R.match(P, "79031N").confidence, "faible");
  assert.equal(R.createIndex(docs).run({ q: "pelagso" }).results[0].id, "tudor-25407n");   // transposition
  assert.equal(R.editDistance("abcd", "abdc", 1), 1);
});

test("recherche à facettes : filtres, comptes disjonctifs, options dépendantes, tri", () => {
  const ix = R.createIndex(docs);
  const all = ix.run({});
  assert.equal(all.total, 10);
  assert.deepEqual(plain(all.facets.marque.map((f) => [f.value, f.count])), [["IWC", 2], ["Seiko", 3], ["Tudor", 5]]);
  assert.equal(all.facets.collection.length, 0);                     // collections cachées tant qu'aucune marque n'est choisie
  const t = ix.run({ filters: { marque: ["Tudor"] }, min: 2600, max: 4000 });
  assert.deepEqual(plain(t.results.map((d) => d.id)), ["tudor-bb58-2026", "tudor-25407n", "tudor-79000n", "tudor-79830rb"]);
  // Le compte d'une marque ignore le filtre de marque lui-même, mais respecte la fourchette de cote.
  assert.deepEqual(plain(t.facets.marque.map((f) => [f.value, f.count])), [["IWC", 1], ["Tudor", 4]]);
  assert.deepEqual(plain(t.facets.collection.map((f) => f.value)), ["Black Bay", "Pelagos"]);
  const q = ix.run({ q: "bb58" });
  assert.deepEqual(plain(q.results.map((d) => d.id)), ["tudor-79030n", "tudor-bb58-2026"]);
  const up = ix.run({ sort: "hausse" });
  assert.equal(up.results[0].id, "tudor-25407n");
});

test("suggestions groupées et état dans l'adresse", () => {
  const ix = R.createIndex(docs);
  const s = plain(ix.suggest("62mas"));
  assert.equal(s[0].id, "seiko-spb143");
  assert.equal(s[0].group, "Surnoms");
  const st = { q: "black bay", filters: { marque: ["Tudor", "IWC"] }, min: 1400, max: 4000, sort: "cote-desc" };
  const qs = R.toQuery(st);
  assert.equal(qs, "?q=black%20bay&marque=Tudor,IWC&cote=1400-4000&tri=cote-desc");
  assert.deepEqual(plain(R.fromQuery(qs)), { filters: { marque: ["Tudor", "IWC"] }, q: "black bay", min: 1400, max: 4000, sort: "cote-desc" });
});
