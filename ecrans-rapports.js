/*
 * ecrans-rapports.js : écrans de la section « Rapports » (menu Rapports).
 * Les données viennent toutes de DonneesTest.
 */
(function () {
  "use strict";
  var A = App, E = A.echapper, D = DonneesTest;

  function P(ctx) { return A.avecTranche(ctx.periode, ctx.tranche); }
  function exportCsv(label) { return A.bouton(label || "Exporter CSV", "export", { classe: "bouton-export", chevron: true }); }
  function exportPdf() { return A.bouton("Exporter PDF", "pdf", { classe: "bouton-export", chevron: true }); }
  function brancherPdf() { A.act.pdf = function () { window.print(); }; }
  var FIL = function (nom) { return ["Rapports", nom]; };
  var FILTRES = ["periode", "tranche", "sites"];
  var FILTRES_SANS_TRANCHE = ["periode", "sites"]; // écrans calculés depuis les caisses clôturées : pas de découpage par heure
  function d(n) { return { a: "d", t: n }; }

  // ---------- Tableau de bord ----------
  A.ecran("/reports/dashboard", {
    section: "rapports", fil: ["Tableau de bord"],
    filtres: ["periode", "tranche", function (ctx) {
      var et = ctx.etat;
      return A.liste("comparer", "Comparer à", [["prec", "Période précédente"], ["n1", "Même période N-1"]], et.comparer, function (v) { et.comparer = v; ctx.rafraichir(); });
    }, "sites"],
    rendre: function (ctx, zone) {
      var et = ctx.etat, prev = A.avecTranche(et.comparer === "n1" ? A.memePeriodeN1(ctx.periode) : A.decalerPeriode(ctx.periode, -1), ctx.tranche);
      var nomComp = et.comparer === "n1" ? "Même période N-1" : "Période précédente", meteo = A.meteoActif();
      Promise.all([D.getReportTotalSales(P(ctx)), D.getReportProductsAndCategories(P(ctx)), D.getReportClerkShifts(P(ctx)), et.comparer ? D.getReportTotalSales(prev) : Promise.resolve(null),
        meteo ? D.getWeatherDays(P(ctx)) : null, meteo && et.comparer ? D.getWeatherDays(prev) : null, meteo ? A.meteo.carteBandeau() : null]).then(function (res) {
        var ventes = res[0], pc = res[1], emp = res[2], comp = res[3];
        var meteoHtml = meteo ? A.meteo.carte(P(ctx), res[4].jours, res[5] ? res[5].jours : null, nomComp) + res[6] : "";
        var mode = et.mode || "ttc", vue = et.vue || "courbe", auj = A.aujourdhui();
        var jours = ventes.reportFromPeriod;
        function serie(liste, futur) {
          return liste.map(function (j) { return futur && j.date > auj ? null : (mode === "ttc" ? j.totalSales : j.totalSalesWithoutTaxes); });
        }
        var labels = jours.map(function (j) { return ctx.tranche ? j.date.slice(8) + "/" + j.date.slice(5, 7) : +j.date.slice(8); });
        // Tranche active : moyennes par jour retenu (« par lundi »), plus un avertissement quand l'échantillon est mince
        var tr = ctx.tranche, nomJour = tr && A.nomJourTranche(tr), unite = nomJour ? nomJour.replace(/s$/, "") : "jour", ouv = ventes.joursOuverts;
        var htmlTranche = "";
        if (tr) {
          htmlTranche = A.kpis([
            [A.majuscule(nomJour || "jours") + " retenus", A.entier(ventes.occurrences) + (ouv < ventes.occurrences ? " (" + A.entier(ouv) + " avec ventes)" : "")],
            ["CA TTC moyen / " + unite, ouv ? A.euro(ventes.totalSales / ouv) : "-"],
            ["Couverts moyens / " + unite, ouv ? A.decimal(ventes.guestsNumber / ouv) : "-"],
            ["Commandes moy. / " + unite, ouv ? A.decimal(ventes.orderCount / ouv) : "-"]
          ]) + (ouv < 5 ? '<div class="bandeau-factice">Seulement ' + A.entier(ouv) + " " + (nomJour || "jour(s)") + " avec ventes : la moyenne est peu représentative. Élargissez la période.</div>" : "");
        }
        var series = [{ nom: A.libellePeriode(ctx.periode), couleur: "#111", valeurs: serie(jours, true) }];
        if (comp) series.push({ nom: nomComp, couleur: "#999", tirets: true, valeurs: serie(comp.reportFromPeriod.slice(0, jours.length), false) });
        var graphe = vue === "courbe" ? A.graph.courbe({ labels: labels, series: series, hauteur: 300 })
          : A.graph.barres({ labels: labels, valeurs: series[0].valeurs.map(function (v) { return v || 0; }), hauteur: 300, couleur: "#222" });
        var droite = A.segment("dash-mode", [["ttc", "TTC"], ["ht", "HT"]], mode, function (v) { et.mode = v; ctx.rafraichir(); }) +
          A.segment("dash-vue", [["courbe", "∼"], ["barres", "▮▮"]], vue, function (v) { et.vue = v; ctx.rafraichir(); });
        function top(titre, entetes, rangees) { return A.carte(titre, A.table(entetes, rangees, null, { classe: "zebre" })); }
        zone.innerHTML = A.kpis([["Nombre de couverts", A.entier(ventes.guestsNumber)], ["Couverts moyen", A.euro(ventes.averageGuest)], ["Total TTC", A.euro(ventes.totalSales)], ["Total HT", A.euro(ventes.totalSalesWithoutTaxes)]]) + htmlTranche +
          A.carte("Total des ventes", graphe + '<div class="legende"><span><i class="trait" style="background:#111"></i>' + E(A.libellePeriode(ctx.periode)) + '</span>' + (comp ? '<span><i class="trait" style="background:#999"></i>' + E(nomComp) + "</span>" : "") + '<span class="chip">' + ventes.closedTillsCount + " caisses clôturées</span></div>", { droite: droite }) + meteoHtml +
          '<div class="deux-col">' +
          top("Top produits", [{ t: "Produit" }, d("Quantité"), d("Total")], pc.products.slice(0, 5).map(function (p) { return [E(p.name), A.entier(p.productQuantity), A.euro(p.productSales)]; })) +
          top("Top catégories", [{ t: "Catégorie" }, d("Quantité"), d("Total")], pc.categories.slice(0, 5).map(function (p) { return [E(p.category), A.entier(p.productQuantity), A.euro(p.productSales)]; })) + "</div>" +
          '<div class="deux-col">' + top("Top employés", [{ t: "Employé" }, d("Total")], emp.slice(0, 5).map(function (p) { return [E(p.name), A.euro(p.totalSalesOwner)]; })) + "</div>";
      });
    }
  });

  // ---------- Objectifs de CA et de couverts : plusieurs objectifs nommés, chacun sur sa période ----------
  function pct(v, cible) { return cible > 0 ? v / cible * 100 : 0; }
  function nbJours(a, b) { return Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000) + 1; }
  function dateCourte(iso) { return iso.slice(8) + "/" + iso.slice(5, 7) + "/" + iso.slice(2, 4); }
  // Bloc de progression : barre (repère = part attendue à ce jour), réalisé, écart, projection, reste à faire
  function blocObjectif(titre, realise, objectif, attendu, projection, fmt, resteParJour, etat) {
    if (!(objectif > 0)) return "";
    var p = pct(realise, objectif), att = pct(attendu, objectif), ecart = realise - attendu, bon = ecart >= 0, projP = pct(projection, objectif);
    var detail = etat === "avenir" ? "" :
      "<div><span>" + (etat === "fini" ? "Objectif" : "Attendu à ce jour") + "</span><b>" + fmt(etat === "fini" ? objectif : attendu) + "</b></div>" +
      '<div><span>Écart</span><b class="' + (bon ? "vert" : "rouge") + '">' + (bon ? "+" : "-") + fmt(Math.abs(ecart)) + (bon ? " d'avance" : " de retard") + "</b></div>" +
      (etat === "cours" ? '<div><span>Projection fin de période</span><b class="' + (projP >= 100 ? "vert" : "") + '">' + fmt(projection) + " (" + A.entier(Math.round(projP)) + " %)</b></div>" : "") +
      (etat === "cours" && resteParJour != null ? "<div><span>Reste à faire par jour restant</span><b>" + fmt(resteParJour) + "</b></div>" : "");
    return '<div class="obj-bloc"><h4>' + titre + '</h4><div class="obj-haut"><span class="obj-pct ' + (p >= 100 ? "vert" : "") + '">' + A.decimal(p) + " %</span><span class=\"doux\">" + fmt(realise) + " sur " + fmt(objectif) + "</span></div>" +
      '<div class="obj-barre"><i class="' + (bon || etat === "avenir" ? "ok" : "ko") + '" style="width:' + Math.min(100, p) + '%"></i>' + (etat === "cours" ? '<b style="left:' + Math.min(100, att) + '%" title="Attendu à ce jour"></b>' : "") + "</div>" +
      (detail ? '<div class="obj-detail">' + detail + "</div>" : "") + "</div>";
  }
  function carteObjectif(o, v, auj) {
    var base = o.base === "ht" ? "HT" : "TTC";
    if (base === "HT") v = { guestsNumber: v.guestsNumber, totalSales: v.totalSalesWithoutTaxes, reportFromPeriod: v.reportFromPeriod.map(function (j) { return { date: j.date, totalSales: j.totalSalesWithoutTaxes }; }) };
    var jours = v.reportFromPeriod, total = nbJours(o.debut, o.fin);
    var etat = o.fin < auj ? "fini" : o.debut > auj ? "avenir" : "cours";
    var ecoules = etat === "fini" ? total : etat === "avenir" ? 0 : nbJours(o.debut, auj), restants = total - ecoules, part = ecoules / total;
    var projCA = etat === "cours" && ecoules ? v.totalSales / part : v.totalSales, projCV = etat === "cours" && ecoules ? v.guestsNumber / part : v.guestsNumber;
    var resteCA = restants > 0 && o.ca > v.totalSales ? (o.ca - v.totalSales) / restants : null;
    var resteCV = restants > 0 && o.couverts > v.guestsNumber ? (o.couverts - v.guestsNumber) / restants : null;
    var fmtCV = function (n) { return A.entier(Math.round(n)) + " couverts"; };
    var cumul = 0, sr = [], so = [];
    jours.forEach(function (j, i) { cumul += j.totalSales; sr.push(j.date <= auj ? cumul : null); so.push(o.ca * (i + 1) / total); });
    var graphe = o.ca > 0 && etat !== "avenir" && jours.length > 1 ? A.graph.courbe({ labels: jours.map(function (j) { return +j.date.slice(8); }), lisse: false, hauteur: 220,
      series: [{ nom: "Objectif", couleur: "#999", tirets: true, valeurs: so }, { nom: "Réalisé", couleur: "#111", valeurs: sr }] }) +
      '<div class="legende"><span><i class="trait" style="background:#111"></i>CA ' + base + ' réalisé (cumulé)</span><span><i class="trait" style="background:#999"></i>Objectif (réparti sur la période)</span></div>' : "";
    var statut = { cours: ["En cours", "ok"], avenir: ["À venir", ""], fini: [(o.ca ? v.totalSales >= o.ca : v.guestsNumber >= o.couverts) ? "Atteint" : "Non atteint", (o.ca ? v.totalSales >= o.ca : v.guestsNumber >= o.couverts) ? "ok" : "ko"] }[etat];
    var droite = '<span class="badge-bon ' + statut[1] + '">' + statut[0] + "</span>" +
      '<button class="bouton" data-act="obj-edit" data-val="' + E(o.id) + '">Modifier</button><button class="bouton" data-act="obj-del" data-val="' + E(o.id) + '">Supprimer</button>';
    return A.carte(E(o.nom) + ' <span class="doux obj-periode">du ' + dateCourte(o.debut) + " au " + dateCourte(o.fin) + " · " + total + " jour" + (total > 1 ? "s" : "") + (etat === "cours" ? " (" + restants + " restant" + (restants > 1 ? "s" : "") + ")" : "") + "</span>",
      '<div class="deux-col">' + blocObjectif("Chiffre d'affaires " + base, v.totalSales, o.ca, o.ca * part, projCA, A.euro, resteCA, etat) + blocObjectif("Couverts", v.guestsNumber, o.couverts, o.couverts * part, projCV, fmtCV, resteCV, etat) + "</div>" + graphe,
      { droite: droite });
  }
  // Tiroir de création / modification
  function formulaireObjectif(o, apres) {
    var t = A.tiroir(""), mois = A.periodeMois(), suivant = A.decalerPeriode(mois, 1);
    function val(id) { return document.getElementById(id).value; }
    t.innerHTML = '<div class="tiroir-tete"><div><h3>' + (o.id ? "Modifier l'objectif" : "Nouvel objectif") + '</h3></div><button class="fermer" data-fermer>✕</button></div>' +
      '<div class="tiroir-corps"><div class="stk-form">' +
      '<label>Nom<input id="ob-nom" type="text" maxlength="60" placeholder="ex. Objectif été, Noël..."></label>' +
      '<label>Début<input id="ob-debut" type="date"></label><label>Fin<input id="ob-fin" type="date"></label>' +
      '<div class="segment"><button data-per="m">Ce mois-ci</button><button data-per="s">Mois prochain</button></div>' +
      '<label>Le CA s\'entend en<select id="ob-base"><option value="ttc">TTC (toutes taxes comprises)</option><option value="ht">HT (hors taxes)</option></select></label>' +
      '<label>Objectif de CA (€)<input id="ob-ca" type="number" min="0" step="100" inputmode="decimal" placeholder="ex. 40000"></label>' +
      '<label>Objectif de couverts<input id="ob-cv" type="number" min="0" step="10" inputmode="numeric" placeholder="ex. 1500"></label>' +
      '<p class="doux">Au moins un des deux. L\'objectif est réparti au prorata des jours de la période.</p><div class="stk-erreur" id="ob-err"></div></div></div>' +
      '<div class="tiroir-pied"><button class="bouton" data-fermer>Annuler</button><span class="td-espace"></span><button class="bouton sombre" data-valider>Enregistrer</button></div>';
    document.getElementById("ob-nom").value = o.nom || ""; document.getElementById("ob-debut").value = o.debut || mois.dateStart; document.getElementById("ob-fin").value = o.fin || mois.dateEnd;
    document.getElementById("ob-base").value = o.base === "ht" ? "ht" : "ttc"; document.getElementById("ob-ca").value = o.ca || ""; document.getElementById("ob-cv").value = o.couverts || "";
    t.addEventListener("click", function (e) {
      var c = e.target.closest("[data-per],[data-fermer],[data-valider]");
      if (!c) return;
      if (c.hasAttribute("data-fermer")) A.fermerTiroir();
      else if (c.hasAttribute("data-per")) { var p = c.getAttribute("data-per") === "m" ? mois : suivant; document.getElementById("ob-debut").value = p.dateStart; document.getElementById("ob-fin").value = p.dateEnd; }
      else D.setObjectif({ id: o.id, nom: val("ob-nom"), debut: val("ob-debut"), fin: val("ob-fin"), base: val("ob-base"), ca: val("ob-ca"), couverts: val("ob-cv") })
        .then(function () { A.fermerTiroir(); A.info("Objectif enregistré."); apres(); }, function (msg) { document.getElementById("ob-err").textContent = String(msg); });
    });
  }
  A.ecran("/reports/objectifs", {
    section: "rapports", fil: ["Objectifs"],
    actions: function () { return A.bouton("Nouvel objectif", "obj-new", { classe: "sombre" }); },
    filtres: ["sites"],
    rendre: function (ctx, zone) {
      D.getObjectifs().then(function (liste) {
        A.act["obj-new"] = function () { formulaireObjectif({}, ctx.rafraichir); };
        A.act["obj-edit"] = function (id) { formulaireObjectif(liste.filter(function (x) { return x.id === id; })[0], ctx.rafraichir); };
        A.act["obj-del"] = function (id) {
          var o = liste.filter(function (x) { return x.id === id; })[0];
          if (window.confirm("Supprimer l'objectif « " + o.nom + " » ?")) D.deleteObjectif(id).then(function () { A.info("Objectif supprimé."); ctx.rafraichir(); }, A.info);
        };
        if (!liste.length) { zone.innerHTML = A.vide("Aucun objectif") + '<p class="doux obj-note" style="text-align:center">Cliquez sur « Nouvel objectif » pour fixer un objectif de CA et/ou de couverts sur la période de votre choix. Vous pouvez en créer plusieurs.</p>'; return; }
        var p0 = ctx.periode, auj = A.aujourdhui();
        Promise.all(liste.map(function (o) { var p = {}; Object.keys(p0).forEach(function (k) { p[k] = p0[k]; }); p.dateStart = o.debut; p.dateEnd = o.fin; return D.getReportTotalSales(p); })).then(function (res) {
          zone.innerHTML = liste.map(function (o, i) { return carteObjectif(o, res[i], auj); }).join("");
        });
      });
    }
  });
  // ---------- Caisses en cours ----------
  A.ecran("/reports/tills-in-progress", {
    section: "rapports", fil: ["Caisses en cours"],
    rendre: function (ctx, zone) {
      D.getRealTime().then(function () {
        var jour = A.majuscule(["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"][new Date().getDay()]);
        var pastille = '<span class="pastille-info"><i></i>Aucune donnée disponible</span>';
        var graphe = A.graph.courbe({ labels: [], series: [], hauteur: 220, vide: true });
        zone.innerHTML = A.kpis([["Total TTC", A.euro(0)], ["Couverts moyen", A.euro(0)], ["Nb. de couverts", "0"], ["Total des annulations", A.euro(0)]]) +
          A.carte("Chiffre d'affaires par heure " + pastille, graphe + '<div class="legende mono"><span><i style="background:#8e44ad"></i>' + E(A.siteNom) + '</span><span><i style="background:#999"></i>' + jour.toLowerCase() + " dernier</span></div>") +
          A.carte("Chiffre d'affaires en cours " + pastille, graphe);
      });
    }
  });

  // ---------- Stocks : tiroir d'édition (ajout / inventaire / perte), données factices ----------
  var TYPES_STOCK = [["ajout", "Ajouter"], ["inventaire", "Inventaire"], ["perte", "Perte"]];
  var LIB_MVT = { ajout: "Ajout", inventaire: "Inventaire", perte: "Perte" };
  function dateHeure(iso) {
    var x = new Date(iso);
    function z(n) { return (n < 10 ? "0" : "") + n; }
    return z(x.getDate()) + "/" + z(x.getMonth() + 1) + "/" + x.getFullYear() + " " + z(x.getHours()) + ":" + z(x.getMinutes());
  }
  function editerStock(l, ctx) {
    var type = "ajout";
    var t = A.tiroir("");
    function valeur(id) { var c = document.getElementById(id); return c ? c.value : ""; }
    function dessiner(mouvements, erreur) {
      var gardeQ = valeur("stk-q"), gardeMotif = valeur("stk-motif"), gardeNote = valeur("stk-note");
      var aide = type === "ajout" ? "Quantité reçue à ajouter au stock."
        : type === "inventaire" ? "Quantité réellement comptée : elle remplace le stock actuel."
        : "Quantité perdue, retirée du stock.";
      t.innerHTML = '<div class="tiroir-tete"><div><h3>' + E(l.productName) + '</h3><span class="doux">' + E(l.category) + " › " + E(l.subCategory) + " · stock actuel : <b>" + E(l.quantity) + '</b></span></div><button class="fermer" data-fermer>✕</button></div>' +
        '<div class="tiroir-corps">' +
        '<div class="bandeau-factice">Données factices : non fournies par l\'API.</div>' +
        '<div class="segment stk-type">' + TYPES_STOCK.map(function (c) { return '<button class="' + (c[0] === type ? "actif" : "") + '" data-type="' + c[0] + '">' + c[1] + "</button>"; }).join("") + "</div>" +
        '<div class="stk-form"><label>' + (type === "inventaire" ? "Quantité comptée" : "Quantité") + '<input id="stk-q" type="number" min="0" step="any" inputmode="decimal"></label><p class="doux">' + aide + "</p>" +
        (type === "perte" ? '<label>Motif de la perte<select id="stk-motif"><option value="">Choisir un motif…</option>' + D.MOTIFS_PERTE.map(function (m) { return '<option value="' + E(m) + '">' + E(m) + "</option>"; }).join("") + "</select></label>" : "") +
        '<label>Commentaire (facultatif)<input id="stk-note" type="text" maxlength="120"></label>' +
        '<div class="stk-erreur">' + E(erreur || "") + "</div></div>" +
        '<h4 class="stk-titre">Historique des mouvements</h4>' +
        (mouvements.length ? A.table([{ t: "Date" }, { t: "Type" }, { a: "d", t: "Variation" }, { a: "d", t: "Stock" }, { t: "Motif" }],
          mouvements.slice(0, 15).map(function (m) {
            return [dateHeure(m.date), LIB_MVT[m.type], (m.delta > 0 ? "+" : "") + A.entier(m.delta), E(m.avant) + " → " + E(m.apres), E(m.motif + (m.note ? (m.motif ? " · " : "") + m.note : "") || "-")];
          }), null, { classe: "zebre" }) : '<p class="doux">Aucun mouvement enregistré.</p>') +
        "</div>" +
        '<div class="tiroir-pied"><button class="bouton" data-fermer>Annuler</button><span class="td-espace"></span><button class="bouton sombre" data-valider>Enregistrer</button></div>';
      var q = document.getElementById("stk-q"), mo = document.getElementById("stk-motif");
      q.value = gardeQ; document.getElementById("stk-note").value = gardeNote;
      if (mo) mo.value = gardeMotif;
      q.focus();
    }
    function charger(erreur) { D.getStockMovements(l.id).then(function (m) { dessiner(m, erreur); }); }
    t.addEventListener("click", function (e) {
      var c = e.target.closest("[data-type],[data-fermer],[data-valider]");
      if (!c) return;
      if (c.hasAttribute("data-fermer")) A.fermerTiroir();
      else if (c.hasAttribute("data-type")) { type = c.getAttribute("data-type"); charger(""); }
      else {
        var mot = document.getElementById("stk-motif"), qte = document.getElementById("stk-q").value;
        D.setStockMovement(l.id, { type: type, quantite: qte === "" ? NaN : qte, motif: mot ? mot.value : "", note: document.getElementById("stk-note").value.trim() })
          .then(function (nl) {
            A.fermerTiroir();
            A.info(LIB_MVT[type] + " enregistré : stock de " + l.productName + " = " + nl.quantity);
            ctx.rafraichir();
            A.majAlertes().then(function (alertes) {
              var a = alertes.filter(function (x) { return x.id === l.id; })[0];
              if (a && type !== "ajout") A.info("Alerte : " + l.productName + " a atteint son seuil de réapprovisionnement (" + a.quantity + " ≤ " + a.seuil + ").");
            });
          }, function (msg) { charger(String(msg)); });
      }
    });
    charger("");
  }

  // ---------- Stocks ----------
  A.ecran("/reports/stocks", {
    section: "rapports", fil: ["Stocks"],
    actions: function () { return exportCsv(); },
    rendre: function (ctx, zone) {
      D.getHybridStock().then(function (lignes) {
        var et = ctx.etat, cats = {}, sous = {};
        lignes.forEach(function (l) { cats[l.category] = 1; if (!et.cat || et.cat === l.category) sous[l.subCategory] = 1; });
        var vue = lignes.filter(function (l) {
          return (!et.cat || l.category === et.cat) && (!et.sous || l.subCategory === et.sous) &&
            (et.min === undefined || et.min === "" || l.quantity >= +et.min) && (et.max === undefined || et.max === "" || l.quantity <= +et.max);
        });
        A.act.export = function () {
          A.telechargerCsv("stocks.csv", ["Produit", "Dernière déclaration", "Catégorie", "Sous-catégorie", "Stock déclaré"],
            vue.map(function (l) { return [l.productName, l.lastDeclaredAt || "-", l.category, l.subCategory, l.quantity]; }));
        };
        function relatif(iso) {
          if (!iso) return "-";
          var j = Math.round((Date.now() - A.depuisIso(iso).getTime()) / 86400000);
          return "il y a " + j + " jour" + (j > 1 ? "s" : "");
        }
        var filtres = '<div class="selecteur-periode inactif"><button disabled>‹</button><span class="libelle">Sélectionner une plage de dates</span><button disabled>›</button></div>' +
          A.liste("stk-cat", "Catégorie", Object.keys(cats).map(function (c) { return [c, c]; }), et.cat, function (v) { et.cat = v; et.sous = ""; ctx.rafraichir(); }) +
          A.liste("stk-sous", "Sous-catégorie", Object.keys(sous).map(function (c) { return [c, c]; }), et.sous, function (v) { et.sous = v; ctx.rafraichir(); });
        A.act.stkEdit = function (id) {
          var l = lignes.filter(function (x) { return String(x.id) === id; })[0];
          if (l) editerStock(l, ctx);
        };
        zone.innerHTML = '<div class="bandeau-factice"><b>Données factices.</b> Les stocks ne sont pas fournis par l\'API Popina : quantités et mouvements sont inventés et ne sont enregistrés que dans ce navigateur.</div>' +
          A.carte("Tableau des stocks",
          '<div id="td"></div><div class="barre-stock">Stock déclaré <input id="smin" placeholder="" value="' + E(et.min || "") + '"> à <input id="smax" value="' + E(et.max || "") + '"></div>', { classe: "avec-tableau" });
        // La zone « stock déclaré » se place sous la barre d'outils
        var tdz = document.getElementById("td");
        A.monterTable(tdz, {
          colonnes: [{ t: "Produit", k: "productName" }, { t: "Dernière déclaration", f: function (r) { return relatif(r.lastDeclaredAt); }, tri: function (r) { return r.lastDeclaredAt || ""; } },
            { t: "Catégorie", f: function (r) { return '<span class="ic-nom">' + A.icones.stocks.replace("icone", "icone sombre") + E(r.category) + "</span>"; }, tri: function (r) { return r.category; } },
            { t: "Sous-catégorie", f: function (r) { return '<span class="ic-nom">' + A.icones.dossier + E(r.subCategory) + "</span>"; }, tri: function (r) { return r.subCategory; } },
            { t: "Stock déclaré", k: "quantity", tri: function (r) { return r.quantity; } },
            { t: "", f: function (r) { return '<button class="bouton-icone" title="Modifier le stock" data-act="stkEdit" data-val="' + E(r.id) + '">' + A.icones.crayon + "</button>"; }, tri: function () { return 0; } }],
          lignes: vue, rech: { ph: "Rechercher un produit", texte: function (r) { return r.productName; } }, sansFiltrer: true, sansColonnes: true, filtres: filtres, pageSize: 20
        });
        var bs = zone.querySelector(".barre-stock");
        document.getElementById("smin").onchange = function () { et.min = this.value; ctx.rafraichir(); };
        document.getElementById("smax").onchange = function () { et.max = this.value; ctx.rafraichir(); };
        zone.querySelector(".td-barre").appendChild(bs);
      });
    }
  });

  // ---------- Produits ----------
  A.ecran("/reports/sales-report/products", {
    section: "rapports", fil: FIL("Produits"), filtres: FILTRES, actions: function () { return exportCsv(); },
    rendre: function (ctx, zone) {
      D.getReportProductData(P(ctx)).then(function (r) {
        A.act.export = function () {
          A.telechargerCsv("produits.csv", ["Produit", "Établissement", "Quantité", "Total HT", "Total"],
            r.items.map(function (p) { return [p.name, p.establishment, p.quantity, A.montantCsv(p.excludingTax), A.montantCsv(p.netAmount)]; }));
        };
        function top(titre, liste, couleur) {
          return '<div class="carte carte-top" style="--bande:' + couleur + '"><div class="carte-bande"></div><div class="carte-tete"><h2>' + titre + "</h2></div><div class=\"carte-corps\">" +
            A.table([{ t: "Produit" }, d("Quantité"), d("Total")], liste.map(function (p) { return [E(p.name), A.entier(p.quantity), '<span class="mono">' + A.euro(p.netAmount) + "</span>"]; }), null, { classe: "zebre" }) + "</div></div>";
        }
        zone.innerHTML = '<div class="deux-col">' + top("Top produits", r.topFive, "#5fc48a") + top("Flop produits", r.flopFive, "#ee7b72") + "</div>" +
          A.carte("Tous les produits", '<div id="td"></div>');
        A.monterTable(document.getElementById("td"), {
          colonnes: [{ t: "Produits", k: "name" }, { t: "Établissement", k: "establishment" }, { t: "Type de prix", f: function () { return "-"; } },
            { t: "Quantité", a: "d", f: function (p) { return "<b>" + A.entier(p.quantity) + "</b>"; }, tri: function (p) { return p.quantity; } },
            { t: "Total HT", a: "d", f: function (p) { return "<b>" + A.euro(p.excludingTax) + "</b>"; }, tri: function (p) { return p.excludingTax; } },
            { t: "Total", a: "d", f: function (p) { return "<b>" + A.euro(p.netAmount) + "</b>"; }, tri: function (p) { return p.netAmount; } }],
          lignes: r.items, rech: { ph: "Rechercher un produit", texte: function (p) { return p.name; } }, pageSize: 20,
          total: ["Total", "", "", "<b>" + A.entier(r.totals.quantity) + "</b>", "<b>" + A.euro(r.totals.excludingTax) + "</b>", "<b>" + A.euro(r.totals.netAmount) + "</b>"],
          droite: A.bouton("Regrouper par", "regrouper", { chevron: true }),
          detail: function (p) { return p.pricingList.map(function (x) { return ["", "", E(x.pricing), A.entier(x.quantity), A.euro(x.excludingTax), A.euro(x.sales)]; }); }
        });
        A.act.regrouper = A.nonDispo;
      });
    }
  });

  // ---------- Options ----------
  A.ecran("/reports/sales-report/modifiers", {
    section: "rapports", fil: FIL("Options"), filtres: FILTRES, actions: function () { return exportCsv(); },
    rendre: function (ctx, zone) {
      D.getReportModifiers(P(ctx)).then(function (l) {
        A.act.export = function () { A.telechargerCsv("options.csv", ["Option", "Quantité", "Montant"], l.map(function (o) { return [o.modifierName, o.totalQuantity, A.montantCsv(o.totalAmount)]; })); };
        zone.innerHTML = A.carte("Toutes les options", '<div id="td"></div>');
        A.monterTable(document.getElementById("td"), {
          colonnes: [{ t: "Option", k: "modifierName" }, { t: "Quantité", a: "d", f: function (o) { return A.entier(o.totalQuantity); }, tri: function (o) { return o.totalQuantity; } },
            { t: "Montant", a: "d", f: function (o) { return A.euro(o.totalAmount); }, tri: function (o) { return o.totalAmount; } }],
          lignes: l, rech: { ph: "Rechercher...", texte: function (o) { return o.modifierName + " " + o.modifierGroupName; } }
        });
      });
    }
  });

  // ---------- Employés ----------
  A.ecran("/reports/sales-report/employees", {
    section: "rapports", fil: FIL("Employés"), filtres: FILTRES, actions: function () { return exportCsv(); },
    rendre: function (ctx, zone) {
      D.getEmployees(P(ctx)).then(function (l) {
        A.act.export = function () {
          A.telechargerCsv("employes.csv", ["Nom", "Total Ventes", "Total Encaissé", "Total Annulé", "Total Pertes", "Commandes", "Couverts"],
            l.map(function (e) { return [e.operatorName, A.montantCsv(e.operatorTotalOrderSales), A.montantCsv(e.operatorTotalCashed), A.montantCsv(e.operatorTotalCanceled), A.montantCsv(e.operatorTotalLoss), e.operatorOrderCount, e.operatorGuestCount]; }));
        };
        function top(titre, cols, rangees) {
          return A.carte(titre, A.table(cols, rangees, null), {});
        }
        var ventes = l.slice(0, 5).map(function (e) { return [E(e.operatorName), A.euro(e.operatorTotalOrderSales)]; });
        var remises = l.slice().sort(function (a, b) { return b.operatorTotalDiscount - a.operatorTotalDiscount; }).slice(0, 5).map(function (e) { return [E(e.operatorName), A.entier(e.operatorTotalDiscountQuantity), A.euro(e.operatorTotalDiscount)]; });
        var annul = l.slice().sort(function (a, b) { return b.operatorTotalCanceled - a.operatorTotalCanceled; }).slice(0, 5).map(function (e) { return [E(e.operatorName), A.entier(e.operatorTotalCanceledQuantity), A.euro(e.operatorTotalCanceled)]; });
        var s = { v: 0, c: 0, a: 0, n: 0, g: 0, r: 0 };
        l.forEach(function (e) { s.v += e.operatorTotalOrderSales; s.c += e.operatorTotalCashed; s.a += e.operatorTotalCanceled; s.n += e.operatorOrderCount; s.g += e.operatorGuestCount; s.r += e.operatorTotalDiscount; });
        zone.innerHTML = '<div class="trois-col">' + top("Top Ventes", [{ t: "Nom" }, d("Total")], ventes) + top("Top Remises", [{ t: "Nom" }, d("Quantité"), d("Total")], remises) +
          top("Top Annulations", [{ t: "Nom" }, d("Quantité"), d("Total")], annul) + "</div>" +
          A.carte("Tableau des Employés", '<div class="defile-x">' + A.table(
            [{ t: "Nom" }, d("Total Ventes"), d("Total Encaissé"), d("Total Annulé"), d("Total Pertes"), d("Nombres de Commandes"), d("Nombre de Couverts"), d("Total Remises"), d("Couvert moyen"), d("Commande moyenne")],
            l.map(function (e) { return [E(e.operatorName), A.euro(e.operatorTotalOrderSales), A.euro(e.operatorTotalCashed), A.euro(e.operatorTotalCanceled), A.euro(e.operatorTotalLoss), A.entier(e.operatorOrderCount), A.entier(e.operatorGuestCount), A.euro(e.operatorTotalDiscount), A.euro(e.operatorAverageCover), A.euro(e.operatorAverageOrder)]; }),
            ["<b>Total</b>", "<b>" + A.euro(s.v) + "</b>", "<b>" + A.euro(s.c) + "</b>", "<b>" + A.euro(s.a) + "</b>", "<b>" + A.euro(0) + "</b>", "<b>" + A.entier(s.n) + "</b>", "<b>" + A.entier(s.g) + "</b>", "<b>" + A.euro(s.r) + "</b>", "", ""]) + "</div>");
      });
    }
  });

  // ---------- Annulations ----------
  A.ecran("/reports/sales-report/cancelation", {
    section: "rapports", fil: FIL("Annulations"), filtres: FILTRES, actions: function () { return exportCsv(); },
    rendre: function (ctx, zone) {
      D.getReportCancelation(P(ctx)).then(function (r) {
        var b = r.blocStats;
        A.act.export = function () {
          var lignes = [];
          r.cancelByReasonBeforeCashIn.forEach(function (x) { lignes.push(["Avant encaissement", x.canceledReason, x.quantity, A.montantCsv(x.canceledAmount)]); });
          r.cancelByReasonAfterCashIn.forEach(function (x) { lignes.push(["Après encaissement", x.canceledReason, x.quantity, A.montantCsv(x.canceledAmount)]); });
          A.telechargerCsv("annulations.csv", ["Type", "Motif", "Quantité", "Total"], lignes);
        };
        function bloc(titre, liste) {
          var q = 0, m = 0;
          liste.forEach(function (x) { q += x.quantity; m += x.canceledAmount; });
          return A.carte(titre, '<div class="depl">' + A.table([{ t: "Annulations" }, { t: "Produits" }, d("Quantité"), d("Total")],
            liste.map(function (x) { return [E(x.canceledReason), "-", "<b>" + A.entier(x.quantity) + "</b>", "<b>" + A.euro(x.canceledAmount) + "</b>"]; }),
            ["<b>Total</b>", "", "<b>" + A.entier(q) + "</b>", "<b>" + A.euro(m) + "</b>"],
            { details: function (n) { return liste[n].productList.map(function (p) { return ["", E(p.name), A.entier(p.quantity), A.euro(p.amount)]; }); } }) + "</div>");
        }
        zone.innerHTML = A.kpis([["Annulation avant encaissement", A.euro(b.totalCanceledAmountBeforeCashIn)], ["Annulation après encaissement", A.euro(b.totalCanceledAmountAfterCashIn)], ["Total des annulations", A.euro(b.totalCanceledAmount)]]) +
          bloc("Annulation avant encaissement", r.cancelByReasonBeforeCashIn) + bloc("Annulation après encaissement", r.cancelByReasonAfterCashIn);
        A.brancherDepliables(zone);
      });
    }
  });

  // ---------- Pertes ----------
  A.ecran("/reports/sales-report/losses", {
    section: "rapports", fil: FIL("Pertes"), filtres: FILTRES, actions: function () { return exportCsv(); },
    rendre: function (ctx, zone) {
      D.getReportLosses(P(ctx)).then(function (r) {
        A.act.export = function () { A.telechargerCsv("pertes.csv", ["Raison", "Produits", "Quantité", "Montant"], []); };
        zone.innerHTML = '<div class="deux-col">' + A.kpi("Quantité totale de pertes", r.blocStats.totalQuantity) + A.kpi("Montant total des pertes", A.euro(r.blocStats.total)) + "</div>" +
          A.carte("Tableau des pertes", A.table([{ t: "Raison" }, { t: "Produits" }, d("Quantité"), d("Montant")], []) + '<div class="vide-ligne centre">Aucun élément disponible</div>');
      });
    }
  });

  // ---------- Remises ----------
  A.ecran("/reports/sales-report/discounts", {
    section: "rapports", fil: FIL("Remises"), filtres: FILTRES, actions: function () { return exportCsv(); },
    rendre: function (ctx, zone) {
      D.getReportDiscount(P(ctx)).then(function (r) {
        var et = ctx.etat, b = r.blocStats, mode = et.mode || "taxe", filtre = et.remise || "";
        var liste = r.discountList.filter(function (x) { return !filtre || x.discountName === filtre; });
        A.act.export = function () {
          A.telechargerCsv("remises.csv", ["Remise", "Quantité", "Total TTC"], liste.map(function (x) { return [x.discountName, x.quantity, A.montantCsv(x.discountAmount)]; }));
        };
        var q = 0, ht = 0, tva = 0, ttc = 0;
        liste.forEach(function (x) { q += x.quantity; x.taxRepartition.forEach(function (t) { ht += t.amountHT; tva += t.amountTVA; ttc += t.amountTTC; }); });
        var colsT = [{ t: "Remises" }, { t: "Taux TVA (%)" }, d("Quantité"), d("Total HT"), d("Total TVA"), d("Total TTC")];
        var lignes, details;
        if (mode === "taxe") {
          lignes = liste.map(function (x) {
            var h = 0, v = 0, t = 0; x.taxRepartition.forEach(function (z) { h += z.amountHT; v += z.amountTVA; t += z.amountTTC; });
            return [E(x.discountName), "-", "<b>" + A.entier(x.quantity) + "</b>", "<b>" + A.euro(h) + "</b>", "<b>" + A.euro(v) + "</b>", "<b>" + A.euro(t) + "</b>"];
          });
          details = function (n) { return liste[n].taxRepartition.map(function (z) { return ["", A.pct(z.taxRate), A.entier(z.quantity), A.euro(z.amountHT), A.euro(z.amountTVA), A.euro(z.amountTTC)]; }); };
        } else {
          lignes = liste.map(function (x) { return [E(x.discountName), "-", "<b>" + A.entier(x.quantity) + "</b>", "", "", "<b>" + A.euro(x.discountAmount) + "</b>"]; });
          details = function (n) { return liste[n].productList.map(function (p) { return [E(p.name), A.pct(p.taxRate), A.entier(p.quantity), A.euro(p.amountHT), A.euro(p.amountTVA), A.euro(p.amountTTC)]; }); };
        }
        var barre = '<div class="barre-outils">' + A.liste("rem-f", "Toutes les réductions", r.discountList.map(function (x) { return [x.discountName, x.discountName]; }), filtre, function (v) { et.remise = v; ctx.rafraichir(); }) +
          '<span class="td-espace"></span>' + A.segment("rem-mode", [["taxe", "Par Taxe"], ["produit", "Par Produit"]], mode, function (v) { et.mode = v; ctx.rafraichir(); }) + "</div>";
        zone.innerHTML = A.kpis([["Total des remises", A.euro(b.discountSum)], ["Total offert", A.euro(b.giftedSum)], ["Total des réductions", A.euro(b.total)]]) +
          A.carte("Tableau des remises", barre + '<div class="depl">' + A.table(colsT, lignes, ["<b>Total</b>", "", "<b>" + A.entier(q) + "</b>", "<b>" + A.euro(ht) + "</b>", "<b>" + A.euro(tva) + "</b>", "<b>" + A.euro(ttc) + "</b>"], { details: details }) + "</div>");
        A.brancherDepliables(zone);
      });
    }
  });

  // ---------- Taxes ----------
  A.ecran("/reports/sales-report/taxes", {
    section: "rapports", fil: FIL("Taxes"), filtres: FILTRES, actions: function () { return exportCsv(); },
    rendre: function (ctx, zone) {
      D.getReportTaxes(P(ctx)).then(function (l) {
        A.act.export = function () { A.telechargerCsv("taxes.csv", ["Nom", "HT", "TVA", "TTC"], l.map(function (x) { return [x.taxName, A.montantCsv(x.totalWithoutTax), A.montantCsv(x.totalTax), A.montantCsv(x.totalWithTax)]; })); };
        if (!l.length) { zone.innerHTML = A.carte("Tableau des taxes", '<div class="vide">Aucune donnée trouvée</div>'); return; }
        var h = 0, v = 0, t = 0;
        l.forEach(function (x) { h += x.totalWithoutTax; v += x.totalTax; t += x.totalWithTax; });
        zone.innerHTML = A.carte("Tableau des taxes", A.table([{ t: "Nom" }, d("HT"), d("TVA"), d("TTC")],
          l.map(function (x) { return [E(x.taxName), A.euro(x.totalWithoutTax), A.euro(x.totalTax), A.euro(x.totalWithTax)]; }),
          ["<b>Total</b>", "<b>" + A.euro(h) + "</b>", "<b>" + A.euro(v) + "</b>", "<b>" + A.euro(t) + "</b>"]), { classe: "plein" });
      });
    }
  });

  // ---------- Paiements ----------
  A.ecran("/reports/sales-report/payments", {
    section: "rapports", fil: FIL("Paiements"), filtres: FILTRES, actions: function () { return exportCsv(); },
    rendre: function (ctx, zone) {
      D.getReportPaymentMode(P(ctx)).then(function (l) {
        A.act.export = function () {
          A.telechargerCsv("paiements.csv", ["Nom", "Quantité", "Pourboires", "Montant"], l.map(function (x) { return [x.paymentName, x.paymentModeQuantity, A.montantCsv(x.paymentModeTips), A.montantCsv(x.paymentModeSum)]; }));
        };
        if (!l.length) { zone.innerHTML = A.carte("Modes de paiement", '<div class="vide">Aucune donnée trouvée</div>'); return; }
        var q = 0, p = 0, m = 0;
        l.forEach(function (x) { q += x.paymentModeQuantity; p += x.paymentModeTips; m += x.paymentModeSum; });
        zone.innerHTML = A.carte("Modes de paiement", A.table([{ t: "Nom" }, d("Quantité"), d("Pourboires"), d("Montant")],
          l.map(function (x) { return ['<span class="pastille" style="background:' + E(x.couleur || "#999") + '"></span>' + E(x.paymentName), A.entier(x.paymentModeQuantity), A.euro(x.paymentModeTips), A.euro(x.paymentModeSum)]; }),
          ["<b>Total</b>", "<b>" + A.entier(q) + "</b>", "<b>" + A.euro(p) + "</b>", "<b>" + A.euro(m) + "</b>"]), { classe: "plein" });
      });
    }
  });

  // ---------- Catégories ----------
  A.ecran("/reports/sales-report/categories", {
    section: "rapports", fil: FIL("Catégories"), filtres: FILTRES,
    rendre: function (ctx, zone) {
      D.getReportCategories(P(ctx)).then(function (r) {
        var et = ctx.etat, jours = Object.keys(r.timed).sort(), noms = r.ordreCategories;
        var couleurs = {}; r.categorySales.forEach(function (c) { couleurs[c.name] = c.couleur; });
        var graphe = jours.length ? A.graph.aires({ labels: jours.map(function (j) { return +j.slice(8); }), series: noms.slice().reverse().map(function (n) { return { nom: n, couleur: couleurs[n], valeurs: jours.map(function (j) { return r.timed[j][n] || 0; }) }; }), hauteur: 260 }) : A.vide();
        var cats = r.categorySales.filter(function (c) { return !et.cat || c.name === et.cat; });
        var sousListe = [];
        r.categorySales.forEach(function (c) { if (c.name === et.cat) c.subCategoryList.forEach(function (s) { sousListe.push([s.name, s.name]); }); });
        var q = 0, h = 0, t = 0;
        cats.forEach(function (c) { q += c.quantity; h += c.salesWithoutTaxes; t += c.sales; });
        var barre = '<div class="barre-outils">' + A.liste("cat-f", "Catégorie", r.categorySales.map(function (c) { return [c.name, c.name]; }), et.cat, function (v) { et.cat = v; et.sous = ""; ctx.rafraichir(); }) +
          (et.cat ? A.liste("cat-s", "Sous-catégorie", sousListe, et.sous, function (v) { et.sous = v; ctx.rafraichir(); }) : '<button class="bouton" disabled>Sous-catégorie' + A.icones.basPetit + "</button>") + "</div>";
        A.act.pdf = function () { window.print(); };
        zone.innerHTML = A.carte("Répartition de catégories", graphe + A.graph.legende(noms.map(function (n) { return { nom: n, couleur: couleurs[n] }; }))) +
          A.carte("Tableau des catégories", barre + '<div class="depl">' + A.table([{ t: "Nom" }, d("Quantité"), d("Total HT"), d("Total TTC")],
            cats.map(function (c) { return [E(c.name), A.entier(c.quantity), A.euro(c.salesWithoutTaxes), A.euro(c.sales)]; }),
            ["<b>Total</b>", "<b>" + A.entier(q) + "</b>", "<b>" + A.euro(h) + "</b>", "<b>" + A.euro(t) + "</b>"],
            { details: function (n) { return cats[n].subCategoryList.filter(function (s) { return !et.sous || s.name === et.sous; }).map(function (s) { return [E(s.name), A.entier(s.quantity), A.euro(s.salesWithoutTaxes), A.euro(s.sales)]; }); } }) + "</div>",
            { droite: exportPdf() });
        A.brancherDepliables(zone);
      });
    }
  });

  // ---------- Taux de répartition ----------
  A.ecran("/reports/sales-report/sales-distribution", {
    section: "rapports", fil: FIL("Taux de Répartition"), filtres: FILTRES,
    rendre: function (ctx, zone) {
      D.getSalesDistribution(P(ctx)).then(function (r) {
        var et = ctx.etat, agr = et.agr || "somme", mes = et.mes || "prix";
        function val(o, c, nbSessions) {
          var v = (mes === "prix" ? o.valeurs[c] : o.quantites[c]) || 0;
          return agr === "moyenne" && nbSessions ? v / nbSessions : v;
        }
        var segs = function (liste, sessions) { return r.categories.map(function (c, i) { return { nom: c, couleur: r.couleurs[i], valeurs: liste.map(function (o) { return val(o, c, sessions ? o.nbSessions : 0); }) }; }); };
        var fmt = function (v) { return mes === "prix" ? A.euro(v) : A.entier(Math.round(v * 10) / 10); };
        var controles = A.segment("rep-agr", [["somme", "Somme"], ["moyenne", "Moyenne"]], agr, function (v) { et.agr = v; ctx.rafraichir(); }) + A.segment("rep-mes", [["quantite", "Quantité"], ["prix", "Prix"]], mes, function (v) { et.mes = v; ctx.rafraichir(); });
        var legende = A.graph.legende(r.categories.map(function (c, i) { return { nom: c, couleur: r.couleurs[i] }; }));
        var max = 0, heat = {};
        r.heatmap.forEach(function (h) { heat[h.jour + "-" + h.heure] = h.valeur; if (h.valeur > max) max = h.valeur; });
        var heures = []; for (var h = 10; h <= 18; h++) heures.push(h);
        var carte = '<div class="heat"><table><thead><tr><th></th>' + heures.map(function (x) { return "<th>" + x + "h</th>"; }).join("") + "</tr></thead><tbody>" +
          [0, 1, 2, 3, 4, 5, 6].map(function (j) {
            return "<tr><th class=\"g\">" + r.parJour[j].day + "</th>" + heures.map(function (x) {
              var v = heat[j + "-" + x] || 0, a = max ? v / max : 0;
              return '<td style="background:rgba(30,70,200,' + (0.05 + a * 0.85).toFixed(2) + ');color:' + (a > 0.5 ? "#fff" : "inherit") + '" title="' + A.euro(v) + '">' + (v ? Math.round(v) : "") + "</td>";
            }).join("") + "</tr>";
          }).join("") + "</tbody></table></div>";
        A.act.crenReglage = function () { location.hash = "#/point-of-sale/settings/service-slots"; };
        var cartesCren = A.carte("Ventes par créneau de service", A.graph.barresEmpilees({ labels: r.parCreneau.map(function (o) { return o.slot + (o.horaire ? " (" + o.horaire + ")" : ""); }), segments: segs(r.parCreneau.map(function (o) { return { valeurs: o.valeurs, quantites: o.quantites, nbSessions: 0 }; }), false), formatter: fmt }) + legende,
          { droite: A.bouton("Régler les créneaux", "crenReglage") });
        zone.innerHTML =
          A.carte("Ventes par jour de la semaine", A.graph.barresEmpilees({ labels: r.parJour.map(function (o) { return o.day; }), segments: segs(r.parJour, true), formatter: fmt }) + legende, { droite: controles }) +
          cartesCren +
          A.carte("Ventes par créneau horaire", A.graph.barresEmpilees({ labels: r.parTranche.map(function (o) { return o.slot; }), segments: segs(r.parTranche.map(function (o) { return { valeurs: o.valeurs, quantites: o.quantites, nbSessions: 0 }; }), false), formatter: fmt }) + legende) +
          A.carte("Carte de chaleur", carte);
      });
    }
  });

  // ---------- Menus ----------
  A.ecran("/reports/sales-report/menus", {
    section: "rapports", fil: FIL("Menus"), filtres: FILTRES, actions: function () { return exportCsv(); },
    rendre: function (ctx, zone) {
      D.getReportMenuSales(P(ctx)).then(function (l) {
        A.act.export = function () { A.telechargerCsv("menus.csv", ["Menu", "Quantité", "Total"], l.map(function (m) { return [m.menuName, m.quantity, A.montantCsv(m.total)]; })); };
        if (!l.length) { zone.innerHTML = A.vide("Aucune donnée trouvée"); return; }
        var q = 0, t = 0;
        l.forEach(function (m) { q += m.quantity; t += m.total; });
        zone.innerHTML = A.carte("Ventes de menus", A.table([{ t: "Menu" }, d("Quantité"), d("Total")],
          l.map(function (m) { return [E(m.menuName), A.entier(m.quantity), A.euro(m.total)]; }),
          ["<b>Total</b>", "<b>" + A.entier(q) + "</b>", "<b>" + A.euro(t) + "</b>"]), { classe: "plein" });
      });
    }
  });

  // ---------- Historique des caisses ----------
  A.ecran("/reports/sales-report/z-report", {
    section: "rapports", fil: FIL("Historique des caisses"), filtres: FILTRES_SANS_TRANCHE, actions: function () { return A.bouton("Export comptable", "compta") + exportPdf(); },
    rendre: function (ctx, zone) {
      brancherPdf();
      A.act.compta = function () { A.allerA("/reports/sales-report/accounting-export", { dateStart: ctx.periode.dateStart, dateEnd: ctx.periode.dateEnd }); };
      D.getNewHistoryZTill(P(ctx)).then(function (l) {
        var tot = 0; l.forEach(function (z) { tot += z.totalSales; });
        zone.innerHTML = A.carte("", A.table([{ t: "Date" }, { t: "Créneaux" }, d("Total TTC"), { t: "" }],
          l.map(function (z) { return ['<a href="#/reports/sales-report/z-report/daily/' + z.id + '">' + A.dateMoyenne(z.date).replace(/^(\d+) /, "$1 ") + "</a>", "-", "<b>" + A.euro(z.totalSales) + "</b>", '<a class="oeil" href="#/reports/sales-report/z-report/daily/' + z.id + '" title="Voir le détail">' + A.icones.oeil + "</a>"]; }),
          ["<b>Total sur la période</b>", "", "<b>" + A.euro(tot) + "</b>", ""], { classe: "liste-z" }), { classe: "sans-titre" });
        if (!l.length) zone.innerHTML = A.vide();
      });
    }
  });

  // ---------- Détail d'une caisse ----------
  A.ecran("/reports/sales-report/z-report/daily/:id", {
    section: "rapports", filtres: [],
    fil: function (ctx) { return ["Rapports", "Historique des caisses", ctx.etat.titre || "..."]; },
    actions: function () { return A.bouton("Export PDF", "pdf", { classe: "sombre" }); },
    rendre: function (ctx, zone) {
      brancherPdf();
      D.getReportById(ctx.ids.id).then(function (r) {
        if (!r) { zone.innerHTML = A.vide("Rapport introuvable"); return; }
        document.querySelector(".fil b").textContent = A.dateLongue(r.date);
        var s = r.salesStatisticsData;
        function tab(cols, rangees, total) { return A.table(cols, rangees, total); }
        function bloc(titre, corps) { return '<div class="carte"><div class="carte-corps petit"><h3 class="titre-bloc">' + titre + "</h3>" + corps + "</div></div>"; }
        zone.innerHTML =
          '<div class="carte"><div class="entete-z"><span class="badge-site">' + E(A.siteSigle === "RE" ? "RE" : A.siteSigle) + "</span><b>" + A.dateLongue(r.date) + '</b><span class="chip">Rapport n°' + r.reportNumber +
          '</span><span class="td-espace"></span><a class="lien-souligne" href="#/reports/dashboard">Aller au tableau de bord</a></div></div>' +
          A.kpis([["Commencé à", r.startedAt], ["Clôturé à", r.finalizedAt]]) + A.kpis([["Total TTC", A.euro(r.totalSalesSum)], ["Total HT", A.euro(r.totalSalesWithoutTax)]]) +
          A.kpis([["Nb. de couverts", A.entier(r.guestsNumberTotal)], ["Couverts moyen", A.euro(r.averageGuest)], ["Nb. de commandes", A.entier(r.totalOrders)], ["Commande moyenne", A.euro(r.averageOrder)]]) +
          bloc("Statistiques de vente", tab([{ t: "Nom" }, d("Montant")], [["Total Commandé", '<span class="mono">' + A.euro(s.totalOrdered) + "</span>"], ["Total Encaissé", '<span class="mono">' + A.euro(s.totalCharged) + "</span>"], ["Total Pourboires", '<span class="mono">' + A.euro(s.totalTips) + "</span>"], ["Fond de caisse initial", '<span class="mono">' + A.euro(s.initialCashFloat) + "</span>"], ["Écart de caisse", '<span class="mono">' + A.euro(s.gap) + "</span>"]])) +
          bloc("Taxes", tab([{ t: "Taxe" }, d("Base HT"), d("Montant TVA")], r.taxSummary.map(function (t) { return [E(t.taxName), A.euro(t.taxableAmount), A.euro(t.taxAmount)]; }))) +
          bloc("Paiements", tab([{ t: "Mode" }, d("Quantité"), d("Montant")], r.paymentSummary.map(function (p) { return [E(p.name), A.entier(p.quantity), A.euro(p.totalAmount)]; }))) +
          bloc("Produits", tab([{ t: "Produit" }, { t: "Catégorie" }, d("Quantité"), d("Total")], r.productSummary.slice(0, 15).map(function (p) { return [E(p.productName), E(p.category), A.entier(p.productQuantity), A.euro(p.productSales)]; }))) +
          bloc("Annulations", r.cancelationSummary.length ? tab([{ t: "Motif" }, d("Quantité"), d("Montant")], r.cancelationSummary.map(function (c) { return [E(c.name), A.entier(c.quantity), A.euro(c.amount)]; })) : '<div class="vide-ligne centre">Aucune annulation</div>') +
          bloc("Salles", tab([{ t: "Salle" }, d("Commandes"), d("Couverts"), d("Total TTC")], r.roomSummary.map(function (x) { return [E(x.name), A.entier(x.orderCount), A.entier(x.guestCount), A.euro(x.total)]; })));
      });
    }
  });

  // ---------- Fiscal ----------
  A.ecran("/reports/sales-report/fiscal", {
    section: "rapports", fil: FIL("Fiscal"),
    filtres: ["periode", function (ctx) {
      var et = ctx.etat;
      return A.liste("fisc-t", "Select options", [["Journalière", "Journalière"], ["Mensuelle", "Mensuelle"]], et.type, function (v) { et.type = v; ctx.rafraichir(); });
    }],
    rendre: function (ctx, zone) {
      var et = ctx.etat;
      D.getFiscalArchives(P(ctx)).then(function (l) {
        var filtreType = et.type || "";
        var liste = l.filter(function (x) { return !filtreType || x.type === filtreType; });
        zone.innerHTML = '<div class="liste-archives">' + liste.map(function (x) {
          return '<div class="archive"><div class="archive-haut"><span><b>' + E(x.titre) + "</b> - Sauvegardé le " + x.sauvegarde + '</span><span class="badge-type ' + (x.type === "Mensuelle" ? "mens" : "jour") + '"><i></i>' + x.type + "</span></div>" +
            '<button class="fichier" data-act="dl" data-val="' + E(x.fichier) + '">' + E(x.fichier) + " +</button></div>";
        }).join("") + "</div>" + (liste.length ? "" : A.vide("Aucune archive trouvée"));
        A.act.dl = function (nom) { A.telechargerCsv(nom, ["Archive fiscale (exemple)"], [["Données de démonstration"]]); };
      });
    }
  });

  // ---------- Salles (route cachée) ----------
  A.ecran("/reports/sales-report/rooms", {
    section: "rapports", fil: FIL("Salles"), filtres: FILTRES, actions: function () { return exportCsv(); },
    rendre: function (ctx, zone) {
      D.getRoomsReport(P(ctx)).then(function (r) {
        var s = r.summary, max = 0;
        r.barChart.forEach(function (b) { if (b.totalSales > max) max = b.totalSales; });
        A.act.export = function () { A.telechargerCsv("salles.csv", ["Mode", "Commandes", "Couverts", "Total"], r.modes.map(function (m) { return [m.type, m.orderCount, m.guestCount, A.montantCsv(m.total)]; })); };
        var couleurs = ["#0b55d4", "#b3123f", "#0e8a8a"];
        zone.innerHTML = A.kpis([["Nombre de commandes", A.entier(s.orderCount)], ["Commande moyenne", A.euro(s.averagePerOrder)], ["Total TTC", A.euro(s.totalTTC)]]) +
          A.kpis([["Nombre de couverts", A.entier(s.guestCount)], ["Couvert moyen", A.euro(s.averagePerGuest)]]) +
          A.carte("Ventes par modes", r.barChart.map(function (b, i) {
            return '<div class="hbarre"><div class="hbarre-nom" style="color:' + couleurs[i % 3] + '">' + E(b.roomName) + '</div><div class="hbarre-ligne"><i style="width:' + Math.max(1, b.totalSales / max * 90) + '%;background:' + couleurs[i % 3] + '"></i><b style="color:' + couleurs[i % 3] + '">' + A.euro(b.totalSales) + "</b></div></div>";
          }).join("")) +
          A.carte("Ventes par modes", '<div class="depl">' + A.table([{ t: "Mode" }, d("Commandes"), d("Couverts"), d("Total")],
            r.modes.map(function (m) { return [E(m.type), A.entier(m.orderCount), A.entier(m.guestCount), A.euro(m.total)]; }), null,
            { details: function (n) { return r.modes[n].rooms.map(function (x) { return [E(x.name), A.entier(x.orderCount), A.entier(x.guestCount), A.euro(x.total)]; }); } }) + "</div>");
        A.brancherDepliables(zone);
      });
    }
  });
})();
