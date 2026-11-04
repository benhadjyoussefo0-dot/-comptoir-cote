// Source Reddit : r/Watchexchange (annonces [WTS] = offre, [WTB] = demande).
// Nécessite une application Reddit « script » déjà approuvée (REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET).
// Reddit n'accepte plus de nouvelles demandes depuis le 31/10/2026 et ferme l'accès public en mars 2027.
import { extractPrice, postKind } from "./text.mjs";
import { toEur } from "./ebay.mjs";

const TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const API = "https://oauth.reddit.com";

export async function getRedditToken(fetchImpl, clientId, clientSecret, userAgent) {
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded", "User-Agent": userAgent },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Reddit : jeton refusé (HTTP ${res.status})`);
  const json = await res.json();
  if (!json.access_token) throw new Error("Reddit : jeton absent de la réponse");
  return json.access_token;
}

export function normalizePost(child, rates) {
  const d = child && child.data;
  if (!d) return null;
  const kind = postKind(d.title);
  if (!kind) return null;
  const price = kind === "WTS" ? extractPrice(d.title) : null;
  const priceEur = price ? toEur(price.value, price.currency, rates) : null;
  return {
    id: d.id,
    kind,
    title: d.title,
    priceEur: priceEur ? Math.round(priceEur) : null,
    created: new Date((d.created_utc || 0) * 1000).toISOString(),
    url: d.permalink ? `https://www.reddit.com${d.permalink}` : null,
  };
}

export async function searchReddit(fetchImpl, token, userAgent, query, rates) {
  const q = `title:(${query})`;
  const url = `${API}/r/Watchexchange/search?q=${encodeURIComponent(q)}&restrict_sr=1&sort=new&t=month&limit=100&raw_json=1`;
  const res = await fetchImpl(url, { headers: { Authorization: `bearer ${token}`, "User-Agent": userAgent } });
  if (!res.ok) throw new Error(`Reddit : HTTP ${res.status}`);
  const json = await res.json();
  const children = (json.data && json.data.children) || [];
  return children.map((c) => normalizePost(c, rates)).filter(Boolean);
}

export async function collectReddit(fetchImpl, env, refs, rates, log = console) {
  if (!env.REDDIT_CLIENT_ID || !env.REDDIT_CLIENT_SECRET) {
    return { status: "non configurée", message: "Pas de clé Reddit : Reddit n'ouvre plus de nouveaux accès à son API depuis le 31/10/2026.", byRef: {} };
  }
  const ua = env.REDDIT_USER_AGENT || "comptoir-cote:v1.0 (GitHub Actions)";
  const token = await getRedditToken(fetchImpl, env.REDDIT_CLIENT_ID, env.REDDIT_CLIENT_SECRET, ua);
  const byRef = {};
  const errors = [];
  for (const ref of refs) {
    if (!ref.queries || !ref.queries.reddit) continue;
    try {
      byRef[ref.id] = { posts: await searchReddit(fetchImpl, token, ua, ref.queries.reddit, rates) };
    } catch (e) {
      errors.push(`${ref.id} : ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, env.REDDIT_DELAY_MS ? Number(env.REDDIT_DELAY_MS) : 1100));
  }
  if (errors.length) log.warn("Reddit, erreurs partielles :", errors.join(" | "));
  return { status: errors.length ? "partielle" : "ok", message: errors.length ? `${errors.length} requête(s) en échec` : "r/Watchexchange, 30 derniers jours", byRef };
}
