/*
 * ecrans-chatbot.js : assistant de discussion (bouton en bas à droite).
 * Il comprend des demandes en français (période, jour, heure, type de graphique)
 * et répond avec les mêmes fonctions de DonneesTest que les écrans : graphiques,
 * chiffres, tableaux, export CSV, ouverture d'un rapport.
 * C'est un analyseur de phrases local (aucun appel réseau, aucune IA en ligne).
 */
(function () {
  "use strict";

  var D = window.DonneesTest, G = App.graph, E = App.echapper;
  var COULEURS = ["#4e79a7", "#f28e2b", "#59a14f", "#e15759", "#76b7b2", "#edc948", "#b07aa1", "#ff9da7", "#9c755f", "#bab0ac"];
  var JOURS_NOMS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  var MOIS_NOMS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];
  var SUGGESTIONS = [
    "Chiffre d'affaires des 30 derniers jours",
    "Top 10 des produits ce mois-ci",
    "Paiements d'hier en camembert",
    "Compare ce mois et le mois dernier",
    "Affluence par heure le samedi",
    "Ventes par catégorie la semaine dernière"
  ];
  var ROUTES_RAPPORT = {
    ca: "/reports/dashboard", produits: "/reports/sales-report/products", categories: "/reports/sales-report/categories",
    paiements: "/reports/sales-report/payments", employes: "/reports/sales-report/employees", heures: "/reports/sales-report/sales-distribution",
    creneaux: "/reports/sales-report/sales-distribution", jours: "/reports/sales-report/sales-distribution"
  };
  var NAVIGATION = [
    ["tableau de bord|accueil|dashboard", "/reports/dashboard", "le tableau de bord"],
    ["rapport.*produit", "/reports/sales-report/products", "le rapport des produits"],
    ["rapport.*employe", "/reports/sales-report/employees", "le rapport des employés"],
    ["annulation", "/reports/sales-report/cancelation", "les annulations"],
    ["perte", "/reports/sales-report/losses", "les pertes"],
    ["remise", "/reports/sales-report/discounts", "les remises"],
    ["taxe|tva", "/reports/sales-report/taxes", "les taxes"],
    ["paiement", "/reports/sales-report/payments", "les paiements"],
    ["categorie", "/reports/sales-report/categories", "les catégories"],
    ["repartition", "/reports/sales-report/sales-distribution", "le taux de répartition"],
    ["menu", "/reports/sales-report/menus", "les menus"],
    ["historique|z de caisse|caisses", "/reports/sales-report/z-report", "l'historique des caisses"],
    ["fiscal", "/reports/sales-report/fiscal", "le fiscal"],
    ["prevision|meteo", "/reports/forecast", "les prévisions météo"],
    ["stock", "/reports/stocks", "les stocks"],
    ["bon cadeau|bons", "/customers/vouchers", "les bons cadeaux"],
    ["client", "/customers", "les clients"],
    ["produit", "/point-of-sale/products-list", "la liste des produits"],
    ["employe", "/point-of-sale/employees", "les employés"],
    ["salle", "/point-of-sale/rooms", "les salles"],
    ["imprimante", "/point-of-sale/settings/printers", "les imprimantes"]
  ];
  var MOTS_VIDES = ["plat", "plats", "boisson", "boissons", "article", "articles", "produit", "produits", "vendu", "vendus", "vendue", "vendues", "semaine", "mois", "jour", "jours", "derniers", "dernier", "combien", "hier", "ventes", "vente", "quantite", "nombre", "pour", "dans", "avec", "tous", "toutes", "cette", "meilleurs", "meilleur", "moins", "plus", "carte", "mois-ci", "top"];

  var reponses = [];        // réponses déjà affichées (pour les boutons CSV / ouvrir)
  var dernier = null;       // { intention, q } : sert aux questions de suite (« et le mois dernier ? »)
  var fil, panneau, champ;

  // ======================================================================
  // Analyse de la phrase
  // ======================================================================
  function norm(s) {
    return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’]/g, "'");
  }
  function deux(n) { return ("0" + n).slice(-2); }
  function iso(d) { return App.jourIso(d); }
  function plus(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function aujourdhui() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
  function plage(a, b) {
    var auj = aujourdhui();
    if (b > auj) b = auj;               // pas de futur : les jours à venir n'ont pas de ventes
    if (a > b) a = b;
    return { dateStart: iso(a), dateEnd: iso(b) };
  }
  function lundiDe(d) { return plus(d, -((d.getDay() + 6) % 7)); }
  function hm(n) { return n >= 1440 ? "24:00" : deux(Math.floor(n / 60)) + ":" + deux(n % 60); }
  function enMin(s) { var x = String(s).split(":"); return (+x[0]) * 60 + (+x[1] || 0); }

  // Renvoie une plage de dates ou null si la phrase n'en contient pas
  function lirePeriode(t) {
    var a = aujourdhui(), m, i, n;
    if (/avant-hier/.test(t)) return plage(plus(a, -2), plus(a, -2));
    if (/\bhier\b/.test(t)) return plage(plus(a, -1), plus(a, -1));
    if (/aujourd/.test(t)) return plage(a, a);
    m = /(\d+)\s*(?:derniers?|dernieres?)?\s*(jour|semaine|mois)s?\b/.exec(t);
    if (m) {
      n = Math.min(+m[1], 400);
      if (m[2] === "jour") return plage(plus(a, -(n - 1)), a);
      if (m[2] === "semaine") return plage(plus(a, -(n * 7 - 1)), a);
      return plage(plus(new Date(a.getFullYear(), a.getMonth() - n, a.getDate()), 1), a);
    }
    if (/semaine (derniere|precedente|passee)/.test(t)) { n = plus(lundiDe(a), -7); return plage(n, plus(n, 6)); }
    if (/(cette|la) semaine|semaine en cours/.test(t)) return plage(lundiDe(a), plus(lundiDe(a), 6));
    if (/mois (dernier|precedent|passe)/.test(t)) return plage(new Date(a.getFullYear(), a.getMonth() - 1, 1), new Date(a.getFullYear(), a.getMonth(), 0));
    if (/(ce|le) mois|mois en cours/.test(t)) return plage(new Date(a.getFullYear(), a.getMonth(), 1), new Date(a.getFullYear(), a.getMonth() + 1, 0));
    if (/annee (derniere|precedente|passee)/.test(t)) return plage(new Date(a.getFullYear() - 1, 0, 1), new Date(a.getFullYear() - 1, 11, 31));
    if (/(cette|l') ?annee|annee en cours/.test(t)) return plage(new Date(a.getFullYear(), 0, 1), a);
    for (i = 0; i < 12; i++) {
      m = new RegExp("\\b" + MOIS_NOMS[i] + "\\b(?:\\s+(20\\d\\d))?").exec(t);
      if (m) {
        var an = m[1] ? +m[1] : (i > a.getMonth() ? a.getFullYear() - 1 : a.getFullYear());
        return plage(new Date(an, i, 1), new Date(an, i + 1, 0));
      }
    }
    m = /\ben (20\d\d)\b/.exec(t);
    if (m) return plage(new Date(+m[1], 0, 1), new Date(+m[1], 11, 31));
    return null;
  }

  // Jours de la semaine et plage horaire demandés
  function lireTranche(t) {
    var r = { jours: null, h1: null, h2: null }, m, cren = D.getCreneaux();
    JOURS_NOMS.forEach(function (nom, i) {
      if (new RegExp("\\b" + nom + "s?\\b").test(t)) (r.jours = r.jours || []).push(i);
    });
    m = /(?:entre|de)\s*(\d{1,2})\s*h\s*(\d{2})?\s*(?:et|a|jusqu'a)\s*(\d{1,2})\s*h?\s*(\d{2})?/.exec(t);
    if (m) {
      r.h1 = (+m[1]) * 60 + (+m[2] || 0); r.h2 = (+m[3]) * 60 + (+m[4] || 0);
      if (r.h2 <= r.h1) r.h2 = 1440;
    } else if (/apres-midi|gouter|limonade/.test(t)) { r.h1 = enMin(cren[1].debut); r.h2 = enMin(cren[1].fin); }
    else if (/\bmidi\b|dejeuner/.test(t)) { r.h1 = enMin(cren[0].debut); r.h2 = enMin(cren[0].fin); }
    else if (/\bsoir\b|diner/.test(t)) { r.h1 = enMin(cren[cren.length - 1].debut); r.h2 = 1440; }
    return r;
  }

  function lireType(t) {
    if (/camembert|donut|secteur|parts?\b/.test(t)) return "donut";
    if (/courbe|ligne|evolution graphique/.test(t)) return "courbe";
    if (/histogramme|barres?|batons?/.test(t)) return "barres";
    if (/tableau|liste/.test(t)) return "tableau";
    return null;
  }

  function lireIntention(t) {
    if (/^(bonjour|salut|hello|coucou|bonsoir)/.test(t)) return "salut";
    if (/^(merci|super|parfait|top merci)/.test(t)) return "merci";
    if (/\b(aide|help|que sais|que peux|quoi faire|exemples?)\b/.test(t)) return "aide";
    if (/\b(ouvre|ouvrir|aller|va sur|va a|emmene|naviguer|accede)\b/.test(t)) return "nav";
    if (/compar|versus|\bvs\b|par rapport/.test(t)) return "comparer";
    if (/export|csv|telecharg/.test(t)) return "export";
    if (/categorie/.test(t)) return "categories";
    if (/paiement|reglement|encaiss|moyens? de pay|\bcb\b|especes|carte bancaire|ticket resto/.test(t)) return "paiements";
    if (/employe|serveur|serveuse|vendeur|equipe|personnel|barman/.test(t)) return "employes";
    if (/jours? de la semaine|quel jour|meilleur jour|jour le plus|par jour de semaine/.test(t)) return "jours";
    if (/creneau|service/.test(t)) return "creneaux";
    if (/\bheures?\b|affluence|tranche|plage horaire|rush|\bpics?\b/.test(t)) return "heures";
    if (/produit|plat|boisson|article|best.?seller|vendu|top \d+/.test(t)) return "produits";
    if (/chiffre|\bca\b|vente|recette|evolution|courbe|tendance|total|revenu|ticket moyen|panier|couvert|commande|combien/.test(t)) return "ca";
    return null;
  }

  function analyser(t) {
    var q = { intention: lireIntention(t), type: lireType(t), n: 10, nExplicite: false, asc: false, quantite: false, texte: t };
    var per = lirePeriode(t), tr = lireTranche(t), m;
    q.pExplicite = !!per;
    q.p = per || plage(plus(aujourdhui(), -29), aujourdhui());
    if (q.intention === "jours") tr.jours = null;     // « par jour de la semaine » ne filtre pas un jour
    q.jours = tr.jours; q.h1 = tr.h1; q.h2 = tr.h2;
    m = /(?:top|les|meilleurs?)\s*(\d+)/.exec(t);
    if (m) { q.n = Math.max(1, Math.min(+m[1], 50)); q.nExplicite = true; }
    if (/moins vendu|pire|moins bien|derniers? produits/.test(t)) q.asc = true;
    if (/quantite|nombre de|unites|combien de|pieces/.test(t)) q.quantite = true;
    return q;
  }

  function fusion(ancien, nouveau) {
    var q = {}, k;
    for (k in ancien) q[k] = ancien[k];
    if (nouveau.pExplicite) { q.p = nouveau.p; q.pExplicite = true; }
    if (nouveau.jours) q.jours = nouveau.jours;
    if (nouveau.h1 != null) { q.h1 = nouveau.h1; q.h2 = nouveau.h2; }
    if (nouveau.type) q.type = nouveau.type;
    if (nouveau.nExplicite) { q.n = nouveau.n; q.nExplicite = true; }
    return q;
  }

  // ======================================================================
  // Textes et paramètres communs
  // ======================================================================
  function libelleDates(p) {
    return p.dateStart === p.dateEnd ? App.dateLongue(p.dateStart).toLowerCase() : "du " + App.dateCourte(p.dateStart) + " au " + App.dateCourte(p.dateEnd);
  }
  function libelleContexte(q) {
    var s = libelleDates(q.p);
    if (!q.pExplicite) s += " (30 derniers jours par défaut)";
    if (q.jours) s += ", " + q.jours.map(function (j) { return JOURS_NOMS[j] + "s"; }).join("/");
    if (q.h1 != null) s += ", de " + hm(q.h1) + " à " + hm(q.h2);
    return s;
  }
  function parametres(q) {
    var p = { dateStart: q.p.dateStart, dateEnd: q.p.dateEnd };
    if (q.jours) p.jours = q.jours;
    if (q.h1 != null) { p.h1 = q.h1; p.h2 = q.h2; }
    return p;
  }
  function somme(t) { var s = 0; t.forEach(function (v) { s += v; }); return s; }
  function arrondi(n) { return Math.round(n * 100) / 100; }
  function pctDe(v, tot) { return tot ? App.pct(v / tot * 100) : "-"; }

  // ======================================================================
  // Rendu des graphiques (dans une bulle)
  // ======================================================================
  function histoH(labels, valeurs, fmt) {
    var max = Math.max.apply(null, valeurs.concat([1])), h = "";
    labels.forEach(function (l, i) {
      h += '<div class="chat-hb"><span class="chat-hb-l" title="' + E(l) + '">' + E(l) + '</span><span class="chat-hb-b"><i style="width:' +
        Math.max(2, valeurs[i] / max * 100) + "%;background:" + COULEURS[i % COULEURS.length] + '"></i></span><span class="chat-hb-v">' + E(fmt(valeurs[i])) + "</span></div>";
    });
    return '<div class="chat-hbs">' + h + "</div>";
  }
  function camembert(labels, valeurs, fmt) {
    var L = [], V = [], i, tot, a0 = -Math.PI / 2, h = "", lg = "", r = 44, cx = 60, cy = 60;
    for (i = 0; i < labels.length; i++) if (valeurs[i] > 0) { L.push(labels[i]); V.push(valeurs[i]); }
    if (L.length > 7) { var reste = somme(V.slice(7)); L = L.slice(0, 7).concat(["Autres"]); V = V.slice(0, 7).concat([reste]); }
    tot = somme(V);
    if (!tot) return "";
    for (i = 0; i < L.length; i++) {
      var f = V[i] / tot, a1 = a0 + f * 2 * Math.PI, c = COULEURS[i % COULEURS.length];
      if (f >= 0.9999) h += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + c + '" stroke-width="22"/>';
      else h += '<path d="M' + (cx + r * Math.cos(a0)).toFixed(2) + "," + (cy + r * Math.sin(a0)).toFixed(2) + " A" + r + "," + r + " 0 " + (f > 0.5 ? 1 : 0) + " 1 " +
        (cx + r * Math.cos(a1)).toFixed(2) + "," + (cy + r * Math.sin(a1)).toFixed(2) + '" fill="none" stroke="' + c + '" stroke-width="22"><title>' + E(L[i]) + "</title></path>";
      lg += '<li><i style="background:' + c + '"></i><span>' + E(L[i]) + "</span><b>" + E(fmt(V[i])) + "</b><em>" + pctDe(V[i], tot) + "</em></li>";
      a0 = a1;
    }
    return '<div class="chat-donut"><svg viewBox="0 0 120 120" aria-hidden="true">' + h + '</svg><ul class="chat-legende">' + lg + "</ul></div>";
  }
  // type : courbe | barres | hbarres | donut | tableau. « liste » = valeurs classées (libellés longs), sinon série ordonnée.
  function graphique(g) {
    var type = g.type, fmt = g.fmt;
    if (type === "tableau") return "";
    if (type === "barres" && g.liste) type = "hbarres";
    if (type === "hbarres" && !g.liste) type = "barres";
    if (type === "donut") return camembert(g.labels, g.valeurs, fmt);
    if (type === "hbarres") return histoH(g.labels.slice(0, 15), g.valeurs.slice(0, 15), fmt) + (g.labels.length > 15 ? '<p class="chat-note">15 premiers sur ' + g.labels.length + " (voir le tableau).</p>" : "");
    if (type === "barres" && g.labels.length <= 31) return G.barres({ labels: g.labels, valeurs: g.valeurs, couleur: COULEURS[0], hauteur: 260 });
    return G.courbe({ labels: g.labels, series: [{ valeurs: g.valeurs, couleur: COULEURS[0] }], hauteur: 260 });
  }
  function tableHtml(entetes, lignes) {
    return '<details class="chat-det"><summary>Voir le tableau</summary><table><thead><tr>' + entetes.map(function (e) { return "<th>" + E(e) + "</th>"; }).join("") +
      "</tr></thead><tbody>" + lignes.map(function (l) { return "<tr>" + l.map(function (c) { return "<td>" + E(c) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></details>";
  }
  function tuiles(kpis) {
    return '<div class="chat-kpis">' + kpis.map(function (k) { return '<div><span>' + E(k[0]) + "</span><b>" + E(k[1]) + "</b></div>"; }).join("") + "</div>";
  }

  // ======================================================================
  // Réponses : liste classée (produits, catégories, paiements, employés...)
  // ======================================================================
  function reponseListe(q, o) {
    var tot = somme(o.valeurs), fmt = o.unite === "€" ? App.euro : App.entier;
    if (!o.labels.length || !tot) return vide(q);
    var type = q.type || o.typeDefaut;
    var head = o.intro + " (" + libelleContexte(q) + ")";
    var lignes = o.labels.map(function (l, i) { return [l, o.unite === "€" ? App.euro(o.valeurs[i]) : App.entier(o.valeurs[i]), pctDe(o.valeurs[i], tot)]; });
    lignes.push(["Total", fmt(tot), "100 %"]);
    var csvLignes = o.labels.map(function (l, i) { return [l, o.unite === "€" ? App.montantCsv(o.valeurs[i]) : o.valeurs[i]]; });
    return {
      texte: head + ". " + (o.phrase ? o.phrase(fmt, tot) : "En tête : " + o.labels[0] + " avec " + fmt(o.valeurs[0]) + " (" + pctDe(o.valeurs[0], tot) + ")."),
      graph: { type: type, labels: o.labels, valeurs: o.valeurs, fmt: fmt, liste: o.liste !== false },
      table: { entetes: [o.colonne, o.unite === "€" ? "Montant TTC" : "Quantité", "Part"], lignes: lignes },
      csv: { nom: o.csv + ".csv", entetes: [o.colonne, o.unite === "€" ? "Montant TTC" : "Quantité"], lignes: csvLignes },
      rapport: o.rapport
    };
  }
  function vide(q) {
    return { texte: "Aucune vente trouvée pour " + libelleContexte(q) + ". Essayez une autre période ou retirez le filtre de jour ou d'heure." };
  }

  function hProduits(q, strict) {
    return D.getReportProductsAndCategories(parametres(q)).then(function (r) {
      var liste = r.products.slice(), filtre = null, jetons = [];
      q.texte.replace(/[^a-z0-9' -]/g, " ").split(/[\s']+/).forEach(function (w) {
        if (w.length >= 4 && MOTS_VIDES.indexOf(w) < 0 && !/^\d+$/.test(w)) jetons.push(w.replace(/s$/, ""));
      });
      var cible = liste.filter(function (p) {
        var nom = norm(p.name);
        return jetons.some(function (w) { return nom.indexOf(w) >= 0; });
      });
      if (cible.length) { liste = cible; filtre = jetons.filter(function (w) { return cible.some(function (p) { return norm(p.name).indexOf(w) >= 0; }); }).join(", "); }
      else if (strict) return null;
      var cle = q.quantite ? "productQuantity" : "productSales";
      liste.sort(function (a, b) { return q.asc ? a[cle] - b[cle] : b[cle] - a[cle]; });
      liste = liste.slice(0, q.n);
      var rep = reponseListe(q, {
        intro: (filtre ? "Ventes de « " + filtre + " »" : (q.asc ? "Produits les moins vendus" : "Top " + liste.length + " des produits")) + (q.quantite ? " en quantité" : ""),
        labels: liste.map(function (p) { return p.name; }), valeurs: liste.map(function (p) { return p[cle]; }),
        unite: q.quantite ? "u" : "€", typeDefaut: "hbarres", colonne: "Produit", csv: "produits", rapport: "produits"
      });
      return rep;
    });
  }
  function hCategories(q) {
    return D.getReportProductsAndCategories(parametres(q)).then(function (r) {
      var cle = q.quantite ? "productQuantity" : "productSales";
      return reponseListe(q, {
        intro: "Ventes par catégorie", labels: r.categories.map(function (c) { return c.category; }), valeurs: r.categories.map(function (c) { return c[cle]; }),
        unite: q.quantite ? "u" : "€", typeDefaut: "donut", colonne: "Catégorie", csv: "categories", rapport: "categories"
      });
    });
  }
  function hPaiements(q) {
    return D.getReportPaymentMode(parametres(q)).then(function (l) {
      return reponseListe(q, {
        intro: "Répartition des paiements", labels: l.map(function (x) { return x.paymentName; }), valeurs: l.map(function (x) { return x.paymentModeSum; }),
        unite: "€", typeDefaut: "donut", colonne: "Mode de paiement", csv: "paiements", rapport: "paiements"
      });
    });
  }
  function hEmployes(q) {
    return D.getReportClerkShifts(parametres(q)).then(function (l) {
      return reponseListe(q, {
        intro: "Ventes par employé", labels: l.map(function (x) { return x.name; }), valeurs: l.map(function (x) { return x.totalSalesOwner; }),
        unite: "€", typeDefaut: "hbarres", colonne: "Employé", csv: "employes", rapport: "employes"
      });
    });
  }
  function montantsDe(o) { var s = 0, k; for (k in o.valeurs) s += o.valeurs[k]; return arrondi(s); }
  function hHeures(q) {
    return D.getSalesDistribution(parametres(q)).then(function (r) {
      var labels = r.parTranche.map(function (x) { return x.slot; }), valeurs = r.parTranche.map(montantsDe), imax = valeurs.indexOf(Math.max.apply(null, valeurs.concat([0])));
      var rep = reponseListe(q, {
        intro: "Ventes par heure", labels: labels, valeurs: valeurs, unite: "€", typeDefaut: "barres", liste: false, colonne: "Heure", csv: "heures", rapport: "heures",
        phrase: function (fmt) { return "Pic d'activité à " + labels[imax] + " (" + fmt(valeurs[imax]) + ")."; }
      });
      return rep;
    });
  }
  function hCreneaux(q) {
    return D.getSalesDistribution(parametres(q)).then(function (r) {
      var lignes = r.parCreneau.filter(function (x) { return montantsDe(x) > 0; });
      return reponseListe(q, {
        intro: "Ventes par créneau de service", labels: lignes.map(function (x) { return x.slot + (x.horaire ? " (" + x.horaire + ")" : ""); }),
        valeurs: lignes.map(montantsDe), unite: "€", typeDefaut: "donut", colonne: "Créneau", csv: "creneaux", rapport: "creneaux"
      });
    });
  }
  function hJours(q) {
    return D.getSalesDistribution(parametres(q)).then(function (r) {
      var j = r.parJour, valeurs = j.map(montantsDe), imax = valeurs.indexOf(Math.max.apply(null, valeurs.concat([0])));
      return reponseListe(q, {
        intro: "Ventes par jour de la semaine", labels: j.map(function (x) { return x.day; }), valeurs: valeurs, unite: "€", typeDefaut: "barres", liste: false,
        colonne: "Jour", csv: "jours-semaine", rapport: "jours",
        phrase: function (fmt) { return "Meilleur jour : " + j[imax].day.toLowerCase() + " (" + fmt(valeurs[imax]) + ", " + j[imax].nbSessions + " service(s))."; }
      });
    });
  }

  // ======================================================================
  // Réponses : chiffre d'affaires dans le temps, comparaison
  // ======================================================================
  // Regroupe les jours en semaines ou en mois quand la période est longue
  function serie(jours) {
    var n = jours.length, labels = [], valeurs = [], idx = {}, i, d, cle, lib;
    if (n <= 92) {
      jours.forEach(function (j) { labels.push(App.dateCourte(j.date).slice(0, 5)); valeurs.push(j.totalSales); });
      return { labels: labels, valeurs: valeurs, pas: "jour" };
    }
    var mois = n > 200;
    for (i = 0; i < n; i++) {
      d = App.depuisIso(jours[i].date);
      cle = mois ? jours[i].date.slice(0, 7) : iso(lundiDe(d));
      lib = mois ? deux(d.getMonth() + 1) + "/" + String(d.getFullYear()).slice(2) : App.dateCourte(cle).slice(0, 5);
      if (idx[cle] === undefined) { idx[cle] = labels.length; labels.push(lib); valeurs.push(0); }
      valeurs[idx[cle]] += jours[i].totalSales;
    }
    return { labels: labels, valeurs: valeurs.map(arrondi), pas: mois ? "mois" : "semaine" };
  }

  function kpisDe(r) {
    return [
      ["CA TTC", App.euro(r.totalSales)], ["CA HT", App.euro(r.totalSalesWithoutTaxes)], ["Commandes", App.entier(r.orderCount)],
      ["Couverts", App.entier(r.guestsNumber)], ["Ticket moyen", App.euro(r.orderCount ? r.totalSales / r.orderCount : 0)], ["CA / couvert", App.euro(r.averageGuest)]
    ];
  }

  function hCa(q) {
    return D.getReportTotalSales(parametres(q)).then(function (r) {
      if (!r.orderCount) return vide(q);
      var s = serie(r.reportFromPeriod), jours = r.reportFromPeriod, best = null;
      jours.forEach(function (j) { if (!best || j.totalSales > best.totalSales) best = j; });
      var moy = r.joursOuverts ? r.totalSales / r.joursOuverts : 0;
      var type = q.type || (s.labels.length <= 14 && s.pas === "jour" ? "barres" : "courbe");
      var lignes = s.labels.map(function (l, i) { return [l, App.euro(s.valeurs[i])]; });
      return {
        texte: "Chiffre d'affaires TTC : " + App.euro(r.totalSales) + " (" + libelleContexte(q) + "), soit " + App.euro(moy) + " par jour ouvert. Meilleur jour : " +
          App.dateLongue(best.date).toLowerCase() + " (" + App.euro(best.totalSales) + ").",
        kpis: kpisDe(r),
        graph: { type: type, labels: s.labels, valeurs: s.valeurs, fmt: App.euro, liste: false },
        table: { entetes: [s.pas === "jour" ? "Jour" : (s.pas === "mois" ? "Mois" : "Semaine du"), "CA TTC"], lignes: lignes },
        csv: { nom: "chiffre-affaires.csv", entetes: [s.pas, "CA TTC"], lignes: s.labels.map(function (l, i) { return [l, App.montantCsv(s.valeurs[i])]; }) },
        rapport: "ca"
      };
    });
  }

  // « compare X et Y » : deux périodes, tableau d'écarts + deux courbes superposées (jour 1, jour 2...)
  function hComparer(q) {
    var t = q.texte, morceaux = t.split(/\bet\b|\bvs\b|\bversus\b|\bcontre\b|\bpar rapport (?:a|au|aux)\b|\bavec\b/), pa = null, pb = null, i, x;
    for (i = 0; i < morceaux.length; i++) {
      x = lirePeriode(morceaux[i]);
      if (x && !pa) pa = x; else if (x && !pb) pb = x;
    }
    if (!pa) return Promise.resolve({ texte: "Quelles périodes comparer ? Par exemple : « compare ce mois et le mois dernier » ou « compare septembre et octobre ».", suggestions: true });
    if (!pb) pb = App.decalerPeriode(pa, -1);
    var tr = { jours: q.jours, h1: q.h1, h2: q.h2 };
    function avec(p) { var o = { dateStart: p.dateStart, dateEnd: p.dateEnd }; if (tr.jours) o.jours = tr.jours; if (tr.h1 != null) { o.h1 = tr.h1; o.h2 = tr.h2; } return o; }
    return Promise.all([D.getReportTotalSales(avec(pa)), D.getReportTotalSales(avec(pb))]).then(function (rs) {
      var A = rs[0], B = rs[1], la = libelleDates(pa), lb = libelleDates(pb);
      var defs = [
        ["CA TTC", A.totalSales, B.totalSales, true], ["CA HT", A.totalSalesWithoutTaxes, B.totalSalesWithoutTaxes, true],
        ["Commandes", A.orderCount, B.orderCount, false], ["Couverts", A.guestsNumber, B.guestsNumber, false],
        ["Ticket moyen", A.orderCount ? A.totalSales / A.orderCount : 0, B.orderCount ? B.totalSales / B.orderCount : 0, true]
      ];
      var lignes = defs.map(function (d) {
        var ecart = d[2] ? (d[1] - d[2]) / d[2] * 100 : null;
        return [d[0], d[3] ? App.euro(d[1]) : App.entier(d[1]), d[3] ? App.euro(d[2]) : App.entier(d[2]), ecart === null ? "-" : (ecart > 0 ? "+" : "") + App.decimal(ecart) + " %"];
      });
      var ca = defs[0], ecartCa = ca[2] ? (ca[1] - ca[2]) / ca[2] * 100 : null;
      var ja = A.reportFromPeriod.map(function (j) { return j.totalSales; }), jb = B.reportFromPeriod.map(function (j) { return j.totalSales; });
      var n = Math.max(ja.length, jb.length), labels = [], k;
      for (k = 0; k < n; k++) labels.push("J" + (k + 1));
      function cal(a) { var o = []; for (k = 0; k < n; k++) o.push(a[k] === undefined ? null : a[k]); return o; }
      return {
        texte: "Comparaison : " + la + " contre " + lb + ". CA TTC " + App.euro(ca[1]) + " contre " + App.euro(ca[2]) +
          (ecartCa === null ? "." : " (" + (ecartCa > 0 ? "+" : "") + App.decimal(ecartCa) + " %)."),
        courbes: { labels: labels, series: [{ nom: la, valeurs: cal(ja), couleur: COULEURS[0] }, { nom: lb, valeurs: cal(jb), couleur: COULEURS[1], tirets: true }] },
        table: { entetes: ["Indicateur", la, lb, "Écart"], lignes: lignes, ouvert: true },
        csv: { nom: "comparaison.csv", entetes: ["Indicateur", la, lb, "Écart"], lignes: lignes }
      };
    });
  }

  // ======================================================================
  // Navigation, aide, export
  // ======================================================================
  function hNav(q) {
    var i, cible = null;
    for (i = 0; i < NAVIGATION.length; i++) if (new RegExp(NAVIGATION[i][0]).test(q.texte)) { cible = NAVIGATION[i]; break; }
    if (!cible) return Promise.resolve({ texte: "Quelle page ouvrir ? Par exemple : « ouvre les paiements d'hier » ou « va sur le tableau de bord ».", suggestions: true });
    allerA(cible[1], q);
    return Promise.resolve({ texte: "J'ouvre " + cible[2] + "." });
  }
  function allerA(route, q) {
    var params = {};
    if (route.indexOf("/reports/") === 0 && route !== "/reports/stocks") {
      params.dateStart = q.p.dateStart; params.dateEnd = q.p.dateEnd;
      if (route !== "/reports/forecast") {
        if (q.jours) params.jours = q.jours.join(",");
        if (q.h1 != null) { params.de = hm(q.h1); params.a = hm(q.h2 >= 1440 ? 1439 : q.h2); }
      }
    }
    App.allerA(route, params);
  }
  function hAide() {
    return Promise.resolve({
      texte: "Je réponds à partir des rapports de l'application. Je comprends une période (hier, cette semaine, le mois dernier, 14 derniers jours, septembre…), un jour (« le samedi »), une heure (« le soir », « de 18h à 22h ») " +
        "et un type de graphique (courbe, barres, camembert, tableau). Je sais sortir : chiffre d'affaires, produits (top ou moins vendus, un produit précis), catégories, paiements, employés, ventes par heure / jour / créneau, " +
        "comparer deux périodes, exporter en CSV et ouvrir un rapport. Après une réponse, vous pouvez enchaîner : « et le mois dernier ? », « en camembert ».",
      suggestions: true
    });
  }
  function hExport() {
    var r = null, i;
    for (i = reponses.length - 1; i >= 0 && !r; i--) if (reponses[i].csv) r = reponses[i];
    if (!r) return Promise.resolve({ texte: "Rien à exporter pour l'instant : demandez d'abord un graphique ou un classement." });
    App.telechargerCsv(r.csv.nom, r.csv.entetes, r.csv.lignes);
    return Promise.resolve({ texte: "Export CSV lancé : " + r.csv.nom + "." });
  }
  function repliInconnu() {
    return { texte: "Je n'ai pas compris cette demande. Je sais faire des graphiques et des chiffres sur les ventes. Essayez par exemple :", suggestions: true };
  }

  var MANIERES = {
    ca: hCa, produits: hProduits, categories: hCategories, paiements: hPaiements, employes: hEmployes, heures: hHeures,
    creneaux: hCreneaux, jours: hJours, comparer: hComparer, nav: hNav, aide: hAide, export: hExport
  };

  // ======================================================================
  // Interface : bulles, saisie
  // ======================================================================
  function defiler() { fil.scrollTop = fil.scrollHeight; }
  function bulleUtilisateur(texte) {
    var d = document.createElement("div");
    d.className = "chat-msg chat-moi"; d.textContent = texte;
    fil.appendChild(d); defiler();
  }
  function chips() {
    return '<div class="chat-chips">' + SUGGESTIONS.map(function (s) { return '<button type="button" data-chat="suggestion">' + E(s) + "</button>"; }).join("") + "</div>";
  }
  function bulleAssistant(rep) {
    var d = document.createElement("div"), h = "", i;
    d.className = "chat-msg chat-lui";
    h += "<p>" + E(rep.texte) + "</p>";
    if (rep.kpis) h += tuiles(rep.kpis);
    if (rep.graph) h += graphique(rep.graph);
    if (rep.courbes) h += G.courbe({ labels: rep.courbes.labels, series: rep.courbes.series, hauteur: 260 }) + G.legende(rep.courbes.series.map(function (s) { return { nom: s.nom, couleur: s.couleur }; }));
    if (rep.table) h += tableHtml(rep.table.entetes, rep.table.lignes).replace("<details", rep.table.ouvert || (rep.graph && rep.graph.type === "tableau") ? "<details open" : "<details");
    if (rep.csv || rep.rapport) {
      i = reponses.push(rep) - 1;
      h += '<div class="chat-actions">' + (rep.csv ? '<button type="button" class="bouton" data-chat="csv" data-i="' + i + '">Exporter en CSV</button>' : "") +
        (rep.rapport ? '<button type="button" class="bouton" data-chat="ouvrir" data-i="' + i + '">Ouvrir le rapport</button>' : "") + "</div>";
    }
    if (rep.suggestions) h += chips();
    d.innerHTML = h;
    fil.appendChild(d); defiler();
  }

  function repondre(texte) {
    var t = norm(texte).trim(), q, intention, attente, suite;
    if (!t) return;
    bulleUtilisateur(texte);
    q = analyser(t);
    intention = q.intention;
    // Question de suite : « et le mois dernier ? », « en camembert », « seulement le soir »
    if (!intention && dernier && (q.pExplicite || q.jours || q.h1 != null || q.type || q.nExplicite)) {
      q = fusion(dernier.q, q); q.texte = t; intention = dernier.intention;
    }
    attente = document.createElement("div");
    attente.className = "chat-msg chat-lui chat-attente"; attente.textContent = "…";
    fil.appendChild(attente); defiler();
    if (intention === "salut") suite = Promise.resolve({ texte: "Bonjour ! Que voulez-vous voir ? Un chiffre, un classement, un graphique…", suggestions: true });
    else if (intention === "merci") suite = Promise.resolve({ texte: "Avec plaisir. Une autre demande ?" });
    else if (intention === "ca" && /combien d(e|')/.test(t)) {
      // « combien de mojitos hier ? » : un produit précis plutôt que le chiffre d'affaires global
      suite = hProduits(q, true).then(function (r) { if (r) { intention = "produits"; return r; } return hCa(q); });
    }
    else if (intention) suite = MANIERES[intention](q);
    else suite = hProduits(q, true).then(function (r) { if (r) { intention = "produits"; return r; } return repliInconnu(); });
    suite.then(function (rep) {
      if (attente.parentNode) attente.parentNode.removeChild(attente);
      if (intention && MANIERES[intention] && ["aide", "nav", "export", "comparer"].indexOf(intention) < 0 && rep.graph) dernier = { intention: intention, q: q };
      rep.q = q;
      bulleAssistant(rep);
    }, function () {
      if (attente.parentNode) attente.parentNode.removeChild(attente);
      bulleAssistant({ texte: "Désolé, une erreur est survenue pendant le calcul." });
    });
  }

  function basculer(ouvrir) {
    var ouvert = ouvrir === undefined ? panneau.hidden : ouvrir;
    panneau.hidden = !ouvert;
    document.getElementById("chat-bouton").classList.toggle("ouvert", ouvert);
    if (ouvert) champ.focus();
  }
  function accueil() {
    fil.innerHTML = "";
    bulleAssistant({
      texte: "Bonjour, je suis l'assistant Pop'IA. Demandez-moi un chiffre ou un graphique sur vos ventes, en français : période, jour, heure et type de graphique au choix. Tapez « aide » pour la liste.",
      suggestions: true
    });
  }

  function monter() {
    var bouton = document.createElement("button");
    bouton.id = "chat-bouton"; bouton.type = "button"; bouton.className = "chat-bouton"; bouton.setAttribute("data-chat", "toggle"); bouton.setAttribute("aria-label", "Ouvrir l'assistant");
    bouton.innerHTML = '<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M14 2.5C7.9 2.5 3 7 3 12.7c0 3.2 1.6 6 4 7.8V25l4.6-3.1c.8.2 1.5.3 2.4.3 6.1 0 11-4.5 11-10.2S20.1 2.5 14 2.5z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M14 6.8l1.7 4.5 4.5 1.7-4.5 1.7L14 19.2l-1.7-4.5L7.8 13l4.5-1.7z" fill="currentColor"/></svg>';
    panneau = document.createElement("section");
    panneau.id = "chat-panneau"; panneau.className = "chat-panneau"; panneau.hidden = true;
    panneau.innerHTML = '<header class="chat-tete"><div><b>Assistant Pop\'IA</b><span>Graphiques et chiffres sur demande</span></div>' +
      '<button type="button" data-chat="large" title="Agrandir">⤢</button><button type="button" data-chat="vider" title="Nouvelle conversation">↺</button><button type="button" data-chat="toggle" title="Fermer">✕</button></header>' +
      '<div class="chat-fil" id="chat-fil"></div>' +
      '<form class="chat-saisie" autocomplete="off"><input type="text" id="chat-champ" placeholder="Ex. : top 5 des produits du mois en camembert" aria-label="Votre demande"><button type="submit" class="bouton sombre">Envoyer</button></form>';
    document.body.appendChild(bouton);
    document.body.appendChild(panneau);
    fil = document.getElementById("chat-fil"); champ = document.getElementById("chat-champ");
    panneau.querySelector("form").addEventListener("submit", function (e) {
      e.preventDefault();
      var v = champ.value; champ.value = "";
      repondre(v);
    });
    document.addEventListener("click", function (e) {
      var el = e.target.closest ? e.target.closest("[data-chat]") : null, act, rep;
      if (!el) return;
      act = el.getAttribute("data-chat");
      if (act === "toggle") basculer();
      else if (act === "large") panneau.classList.toggle("large");
      else if (act === "vider") { dernier = null; reponses = []; accueil(); }
      else if (act === "suggestion") repondre(el.textContent);
      else if (act === "csv") { rep = reponses[+el.getAttribute("data-i")]; App.telechargerCsv(rep.csv.nom, rep.csv.entetes, rep.csv.lignes); }
      else if (act === "ouvrir") {
        rep = reponses[+el.getAttribute("data-i")];
        allerA(ROUTES_RAPPORT[rep.rapport], rep.q || analyser(""));
      }
    });
    accueil();
  }

  App.chatbot = { repondre: repondre, ouvrir: function () { basculer(true); } };
  monter();
})();
