/*
 * noyau.js : tout ce qui est commun aux écrans (routeur, mise en page, menus,
 * composants, graphiques). Aucune donnée ici : les écrans (ecrans-*.js)
 * demandent tout à DonneesTest (donnees-test.js).
 *
 * Un écran se déclare avec App.ecran("/route", { section, fil, actions, filtres, rendre }).
 */
(function () {
  "use strict";

  var App = window.App = {};

  // ======================================================================
  // Formats et petits outils
  // ======================================================================
  var eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
  var ent = new Intl.NumberFormat("fr-FR");
  var dec = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  var MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

  App.euro = function (n) { return eur.format(n); };
  App.entier = function (n) { return ent.format(n); };
  App.decimal = function (n) { return dec.format(n); };
  App.pct = function (n) { return dec.format(n) + " %"; };
  App.majuscule = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };
  App.echapper = function (t) {
    return String(t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  };
  var E = App.echapper;

  function deux(n) { return ("0" + n).slice(-2); }
  App.jourIso = function (d) { return d.getFullYear() + "-" + deux(d.getMonth() + 1) + "-" + deux(d.getDate()); };
  App.depuisIso = function (s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); };
  var jourIso = App.jourIso, depuisIso = App.depuisIso;
  App.dateLongue = function (iso) { var d = depuisIso(iso); return App.majuscule(JOURS[d.getDay()]) + " " + d.getDate() + " " + MOIS[d.getMonth()] + " " + d.getFullYear(); };
  App.dateMoyenne = function (iso) { var d = depuisIso(iso); return d.getDate() + " " + MOIS[d.getMonth()] + " " + d.getFullYear(); };
  App.dateCourte = function (iso) { var s = iso.split("-"); return s[2] + "/" + s[1] + "/" + s[0]; };
  App.nomJour = function (i) { return App.majuscule(JOURS[i]); };

  // Télécharge un fichier CSV (séparateur « ; »). Les montants sont formatés par l'appelant.
  App.montantCsv = function (n) { return n.toFixed(2).replace(".", ","); };
  App.telechargerCsv = function (nom, entetes, lignes) {
    var csv = [entetes].concat(lignes).map(function (ligne) {
      return ligne.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(";");
    }).join("\r\n");
    var blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ======================================================================
  // Icônes (SVG en ligne, rien à télécharger)
  // ======================================================================
  function svg(contenu) { return '<svg class="icone" viewBox="0 0 16 16">' + contenu + "</svg>"; }
  var ICONES = App.icones = {
    courbe: svg('<polyline points="1.5,11.5 5.5,7.5 8.5,10 14.5,4"/><polyline points="10.5,4 14.5,4 14.5,8"/>'),
    direct: '<span class="icone-direct"></span>',
    stocks: svg('<path d="M2 5l6-3 6 3v6l-6 3-6-3z"/><path d="M2 5l6 3 6-3M8 8v6"/>'),
    dossier: svg('<path d="M2 4.5A1.5 1.5 0 0 1 3.5 3H6l1.5 2h5A1.5 1.5 0 0 1 14 6.5v5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5z"/>'),
    haut: '<svg class="icone chevron" viewBox="0 0 16 16"><polyline points="3.5,10 8,5.5 12.5,10"/></svg>',
    bas: '<svg class="icone chevron" viewBox="0 0 16 16"><polyline points="3.5,6 8,10.5 12.5,6"/></svg>',
    basPetit: '<svg class="chevron-bas" viewBox="0 0 10 10"><polyline points="1.5,3.5 5,7 8.5,3.5"/></svg>',
    liste: svg('<path d="M2 4h12M2 8h12M2 12h12"/>'),
    grille: svg('<rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/>'),
    options: svg('<circle cx="5" cy="5" r="2.5"/><circle cx="11.5" cy="11.5" r="2.5"/><path d="M11.5 2v5M9 4.5h5"/>'),
    couverts: svg('<path d="M5 2v12M3 2v4a2 2 0 0 0 4 0V2M11 14V2c-2 1-3 3-3 6h3"/>'),
    personnes: svg('<circle cx="5" cy="5" r="2"/><circle cx="11.5" cy="5.5" r="1.8"/><path d="M1.5 13c0-3 1.5-4.5 3.5-4.5S8.5 10 8.5 13M9.5 12.5c0-2 1-3 2-3s3 1 3 3"/>'),
    chaise: svg('<path d="M5 2h6v6H5zM4 8h8M5 8v6M11 8v6"/>'),
    engrenage: svg('<circle cx="8" cy="8" r="2.2"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"/>'),
    utilisateur: svg('<circle cx="8" cy="5" r="2.6"/><path d="M2.5 14c0-3.2 2.5-5 5.5-5s5.5 1.8 5.5 5"/>'),
    cadenas: svg('<rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/>'),
    cloche: svg('<path d="M4 11V7a4 4 0 0 1 8 0v4l1 1.5H3zM6.5 14a1.6 1.6 0 0 0 3 0"/>'),
    pin: svg('<path d="M8 14s4-4 4-7a4 4 0 0 0-8 0c0 3 4 7 4 7z"/><circle cx="8" cy="7" r="1.4"/>'),
    cadeau: svg('<rect x="2" y="6" width="12" height="3" rx="1"/><path d="M3 9v4.5h10V9M8 6v7.5M8 6C6 6 5 5 5 4s1.5-1.5 3 2c1.5-3.5 3-3 3-2s-1 2-3 2"/>'),
    clients: svg('<circle cx="6" cy="5" r="2.2"/><path d="M2 13.5c0-2.5 1.7-4 4-4s4 1.5 4 4M11 4.5h3M11 7.5h3"/>'),
    soleil: svg('<circle cx="8" cy="8" r="2.5"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"/>'),
    lune: svg('<path d="M12.5 10A5.5 5.5 0 0 1 6 3.5 5.5 5.5 0 1 0 12.5 10z"/>'),
    ecran: svg('<rect x="2" y="3" width="12" height="8" rx="1.5"/><path d="M6 14h4"/>'),
    oeil: svg('<path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/>'),
    loupe: svg('<circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/>'),
    plus: svg('<path d="M8 3v10M3 8h10"/>'),
    crayon: svg('<path d="M2.5 13.5l.7-3L11 2.7a1.4 1.4 0 0 1 2 0l.3.3a1.4 1.4 0 0 1 0 2L5.5 12.8z"/><path d="M9.8 3.9l2.3 2.3"/>'),
    filtres: svg('<path d="M2 4.5h12M2 8h12M2 11.5h12"/><circle cx="5" cy="4.5" r="1.5" fill="#fff"/><circle cx="11" cy="8" r="1.5" fill="#fff"/><circle cx="6.5" cy="11.5" r="1.5" fill="#fff"/>'),
    document: '<svg class="icone-vide" viewBox="0 0 32 32"><path d="M8 3h11l6 6v20H8z" fill="#cfcfcf" stroke="none"/><path d="M12 14h10M12 18h10M12 22h7" stroke="#555" stroke-width="2"/></svg>',
    cible: svg('<circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="2"/>'),
    couche: svg('<path d="M2 5h12v3H2zM3 8v3h10V8"/>'),
    carte: svg('<rect x="2" y="3.5" width="12" height="9" rx="1.5"/><path d="M2 7h12"/>'),
    especes: svg('<ellipse cx="8" cy="5" rx="5" ry="2"/><path d="M3 5v3c0 1.1 2.2 2 5 2s5-.9 5-2V5M3 8v3c0 1.1 2.2 2 5 2s5-.9 5-2V8"/>'),
    autre: svg('<circle cx="8" cy="8" r="6"/><path d="M5.5 8h.01M8 8h.01M10.5 8h.01"/>')
  };

  // ======================================================================
  // Routeur : l'état de la page est dans l'URL, après le « # »
  // ======================================================================
  var routes = [];   // { re, cles, cfg }
  App.etat = {};     // état d'écran conservé tant que la page reste ouverte (clé = chemin)
  App.act = {};      // actions branchées par l'écran courant (data-act="nom"), vidées à chaque page
  App.actGlobal = {}; // actions de l'en-tête, valables sur toutes les pages
  function action(nom) { return App.act[nom] || App.actGlobal[nom]; }

  App.ecran = function (patron, cfg) {
    var cles = [];
    var re = new RegExp("^" + patron.replace(/:([a-z]+)/g, function (_, c) { cles.push(c); return "([^/]+)"; }) + "$");
    routes.push({ re: re, cles: cles, cfg: cfg });
  };
  function trouver(chemin) {
    for (var i = 0; i < routes.length; i++) {
      var m = routes[i].re.exec(chemin);
      if (m) {
        var ids = {};
        routes[i].cles.forEach(function (c, k) { ids[c] = decodeURIComponent(m[k + 1]); });
        return { cfg: routes[i].cfg, ids: ids };
      }
    }
    return null;
  }
  function lireUrl() {
    var h = location.hash.replace(/^#/, "") || "/";
    var morceaux = h.split("?");
    var params = {};
    (morceaux[1] || "").split("&").forEach(function (kv) {
      if (!kv) return;
      var p = kv.split("=");
      params[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || "");
    });
    return { chemin: morceaux[0], params: params };
  }
  App.allerA = function (chemin, params) {
    var q = Object.keys(params || {}).map(function (k) {
      return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]);
    }).join("&");
    var cible = chemin + (q ? "?" + q : "");
    if (location.hash === "#" + cible) App.afficher(); else location.hash = cible;
  };

  // ======================================================================
  // Période (rapports, commandes)
  // ======================================================================
  App.aujourdhui = function () { return jourIso(new Date()); };
  App.periodeMois = function () {
    var n = new Date();
    return { dateStart: jourIso(new Date(n.getFullYear(), n.getMonth(), 1)), dateEnd: jourIso(new Date(n.getFullYear(), n.getMonth() + 1, 0)) };
  };
  App.periodeJour = function (decalage) {
    var j = jourIso(new Date(Date.now() + (decalage || 0) * 86400000));
    return { dateStart: j, dateEnd: j };
  };
  function estMois(p) {
    var d = depuisIso(p.dateStart), f = depuisIso(p.dateEnd);
    var finMois = new Date(f.getFullYear(), f.getMonth() + 1, 0).getDate() === f.getDate();
    return d.getDate() === 1 && finMois && d.getMonth() === f.getMonth() && d.getFullYear() === f.getFullYear();
  }
  App.libellePeriode = function (p) {
    var d = depuisIso(p.dateStart), f = depuisIso(p.dateEnd);
    var auj = App.aujourdhui(), hier = jourIso(new Date(Date.now() - 86400000));
    if (p.dateStart === p.dateEnd) {
      if (p.dateStart === auj) return "Aujourd'hui";
      if (p.dateStart === hier) return "Hier";
      return d.toLocaleDateString("fr-FR");
    }
    if (estMois(p)) {
      var n = new Date();
      if (d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()) return "Ce mois-ci";
      return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    }
    return deuxChiffresAn(d) + " - " + deuxChiffresAn(f);
  };
  function deuxChiffresAn(d) { return deux(d.getDate()) + "/" + deux(d.getMonth() + 1) + "/" + String(d.getFullYear()).slice(2); }
  App.decalerPeriode = function (p, sens) {
    var d = depuisIso(p.dateStart), f = depuisIso(p.dateEnd);
    if (estMois(p)) {
      return { dateStart: jourIso(new Date(d.getFullYear(), d.getMonth() + sens, 1)), dateEnd: jourIso(new Date(d.getFullYear(), d.getMonth() + sens + 1, 0)) };
    }
    var jours = Math.round((f - d) / 86400000) + 1;
    d.setDate(d.getDate() + sens * jours); f.setDate(f.getDate() + sens * jours);
    return { dateStart: jourIso(d), dateEnd: jourIso(f) };
  };
  // Même période l'an dernier : mois entier -> même mois ; sinon -364 jours (mêmes jours de semaine)
  App.memePeriodeN1 = function (p) {
    var d = depuisIso(p.dateStart), f = depuisIso(p.dateEnd);
    if (estMois(p)) return { dateStart: jourIso(new Date(d.getFullYear() - 1, d.getMonth(), 1)), dateEnd: jourIso(new Date(d.getFullYear() - 1, d.getMonth() + 1, 0)) };
    d.setDate(d.getDate() - 364); f.setDate(f.getDate() - 364);
    return { dateStart: jourIso(d), dateEnd: jourIso(f) };
  };
  // Mode météo : facultatif, désactivé par défaut, mémorisé dans le navigateur
  App.meteoActif = function () { try { return localStorage.getItem("meteo-copie") === "1"; } catch (e) { return false; } };
  App.peutAvancer = function (p) { return App.decalerPeriode(p, 1).dateStart <= App.aujourdhui(); };
  App.choixPeriode = function () {
    var j0 = App.periodeJour(0), j1 = App.periodeJour(-1), m = App.periodeMois(), m1 = App.decalerPeriode(m, -1);
    return [["Aujourd'hui", j0], ["Hier", j1], ["Ce mois-ci", m], ["Mois dernier", m1]];
  };

  // ======================================================================
  // Tranche : jours de la semaine + plage horaire (« tous mes lundis de 11h à 15h »)
  // Dans l'URL : jours=1,2 (0 = dimanche), de=11:00, a=15:00. Elle s'ajoute à la période pour interroger DonneesTest.
  // ======================================================================
  var JOURS_PLURIEL = ["dimanches", "lundis", "mardis", "mercredis", "jeudis", "vendredis", "samedis"];
  var JOURS_ABR = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
  var ORDRE_JOURS = [1, 2, 3, 4, 5, 6, 0];
  function enMinutes(s) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(s || "");
    if (!m) return null;
    var n = +m[1] * 60 + +m[2];
    return n === 1439 ? 1440 : n; // 23:59 = jusqu'à minuit
  }
  function enHeure(n) { if (n === 1440) n = 1439; return (n < 600 ? "0" : "") + Math.floor(n / 60) + ":" + (n % 60 < 10 ? "0" : "") + (n % 60); }
  App.lireTranche = function (params) {
    var j = (params.jours || "").split(",").filter(function (x) { return x !== "" && +x >= 0 && +x <= 6; }).map(Number);
    var h1 = enMinutes(params.de), h2 = enMinutes(params.a);
    if (h1 !== null && h2 !== null && h1 > h2) { var t = h1; h1 = h2; h2 = t; }
    if (!j.length && h1 === null && h2 === null) return null;
    return { jours: j.length ? j : null, h1: h1, h2: h2 };
  };
  App.paramsTranche = function (tr) {
    var q = {};
    if (!tr) return q;
    if (tr.jours) q.jours = tr.jours.join(",");
    if (tr.h1 !== null) q.de = enHeure(tr.h1);
    if (tr.h2 !== null) q.a = enHeure(tr.h2);
    return q;
  };
  // Période + tranche, au format attendu par DonneesTest
  App.avecTranche = function (p, tr) {
    var r = { dateStart: p.dateStart, dateEnd: p.dateEnd };
    if (tr) { if (tr.jours) r.jours = tr.jours; if (tr.h1 !== null) r.h1 = tr.h1; if (tr.h2 !== null) r.h2 = tr.h2; }
    return r;
  };
  function fusion(a, b) { var r = {}, k; for (k in a) r[k] = a[k]; for (k in b) r[k] = b[k]; return r; }
  function requeteTranche(tr) {
    var q = App.paramsTranche(tr);
    return Object.keys(q).map(function (k) { return "&" + k + "=" + encodeURIComponent(q[k]); }).join("");
  }
  App.libelleTranche = function (tr) {
    var parts = [];
    if (tr.jours) {
      var tous = tr.jours.length === 7;
      parts.push(tous ? "Tous les jours" : tr.jours.length === 1 ? App.majuscule(JOURS_PLURIEL[tr.jours[0]]) :
        ORDRE_JOURS.filter(function (d) { return tr.jours.indexOf(d) >= 0; }).map(function (d) { return JOURS_ABR[d]; }).join(" "));
    }
    if (tr.h1 !== null || tr.h2 !== null) parts.push((tr.h1 !== null ? enHeure(tr.h1) : "00:00") + "–" + (tr.h2 !== null ? enHeure(tr.h2) : "24:00"));
    return parts.join(" · ");
  };
  // Nom du jour au pluriel pour les libellés (« 30 lundis ») ; null si plusieurs jours ou aucun
  App.nomJourTranche = function (tr) { return tr && tr.jours && tr.jours.length === 1 ? JOURS_PLURIEL[tr.jours[0]] : null; };

  function htmlFiltreTranche(ctx) {
    var tr = ctx.tranche, jours = tr && tr.jours || [];
    var puces = ORDRE_JOURS.map(function (d) {
      return '<button type="button" class="puce-jour' + (jours.indexOf(d) >= 0 ? " actif" : "") + '" data-tr-jour="' + d + '" title="' + E(App.majuscule(JOURS_PLURIEL[d])) + '">' + E(JOURS_ABR[d].charAt(0).toUpperCase()) + "</button>";
    }).join("");
    return '<div class="menu-conteneur"><button class="bouton' + (tr ? " bouton-tranche" : "") + '" data-ouvre="tranche">' + (tr ? E(App.libelleTranche(tr)) : "Jours &amp; heures") + App.icones.basPetit + "</button>" +
      '<div class="menu-flottant menu-tranche" id="menu-tranche">' +
      '<div class="tr-titre">Jours de la semaine</div><div class="tr-jours">' + puces + "</div>" +
      '<div class="tr-titre">Plage horaire</div><div class="tr-heures"><label>De<input type="time" id="tr-de" value="' + (tr && tr.h1 !== null ? enHeure(tr.h1) : "") + '"></label>' +
      '<label>À<input type="time" id="tr-a" value="' + (tr && tr.h2 !== null ? enHeure(tr.h2) : "") + '"></label></div>' +
      '<div class="tr-raccourcis"><button type="button" class="bouton" data-tr-preset="11:00-15:00">Service midi</button><button type="button" class="bouton" data-tr-preset="18:00-23:59">Service soir</button></div>' +
      '<div class="tr-pied"><button type="button" class="bouton" data-tr-clear>Effacer</button><button type="button" class="bouton sombre" data-tr-ok>Appliquer</button></div>' +
      "</div></div>";
  }
  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-tr-jour],[data-tr-preset],[data-tr-ok],[data-tr-clear]") : null;
    var ctx = App.ctxCourant;
    if (!t || !ctx) return;
    if (t.hasAttribute("data-tr-jour")) { t.classList.toggle("actif"); return; }
    if (t.hasAttribute("data-tr-preset")) {
      var h = t.getAttribute("data-tr-preset").split("-");
      document.getElementById("tr-de").value = h[0]; document.getElementById("tr-a").value = h[1];
      return;
    }
    var params = {};
    if (t.hasAttribute("data-tr-ok")) {
      var js = Array.prototype.map.call(document.querySelectorAll("#menu-tranche .puce-jour.actif"), function (b) { return b.getAttribute("data-tr-jour"); });
      if (js.length) params.jours = js.join(",");
      var de = document.getElementById("tr-de").value, a = document.getElementById("tr-a").value;
      if (de) params.de = de;
      if (a) params.a = a;
    }
    ctx.naviguer(ctx.periode, App.lireTranche(params));
  });

  // ======================================================================
  // Menus déroulants, boutons, segments : tout passe par des clics délégués
  // ======================================================================
  App.fermerMenus = function () {
    Array.prototype.forEach.call(document.querySelectorAll(".menu-flottant.ouvert"), function (m) { m.classList.remove("ouvert"); });
  };

  // Liste déroulante de filtre. choix = [[valeur, libellé], ...] ; "" = « tout ».
  App.liste = function (id, libelleTout, choix, valeur, cb) {
    if (cb) App.act[id] = cb;
    var courant = valeur ? (choix.filter(function (c) { return c[0] === valeur; })[0] || [0, valeur])[1] : libelleTout;
    return '<div class="menu-conteneur"><button class="bouton" data-ouvre="' + id + '">' + E(courant) + App.icones.basPetit + "</button>" +
      '<div class="menu-flottant" id="menu-' + id + '" data-act="' + id + '">' +
      '<button class="choix' + (valeur ? "" : " coche") + '" data-val="">' + E(libelleTout) + "</button>" +
      choix.map(function (c) { return '<button class="choix' + (c[0] === valeur ? " coche" : "") + '" data-val="' + E(c[0]) + '">' + E(c[1]) + "</button>"; }).join("") +
      "</div></div>";
  };
  // Boutons à bascule (Hier / Aujourd'hui, TTC / HT...)
  App.segment = function (id, choix, courant, cb) {
    App.act[id] = cb;
    return '<div class="segment">' + choix.map(function (c) {
      return '<button class="' + (c[0] === courant ? "actif" : "") + '" data-act="' + id + '" data-val="' + E(c[0]) + '">' + c[1] + "</button>";
    }).join("") + "</div>";
  };
  App.bouton = function (libelle, id, opts) {
    opts = opts || {};
    return '<button class="bouton ' + (opts.classe || "") + '" data-act="' + id + '">' + libelle + (opts.chevron ? App.icones.basPetit : "") + "</button>";
  };

  // Message court en bas de l'écran
  App.info = function (texte) {
    var t = document.createElement("div");
    t.className = "toast"; t.textContent = texte;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add("visible"); }, 10);
    setTimeout(function () { t.classList.remove("visible"); setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 300); }, 2600);
  };
  App.nonDispo = function () { App.info("Non disponible dans la copie (lecture seule)."); };

  document.addEventListener("click", function (e) {
    var cible = e.target;
    var ouvre = cible.closest ? cible.closest("[data-ouvre]") : null;
    if (ouvre) {
      e.stopPropagation();
      var m = document.getElementById("menu-" + ouvre.getAttribute("data-ouvre"));
      var etait = m && m.classList.contains("ouvert");
      App.fermerMenus();
      if (m && !etait) m.classList.add("ouvert");
      return;
    }
    var choix = cible.closest ? cible.closest(".menu-flottant .choix[data-val]") : null;
    if (choix) {
      var f1 = action(choix.parentNode.getAttribute("data-act"));
      App.fermerMenus();
      if (f1) f1(choix.getAttribute("data-val"));
      return;
    }
    var act = cible.closest ? cible.closest("[data-act]") : null;
    if (act && !act.classList.contains("menu-flottant")) {
      var f = action(act.getAttribute("data-act"));
      if (f) { App.fermerMenus(); f(act.getAttribute("data-val"), act); return; }
    }
    if (cible.closest && cible.closest(".menu-flottant")) { if (cible.closest("a")) App.fermerMenus(); return; }
    App.fermerMenus();
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { App.fermerMenus(); App.fermerTiroir(); } });

  // ======================================================================
  // Composants de page
  // ======================================================================
  App.kpi = function (libelle, valeur) {
    return '<div class="kpi"><div class="kpi-l">' + libelle + '</div><div class="kpi-v">' + valeur + "</div></div>";
  };
  // n colonnes de cartes KPI (liste de [libelle, valeur])
  App.kpis = function (liste, colonnes) {
    return '<div class="kpis" style="--n:' + (colonnes || liste.length) + '">' + liste.map(function (k) { return App.kpi(k[0], k[1]); }).join("") + "</div>";
  };
  App.carte = function (titre, corps, opts) {
    opts = opts || {};
    return '<div class="carte ' + (opts.classe || "") + '">' + (opts.bande ? '<div class="carte-bande" style="background:' + opts.bande + '"></div>' : "") +
      (titre ? '<div class="carte-tete"><h2>' + titre + "</h2>" + (opts.droite ? '<div class="carte-droite">' + opts.droite + "</div>" : "") + "</div>" : "") +
      '<div class="carte-corps">' + corps + "</div></div>";
  };
  // État vide (document grisé + message)
  App.vide = function (texte) {
    return '<div class="etat-vide"><div class="etat-vide-rond">' + App.icones.document + "</div><h3>" + (texte || "Aucune donnée trouvée") + "</h3></div>";
  };
  // Tableau simple. cols = [{t, a}] ; lignes = [[html, ...]] ; total = [html, ...] (ligne grise en tête)
  App.table = function (cols, lignes, total, opts) {
    opts = opts || {};
    return '<table class="' + (opts.classe || "") + '"><thead><tr>' + cols.map(function (c) { return '<th class="' + (c.a === "d" ? "" : "g") + '">' + c.t + "</th>"; }).join("") + "</tr></thead><tbody>" +
      (total ? '<tr class="total">' + total.map(function (v, i) { return '<td class="' + (cols[i].a === "d" ? "" : "g") + '">' + v + "</td>"; }).join("") + "</tr>" : "") +
      lignes.map(function (l, n) {
        var det = opts.details ? opts.details(n) : null;
        var h = "<tr" + (det && det.length ? ' class="depliable" data-dep="x' + n + '"' : "") + ">" + l.map(function (v, i) {
          return '<td class="' + (cols[i].a === "d" ? "" : "g") + '">' + v + (i === 0 && det && det.length ? ' <span class="chev-dep">' + App.icones.bas + "</span>" : "") + "</td>";
        }).join("") + "</tr>";
        (det || []).forEach(function (d) {
          h += '<tr class="detail masque" data-parent="x' + n + '">' + d.map(function (v, i) { return '<td class="' + (cols[i].a === "d" ? "" : "g") + '">' + v + "</td>"; }).join("") + "</tr>";
        });
        return h;
      }).join("") + "</tbody></table>";
  };

  // ---- Tiroir latéral (détail d'une commande) ----
  App.tiroir = function (html) {
    App.fermerTiroir();
    var fond = document.createElement("div");
    fond.className = "tiroir-fond"; fond.id = "tiroir";
    fond.innerHTML = '<aside class="tiroir">' + html + "</aside>";
    fond.addEventListener("click", function (e) { if (e.target === fond) App.fermerTiroir(); });
    document.body.appendChild(fond);
    return fond.firstChild;
  };
  App.fermerTiroir = function () { var t = document.getElementById("tiroir"); if (t) t.parentNode.removeChild(t); };

  // Lignes dépliables : <tr data-dep="x"> ouvre/ferme les <tr data-parent="x" class="detail masque">
  function basculerDetail(zone, tr) {
    var ouvert = tr.classList.toggle("ouvert"), cle = tr.getAttribute("data-dep");
    Array.prototype.forEach.call(zone.querySelectorAll('tr[data-parent="' + cle + '"]'), function (d) { d.classList.toggle("masque", !ouvert); });
  }
  App.brancherDepliables = function (zone) {
    zone.addEventListener("click", function (e) {
      var t = e.target.closest("[data-dep]");
      if (t) basculerDetail(zone, t);
    });
  };

  // ---- Table de données : recherche, tri, colonnes, pagination (tout côté navigateur) ----
  // cfg = { colonnes:[{t,k,a,f(row),tri(row),cache}], lignes, rech:{ph,texte(row)}, pageSize, filtres:html, vide, total:[html..], onLigne(row) }
  App.monterTable = function (zone, cfg) {
    var st = { q: "", page: 0, taille: cfg.pageSize || 10, tri: null, cachees: {} };
    (cfg.colonnes || []).forEach(function (c) { if (c.cache) st.cachees[c.t] = true; });
    var id = "td" + Math.floor(Math.random() * 1e6);

    zone.innerHTML =
      '<div class="td-barre">' +
      (cfg.rech ? '<label class="champ-recherche">' + App.icones.loupe + '<input type="search" placeholder="' + E(cfg.rech.ph || "Rechercher...") + '" data-r></label>' : "") +
      (cfg.sansFiltrer ? "" : '<button class="bouton" data-filtrer>' + App.icones.plus + " Filtrer</button>") + (cfg.filtres || "") +
      '<span class="td-espace"></span>' + (cfg.droite || "") +
      (cfg.sansColonnes ? "" : '<div class="menu-conteneur"><button class="bouton" data-ouvre="' + id + '">' + App.icones.filtres + ' Colonnes</button>' +
        '<div class="menu-flottant droite" id="menu-' + id + '">' +
        cfg.colonnes.map(function (c, i) { return '<button class="choix" data-col="' + i + '">' + E(c.t) + "</button>"; }).join("") + "</div></div>") + "</div>" +
      (cfg.selection ? '<div class="td-selbarre masque" data-selbarre></div>' : "") +
      '<div class="td-corps"></div>';
    var corps = zone.querySelector(".td-corps");
    // Sélection multiple : cfg.selection = { sel:{id:true}, id(row), actions:html } ; Maj+clic = plage
    var S = cfg.selection, derniere = null;
    function majSelection(l) {
      if (!S) return;
      var n = Object.keys(S.sel).length, b = zone.querySelector("[data-selbarre]");
      b.classList.toggle("masque", !n);
      b.innerHTML = '<b>' + n + (n > 1 ? " sélectionnés" : " sélectionné") + '</b><span class="td-espace"></span>' + (S.actions || "") + '<button class="bouton" data-selvider>Tout désélectionner</button>';
      var tous = zone.querySelector("[data-selall]");
      if (tous) {
        var k = l.filter(function (r) { return S.sel[S.id(r)]; }).length;
        tous.checked = l.length > 0 && k === l.length; tous.indeterminate = k > 0 && k < l.length;
      }
    }

    function filtrees() {
      var q = st.q.trim().toLowerCase();
      var l = cfg.lignes.filter(function (r) { return !q || (cfg.rech && cfg.rech.texte(r).toLowerCase().indexOf(q) >= 0); });
      if (st.tri) {
        var c = cfg.colonnes[st.tri.i], val = c.tri || function (r) { return r[c.k]; };
        l = l.slice().sort(function (a, b) {
          var x = val(a), y = val(b);
          if (typeof x === "string") return st.tri.sens * x.localeCompare(y, "fr");
          return st.tri.sens * ((x || 0) - (y || 0));
        });
      }
      return l;
    }
    function dessiner() {
      var l = filtrees(), pages = Math.max(1, Math.ceil(l.length / st.taille));
      if (st.page >= pages) st.page = pages - 1;
      var debut = st.page * st.taille, vue = l.slice(debut, debut + st.taille);
      var cols = cfg.colonnes.map(function (c, i) { return { c: c, i: i }; }).filter(function (x) { return !st.cachees[x.c.t]; });
      var h = '<table class="table-donnees"><thead><tr>' + (S ? '<th class="g col-sel"><input type="checkbox" data-selall title="Sélectionner tous les éléments filtrés"></th>' : "") + cols.map(function (x) {
        var fl = st.tri && st.tri.i === x.i ? (st.tri.sens > 0 ? " ↑" : " ↓") : "";
        return '<th class="' + (x.c.a === "d" ? "" : "g") + '" data-tri="' + x.i + '">' + x.c.t + fl + "</th>";
      }).join("") + "</tr></thead><tbody>";
      if (cfg.total) h += '<tr class="total">' + (S ? "<td></td>" : "") + cols.map(function (x) { return '<td class="' + (x.c.a === "d" ? "" : "g") + '">' + (cfg.total[x.i] || "") + "</td>"; }).join("") + "</tr>";
      if (!vue.length) h += '<tr><td colspan="' + (cols.length + (S ? 1 : 0)) + '" class="vide-ligne">' + E(cfg.vide || "Aucun élément disponible") + "</td></tr>";
      vue.forEach(function (r, k) {
        var det = cfg.detail ? cfg.detail(r) : null, cle = "d" + (debut + k);
        var coche = S && S.sel[S.id(r)];
        h += '<tr class="' + (cfg.onLigne ? "cliquable" : "") + (det && det.length ? " depliable" : "") + (coche ? " selectionnee" : "") + '"' + (cfg.onLigne ? ' data-ligne="' + (debut + k) + '"' : "") + (det && det.length ? ' data-dep="' + cle + '"' : "") + ">" +
          (S ? '<td class="g col-sel" data-sel="' + (debut + k) + '"><input type="checkbox"' + (coche ? " checked" : "") + "></td>" : "") + cols.map(function (x, ci) {
          var v = x.c.f ? x.c.f(r) : E(r[x.c.k] == null ? "" : r[x.c.k]);
          return '<td class="' + (x.c.a === "d" ? "" : "g") + '">' + v + (ci === 0 && det && det.length ? ' <span class="chev-dep">' + App.icones.bas + "</span>" : "") + "</td>";
        }).join("") + "</tr>";
        (det || []).forEach(function (d) {
          h += '<tr class="detail masque" data-parent="' + cle + '">' + (S ? "<td></td>" : "") + cols.map(function (x) {
            return '<td class="' + (x.c.a === "d" ? "" : "g") + '">' + (d[x.i] == null ? "" : d[x.i]) + "</td>";
          }).join("") + "</tr>";
        });
      });
      h += "</tbody></table>";
      if (cfg.sansPied) { corps.innerHTML = h; corps._vue = l; majSelection(l); return; }
      h += '<div class="td-pied"><span class="doux">De ' + (l.length ? debut + 1 : 0) + "-" + Math.min(l.length, debut + st.taille) + " sur " + App.entier(l.length) +
        " éléments - 0 lignes cachées par les filtres</span><span class=\"td-espace\"></span>" +
        '<span class="doux">Nombre de lignes par page</span><select data-taille>' +
        [10, 20, 50].map(function (n) { return '<option value="' + n + '"' + (n === st.taille ? " selected" : "") + ">" + n + "</option>"; }).join("") +
        '</select><span class="doux">Page ' + (st.page + 1) + " sur " + pages + "</span>" +
        '<button class="bouton-icone" data-p="0"' + (st.page === 0 ? " disabled" : "") + '>«</button><button class="bouton-icone" data-p="' + (st.page - 1) + '"' + (st.page === 0 ? " disabled" : "") + '>‹</button>' +
        '<button class="bouton-icone" data-p="' + (st.page + 1) + '"' + (st.page >= pages - 1 ? " disabled" : "") + '>›</button><button class="bouton-icone" data-p="' + (pages - 1) + '"' + (st.page >= pages - 1 ? " disabled" : "") + ">»</button></div>";
      corps.innerHTML = h;
      corps._vue = l;
      majSelection(l);
    }
    zone.addEventListener("input", function (e) { if (e.target.hasAttribute("data-r")) { st.q = e.target.value; st.page = 0; dessiner(); } });
    zone.addEventListener("change", function (e) { if (e.target.hasAttribute("data-taille")) { st.taille = +e.target.value; st.page = 0; dessiner(); } });
    zone.addEventListener("click", function (e) {
      var t = e.target.closest("[data-tri],[data-p],[data-col],[data-filtrer],[data-sel],[data-selall],[data-selvider],[data-ligne],[data-dep]");
      if (!t) return;
      if (t.hasAttribute("data-selall")) {
        var vue = corps._vue, plein = vue.every(function (r) { return S.sel[S.id(r)]; });
        vue.forEach(function (r) { if (plein) delete S.sel[S.id(r)]; else S.sel[S.id(r)] = true; });
        dessiner();
      } else if (t.hasAttribute("data-selvider")) { Object.keys(S.sel).forEach(function (k) { delete S.sel[k]; }); dessiner(); }
      else if (t.hasAttribute("data-sel")) {
        var v = corps._vue, i0 = +t.getAttribute("data-sel"), on = !S.sel[S.id(v[i0])];
        var a = e.shiftKey && derniere !== null ? Math.min(derniere, i0) : i0, b = e.shiftKey && derniere !== null ? Math.max(derniere, i0) : i0;
        for (var j = a; j <= b && j < v.length; j++) { if (on) S.sel[S.id(v[j])] = true; else delete S.sel[S.id(v[j])]; }
        derniere = i0; dessiner();
      }
      else if (t.hasAttribute("data-dep") && !t.hasAttribute("data-ligne")) basculerDetail(zone, t);
      else if (t.hasAttribute("data-tri")) { var i = +t.getAttribute("data-tri"); st.tri = st.tri && st.tri.i === i ? { i: i, sens: -st.tri.sens } : { i: i, sens: 1 }; dessiner(); }
      else if (t.hasAttribute("data-p") && !t.disabled) { st.page = +t.getAttribute("data-p"); dessiner(); }
      else if (t.hasAttribute("data-col")) { var c = cfg.colonnes[+t.getAttribute("data-col")]; st.cachees[c.t] = !st.cachees[c.t]; dessiner(); }
      else if (t.hasAttribute("data-filtrer")) App.info("Filtres avancés non disponibles dans la copie.");
      else if (t.hasAttribute("data-ligne") && cfg.onLigne) cfg.onLigne(corps._vue[+t.getAttribute("data-ligne")]);
    });
    dessiner();
  };

  // ======================================================================
  // Graphiques (SVG simples)
  // ======================================================================
  var Graph = App.graph = {};
  function echelle(max) {
    if (max <= 0) return { max: 4, pas: 1 };
    var brut = max / 4, mag = Math.pow(10, Math.floor(Math.log(brut) / Math.LN10)), norm = brut / mag;
    var pas = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
    return { max: pas * 4, pas: pas };
  }
  function etiqY(v) { return v >= 1000 ? String(v / 1000).replace(".", ",") + "K" : String(v); }
  function lisse(pts) {
    var n = pts.length, i, dx = [], m = [], t;
    if (n < 2) return pts.length ? "M" + pts[0].x + "," + pts[0].y : "";
    for (i = 0; i < n - 1; i++) { dx[i] = pts[i + 1].x - pts[i].x; m[i] = (pts[i + 1].y - pts[i].y) / dx[i]; }
    t = [m[0]];
    for (i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    t[n - 1] = m[n - 2];
    for (i = 0; i < n - 1; i++) {
      if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
      var a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
      if (s > 9) { var k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
    }
    var d = "M" + pts[0].x.toFixed(1) + "," + pts[0].y.toFixed(1);
    for (i = 0; i < n - 1; i++) {
      var h = dx[i] / 3;
      d += " C" + (pts[i].x + h).toFixed(1) + "," + (pts[i].y + t[i] * h).toFixed(1) + " " + (pts[i + 1].x - h).toFixed(1) + "," + (pts[i + 1].y - t[i + 1] * h).toFixed(1) + " " + pts[i + 1].x.toFixed(1) + "," + pts[i + 1].y.toFixed(1);
    }
    return d;
  }
  // Repère commun : renvoie { debut, fin, X(i), Y(v), e } et le SVG de la grille
  function repere(o, n, maxV) {
    var W = 900, H = o.hauteur || 300, mg = { g: 44, d: 14, h: 10, b: 32 }, e = echelle(maxV);
    var r = {
      W: W, H: H, e: e,
      X: function (i) { return mg.g + (n > 1 ? i * (W - mg.g - mg.d) / (n - 1) : 0); },
      Y: function (v) { return H - mg.b - (v / e.max) * (H - mg.h - mg.b); }
    };
    var s = "";
    for (var k = 0; k <= 4; k++) {
      var y = r.Y(k * e.pas);
      s += '<line x1="' + mg.g + '" x2="' + (W - mg.d) + '" y1="' + y + '" y2="' + y + '" class="g-grille"/><text x="' + (mg.g - 8) + '" y="' + (y + 4) + '" text-anchor="end" class="g-axe">' + etiqY(k * e.pas) + "</text>";
    }
    var pasX = n > 16 ? Math.ceil(n / 16) : 1;
    (o.labels || []).forEach(function (l, i) { if (i % pasX === 0) s += '<text x="' + r.X(i) + '" y="' + (H - 10) + '" text-anchor="middle" class="g-axe">' + l + "</text>"; });
    r.base = s; r.mg = mg;
    return r;
  }
  Graph.courbe = function (o) {
    var n = o.labels.length, maxV = 0;
    o.series.forEach(function (s) { s.valeurs.forEach(function (v) { if (v != null && v > maxV) maxV = v; }); });
    var r = repere(o, n, maxV), h = r.base;
    o.series.forEach(function (s) {
      var pts = [];
      s.valeurs.forEach(function (v, i) { if (v != null) pts.push({ x: r.X(i), y: r.Y(v) }); });
      h += '<path d="' + (o.lisse === false ? "M" + pts.map(function (p) { return p.x + "," + p.y; }).join(" L") : lisse(pts)) + '" fill="none" stroke="' + s.couleur + '" stroke-width="2"' + (s.tirets ? ' stroke-dasharray="5 4"' : "") + "/>";
    });
    return '<svg class="graphique" viewBox="0 0 ' + r.W + " " + r.H + '" preserveAspectRatio="xMidYMid meet">' + h + "</svg>";
  };
  Graph.barres = function (o) {
    var n = o.labels.length, maxV = 0;
    o.valeurs.forEach(function (v) { if (v > maxV) maxV = v; });
    var r = repere({ hauteur: o.hauteur }, n, maxV), h = r.base;
    var largeur = (r.W - r.mg.g - r.mg.d) / n, bw = largeur * 0.74;
    o.valeurs.forEach(function (v, i) {
      var y = r.Y(v), y0 = r.Y(0), cx = r.mg.g + largeur * i + largeur / 2;
      h += '<rect x="' + (cx - bw / 2) + '" y="' + Math.min(y, y0 - 3) + '" width="' + bw + '" height="' + Math.max(3, y0 - y) + '" rx="4" fill="' + (o.couleur || "#757575") + '"/>';
      h += '<text x="' + cx + '" y="' + (r.H - 10) + '" text-anchor="middle" class="g-axe g-gras">' + o.labels[i] + "</text>";
    });
    return '<svg class="graphique" viewBox="0 0 ' + r.W + " " + r.H + '">' + h + "</svg>";
  };
  // Aires empilées lissées. series = [{nom, couleur, valeurs}]
  Graph.aires = function (o) {
    var n = o.labels.length, cumul = [], maxV = 0, i;
    o.series.forEach(function (s, k) {
      cumul[k] = s.valeurs.map(function (v, j) { return v + (k ? cumul[k - 1][j] : 0); });
    });
    if (cumul.length) cumul[cumul.length - 1].forEach(function (v) { if (v > maxV) maxV = v; });
    var r = repere(o, n, maxV), h = r.base;
    for (i = cumul.length - 1; i >= 0; i--) {
      var pts = cumul[i].map(function (v, j) { return { x: r.X(j), y: r.Y(v) }; }), c = o.series[i].couleur;
      h += '<path d="' + lisse(pts) + " L" + r.X(n - 1) + "," + r.Y(0) + " L" + r.X(0) + "," + r.Y(0) + ' Z" fill="' + c + '" fill-opacity="0.14" stroke="none"/>';
      h += '<path d="' + lisse(pts) + '" fill="none" stroke="' + c + '" stroke-width="1.4"/>';
    }
    return '<svg class="graphique" viewBox="0 0 ' + r.W + " " + r.H + '">' + h + "</svg>";
  };
  // Barres verticales empilées (jours de la semaine, tranches horaires). segments = [{nom,couleur,valeurs}]
  Graph.barresEmpilees = function (o) {
    var n = o.labels.length, W = 900, H = o.hauteur || 340, mb = 34, mh = 8, tot = [], maxV = 0, i, k;
    for (i = 0; i < n; i++) { tot[i] = 0; o.segments.forEach(function (s) { tot[i] += s.valeurs[i] || 0; }); if (tot[i] > maxV) maxV = tot[i]; }
    var largeur = W / n, bw = Math.min(110, largeur * 0.6), h = "";
    for (i = 0; i < n; i++) {
      var cx = largeur * i + largeur / 2, y = H - mb;
      for (k = 0; k < o.segments.length; k++) {
        var v = o.segments[k].valeurs[i] || 0;
        if (!v || !maxV) continue;
        var hh = v / maxV * (H - mb - mh);
        h += '<rect x="' + (cx - bw / 2) + '" y="' + (y - hh + 1) + '" width="' + bw + '" height="' + Math.max(2, hh - 2) + '" rx="5" fill="' + o.segments[k].couleur + '"><title>' + E(o.segments[k].nom) + " : " + (o.formatter ? o.formatter(v) : v) + "</title></rect>";
        y -= hh;
      }
      h += '<text x="' + cx + '" y="' + (H - 10) + '" text-anchor="middle" class="g-axe g-gras">' + o.labels[i] + "</text>";
    }
    return '<svg class="graphique" viewBox="0 0 ' + W + " " + H + '">' + h + "</svg>";
  };
  Graph.legende = function (items) {
    return '<div class="legende">' + items.map(function (i) { return '<span><i style="background:' + i.couleur + '"></i>' + E(i.nom) + "</span>"; }).join("") + "</div>";
  };

  // ======================================================================
  // Barres latérales par section
  // ======================================================================
  var ventes = [
    ["Produits", "products"], ["Options", "modifiers"], ["Employés", "employees"], ["Annulations", "cancelation"], ["Pertes", "losses"],
    ["Remises", "discounts"], ["Taxes", "taxes"], ["Paiements", "payments"], ["Catégories", "categories"],
    ["Taux de Répartition", "sales-distribution"], ["Menus", "menus"], ["Historique des caisses", "z-report"], ["Export comptable", "accounting-export"], ["Fiscal", "fiscal"]
  ].map(function (x) { return { label: x[0], route: "/reports/sales-report/" + x[1] }; });
  var reglagesPdv = [
    ["Imprimantes", "printers"], ["Postes de préparation", "prepa-stations"], ["Types de prix", "price-types"], ["Taxes", "taxes"],
    ["Remises", "discounts"], ["Mouvements de caisse", "cash-movements"], ["Ticket de caisse", "receipt"], ["Modes de paiement", "payments"],
    ["Créneaux de service", "service-slots"], ["Réglages divers", "misc-settings"], ["Appareils et Contrats", "devices-contracts"]
  ].map(function (x) { return { label: x[0], route: "/point-of-sale/settings/" + x[1] }; });

  var SECTIONS = {
    rapports: {
      titre: "Rapports", items: [
        { label: "Tableau de bord", route: "/reports/dashboard", icone: ICONES.courbe },
        { label: "Caisses en cours", route: "/reports/tills-in-progress", icone: ICONES.direct },
        { label: "Objectifs", route: "/reports/objectifs", icone: ICONES.courbe },
        { label: "Stocks", route: "/reports/stocks", icone: ICONES.stocks },
        { label: "Prévisions météo", route: "/reports/forecast", icone: ICONES.soleil, meteo: true },
        { groupe: "ventes", label: "Rapports des ventes", icone: ICONES.dossier, items: ventes }
      ]
    },
    pdv: {
      titre: "Point De Vente", items: [
        { label: "Produits", route: "/point-of-sale/products-list", icone: ICONES.liste },
        { label: "Mise en page", route: "/point-of-sale/catalog", icone: ICONES.grille },
        { label: "Options", route: "/point-of-sale/modifiers", icone: ICONES.options },
        { label: "Menus", route: "/point-of-sale/meals", icone: ICONES.couverts },
        { label: "Employés", route: "/point-of-sale/employees", icone: ICONES.personnes },
        { label: "Salles", route: "/point-of-sale/rooms", icone: ICONES.chaise },
        { groupe: "reglages-pdv", label: "Réglages", icone: ICONES.engrenage, items: reglagesPdv }
      ]
    },
    clients: { titre: "Fiches Clients", items: [{ label: "Liste des clients", route: "/customers", icone: ICONES.clients }, { label: "Bons cadeaux", route: "/customers/vouchers", icone: ICONES.cadeau }] },
    reglages: {
      titre: "Mon Compte", items: [
        { label: "Profil", route: "/settings/profile", icone: ICONES.utilisateur },
        { label: "Méthodes d'authentification", route: "/settings/auth-methods", icone: ICONES.cadenas },
        { label: "Notifications", route: "/settings/notifications", icone: ICONES.cloche },
        { titre: "Organisation" },
        { label: "Gestion des utilisateurs", route: "/settings/users", icone: ICONES.personnes },
        { label: "Gestion des rôles", route: "/settings/roles", icone: ICONES.personnes },
        { label: "Gestion des sites", route: "/settings/sites", icone: ICONES.pin }
      ]
    },
    integrations: {
      titre: "Intégrations", sansIcones: true, items: [
        "Sélection", "Gestion des stocks", "Comptabilité", "E-Ticket", "Business intelligence", "Commandes en ligne", "Solutions de Fidélité", "Ressources humaines", "Développeur"
      ].map(function (n) { return { label: n, route: "/integrations", ancre: n }; })
    }
  };
  var groupesOuverts = { "ventes": true, "reglages-pdv": true };

  function actif(route, chemin) {
    if (route === "/customers" && chemin.indexOf("/customers/vouchers") === 0) return false;
    return chemin === route || chemin.indexOf(route + "/") === 0; }
  function lienMenu(it, chemin, params, section) {
    var q = section === "rapports" && params.dateStart ? "?dateStart=" + params.dateStart + "&dateEnd=" + params.dateEnd + requeteTranche(params.tr) : "";
    if (it.ancre) q = "?cat=" + encodeURIComponent(it.ancre);
    var ok = it.ancre ? false : actif(it.route, chemin);
    return '<a href="#' + it.route + q + '" class="' + (it.icone ? "niveau1" : "") + (ok ? " actif" : "") + '">' + (it.icone || "") + E(it.label) + "</a>";
  }
  function barreLaterale(section, chemin, params) {
    var s = SECTIONS[section];
    var h = '<aside class="barre-laterale"><h3>' + s.titre + "</h3>";
    s.items.forEach(function (it) {
      if (it.meteo && !App.meteoActif()) return;
      if (it.titre) { h += '<h3 class="sous-titre">' + it.titre + "</h3>"; return; }
      if (!it.groupe) { h += lienMenu(it, chemin, params, section); return; }
      var ouvert = groupesOuverts[it.groupe];
      h += '<div class="niveau1" data-act="groupe" data-val="' + it.groupe + '">' + it.icone + E(it.label) + (ouvert ? ICONES.haut : ICONES.bas) + "</div>";
      if (ouvert) h += '<div class="sous-liens">' + it.items.map(function (x) { return lienMenu(x, chemin, params, section); }).join("") + "</div>";
    });
    return h + "</aside>";
  }

  // ======================================================================
  // Mise en page d'un écran
  // ======================================================================
  var ONGLETS = [
    { id: "home", label: "Accueil", route: "/", prefixe: "" },
    { id: "orders", label: "Commandes", route: "/orders", prefixe: "/orders" },
    { id: "reports", label: "Rapports", route: "/reports/dashboard", prefixe: "/reports" },
    { id: "pos", label: "Point de vente", route: "/point-of-sale/products-list", prefixe: "/point-of-sale" },
    { id: "resa", label: "Réservations", route: "/reservations", prefixe: "/reservations" },
    { id: "clients", label: "Client", route: "/customers", prefixe: "/customers" }
  ];
  function dessinerEntete(chemin) {
    document.getElementById("onglets").innerHTML = ONGLETS.map(function (o) {
      var ok = o.prefixe ? chemin.indexOf(o.prefixe) === 0 : chemin === "/";
      return '<a href="#' + o.route + '"' + (ok ? ' class="actif"' : "") + ">" + o.label + "</a>";
    }).join("");
    document.getElementById("lien-news").className = chemin === "/whats-new" ? "actif" : "";
    document.getElementById("lien-aide").className = chemin === "/help" ? "actif" : "";
  }

  function htmlFiltrePeriode(periode) {
    var choix = App.choixPeriode();
    return '<div class="selecteur-periode menu-conteneur"><button id="prec" aria-label="Période précédente" data-act="periode-prec">‹</button>' +
      '<button class="libelle" data-ouvre="periode">' + App.libellePeriode(periode) + "</button>" +
      '<button id="suiv" aria-label="Période suivante" data-act="periode-suiv"' + (App.peutAvancer(periode) ? "" : " disabled") + ">›</button>" +
      '<div class="menu-flottant" id="menu-periode">' + choix.map(function (c) {
        var coche = c[1].dateStart === periode.dateStart && c[1].dateEnd === periode.dateEnd;
        return '<button class="choix' + (coche ? " coche" : "") + '" data-debut="' + c[1].dateStart + '" data-fin="' + c[1].dateEnd + '">' + c[0] + "</button>";
      }).join("") +
      '<div class="separateur"></div><div class="plage"><label>Du<br><input type="date" id="plage-debut" value="' + periode.dateStart + '"></label>' +
      '<label>Au<br><input type="date" id="plage-fin" value="' + periode.dateEnd + '"></label><button class="bouton" data-act="plage-ok">Appliquer</button></div></div></div>';
  }
  function htmlFiltreSites() {
    return '<div class="menu-conteneur"><button class="bouton" data-ouvre="sites">Tous les sites' + ICONES.basPetit + "</button>" +
      '<div class="menu-flottant" id="menu-sites" data-act="sites"><button class="choix coche" data-val="">Tous les sites</button><div class="separateur"></div>' +
      '<button class="choix" data-val="1">' + E(App.siteNom || "") + "</button></div></div>";
  }
  App.actGlobal.sites = function () { /* un seul site de test : même résultat */ };
  App.actGlobal.groupe = function (g) { groupesOuverts[g] = !groupesOuverts[g]; App.garderMenuLat = true; App.afficher(); };

  // Écrans sans source dans l'API officielle : masqués en mode « Réelles » (voir API-officielle.md)
  var HORS_API = ["/reports/stocks", "/reports/sales-report/fiscal", "/point-of-sale/meals", "/point-of-sale/settings/printers", "/point-of-sale/settings/prepa-stations",
    "/point-of-sale/settings/price-types", "/point-of-sale/settings/discounts", "/point-of-sale/settings/cash-movements", "/point-of-sale/settings/misc-settings",
    "/reservations", "/customers", "/customers/vouchers", "/settings/profile", "/settings/auth-methods", "/settings/notifications", "/settings/users", "/settings/roles",
    "/integrations", "/whats-new", "/help"];
  function horsApi(chemin) { return HORS_API.indexOf(chemin) >= 0 || chemin.indexOf("/customers/view/") === 0; }

  App.afficher = function () {
    var url = lireUrl(), chemin = url.chemin;
    var m = trouver(chemin), cfg = m ? m.cfg : { section: null, fil: ["Bientôt disponible"], rendre: function (ctx, zone) { zone.innerHTML = '<div class="bientot">Bientôt disponible<br><small>' + E(chemin) + "</small></div>"; } };
    App.fermerMenus(); App.fermerTiroir();
    App.act = {};
    dessinerEntete(chemin);

    var ctx = { chemin: chemin, params: url.params, ids: m ? m.ids : {}, etat: (App.etat[chemin] = App.etat[chemin] || {}) };
    var defaut = cfg.periodeJour ? App.periodeJour(0) : App.periodeMois();
    ctx.periode = url.params.dateStart && url.params.dateEnd ? { dateStart: url.params.dateStart, dateEnd: url.params.dateEnd } : defaut;
    ctx.tranche = App.lireTranche(url.params);
    // Navigation en gardant (ou changeant) la tranche jours/heures
    ctx.naviguer = function (p, tr) { App.allerA(chemin, fusion({ dateStart: p.dateStart, dateEnd: p.dateEnd }, App.paramsTranche(tr))); };
    App.ctxCourant = ctx;
    if (cfg.titreFil) cfg.fil = cfg.titreFil(ctx);

    var fil = typeof cfg.fil === "function" ? cfg.fil(ctx) : cfg.fil || [];
    var filtres = cfg.filtres || [];
    var actions = typeof cfg.actions === "function" ? cfg.actions(ctx) : (cfg.actions || "");
    var htmlFiltres = "";
    if (typeof filtres === "function") htmlFiltres = filtres(ctx);
    else filtres.forEach(function (f) {
      if (f === "periode") htmlFiltres += htmlFiltrePeriode(ctx.periode);
      else if (f === "tranche") htmlFiltres += htmlFiltreTranche(ctx);
      else if (f === "sites") htmlFiltres += htmlFiltreSites();
      else if (typeof f === "function") htmlFiltres += f(ctx);
      else htmlFiltres += f; // du HTML déjà prêt
    });

    var bandeau = cfg.bandeau === false ? "" :
      '<div class="bandeau' + (htmlFiltres ? "" : " sans-filtres") + (actions ? "" : " sans-actions") + '"><div class="bandeau-haut"><span class="fil">' +
      fil.map(function (f, i) { return i === fil.length - 1 ? "<b>" + E(f) + "</b>" : E(f) + ' <span class="sep">›</span> '; }).join("") +
      '</span><div class="actions">' + actions + "</div></div>" +
      (htmlFiltres ? '<div class="filtres">' + htmlFiltres + "</div>" : "") + "</div>";

    var corps = '<section class="contenu"><div class="contenu-centre ' + (cfg.large ? "large" : "") + '">' + bandeau + '<div id="zone-tranche"></div><div id="zone-meteo"></div><div id="zone-ecran"></div></div></section>';
    document.getElementById("page").innerHTML =
      '<div class="mise-en-page' + (cfg.section ? "" : " sans-barre") + '">' +
      (cfg.section ? '<button class="bouton bouton-menu-lat" data-act="menu-lat">☰ Menu ' + E(SECTIONS[cfg.section].titre) + "</button>" + barreLaterale(cfg.section, chemin, { dateStart: ctx.periode.dateStart, dateEnd: ctx.periode.dateEnd, tr: ctx.tranche }) : "") + corps + "</div>";
    // Téléphone : la barre latérale devient un menu repliable (fermé par défaut)
    App.act["menu-lat"] = function () {
      var b = document.querySelector(".barre-laterale");
      if (b) b.classList.toggle("ouverte");
    };
    var bl = document.querySelector(".barre-laterale");
    if (bl && App.garderMenuLat) bl.classList.add("ouverte");
    App.garderMenuLat = false;

    // Actions de la période
    App.act["periode-prec"] = function () { ctx.naviguer(App.decalerPeriode(ctx.periode, -1), ctx.tranche); };
    App.act["periode-suiv"] = function () { ctx.naviguer(App.decalerPeriode(ctx.periode, 1), ctx.tranche); };
    App.act["plage-ok"] = function () {
      var d = document.getElementById("plage-debut").value, f = document.getElementById("plage-fin").value;
      if (!d || !f) return;
      if (d > f) { var t = d; d = f; f = t; }
      ctx.naviguer({ dateStart: d, dateEnd: f }, ctx.tranche);
    };
    Array.prototype.forEach.call(document.querySelectorAll("#menu-periode .choix"), function (b) {
      b.onclick = function (e) { e.stopPropagation(); ctx.naviguer({ dateStart: b.getAttribute("data-debut"), dateEnd: b.getAttribute("data-fin") }, ctx.tranche); };
    });
    // Rappel de la tranche active (sur les écrans qui la gèrent), avec un lien pour la retirer
    if (ctx.tranche && filtres.indexOf && filtres.indexOf("tranche") >= 0) {
      document.getElementById("zone-tranche").innerHTML = '<div class="bandeau-tranche"><span>Filtre actif : <b>' + E(App.libelleTranche(ctx.tranche)) + "</b> · les chiffres ne portent que sur cette tranche.</span>" +
        '<button class="bouton" data-tr-clear>Retirer</button></div>';
    }
    var zone = document.getElementById("zone-ecran");
    ctx.zone = zone;
    ctx.rafraichir = function () { App.afficher(); };
    if (DonneesTest.mode === "reelles" && horsApi(chemin)) {
      // Pas de données inventées mélangées aux vraies : on explique pourquoi l'écran est vide.
      zone.innerHTML = '<div class="carte"><div class="etat-vide"><div class="etat-vide-rond">' + ICONES.document + "</div><h3>Données non fournies par l'API Popina</h3>" +
        '<p class="doux hors-api">Cet écran n\'a pas de source de vraies données. Pour le voir avec des données de démonstration, choisissez « Test » dans le menu du compte (bouton en haut à droite › Données).</p></div></div>';
      window.scrollTo(0, 0);
      return;
    }
    if (App.meteoActif() && App.meteoBandeau && chemin.indexOf("/reports/sales-report/") === 0 && filtres.indexOf && filtres.indexOf("periode") >= 0) {
      App.meteoBandeau(ctx, document.getElementById("zone-meteo"));
    }
    cfg.rendre(ctx, zone);
    window.scrollTo(0, 0);
    App.majAlertes();
  };

  // Cloche d'alertes : produits dont le stock a atteint le seuil de réapprovisionnement (stocks factices, donc masquée en mode Réelles)
  App.majAlertes = function () {
    var conteneur = document.getElementById("cloche-alertes");
    if (DonneesTest.mode === "reelles") { conteneur.hidden = true; return Promise.resolve([]); }
    return DonneesTest.getAlertesStock().then(function (liste) {
      var bouton = conteneur.querySelector(".bouton-cloche");
      conteneur.hidden = false;
      bouton.innerHTML = ICONES.cloche + (liste.length ? '<span class="pastille-alerte">' + liste.length + "</span>" : "");
      document.getElementById("menu-alertes").innerHTML = '<div class="alertes-titre">Réapprovisionnement</div>' + (liste.length ?
        liste.map(function (a) {
          return '<a class="alerte-ligne" href="#/reports/stocks"><span class="alerte-nom">' + E(a.productName) + '</span><span class="alerte-detail ' + (a.quantity === 0 ? "vide" : "") + '">' +
            (a.quantity === 0 ? "Rupture" : "Stock " + a.quantity) + " · seuil " + a.seuil + "</span></a>";
        }).join("") : '<div class="alerte-vide">Aucun produit sous son seuil.</div>');
      return liste;
    });
  };

  // ======================================================================
  // En-tête : menu du compte, thème
  // ======================================================================
  var theme = "systeme";
  function appliquerTheme() {
    var sombre = theme === "sombre" || (theme === "systeme" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", sombre ? "dark" : "light");
  }
  App.demarrer = function () {
    try { theme = localStorage.getItem("theme-copie") || "systeme"; } catch (e) { /* stockage indisponible */ }
    appliquerTheme();
    DonneesTest.getLocations().then(function (sites) {
      App.siteNom = sites[0].name; App.siteSigle = sites[0].sigle;
      document.getElementById("nom-site").textContent = App.siteNom;
      document.getElementById("avatar-site").textContent = App.siteSigle;
      document.getElementById("badge-mode").hidden = DonneesTest.mode !== "reelles";
      construireMenuCompte();
      window.addEventListener("hashchange", App.afficher);
      if (!location.hash || location.hash === "#") location.hash = "/";
      else App.afficher();
    });
  };
  function construireMenuCompte() {
    function ch(id, libelle, act, ic) { return '<button class="choix-compte" data-act="' + act + '">' + (ic || "") + libelle + "</button>"; }
    function themeBtn(v, ic) { return '<button class="' + (theme === v ? "actif" : "") + '" data-act="theme" data-val="' + v + '">' + ic + "</button>"; }
    document.getElementById("menu-compte").innerHTML =
      '<div class="compte-mail">demo@exemple.test</div>' +
      '<div class="compte-ligne"><span>' + ICONES.soleil + 'Thème</span><div class="segment">' + themeBtn("clair", ICONES.soleil) + themeBtn("sombre", ICONES.lune) + themeBtn("systeme", ICONES.ecran) + "</div></div>" +
      '<div class="compte-ligne"><span>' + ICONES.cible + 'Langue</span><select><option>Français</option></select></div>' +
      '<div class="compte-ligne"><span>' + ICONES.stocks + 'Données</span><div class="segment">' +
      '<button class="' + (DonneesTest.mode === "test" ? "actif" : "") + '" data-act="donnees" data-val="test">Test</button>' +
      '<button class="' + (DonneesTest.mode === "reelles" ? "actif" : "") + '" data-act="donnees" data-val="reelles">Réelles</button></div></div>' +
      '<div class="compte-note">' + (DonneesTest.reelDisponible ? "Données réelles du " + E(DonneesTest.recupereLe) : "Pas de données réelles : lancez outils\\Mettre-a-jour-les-donnees.bat") + "</div>" +
      '<div class="compte-ligne"><span>' + ICONES.soleil + 'Météo</span><div class="segment">' +
      '<button class="' + (App.meteoActif() ? "" : "actif") + '" data-act="meteo" data-val="0">Off</button>' +
      '<button class="' + (App.meteoActif() ? "actif" : "") + '" data-act="meteo" data-val="1">On</button></div></div>' +
      (App.meteoActif() ? '<div class="compte-note">Ville : outils\\meteo-lieu.txt (sinon celle du lieu). Mise à jour : Lancer Pop\'IA.bat.</div>' : "") +
      '<a class="choix-compte" href="#/settings/profile">' + ICONES.engrenage + "Réglages</a>" +
      '<a class="choix-compte" href="#/integrations">' + ICONES.options + "Intégrations</a><hr>" +
      '<button class="choix-compte doux" data-act="nondispo">Conditions d\'utilisation</button>' +
      '<button class="choix-compte doux" data-act="nondispo">Politique de confidentialité</button>' +
      '<button class="choix-compte doux" data-act="nondispo">Mentions légales</button><hr>' +
      '<button class="choix-compte" data-act="nondispo">' + ICONES.grille + "Changer d'organisation</button><hr>" +
      '<button class="choix-compte" data-act="nondispo">' + ICONES.liste + "Se déconnecter</button>";
    App.actGlobal.theme = function (v) {
      theme = v; try { localStorage.setItem("theme-copie", v); } catch (e) { /* ignoré */ }
      appliquerTheme(); construireMenuCompte();
      document.getElementById("menu-compte").classList.add("ouvert");
    };
    App.actGlobal.donnees = function (v) {
      if (v === "reelles" && !DonneesTest.reelDisponible) { App.info("Aucune donnée réelle : lancez outils\\Mettre-a-jour-les-donnees.bat."); return; }
      try { localStorage.setItem("donnees-copie", v); } catch (e) { App.info("Stockage du navigateur indisponible."); return; }
      location.reload();
    };
    App.actGlobal.meteo = function (v) {
      try { localStorage.setItem("meteo-copie", v); } catch (e) { App.info("Stockage du navigateur indisponible."); return; }
      location.reload();
    };
    App.actGlobal.nondispo = App.nonDispo;
  }
})();
