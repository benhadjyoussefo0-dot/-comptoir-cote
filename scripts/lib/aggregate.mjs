// Transforme les annonces collectées en indicateurs « en direct » pour une référence.
import { describe, coefficientOfVariation, clamp, round, daysBetween, sorted, quantile } from "./stats.mjs";

export const ASK_DISCOUNT = 0.08; // écart moyen prix demandé → prix de vente (5 à 15 % observés)
export const SMOOTH_K = 8;        // plus l'échantillon est grand, plus la cote bouge
export const MAX_STEP = 0.6;      // part maximale de l'écart absorbée en une mise à jour
const HISTORY_MAX = 400;          // points journaliers conservés (~13 mois)
const GONE_KEEP_DAYS = 180;

const day = (iso) => String(iso).slice(0, 10);

// Met à jour le suivi des annonces eBay : une annonce qui disparaît avant sa date de fin
// est comptée comme « écoulée » (vendue ou retirée). C'est un indicateur, pas une vente certaine.
export function updateEbayState(prevState, items, complete, now) {
  const prevActive = (prevState && prevState.active) || {};
  const gone = ((prevState && prevState.gone) || []).filter((g) => daysBetween(g.gone, now) <= GONE_KEEP_DAYS);
  const active = {};
  for (const it of items) {
    const prev = prevActive[it.id];
    active[it.id] = { created: it.created, end: it.end, first: prev ? prev.first : now, price: it.priceEur };
  }
  if (complete) {
    for (const [id, p] of Object.entries(prevActive)) {
      if (active[id]) continue;
      const endedNaturally = p.end && new Date(p.end) <= new Date(now);
      if (!endedNaturally) gone.push({ id, created: p.created || p.first, gone: now, price: p.price });
    }
  }
  return { active, gone, trackingSince: (prevState && prevState.trackingSince) || now };
}

function pointAtOrBefore(history, targetDay) {
  let best = null;
  for (const p of history) if (p.d <= targetDay && (!best || p.d > best.d)) best = p;
  return best;
}

