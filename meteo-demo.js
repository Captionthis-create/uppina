/*
 * meteo-demo.js : météo de la démo.
 * - Affichage : vraie météo de la ville choisie (Rennes par défaut), en direct depuis Open-Meteo (prévisions 16 jours
 *   et 92 jours passés), complétée par les archives Open-Meteo pour les dates plus anciennes. Sans réseau : météo simulée.
 * - Ventes simulées : toujours la météo de Rennes (ville du restaurant). Historique intégré (meteo-rennes.js), puis
 *   données en direct figées dans le navigateur dès qu'un jour a servi, pour que les chiffres d'un jour ne bougent plus.
 */
(function () {
  "use strict";
  var S = window.Stockage, R = window.MeteoRennes || { jours: {}, jusquau: "" };
  var RENNES = { nom: "Rennes", detail: "Bretagne, France", lat: 48.1173, lon: -1.6778 };
  var VARS = "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,sunshine_duration,weather_code";
  var POIDS = { temp: 0.35, pluie: 0.3, vent: 0.1, soleil: 0.25 };
  var VILLES_SECOURS = [
    ["Rennes", "Bretagne, France", 48.1173, -1.6778], ["Paris", "Île-de-France, France", 48.8534, 2.3488], ["Nantes", "Pays de la Loire, France", 47.2172, -1.5534],
    ["Lyon", "Auvergne-Rhône-Alpes, France", 45.7485, 4.8467], ["Marseille", "Provence-Alpes-Côte d'Azur, France", 43.2965, 5.3698], ["Bordeaux", "Nouvelle-Aquitaine, France", 44.8404, -0.5805],
    ["Lille", "Hauts-de-France, France", 50.633, 3.0586], ["Toulouse", "Occitanie, France", 43.6043, 1.4437], ["Nice", "Provence-Alpes-Côte d'Azur, France", 43.7031, 7.2661],
    ["Strasbourg", "Grand Est, France", 48.5839, 7.7455], ["Brest", "Bretagne, France", 48.3903, -4.4863], ["Saint-Malo", "Bretagne, France", 48.6493, -2.0257],
    ["Montpellier", "Occitanie, France", 43.6109, 3.8772], ["Angers", "Pays de la Loire, France", 47.4739, -0.5515], ["Caen", "Normandie, France", 49.1859, -0.3591]
  ];

  function deux(n) { return ("0" + n).slice(-2); }
  function jourIso(d) { return d.getFullYear() + "-" + deux(d.getMonth() + 1) + "-" + deux(d.getDate()); }
  function decaler(iso, n) { var d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return jourIso(d); }
  var AUJ_ISO = jourIso(new Date());
  var HORIZON = decaler(AUJ_ISO, 15); // dernier jour de prévision
  function un(v) { return Math.round(v * 10) / 10; }

  // ---------- Score de clémence 0-100 (bar-restaurant avec terrasse) ----------
  function borne(v) { return Math.max(0, Math.min(100, v)); }
  function score(m) {
    if (!m || m.tmax == null) return null;
    var dist = m.tmax < 21 ? 21 - m.tmax : (m.tmax > 28 ? m.tmax - 28 : 0);
    var sTemp = borne(100 - dist * 5), sPluie = borne(100 - (m.pluie || 0) * 12);
    var sVent = borne(100 - Math.max(0, (m.vent || 0) - 15) * 3), sSoleil = m.soleil == null ? 50 : borne(m.soleil / 10 * 100);
    return Math.round(sTemp * POIDS.temp + sPluie * POIDS.pluie + sVent * POIDS.vent + sSoleil * POIDS.soleil);
  }

  // ---------- Météo simulée (secours hors ligne), stable pour une date ----------
  function hasard(iso, k) {
    var h = 2166136261, s = iso + "#" + k;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 100000) / 100000;
  }
  function fausse(iso) {
    var d = new Date(iso + "T12:00:00"), jourAn = Math.round((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
    var saison = -Math.cos((jourAn - 15) / 365 * 2 * Math.PI); // -1 en janvier, +1 en juillet
    var tmax = un(14.5 + 8.5 * saison + (hasard(iso, 1) - 0.5) * 8);
    var pluvieux = hasard(iso, 2) < 0.4 - 0.12 * saison;
    var pluie = pluvieux ? un(0.5 + hasard(iso, 3) * 11) : 0;
    var soleil = un(Math.max(0, (pluvieux ? 0.5 + hasard(iso, 4) * 3 : 3 + hasard(iso, 4) * 7) * (0.55 + 0.45 * (saison + 1) / 2)));
    var vent = un(10 + hasard(iso, 5) * 25);
    var code = pluie > 5 ? 63 : (pluie > 0 ? 61 : (soleil > 8 ? 0 : (soleil > 5 ? 2 : 3)));
    return { tmax: tmax, tmin: un(tmax - 4 - hasard(iso, 6) * 5), pluie: pluie, vent: vent, soleil: soleil, code: code };
  }

  function deTableau(t) { return { tmax: t[0], tmin: t[1], pluie: t[2], vent: t[3], soleil: t[4], code: t[5] }; }
  function lireReponse(json) {
    var d = json && json.daily, o = {};
    if (!d || !d.time) return o;
    d.time.forEach(function (t, i) {
      var tmax = d.temperature_2m_max[i];
      if (tmax === null || tmax === undefined) return;
      o[t] = [un(tmax), un(d.temperature_2m_min[i]), un(d.precipitation_sum[i] || 0), un(d.wind_speed_10m_max[i] || 0), un((d.sunshine_duration[i] || 0) / 3600), d.weather_code[i]];
    });
    return o;
  }

  // ---------- Réseau ----------
  function charger(url, delai) {
    return new Promise(function (ok, ko) {
      if (typeof fetch !== "function") { ko(new Error("fetch indisponible")); return; }
      var fini = false, ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      var minuteur = setTimeout(function () { if (!fini) { fini = true; if (ctrl) ctrl.abort(); ko(new Error("délai dépassé")); } }, delai || 4000);
      fetch(url, ctrl ? { signal: ctrl.signal } : undefined).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .then(function (j) { if (!fini) { fini = true; clearTimeout(minuteur); ok(j); } }, function (e) { if (!fini) { fini = true; clearTimeout(minuteur); ko(e); } });
    });
  }
  function urlPrevisions(v) { return "https://api.open-meteo.com/v1/forecast?latitude=" + v.lat + "&longitude=" + v.lon + "&daily=" + VARS + "&timezone=auto&past_days=92&forecast_days=16"; }
  function urlArchives(v, d1, d2) { return "https://archive-api.open-meteo.com/v1/archive?latitude=" + v.lat + "&longitude=" + v.lon + "&start_date=" + d1 + "&end_date=" + d2 + "&daily=" + VARS + "&timezone=auto"; }

  // ---------- État ----------
  var ville = S.lire("meteo-ville", null) || RENNES;
  var direct = {};        // ville choisie : 92 jours passés + 16 jours de prévision
  var directRennes = {};  // Rennes, pour les ventes
  var archives = {};      // ville choisie : dates plus anciennes, chargées à la demande
  var gel = S.lire("meteo-gel", {});
  var recupere = null, horsLigne = false;

  function estRennes(v) { return Math.abs(v.lat - RENNES.lat) < 0.05 && Math.abs(v.lon - RENNES.lon) < 0.05; }
  function cleCache(v) { return "meteo-cache:" + (+v.lat).toFixed(3) + "," + (+v.lon).toFixed(3); }
  function rafraichir(v, delai) {
    return charger(urlPrevisions(v), delai).then(function (j) {
      var jours = lireReponse(j);
      if (Object.keys(jours).length) S.ecrire(cleCache(v), { t: Date.now(), jours: jours });
      return jours;
    });
  }
  function poser(v, jours, t) {
    if (estRennes(v)) directRennes = jours;
    if (v === ville) { direct = jours; recupere = t; }
  }
  // Démarrage : le cache sert tout de suite ; s'il a plus d'une heure, on le rafraîchit (attente limitée à ~3,5 s)
  function initialiser() {
    var villes = [ville];
    if (!estRennes(ville)) villes.push(RENNES);
    return Promise.all(villes.map(function (v) {
      var c = S.lire(cleCache(v), null);
      if (c && c.jours) poser(v, c.jours, c.t);
      if (c && c.jours && Date.now() - c.t < 3600 * 1000) return null;
      return rafraichir(v, 3500).then(function (jours) { poser(v, jours, Date.now()); }, function () { horsLigne = !c; });
    }));
  }
  var pret = initialiser();

  // ---------- Météo des ventes (toujours Rennes), figée dès qu'un jour a servi ----------
  function pourVentes(iso) {
    var t = R.jours[iso] || gel[iso];
    if (t) return deTableau(t);
    if (directRennes[iso]) {
      if (iso <= AUJ_ISO) { gel[iso] = directRennes[iso]; S.ecrire("meteo-gel", gel); }
      return deTableau(directRennes[iso]);
    }
    return fausse(iso);
  }
  // Clémence moyenne de chaque mois à Rennes (pour mesurer si un jour est meilleur ou pire que la saison)
  var moyenneMois = (function () {
    var s = [], n = [], i;
    for (i = 0; i < 12; i++) { s[i] = 0; n[i] = 0; }
    Object.keys(R.jours).forEach(function (iso) { var m = +iso.slice(5, 7) - 1; s[m] += score(deTableau(R.jours[iso])); n[m]++; });
    return s.map(function (x, k) { return n[k] ? x / n[k] : 45; });
  })();

  // ---------- Météo affichée (ville choisie) ----------
  function connu(iso) {
    if (estRennes(ville)) return R.jours[iso] || direct[iso] || gel[iso] || archives[iso];
    return direct[iso] || archives[iso];
  }
  function construire(iso, m, simule) { m.date = iso; m.score = score(m); m.prevision = iso > AUJ_ISO; m.factice = !!simule; return m; }
  function vide(iso) { return { date: iso, tmax: null, tmin: null, pluie: null, vent: null, soleil: null, code: null, score: null, factice: false, prevision: iso > AUJ_ISO }; }
  function jour(iso) {
    var t = connu(iso);
    if (t) return construire(iso, deTableau(t), false);
    if (iso <= HORIZON) return construire(iso, fausse(iso), true);
    return vide(iso);
  }
  function liste(d1, d2) { var l = [], iso = d1; while (iso <= d2) { l.push(iso); iso = decaler(iso, 1); } return l; }
  // Jours d'une période ; les dates passées inconnues sont demandées aux archives Open-Meteo (une seule requête)
  function jours(d1, d2) {
    var l = liste(d1, d2), manquants = l.filter(function (iso) { return iso < AUJ_ISO && !connu(iso); });
    var p = Promise.resolve();
    if (manquants.length && !horsLigne) {
      p = charger(urlArchives(ville, manquants[0], manquants[manquants.length - 1]), 6000).then(function (j) {
        var o = lireReponse(j);
        Object.keys(o).forEach(function (k) { archives[k] = o[k]; });
      }, function () { /* hors ligne : météo simulée pour ces jours */ });
    }
    return p.then(function () { return l.map(jour); });
  }

  // ---------- Ville ----------
  function rechercher(q) {
    q = String(q || "").trim();
    if (q.length < 2) return Promise.resolve([]);
    function secours() {
      var n = q.toLowerCase();
      return VILLES_SECOURS.filter(function (v) { return v[0].toLowerCase().indexOf(n) >= 0; }).map(function (v) { return { nom: v[0], detail: v[1], lat: v[2], lon: v[3] }; });
    }
    return charger("https://geocoding-api.open-meteo.com/v1/search?name=" + encodeURIComponent(q) + "&count=8&language=fr&format=json", 5000).then(function (j) {
      var r = (j.results || []).map(function (x) { return { nom: x.name, detail: [x.admin1, x.country].filter(Boolean).join(", "), lat: x.latitude, lon: x.longitude }; });
      return r.length ? r : secours();
    }, secours);
  }
  function choisirVille(v) {
    ville = { nom: v.nom, detail: v.detail || "", lat: +v.lat, lon: +v.lon };
    S.ecrire("meteo-ville", ville);
    direct = {}; archives = {}; recupere = null; horsLigne = false;
    var c = S.lire(cleCache(ville), null);
    if (c && c.jours) poser(ville, c.jours, c.t);
    return rafraichir(ville, 6000).then(function (j) { poser(ville, j, Date.now()); }, function () { /* secours simulé */ });
  }

  window.MeteoDemo = {
    pret: pret,
    POIDS: POIDS, score: score, moyenneMois: moyenneMois,
    actif: function () { return S.lire("meteo-actif", true) !== false; },
    activer: function (b) { S.ecrire("meteo-actif", !!b); },
    ville: function () { return ville; }, villeParDefaut: RENNES, estRennes: function () { return estRennes(ville); },
    rechercher: rechercher, choisirVille: choisirVille,
    pourVentes: pourVentes, jour: jour, jours: jours,
    recupereLe: function () { return recupere; }
  };
})();
