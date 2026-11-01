// Taux de référence officiels de la BCE (gratuit, sans clé).
export const ECB_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";

export function parseEcbXml(xml) {
  const time = (String(xml).match(/time=['"](\d{4}-\d{2}-\d{2})['"]/) || [])[1] || null;
  const rates = {};
  for (const m of String(xml).matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]/g)) {
    rates[m[1]] = Number(m[2]);
  }
  return { date: time, rates };
}

export async function fetchEcb(fetchImpl) {
  const res = await fetchImpl(ECB_URL, { headers: { "User-Agent": "comptoir-cote/1.0" } });
  if (!res.ok) throw new Error(`BCE : réponse HTTP ${res.status}`);
  const parsed = parseEcbXml(await res.text());
  if (!parsed.rates.USD) throw new Error("BCE : taux USD introuvable");
  return parsed;
}
