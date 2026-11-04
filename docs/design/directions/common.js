// Outils communs aux trois maquettes (formatage, filtres de démonstration, histogramme).
(function () {
  var NNBSP = " ";
  function num(v) { return Math.round(v).toLocaleString("fr-FR"); }
  var q = new URLSearchParams(location.search);
  var UI = {
    num: num,
    eur: function (v) { return v == null ? "—" : num(v) + NNBSP + "€"; },
    pct: function (v) { return v == null ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "±") + Math.abs(v).toFixed(1).replace(".", ",") + NNBSP + "%"; },
    arrow: function (v) { return v == null || v === 0 ? "" : (v > 0 ? "↑" : "↓"); },
    page: q.get("page") || "recherche",
    flag: function (k) { return q.get(k) === "1"; },
    short: function (r) { return r.ref.replace(/^M(?=\d)/, "").split("-")[0].split(" /")[0]; },
    prod: function (p) { return { production: "En production", arretee: "Arrêtée", inconnu: "Statut non vérifié" }[p]; },
    risk: function (v) { return v <= 33 ? "faible" : v <= 55 ? "modéré" : "élevé"; },
    esc: function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); },
    // Filtre de démonstration : Tudor, Seiko et IWC, cote de 1 400 à 4 000 €.
    demo: { brands: ["Tudor", "IWC"], lo: 1400, hi: 4000 },
    filtered: function () {
      var d = UI.demo;
      return window.DATA.filter(function (r) { return d.brands.indexOf(r.brand) >= 0 && r.cote >= d.lo && r.cote <= d.hi; })
        .sort(function (a, b) { return b.cote - a.cote; });
    },
    counts: function (key) {
      var c = {};
      window.DATA.forEach(function (r) { c[r[key]] = (c[r[key]] || 0) + 1; });
      return c;
    },
    hist: function (bins, lo, hi) {
      var h = new Array(bins).fill(0), step = (hi - lo) / bins;
      window.DATA.forEach(function (r) { var i = Math.min(bins - 1, Math.max(0, Math.floor((r.cote - lo) / step))); h[i]++; });
      return h;
    },
    states: function (r) {
      return [["Neuve, jamais portée", r.cote * 1.10], ["Excellent état, complète", r.cote], ["Très bon état, complète", r.cote * 0.93],
        ["Boîte ou papiers manquants", r.cote * 0.87], ["Montre seule", r.cote * (1 - r.naked)]];
    },
    chrono24: function (r) { return "https://www.chrono24.fr/search/index.htm?dosearch=true&query=" + encodeURIComponent(r.brand + " " + UI.short(r)); }
  };
  window.UI = UI;
})();
