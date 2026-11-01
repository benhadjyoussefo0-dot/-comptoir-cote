// Source eBay : API Browse (annonces actives), jeton applicatif « client credentials ».
// Clés gratuites sur developer.ebay.com : EBAY_CLIENT_ID et EBAY_CLIENT_SECRET.
import { titleMatches } from "./text.mjs";

const TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const SEARCH_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search";
const SCOPE = "https://api.ebay.com/oauth/api_scope";

// Places de marché interrogées, avec leur devise.
export const MARKETPLACES = [
  { id: "EBAY_FR", currency: "EUR" },
  { id: "EBAY_DE", currency: "EUR" },
  { id: "EBAY_US", currency: "USD" },
];

const NEW_IDS = new Set(["1000", "1500", "1750"]);
const PARTS_IDS = new Set(["7000"]);

export async function getEbayToken(fetchImpl, clientId, clientSecret) {
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=client_credentials&scope=${encodeURIComponent(SCOPE)}`,
  });
  if (!res.ok) throw new Error(`eBay : jeton refusé (HTTP ${res.status})`);
  const json = await res.json();
  if (!json.access_token) throw new Error("eBay : jeton absent de la réponse");
  return json.access_token;
}

// Convertit un montant vers l'euro avec les taux BCE (1 € = rates[devise]).
export function toEur(value, currency, rates) {
  if (value == null) return null;
  if (currency === "EUR") return value;
  const r = rates && rates[currency];
  return r ? value / r : null;
}

export function normalizeItem(item, marketplace, rates) {
  const conditionId = String(item.conditionId || "");
  if (PARTS_IDS.has(conditionId)) return null;
  const price = Number(item.price && item.price.value);
  const currency = (item.price && item.price.currency) || marketplace.currency;
  const priceEur = toEur(price, currency, rates);
  if (!Number.isFinite(priceEur)) return null;
  return {
    id: item.itemId,
    title: item.title || "",
    priceEur: Math.round(priceEur),
    condition: NEW_IDS.has(conditionId) ? "new" : "used",
    created: item.itemCreationDate || null,
    end: item.itemEndDate || null,
    url: item.itemWebUrl || null,
    market: marketplace.id,
  };
}

// Recherche une référence sur une place de marché (jusqu'à 3 pages de 200 annonces).
export async function searchMarketplace(fetchImpl, token, ref, marketplace, rates) {
  const anchor = ref.anchor && ref.anchor.market;
  const rate = marketplace.currency === "EUR" ? 1 : (rates && rates[marketplace.currency]) || 1;
  const filters = ["buyingOptions:{FIXED_PRICE|BEST_OFFER}"];
  if (anchor) {
    const lo = Math.round(anchor * 0.4 * rate);
    const hi = Math.round(anchor * 2.5 * rate);
    filters.push(`price:[${lo}..${hi}]`, `priceCurrency:${marketplace.currency}`);
  }
  const items = [];
  let total = 0;
  for (let offset = 0; offset < 600; offset += 200) {
    const url = `${SEARCH_URL}?q=${encodeURIComponent(ref.queries.ebay)}&limit=200&offset=${offset}&filter=${encodeURIComponent(filters.join(","))}`;
    const res = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": marketplace.id },
    });
    if (!res.ok) throw new Error(`eBay ${marketplace.id} : HTTP ${res.status}`);
    const json = await res.json();
    total = json.total || 0;
    for (const raw of json.itemSummaries || []) {
      const it = normalizeItem(raw, marketplace, rates);
      if (it && titleMatches(it.title, ref.match)) items.push(it);
    }
    if (!json.next || offset + 200 >= total) break;
  }
  return { items, rawTotal: total, complete: total <= 600 };
}

export async function collectEbay(fetchImpl, env, refs, rates, log = console) {
  if (!env.EBAY_CLIENT_ID || !env.EBAY_CLIENT_SECRET) {
    return { status: "non configurée", message: "Ajoutez EBAY_CLIENT_ID et EBAY_CLIENT_SECRET dans les secrets du dépôt.", byRef: {} };
  }
  const token = await getEbayToken(fetchImpl, env.EBAY_CLIENT_ID, env.EBAY_CLIENT_SECRET);
  const byRef = {};
  const errors = [];
  for (const ref of refs) {
    if (!ref.queries || !ref.queries.ebay) continue;
    byRef[ref.id] = { items: [], complete: true };
    const seen = new Set(); // une même annonce peut apparaître sur plusieurs places de marché
    for (const mp of MARKETPLACES) {
      try {
        const r = await searchMarketplace(fetchImpl, token, ref, mp, rates);
        for (const it of r.items) if (!seen.has(it.id)) { seen.add(it.id); byRef[ref.id].items.push(it); }
        byRef[ref.id].complete = byRef[ref.id].complete && r.complete;
      } catch (e) {
        errors.push(`${ref.id}/${mp.id} : ${e.message}`);
        byRef[ref.id].complete = false;
      }
    }
  }
  if (errors.length) log.warn("eBay, erreurs partielles :", errors.join(" | "));
  return {
    status: errors.length ? "partielle" : "ok",
    message: errors.length ? `${errors.length} requête(s) en échec` : `${MARKETPLACES.map((m) => m.id).join(", ")}`,
    byRef,
  };
}