export function aggregate({ ref, ebay, reddit, prevLive, history = [], ebayState, now }) {
  const anchor = ref.anchor || {};
  const today = day(now);
  const inRange = (p) => !anchor.market || (p >= anchor.market * 0.4 && p <= anchor.market * 2.5);

  // 1. Suivi eBay
  let state = ebayState || null;
  const ebayItems = ebay ? ebay.items : null;
  if (ebayItems) state = updateEbayState(ebayState, ebayItems, ebay.complete, now);

  // 2. Prix demandés : occasion (eBay + Reddit [WTS]) et neuf (eBay)
  const usedAsk = [];
  const newAsk = [];
  for (const it of ebayItems || []) (it.condition === "new" ? newAsk : usedAsk).push(it.priceEur);
  const posts = reddit ? reddit.posts : null;
  for (const p of posts || []) if (p.kind === "WTS" && p.priceEur && inRange(p.priceEur)) usedAsk.push(p.priceEur);
  const ask = describe(usedAsk);
  const askNew = describe(newAsk);

  // 3. Cote lissée : on part de la cote précédente (ou de l'étude) et on la rapproche des observations
  const obsTx = ask.n >= 3 ? ask.median * (1 - ASK_DISCOUNT) : null;
  const prior = (prevLive && prevLive.market) || anchor.market || obsTx;
  let market = prior;
  let low = (prevLive && prevLive.low) || anchor.low || null;
  let high = (prevLive && prevLive.high) || anchor.high || null;
  if (obsTx != null) {
    const w = Math.min(MAX_STEP, ask.n / (ask.n + SMOOTH_K));
    market = prior == null ? obsTx : prior + w * (obsTx - prior);
    if (ask.n >= 4) {
      const q1 = ask.q1 * (1 - ASK_DISCOUNT);
      const q3 = ask.q3 * (1 - ASK_DISCOUNT);
      low = low == null ? q1 : low + w * (q1 - low);
      high = high == null ? q3 : high + w * (q3 - high);
    }
  }

  // 4. Délai de vente et taux d'écoulement (annonces eBay disparues avant leur fin)
  let days = null, daysN = 0, sellThrough30 = null, gone90 = 0;
  if (state) {
    const recent = state.gone.filter((g) => daysBetween(g.gone, now) <= 90);
    gone90 = recent.length;
    const durations = sorted(recent.filter((g) => g.created).map((g) => Math.max(0, daysBetween(g.created, g.gone))));
    daysN = durations.length;
    if (daysN >= 5) days = round(quantile(durations, 0.5), 0.5);
    const gone30 = state.gone.filter((g) => daysBetween(g.gone, now) <= 30).length;
    const activeCount = Object.keys(state.active).length;
    if (daysBetween(state.trackingSince, now) >= 30 && activeCount + gone30 > 0) {
      sellThrough30 = round((gone30 / (activeCount + gone30)) * 100, 0.1);
    }
  }

  // 5. Historique journalier (un point par jour, le dernier de la journée l'emporte)
  let hist = history.slice();
  if (!hist.length && anchor.market && anchor.date) hist.push({ d: anchor.date, mk: anchor.market, seed: true });
  const ebayActive = ebayItems ? ebayItems.length : null;
  const wts = posts ? posts.filter((p) => p.kind === "WTS").length : null;
  const wtb = posts ? posts.filter((p) => p.kind === "WTB").length : null;
  const point = { d: today, mk: round(market, 1), ask: round(ask.median, 1), act: ebayActive, wts, wtb };
  hist = hist.filter((p) => p.d !== today);
  hist.push(point);
  hist.sort((a, b) => (a.d < b.d ? -1 : 1));
  if (hist.length > HISTORY_MAX) hist = hist.slice(hist.length - HISTORY_MAX);

  // 6. Tendances à partir de l'historique
  const shift = (n) => day(new Date(new Date(now).getTime() - n * 86400000).toISOString());
  const p30 = pointAtOrBefore(hist, shift(28));
  const p365 = pointAtOrBefore(hist, shift(330));
  const trend30 = p30 && p30.mk && market ? round((market / p30.mk - 1) * 100, 0.1) : null;
  const trend12 = p365 && p365.mk && market ? round((market / p365.mk - 1) * 100, 0.1) : null;
  const last90 = hist.filter((p) => !p.seed && p.d >= shift(90));
  const vol = last90.length >= 10 ? round(coefficientOfVariation(last90.map((p) => p.mk)), 0.1) : null;

  // 7. Pression de l'offre
  let offerScore = null, offerBasis = null;
  if (ebayActive != null && gone90 >= 3) {
    const months = ebayActive / (gone90 / 3);
    offerScore = Math.round(clamp((months / 6) * 100));
    offerBasis = `${ebayActive} annonces eBay ≈ ${months.toFixed(1).replace(".", ",")} mois de stock`;
  } else {
    const acts = last90.map((p) => p.act).filter((v) => v != null);
    if (ebayActive != null && acts.length >= 7) {
      const avg = acts.reduce((a, b) => a + b, 0) / acts.length;
      if (avg > 0) {
        offerScore = Math.round(clamp(50 + (ebayActive / avg - 1) * 100));
        offerBasis = `${ebayActive} annonces eBay contre ${avg.toFixed(0)} en moyenne sur 90 jours`;
      }
    }
  }

  // 8. Hype : activité Reddit comparée à sa moyenne, plus la tendance sur 30 jours
  let hypeScore = null, hypeBasis = null;
  const base = ref.hype && ref.hype.score != null ? ref.hype.score : null;
  if (base != null && (wts != null || trend30 != null)) {
    let delta = 0;
    const acts = last90.map((p) => (p.wts || 0) + (p.wtb || 0)).filter((v, i) => last90[i].wts != null);
    if (wts != null && acts.length >= 7) {
      const avg = acts.reduce((a, b) => a + b, 0) / acts.length;
      if (avg > 0) delta += clamp(((wts + wtb) / avg - 1) * 25, -25, 25);
    }
    if (trend30 != null) delta += clamp(trend30 * 2, -15, 15);
    hypeScore = Math.round(clamp(base + delta));
    hypeBasis = `Base de départ ${base}, ajustée de ${delta >= 0 ? "+" : ""}${Math.round(delta)} (activité Reddit, tendance 30 j)`;
  }

  const live = {
    updatedAt: now,
    market: round(market, 1),
    low: round(low, 1),
    high: round(high, 1),
    nObs: ask.n,
    askMedian: round(ask.median, 1),
    askNewMedian: round(askNew.median, 1),
    nNew: askNew.n,
    ebayActive,
    ebayComplete: ebay ? ebay.complete : null,
    redditWts30: wts,
    redditWtb30: wtb,
    days,
    daysN,
    sellThrough30,
    trend30,
    trend12,
    vol,
    offerScore,
    offerBasis,
    hypeScore,
    hypeBasis,
    stale: obsTx == null,
    trackingSince: state ? state.trackingSince : null,
  };
  return { live, history: hist, state };
}
