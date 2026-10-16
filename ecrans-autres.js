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
        var illustration = '<svg viewBox="0 0 160 110" class="illustration"><rect x="8" y="10" width="80" height="92" rx="6" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="24" cy="26" r="6" fill="currentColor"/>' +
          '<path d="M20 44h56M20 54h40M20 64h48M20 74h36" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><rect x="72" y="36" width="76" height="52" rx="5" style="fill:var(--carte)" stroke="currentColor" stroke-width="2"/>' +
          '<path d="M80 50h40M80 60h50M80 70h30" stroke="#999" stroke-width="3" stroke-linecap="round"/><circle cx="118" cy="82" r="11" fill="currentColor"/><path d="M112 82l4 4 8-8" style="stroke:var(--carte)" stroke-width="2.4" fill="none"/></svg>';
        A.act.bandeau = A.nonDispo;
        A.act.quand = function (v) { et.quand = v; ctx.rafraichir(); };
        zone.innerHTML =
          '<div class="carte"><div class="campagne">' + illustration + '<div><h2>Découvrez les nouveautés du mois !</h2><p>Bandeau de démonstration : cette zone affiche une campagne d\'information inventée pour la maquette. Aucune donnée réelle n\'est utilisée.</p>' +
          '<button class="bouton sombre" data-act="bandeau">En savoir plus !</button></div></div></div>' +
          A.carte("Informations clés", A.kpis([["Chiffre d'affaires", A.euro(k.turnover)], ["Commande moyenne", A.euro(k.averageOrder)], ["Nb. de commandes", A.entier(k.orderCount)], ["Montant des annulations", A.euro(k.cancellationAmount)]]),
            { droite: A.segment("quand", [["yesterday", "Hier"], ["today", "Aujourd'hui"]], quand, A.act.quand) }) +
          A.carte("Chiffre d'affaires journalier", A.graph.barres({ labels: h.dailyTurnover.map(function (j) { return +j.date.slice(8); }), valeurs: h.dailyTurnover.map(function (j) { return j.amount; }), hauteur: 320 }));
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
      D.viewCustomer(ctx.ids.id).then(function (c) {
        if (!c) { zone.innerHTML = A.vide("Client introuvable"); return; }
        document.querySelector(".fil b").textContent = c.name;
        function champ(t, v, tel) { return '<div class="kpi grand"><div class="kpi-l">' + t + '</div><div class="kpi-v ' + (v ? "" : "gris") + '">' + (v ? E(v) + (tel ? " " + A.icones.autre : "") : "Non renseigné") + "</div></div>"; }
        A.act.onglet = function (o, el) { Array.prototype.forEach.call(el.parentNode.children, function (b) { b.classList.toggle("actif", b === el); }); };
        zone.innerHTML = '<div class="kpi grand"><div class="kpi-l">Nom prénom</div><div class="kpi-v"><span class="badge-site">' + E(A.siteSigle) + "</span> " + E(c.name) + "</div></div>" +
          '<div class="deux-col">' + champ("Téléphone", c.phone, true) + champ("Email", c.email) + champ("Adresse", c.address) + champ("Complément d'adresse", "") + champ("Ville", c.city) + champ("Code postal", c.zip) + "</div>" +
          champ("Entreprise", c.company) + '<div class="deux-col">' + champ("Nombre de commandes", String(c.orders)) + champ("Commandes impayées", String(c.unpaid)) + "</div>" +
          A.carte("", '<div class="onglets-bouton plein"><button class="actif" data-act="onglet">Commandes payées</button><button data-act="onglet">Commandes impayées</button><button data-act="onglet">Dépôts</button></div>' + A.vide("Aucune donnée trouvée"));
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
