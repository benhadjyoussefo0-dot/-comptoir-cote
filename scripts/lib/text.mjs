// Normalisation des titres d'annonces et filtrage par référence.

export function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Version sans espaces ni tirets : « M79030N-0001 » et « m 79030 n » deviennent comparables.
export function compact(text) {
  return normalize(text).replace(/[\s\-_./]/g, "");
}

// Annonces qui ne sont pas une montre complète, ou pas authentique.
export const JUNK = [
  "replica", "replique", "homage", "hommage", "for parts", "pour pieces", "pour piece",
  "box only", "boite seule", "boite vide", "empty box", "dial only", "cadran seul",
  "bezel insert", "case only", "clasp only", "fermoir seul", "links only", "maillons seuls",
  "strap only", "bracelet seul", "band only", "watch box", "papers only", "papiers seuls",
];

// match = { any: [...], none: [...] } : au moins un jeton « any » et aucun jeton « none ».
export function titleMatches(title, match) {
  const n = normalize(title);
  const c = compact(title);
  if (JUNK.some((j) => n.includes(j))) return false;
  const any = (match && match.any) || [];
  const none = (match && match.none) || [];
  const has = (token) => n.includes(normalize(token)) || c.includes(compact(token));
  if (any.length && !any.some(has)) return false;
  if (none.some(has)) return false;
  return true;
}

// Extrait le premier prix d'un titre Reddit (« $2,999 », « 2.999 € », « 3150 USD »).
export function extractPrice(title) {
  const t = String(title || "");
  const patterns = [
    { re: /\$\s?(\d{1,3}(?:[,.\s]\d{3})+|\d{3,6})(?![\d])/, cur: "USD" },
    { re: /(\d{1,3}(?:[,.\s]\d{3})+|\d{3,6})\s?(?:usd|\$)/i, cur: "USD" },
    { re: /€\s?(\d{1,3}(?:[,.\s]\d{3})+|\d{3,6})(?![\d])/, cur: "EUR" },
    { re: /(\d{1,3}(?:[,.\s]\d{3})+|\d{3,6})\s?(?:€|eur\b|euros?)/i, cur: "EUR" },
    { re: /£\s?(\d{1,3}(?:[,.\s]\d{3})+|\d{3,6})(?![\d])/, cur: "GBP" },
  ];
  for (const p of patterns) {
    const m = t.match(p.re);
    if (m) {
      const value = Number(m[1].replace(/[,.\s]/g, ""));
      if (Number.isFinite(value) && value >= 100) return { value, currency: p.cur };
    }
  }
  return null;
}

export function postKind(title) {
  const m = String(title || "").match(/\[(WTS|WTT|WTB|WTS\/WTT|WTT\/WTS)\]/i);
  if (!m) return null;
  const k = m[1].toUpperCase();
  return k === "WTB" ? "WTB" : "WTS";
}
