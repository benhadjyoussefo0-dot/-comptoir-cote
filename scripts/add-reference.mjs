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
    "Ne donne que des faits d'identification et des caractéristiques techniques, aucun prix ni estimation de marché. " +
    "Si tu ne sais pas, mets null ou une chaîne vide : n'invente rien. Réponds uniquement par un objet JSON avec ces clés :\n" +
    '{"modele":"","collection":"","surnoms":[],"equivalents_regionaux":[],"statut":"","annees":"","calibre":"","reserve_marche":"","diametre":"","epaisseur":"","etancheite":"","materiau":"",' +
    '"contrefacon":"faible|moyen|eleve","garantie":"","points_authentification":[],"pieges":[],"generations":[],' +
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
  // Seul un prix de départ saisi par une personne est accepté ; aucun prix n'est demandé à l'IA.
  const prix = Number(arg("--prix")) || null;
  const token = compact(ref).replace(/^m(?=\d)/, "");
  const entry = {
    id,
    brand,
    model: model || ai.modele || "",
    collection: ai.collection || "",
    nicknames: Array.isArray(ai.surnoms) ? ai.surnoms : [],
    equivalents: Array.isArray(ai.equivalents_regionaux) ? ai.equivalents_regionaux : [],
    ref,
    aliases: [compact(ref), token, (model || "").toLowerCase()].filter(Boolean),
    status: ai.statut || "Statut non vérifié",
    years: ai.annees || "",
    specs: { calibre: ai.calibre, reserve: ai.reserve_marche, diam: ai.diametre, epais: ai.epaisseur, etanch: ai.etancheite, mat: ai.materiau },
    retail: { eur: null, label: null },
    anchor: {
      market: prix || null,
      low: prix ? Math.round(prix * 0.9) : null,
      high: prix ? Math.round(prix * 1.1) : null,
      date: new Date().toISOString().slice(0, 10),
      basis: prix ? "Prix de départ saisi à l'ajout" : "En attente des premières annonces",
    },
    study: { days: null, salesYear: null, listings: null, vol: null, trend: null, trendNote: null },
    offer: null,
    hype: null,
    fake: ["faible", "moyen", "eleve"].includes(ai.contrefacon) ? ai.contrefacon : "moyen",
    service: null,
    warranty: ai.garantie || "",
    naked: 0.12,
    auth: ai.points_authentification || [],
    pitfalls: ai.pieges || [],
    generations: ai.generations || [],
    sources: [],
    added: { at: new Date().toISOString(), by: process.env.GITHUB_ACTOR || "local", ai: Boolean(ai.calibre), verified: false },
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
