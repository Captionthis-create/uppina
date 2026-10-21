/*
 * ecrans-autres.js : Accueil, Commandes, Réservations, Clients, Réglages,
 * Intégrations, Quoi de neuf, Centre d'aide, Hygiène Expert.
 */
(function () {
  "use strict";
  var A = App, E = A.echapper, D = DonneesTest;
  A.actGlobal["fermer-tiroir"] = function () { A.fermerTiroir(); };

  function creer(libelle) { A.act.creer = A.nonDispo; return A.bouton(libelle, "creer", { classe: "sombre" }); }
  function pied() { A.act.creer = A.nonDispo; return '<div class="pied-formulaire"><button class="bouton large" data-act="creer">Annuler</button><button class="bouton large inactif" disabled>Sauvegarder</button></div>'; }

  // ======================================================================
  // Accueil
  // ======================================================================
  A.ecran("/", {
    section: null, fil: ["Accueil"],
    rendre: function (ctx, zone) {
      var et = ctx.etat, quand = et.quand || "today";
      D.getHomePage().then(function (h) {
        var k = h[quand];
        A.act.quand = function (v) { et.quand = v; ctx.rafraichir(); };
        zone.innerHTML =
          A.carte("Informations clés", A.kpis([["CA TTC", A.euro(k.turnover)], ["CA HT", A.euro(k.turnoverHT)], ["Nb. de couverts", A.entier(k.guestCount)], ["Couvert moyen", A.euro(k.averageGuest)]]),
            { droite: A.segment("quand", [["yesterday", "Hier"], ["today", "Aujourd'hui"]], quand, A.act.quand) });
      });
    }
  });

  // ======================================================================
  // Commandes
  // ======================================================================
  function iconePaiement(nom) {
    if (nom === "Carte de crédit") return A.icones.carte;
    if (nom === "Espèces") return A.icones.especes;
    return A.icones.autre;
  }
  A.ecran("/orders", {
    section: null, periodeJour: true, fil: ["Commandes"], actions: function () { return A.bouton("Exporter CSV", "export", { classe: "bouton-export", chevron: true }); },
    filtres: ["periode", function (ctx) {
      var et = ctx.etat, f = et.filtres || (et.filtres = {});
      function rafraichir(cle) { return function (v) { f[cle] = v; ctx.rafraichir(); }; }
      var m = ["Carte de crédit", "Espèces", "Chèque", "Chèque Vacances", "Titre restaurant", "Compte client", "Cagnotte", "Virement"];
      return A.liste("o-pay", "Tous les modes de paiement", m.map(function (x) { return [x, x]; }), f.paiement, rafraichir("paiement")) +
        A.liste("o-st", "Tous les statuts", [["paid", "Payé"], ["cancelled", "Annulé"]], f.statut, rafraichir("statut")) +
        A.liste("o-sa", "Toutes les salles", ["Salle", "Terrasse", "Comptoir", "Véranda"].map(function (x) { return [x, x]; }), f.salle, rafraichir("salle")) +
        A.liste("o-em", "Tous les employés", ["Gérant", "Alice", "Bruno", "Chloé", "David", "Emma", "Farid", "Gaëlle", "Hugo", "Inès", "Jules", "Karim"].map(function (x) { return [x, x]; }), f.employe, rafraichir("employe")) +
        A.liste("o-fp", "Filtrer par", [["table", "Table"], ["produit", "Produit"]], f.critere, function (v) { A.info("Filtre libre non disponible dans la copie."); });
    }],
    rendre: function (ctx, zone) {
      var f = ctx.etat.filtres || {};
      D.getOrders({ dateStart: ctx.periode.dateStart, dateEnd: ctx.periode.dateEnd, paiement: f.paiement, statut: f.statut, salle: f.salle, employe: f.employe }).then(function (r) {
        var tous = [];
        r.jours.forEach(function (j) { j.commandes.forEach(function (c) { tous.push(c.id); }); });
        A.act.export = function () {
          var l = [];
          r.jours.forEach(function (j) { j.commandes.forEach(function (c) { l.push([j.date, c.heure, c.produits.map(function (p) { return p.nom; }).join(", "), c.statut === "paid" ? "Payé" : "Annulé", c.paiement, A.montantCsv(c.total)]); }); });
          A.telechargerCsv("commandes.csv", ["Date", "Heure", "Produits", "Statut", "Paiement", "Total"], l);
        };
        if (!r.jours.length) {
          var lib = A.libellePeriode(ctx.periode).toLowerCase();
          zone.innerHTML = '<div class="carte"><div class="etat-vide haut"><div class="tilde">∼</div><h3 class="fin">Aucune donnée</h3><p class="doux">Pas de données trouvées pour ' + E(lib.indexOf("'") >= 0 || lib.indexOf("aujourd") === 0 ? lib : lib) + "</p></div></div>";
          return;
        }
        zone.innerHTML = r.jours.map(function (j) {
          return '<section class="jour-commandes"><h2>' + A.dateLongue(j.date) + '</h2><div class="doux droite petit">Caisse fermée à ' + j.fermeA + "</div>" +
            j.commandes.map(function (c) {
              return '<div class="commande" data-act="cmd" data-val="' + c.id + '"><span class="heure">' + c.heure + '</span><span class="produits">' +
                c.produits.map(function (p) { return p.annule ? "<s>" + E(p.nom) + "</s>" : E(p.nom); }).join(", ") + '</span><span class="td-espace"></span>' +
                '<span class="statut ' + c.statut + '"><i></i>' + (c.statut === "paid" ? "Payé" : "Annulé") + '</span><span class="icone-pay">' + iconePaiement(c.paiement) + '</span><b class="total">' + A.euro(c.total) + "</b></div>";
            }).join("") + '<div class="doux petit">Caisse ouverte à ' + j.ouvertA + "</div></section>";
        }).join("");
        function ouvrir(id) {
          D.getOrderById(id).then(function (o) {
            var idx = tous.indexOf(id), ok = o.statut === "paid";
            var lignes = o.lignes.map(function (l) {
              return "<tr><td>" + l.quantite + "</td><td><b>" + E(l.produit) + "</b>" + (l.options.length ? '<div class="doux petit">' + E(l.options.join(", ")) + "</div>" : "") + '</td><td class="d mono">' + A.euro(l.prix) + "</td></tr>";
            }).join("");
            function repliable(titre, corps, ouvert) {
              return '<div class="repliable' + (ouvert ? " ouvert" : "") + '"><button class="repliable-t" data-act="repl"><span>' + titre + '</span><i class="trait-t"></i>' + A.icones.bas + '</button><div class="repliable-c">' + corps + "</div></div>";
            }
            var t = A.tiroir('<div class="tiroir-tete"><div><h3>' + A.dateMoyenne(o.date) + " • " + o.heure + '</h3><div class="doux">' + E(o.salle + " " + o.table) + " • " + A.euro(o.total) + " • " + E(o.serveur) + " • " + o.couverts + ' Couverts</div></div><button class="fermer" data-act="fermer-tiroir">✕</button></div>' +
              '<div class="tiroir-corps"><div class="bandeau-statut ' + (ok ? "ok" : "ko") + '"><span class="rond">' + (ok ? "✓" : "✕") + "</span>" + (ok ? "Payé" : "Annulé") + "</div>" +
              repliable("Autres propriétés", '<div class="doux petit">Mode de paiement : ' + E(o.paiement) + "<br>N° fiscal : " + E(o.numeroFiscal) + (o.remise ? "<br>Remise : " + E(o.remise.nom) + " (" + A.euro(o.remise.montant) + ")" : "") + "</div>", false) +
              repliable("Détails du ticket", '<table class="ticket-table"><thead><tr><th class="g">Quantité</th><th class="g">Produit</th><th>Prix</th></tr></thead><tbody>' + lignes + '<tr class="total"><td>Total</td><td></td><td class="d mono">' + A.euro(o.total) + "</td></tr></tbody></table>", true) +
              repliable("Transactions en ligne", '<div class="doux petit">Aucune transaction en ligne.</div>', false) + "</div>" +
              '<div class="tiroir-pied"><button class="bouton-icone" data-act="nav" data-val="1">⌄</button><button class="bouton-icone" data-act="nav" data-val="-1">⌃</button><span>Navigation</span><span class="td-espace"></span>' +
              '<button class="bouton sombre" data-act="mail">Envoyer le ticket par email</button><button class="bouton sombre" data-act="pdfc">Télécharger le PDF</button></div>');
            A.act.repl = function (v, el) { el.parentNode.classList.toggle("ouvert"); };
            A.act.nav = function (v) { var n = tous[idx + (+v)]; if (n) ouvrir(n); };
            A.act.mail = A.nonDispo; A.act.pdfc = function () { window.print(); };
          });
        }
        A.act.cmd = ouvrir;
      });
    }
  });

  // ======================================================================
  // Réservations
  // ======================================================================
  A.ecran("/reservations", {
    section: null, fil: ["Réservation"],
    actions: function () { A.act.creer = A.nonDispo; return A.bouton("Export CSV", "creer", { classe: "sombre" }) + A.bouton("Ajouter une réservation", "creer", { classe: "sombre" }); },
    filtres: function (ctx) { return '<label class="date-champ">📅 <input type="date" id="resa-date" value="' + (ctx.etat.date || A.aujourdhui()) + '"></label>'; },
    rendre: function (ctx, zone) {
      var et = ctx.etat, date = et.date || A.aujourdhui(), onglet = et.onglet || "toutes", q = et.q || "";
      document.getElementById("resa-date").onchange = function () { et.date = this.value; ctx.rafraichir(); };
      D.getReservationList(date).then(function (r) {
        var l = r.reservations.filter(function (x) { return !q || x.nom.toLowerCase().indexOf(q.toLowerCase()) >= 0; });
        var attente = l.filter(function (x) { return x.statut === "En attente"; }), retard = l.filter(function (x) { return x.statut === "En retard"; });
        var vue = onglet === "attente" ? attente : onglet === "retard" ? retard : l;
        A.act.onglet = function (o) { et.onglet = o; ctx.rafraichir(); };
        zone.innerHTML = A.kpis([["Nombre de réservations", A.entier(r.reservations.length)], ["Nombre de couverts", A.entier(r.totalNumberOfGuests)]]) +
          A.carte("Réservations", '<div class="td-barre"><span class="td-espace"></span><label class="champ-recherche">' + A.icones.loupe + '<input type="search" placeholder="Rechercher un client" id="resa-q" value="' + E(q) + '"></label></div>' +
            '<div class="onglets-bouton plein">' + [["toutes", "Toutes (" + l.length + ")"], ["attente", "En attente (" + attente.length + ")"], ["retard", "En retard (" + retard.length + ")"]].map(function (o) { return '<button class="' + (o[0] === onglet ? "actif" : "") + '" data-act="onglet" data-val="' + o[0] + '">' + o[1] + "</button>"; }).join("") + "</div>" +
            (vue.length ? A.table([{ t: "Heure" }, { t: "Client" }, { a: "d", t: "Couverts" }, { t: "Statut" }, { t: "Note" }], vue.map(function (x) { return [x.heure, E(x.nom), x.couverts, E(x.statut), E(x.note)]; })) : A.vide("Aucune réservation")));
        document.getElementById("resa-q").onchange = function () { et.q = this.value; ctx.rafraichir(); };
      });
    }
  });

  // ======================================================================
  // Clients
  // ======================================================================
  A.ecran("/customers", {
    section: "clients", fil: ["Fiches clients", "Liste"], actions: function () { return creer("Ajouter un client"); },
    rendre: function (ctx, zone) {
      D.getCustomers().then(function (l) {
        zone.innerHTML = A.carte("Liste des clients", '<div id="td"></div>', { classe: "avec-tableau" });
        A.monterTable(document.getElementById("td"), {
          colonnes: [{ t: "Nom", k: "name", tri: function (c) { return c.name; } },
            { t: "Solde", f: function (c) { return '<span class="' + (c.solde < 0 ? "rouge" : "") + '">' + A.euro(c.solde) + "</span>"; }, tri: function (c) { return c.solde; } },
            { t: "Total cagnotte", f: function (c) { return '<span class="' + (c.cagnotte > 0 ? "vert" : "") + '">' + A.euro(c.cagnotte) + "</span>"; }, tri: function (c) { return c.cagnotte; } },
            { t: "Téléphone", k: "phone" }, { t: "Email", k: "email" }],
          lignes: l, rech: { ph: "Rechercher...", texte: function (c) { return c.name + " " + c.phone + " " + c.email; } },
          onLigne: function (c) { A.allerA("/customers/view/" + c.id); }
        });
      });
    }
  });
  A.ecran("/customers/view/:id", {
    section: "clients", fil: ["Fiches clients", "..."], actions: function () { return creer("Éditer la fiche client"); },
    rendre: function (ctx, zone) {
      Promise.all([D.viewCustomer(ctx.ids.id), D.getVouchers()]).then(function (res) {
        var c = res[0], bons = res[1].filter(function (b) { return c && b.clientId === c.id && b.statut !== "annule"; }).sort(function (a, b) { return a.expireLe < b.expireLe ? -1 : 1; });
        if (!c) { zone.innerHTML = A.vide("Client introuvable"); return; }
        var cartesBons = A.carte("Bons cadeaux (cagnotte : " + A.euro(c.cagnotte) + ")", bons.length ? A.table([{ t: "Code" }, { a: "d", t: "Solde" }, { t: "Fin de validité" }, { t: "Statut" }],
          bons.map(function (b) { return ['<span class="mono">' + E(b.code) + "</span>", A.euro(b.solde), A.dateMoyenne(b.expireLe), badgeStatutBon(b)]; }), null, { classe: "zebre" }) +
          '<p class="doux petit"><a href="#/customers/vouchers">Gérer les bons cadeaux</a></p>' : A.vide("Aucun bon cadeau"));
        document.querySelector(".fil b").textContent = c.name;
        function champ(t, v, tel) { return '<div class="kpi grand"><div class="kpi-l">' + t + '</div><div class="kpi-v ' + (v ? "" : "gris") + '">' + (v ? E(v) + (tel ? " " + A.icones.autre : "") : "Non renseigné") + "</div></div>"; }
        A.act.onglet = function (o, el) { Array.prototype.forEach.call(el.parentNode.children, function (b) { b.classList.toggle("actif", b === el); }); };
        zone.innerHTML = '<div class="kpi grand"><div class="kpi-l">Nom prénom</div><div class="kpi-v"><span class="badge-site">' + E(A.siteSigle) + "</span> " + E(c.name) + "</div></div>" +
          '<div class="deux-col">' + champ("Téléphone", c.phone, true) + champ("Email", c.email) + champ("Adresse", c.address) + champ("Complément d'adresse", "") + champ("Ville", c.city) + champ("Code postal", c.zip) + "</div>" +
          champ("Entreprise", c.company) + '<div class="deux-col">' + champ("Nombre de commandes", String(c.orders)) + champ("Commandes impayées", String(c.unpaid)) + "</div>" +
          cartesBons +
          A.carte("", '<div class="onglets-bouton plein"><button class="actif" data-act="onglet">Commandes payées</button><button data-act="onglet">Commandes impayées</button><button data-act="onglet">Dépôts</button></div>' + A.vide("Aucune donnée trouvée"));
      });
    }
  });

  // ======================================================================
  // Bons cadeaux (données factices, gardées dans le navigateur)
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
        '<div class="tiroir-corps"><div class="bandeau-factice">Données factices : gérées uniquement dans ce navigateur.</div>' +
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
        zone.innerHTML = '<div class="bandeau-factice"><b>Données factices.</b> Les bons cadeaux ne sont pas fournis par l\'API : ils sont inventés et ne sont enregistrés que dans ce navigateur.</div>' +
          A.kpis([["Bons actifs", A.entier(nb.actif)], ["Solde à consommer", A.euro(encours)], ["Expirent sous 30 jours", A.entier(nb.proche) + " · " + A.euro(montantProche)], ["Solde expiré non utilisé", '<span class="' + (perdu ? "rouge" : "") + '">' + A.euro(perdu) + "</span>"]]) +
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
  // Réglages
  // ======================================================================
  function carteReglage(titre, corps, opts) { return '<div class="carte grande-carte"><div class="carte-tete"><h2>' + titre + '</h2></div><div class="carte-corps">' + corps + "</div>" + ((opts && opts.sansPied) ? "" : pied()) + "</div>"; }
  A.ecran("/settings/profile", {
    section: "reglages", fil: ["Réglages", "Profil"],
    rendre: function (ctx, zone) {
      D.getProfile().then(function (p) {
        A.act.creer = A.nonDispo;
        zone.innerHTML = carteReglage("Réglage du profil",
          '<div class="champ-ligne"><label><span class="ic-nom">' + A.icones.utilisateur + 'Nom et prénom</span></label><div class="champ">' + E(p.name) + "</div></div><hr>" +
          '<div class="ligne-action"><div><b>Changer l\'adresse e-mail liée au Back Office</b><div class="doux petit">Connecté avec : ' + E(p.email) + '</div><b class="espace-h">Changer de mot de passe</b></div>' +
          '<div class="colonne"><button class="bouton" data-act="creer">Changer l\'adresse</button><button class="bouton" data-act="creer">Modifier le mot de passe</button></div></div><hr>');
      });
    }
  });
  A.ecran("/settings/auth-methods", {
    section: "reglages", fil: ["Réglages", "Méthodes d'authentification"],
    rendre: function (ctx, zone) {
      A.act.creer = A.nonDispo;
      function bloc(nom, lettre, texte) {
        return '<div class="bloc-lie"><b>' + nom + '</b><div class="doux petit">Liez votre compte ' + nom + ' au Back Office pour pouvoir vous connecter avec.</div><div class="ligne-lien"><span class="rond-logo">' + lettre + "</span>" + texte + '<span class="td-espace"></span><button class="bouton gris" data-act="creer">Connecter</button></div></div>';
      }
      zone.innerHTML = carteReglage("Gestion des comptes liés", bloc("Google", "G", "Se connecter avec Google") + bloc("Apple", "A", "Se connecter à Apple"), { sansPied: true });
    }
  });
  A.ecran("/settings/notifications", {
    section: "reglages", fil: ["Réglages", "Notifications"],
    rendre: function (ctx, zone) {
      var et = ctx.etat;
      if (et.rapports === undefined) et.rapports = true;
      A.act.bascule = function () { et.rapports = !et.rapports; ctx.rafraichir(); };
      zone.innerHTML = carteReglage("Gestion des notifications",
        '<div class="reglage"><div><b>Recevoir les rapports</b><div class="doux petit">Recevoir chaque jour le rapport de caisse par e-mail</div></div><button class="interrupteur' + (et.rapports ? " on" : "") + '" data-act="bascule"><i></i></button></div>');
    }
  });
  A.ecran("/settings/users", {
    section: "reglages", fil: ["Réglages", "Gestion des utilisateurs"], actions: function () { return creer("Inviter un utilisateur"); },
    rendre: function (ctx, zone) {
      D.getOrganizationUsers().then(function (l) {
        A.act.creer = A.nonDispo;
        zone.innerHTML = l.map(function (u) {
          return '<div class="ligne-carte utilisateur"><span class="avatar-u">' + (u.invite ? "" : A.icones.utilisateur) + "</span><span>" + E(u.name) + '</span><span class="puce">' + A.icones.pin + " " + u.sites + ' Site</span><span class="td-espace"></span>' +
            (u.invite ? '<button class="bouton sombre" data-act="creer">Renvoyer l\'invitation</button>' : "<span>" + E(u.role) + "</span>") + '<span class="niveau">' + u.level + "</span></div>";
        }).join("");
      });
    }
  });
  A.ecran("/settings/roles", {
    section: "reglages", fil: ["Réglages", "Gestion des rôles"], actions: function () { return creer("Créer un rôle"); },
    rendre: function (ctx, zone) {
      D.getRoles().then(function (l) {
        zone.innerHTML = l.map(function (r) { return '<div class="ligne-carte"><b>' + E(r.name) + "</b>" + (r.userCount ? ' <span class="puce">' + A.icones.personnes + " " + r.userCount + " utilisateurs</span>" : "") + "</div>"; }).join("");
      });
    }
  });
  A.ecran("/settings/sites", {
    section: "reglages", fil: ["Réglages", "Gestion des sites"],
    rendre: function (ctx, zone) {
      D.getLocations().then(function (l) {
        zone.innerHTML = carteReglage("Liste des sites", l.map(function (s) {
          return '<div class="site-ligne"><span class="badge-site">' + E(s.sigle) + "</span><div><b>" + E(s.name) + '</b><div class="doux petit">Adresse : ' + E(s.address + ", " + s.zip + " " + s.city + ", " + s.country) + "</div></div></div>";
        }).join(""), { sansPied: true });
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
            c.integrations.map(function (i) { return '<div class="carte-integ"><div class="integ-t"><span class="logo-carre">' + E(i.nom.charAt(0)) + "</span><b>" + E(i.nom) + "</b></div><p>" + E(i.description) + "</p></div>"; }).join("") + "</div></section>";
        }).join("");
        if (ctx.params.cat) {
          var cible = document.getElementById("cat-" + ctx.params.cat);
          if (cible) cible.scrollIntoView({ block: "start" });
        }
      });
    }
  });

  // ======================================================================
  // Quoi de neuf, Centre d'aide, Hygiène Expert
  // ======================================================================
  A.ecran("/whats-new", {
    section: null, fil: ["Quoi de neuf"],
    rendre: function (ctx, zone) {
      D.getNews().then(function (l) {
        zone.innerHTML = l.map(function (n) {
          return '<article class="carte article"><h1>' + E(n.titre) + '</h1><div class="auteur"><span class="logo-rond-s"></span><div><div class="doux petit">' + E(n.auteur) + '</div><div class="doux petit">' + E(n.date) + "</div></div></div><p>" + E(n.resume) + '</p><div class="astuce"><b>TIP</b><br>' + E(n.astuce) + "</div>" +
            n.sections.map(function (s) { return '<div class="image-demo">' + A.icones.document + "</div><h2>" + E(s.titre) + "</h2><p>" + E(s.texte) + "</p>"; }).join("") + "</article>";
        }).join("");
      });
    }
  });
  A.ecran("/help", {
    section: null, bandeau: false,
    rendre: function (ctx, zone) {
      D.getAgencyInfo().then(function (a) {
        zone.innerHTML = '<div class="aide"><div class="ampoule">' + A.icones.cible + '</div><h1>Centre d\'aide</h1><p class="doux">Besoin d\'aide ? Consultez nos guides et nos réponses aux questions les plus fréquentes.</p>' +
          '<div class="carte"><div class="aide-tete">' + E(a.site) + '</div><div class="aide-cellules"><div><b>Référence client</b><div class="doux petit">' + E(a.reference) + "</div></div><div><b>Agence principale</b><div class=\"doux petit\">" + E(a.ville) + '</div></div><div><b>Documentation</b><div class="doux petit"><a data-act="doc">Voir la page ›</a></div></div></div></div>' +
          '<h2>Toutes vos agences</h2>' + a.agences.map(function (g) { return '<div class="agence"><b>' + E(g.nom) + '</b><span class="doux petit">' + A.icones.pin + " " + E(g.adresse) + '</span><span class="doux petit">' + E(g.tel) + "</span></div>"; }).join("") + "</div>";
        A.act.doc = A.nonDispo;
      });
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
