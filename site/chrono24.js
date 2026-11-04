// Relevés Chrono24 : lecture des prix dans une page de résultats copiée-collée,
// fusion avec la cote et conservation des relevés dans le navigateur.
// Chrono24 n'a pas d'API publique et bloque les robots : le relevé se fait à la main,
// depuis le navigateur de l'utilisateur, puis le site fait les calculs.
(function (root) {
  "use strict";

  var ASK_DISCOUNT = 0.08;   // un prix demandé surestime le prix de vente (même règle que pour eBay)
  var SMOOTH_K = 8, MAX_WEIGHT = 0.6;
  var FRESH_DAYS = 14, EXPIRE_DAYS = 60;
  var STORE_KEY = "comptoir-cote.chrono24";
  var KEEP = 20;

  var AMOUNT = "(?<![\\d.,])(\\d{1,3}(?:[ \\u00a0\\u202f.,']\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)(?![\\d])";
  var PATTERNS = [
    { re: new RegExp(AMOUNT + "[ \\u00a0\\u202f]?(?:€|EUR\\b)", "g"), cur: "EUR", group: 1 },
    { re: new RegExp("(?:€|EUR)[ \\u00a0\\u202f]?" + AMOUNT, "g"), cur: "EUR", group: 1 },
    { re: new RegExp("(?:US\\$|\\$|USD)[ \\u00a0\\u202f]?" + AMOUNT, "g"), cur: "USD", group: 1 },
    { re: new RegExp(AMOUNT + "[ \\u00a0\\u202f]?(?:\\$|USD\\b)", "g"), cur: "USD", group: 1 }
  ];

  function toNumber(raw) {
    var s = String(raw).replace(/[   ']/g, "");
    s = s.replace(/[.,]\d{1,2}$/, "");      // centimes
    s = s.replace(/[.,]/g, "");              // séparateurs de milliers
    var n = parseFloat(s);
    return isNaN(n) ? null : n;
  }

  function sortedNums(arr) { return arr.slice().sort(function (a, b) { return a - b; }); }
  function quantile(sorted, q) {
    if (!sorted.length) return null;
    var pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }

  // Liste simple de nombres, sans symbole monétaire (« 2450 2600 2 750 »).
  function plainNumbers(text) {
    var out = [];
    String(text || "").split(/[\n,;|\/€]+/).forEach(function (chunk) {
      chunk = chunk.trim(); if (!chunk) return;
      if (/^\d{1,2}[   .]\d{3}$/.test(chunk)) { out.push(parseFloat(chunk.replace(/[   .]/g, ""))); return; }
      chunk.split(/\s+/).forEach(function (p) {
        if (/^\d{1,3}\.\d{3}$/.test(p)) p = p.replace(".", "");
        p = p.replace(/[^\d.]/g, "");
        if (p) out.push(parseFloat(p));
      });
    });
    return out.filter(function (n) { return n >= 100 && n < 500000; });
  }

  // Lit les prix d'une page Chrono24 copiée (Ctrl+A, Ctrl+C) ou d'une simple liste de prix.
  // options.anchor : cote actuelle, pour écarter les prix sans rapport (autres modèles, bracelets…)
  // options.usdRate : dollars pour 1 €, pour convertir les prix affichés en dollars
  function parsePasted(text, options) {
    options = options || {};
    text = String(text || "");
    var found = [], seen = {};
    PATTERNS.forEach(function (p) {
      p.re.lastIndex = 0;
      var m;
      while ((m = p.re.exec(text))) {
        var start = m.index, key = start + ":" + m[0].length;
        if (seen[start]) continue;
        seen[start] = true;
        found.push({ start: start, end: start + m[0].length, raw: m[p.group], cur: p.cur, key: key });
      }
    });
    found.sort(function (a, b) { return a.start - b.start; });
    // Une même somme peut être captée par deux motifs qui se chevauchent : on garde la première.
    var hits = [], lastEnd = -1;
    found.forEach(function (f) { if (f.start >= lastEnd) { hits.push(f); lastEnd = f.end; } });

    var dropped = { shipping: 0, filter: 0, currency: 0, range: 0, outlier: 0 };
    var values = [];
    hits.forEach(function (h) {
      var before = text.slice(Math.max(0, h.start - 24), h.start);
      var after = text.slice(h.end, h.end + 28).split("\n")[0];
      if (/\+\s*$/.test(before) || /^\s*(de |d'|pour (la )?)?(frais|livraison|port|envoi|exp[ée]dition|shipping)/i.test(after)) { dropped.shipping++; return; }
      if (/(moins de|plus de|jusqu'?\s?à|à partir de|dès|max\.?|min\.?)\s*$/i.test(before) ||
          /^\s*[-–]\s*[\d€$]/.test(after) || /(€|\$)\s*[-–]\s*$/.test(before)) { dropped.filter++; return; }
      var v = toNumber(h.raw);
      if (v == null) return;
      if (h.cur === "USD") {
        if (!options.usdRate) { dropped.currency++; return; }
        v = v / options.usdRate;
      }
      if (v < 100 || v >= 500000) { dropped.range++; return; }
      values.push(Math.round(v));
    });

    var mode = "page";
    if (!values.length && !hits.length) { values = plainNumbers(text); mode = "liste"; }

    if (options.anchor) {
      var lo = options.anchor * 0.4, hi = options.anchor * 2.5;
      values = values.filter(function (v) { if (v >= lo && v <= hi) return true; dropped.range++; return false; });
    }
    var s = sortedNums(values);
    if (s.length >= 8) {
      var q1 = quantile(s, 0.25), q3 = quantile(s, 0.75), iqr = q3 - q1;
      var a = q1 - 1.5 * iqr, b = q3 + 1.5 * iqr;
      s = s.filter(function (v) { if (v >= a && v <= b) return true; dropped.outlier++; return false; });
    }

    var total = null, t = text.match(/(\d{1,3}(?:[   .]\d{3})+|\d+)\s+(annonces|résultats|resultats|montres|offres|results|listings|watches)\b/i);
    if (t) total = toNumber(t[1]);

    return { prices: s, dropped: dropped, total: total, mode: mode };
  }

  function summarize(prices, total, date) {
    var s = sortedNums(prices);
    return {
      date: date || new Date().toISOString(),
      n: s.length,
      median: Math.round(quantile(s, 0.5)),
      q1: Math.round(quantile(s, 0.25)),
      q3: Math.round(quantile(s, 0.75)),
      min: s[0], max: s[s.length - 1],
      total: total == null ? null : total,
      prices: s
    };
  }

  // Poids du relevé dans la cote : selon le nombre de prix et l'âge du relevé.
  function weightOf(rel, nowMs) {
    if (!rel || !rel.n) return 0;
    var age = ((nowMs || Date.now()) - Date.parse(rel.date)) / 86400000;
    var fresh = age <= FRESH_DAYS ? 1 : (age >= EXPIRE_DAYS ? 0 : (EXPIRE_DAYS - age) / (EXPIRE_DAYS - FRESH_DAYS));
    return Math.min(MAX_WEIGHT, rel.n / (rel.n + SMOOTH_K)) * fresh;
  }

  // Rapproche la cote (eBay ou étude) des prix Chrono24, décote de négociation comprise.
  function blend(base, rel, nowMs) {
    var w = weightOf(rel, nowMs);
    if (!w) return { mk: base.mk, low: base.low, high: base.high, weight: 0 };
    var k = 1 - ASK_DISCOUNT;
    var mix = function (b, target) { return b == null ? target : b + w * (target - b); };
    return { mk: mix(base.mk, rel.median * k), low: mix(base.low, rel.q1 * k), high: mix(base.high, rel.q3 * k), weight: w };
  }

  function searchUrl(query) {
    return "https://www.chrono24.fr/search/index.htm?dosearch=true&query=" + encodeURIComponent(query);
  }

  // Conservation dans le navigateur (peut être indisponible : navigation privée, aperçu…).
  var memory = {};
  function readAll() {
    try { var raw = root.localStorage && root.localStorage.getItem(STORE_KEY); return raw ? JSON.parse(raw) : memory; }
    catch (e) { return memory; }
  }
  function writeAll(all) {
    memory = all;
    try { if (root.localStorage) root.localStorage.setItem(STORE_KEY, JSON.stringify(all)); return true; }
    catch (e) { return false; }
  }
  function list(refId) { return (readAll()[refId] || []).slice(); }
  function latest(refId) { var l = list(refId); return l.length ? l[l.length - 1] : null; }
  function save(refId, rel) {
    var all = readAll(), l = (all[refId] || []).concat([rel]);
    all[refId] = l.slice(-KEEP);
    return writeAll(all);
  }
  function removeLast(refId) {
    var all = readAll(), l = (all[refId] || []).slice(0, -1);
    if (l.length) all[refId] = l; else delete all[refId];
    return writeAll(all);
  }

  root.Chrono24 = {
    parsePasted: parsePasted, summarize: summarize, blend: blend, weightOf: weightOf,
    searchUrl: searchUrl, list: list, latest: latest, save: save, removeLast: removeLast,
    ASK_DISCOUNT: ASK_DISCOUNT
  };
})(typeof window !== "undefined" ? window : globalThis);
