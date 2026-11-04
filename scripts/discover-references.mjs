#!/usr/bin/env node
// Liste maîtresse : repère les références les plus présentes dans les annonces eBay actives,
// par marque prioritaire, pour décider lesquelles coter ensuite. Critère mesurable et sourcé :
// nombre d'annonces distinctes où la référence apparaît. Seuls des comptes sont conservés
// (ni titres, ni liens, ni vendeurs).
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { getEbayToken, MARKETPLACES } from "./lib/ebay.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEARCH_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search";
const WRISTWATCHES = "31387";   // catégorie eBay « Montres-bracelets »
export const METHOD = "v1";

// Motifs de référence par marque. Chaque motif renvoie la forme canonique, sans préfixe ni suffixe de variante.
export const BRANDS = [
  { brand: "Tudor", query: "Tudor", patterns: [/\bM?(\d{4}[A-Z]\d[A-Z]\d[A-Z]{2})(?:-\d{4})?\b/g, /\bM?(\d{5}[A-Z]{0,3})(?:-\d{4})?\b/g] },
  { brand: "Seiko", query: "Seiko", patterns: [/\b(S[A-Z]{2}\d{3})(?:[A-Z]\d)?\b/g, /\b(S[A-Z]{3}\d{2})(?:[A-Z]\d)?\b/g] },
  { brand: "IWC", query: "IWC", patterns: [/\b(IW\d{6})\b/g] },
];

const NOT_REFS = /^(19|20)\d{2}$/;   // une année n'est pas une référence

export function extractRefs(title, brandDef) {
  const t = String(title || "").toUpperCase(), out = new Set();
  for (const re of brandDef.patterns) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(t))) if (!NOT_REFS.test(m[1])) out.add(m[1]);
  }
  return [...out];
}

// items : [{ id, title, market }] ; renvoie les candidates triées par nombre d'annonces.
export function rank(itemsByBrand, isTracked, minListings = 3) {
  const out = [];
  for (const { brand, items, def } of itemsByBrand) {
    const seen = new Map();
    for (const it of items) {
      for (const ref of extractRefs(it.title, def)) {
        if (!seen.has(ref)) seen.set(ref, { ids: new Set(), markets: {} });
        const e = seen.get(ref);
        if (e.ids.has(it.id)) continue;
        e.ids.add(it.id);
        e.markets[it.market] = (e.markets[it.market] || 0) + 1;
      }
    }
    for (const [ref, e] of seen) {
      if (e.ids.size < minListings) continue;
      const tracked = isTracked(brand + " " + ref);
      out.push({ brand, ref, listings: e.ids.size, markets: e.markets, tracked: tracked ? tracked.id : null });
    }
  }
  return out.sort((a, b) => b.listings - a.listings || a.ref.localeCompare(b.ref));
}

async function loadReferentiel() {
  const code = await readFile(path.join(ROOT, "site", "js", "referentiel.js"), "utf8");
  const ctx = { window: {} };
  vm.runInNewContext(code, ctx);
  return ctx.window.Referentiel;
}

async function fetchBrand(fetchImpl, token, def, marketplace) {
  const items = [];
  for (let offset = 0; offset < 1000; offset += 200) {
    const url = `${SEARCH_URL}?q=${encodeURIComponent(def.query)}&category_ids=${WRISTWATCHES}&limit=200&offset=${offset}`;
    const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": marketplace.id } });
    if (!res.ok) throw new Error(`eBay ${marketplace.id} : HTTP ${res.status}`);
    const json = await res.json();
    for (const it of json.itemSummaries || []) items.push({ id: it.itemId, title: it.title, market: marketplace.id });
    if (!json.next || offset + 200 >= (json.total || 0)) break;
  }
  return items;
}

export async function run({ env = process.env, mockDir = null, now = new Date(), log = console, out = path.join(ROOT, "data", "liste-maitresse.json") } = {}) {
  const R = await loadReferentiel();
  const refs = JSON.parse(await readFile(path.join(ROOT, "data", "references.json"), "utf8"));
  const prepared = refs.map(R.prepare);
  const isTracked = (q) => { const m = R.match(prepared, q, 0.9); return m && m.ref; };
  const byBrand = [];
  if (mockDir) {
    for (const f of await readdir(mockDir)) {
      const def = BRANDS.find((b) => b.brand.toLowerCase() === f.replace(/\.json$/, ""));
      if (def) byBrand.push({ brand: def.brand, def, items: JSON.parse(await readFile(path.join(mockDir, f), "utf8")) });
    }
  } else {
    if (!env.EBAY_CLIENT_ID || !env.EBAY_CLIENT_SECRET) { log.log("Clés eBay absentes : liste maîtresse non mise à jour."); return null; }
    const token = await getEbayToken(fetch, env.EBAY_CLIENT_ID, env.EBAY_CLIENT_SECRET);
    for (const def of BRANDS) {
      const items = [];
      for (const mk of MARKETPLACES) items.push(...await fetchBrand(fetch, token, def, mk).catch((e) => { log.warn(e.message); return []; }));
      byBrand.push({ brand: def.brand, def, items });
    }
  }
  const candidates = rank(byBrand, isTracked);
  const result = {
    updatedAt: now.toISOString(),
    method: METHOD,
    criterion: "Nombre d'annonces eBay actives distinctes (catégorie Montres-bracelets, France, Allemagne, États-Unis) où la référence apparaît, 3 au minimum.",
    scanned: Object.fromEntries(byBrand.map((b) => [b.brand, b.items.length])),
    coverage: { candidates: candidates.length, tracked: candidates.filter((c) => c.tracked).length },
    candidates,
  };
  await writeFile(out, JSON.stringify(result, null, 1) + "\n");
  const t = result.coverage.tracked;
  log.log(`Liste maîtresse : ${candidates.length} référence${candidates.length > 1 ? "s" : ""} candidate${candidates.length > 1 ? "s" : ""}, dont ${t} déjà suivie${t > 1 ? "s" : ""}.`);
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf("--mock");
  // Les données de démonstration ne vont jamais dans data/ : elles sont écrites dans le dossier temporaire.
  const opts = i > 0 ? { mockDir: process.argv[i + 1], out: path.join(tmpdir(), "liste-maitresse-demo.json") } : {};
  run(opts).then(() => { if (opts.out) console.log("Démonstration écrite dans " + opts.out); }).catch((e) => { console.error(e); process.exit(1); });
}
