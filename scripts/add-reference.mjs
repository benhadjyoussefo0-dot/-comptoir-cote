#!/usr/bin/env node
// Ajoute une montre au suivi. Lancé par le workflow « Ajouter une référence » ou en local :
// node scripts/add-reference.mjs --brand "Omega" --model "Speedmaster Professional" --ref "310.30.42.50.01.001" \
//   [--ebay "Omega 310.30.42.50.01.001"] [--reddit "310.30.42"] [--prix 5200]
// Si ANTHROPIC_API_KEY est défini, Claude remplit la fiche (caractéristiques, points d'authentification, pièges).
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compact } from "./lib/text.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = path.join(ROOT, "data", "references.json");

function arg(name) {
  const i = process.argv.indexOf(name);
  const v = i > 0 ? process.argv[i + 1] : process.env[`INPUT_${name.replace(/^--/, "").toUpperCase()}`];
  return v && String(v).trim() ? String(v).trim() : null;
}

const slug = (s) => compact(s).replace(/[^a-z0-9]/g, "").slice(0, 40);

async function askClaude(brand, model, ref) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const prompt =
    `Tu es analyste du marché horloger de seconde main en Europe. Montre : marque « ${brand} », modèle « ${model || "?"} », référence « ${ref} ».\n` +
    "Donne des estimations PRUDENTES. Prix de TRANSACTION en euros pour un exemplaire en excellent état avec boîte et papiers. " +
    "Si tu ne sais pas, mets null : n'invente jamais de chiffre précis. Réponds uniquement par un objet JSON avec ces clés :\n" +
    '{"modele":"","statut":"","annees":"","calibre":"","reserve_marche":"","diametre":"","epaisseur":"","etancheite":"","materiau":"",' +
    '"prix_neuf_eur":null,"prix_marche_eur":null,"prix_bas_eur":null,"prix_haut_eur":null,"delai_vente_jours":null,"volatilite_pct":null,' +
    '"tendance_12m_pct":null,"hype_0_100":null,"note_hype":"","contrefacon":"faible|moyen|eleve","revision_cout_min_eur":null,' +
    '"revision_cout_max_eur":null,"garantie":"","decote_montre_seule_pct":null,"points_authentification":[],"pieges":[],"generations":[],' +
    '"jetons_titre":[],"jetons_exclus":[]}\n' +
    "jetons_titre : 1 à 3 chaînes qui identifient la référence dans un titre d'annonce. jetons_exclus : variantes proches à exclure. Tout en français.";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5", max_tokens: 1500, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) {
    console.warn(`Claude indisponible (HTTP ${res.status}) : fiche minimale créée.`);
    return null;
  }
  const json = await res.json();
  const text = (json.content || []).map((c) => c.text || "").join("");
  try {
    return JSON.parse((text.match(/\{[\s\S]*\}/) || ["{}"])[0]);
  } catch {
    console.warn("Réponse de Claude illisible : fiche minimale créée.");
    return null;
  }
}

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

async function main() {
  const brand = arg("--brand");
  const ref = arg("--ref");
  if (!brand || !ref) {
    console.error("Marque et référence obligatoires (--brand, --ref).");
    process.exit(1);
  }
  const model = arg("--model") || "";
  const refs = JSON.parse(await readFile(FILE, "utf8"));
  const id = `${slug(brand)}-${slug(ref)}`;
  if (refs.some((r) => r.id === id)) {
    console.log(`La référence ${id} est déjà suivie.`);
    return;
  }
  const ai = (await askClaude(brand, model, ref)) || {};
  const prix = Number(arg("--prix")) || num(ai.prix_marche_eur);
  const token = compact(ref).replace(/^m(?=\d)/, "");
  const entry = {
    id,
    brand,
    model: model || ai.modele || "",
    ref,
    aliases: [compact(ref), token, (model || "").toLowerCase()].filter(Boolean),
    status: ai.statut || "Statut non vérifié",
    years: ai.annees || "",
    specs: { calibre: ai.calibre, reserve: ai.reserve_marche, diam: ai.diametre, epais: ai.epaisseur, etanch: ai.etancheite, mat: ai.materiau },
    retail: { eur: num(ai.prix_neuf_eur), label: num(ai.prix_neuf_eur) ? `${Math.round(ai.prix_neuf_eur)} € (estimation IA)` : null },
    anchor: {
      market: prix || null,
      low: num(ai.prix_bas_eur) || (prix ? Math.round(prix * 0.9) : null),
      high: num(ai.prix_haut_eur) || (prix ? Math.round(prix * 1.1) : null),
      date: new Date().toISOString().slice(0, 10),
      basis: arg("--prix") ? "Prix de départ saisi à l'ajout" : prix ? "Estimation IA à l'ajout (à confirmer par les annonces)" : "En attente des premières annonces",
    },
    study: { days: num(ai.delai_vente_jours), salesYear: null, listings: null, vol: num(ai.volatilite_pct), trend: num(ai.tendance_12m_pct), trendNote: ai.tendance_12m_pct != null ? "estimation IA à l'ajout" : null },
    offer: null,
    hype: num(ai.hype_0_100) != null ? { score: Math.round(ai.hype_0_100), note: ai.note_hype || "estimation IA à l'ajout" } : { score: 50, note: "valeur neutre à l'ajout" },
    fake: ["faible", "moyen", "eleve"].includes(ai.contrefacon) ? ai.contrefacon : "moyen",
    service: num(ai.revision_cout_min_eur) != null ? { interval: "Non vérifié", low: ai.revision_cout_min_eur, high: num(ai.revision_cout_max_eur) || ai.revision_cout_min_eur } : null,
    warranty: ai.garantie || "",
    naked: num(ai.decote_montre_seule_pct) != null ? ai.decote_montre_seule_pct / 100 : 0.12,
    auth: ai.points_authentification || [],
    pitfalls: ai.pieges || [],
    generations: ai.generations || [],
    sources: [],
    added: { at: new Date().toISOString(), by: process.env.GITHUB_ACTOR || "local", ai: Boolean(ai.calibre || ai.prix_marche_eur) },
    queries: { ebay: arg("--ebay") || `${brand} ${ref}`, reddit: arg("--reddit") || `"${ref}"` },
    match: { any: (ai.jetons_titre && ai.jetons_titre.length ? ai.jetons_titre : [token]).map((t) => String(t).toLowerCase()), none: (ai.jetons_exclus || []).map((t) => String(t).toLowerCase()) },
  };
  refs.push(entry);
  await writeFile(FILE, JSON.stringify(refs, null, 1) + "\n");
  console.log(`Ajoutée : ${brand} ${ref} (${id}). Requête eBay « ${entry.queries.ebay} », Reddit « ${entry.queries.reddit} ».`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
