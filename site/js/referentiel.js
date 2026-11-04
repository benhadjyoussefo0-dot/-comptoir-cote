// Référentiel : normalisation des références, rapprochement avec score de confiance,
// et moteur de recherche à facettes. Script classique (navigateur), chargé dans Node par vm pour les tests.
(function (root) {
  "use strict";

  // ---------- Normalisation ----------
  function fold(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }
  function compact(s) { return fold(s).replace(/[^a-z0-9]/g, ""); }
  function words(s) { return fold(s).replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean); }

  // Formes d'écriture d'une même référence : préfixe « M » de Tudor, suffixe de variante (-0001, J1, K1…).
  function refForms(ref) {
    var base = String(ref || "").split("/")[0];
    var c = compact(base), out = [c];
    var noSuffix = c.replace(/0{2,}\d{1,2}$/, "");                 // m79030n0001 → m79030n
    if (noSuffix !== c) out.push(noSuffix);
    out.slice().forEach(function (f) { if (/^m\d/.test(f)) out.push(f.slice(1)); });  // m79030n → 79030n
    out.slice().forEach(function (f) { if (/^s[a-z]{2}\d{3}[a-z]\d$/.test(f)) out.push(f.slice(0, -2)); }); // spb143j1 → spb143
    return out.filter(function (v, i, a) { return v && a.indexOf(v) === i; });
  }

  // Distance d'édition bornée (Damerau, transpositions comprises).
  function editDistance(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var d = [];
    for (var i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (var j = 0; j <= b.length; j++) d[0][j] = j;
    for (i = 1; i <= a.length; i++) {
      var best = max + 1;
      for (j = 1; j <= b.length; j++) {
        var cost = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        if (d[i][j] < best) best = d[i][j];
      }
      if (best > max) return max + 1;
    }
    return d[a.length][b.length];
  }

  // ---------- Rapprochement ----------
  // Prépare une fiche : toutes ses formes de référence, équivalents régionaux, surnoms et alias.
  function prepare(r) {
    var forms = refForms(r.ref);
    (r.equivalents || []).forEach(function (e) { refForms(e).forEach(function (f) { if (forms.indexOf(f) < 0) forms.push(f); }); });
    return {
      r: r,
      forms: forms,
      equiv: (r.equivalents || []).map(compact),
      nick: (r.nicknames || []).map(compact),
      alias: (r.aliases || []).map(compact).filter(Boolean),
      text: words([r.brand, r.collection, r.model, r.ref].concat(r.nicknames || [], r.aliases || []).join(" ")),
      brand: compact(r.brand)
    };
  }

  // Score de 0 à 1 et raison du rapprochement d'une saisie avec une fiche.
  function score(p, query) {
    var q = compact(query), ws = words(query);
    if (!q) return { s: 0 };
    if (p.forms.indexOf(q) >= 0) return { s: p.equiv.indexOf(q) >= 0 ? 0.9 : 1, why: p.equiv.indexOf(q) >= 0 ? "équivalent régional" : "référence" };
    // La référence peut être noyée dans la saisie : « Tudor M79030N-0001 full set ».
    for (var i = 0; i < p.forms.length; i++) if (p.forms[i].length >= 5 && q.indexOf(p.forms[i]) >= 0) return { s: 0.95, why: "référence" };
    if (p.nick.indexOf(q) >= 0) return { s: 0.85, why: "surnom" };
    if (p.alias.indexOf(q) >= 0) return { s: 0.8, why: "alias" };
    // Tous les mots de la saisie présents dans la fiche (préfixes acceptés à partir de 2 lettres).
    var hit = 0, fuzzy = 0;
    ws.forEach(function (w) {
      if (p.text.some(function (t) { return t === w || (w.length >= 2 && t.indexOf(w) === 0); })) hit++;
      else if (w.length >= 5 && p.text.some(function (t) { return editDistance(w, t.slice(0, Math.max(w.length, t.length)), 1) <= 1; })) fuzzy++;
    });
    var best = { s: 0 };
    if (hit + fuzzy === ws.length && ws.length) {
      var s = 0.55 + 0.25 * (hit / ws.length);
      if (ws.some(function (w) { return w === p.brand; })) s += 0.05;
      best = { s: Math.min(0.79, s), why: fuzzy ? "approchant" : "mots" };
    }
    // Faute de frappe dans une référence (une lettre ou un chiffre) : plus probable qu'un mot approchant.
    for (i = 0; i < p.forms.length; i++) if (q.length >= 5 && editDistance(q, p.forms[i], 1) <= 1 && best.s < 0.6) best = { s: 0.6, why: "référence approchante" };
    return best;
  }

  function confidence(s) { return s >= 0.9 ? "élevé" : (s >= 0.7 ? "moyen" : "faible"); }

  // Meilleure fiche pour un titre d'annonce ou une saisie ; null sous le seuil.
  function match(prepared, query, threshold) {
    var best = null;
    prepared.forEach(function (p) {
      var m = score(p, query);
      if (m.s > 0 && (!best || m.s > best.score)) best = { ref: p.r, score: m.s, why: m.why, confidence: confidence(m.s) };
    });
    return best && best.score >= (threshold == null ? 0.6 : threshold) ? best : null;
  }

  // ---------- Recherche à facettes ----------
  var FACETS = {
    marque: { label: "Marque", get: function (d) { return d.brand; } },
    collection: { label: "Collection", get: function (d) { return d.collection || "Autre"; }, dependsOn: "marque" },
    production: { label: "Production", get: function (d) { return d.production; } },
    variation: { label: "Variation sur 12 mois", get: function (d) { return d.trend12 == null ? "Inconnue" : (d.trend12 > 1 ? "En hausse" : (d.trend12 < -1 ? "En baisse" : "Stable")); } },
    risque: { label: "Indice de risque", get: function (d) { return d.risk == null ? "Inconnu" : (d.risk <= 33 ? "Faible" : (d.risk <= 55 ? "Modéré" : "Élevé")); } },
    confiance: { label: "Niveau de confiance", get: function (d) { return d.confidence; } },
    diametre: { label: "Diamètre", get: function (d) { return d.diam == null ? "Inconnu" : (d.diam < 38 ? "Moins de 38 mm" : (d.diam <= 41 ? "38 à 41 mm" : "Plus de 41 mm")); } },
    matiere: { label: "Matière du boîtier", get: function (d) { return d.material || "Inconnue"; } }
  };
  var SORTS = {
    pertinence: function (a, b) { return b._s - a._s || b.cote - a.cote; },
    "cote-desc": function (a, b) { return (b.cote || 0) - (a.cote || 0); },
    "cote-asc": function (a, b) { return (a.cote || 0) - (b.cote || 0); },
    hausse: function (a, b) { return (b.trend12 == null ? -1e9 : b.trend12) - (a.trend12 == null ? -1e9 : a.trend12); },
    baisse: function (a, b) { return (a.trend12 == null ? 1e9 : a.trend12) - (b.trend12 == null ? 1e9 : b.trend12); },
    risque: function (a, b) { return (a.risk == null ? 1e9 : a.risk) - (b.risk == null ? 1e9 : b.risk); },
    prime: function (a, b) { return (b.premium == null ? -1e9 : b.premium) - (a.premium == null ? -1e9 : a.premium); }
  };

  function createIndex(docs) {
    var prepared = docs.map(prepare);
    function run(state) {
      state = state || {};
      var sel = state.filters || {}, q = (state.q || "").trim();
      var base = prepared.map(function (p) {
        var m = q ? score(p, q) : { s: 1 };
        var d = p.r; d._s = m.s; d._why = m.why;
        return d;
      }).filter(function (d) { return !q || d._s >= 0.55; });
      var inRange = function (d) { return state.min == null && state.max == null ? true : d.cote != null && (state.min == null || d.cote >= state.min) && (state.max == null || d.cote <= state.max); };
      function passes(d, except) {
        if (!inRange(d) && except !== "cote") return false;
        return Object.keys(sel).every(function (k) {
          if (k === except || !sel[k] || !sel[k].length || !FACETS[k]) return true;
          return sel[k].indexOf(FACETS[k].get(d)) >= 0;
        });
      }
      var results = base.filter(function (d) { return passes(d); }).sort(SORTS[state.sort] || (q ? SORTS.pertinence : SORTS["cote-desc"]));
      // Nombre de résultats de chaque option, en tenant compte des autres filtres (facettes disjonctives).
      var facets = {};
      Object.keys(FACETS).forEach(function (k) {
        var f = FACETS[k], counts = {};
        base.forEach(function (d) { if (passes(d, k)) { var v = f.get(d); counts[v] = (counts[v] || 0) + 1; } });
        if (f.dependsOn && !(sel[f.dependsOn] && sel[f.dependsOn].length)) counts = {};
        facets[k] = Object.keys(counts).sort().map(function (v) { return { value: v, count: counts[v], selected: !!(sel[k] && sel[k].indexOf(v) >= 0) }; });
      });
      var values = base.filter(function (d) { return passes(d, "cote"); }).map(function (d) { return d.cote; }).filter(function (v) { return v != null; });
      return { results: results, total: results.length, facets: facets, coteValues: values };
    }
    function suggest(q, limit) {
      if (!compact(q)) return [];
      return prepared.map(function (p) { var m = score(p, q); return { r: p.r, s: m.s, why: m.why }; })
        .filter(function (x) { return x.s >= 0.55; }).sort(function (a, b) { return b.s - a.s; }).slice(0, limit || 8)
        .map(function (x) { return { id: x.r.id, label: x.r.brand + " " + x.r.model, ref: x.r.ref, group: x.why === "surnom" ? "Surnoms" : (/référence|équivalent/.test(x.why) ? "Références" : "Modèles"), why: x.why }; });
    }
    return { run: run, suggest: suggest, prepared: prepared };
  }

  // ---------- État dans l'adresse ----------
  function toQuery(state) {
    var p = [];
    if (state.q) p.push("q=" + encodeURIComponent(state.q));
    Object.keys(state.filters || {}).sort().forEach(function (k) { if (state.filters[k] && state.filters[k].length) p.push(k + "=" + state.filters[k].map(encodeURIComponent).join(",")); });
    if (state.min != null || state.max != null) p.push("cote=" + (state.min == null ? "" : state.min) + "-" + (state.max == null ? "" : state.max));
    if (state.sort) p.push("tri=" + state.sort);
    if (state.view) p.push("vue=" + state.view);
    return p.length ? "?" + p.join("&") : "";
  }
  function fromQuery(search) {
    var st = { filters: {} };
    String(search || "").replace(/^\?/, "").split("&").filter(Boolean).forEach(function (kv) {
      var i = kv.indexOf("="), k = decodeURIComponent(kv.slice(0, i)), v = kv.slice(i + 1);
      if (k === "q") st.q = decodeURIComponent(v.replace(/\+/g, " "));
      else if (k === "tri") st.sort = v;
      else if (k === "vue") st.view = v;
      else if (k === "cote") { var m = v.split("-"); st.min = m[0] ? +m[0] : null; st.max = m[1] ? +m[1] : null; }
      else if (FACETS[k]) st.filters[k] = v.split(",").map(decodeURIComponent).filter(Boolean);
    });
    return st;
  }

  root.Referentiel = {
    fold: fold, compact: compact, refForms: refForms, editDistance: editDistance, prepare: prepare, score: score,
    match: match, confidence: confidence, createIndex: createIndex, toQuery: toQuery, fromQuery: fromQuery, FACETS: FACETS
  };
})(typeof window !== "undefined" ? window : globalThis);
