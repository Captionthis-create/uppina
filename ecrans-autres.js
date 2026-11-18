/*
 * ecrans-autres.js : Accueil, Commandes, Réservations, Clients, Bons cadeaux, Intégrations,
 * Quoi de neuf, Centre d'aide et Documentation, Hygiène Expert.
 */
(function () {
  "use strict";
  var A = App, E = A.echapper, D = DonneesTest;
  A.actGlobal["fermer-tiroir"] = function () { A.fermerTiroir(); };
  var NOUVEAU = '<span class="badge-nouveau">Nouveau</span>';
  function lienBloc(href, texte) { return '<a class="lien-bloc" href="#' + href + '">' + E(texte) + " ›</a>"; }
  // Champ de formulaire d'un tiroir (libellé + saisie)
  function champ(id, libelle, valeur, opts) {
    opts = opts || {};
    var attrs = ' id="' + id + '"' + (opts.type ? ' type="' + opts.type + '"' : ' type="text"') + (opts.min !== undefined ? ' min="' + opts.min + '"' : "") + (opts.max !== undefined ? ' max="' + opts.max + '"' : "") +
      (opts.step ? ' step="' + opts.step + '"' : "") + (opts.ph ? ' placeholder="' + E(opts.ph) + '"' : "") + (opts.maxlength ? ' maxlength="' + opts.maxlength + '"' : "") + (opts.inputmode ? ' inputmode="' + opts.inputmode + '"' : "");
    return "<label>" + libelle + "<input" + attrs + ' value="' + E(valeur == null ? "" : valeur) + '"></label>';
  }
  A.champ = champ;
  // Tiroir de formulaire générique : champs (HTML), bouton de validation, fonction d'enregistrement (renvoie une Promise)
  A.tiroirFormulaire = function (titre, sousTitre, corps, libelleOk, enregistrer) {
    var t = A.tiroir('<div class="tiroir-tete"><div><h3>' + E(titre) + "</h3>" + (sousTitre ? '<span class="doux">' + sousTitre + "</span>" : "") + '</div><button class="fermer" data-act="fermer-tiroir" aria-label="Fermer">✕</button></div>' +
      '<div class="tiroir-corps"><div class="stk-form">' + corps + '<div class="stk-erreur" id="form-err"></div></div></div>' +
      '<div class="tiroir-pied"><button class="bouton" data-act="fermer-tiroir">Annuler</button><span class="td-espace"></span><button class="bouton sombre" data-form-ok>' + E(libelleOk) + "</button></div>");
    function valider() {
      var err = document.getElementById("form-err");
      err.textContent = "";
      enregistrer(function (id) { var c = document.getElementById(id); return c ? (c.type === "checkbox" ? c.checked : c.value) : ""; })
        .then(function () { }, function (m) { err.textContent = String(m); });
    }
    t.querySelector("[data-form-ok]").onclick = valider;
    t.addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target.tagName === "INPUT") valider(); });
    var premier = t.querySelector("input,select,textarea");
    if (premier) premier.focus();
    return t;
  };

  // ======================================================================
  // Accueil : tout le service sous les yeux (se met à jour en direct)
  // ======================================================================
  function pct(a, b) { return b ? Math.round((a - b) / b * 100) : null; }
  function spark(vals, couleur) {
    var max = Math.max.apply(null, vals) || 1, m = vals.length, pts = vals.map(function (v, i) { return [i * 100 / (m - 1), 28 - v / max * 24]; });
    var l = pts.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" ");
    return '<svg class="spark" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true"><path d="' + l + " L100,32 L0,32 Z" + '" fill="' + couleur + '" fill-opacity="0.14"/><path d="' + l + '" fill="none" stroke="' + couleur + '" stroke-width="1.8" vector-effect="non-scaling-stroke"/></svg>';
  }
  var IC = {
    ttc: '<svg viewBox="0 0 24 24"><path d="M18 6.5A7 7 0 1018 17.5M4 10h10M4 14h10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    ht: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 10h16" stroke="currentColor" stroke-width="2"/></svg>',
    cov: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M16 5a3 3 0 010 6M18 14c2 .7 3 2.8 3 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    moy: '<svg viewBox="0 0 24 24"><path d="M5 20V10M12 20V4M19 20v-7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>'
  };
  function iconePaiement(nom) {
    if (nom === "Carte de crédit" || nom === "Paiement en ligne") return A.icones.carte;
    if (nom === "Espèces") return A.icones.especes;
    return A.icones.autre;
  }
  function lieu(c) { return c.salle === "À emporter" ? (c.enLigne ? "À emporter · en ligne" : "À emporter") : c.salle + " · " + c.table; }

  A.ecran("/", {
    section: null, fil: ["Accueil"],
    rendre: function (ctx, zone) {
      var et = ctx.etat, meteo = A.meteoActif();
      D.getHomePage().then(function (h) {
        var quand = et.quand || (h.avantOuverture ? "yesterday" : "today");
        var n = h.jours.length, idx = quand === "today" ? n - 1 : n - 2, k = h.jours[idx], ref = h.jours[idx - 7], serie = h.jours.slice(idx - 13, idx + 1), jour = k.date, estAuj = quand === "today";
        var mois = A.periodeMois();
        return Promise.all([
          meteo ? D.getWeatherDays({ dateStart: jour, dateEnd: jour }) : null, meteo ? D.getWeatherForecast(7) : null, meteo ? D.getWeatherImpact() : null,
          D.getDerniersEncaissements(6, jour), D.getObjectifs(), D.getAlertesStock(), D.getReservationList(jour), D.getTopProduitsJour(jour, 5)
        ]).then(function (res) {
          var objectifs = res[4], objMois = objectifs.filter(function (o) { return o.debut <= A.aujourdhui() && o.fin >= A.aujourdhui() && o.ca > 0; })
            .sort(function (a, b) { return (a.id === "auto-mois" ? -1 : 0) - (b.id === "auto-mois" ? -1 : 0) || (a.fin < b.fin ? -1 : 1); })[0];
          return (objMois ? D.getReportTotalSales({ dateStart: objMois.debut, dateEnd: objMois.fin }) : Promise.resolve(null)).then(function (ventesObj) {
            dessiner(h, quand, k, ref, serie, jour, estAuj, res, objMois, ventesObj, mois);
          });
        });
      });
      function dessiner(h, quand, k, ref, serie, jour, estAuj, res, objMois, ventesObj) {
        A.act.quand = function (v) { et.quand = v; ctx.rafraichir(); };
        var d = new Date(jour + "T12:00:00"), nomJour = d.toLocaleDateString("fr-FR", { weekday: "long" });
        var dateTxt = nomJour + " " + d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
        var jm = res[0] && res[0].jours[0] && res[0].jours[0].tmax != null ? res[0].jours[0] : null;
        var meteoJour = jm ? '<a class="accueil-meteo" href="#/reports/forecast" title="Météo à ' + E(res[0].ville) + '"><span class="am-ico">' + A.meteo.icone(jm.code) + "</span><div><b>" + Math.round(jm.tmax) + "° / " + Math.round(jm.tmin) + "°</b>" +
          '<div class="doux petit">' + E(res[0].ville) + " · " + E(A.meteo.libelle(jm.code)) + (jm.pluie ? " · " + String(Math.round(jm.pluie * 10) / 10).replace(".", ",") + " mm" : "") + "</div></div>" + A.meteo.pastille(jm.score) + "</a>" : "";
        var direct = estAuj && h.maintenant >= h.ouvertureMin && h.maintenant < h.fermetureMin;
        var sousTitre = estAuj ? (h.avantOuverture ? "Le service d'aujourd'hui commence à 8h00." : direct ? "Caisse ouverte depuis " + h.caisseOuverteA + " · chiffres en direct" : "Service terminé · caisse clôturée") : "Service complet de la veille.";
        var tete = '<div class="carte accueil-tete"><div><h1>Bonjour,</h1><p>' + (estAuj ? "voici votre service du " : "voici le service d'hier, ") + "<b>" + E(dateTxt) + "</b> · " + E(A.siteNom) + "</p>" +
          '<p class="doux petit accueil-sous">' + (direct ? '<span class="point-direct"></span>' : "") + E(sousTitre) + "</p></div>" + meteoJour +
          A.segment("quand", [["yesterday", "Hier"], ["today", "Aujourd'hui"]], quand, A.act.quand) + "</div>";

        // Tuiles : valeur, écart avec le même jour de la semaine précédente, courbe des 14 derniers jours
        var flash = et.dernierCA !== undefined && et.dernierJour === jour && et.dernierCA !== k.turnover;
        et.dernierCA = k.turnover; et.dernierJour = jour;
        function tuile(couleur, icone, libelle, cle, fmt, vivant) {
          var v = k[cle], p = pct(v, ref[cle]);
          var delta = p === null ? '<span class="doux">pas de comparaison</span>' :
            '<span class="' + (p > 0 ? "delta-bon" : p < 0 ? "delta-mauvais" : "doux") + '">' + (p > 0 ? "▲ +" : p < 0 ? "▼ " : "= ") + String(p).replace("-", "−") + ' %</span> <span class="doux">vs ' + E(nomJour) + (estAuj && direct ? " dernier, même heure" : " dernier") + "</span>";
          if (estAuj && direct) {
            // Aujourd'hui en cours : on compare à la même heure la semaine dernière (pas à la journée entière)
            var vRef = ref.parHeure && ref.parHeure[cle] !== undefined ? ref.parHeure[cle] : null;
            if (vRef !== null) { p = pct(v, vRef); delta = p === null ? '<span class="doux">pas de comparaison</span>' : '<span class="' + (p > 0 ? "delta-bon" : p < 0 ? "delta-mauvais" : "doux") + '">' + (p > 0 ? "▲ +" : p < 0 ? "▼ " : "= ") + String(p).replace("-", "−") + ' %</span> <span class="doux">vs ' + E(nomJour) + " dernier à la même heure</span>"; }
          }
          return '<div class="kpi tuile' + (vivant && flash ? " flash" : "") + '" style="--couleur:' + couleur + '"><div class="tuile-tete"><span class="tuile-ico">' + icone + '</span><div class="kpi-l">' + libelle + "</div>" +
            (vivant && direct ? '<span class="pastille-direct" title="Mis à jour en direct"><i></i>Direct</span>' : "") + "</div>" +
            '<div class="kpi-v">' + fmt(v) + '</div><div class="tuile-delta">' + delta + "</div>" + spark(serie.map(function (j) { return j[cle]; }), couleur) + "</div>";
        }
        var tuiles = '<div class="kpis" style="--n:4">' + tuile("#d99a1e", IC.ttc, "CA TTC", "turnover", A.euro, true) + tuile("#3b7dd8", IC.ht, "CA HT", "turnoverHT", A.euro, true) +
          tuile("#1f9d55", IC.cov, "Nb. de couverts", "guestCount", A.entier, true) + tuile("#8e5bd0", IC.moy, "Couvert moyen", "averageGuest", A.euro, false) + "</div>";

        // Derniers encaissements (en direct)
        var nouveaux = et.nouveaux || [];
        et.nouveaux = [];
        var fil = res[3].length ? '<div class="fil-direct">' + res[3].map(function (c) {
          return '<a class="fd-ligne' + (nouveaux.indexOf(c.id) >= 0 ? " nouveau" : "") + '" href="#/orders?cmd=' + encodeURIComponent(c.id) + "&dateStart=" + jour + "&dateEnd=" + jour + '"><span class="fd-heure">' + E(c.heure) + '</span><span class="fd-quoi"><b>' + E(lieu(c)) + '</b><span class="doux petit">' + E(c.resume) + '</span></span><span class="icone-pay" title="' + E(c.paiement) + '">' +
            iconePaiement(c.paiement) + '</span><b class="fd-montant">' + A.euro(c.total) + "</b></a>";
        }).join("") + "</div>" : A.vide(estAuj ? "Pas encore d'encaissement aujourd'hui" : "Aucun encaissement");
        var carteFil = A.carte((estAuj ? "Derniers encaissements" : "Derniers encaissements d'hier") + (direct ? ' <span class="pastille-direct"><i></i>Direct</span>' : ""), fil, { droite: lienBloc("/orders?dateStart=" + jour + "&dateEnd=" + jour, "Commandes"), classe: "bloc-accueil" });

        // Objectif du mois
        var carteObj;
        if (objMois && ventesObj) {
          var auj = A.aujourdhui(), total = Math.round((new Date(objMois.fin) - new Date(objMois.debut)) / 86400000) + 1, ecoules = Math.round((new Date(auj) - new Date(objMois.debut)) / 86400000) + 1;
          var realise = objMois.base === "ht" ? ventesObj.totalSalesWithoutTaxes : ventesObj.totalSales, part = Math.min(1, ecoules / total), attendu = objMois.ca * part, ecart = realise - attendu;
          var p = realise / objMois.ca * 100, proj = part ? realise / part : realise;
          carteObj = A.carte(E(objMois.nom) + " " + NOUVEAU, '<div class="obj-accueil"><div class="obj-haut"><span class="obj-pct ' + (p >= 100 ? "vert" : "") + '">' + A.decimal(p) + ' %</span><span class="doux">' + A.euro(realise) + " sur " + A.euro(objMois.ca) + "</span></div>" +
            '<div class="obj-barre"><i class="' + (ecart >= 0 ? "ok" : "ko") + '" style="width:' + Math.min(100, p) + '%"></i><b style="left:' + Math.min(100, part * 100) + '%" title="Attendu à ce jour"></b></div>' +
            '<div class="obj-detail"><div><span>Écart</span><b class="' + (ecart >= 0 ? "vert" : "rouge") + '">' + (ecart >= 0 ? "+" : "−") + A.euro(Math.abs(ecart)) + (ecart >= 0 ? " d'avance" : " de retard") + "</b></div>" +
            "<div><span>Projection fin de mois</span><b>" + A.euro(proj) + " (" + Math.round(proj / objMois.ca * 100) + " %)</b></div></div></div>", { droite: lienBloc("/reports/objectifs", "Objectifs"), classe: "bloc-accueil" });
        } else carteObj = A.carte("Objectif du mois " + NOUVEAU, A.vide("Aucun objectif en cours") + '<p class="centre"><a class="bouton" href="#/reports/objectifs">Fixer un objectif</a></p>', { classe: "bloc-accueil" });

        // Midi / soir
        var totCa = k.midi.turnover + k.soir.turnover, totCov = k.midi.guestCount + k.soir.guestCount;
        function part2(v, t) { return t ? Math.round(v / t * 100) : 0; }
        function moitie(nom, s, couleur, emoji) {
          return '<div class="ms-bloc"><div class="ms-nom"><span>' + emoji + "</span>" + nom + "</div>" +
            '<div class="ms-chiffre">' + A.euro(s.turnover) + '<span class="doux"> · ' + part2(s.turnover, totCa) + " % du CA</span></div>" +
            '<div class="ms-barre"><i style="width:' + part2(s.turnover, totCa) + "%;background:" + couleur + '"></i></div>' +
            '<div class="doux petit">' + A.entier(s.guestCount) + " couverts" + (s.guestCount ? " · " + A.euro(s.turnover / s.guestCount) + " par couvert" : "") + "</div></div>";
        }
        var service = A.carte("Midi / soir", totCa ? '<div class="ms-corps"><div class="ms-cumul"><i style="width:' + part2(k.midi.turnover, totCa) + '%;background:#e8a33d"></i><i style="flex:1;background:#4a5fc1"></i></div>' +
          '<div class="ms-deux">' + moitie("Midi", k.midi, "#e8a33d", "☀️") + moitie("Soir", k.soir, "#4a5fc1", "🌙") + "</div>" +
          '<div class="doux petit">Midi : avant 16 h · Soir : à partir de 16 h</div></div>' : A.vide("Pas encore de vente ce jour-là"), { classe: "bloc-accueil" });

        // Alertes de stock
        var alertes = res[5];
        var carteAlertes = A.carte("Alertes de stock " + NOUVEAU, alertes.length ? '<div class="liste-alertes">' + alertes.slice(0, 5).map(function (a) {
          return '<a class="la-ligne" href="#/reports/stocks"><span>' + E(a.productName) + '</span><span class="la-detail ' + (a.quantity === 0 ? "rupture" : "") + '">' + (a.quantity === 0 ? "Rupture" : "Stock " + a.quantity) + " · seuil " + a.seuil + "</span></a>";
        }).join("") + "</div>" : '<div class="ok-stock">✓ Aucun produit sous son seuil de réapprovisionnement.</div>', { droite: lienBloc("/reports/stocks", "Stocks"), classe: "bloc-accueil" });

        // Météo des 7 prochains jours
        var carteMeteo = meteoCarte(res[1], res[2]);

        // Réservations du jour
        var rs = res[6], vivantes = rs.reservations.filter(function (r) { return r.statut !== "Annulé" && r.statut !== "Non venu"; });
        var maintenant = new Date(), hm = ("0" + maintenant.getHours()).slice(-2) + ":" + ("0" + maintenant.getMinutes()).slice(-2);
        var aVenir = estAuj ? vivantes.filter(function (r) { return r.heure >= hm; }) : [];
        var montrer = (aVenir.length ? aVenir : vivantes).slice(0, 4);
        var carteResa = A.carte((estAuj ? "Réservations du jour" : "Réservations d'hier"), '<div class="resa-resume"><div><b>' + A.entier(rs.reservations.length) + "</b><span>réservations</span></div><div><b>" + A.entier(rs.totalNumberOfGuests) + "</b><span>couverts</span></div>" +
          (estAuj ? "<div><b>" + A.entier(aVenir.length) + "</b><span>à venir</span></div>" : "") + "</div>" +
          (montrer.length ? '<div class="resa-liste">' + montrer.map(function (r) { return '<div class="resa-ligne"><span class="fd-heure">' + E(r.heure) + "</span><span>" + E(r.nom) + (r.note ? ' <span class="doux petit">· ' + E(r.note) + "</span>" : "") + '</span><span class="doux">' + r.couverts + " pers.</span>" + badgeResa(r.statut) + "</div>"; }).join("") + "</div>" : '<p class="doux centre">Aucune réservation.</p>'),
          { droite: lienBloc("/reservations", "Réservations"), classe: "bloc-accueil" });

        // Meilleures ventes du jour
        var top = res[7];
        var carteTop = A.carte(estAuj ? "Meilleures ventes du jour" : "Meilleures ventes d'hier", top.length ? A.table([{ t: "Produit" }, { a: "d", t: "Quantité" }, { a: "d", t: "Total" }],
          top.map(function (p) { return ['<span class="ic-nom"><i class="carre" style="background:' + p.couleur + '"></i>' + E(p.name) + "</span>", A.entier(p.quantity), A.euro(p.total)]; }), null, { classe: "zebre" }) : A.vide("Pas encore de vente"),
          { droite: lienBloc("/reports/sales-report/products?dateStart=" + jour + "&dateEnd=" + jour, "Produits"), classe: "bloc-accueil" });

        // Assistant
        var questions = ["Top 10 des produits ce mois-ci", "Chiffre d'affaires des 30 derniers jours", "Affluence par heure le samedi"];
        A.act.demander = function (q) { if (A.chatbot) { A.chatbot.ouvrir(); A.chatbot.repondre(q); } };
        var carteAssistant = '<div class="carte assistant-accueil"><div class="aa-ico">💬</div><div class="aa-texte"><b>Demandez à l\'assistant Pop\'IA ' + NOUVEAU + '</b><span class="doux">Une question en français, un chiffre ou un graphique en retour.</span></div>' +
          '<div class="aa-questions">' + questions.map(function (q) { return '<button class="bouton" data-act="demander" data-val="' + E(q) + '">« ' + E(q) + " »</button>"; }).join("") + "</div></div>";

        zone.innerHTML = tete + tuiles + '<div class="deux-col">' + carteFil + carteObj + "</div>" + '<div class="deux-col">' + service + carteAlertes + "</div>" + carteMeteo +
          '<div class="deux-col">' + carteResa + carteTop + "</div>" + carteAssistant;
        setTimeout(function () { Array.prototype.forEach.call(zone.querySelectorAll(".flash,.fd-ligne.nouveau"), function (x) { x.classList.add("fini"); }); }, 2500);
      }
      function meteoCarte(prev, impact) {
        if (!meteo || !prev) return "";
        return A.carte("Météo des 7 prochains jours · " + E(prev.ville) + " " + NOUVEAU, A.meteo.grille(prev.jours, impact), { droite: '<a class="bouton" href="#/reports/forecast">Prévisions</a>', classe: "bloc-accueil" });
      }
    }
  });
  function badgeResa(s) {
    var cl = { "Arrivé": "ok", "Confirmée": "ok", "En attente": "neutre", "En retard": "attention", "Annulé": "ko", "Non venu": "ko" }[s] || "neutre";
    return '<span class="badge-bon ' + cl + '">' + E(s) + "</span>";
  }
  A.badgeResa = badgeResa;

  // ======================================================================
  // Commandes
  // ======================================================================
  var MODES = ["Carte de crédit", "Espèces", "Chèque", "Chèque Vacances", "Titre restaurant", "Compte client", "Cagnotte", "Virement", "Paiement en ligne"];
  var SALLES = ["Salle", "Terrasse", "Comptoir", "Véranda", "À emporter"];
  var EQUIPE = ["Gérant", "Alice", "Bruno", "Chloé", "David", "Emma", "Farid", "Gaëlle", "Hugo", "Inès", "Jules", "Karim", "Commande en ligne"];
  A.ecran("/orders", {
    section: null, periodeJour: true, fil: ["Commandes"], actions: function () { return A.bouton("Exporter CSV", "export", { classe: "bouton-export", chevron: true }); },
    filtres: ["periode", function (ctx) {
      var et = ctx.etat, f = et.filtres || (et.filtres = {});
      function rafraichir(cle) { return function (v) { f[cle] = v; ctx.rafraichir(); }; }
      return A.liste("o-pay", "Tous les modes de paiement", MODES.map(function (x) { return [x, x]; }), f.paiement, rafraichir("paiement")) +
        A.liste("o-st", "Tous les statuts", [["paid", "Payé"], ["cancelled", "Annulé"]], f.statut, rafraichir("statut")) +
        A.liste("o-sa", "Toutes les salles", SALLES.map(function (x) { return [x, x]; }), f.salle, rafraichir("salle")) +
        A.liste("o-em", "Tous les employés", EQUIPE.map(function (x) { return [x, x]; }), f.employe, rafraichir("employe")) +
        A.liste("o-fp", "Filtrer par", [["table", "Table"], ["produit", "Produit"]], f.critere, function (v) { f.critere = v; if (!v) f.q = ""; ctx.rafraichir(); }) +
        (f.critere ? '<label class="champ-recherche">' + A.icones.loupe + '<input type="search" id="o-q" placeholder="' + (f.critere === "table" ? "N° de table (ex. S4)" : "Nom du produit") + '" value="' + E(f.q || "") + '"></label>' : "");
    }],
    rendre: function (ctx, zone) {
      var f = ctx.etat.filtres || {};
      var q = document.getElementById("o-q");
      if (q) q.onchange = function () { f.q = q.value; ctx.rafraichir(); };
      D.getOrders({ dateStart: ctx.periode.dateStart, dateEnd: ctx.periode.dateEnd, paiement: f.paiement, statut: f.statut, salle: f.salle, employe: f.employe, critere: f.critere, recherche: f.q }).then(function (r) {
        var tous = [];
        r.jours.forEach(function (j) { j.commandes.forEach(function (c) { tous.push(c.id); }); });
        A.act.export = function () {
          var l = [];
          r.jours.forEach(function (j) { j.commandes.forEach(function (c) { l.push([j.date, c.heure, c.salle, c.table, c.produits.map(function (p) { return p.nom; }).join(", "), c.statut === "paid" ? "Payé" : "Annulé", c.paiement, A.montantCsv(c.total)]); }); });
          A.telechargerCsv("commandes.csv", ["Date", "Heure", "Salle", "Table", "Produits", "Statut", "Paiement", "Total"], l);
        };
        if (!r.jours.length) {
          var lib = A.libellePeriode(ctx.periode).toLowerCase();
          zone.innerHTML = '<div class="carte"><div class="etat-vide haut"><div class="tilde">∼</div><h3 class="fin">Aucune commande</h3><p class="doux">Pas de commande trouvée pour ' + E(lib) + (f.paiement || f.statut || f.salle || f.employe || f.q ? " avec ces filtres" : "") + "</p></div></div>";
          return;
        }
        zone.innerHTML = r.jours.map(function (j) {
          return '<section class="jour-commandes"><h2>' + A.dateLongue(j.date) + '</h2><div class="doux droite petit">' + (j.fermeA ? "Caisse fermée à " + j.fermeA : '<span class="point-direct"></span>Caisse en cours') + "</div>" +
            j.commandes.map(function (c) {
              return '<div class="commande" data-act="cmd" data-val="' + c.id + '"><span class="heure">' + c.heure + '</span><span class="cmd-lieu doux petit">' + E(c.salle === "À emporter" ? "À emporter" : c.table) + "</span>" +
                '<span class="produits">' + c.produits.map(function (p) { return p.annule ? "<s>" + E(p.nom) + "</s>" : E(p.nom); }).join(", ") + '</span><span class="td-espace"></span>' +
                (c.enLigne ? '<span class="puce">En ligne</span>' : "") +
                '<span class="statut ' + c.statut + '"><i></i>' + (c.statut === "paid" ? "Payé" : "Annulé") + '</span><span class="icone-pay" title="' + E(c.paiement) + '">' + iconePaiement(c.paiement) + '</span><b class="total">' + A.euro(c.total) + "</b></div>";
            }).join("") + '<div class="doux petit">Caisse ouverte à ' + j.ouvertA + "</div></section>";
        }).join("");
        function ouvrir(id) {
          D.getOrderById(id).then(function (o) {
            if (!o) { A.info("Commande introuvable."); return; }
            var idx = tous.indexOf(id), ok = o.statut === "paid";
            var lignes = o.lignes.map(function (l) {
              return "<tr><td>" + l.quantite + "</td><td><b>" + E(l.produit) + "</b>" + (l.options.length || l.menu ? '<div class="doux petit">' + E(l.options.concat(l.menu ? [l.menu] : []).join(", ")) + "</div>" : "") + '</td><td class="d mono">' + A.euro(l.prix) + "</td></tr>";
            }).join("") + o.annules.map(function (a) { return '<tr class="annulee"><td>' + a.quantite + "</td><td><s>" + E(a.produit) + '</s><div class="doux petit">Annulé : ' + E(a.motif) + '</div></td><td class="d mono">-</td></tr>'; }).join("");
            function repliable(titre, corps, ouvert) {
              return '<div class="repliable' + (ouvert ? " ouvert" : "") + '"><button class="repliable-t" data-act="repl"><span>' + titre + '</span><i class="trait-t"></i>' + A.icones.bas + '</button><div class="repliable-c">' + corps + "</div></div>";
            }
            var pays = o.paiements.map(function (p) { return E(p.nom) + " : " + A.euro(p.montant) + (p.pourboire ? " (+ " + A.euro(p.pourboire) + " de pourboire)" : ""); }).join("<br>");
            var enLigne = o.enLigne ? A.table([{ t: "Référence" }, { t: "Canal" }, { t: "Commandée à" }, { a: "d", t: "Montant" }, { t: "Statut" }],
              [['<span class="mono">' + E(o.enLigne.ref) + "</span>", E(o.enLigne.canal), E(o.enLigne.commandeA), A.euro(o.enLigne.montant), '<span class="badge-bon ok">Payée en ligne</span>']]) : '<div class="doux petit">Aucune transaction en ligne.</div>';
            var t = A.tiroir('<div class="tiroir-tete"><div><h3>' + A.dateMoyenne(o.date) + " • " + o.heure + '</h3><div class="doux">' + E(o.salle === "À emporter" ? "À emporter " + o.table : o.salle + " " + o.table) + " • " + A.euro(o.total) + " • " + E(o.serveur) + " • " + o.couverts + ' Couverts</div></div><button class="fermer" data-act="fermer-tiroir">✕</button></div>' +
              '<div class="tiroir-corps"><div class="bandeau-statut ' + (ok ? "ok" : "ko") + '"><span class="rond">' + (ok ? "✓" : "✕") + "</span>" + (ok ? (o.impaye ? "Payé sur compte client (à régler)" : "Payé") : "Annulé") + "</div>" +
              repliable("Autres propriétés", '<div class="doux petit">Règlement : ' + (pays || E(o.paiement)) + "<br>N° fiscal : " + E(o.numeroFiscal) + (o.remise ? "<br>Remise : " + E(o.remise.nom) + " (" + A.euro(o.remise.montant) + ")" : "") +
                (o.client ? '<br>Client : <a class="lien-souligne" href="#/customers/view/' + E(o.client.id) + '">' + E(o.client.nom) + "</a>" : "") + "</div>", !!o.client) +
              repliable("Détails du ticket", '<table class="ticket-table"><thead><tr><th class="g">Quantité</th><th class="g">Produit</th><th>Prix</th></tr></thead><tbody>' + lignes + '<tr class="total"><td>Total</td><td></td><td class="d mono">' + A.euro(o.total) + "</td></tr></tbody></table>", true) +
              repliable("Transactions en ligne", enLigne, !!o.enLigne) + '<div id="envoi-mail"></div></div>' +
              '<div class="tiroir-pied"><button class="bouton-icone" data-act="nav" data-val="1" aria-label="Commande suivante">⌄</button><button class="bouton-icone" data-act="nav" data-val="-1" aria-label="Commande précédente">⌃</button><span>Navigation</span><span class="td-espace"></span>' +
              '<button class="bouton sombre" data-act="mail">Envoyer le ticket par email</button><button class="bouton sombre" data-act="pdfc">Télécharger le PDF</button></div>');
            A.act.repl = function (v, el) { el.parentNode.classList.toggle("ouvert"); };
            A.act.nav = function (v) { var n = tous[idx + (+v)]; if (n) ouvrir(n); };
            A.act.mail = function () {
              var z = t.querySelector("#envoi-mail");
              z.innerHTML = '<div class="envoi-mail"><label>Adresse e-mail du client<input type="email" id="mail-dest" placeholder="client@exemple.fr"></label><button class="bouton sombre" id="mail-ok">Envoyer</button><div class="stk-erreur" id="mail-err"></div></div>';
              var champMail = z.querySelector("#mail-dest");
              champMail.focus();
              function envoyer() {
                var v = champMail.value.trim();
                if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) { z.querySelector("#mail-err").textContent = "Adresse e-mail invalide."; return; }
                z.innerHTML = '<div class="bandeau-ok">✓ Ticket du ' + A.dateMoyenne(o.date) + " envoyé à " + E(v) + ".</div>";
                A.info("Ticket envoyé à " + v + ".");
              }
              z.querySelector("#mail-ok").onclick = envoyer;
              champMail.onkeydown = function (e) { if (e.key === "Enter") envoyer(); };
            };
            A.act.pdfc = function () { window.print(); };
          });
        }
        A.act.cmd = ouvrir;
        if (ctx.params.cmd && !ctx.etat.cmdOuverte) { ctx.etat.cmdOuverte = ctx.params.cmd; ouvrir(ctx.params.cmd); }
      });
    }
  });

  // ======================================================================
  // Réservations
  // ======================================================================
  function tiroirReservation(dateDefaut, apres) {
    var heure = "20:00";
    A.tiroirFormulaire("Nouvelle réservation", "Le client reçoit une confirmation par SMS (simulée).",
      champ("rs-nom", "Nom du client", "", { ph: "ex. Martin" }) + champ("rs-tel", "Téléphone (facultatif)", "", { type: "tel", ph: "06 …" }) +
      champ("rs-date", "Date", dateDefaut < A.aujourdhui() ? A.aujourdhui() : dateDefaut, { type: "date", min: A.aujourdhui() }) + champ("rs-heure", "Heure", heure, { type: "time", step: 900 }) +
      champ("rs-couverts", "Nombre de couverts", 2, { type: "number", min: 1, max: 40, inputmode: "numeric" }) + champ("rs-note", "Note (facultatif)", "", { ph: "ex. Terrasse, anniversaire…", maxlength: 80 }),
      "Enregistrer la réservation", function (v) {
        return D.createReservation({ nom: v("rs-nom"), tel: v("rs-tel"), date: v("rs-date"), heure: v("rs-heure"), couverts: v("rs-couverts"), note: v("rs-note") })
          .then(function (r) { A.fermerTiroir(); A.info("Réservation enregistrée : " + r.nom + ", " + A.dateMoyenne(r.date) + " à " + r.heure + "."); apres(r.date); });
      });
  }
  A.ecran("/reservations", {
    section: null, fil: ["Réservation"],
    actions: function () { return A.bouton("Export CSV", "resaExport", { classe: "sombre" }) + A.bouton("Ajouter une réservation", "resaAjout", { classe: "sombre" }); },
    filtres: function (ctx) { return '<label class="date-champ">📅 <input type="date" id="resa-date" value="' + (ctx.etat.date || A.aujourdhui()) + '"></label>'; },
    rendre: function (ctx, zone) {
      var et = ctx.etat, date = et.date || A.aujourdhui(), onglet = et.onglet || "toutes", q = et.q || "";
      document.getElementById("resa-date").onchange = function () { et.date = this.value; ctx.rafraichir(); };
      A.act.resaAjout = function () { tiroirReservation(date, function (d) { et.date = d; ctx.rafraichir(); }); };
      D.getReservationList(date).then(function (r) {
        var l = r.reservations.filter(function (x) { return !q || x.nom.toLowerCase().indexOf(q.toLowerCase()) >= 0; });
        var attente = l.filter(function (x) { return x.statut === "En attente" || x.statut === "Confirmée"; }), retard = l.filter(function (x) { return x.statut === "En retard"; }), arrives = l.filter(function (x) { return x.statut === "Arrivé"; });
        var vue = onglet === "attente" ? attente : onglet === "retard" ? retard : onglet === "arrives" ? arrives : l;
        A.act.onglet = function (o) { et.onglet = o; ctx.rafraichir(); };
        A.act.resaExport = function () {
          A.telechargerCsv("reservations-" + date + ".csv", ["Date", "Heure", "Client", "Téléphone", "Couverts", "Statut", "Note"], r.reservations.map(function (x) { return [date, x.heure, x.nom, x.tel || "", x.couverts, x.statut, x.note || ""]; }));
        };
        A.act.resaVoir = function (id) {
          var x = r.reservations.filter(function (y) { return y.id === id; })[0];
          if (!x) return;
          var t = A.tiroir('<div class="tiroir-tete"><div><h3>' + E(x.nom) + '</h3><span class="doux">' + A.dateMoyenne(x.date) + " à " + E(x.heure) + " · " + x.couverts + " couverts</span></div>" +
            '<button class="fermer" data-act="fermer-tiroir">✕</button></div><div class="tiroir-corps"><p>Statut : ' + badgeResa(x.statut) + "</p>" + (x.tel ? "<p>Téléphone : " + E(x.tel) + "</p>" : "") + (x.note ? "<p>Note : " + E(x.note) + "</p>" : "") +
            (x.clientId ? '<p><a class="lien-souligne" href="#/customers/view/' + E(x.clientId) + '">Voir la fiche client</a></p>' : "") +
            '<h4 class="stk-titre">Changer le statut</h4><div class="resa-statuts">' + ["Confirmée", "Arrivé", "En retard", "Annulé", "Non venu"].map(function (s) { return '<button class="bouton' + (s === x.statut ? " sombre" : "") + '" data-statut="' + s + '">' + s + "</button>"; }).join("") + "</div></div>");
          t.addEventListener("click", function (e) {
            var b = e.target.closest("[data-statut]");
            if (!b) return;
            D.setReservationStatus(x.id, b.getAttribute("data-statut")).then(function () { A.fermerTiroir(); A.info("Réservation de " + x.nom + " : " + b.getAttribute("data-statut") + "."); ctx.rafraichir(); });
          });
        };
        zone.innerHTML = A.kpis([["Nombre de réservations", A.entier(r.reservations.length)], ["Nombre de couverts", A.entier(r.totalNumberOfGuests)]]) +
          A.carte("Réservations", '<div class="td-barre"><span class="td-espace"></span><label class="champ-recherche">' + A.icones.loupe + '<input type="search" placeholder="Rechercher un client" id="resa-q" value="' + E(q) + '"></label></div>' +
            '<div class="onglets-bouton plein">' + [["toutes", "Toutes (" + l.length + ")"], ["attente", "En attente (" + attente.length + ")"], ["retard", "En retard (" + retard.length + ")"], ["arrives", "Arrivés (" + arrives.length + ")"]].map(function (o) {
              return '<button class="' + (o[0] === onglet ? "actif" : "") + '" data-act="onglet" data-val="' + o[0] + '">' + o[1] + "</button>";
            }).join("") + "</div>" +
            (vue.length ? A.table([{ t: "Heure" }, { t: "Client" }, { a: "d", t: "Couverts" }, { t: "Statut" }, { t: "Note" }], vue.map(function (x) {
              return ['<a class="lien-ligne" data-act="resaVoir" data-val="' + E(x.id) + '">' + E(x.heure) + "</a>", '<a class="lien-ligne" data-act="resaVoir" data-val="' + E(x.id) + '">' + E(x.nom) + "</a>", x.couverts, badgeResa(x.statut), E(x.note || "")];
            }), null, { classe: "zebre" }) : A.vide("Aucune réservation pour ce jour")), { classe: "avec-tableau" });
        document.getElementById("resa-q").onchange = function () { et.q = this.value; ctx.rafraichir(); };
      });
    }
  });

  // ======================================================================
  // Clients
  // ======================================================================
  function formClient(c) {
    c = c || {};
    return champ("cl-nom", "Nom et prénom", c.name || "", { ph: "ex. Louise Martin" }) + champ("cl-tel", "Téléphone", c.phone || "", { type: "tel" }) + champ("cl-mail", "E-mail", c.email || "", { type: "email" }) +
      champ("cl-adr", "Adresse", c.address || "") + champ("cl-cp", "Code postal", c.zip || "", { inputmode: "numeric", maxlength: 5 }) + champ("cl-ville", "Ville", c.city || "") +
      champ("cl-ent", "Entreprise (facultatif)", c.company || "") + champ("cl-com", "Commentaire (facultatif)", c.comment || "", { maxlength: 120 });
  }
  function lireClient(v) { return { name: v("cl-nom"), phone: v("cl-tel"), email: v("cl-mail"), address: v("cl-adr"), zip: v("cl-cp"), city: v("cl-ville"), company: v("cl-ent"), comment: v("cl-com") }; }
  A.ecran("/customers", {
    section: "clients", fil: ["Fiches clients", "Liste"], actions: function () { return A.bouton("Ajouter un client", "clAjout", { classe: "sombre" }); },
    rendre: function (ctx, zone) {
      A.act.clAjout = function () {
        A.tiroirFormulaire("Nouveau client", "Fiche enregistrée dans Up'Pina.", formClient(), "Créer la fiche", function (v) {
          return D.createCustomer(lireClient(v)).then(function (c) { A.fermerTiroir(); A.info("Fiche de " + c.name + " créée."); A.allerA("/customers/view/" + c.id); });
        });
      };
      D.getCustomers().then(function (l) {
        zone.innerHTML = A.carte("Liste des clients", '<div id="td"></div>', { classe: "avec-tableau" });
        A.monterTable(document.getElementById("td"), {
          colonnes: [{ t: "Nom", k: "name", tri: function (c) { return c.name; } },
            { t: "Solde", f: function (c) { return '<span class="' + (c.solde < 0 ? "rouge" : "") + '">' + A.euro(c.solde) + "</span>"; }, tri: function (c) { return c.solde; } },
            { t: "Total cagnotte", f: function (c) { return '<span class="' + (c.cagnotte > 0 ? "vert" : "") + '">' + A.euro(c.cagnotte) + "</span>"; }, tri: function (c) { return c.cagnotte; } },
            { t: "Commandes", a: "d", f: function (c) { return A.entier(c.orders); }, tri: function (c) { return c.orders; } },
            { t: "Téléphone", k: "phone" }, { t: "Email", k: "email" }, { t: "Ville", k: "city", cache: true }],
          lignes: l, rech: { ph: "Rechercher...", texte: function (c) { return c.name + " " + c.phone + " " + c.email + " " + c.city; } },
          onLigne: function (c) { A.allerA("/customers/view/" + c.id); }
        });
      });
    }
  });
  A.ecran("/customers/view/:id", {
    section: "clients", fil: ["Fiches clients", "..."], actions: function () { return A.bouton("Éditer la fiche client", "clEdit", { classe: "sombre" }); },
    rendre: function (ctx, zone) {
      Promise.all([D.viewCustomer(ctx.ids.id), D.getVouchers(), D.getCustomerOrders(ctx.ids.id)]).then(function (res) {
        var c = res[0], cmds = res[2], et = ctx.etat, onglet = et.onglet || "payees";
        if (!c) { zone.innerHTML = A.vide("Client introuvable"); return; }
        var bons = res[1].filter(function (b) { return b.clientId === c.id && b.statut !== "annule"; }).sort(function (a, b) { return a.expireLe < b.expireLe ? -1 : 1; });
        A.act.clEdit = function () {
          A.tiroirFormulaire("Modifier la fiche client", E(c.name), formClient(c), "Enregistrer", function (v) {
            return D.updateCustomer(c.id, lireClient(v)).then(function () { A.fermerTiroir(); A.info("Fiche client enregistrée."); ctx.rafraichir(); });
          });
        };
        var cartesBons = A.carte("Bons cadeaux (cagnotte : " + A.euro(c.cagnotte) + ")", bons.length ? A.table([{ t: "Code" }, { a: "d", t: "Solde" }, { t: "Fin de validité" }, { t: "Statut" }],
          bons.map(function (b) { return ['<span class="mono">' + E(b.code) + "</span>", A.euro(b.solde), A.dateMoyenne(b.expireLe), badgeStatutBon(b)]; }), null, { classe: "zebre" }) +
          '<p class="doux petit pad-h"><a href="#/customers/vouchers">Gérer les bons cadeaux</a></p>' : A.vide("Aucun bon cadeau"));
        document.querySelector(".fil b").textContent = c.name;
        function champC(t, v, tel) { return '<div class="kpi grand"><div class="kpi-l">' + t + '</div><div class="kpi-v ' + (v ? "" : "gris") + '">' + (v ? E(v) + (tel ? " " + A.icones.autre : "") : "Non renseigné") + "</div></div>"; }
        A.act.onglet = function (o) { et.onglet = o; ctx.rafraichir(); };
        var liste = onglet === "impayees" ? cmds.impayees : onglet === "depots" ? cmds.depots : cmds.payees;
        var tableau = onglet === "depots" ? (liste.length ? A.table([{ t: "Date" }, { t: "Motif" }, { t: "Mode" }, { a: "d", t: "Montant" }], liste.map(function (x) { return [A.dateMoyenne(x.date), E(x.note), E(x.mode), A.euro(x.montant)]; }), null, { classe: "zebre" }) : A.vide("Aucun dépôt")) :
          (liste.length ? A.table([{ t: "Date" }, { t: "Heure" }, { t: "Table" }, { a: "d", t: "Couverts" }, { t: "Paiement" }, { a: "d", t: "Montant" }], liste.map(function (x) {
            return ['<a class="lien-souligne" href="#/orders?cmd=' + encodeURIComponent(x.id) + "&dateStart=" + x.date + "&dateEnd=" + x.date + '">' + A.dateMoyenne(x.date) + "</a>", x.heure, E(x.salle + " " + x.table), x.couverts, E(x.paiement), A.euro(x.total)];
          }), null, { classe: "zebre" }) : A.vide(onglet === "impayees" ? "Aucune commande impayée" : "Aucune commande"));
        zone.innerHTML = '<div class="kpi grand"><div class="kpi-l">Nom prénom</div><div class="kpi-v"><span class="badge-site">' + E(A.siteSigle) + "</span> " + E(c.name) + "</div></div>" +
          '<div class="deux-col">' + champC("Téléphone", c.phone, true) + champC("Email", c.email) + champC("Adresse", c.address) + champC("Complément d'adresse", "") + champC("Ville", c.city) + champC("Code postal", c.zip) + "</div>" +
          champC("Entreprise", c.company) + (c.comment ? champC("Commentaire", c.comment) : "") + '<div class="deux-col">' + champC("Nombre de commandes", String(c.orders)) + champC("Commandes impayées", String(c.unpaid) + (c.solde < 0 ? " · " + A.euro(-c.solde) + " dus" : "")) + "</div>" +
          cartesBons +
          A.carte("", '<div class="onglets-bouton plein">' + [["payees", "Commandes payées (" + cmds.payees.length + ")"], ["impayees", "Commandes impayées (" + cmds.impayees.length + ")"], ["depots", "Dépôts (" + cmds.depots.length + ")"]].map(function (o) {
            return '<button class="' + (o[0] === onglet ? "actif" : "") + '" data-act="onglet" data-val="' + o[0] + '">' + o[1] + "</button>";
          }).join("") + "</div>" + tableau);
      });
    }
  });

  // ======================================================================
  // Bons cadeaux (gardés dans le navigateur)
  // ======================================================================
  var LIB_STATUT_BON = { actif: "Actif", expire: "Expiré", epuise: "Utilisé", annule: "Annulé" };
  var CLASSE_STATUT_BON = { actif: "ok", expire: "ko", epuise: "neutre", annule: "neutre" };
  function badgeStatutBon(b) { return '<span class="badge-bon ' + CLASSE_STATUT_BON[b.statut] + '">' + LIB_STATUT_BON[b.statut] + "</span>"; }
  function joursRestants(iso) { return Math.round((A.depuisIso(iso).getTime() - A.depuisIso(A.aujourdhui()).getTime()) / 86400000); }
  function texteDelai(j) {
    if (j === 0) return "aujourd'hui";
    if (j === 1) return "demain";
    if (j > 1) return "dans " + j + " j";
    return "il y a " + (-j) + " j";
  }
  // Date de fin + délai coloré : rouge ≤ 7 j ou expiré, orange ≤ 30 j
  function celluleValidite(b) {
    var j = joursRestants(b.expireLe), cl = "";
    if (b.statut === "expire") cl = "ko";
    else if (b.statut === "actif") cl = j <= 7 ? "ko" : j <= 30 ? "attention" : "neutre";
    return A.dateMoyenne(b.expireLe) + (cl ? ' <span class="badge-bon ' + cl + '">' + (b.statut === "expire" ? "expiré " : "") + texteDelai(j) + "</span>" : "");
  }
  var LIB_HIST_BON = { creation: "Création", debit: "Utilisation", validite: "Validité modifiée", annulation: "Annulation" };

  // Tiroir de création (b = null) ou de gestion d'un bon. rafraichir() recharge l'écran.
  function tiroirBon(b, clients, rafraichir) {
    var t = A.tiroir(""), creation = !b, ferme = !creation && (b.statut === "epuise" || b.statut === "annule");
    var base = creation ? A.aujourdhui() : (b.statut === "expire" ? A.aujourdhui() : b.expireLe);
    var DUREES = [["+ 1 mois", 1], ["+ 3 mois", 3], ["+ 6 mois", 6], ["+ 1 an", 12], ["+ 2 ans", 24]];
    var MONTANTS = [20, 30, 50, 75, 100, 150];
    function val(id) { var c = document.getElementById(id); return c ? c.value : ""; }
    function erreur(m) { var e = document.getElementById("bon-err"); if (e) e.textContent = m || ""; }
    function apercu() {
      var m = creation ? parseFloat(val("bon-montant").replace(",", ".")) : b.solde, fin = val("bon-fin") || (b ? b.expireLe : "");
      var el = document.getElementById("bon-apercu");
      if (!el) return;
      el.innerHTML = '<div class="bon-ap-montant">' + (isFinite(m) && m > 0 ? A.euro(m) : "— €") + '</div><div class="bon-ap-ligne">' + (fin ? "Valable jusqu'au " + A.dateLongue(fin).toLowerCase() : "Choisir une date de fin") + "</div>" +
        '<div class="bon-ap-code">' + (creation ? "Code généré à l'enregistrement" : E(b.code)) + "</div>";
      var aide = document.getElementById("bon-aide");
      if (aide && fin) { var j = joursRestants(fin); aide.textContent = j < 0 ? "Date passée." : "Fin de validité : " + texteDelai(j) + (j > 0 ? " (" + j + " jours)" : ""); }
    }
    function dessiner() {
      var hist = b ? b.historique.slice().reverse() : [];
      t.innerHTML = '<div class="tiroir-tete"><div><h3>' + (creation ? "Nouveau bon cadeau" : "Bon " + E(b.code)) + "</h3>" +
        '<span class="doux">' + (creation ? "Montant, date de fin de validité et bénéficiaire" : badgeStatutBon(b) + " · créé le " + A.dateMoyenne(b.creeLe) + (b.clientNom ? " · " + E(b.clientNom) : "")) + '</span></div><button class="fermer" data-fermer>✕</button></div>' +
        '<div class="tiroir-corps">' +
        '<div class="bon-apercu" id="bon-apercu"></div><div class="stk-form">' +
        (creation ? '<label>Montant (€)<input id="bon-montant" type="number" min="1" step="any" inputmode="decimal"></label>' +
          '<div class="bon-chips">' + MONTANTS.map(function (m) { return '<button type="button" class="bon-chip" data-montant="' + m + '">' + m + " €</button>"; }).join("") + "</div>" : "") +
        (ferme ? "" : '<label>Fin de validité<input id="bon-fin" type="date" min="' + A.aujourdhui() + '" value="' + (creation ? D.ajouterMois(base, 12) : b.expireLe) + '"></label>' +
          '<div class="bon-chips">' + DUREES.map(function (d) { return '<button type="button" class="bon-chip" data-mois="' + d[1] + '">' + (creation ? d[0].replace("+ ", "") : d[0]) + "</button>"; }).join("") + "</div>" +
          '<p class="doux" id="bon-aide"></p>' +
          (!creation && b.statut === "expire" ? '<p class="doux">Ce bon est expiré : choisir une nouvelle date le réactive.</p>' : "")) +
        (creation ? '<label>Bénéficiaire (facultatif)<select id="bon-client"><option value="">Aucun (bon à offrir)</option>' + clients.map(function (c) { return '<option value="' + E(c.id) + '">' + E(c.name) + "</option>"; }).join("") + "</select></label>" : "") +
        '<label>Occasion / note (facultatif)<input id="bon-note" type="text" maxlength="80" value="' + (b ? E(b.note) : "") + '"></label>' +
        '<div class="stk-erreur" id="bon-err"></div></div>' +
        (!creation && b.statut === "actif" ? '<h4 class="stk-titre">Utiliser le bon</h4><div class="bon-ligne"><input id="bon-debit" type="number" min="0" step="any" inputmode="decimal" placeholder="Montant utilisé (solde : ' + b.solde + ' €)"><button class="bouton" data-debiter>Débiter</button></div>' : "") +
        (!creation ? '<h4 class="stk-titre">Historique</h4>' + A.table([{ t: "Date" }, { t: "Événement" }, { a: "d", t: "Montant" }, { t: "Détail" }],
          hist.map(function (h) { return [A.dateMoyenne(h.date), LIB_HIST_BON[h.type], h.montant ? A.euro(h.montant) : "-", E(h.note || "-")]; }), null, { classe: "zebre" }) : "") +
        (!creation && b.statut !== "annule" ? '<p><button class="bouton rouge" data-annuler>Annuler ce bon</button></p>' : "") +
        '</div><div class="tiroir-pied"><button class="bouton" data-fermer>' + (ferme ? "Fermer" : "Annuler") + '</button><span class="td-espace"></span>' +
        (ferme ? "" : '<button class="bouton sombre" data-valider>' + (creation ? "Créer le bon" : "Enregistrer") + "</button>") + "</div>";
      apercu();
    }
    t.addEventListener("input", apercu);
    t.addEventListener("click", function (e) {
      var c = e.target.closest("[data-fermer],[data-valider],[data-montant],[data-mois],[data-debiter],[data-annuler]");
      if (!c) return;
      if (c.hasAttribute("data-fermer")) A.fermerTiroir();
      else if (c.hasAttribute("data-montant")) { document.getElementById("bon-montant").value = c.getAttribute("data-montant"); apercu(); }
      else if (c.hasAttribute("data-mois")) {
        // création : à partir d'aujourd'hui ; gestion : à partir de la fin actuelle (ou d'aujourd'hui si expiré)
        document.getElementById("bon-fin").value = D.ajouterMois(creation ? A.aujourdhui() : (val("bon-fin") && val("bon-fin") > base ? val("bon-fin") : base), +c.getAttribute("data-mois")); apercu();
      } else if (c.hasAttribute("data-debiter")) {
        D.debitVoucher(b.id, val("bon-debit")).then(function () { A.fermerTiroir(); A.info("Bon débité."); rafraichir(); }, function (m) { erreur(String(m)); });
      } else if (c.hasAttribute("data-annuler")) {
        if (window.confirm("Annuler définitivement ce bon cadeau ?")) D.cancelVoucher(b.id).then(function () { A.fermerTiroir(); A.info("Bon annulé."); rafraichir(); });
      } else {
        var p = creation
          ? D.createVoucher({ montant: parseFloat(val("bon-montant").replace(",", ".")), expireLe: val("bon-fin"), clientId: val("bon-client"), note: val("bon-note").trim() })
          : D.updateVoucher(b.id, { expireLe: val("bon-fin"), note: val("bon-note").trim() });
        p.then(function (nb) { A.fermerTiroir(); A.info(creation ? "Bon " + nb.code + " créé." : "Bon mis à jour."); rafraichir(); }, function (m) { erreur(String(m)); });
      }
    });
    dessiner();
    var f = document.getElementById(creation ? "bon-montant" : "bon-fin"); if (f) f.focus();
  }

  A.ecran("/customers/vouchers", {
    section: "clients", fil: ["Fiches clients", "Bons cadeaux"],
    actions: function () { return A.bouton("Créer un bon cadeau", "bonNouveau", { classe: "sombre" }); },
    rendre: function (ctx, zone) {
      Promise.all([D.getVouchers(), D.getCustomers()]).then(function (res) {
        var tous = res[0], clients = res[1], et = ctx.etat, filtre = et.filtre || "actif", tri = et.tri || "fin";
        function proche(b) { return b.statut === "actif" && joursRestants(b.expireLe) <= 30; }
        var nb = { tous: tous.length, actif: 0, proche: 0, expire: 0, clos: 0 }, encours = 0, perdu = 0, montantProche = 0;
        tous.forEach(function (b) {
          if (b.statut === "actif") { nb.actif++; encours += b.solde; }
          if (proche(b)) { nb.proche++; montantProche += b.solde; }
          if (b.statut === "expire") { nb.expire++; perdu += b.solde; }
          if (b.statut === "epuise" || b.statut === "annule") nb.clos++;
        });
        var vue = tous.filter(function (b) {
          return filtre === "tous" || (filtre === "proche" ? proche(b) : filtre === "clos" ? (b.statut === "epuise" || b.statut === "annule") : b.statut === filtre);
        });
        // Tri par défaut : fin de validité la plus proche d'abord
        vue.sort(function (a, b) {
          if (tri === "solde") return b.solde - a.solde;
          if (tri === "recent") return a.creeLe < b.creeLe ? 1 : -1;
          return a.expireLe < b.expireLe ? -1 : a.expireLe > b.expireLe ? 1 : 0;
        });
        function recharger() { ctx.rafraichir(); }
        A.act.bonNouveau = function () { tiroirBon(null, clients, recharger); };
        A.act.bonOuvrir = function (id) { var b = tous.filter(function (x) { return x.id === id; })[0]; if (b) tiroirBon(b, clients, recharger); };
        var puces = [["actif", "Actifs"], ["proche", "Expirent sous 30 j"], ["expire", "Expirés"], ["clos", "Utilisés / annulés"], ["tous", "Tous"]];
        var onglets = '<div class="onglets-bouton plein">' + puces.map(function (p) {
          return '<button class="' + (p[0] === filtre ? "actif" : "") + '" data-act="bonFiltre" data-val="' + p[0] + '">' + p[1] + " (" + nb[p[0]] + ")</button>";
        }).join("") + "</div>";
        A.act.bonFiltre = function (v) { et.filtre = v; ctx.rafraichir(); };
        var triListe = A.liste("bonTri", "Fin de validité : plus proche d'abord", [["solde", "Solde le plus élevé"], ["recent", "Créés récemment"]], tri === "fin" ? "" : tri, function (v) { et.tri = v || "fin"; ctx.rafraichir(); });
        A.act.export = function () {
          A.telechargerCsv("bons-cadeaux.csv", ["Code", "Bénéficiaire", "Montant", "Solde", "Créé le", "Fin de validité", "Statut", "Note"],
            vue.map(function (b) { return [b.code, b.clientNom, A.montantCsv(b.montant), A.montantCsv(b.solde), b.creeLe, b.expireLe, LIB_STATUT_BON[b.statut], b.note]; }));
        };
        zone.innerHTML = A.kpis([["Bons actifs", A.entier(nb.actif)], ["Solde à consommer", A.euro(encours)], ["Expirent sous 30 jours", A.entier(nb.proche) + " · " + A.euro(montantProche)], ["Solde expiré non utilisé", '<span class="' + (perdu ? "rouge" : "") + '">' + A.euro(perdu) + "</span>"]]) +
          A.carte("Bons cadeaux", onglets + '<div id="td"></div>', { classe: "avec-tableau" });
        A.monterTable(document.getElementById("td"), {
          colonnes: [
            { t: "Code", f: function (b) { return '<span class="mono">' + E(b.code) + "</span>"; }, tri: function (b) { return b.code; } },
            { t: "Bénéficiaire", f: function (b) { return b.clientNom ? E(b.clientNom) : '<span class="doux">Bon à offrir</span>'; }, tri: function (b) { return b.clientNom; } },
            { t: "Montant", a: "d", f: function (b) { return A.euro(b.montant); }, tri: function (b) { return b.montant; } },
            { t: "Solde", a: "d", f: function (b) { return "<b>" + A.euro(b.solde) + "</b>"; }, tri: function (b) { return b.solde; } },
            { t: "Créé le", f: function (b) { return A.dateMoyenne(b.creeLe); }, tri: function (b) { return b.creeLe; } },
            { t: "Fin de validité", f: celluleValidite, tri: function (b) { return b.expireLe; } },
            { t: "Statut", f: badgeStatutBon, tri: function (b) { return b.statut; } },
            { t: "Note", f: function (b) { return E(b.note); }, cache: true },
            { t: "", f: function () { return '<span class="bouton-icone">' + A.icones.crayon + "</span>"; }, tri: function () { return 0; } }],
          lignes: vue, pageSize: 20, sansFiltrer: true, filtres: triListe, droite: A.bouton("Exporter CSV", "export", { classe: "bouton-export", chevron: true }),
          vide: "Aucun bon cadeau dans cette catégorie", rech: { ph: "Rechercher un code ou un bénéficiaire", texte: function (b) { return b.code + " " + b.clientNom + " " + b.note; } },
          onLigne: function (b) { A.act.bonOuvrir(b.id); }
        });
      });
    }
  });

  // ======================================================================
  // Intégrations
  // ======================================================================
  A.ecran("/integrations", {
    section: "integrations", fil: ["Intégrations"],
    rendre: function (ctx, zone) {
      D.getIntegrationList().then(function (cats) {
        zone.innerHTML = cats.map(function (c) {
          return '<section class="integ" id="cat-' + E(c.categorie) + '"><div class="titre-groupe"><span>' + E(c.categorie) + "</span></div>" + '<div class="grille-cartes" style="--n:3">' +
            c.integrations.map(function (i) {
              return '<button class="carte-integ" data-act="integ" data-val="' + E(c.categorie + "|" + i.nom) + '"><div class="integ-t"><span class="logo-carre">' + E(i.nom.charAt(0)) + "</span><b>" + E(i.nom) + "</b>" +
                (i.active ? '<span class="badge-bon ok">Activée</span>' : "") + "</div><p>" + E(i.description) + "</p></button>";
            }).join("") + "</div></section>";
        }).join("");
        A.act.integ = function (val) {
          var p = val.split("|"), cat = p[0], nom = p.slice(1).join("|"), i = null;
          cats.forEach(function (c) { c.integrations.forEach(function (x) { if (x.nom === nom && !i) i = x; }); });
          if (!i) return;
          var t = A.tiroir('<div class="tiroir-tete"><div class="integ-t"><span class="logo-carre grand">' + E(i.nom.charAt(0)) + "</span><div><h3>" + E(i.nom) + '</h3><span class="doux">' + E(cat) + "</span></div></div>" +
            '<button class="fermer" data-act="fermer-tiroir">✕</button></div><div class="tiroir-corps"><p>' + E(i.description) + "</p>" +
            '<p class="doux">Statut : ' + (i.active ? '<span class="badge-bon ok">Activée</span>' : '<span class="badge-bon neutre">Non activée</span>') + "</p>" +
            "</div>" +
            '<div class="tiroir-pied"><button class="bouton" data-act="fermer-tiroir">Fermer</button><span class="td-espace"></span><button class="bouton ' + (i.active ? "" : "sombre") + '" data-integ-bascule>' + (i.active ? "Désactiver" : "Activer") + "</button></div>");
          t.querySelector("[data-integ-bascule]").onclick = function () {
            D.setIntegrationActive(i.nom, !i.active).then(function (on) { A.fermerTiroir(); A.info(i.nom + (on ? " est activée." : " est désactivée.")); ctx.rafraichir(); });
          };
        };
        if (ctx.params.cat) {
          var cible = document.getElementById("cat-" + ctx.params.cat);
          if (cible) cible.scrollIntoView({ block: "start" });
        }
      });
    }
  });

  // ======================================================================
  // Quoi de neuf : les nouveautés d'Up'Pina, chacune avec un lien vers son écran
  // ======================================================================
  function boutonNouveaute(n) {
    return n.action === "assistant" ? '<button class="bouton sombre" data-act="ouvrirAssistant">' + E(n.libelle) + " ›</button>" : '<a class="bouton sombre" href="#' + n.lien + '">' + E(n.libelle) + " ›</a>";
  }
  A.actGlobal.ouvrirAssistant = function () { if (A.chatbot) A.chatbot.ouvrir(); };
  A.ecran("/whats-new", {
    section: null, fil: ["Quoi de neuf"],
    rendre: function (ctx, zone) {
      var C = window.Contenus;
      zone.innerHTML = '<div class="carte nouveautes-tete"><div class="nt-texte"><span class="nt-sur">Nouvelle version du back-office</span><h1>Up\'Pina : les chiffres de la caisse, enfin au service des décisions.</h1>' +
        "<p>12 nouveautés autour de 4 objectifs. Tous les écrans d'origine sont conservés : les nouveautés s'ajoutent, rien n'est retiré. Elles sont repérées par le badge " + NOUVEAU + " dans les menus.</p></div>" +
        '<div class="nt-chiffres"><div><b>12</b><span>nouvelles fonctions</span></div><div><b>4</b><span>objectifs</span></div><div><b>0</b><span>modification de la caisse</span></div></div></div>' +
        C.objectifs.map(function (o) {
          return '<section class="nouveautes-groupe" style="--couleur:' + o.couleur + '"><div class="ng-tete"><h2>' + E(o.titre) + '</h2><span class="doux">' + E(o.texte) + "</span></div>" +
            C.nouveautes.filter(function (n) { return n.obj === o.cle; }).map(function (n) {
              return '<article class="carte nouveaute"><div class="nv-num">' + n.n + '</div><div class="nv-corps"><h3>' + E(n.titre) + "</h3><p>" + E(n.resume) + '</p><ul class="liste-points">' +
                n.apports.map(function (a) { return "<li>" + E(a) + "</li>"; }).join("") + '</ul><div class="nv-pied">' + boutonNouveaute(n) + "</div></div></article>";
            }).join("") + "</section>";
        }).join("");
    }
  });

  // ======================================================================
  // Centre d'aide, Documentation, Hygiène Expert
  // ======================================================================
  A.ecran("/help", {
    section: null, bandeau: false,
    rendre: function (ctx, zone) {
      D.getAgencyInfo().then(function (a) {
        zone.innerHTML = '<div class="aide"><div class="ampoule">' + A.icones.cible + '</div><h1>Centre d\'aide</h1><p class="doux">Besoin d\'aide ? Consultez nos guides et nos réponses aux questions les plus fréquentes.</p>' +
          '<div class="carte"><div class="aide-tete">' + E(a.site) + '</div><div class="aide-cellules"><div><b>Référence client</b><div class="doux petit">' + E(a.reference) + "</div></div><div><b>Agence principale</b><div class=\"doux petit\">" + E(a.ville) + '</div></div><div><b>Documentation</b><div class="doux petit"><a href="#/help/documentation">Voir la page ›</a></div></div></div></div>' +
          '<h2>Toutes vos agences</h2>' + a.agences.map(function (g) { return '<div class="agence"><b>' + E(g.nom) + '</b><span class="doux petit">' + A.icones.pin + " " + E(g.adresse) + '</span><span class="doux petit">' + E(g.tel) + "</span></div>"; }).join("") + "</div>";
      });
    }
  });
  A.ecran("/help/documentation", {
    section: null, fil: ["Centre d'aide", "Documentation"],
    rendre: function (ctx, zone) {
      var C = window.Contenus;
      zone.innerHTML = A.carte("Guide des nouveautés", '<p class="doux pad-h">Pas à pas, comment se servir de chaque nouveauté d\'Up\'Pina. Chaque fiche renvoie vers l\'écran concerné.</p>') +
        C.nouveautes.map(function (n) {
          return '<div class="carte doc-fiche"><div class="carte-tete"><h2><span class="doc-num">' + n.n + "</span> " + E(n.titre) + "</h2>" + boutonNouveaute(n) + '</div><div class="carte-corps pad"><p class="doux">' + E(n.resume) + '</p><ol class="doc-etapes">' +
            n.etapes.map(function (e) { return "<li>" + E(e) + "</li>"; }).join("") + "</ol></div></div>";
        }).join("") +
        A.carte("D'où viennent les chiffres", '<div class="carte-corps pad"><ul class="liste-points"><li><b>Démonstration :</b> le restaurant (Crêperie Démo, Rennes), ses ventes, ses clients, ses stocks et ses réservations sont simulés. Les jours passés ne changent pas ; la journée en cours se remplit au fil des encaissements.</li>' +
          "<li><b>Météo :</b> réelle, en direct depuis Open-Meteo (service public gratuit), pour la ville choisie dans le menu du compte.</li><li><b>Lecture seule :</b> Up'Pina ne modifie jamais la caisse ; vos modifications restent dans votre navigateur (menu du compte › Réinitialiser la démo pour tout effacer).</li>" +
          "<li><b>Export comptable :</b> à valider une première fois avec l'expert-comptable (comptes, regroupement, traitement des pourboires).</li></ul></div>");
    }
  });
  A.ecran("/hygiene-expert", {
    section: null, fil: [" "],
    rendre: function (ctx, zone) {
      A.act.retour = function () { history.back(); };
      zone.innerHTML = '<div class="module-off"><h1>Le module HE est désactivé pour cet établissement</h1><p>Veuillez changer d\'établissement ou nous contacter pour activer le module pour l\'établissement actuel.</p><button class="bouton sombre" data-act="retour">Retour</button></div>';
    }
  });
})();
