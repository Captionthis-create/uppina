/*
 * donnees-test.js : LE SEUL point d'accès aux données de l'application.
 *
 * Tout est INVENTÉ (aucun appel réseau, aucun appel à go.popina.com, aucun
 * vrai nom, chiffre ou client). Un jeu de fausses commandes est généré une
 * fois au chargement (générateur pseudo-aléatoire à graine fixe : toujours le
 * même résultat) ; tous les rapports en sont calculés, donc les totaux sont
 * cohérents d'un écran à l'autre.
 *
 * Les fonctions publiques portent le nom des procédures de l'API observée
 * (report.getReportPaymentMode -> getReportPaymentMode) et renvoient une
 * Promise, comme un vrai appel. Pour brancher de vraies données plus tard, on
 * ne modifiera que ce fichier.
 */
(function () {
  "use strict";

  // ======================================================================
  // Outils
  // ======================================================================
  var graine = 20261015;
  function alea() { graine = (graine * 1664525 + 1013904223) % 4294967296; return graine / 4294967296; }
  function entre(a, b) { return a + Math.floor(alea() * (b - a + 1)); }
  function choisir(t) { return t[Math.floor(alea() * t.length)]; }
  function pondere(t, poids) {
    var total = 0, i;
    for (i = 0; i < poids.length; i++) total += poids[i];
    var r = alea() * total;
    for (i = 0; i < t.length; i++) { r -= poids[i]; if (r <= 0) return t[i]; }
    return t[t.length - 1];
  }
  function arrondi(n) { return Math.round(n * 100) / 100; }
  function deux(n) { return ("0" + n).slice(-2); }
  function jourIso(d) { return d.getFullYear() + "-" + deux(d.getMonth() + 1) + "-" + deux(d.getDate()); }
  function copie(v) { return JSON.parse(JSON.stringify(v)); }
  function reponse(v) { return Promise.resolve(copie(v)); }

  var AUJ = new Date(); AUJ.setHours(0, 0, 0, 0);
  var AUJ_ISO = jourIso(AUJ);

  // Mode des données : « test » (inventées) ou « reelles » (fichier donnees-reelles.js produit par
  // outils\recuperer-donnees.ps1). Choisi dans le menu du compte, mémorisé dans le navigateur.
  var REEL = window.DonneesReelles || null;
  var MODE = "test";
  // Par défaut : vraies données si le fichier existe, sauf si l'utilisateur a explicitement choisi « test ».
  try { if (REEL && localStorage.getItem("donnees-copie") !== "test") MODE = "reelles"; } catch (e) { if (REEL) MODE = "reelles"; }
  var RECU = null; // en-tête de ticket réel (mode réelles)
  var APPAREILS_REELS = null; // appareils du lieu (mode réelles)

  // ======================================================================
  // Référentiels (catalogue, équipe, salles...)
  // ======================================================================
  var SITE_ID = "00000000-0000-4000-8000-000000000001";
  var SITES = [{ id: SITE_ID, name: "RESTAURANT EXEMPLE", sigle: "RE", address: "1 rue de l'Exemple", city: "Ville", zip: "00000", country: "France" }];

  var CATEGORIES = [
    { nom: "Boissons chaudes", couleur: "#a3380b", sous: ["Cafés", "Thés", "Chocolats"] },
    { nom: "Softs", couleur: "#1a8fb5", sous: ["Jus", "Sodas", "Eaux"] },
    { nom: "Bières", couleur: "#d99a1e", sous: ["Pression", "Bouteilles"] },
    { nom: "Vins", couleur: "#b3123f", sous: ["Rouges", "Blancs", "Bulles"] },
    { nom: "Plats", couleur: "#5a7d1a", sous: ["Burgers", "Salades", "Assiettes"] },
    { nom: "Galettes", couleur: "#0e8a8a", sous: ["Classiques", "Spéciales"] },
    { nom: "Crêpes", couleur: "#8e44ad", sous: ["Sucrées"] },
    { nom: "Desserts", couleur: "#5b4bc4", sous: ["Glaces", "Gâteaux"] }
  ];

  // [nom, catégorie, sous-catégorie, prix TTC, TVA %, pôle, popularité, groupe d'options]
  var PRODUITS_DEF = [
    ["Café", 0, 0, 2.2, 10, "Bar", 9], ["Café crème", 0, 0, 3.2, 10, "Bar", 6], ["Thé vert", 0, 1, 3.5, 10, "Bar", 3],
    ["Infusion menthe", 0, 1, 3.5, 10, "Bar", 2], ["Chocolat chaud", 0, 2, 4, 10, "Bar", 6], ["Chocolat viennois", 0, 2, 4.8, 10, "Bar", 4],
    ["Jus de pomme 25cl", 1, 0, 3.2, 10, "Bar", 4], ["Jus d'orange 25cl", 1, 0, 3.5, 10, "Bar", 3], ["Limonade", 1, 1, 3, 10, "Bar", 4, "Sirop"],
    ["Cola 33cl", 1, 1, 3.4, 10, "Bar", 4], ["Carafe d'eau", 1, 2, 0, 10, "Bar", 7], ["Eau gazeuse 50cl", 1, 2, 3, 10, "Bar", 2],
    ["Blonde 25cl", 2, 0, 3.2, 20, "Bar", 5], ["Blonde 50cl", 2, 0, 6, 20, "Bar", 5], ["IPA 25cl", 2, 0, 3.8, 20, "Bar", 3],
    ["Bouteille ambrée 33cl", 2, 1, 4.5, 20, "Bar", 2],
    ["Rouge 12cl", 3, 0, 3.6, 20, "Bar", 3], ["Rouge 75cl", 3, 0, 19, 20, "Bar", 2], ["Blanc 12cl", 3, 1, 3.6, 20, "Bar", 3],
    ["Blanc 75cl", 3, 1, 19, 20, "Bar", 1], ["Bulles 12cl", 3, 2, 5.5, 20, "Bar", 2], ["Bulles 75cl", 3, 2, 32, 20, "Bar", 1],
    ["Burger maison", 4, 0, 13.5, 10, "Cuisine", 6, "Cuisson"], ["Burger végé", 4, 0, 12.5, 10, "Cuisine", 2, "Cuisson"],
    ["Salade composée", 4, 1, 11.5, 10, "Cuisine", 3], ["Assiette du jour", 4, 2, 14, 10, "Cuisine", 5, "Cuisson"],
    ["Côte de bœuf 1kg", 4, 2, 48, 10, "Cuisine", 1, "Cuisson"],
    ["Complète", 5, 0, 9.5, 10, "Crêperie", 8], ["Jambon fromage", 5, 0, 8.5, 10, "Crêperie", 6], ["Saucisse", 5, 0, 8, 10, "Crêperie", 4],
    ["Chèvre miel", 5, 1, 10.5, 10, "Crêperie", 4], ["Océane", 5, 1, 12.5, 10, "Crêperie", 3],
    ["Crêpe beurre sucre", 6, 0, 4, 10, "Crêperie", 7], ["Crêpe chocolat", 6, 0, 5, 10, "Crêperie", 6],
    ["Crêpe caramel", 6, 0, 5, 10, "Crêperie", 4], ["Crêpe flambée", 6, 0, 8, 10, "Crêperie", 2],
    ["Coupe 2 boules", 7, 0, 5.5, 10, "Dessert", 4, "Parfum"], ["Coupe 3 boules", 7, 0, 7, 10, "Dessert", 3, "Parfum"],
    ["Fondant chocolat", 7, 1, 6.5, 10, "Dessert", 3], ["Tarte du jour", 7, 1, 6, 10, "Dessert", 2],
    ["Pain", 4, 2, 1, 5.5, "Cuisine", 1]
  ];
  var PRODUITS = PRODUITS_DEF.map(function (d, i) {
    return {
      id: "p" + (i + 1), nom: d[0], cat: d[1], sous: d[2], categorie: CATEGORIES[d[1]].nom, sousCategorie: CATEGORIES[d[1]].sous[d[2]],
      couleur: CATEGORIES[d[1]].couleur, prix: d[3], tva: d[4], pole: d[5], poids: d[6], groupe: d[7] || null
    };
  });

  var GROUPES_OPTIONS = [
    { id: "g1", nom: "Cuisson", options: [["Saignant", 0], ["À point", 0], ["Bien cuit", 0]], poids: [2, 5, 3] },
    { id: "g2", nom: "Parfum", options: [["Vanille", 0], ["Chocolat", 0], ["Fraise", 0], ["Café", 0], ["Citron", 0], ["Caramel", 0]], poids: [5, 4, 3, 2, 2, 2] },
    { id: "g3", nom: "Sirop", options: [["Menthe", 0], ["Grenadine", 0], ["Citron", 0]], poids: [4, 3, 1] },
    { id: "g4", nom: "Suppléments", options: [["+ Chantilly", 1], ["+ Boule de glace", 1.5], ["+ Coulis", 1]], poids: [4, 2, 1] }
  ];
  function groupeParNom(n) { return GROUPES_OPTIONS.filter(function (g) { return g.nom === n; })[0]; }

  var TAXES = [
    { id: "t1", name: "TVA 0%", rate: 0 }, { id: "t2", name: "TVA 5,5%", rate: 5.5 },
    { id: "t3", name: "TVA 20%", rate: 20 }, { id: "t4", name: "TVA 10%", rate: 10 }
  ];
  function nomTaxe(rate) { return rate === 5.5 ? "TVA 5,5%" : "TVA " + rate + "%"; }

  var EMPLOYES = ["Gérant", "Alice", "Bruno", "Chloé", "David", "Emma", "Farid", "Gaëlle", "Hugo", "Inès", "Jules", "Karim"]
    .map(function (n, i) { return { id: "e" + (i + 1), name: n, isOwner: i === 0 }; });

  var SALLES = [
    { id: "r1", nom: "Salle", type: "room", actif: true, poids: 60, tables: 12, prefixe: "S" },
    { id: "r2", nom: "Terrasse", type: "room", actif: true, poids: 22, tables: 8, prefixe: "T" },
    { id: "r3", nom: "Comptoir", type: "bar", actif: true, poids: 10, tables: 6, prefixe: "C" },
    { id: "r4", nom: "Véranda", type: "room", actif: true, poids: 8, tables: 6, prefixe: "V" },
    { id: "r5", nom: "À emporter", type: "takeOut", actif: false, poids: 0, tables: 0, prefixe: "E" },
    { id: "r6", nom: "Livraison", type: "extOrder", actif: false, poids: 0, tables: 0, prefixe: "L" }
  ];

  // Modes de paiement (nom, couleur de pastille, poids, bon d'achat, tiroir-caisse, pourboires)
  var MODES_PAIEMENT = [
    { id: "m1", nom: "Carte de crédit", mode: "card", couleur: "#a3380b", poids: 70, voucher: false, tiroir: false, tips: false },
    { id: "m2", nom: "Espèces", mode: "cash", couleur: "#8e44ad", poids: 12, voucher: false, tiroir: true, tips: false },
    { id: "m3", nom: "Chèque", mode: "check", couleur: "#0e8a8a", poids: 3, voucher: false, tiroir: true, tips: false },
    { id: "m4", nom: "Chèque Vacances", mode: "restaurantCheck", couleur: "#5b4bc4", poids: 5, voucher: false, tiroir: true, tips: false },
    { id: "m5", nom: "Titre restaurant", mode: "restaurantCheck", couleur: "#0f8a5f", poids: 6, voucher: false, tiroir: true, tips: false },
    { id: "m6", nom: "Compte client", mode: "credit", couleur: "#b3123f", poids: 1, voucher: false, tiroir: false, tips: false },
    { id: "m7", nom: "Cagnotte", mode: "custom", couleur: "#1a73c8", poids: 2, voucher: true, tiroir: false, tips: false },
    { id: "m8", nom: "Virement", mode: "bankTransfer", couleur: "#d17a00", poids: 1, voucher: false, tiroir: false, tips: false }
  ];

  var REMISES = [
    { id: "d1", nom: "Offert", type: "percentage", valeur: 100 },
    { id: "d2", nom: "Remise équipe", type: "percentage", valeur: 20 },
    { id: "d3", nom: "Bon d'achat", type: "amount", valeur: 15 },
    { id: "d4", nom: "Geste commercial", type: "percentage", valeur: 10 }
  ];

  var MOTIFS_ANNULATION = [
    ["Annulation à la volée", 55], ["Faute de frappe", 30], ["Client a changé d'avis", 8], ["Stock épuisé", 5], ["Produit endommagé", 2]
  ];

  // ======================================================================
  // Génération des commandes (≈ 90 jours passés, aujourd'hui = vide)
  // ======================================================================
  var POIDS_JOUR = { 0: 1.5, 1: 0, 2: 0, 3: 0.5, 4: 0.7, 5: 1, 6: 1.7 }; // 0 = dimanche
  var COMMANDES = [];
  var CAISSES = [];
  var numCommande = 1;

  function genererItem() {
    var p = pondere(PRODUITS, PRODUITS.map(function (x) { return x.poids; }));
    var q = alea() < 0.2 ? 2 : 1;
    var it = { p: p.id, q: q, prix: p.prix, opts: [] };
    if (p.groupe) {
      var g = groupeParNom(p.groupe);
      var n = p.groupe === "Parfum" ? (p.nom.indexOf("3") >= 0 ? 3 : 2) : 1;
      for (var k = 0; k < n * 1; k++) {
        var o = pondere(g.options, g.poids);
        it.opts.push({ nom: o[0], groupe: g.nom, prix: o[1] });
      }
    }
    if (p.cat === 6 && alea() < 0.15) it.opts.push({ nom: "+ Chantilly", groupe: "Suppléments", prix: 1 });
    return it;
  }
  function totalItem(it) {
    var s = it.prix;
    it.opts.forEach(function (o) { s += o.prix; });
    return arrondi(s * it.q);
  }

  function generer() {
    var jours = 90, i, n = 0;
    for (i = jours; i >= 1; i--) {
      var d = new Date(AUJ.getTime() - i * 86400000);
      d.setHours(12);
      var poidsJ = POIDS_JOUR[d.getDay()];
      if (!poidsJ || alea() < 0.04) continue;
      var iso = jourIso(d);
      var nb = Math.max(12, Math.round(poidsJ * 48 + entre(-10, 10)));
      var ouvre = 10 * 60 + entre(15, 45), ferme = 18 * 60 + entre(0, 40);
      n++;
      var caisse = {
        id: "z" + iso, date: iso, numero: n, ouvertureMin: ouvre, fermetureMin: ferme,
        fondInitial: 150, commandes: []
      };
      for (var k = 0; k < nb; k++) {
        var minute = pondere([entre(ouvre + 20, 11 * 60 + 59), entre(12 * 60, 13 * 60 + 59), entre(14 * 60, 15 * 60 + 59), entre(16 * 60, ferme - 5)], [1, 4, 2, 2]);
        var salle = pondere(SALLES, SALLES.map(function (s) { return s.poids; }));
        var nbItems = entre(2, 9), items = [], annules = [];
        for (var j = 0; j < nbItems; j++) items.push(genererItem());
        var statut = alea() < 0.015 ? "cancelled" : "paid";
        if (statut === "paid" && alea() < 0.05) {
          var a = items.pop();
          if (a) annules.push({ p: a.p, q: a.q, prix: a.prix, motif: pondere(MOTIFS_ANNULATION, MOTIFS_ANNULATION.map(function (m) { return m[1]; }))[0], apres: alea() < 0.04 });
        }
        if (statut === "cancelled") { annules = annules.concat(items.map(function (x) { return { p: x.p, q: x.q, prix: x.prix, motif: "Client a changé d'avis", apres: false }; })); items = []; }
        var brut = 0;
        items.forEach(function (x) { brut += totalItem(x); });
        var remise = null;
        if (statut === "paid" && items.length && alea() < 0.04) {
          var r = pondere(REMISES, [1, 5, 1, 2]);
          var m = r.type === "percentage" ? arrondi(brut * r.valeur / 100) : Math.min(brut, r.valeur);
          remise = { nom: r.nom, montant: m };
        }
        var total = arrondi(brut - (remise ? remise.montant : 0));
        var paiement = total > 60 && alea() < 0.3 ? "Virement" : pondere(MODES_PAIEMENT, MODES_PAIEMENT.map(function (x) { return x.poids; })).nom;
        var cmd = {
          id: "c" + (numCommande++), date: iso, min: minute, caisse: caisse.id, salle: salle.nom,
          table: salle.prefixe + entre(1, Math.max(1, salle.tables)), emp: choisir(EMPLOYES).name,
          couverts: Math.max(1, Math.round(nbItems / 2.2 + alea() * 1.5)), items: items, annules: annules,
          remise: remise, paiement: paiement, total: statut === "paid" ? total : 0, statut: statut
        };
        if (statut === "paid" && total === 0) cmd.paiement = "Espèces";
        caisse.commandes.push(cmd); COMMANDES.push(cmd);
      }
      caisse.commandes.sort(function (a, b) { return a.min - b.min; });
      CAISSES.push(caisse);
    }
  }

  // Mode « réelles » : on reconstruit le même modèle interne (produits, commandes, caisses...)
  // à partir des réponses de l'API officielle. Montants en centimes, TVA en centièmes de %.
  function chargerReel() {
    var palette = ["#a3380b", "#1a8fb5", "#d99a1e", "#b3123f", "#5a7d1a", "#0e8a8a", "#8e44ad", "#5b4bc4", "#d17a00", "#0f8a5f", "#1a73c8", "#7a7a7a"];
    var cats = {}, listeCats = [], prods = {}, liste = [], zs = {}, emps = {}, places = {}, modes = {};
    function cat(nom) {
      nom = nom || "(sans catégorie)";
      if (!cats[nom]) { cats[nom] = { nom: nom, couleur: palette[listeCats.length % palette.length], sous: [] }; listeCats.push(cats[nom]); }
      return cats[nom];
    }
    function produit(id, nom, categorie, sousNom, prix, tvaPct) {
      if (prods[id]) return prods[id];
      var c = cat(categorie), sn = sousNom || "(sans sous-catégorie)", si = c.sous.indexOf(sn);
      if (si < 0) { c.sous.push(sn); si = c.sous.length - 1; }
      var p = { id: id, nom: nom, cat: listeCats.indexOf(c), sous: si, categorie: c.nom, sousCategorie: sn, couleur: c.couleur, prix: prix, tva: tvaPct, pole: "", poids: 1, groupe: null };
      prods[id] = p; liste.push(p);
      return p;
    }
    function minutes(d) { return d.getHours() * 60 + d.getMinutes(); }
    function nouvelleCaisse(id, iso, numero, ouv, ferm, fond) {
      var z = { id: id, date: iso, numero: numero, ouvertureMin: ouv, fermetureMin: ferm, fondInitial: fond, commandes: [] };
      zs[id] = z; CAISSES.push(z);
      return z;
    }

    // Référentiels officiels : catégories (dans l'ordre de la caisse), taxes, options, moyens de paiement, lieu
    (REEL.categories || []).slice().sort(function (a, b) { return a.index - b.index; }).forEach(function (c) { cat(c.name); });
    if (REEL.taxes && REEL.taxes.length) TAXES = REEL.taxes.map(function (t) { return { id: t.id, name: t.name, rate: t.percentage / 100 }; });
    var groupeDeOption = {};
    if (REEL.options && REEL.options.length) {
      GROUPES_OPTIONS = REEL.options.map(function (g) {
        (g.options || []).forEach(function (o) { groupeDeOption[o.id] = g.name; });
        return { id: g.id, nom: g.name, options: (g.options || []).map(function (o) { return [o.name, (o.price || 0) / 100]; }), poids: [] };
      });
    }
    var modesCatalogue = (REEL.paiements || []).map(function (p, i) {
      return { id: p.id, nom: p.name, mode: "custom", couleur: palette[i % palette.length], poids: 0, voucher: false, tiroir: false, tips: false, actif: p.enabled !== false };
    });
    if (REEL.lieu) {
      var L = REEL.lieu;
      if (L.name && L.name.trim()) SITES[0].name = L.name.trim();
      SITES[0].address = L.address || SITES[0].address; SITES[0].city = L.city || SITES[0].city; SITES[0].zip = L.zip || SITES[0].zip; SITES[0].country = L.country || SITES[0].country;
      SITES[0].sigle = (SITES[0].name.split(/\s+/).map(function (m) { return m.charAt(0); }).join("").slice(0, 4) || "S").toUpperCase();
      var R0 = RECU || {};
      function pris(a, b) { return (a && String(a).trim()) ? a : (b || ""); }
      RECU = {
        establishmentName: SITES[0].name, address1: pris(L.address, R0.address1), address2: "", zipCode: pris(L.zip, R0.zipCode), city: pris(L.city, R0.city), country: pris(L.country, R0.country),
        phoneNumber: pris(L.phone, R0.phoneNumber), siretCode: pris(L.siret, R0.siretCode), nafCode: pris(L.naf, R0.nafCode), tvaCode: pris(L.tva, R0.tvaCode),
        customHeader: pris(L.text, R0.customHeader), customFooter: ""
      };
      APPAREILS_REELS = (L.deviceList || []).map(function (a, i) {
        return { id: a.id, name: a.name, derniereConnexion: "-", modele: a.model || "-", os: "-", version: "-", role: i === 0 ? "Caisse principale" : "Caisse secondaire" };
      });
    }

    REEL.catalogue.forEach(function (p) {
      var pl = (p.priceList && p.priceList[0]) || {}, sc = p.subCategories && p.subCategories[0];
      produit(p.id, p.name, p.category, sc && sc.name, (pl.unitPrice || 0) / 100, (pl.taxRate || 0) / 100);
    });
    REEL.rapports.forEach(function (r) {
      var d = new Date(r.startedAt), f = new Date(r.finalizedAt);
      nouvelleCaisse(r.id, jourIso(d), r.reportNumber, minutes(d), minutes(f), (r.initialCashBalance || 0) / 100);
    });
    if (REEL.rapports.length && REEL.rapports[0].reportHeaderInfo) {
      var h = REEL.rapports[0].reportHeaderInfo;
      SITES[0].name = h.headerName || SITES[0].name;
      SITES[0].sigle = (SITES[0].name.split(/\s+/).map(function (m) { return m.charAt(0); }).join("").slice(0, 4) || "S").toUpperCase();
      SITES[0].address = h.headerAddress || ""; SITES[0].city = h.headerCity || ""; SITES[0].zip = h.headerZip || ""; SITES[0].country = h.headerCountry || "";
      RECU = {
        establishmentName: h.headerName, address1: h.headerAddress, address2: "", zipCode: h.headerZip, city: h.headerCity, country: h.headerCountry,
        phoneNumber: h.headerPhone, siretCode: h.headerSiret, nafCode: h.headerNaf, tvaCode: h.headerTva, customHeader: h.headerText || "", customFooter: ""
      };
    }

    REEL.commandes.forEach(function (o) {
      if (o.isTraining) return;
      var d = new Date(o.openedAt), iso = jourIso(d), z = zs[o.reportId];
      if (!z) z = zs["o" + iso] || nouvelleCaisse("o" + iso, iso, 0, 10 * 60, 18 * 60, 0);
      var items = [], annules = [], menusCmd = [];
      function ajouter(it) {
        var taux = ((it.tax && it.tax.taxRate) || 0) / 100;
        var p = produit(it.itemCatalogId || ("x:" + it.description), it.description, it.category, it.subCategory, (it.unitPrice || 0) / 100, taux);
        var q = it.quantity || 1;
        if (it.isCanceled || o.isCanceled) { annules.push({ p: p.id, q: q, prix: (it.unitPrice || 0) / 100, motif: it.cancelReason || o.cancelReason || "Sans motif", apres: false }); return; }
        items.push({ p: p.id, q: q, prix: arrondi(((it.total || 0) / 100) / q), tva: taux, opts: (it.modifiers || []).map(function (m) { return { nom: m.name, groupe: groupeDeOption[m.modifierId] || "Options", prix: 0 }; }) });
      }
      (o.items || []).forEach(ajouter);
      // Les menus (formules) sont à part dans l'API : leurs composants valent exactement le montant du menu.
      if (!o.isCanceled) (o.menus || []).forEach(function (m) { menusCmd.push({ nom: m.name, montant: (m.amount || 0) / 100 }); (m.items || []).forEach(ajouter); });
      var statut = o.isCanceled ? "cancelled" : "paid";
      var total = statut === "paid" ? arrondi((o.total || 0) / 100) : 0;
      var remise = null;
      if (statut === "paid" && (o.totalDiscount || 0) > 0) {
        var nomRemise = "Remise";
        (o.items || []).forEach(function (it) { (it.discountsApplied || []).forEach(function (x) { nomRemise = x.discountName || nomRemise; }); });
        remise = { nom: nomRemise, montant: arrondi(o.totalDiscount / 100), deduite: true };
      }
      var pays = (o.payments || []).slice().sort(function (a, b) { return b.paymentAmount - a.paymentAmount; });
      var paiement = pays.length ? pays[0].paymentName : "Non réglé";
      var emp = o.operatorName || "Inconnu", salle = o.orderPlace || "Salle";
      emps[emp] = 1; places[salle] = 1; modes[paiement] = 1;
      var cmd = {
        id: o.id, date: iso, min: minutes(d), caisse: z.id, salle: salle, table: o.orderNumber || "", emp: emp,
        couverts: o.guests || 0, items: items, annules: annules, remise: remise, paiement: paiement, total: total, statut: statut, menus: menusCmd,
        paiements: statut === "paid" ? (pays.length ? pays.map(function (x) { return { nom: x.paymentName, montant: (x.paymentAmount || 0) / 100 }; }) : [{ nom: paiement, montant: total }]) : []
      };
      z.commandes.push(cmd); COMMANDES.push(cmd);
    });
    CAISSES.forEach(function (z) { z.commandes.sort(function (a, b) { return a.min - b.min; }); });
    CAISSES.sort(function (a, b) { return a.date < b.date ? -1 : 1; });

    PRODUITS = liste; CATEGORIES = listeCats;
    EMPLOYES = Object.keys(emps).map(function (n, i) { return { id: "e" + (i + 1), name: n, isOwner: false }; });
    SALLES = Object.keys(places).map(function (n, i) { return { id: "r" + (i + 1), nom: n, type: /comptoir/i.test(n) ? "bar" : "room", actif: true, poids: 0, tables: 0, prefixe: "T" }; });
    // Moyens de paiement : ceux du catalogue officiel, puis ceux vus dans les commandes mais absents du catalogue
    var connus = {};
    modesCatalogue.forEach(function (m) { connus[m.nom] = 1; });
    Object.keys(modes).forEach(function (n) {
      if (!connus[n]) modesCatalogue.push({ id: "m" + (modesCatalogue.length + 1), nom: n, mode: "custom", couleur: palette[modesCatalogue.length % palette.length], poids: 0, voucher: false, tiroir: false, tips: false, actif: false });
    });
    MODES_PAIEMENT = modesCatalogue;
  }
  if (MODE === "test") generer(); else chargerReel();

  // ======================================================================
  // Agrégats
  // ======================================================================
  function dans(iso, p) { return iso >= p.dateStart && iso <= p.dateEnd; }
  // Tranche facultative portée par la période : p.jours (tableau, 0 = dimanche), p.h1 / p.h2 (minutes du jour, h2 exclu)
  var DOW = {};
  function jourSemaine(iso) { return DOW[iso] !== undefined ? DOW[iso] : (DOW[iso] = new Date(iso + "T12:00:00").getDay()); }
  function jourOk(iso, p) { return !p.jours || p.jours.indexOf(jourSemaine(iso)) >= 0; }
  function heureOk(c, p) { return (p.h1 == null || c.min >= p.h1) && (p.h2 == null || c.min < p.h2); }
  function commandesDe(p) { return COMMANDES.filter(function (c) { return dans(c.date, p) && jourOk(c.date, p) && heureOk(c, p); }); }
  function payees(p) { return commandesDe(p).filter(function (c) { return c.statut === "paid"; }); }
  function produitParId(id) { return PRODUITS.filter(function (x) { return x.id === id; })[0]; }
  function ht(ttc, tva) { return ttc / (1 + tva / 100); }
  function hhmm(min) { return deux(Math.floor(min / 60)) + ":" + deux(min % 60); }
  // Règlements d'une commande : plusieurs en mode réelles (paiement partagé), un seul en mode test
  function paiementsDe(c) { return c.paiements || [{ nom: c.paiement, montant: c.total }]; }
  function typePrix(c) { return c.salle === "Terrasse" ? "Terrasse" : (c.salle === "Comptoir" ? "Comptoir" : "Normal"); }

  // Lignes de ventes (une ligne par produit commandé) pour une liste de commandes payées
  function lignesVentes(cmds) {
    var out = [];
    cmds.forEach(function (c) {
      var brut = 0; c.items.forEach(function (x) { brut += totalItem(x); });
      // En mode réelles, les totaux de l'API sont déjà nets de remise (remise.deduite) : pas de proportion à appliquer.
      var coef = (brut > 0 && !(c.remise && c.remise.deduite)) ? (brut - (c.remise ? c.remise.montant : 0)) / brut : 1;
      c.items.forEach(function (x) {
        var p = produitParId(x.p), net = arrondi(totalItem(x) * coef), taux = x.tva !== undefined ? x.tva : p.tva;
        out.push({ cmd: c, prod: p, q: x.q, ttc: net, ht: arrondi(ht(net, taux)), tva: taux, opts: x.opts });
      });
    });
    return out;
  }
  function totaux(cmds) {
    var t = { ttc: 0, ht: 0, couverts: 0, n: cmds.length };
    lignesVentes(cmds).forEach(function (l) { t.ttc += l.ttc; t.ht += l.ht; });
    cmds.forEach(function (c) { t.couverts += c.couverts; });
    t.ttc = arrondi(t.ttc); t.ht = arrondi(t.ht);
    return t;
  }
  function nomsCats() { return CATEGORIES.map(function (c) { return c.nom; }); }

  // ======================================================================
  // API : accueil, commandes
  // ======================================================================
  function getHomePage() {
    var jours = [], i;
    for (i = 11; i >= 0; i--) {
      var d = jourIso(new Date(AUJ.getTime() - i * 86400000));
      jours.push({ date: d, amount: totaux(payees({ dateStart: d, dateEnd: d })).ttc });
    }
    function jour(iso) {
      var cm = payees({ dateStart: iso, dateEnd: iso }), t = totaux(cm);
      var ann = 0;
      commandesDe({ dateStart: iso, dateEnd: iso }).forEach(function (c) { c.annules.forEach(function (a) { ann += a.prix * a.q; }); });
      return { turnover: t.ttc, averageOrder: cm.length ? arrondi(t.ttc / cm.length) : 0, orderCount: cm.length, cancellationAmount: arrondi(ann) };
    }
    return reponse({
      dailyTurnover: jours,
      today: jour(AUJ_ISO),
      yesterday: jour(jourIso(new Date(AUJ.getTime() - 86400000)))
    });
  }

  function getOrders(f) {
    f = f || {};
    var p = { dateStart: f.dateStart, dateEnd: f.dateEnd };
    var liste = commandesDe(p).filter(function (c) {
      if (f.paiement && c.paiement !== f.paiement) return false;
      if (f.statut && c.statut !== f.statut) return false;
      if (f.salle && c.salle !== f.salle) return false;
      if (f.employe && c.emp !== f.employe) return false;
      return true;
    });
    var jours = {};
    liste.forEach(function (c) { (jours[c.date] = jours[c.date] || []).push(c); });
    var res = Object.keys(jours).sort().reverse().map(function (d) {
      var cm = jours[d].slice().sort(function (a, b) { return b.min - a.min; });
      var caisse = CAISSES.filter(function (z) { return z.id === cm[0].caisse; })[0];
      return {
        date: d, ouvertA: hhmm(caisse.ouvertureMin), fermeA: hhmm(caisse.fermetureMin),
        commandes: cm.map(function (c) {
          return {
            id: c.id, heure: hhmm(c.min), statut: c.statut, total: c.total, paiement: c.paiement,
            produits: c.items.map(function (x) { return { nom: produitParId(x.p).nom, annule: false }; })
              .concat(c.annules.map(function (a) { return { nom: produitParId(a.p).nom, annule: true }; }))
          };
        })
      };
    });
    return reponse({
      jours: res,
      filtres: {
        paiements: MODES_PAIEMENT.map(function (m) { return m.nom; }), salles: SALLES.filter(function (s) { return s.actif; }).map(function (s) { return s.nom; }),
        employes: EMPLOYES.map(function (e) { return e.name; })
      }
    });
  }

  function getOrderById(id) {
    var c = COMMANDES.filter(function (x) { return x.id === id; })[0];
    if (!c) return reponse(null);
    var lignes = c.items.map(function (x) {
      var p = produitParId(x.p);
      return { quantite: x.q, produit: p.nom, prix: totalItem(x), options: x.opts.map(function (o) { return o.nom; }) };
    });
    return reponse({
      id: c.id, date: c.date, heure: hhmm(c.min), salle: c.salle, table: c.table, total: c.total, serveur: c.emp,
      couverts: c.couverts, statut: c.statut, lignes: lignes, paiement: c.paiement, remise: c.remise,
      numeroFiscal: "F" + c.date.replace(/-/g, "") + "-" + c.id.slice(1)
    });
  }

  // ======================================================================
  // API : rapports
  // ======================================================================
  function getReportTotalSales(p) {
    var jours = [], d = new Date(p.dateStart + "T12:00:00"), fin = new Date(p.dateEnd + "T12:00:00");
    var cm = payees(p), tot = totaux(cm), parJour = {}, occurrences = 0, ouverts = 0;
    cm.forEach(function (c) { (parJour[c.date] = parJour[c.date] || []).push(c); });
    while (d <= fin) {
      var iso = jourIso(d);
      if (jourOk(iso, p)) {
        var t = totaux(parJour[iso] || []);
        jours.push({ date: iso, totalSales: t.ttc, totalSalesWithoutTaxes: t.ht });
        if (iso <= AUJ_ISO) occurrences++;
        if (parJour[iso]) ouverts++;
      }
      d.setDate(d.getDate() + 1);
    }
    var tills = {}; cm.forEach(function (c) { tills[c.caisse] = 1; });
    return reponse({
      occurrences: occurrences, joursOuverts: ouverts,
      totalSales: tot.ttc, totalSalesWithoutTaxes: tot.ht, guestsNumber: tot.couverts, orderCount: cm.length,
      averageGuest: tot.couverts ? arrondi(tot.ttc / tot.couverts) : 0, closedTillsCount: Object.keys(tills).length, reportFromPeriod: jours
    });
  }

  function getReportProductsAndCategories(p) {
    var l = lignesVentes(payees(p)), cats = {}, prods = {};
    l.forEach(function (x) {
      var c = cats[x.prod.categorie] = cats[x.prod.categorie] || { category: x.prod.categorie, productSales: 0, productQuantity: 0 };
      c.productSales += x.ttc; c.productQuantity += x.q;
      var q = prods[x.prod.nom] = prods[x.prod.nom] || { name: x.prod.nom, productSales: 0, productQuantity: 0 };
      q.productSales += x.ttc; q.productQuantity += x.q;
    });
    function tri(o) { return Object.keys(o).map(function (k) { o[k].productSales = arrondi(o[k].productSales); return o[k]; }).sort(function (a, b) { return b.productSales - a.productSales; }); }
    return reponse({ categories: tri(cats), products: tri(prods) });
  }

  function getReportClerkShifts(p) {
    var o = {};
    payees(p).forEach(function (c) { o[c.emp] = (o[c.emp] || 0) + c.total; });
    return reponse(Object.keys(o).map(function (k) { return { name: k, totalSalesOwner: arrondi(o[k]) }; })
      .sort(function (a, b) { return b.totalSalesOwner - a.totalSalesOwner; }));
  }

  // ---- Objectifs de CA / couverts : plusieurs objectifs nommés, chacun sur sa période, gardés dans le navigateur ----
  var CLE_OBJECTIFS = "objectifs-liste";
  function lireObjectifs() {
    try {
      var l = JSON.parse(localStorage.getItem(CLE_OBJECTIFS) || "null");
      if (l) return l;
      // Reprise de l'ancienne version (un objectif par mois)
      var vieux = JSON.parse(localStorage.getItem("objectifs-copie") || "{}") || {};
      return Object.keys(vieux).sort().map(function (m) {
        var fin = new Date(+m.slice(0, 4), +m.slice(5, 7), 0).getDate();
        return { id: "m" + m, nom: "Objectif " + m.slice(5) + "/" + m.slice(0, 4), debut: m + "-01", fin: m + "-" + (fin < 10 ? "0" : "") + fin, ca: vieux[m].ca || 0, couverts: vieux[m].couverts || 0 };
      });
    } catch (e) { return []; }
  }
  function sauverObjectifs(l) {
    try { localStorage.setItem(CLE_OBJECTIFS, JSON.stringify(l)); return true; } catch (e) { return false; }
  }
  function getObjectifs() { return reponse(lireObjectifs().sort(function (a, b) { return a.debut < b.debut ? -1 : a.debut > b.debut ? 1 : 0; })); }
  // o = { id (absent = création), nom, debut, fin, ca, couverts } ; refuse si incohérent
  function setObjectif(o) {
    var nom = String(o.nom || "").trim(), ca = Math.max(0, +o.ca || 0), cv = Math.max(0, Math.round(+o.couverts || 0));
    if (!nom) return Promise.reject("Donnez un nom à l'objectif.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(o.debut || "") || !/^\d{4}-\d{2}-\d{2}$/.test(o.fin || "")) return Promise.reject("Renseignez les dates de début et de fin.");
    if (o.fin < o.debut) return Promise.reject("La date de fin précède la date de début.");
    if (!ca && !cv) return Promise.reject("Saisissez un objectif de CA et/ou de couverts.");
    var l = lireObjectifs(), n = { id: o.id || "o" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), nom: nom, debut: o.debut, fin: o.fin, base: o.base === "ht" ? "ht" : "ttc", ca: ca, couverts: cv }, trouve = false;
    l = l.map(function (x) { if (x.id === n.id) { trouve = true; return n; } return x; });
    if (!trouve) l.push(n);
    return sauverObjectifs(l) ? reponse(n) : Promise.reject("Stockage du navigateur indisponible.");
  }
  function deleteObjectif(id) {
    return sauverObjectifs(lireObjectifs().filter(function (x) { return x.id !== id; })) ? reponse(true) : Promise.reject("Stockage du navigateur indisponible.");
  }
  function getRealTime() {
    // Aucune caisse ouverte (comme sur la capture : « Aucune donnée disponible »)
    return reponse({ realTimeData: { totalSales: 0, guestsNumber: 0, orderCount: 0, totalCanceled: 0, totalByHours: [] }, lastWeekData: { totalByHours: [] } });
  }

  // ---- Stocks : PARTIE FACTICE (l'API officielle ne fournit aucune donnée de stock) ----
  // Les stocks et mouvements sont inventés, modifiables (ajout, inventaire, perte) et gardés dans le navigateur.
  var MOTIFS_PERTE = ["DLC dépassée", "Casse", "Vol", "Autre"];
  var STOCK = null;       // [{ id, productName, quantity, lastDeclaredAt, category, subCategory }]
  var MOUVEMENTS = {};    // id produit -> [{ date (ISO complet), type, delta, avant, apres, motif, note }]
  var CLE_STOCK = "stock-factice";
  function initStock() {
    if (STOCK) return;
    try {
      var s = JSON.parse(localStorage.getItem(CLE_STOCK) || "null");
      if (s && s.stock && s.stock.length) { STOCK = s.stock; MOUVEMENTS = s.mouvements || {}; return; }
    } catch (e) { /* stockage indisponible ou illisible : on régénère */ }
    STOCK = PRODUITS.filter(function (p) { return p.cat !== 0 && p.cat !== 5 || p.pole === "Bar"; }).slice(0, 30).map(function (p, i) {
      var declare = i % 4 === 0;
      return {
        id: p.id, productName: p.nom, quantity: declare ? entre(2, 24) : 0,
        lastDeclaredAt: declare ? jourIso(new Date(AUJ.getTime() - entre(3, 40) * 86400000)) : null,
        category: p.categorie, subCategory: p.sousCategorie
      };
    });
  }
  function sauverStock() {
    try { localStorage.setItem(CLE_STOCK, JSON.stringify({ stock: STOCK, mouvements: MOUVEMENTS })); } catch (e) { /* stockage indisponible */ }
  }
  function getHybridStock() { initStock(); return reponse(STOCK); }
  // Produits dont le stock déclaré est au seuil de réapprovisionnement (fiche produit) ou en dessous, les plus bas d'abord
  function getAlertesStock() {
    initStock(); initEdits();
    var seuils = {};
    tousProduits().forEach(function (p) { if (p.seuilReappro !== null && p.seuilReappro !== undefined) seuils[p.id] = p.seuilReappro; });
    return reponse(STOCK.filter(function (l) { return seuils[l.id] !== undefined && l.quantity <= seuils[l.id]; })
      .map(function (l) { return { id: l.id, productName: l.productName, quantity: l.quantity, seuil: seuils[l.id] }; })
      .sort(function (a, b) { return a.quantity - b.quantity; }));
  }
  function getStockMovements(id) { initStock(); return reponse(MOUVEMENTS[id] || []); }
  // m = { type: "ajout" | "inventaire" | "perte", quantite, motif, note } ; rejette avec un message si invalide
  function setStockMovement(id, m) {
    initStock();
    var l = STOCK.filter(function (x) { return x.id === id; })[0], q = Math.round(+m.quantite * 100) / 100;
    if (!l) return Promise.reject("Produit introuvable.");
    if (!isFinite(q) || q < 0 || (m.type !== "inventaire" && q === 0)) return Promise.reject("Quantité invalide.");
    if (m.type === "perte" && MOTIFS_PERTE.indexOf(m.motif) < 0) return Promise.reject("Choisir le motif de la perte.");
    if (m.type === "perte" && q > l.quantity) return Promise.reject("La perte dépasse le stock actuel (" + l.quantity + ").");
    var avant = l.quantity;
    var apres = m.type === "ajout" ? avant + q : m.type === "perte" ? avant - q : q;
    apres = Math.round(apres * 100) / 100;
    l.quantity = apres;
    if (m.type === "inventaire") l.lastDeclaredAt = jourIso(new Date());
    (MOUVEMENTS[id] = MOUVEMENTS[id] || []).unshift({
      date: new Date().toISOString(), type: m.type, delta: Math.round((apres - avant) * 100) / 100, avant: avant, apres: apres,
      motif: m.type === "perte" ? m.motif : "", note: m.note || ""
    });
    sauverStock();
    return reponse(l);
  }

  function getReportProductData(p) {
    var l = lignesVentes(payees(p)), o = {};
    l.forEach(function (x) {
      var e = o[x.prod.id] = o[x.prod.id] || { name: x.prod.nom, category: x.prod.categorie, subCategory: x.prod.sousCategorie, quantity: 0, excludingTax: 0, netAmount: 0, pricing: {} };
      e.quantity += x.q; e.excludingTax += x.ht; e.netAmount += x.ttc;
      var tp = typePrix(x.cmd), pr = e.pricing[tp] = e.pricing[tp] || { pricing: tp, quantity: 0, sales: 0, excludingTax: 0 };
      pr.quantity += x.q; pr.sales += x.ttc; pr.excludingTax += x.ht;
    });
    var items = Object.keys(o).map(function (k) {
      var e = o[k];
      e.excludingTax = arrondi(e.excludingTax); e.netAmount = arrondi(e.netAmount);
      e.pricingList = Object.keys(e.pricing).map(function (z) { var r = e.pricing[z]; r.sales = arrondi(r.sales); r.excludingTax = arrondi(r.excludingTax); return r; });
      delete e.pricing; e.establishment = SITES[0].name; return e;
    }).sort(function (a, b) { return b.netAmount - a.netAmount; });
    var tot = { quantity: 0, excludingTax: 0, netAmount: 0 };
    items.forEach(function (e) { tot.quantity += e.quantity; tot.excludingTax += e.excludingTax; tot.netAmount += e.netAmount; });
    tot.excludingTax = arrondi(tot.excludingTax); tot.netAmount = arrondi(tot.netAmount);
    var parQte = items.slice().sort(function (a, b) { return b.quantity - a.quantity; });
    return reponse({
      totals: tot, items: items,
      topFive: items.slice(0, 5),
      flopFive: items.slice().sort(function (a, b) { return a.netAmount - b.netAmount; }).slice(0, 5), parQuantite: parQte.slice(0, 5)
    });
  }

  function getReportModifiers(p) {
    var o = {};
    lignesVentes(payees(p)).forEach(function (x) {
      x.opts.forEach(function (op) {
        var k = op.groupe + "|" + op.nom, e = o[k] = o[k] || { modifierName: op.nom, modifierGroupName: op.groupe, totalQuantity: 0, totalAmount: 0 };
        e.totalQuantity += x.q; e.totalAmount += op.prix * x.q;
      });
    });
    return reponse(Object.keys(o).map(function (k) { o[k].totalAmount = arrondi(o[k].totalAmount); return o[k]; })
      .sort(function (a, b) { return b.totalQuantity - a.totalQuantity; }));
  }

  function getEmployees(p) {
    var o = {};
    EMPLOYES.forEach(function (e) { o[e.name] = { operatorName: e.name, operatorTotalOrderSales: 0, operatorTotalCashed: 0, operatorOrderCount: 0, operatorGuestCount: 0, operatorTotalDiscount: 0, operatorTotalDiscountQuantity: 0, operatorTotalTips: 0, operatorTotalCanceled: 0, operatorTotalCanceledQuantity: 0, operatorTotalLoss: 0 }; });
    commandesDe(p).forEach(function (c) {
      var e = o[c.emp];
      if (c.statut === "paid") {
        e.operatorTotalOrderSales += c.total; e.operatorTotalCashed += c.total; e.operatorOrderCount++; e.operatorGuestCount += c.couverts;
        if (c.remise) { e.operatorTotalDiscount += c.remise.montant; e.operatorTotalDiscountQuantity++; }
      }
      c.annules.forEach(function (a) { e.operatorTotalCanceled += a.prix * a.q; e.operatorTotalCanceledQuantity += a.q; });
    });
    return reponse(Object.keys(o).map(function (k) {
      var e = o[k];
      ["operatorTotalOrderSales", "operatorTotalCashed", "operatorTotalDiscount", "operatorTotalCanceled"].forEach(function (f) { e[f] = arrondi(e[f]); });
      e.operatorAverageOrder = e.operatorOrderCount ? arrondi(e.operatorTotalOrderSales / e.operatorOrderCount) : 0;
      e.operatorAverageCover = e.operatorGuestCount ? arrondi(e.operatorTotalOrderSales / e.operatorGuestCount) : 0;
      return e;
    }).filter(function (e) { return e.operatorOrderCount > 0 || e.operatorTotalCanceledQuantity > 0; })
      .sort(function (a, b) { return b.operatorTotalOrderSales - a.operatorTotalOrderSales; }));
  }

  function getReportCancelation(p) {
    var av = {}, ap = {}, totAv = 0, totAp = 0;
    commandesDe(p).forEach(function (c) {
      c.annules.forEach(function (a) {
        var m = a.apres ? ap : av, e = m[a.motif] = m[a.motif] || { canceledReason: a.motif, canceledAmount: 0, quantity: 0, produits: {} };
        var mt = a.prix * a.q; e.canceledAmount += mt; e.quantity += a.q;
        var pn = produitParId(a.p).nom, pp = e.produits[pn] = e.produits[pn] || { name: pn, quantity: 0, amount: 0 };
        pp.quantity += a.q; pp.amount += mt;
        if (a.apres) totAp += mt; else totAv += mt;
      });
    });
    function liste(m) {
      return Object.keys(m).map(function (k) {
        var e = m[k]; e.canceledAmount = arrondi(e.canceledAmount);
        e.productList = Object.keys(e.produits).map(function (z) { e.produits[z].amount = arrondi(e.produits[z].amount); return e.produits[z]; });
        delete e.produits; return e;
      }).sort(function (a, b) { return b.quantity - a.quantity; });
    }
    return reponse({
      blocStats: { totalCanceledAmountBeforeCashIn: arrondi(totAv), totalCanceledAmountAfterCashIn: arrondi(totAp), totalCanceledAmount: arrondi(totAv + totAp) },
      cancelByReasonBeforeCashIn: liste(av), cancelByReasonAfterCashIn: liste(ap)
    });
  }

  function getReportLosses() { return reponse({ blocStats: { total: 0, totalQuantity: 0 }, lossListByOrder: [] }); }

  function getReportDiscount(p) {
    var o = {}, tot = 0, offert = 0;
    payees(p).forEach(function (c) {
      if (!c.remise) return;
      var e = o[c.remise.nom] = o[c.remise.nom] || { discountName: c.remise.nom, quantity: 0, discountAmount: 0, taxes: {} };
      e.quantity++; e.discountAmount += c.remise.montant; tot += c.remise.montant;
      if (c.remise.nom === "Offert") offert += c.remise.montant;
      var l = lignesVentes([c]), somme = 0;
      l.forEach(function (x) { somme += x.ttc; });
      e.produits = e.produits || {};
      l.forEach(function (x) {
        var pr = e.produits[x.prod.nom] = e.produits[x.prod.nom] || { name: x.prod.nom, taxRate: x.tva, quantity: 0, amountTTC: 0 };
        pr.quantity += x.q; pr.amountTTC += somme ? c.remise.montant * x.ttc / somme : 0;
      });
      var taux = l.length ? l[0].tva : 10, tx = e.taxes[taux] = e.taxes[taux] || { taxName: nomTaxe(taux), taxRate: taux, quantity: 0, amountHT: 0, amountTVA: 0, amountTTC: 0 };
      tx.quantity++; tx.amountTTC += c.remise.montant; tx.amountHT += ht(c.remise.montant, taux); tx.amountTVA += c.remise.montant - ht(c.remise.montant, taux);
    });
    return reponse({
      blocStats: { discountSum: arrondi(tot - offert), giftedSum: arrondi(offert), total: arrondi(tot) },
      discountList: Object.keys(o).map(function (k) {
        var e = o[k]; e.discountAmount = arrondi(e.discountAmount);
        e.taxRepartition = Object.keys(e.taxes).map(function (t) { var x = e.taxes[t]; x.amountHT = arrondi(x.amountHT); x.amountTVA = arrondi(x.amountTVA); x.amountTTC = arrondi(x.amountTTC); return x; });
        e.productList = Object.keys(e.produits).map(function (k2) { var x = e.produits[k2]; x.amountTTC = arrondi(x.amountTTC); x.amountHT = arrondi(ht(x.amountTTC, x.taxRate)); x.amountTVA = arrondi(x.amountTTC - x.amountHT); return x; });
        delete e.taxes; delete e.produits; return e;
      })
    });
  }

  function getReportTaxes(p) {
    var o = {};
    lignesVentes(payees(p)).forEach(function (l) {
      var e = o[l.tva] = o[l.tva] || { taxName: nomTaxe(l.tva), taxRate: l.tva, totalWithoutTax: 0, totalTax: 0, totalWithTax: 0 };
      e.totalWithoutTax += l.ht; e.totalWithTax += l.ttc;
    });
    return reponse(Object.keys(o).map(function (k) {
      var e = o[k]; e.totalWithoutTax = arrondi(e.totalWithoutTax); e.totalWithTax = arrondi(e.totalWithTax);
      e.totalTax = arrondi(e.totalWithTax - e.totalWithoutTax); return e;
    }).sort(function (a, b) { return b.totalWithTax - a.totalWithTax; }));
  }

  function getReportPaymentMode(p) {
    var o = {};
    payees(p).forEach(function (c) {
      paiementsDe(c).forEach(function (pa) {
        var m = MODES_PAIEMENT.filter(function (x) { return x.nom === pa.nom; })[0];
        var e = o[pa.nom] = o[pa.nom] || { paymentName: pa.nom, paymentModeSum: 0, paymentModeQuantity: 0, paymentModeTips: 0, couleur: m ? m.couleur : "#999" };
        e.paymentModeSum += pa.montant; e.paymentModeQuantity++;
      });
    });
    return reponse(Object.keys(o).map(function (k) { o[k].paymentModeSum = arrondi(o[k].paymentModeSum); return o[k]; })
      .sort(function (a, b) { return b.paymentModeSum - a.paymentModeSum; }));
  }

  function getReportCategories(p) {
    var cats = {}, temps = {};
    lignesVentes(payees(p)).forEach(function (l) {
      var c = cats[l.prod.categorie] = cats[l.prod.categorie] || { name: l.prod.categorie, sales: 0, quantity: 0, salesWithoutTaxes: 0, couleur: l.prod.couleur, subs: {} };
      c.sales += l.ttc; c.quantity += l.q; c.salesWithoutTaxes += l.ht;
      var s = c.subs[l.prod.sousCategorie] = c.subs[l.prod.sousCategorie] || { name: l.prod.sousCategorie, sales: 0, quantity: 0, salesWithoutTaxes: 0 };
      s.sales += l.ttc; s.quantity += l.q; s.salesWithoutTaxes += l.ht;
      var t = temps[l.cmd.date] = temps[l.cmd.date] || {}; t[l.prod.categorie] = (t[l.prod.categorie] || 0) + l.ttc;
    });
    var liste = Object.keys(cats).map(function (k) {
      var c = cats[k];
      c.subCategoryList = Object.keys(c.subs).map(function (z) { var s = c.subs[z]; s.sales = arrondi(s.sales); s.salesWithoutTaxes = arrondi(s.salesWithoutTaxes); return s; });
      delete c.subs; c.sales = arrondi(c.sales); c.salesWithoutTaxes = arrondi(c.salesWithoutTaxes); return c;
    }).sort(function (a, b) { return b.sales - a.sales; });
    return reponse({ categorySales: liste, timed: temps, ordreCategories: liste.map(function (c) { return c.name; }) });
  }

  // ---------- Créneaux de service (2 ou 3, horaires libres, mémorisés dans le navigateur) ----------
  var CRENEAUX_DEFAUT = [
    { nom: "Service du midi", debut: "11:00", fin: "15:00" },
    { nom: "Limonade", debut: "15:00", fin: "18:00" },
    { nom: "Service du soir", debut: "18:00", fin: "24:00" }
  ];
  function enMinutes(hhmm) { var s = String(hhmm || "").split(":"); return (+s[0]) * 60 + (+s[1] || 0); }
  function getCreneaux() {
    try {
      var l = JSON.parse(localStorage.getItem("creneaux-copie") || "null");
      if (l && l.length >= 2 && l.length <= 3) return l;
    } catch (e) { /* stockage indisponible ou illisible : valeurs par défaut */ }
    return CRENEAUX_DEFAUT.map(function (c) { return { nom: c.nom, debut: c.debut, fin: c.fin }; });
  }
  function setCreneaux(liste) {
    try { if (liste) localStorage.setItem("creneaux-copie", JSON.stringify(liste)); else localStorage.removeItem("creneaux-copie"); return true; }
    catch (e) { return false; }
  }
  // Indice du créneau contenant une minute de la journée, ou -1
  function indexCreneau(liste, min) {
    for (var i = 0; i < liste.length; i++) {
      var d = enMinutes(liste[i].debut), f = enMinutes(liste[i].fin);
      if (f <= d) f += 1440;
      if (min >= d && min < f) return i;
    }
    return -1;
  }

  function getSalesDistribution(p) {
    var cren = getCreneaux(), parCreneau = cren.map(function (c) { return { slot: c.nom, horaire: c.debut + " – " + c.fin, valeurs: {}, quantites: {} }; });
    var horsCreneau = { slot: "Hors créneau", horaire: "", valeurs: {}, quantites: {}, vide: true };
    var jours = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
    var cats = nomsCats(), parJour = [], i;
    for (i = 0; i < 7; i++) { parJour.push({ day: jours[i], valeurs: {}, quantites: {}, sessions: {} }); }
    var heat = {}, tranches = {};
    lignesVentes(payees(p)).forEach(function (l) {
      var dj = (new Date(l.cmd.date + "T12:00:00").getDay() + 6) % 7;
      var o = parJour[dj];
      o.valeurs[l.prod.categorie] = (o.valeurs[l.prod.categorie] || 0) + l.ttc;
      o.quantites[l.prod.categorie] = (o.quantites[l.prod.categorie] || 0) + l.q;
      o.sessions[l.cmd.date] = 1;
      var h = Math.floor(l.cmd.min / 60), k = dj + "-" + h;
      heat[k] = (heat[k] || 0) + l.ttc;
      var tr = tranches[h] = tranches[h] || { slot: deux(h) + ":00", valeurs: {}, quantites: {} };
      tr.valeurs[l.prod.categorie] = (tr.valeurs[l.prod.categorie] || 0) + l.ttc;
      tr.quantites[l.prod.categorie] = (tr.quantites[l.prod.categorie] || 0) + l.q;
      var ic = indexCreneau(cren, l.cmd.min), cr = ic < 0 ? horsCreneau : parCreneau[ic];
      cr.valeurs[l.prod.categorie] = (cr.valeurs[l.prod.categorie] || 0) + l.ttc;
      cr.quantites[l.prod.categorie] = (cr.quantites[l.prod.categorie] || 0) + l.q;
      if (ic < 0) horsCreneau.vide = false;
    });
    if (!horsCreneau.vide) parCreneau.push(horsCreneau);
    parJour.forEach(function (o) { o.nbSessions = Object.keys(o.sessions).length; delete o.sessions; });
    return reponse({
      parCreneau: parCreneau, categories: cats, couleurs: CATEGORIES.map(function (c) { return c.couleur; }), parJour: parJour,
      parTranche: Object.keys(tranches).sort(function (a, b) { return a - b; }).map(function (h) { return tranches[h]; }),
      heatmap: Object.keys(heat).map(function (k) { var s = k.split("-"); return { jour: +s[0], heure: +s[1], valeur: arrondi(heat[k]) }; })
    });
  }

  function getReportMenuSales(p) {
    var o = {};
    payees(p).forEach(function (c) {
      (c.menus || []).forEach(function (m) {
        var e = o[m.nom] = o[m.nom] || { menuName: m.nom, quantity: 0, total: 0 };
        e.quantity++; e.total += m.montant;
      });
    });
    return reponse(Object.keys(o).map(function (k) { o[k].total = arrondi(o[k].total); return o[k]; }).sort(function (a, b) { return b.total - a.total; }));
  }

  function getNewHistoryZTill(p) {
    return reponse(CAISSES.filter(function (z) { return dans(z.date, p); }).map(function (z) {
      var t = totaux(z.commandes.filter(function (c) { return c.statut === "paid"; }));
      return { id: z.id, date: z.date, startedAt: hhmm(z.ouvertureMin), finalizedAt: hhmm(z.fermetureMin), totalSales: t.ttc };
    }).sort(function (a, b) { return a.date < b.date ? 1 : -1; }));
  }

  function getReportById(id) {
    var z = CAISSES.filter(function (x) { return x.id === id; })[0];
    if (!z) return reponse(null);
    var cm = z.commandes.filter(function (c) { return c.statut === "paid"; }), t = totaux(cm);
    var pay = {}, taxes = {}, rooms = {}, prods = {}, ann = {}, tips = 0;
    cm.forEach(function (c) {
      paiementsDe(c).forEach(function (pa) {
        var pp = pay[pa.nom] = pay[pa.nom] || { name: pa.nom, quantity: 0, totalAmount: 0 };
        pp.quantity++; pp.totalAmount += pa.montant;
      });
      var r = rooms[c.salle] = rooms[c.salle] || { name: c.salle, orderCount: 0, guestCount: 0, total: 0, totalExcludingTax: 0 };
      r.orderCount++; r.guestCount += c.couverts; r.total += c.total;
    });
    lignesVentes(cm).forEach(function (l) {
      var x = taxes[l.tva] = taxes[l.tva] || { taxName: nomTaxe(l.tva), taxRate: l.tva, taxableAmount: 0, taxAmount: 0 };
      x.taxableAmount += l.ht; x.taxAmount += l.ttc - l.ht;
      var q = prods[l.prod.id] = prods[l.prod.id] || { productName: l.prod.nom, category: l.prod.categorie, productQuantity: 0, productSales: 0 };
      q.productQuantity += l.q; q.productSales += l.ttc;
      var r = rooms[l.cmd.salle]; r.totalExcludingTax += l.ht;
    });
    z.commandes.forEach(function (c) { c.annules.forEach(function (a) {
      var e = ann[a.motif] = ann[a.motif] || { name: a.motif, quantity: 0, amount: 0 }; e.quantity += a.q; e.amount += a.prix * a.q; }); });
    function r2(o) { return Object.keys(o).map(function (k) { var e = o[k]; Object.keys(e).forEach(function (f) { if (typeof e[f] === "number") e[f] = arrondi(e[f]); }); return e; }); }
    var encaisse = t.ttc;
    return reponse({
      id: z.id, date: z.date, reportNumber: z.numero, startedAt: hhmm(z.ouvertureMin), finalizedAt: hhmm(z.fermetureMin),
      totalOrders: cm.length, guestsNumberTotal: t.couverts, totalSalesSum: t.ttc, totalSalesWithoutTax: t.ht,
      averageGuest: t.couverts ? arrondi(t.ttc / t.couverts) : 0, averageOrder: cm.length ? arrondi(t.ttc / cm.length) : 0,
      taxSummary: r2(taxes), paymentSummary: r2(pay), productSummary: r2(prods).sort(function (a, b) { return b.productSales - a.productSales; }),
      cancelationSummary: r2(ann), roomSummary: r2(rooms),
      salesStatisticsData: { totalOrdered: encaisse, totalCharged: encaisse, totalTips: tips, initialCashFloat: z.fondInitial, finalCashFloat: z.fondInitial + 0, gap: 0 }
    });
  }

  function getFiscalArchives(p) {
    var jours = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    var mois = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
    function fr(iso) { var d = new Date(iso + "T12:00:00"); return jours[d.getDay()] + " " + d.getDate() + " " + mois[d.getMonth()] + " " + d.getFullYear(); }
    function jjmmaaaa(iso) { var s = iso.split("-"); return s[2] + "-" + s[1] + "-" + s[0]; }
    var res = [];
    CAISSES.filter(function (z) { return dans(z.date, p); }).forEach(function (z) {
      res.push({ id: "f" + z.date, titre: "Archive fiscale du " + fr(z.date), sauvegarde: jjmmaaaa(z.date), type: "Journalière", fichier: "ArchiveFiscale_" + z.date.replace(/-/g, "") + ".csv", date: z.date });
    });
    // Archives mensuelles : le 1er de chaque mois présent dans la période
    var d = new Date(p.dateStart + "T12:00:00");
    d = new Date(d.getFullYear(), d.getMonth(), 1, 12);
    var fin = new Date(p.dateEnd + "T12:00:00");
    while (d <= fin) {
      var iso = jourIso(d);
      if (iso <= AUJ_ISO && iso >= p.dateStart) res.push({ id: "m" + iso, titre: "Archive fiscale du " + fr(iso), sauvegarde: jjmmaaaa(iso), type: "Mensuelle", fichier: "ArchiveFiscale_" + iso.slice(0, 7).replace("-", "") + "_mois.csv", date: iso });
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1, 12);
    }
    return reponse(res.sort(function (a, b) { return a.date < b.date ? 1 : -1; }));
  }

  function getRoomsReport(p) {
    var cm = payees(p), t = totaux(cm), o = {};
    cm.forEach(function (c) {
      var r = o[c.salle] = o[c.salle] || { roomName: c.salle, totalSales: 0, guestCount: 0, orderCount: 0 };
      r.totalSales += c.total; r.guestCount += c.couverts; r.orderCount++;
    });
    var modes = {};
    Object.keys(o).forEach(function (k) {
      var s = SALLES.filter(function (x) { return x.nom === k; })[0];
      var lib = s.type === "bar" ? "Comptoir" : "Salle";
      var m = modes[lib] = modes[lib] || { type: lib, orderCount: 0, guestCount: 0, total: 0, rooms: [] };
      m.orderCount += o[k].orderCount; m.guestCount += o[k].guestCount; m.total += o[k].totalSales;
      m.rooms.push({ name: k, orderCount: o[k].orderCount, guestCount: o[k].guestCount, total: arrondi(o[k].totalSales) });
    });
    return reponse({
      summary: { orderCount: cm.length, averagePerOrder: cm.length ? arrondi(t.ttc / cm.length) : 0, totalTTC: t.ttc, guestCount: t.couverts, averagePerGuest: t.couverts ? arrondi(t.ttc / t.couverts) : 0 },
      barChart: Object.keys(modes).map(function (k) { modes[k].total = arrondi(modes[k].total); return { roomName: k, totalSales: modes[k].total }; }),
      modes: Object.keys(modes).map(function (k) { return modes[k]; })
    });
  }

  // ======================================================================
  // API : point de vente (catalogue et configuration)
  // ======================================================================
  // ---- Édition des produits : surcharge locale gardée dans le navigateur (le catalogue d'origine n'est jamais modifié) ----
  // modifs : id produit existant -> champs modifiés ; ajouts : produits créés ; achat : gestion des prix d'achat activée
  var CLE_PRODUITS = "produits-copie";
  var EDITS = null;
  var CHAMPS_PRODUIT = ["nom", "categorie", "sousCategorie", "poles", "niveau", "options", "typePrix", "prix", "tva", "achat", "codeBarre", "sku", "plu", "nomBouton", "nomPrepa", "seuilReappro"];
  function initEdits() {
    if (EDITS) return;
    try { EDITS = JSON.parse(localStorage.getItem(CLE_PRODUITS) || "null"); } catch (e) { EDITS = null; }
    if (!EDITS || typeof EDITS !== "object") EDITS = {};
    EDITS.modifs = EDITS.modifs || {}; EDITS.ajouts = EDITS.ajouts || []; EDITS.achat = !!EDITS.achat;
  }
  function sauverEdits() {
    try { localStorage.setItem(CLE_PRODUITS, JSON.stringify(EDITS)); return true; } catch (e) { return false; }
  }
  function couleurCategorie(nom, defaut) {
    var c = CATEGORIES.filter(function (x) { return x.nom === nom; })[0];
    return c ? c.couleur : (defaut || "#888888");
  }
  // Produit complet = valeurs d'origine + surcharge
  function produitComplet(base, ajout) {
    var m = ajout ? base : (EDITS.modifs[base.id] || {});
    var o = {
      id: base.id, nom: base.nom, categorie: base.categorie, sousCategorie: base.sousCategorie, poles: ajout ? [] : poles(base),
      niveau: "Aucun", options: !ajout && base.groupe ? [base.groupe] : [], typePrix: "unitaire", prix: base.prix, tva: base.tva, achat: null,
      codeBarre: "", sku: "", plu: "", nomBouton: "", nomPrepa: "", seuilReappro: null, nbPrix: 1, ajoute: !!ajout, modifie: !ajout && !!EDITS.modifs[base.id]
    };
    CHAMPS_PRODUIT.forEach(function (k) { if (m[k] !== undefined) o[k] = m[k]; });
    o.couleur = couleurCategorie(o.categorie, base.couleur);
    return o;
  }
  function tousProduits() {
    initEdits();
    return PRODUITS.map(function (p) { return produitComplet(p, false); }).concat(EDITS.ajouts.map(function (a) { return produitComplet(a, true); }));
  }
  function getProduct(id) {
    var p = tousProduits().filter(function (x) { return x.id === id; })[0];
    return p ? reponse(p) : Promise.reject("Produit introuvable.");
  }
  // d = champs saisis ; id null = création. Rejette avec un message si invalide.
  function setProduct(id, d) {
    initEdits();
    var nom = String(d.nom || "").trim(), prix = Math.round(+d.prix * 100) / 100, tva = +d.tva;
    var achat = d.achat === null || d.achat === "" || d.achat === undefined ? null : Math.round(+d.achat * 10000) / 10000;
    if (!nom) return Promise.reject("Le nom est obligatoire.");
    if (!d.categorie) return Promise.reject("Choisir une catégorie.");
    if (!isFinite(prix) || prix < 0) return Promise.reject("Prix invalide.");
    if (!isFinite(tva)) return Promise.reject("Choisir la TVA.");
    if (achat !== null && (!isFinite(achat) || achat < 0)) return Promise.reject("Prix d'achat invalide.");
    var seuil = d.seuilReappro === null || d.seuilReappro === "" || d.seuilReappro === undefined ? null : Math.round(+d.seuilReappro * 100) / 100;
    if (seuil !== null && (!isFinite(seuil) || seuil < 0)) return Promise.reject("Seuil de réapprovisionnement invalide.");
    var val = { nom: nom, categorie: d.categorie, sousCategorie: d.sousCategorie || "", poles: d.poles || [], niveau: d.niveau || "Aucun", options: d.options || [],
      typePrix: d.typePrix || "unitaire", prix: prix, tva: tva, achat: achat, codeBarre: String(d.codeBarre || "").trim(), sku: String(d.sku || "").trim(),
      plu: String(d.plu || "").trim(), nomBouton: String(d.nomBouton || "").trim(), nomPrepa: String(d.nomPrepa || "").trim(), seuilReappro: seuil };
    var ajout = id ? EDITS.ajouts.filter(function (a) { return a.id === id; })[0] : null;
    if (!id) { val.id = "n" + Date.now(); EDITS.ajouts.push(val); id = val.id; }
    else if (ajout) { val.id = id; EDITS.ajouts[EDITS.ajouts.indexOf(ajout)] = val; }
    else if (PRODUITS.some(function (p) { return p.id === id; })) EDITS.modifs[id] = val;
    else return Promise.reject("Produit introuvable.");
    if (!sauverEdits()) return Promise.reject("Stockage du navigateur indisponible.");
    return getProduct(id);
  }
  // Supprime un produit créé, ou rétablit un produit d'origine modifié
  function resetProduct(id) {
    initEdits();
    EDITS.ajouts = EDITS.ajouts.filter(function (a) { return a.id !== id; });
    delete EDITS.modifs[id];
    sauverEdits();
    return reponse(true);
  }
  function getGestionAchat() { initEdits(); return reponse(EDITS.achat); }
  function setGestionAchat(actif) { initEdits(); EDITS.achat = !!actif; sauverEdits(); return reponse(EDITS.achat); }
  // Marge d'un produit : prix TTC, TVA en %, prix d'achat HT. Taux de marque = marge / prix de vente HT ; coefficient = HT / achat.
  function calculMarge(prix, tva, achat) {
    if (achat === null || achat === undefined || achat === "" || !isFinite(+achat) || !isFinite(+prix)) return null;
    var vente = ht(+prix, +tva || 0), marge = vente - +achat;
    return { ht: vente, marge: marge, taux: vente > 0 ? marge / vente * 100 : null, coef: +achat > 0 ? vente / +achat : null };
  }

  function getCatalogue() {
    return reponse({
      produits: tousProduits(),
      categories: CATEGORIES.map(function (c) { return { nom: c.nom, couleur: c.couleur, sous: c.sous }; }),
      poles: ["Cuisine", "Bar", "Crêperie", "Dessert"], taxes: TAXES.map(function (t) { return t.name; })
    });
  }
  function poles(p) { return !p.pole ? [] : (p.pole === "Crêperie" ? ["Crêperie", "Cuisine"] : [p.pole]); }

  function getAllModifierGroups() {
    return reponse(GROUPES_OPTIONS.map(function (g) { return { id: g.id, nom: g.nom, valeurs: g.options.map(function (o) { return { nom: o[0], prix: o[1] }; }) }; }));
  }
  function getAllMeals() {
    return reponse([{ id: "ml1", nom: "Formule midi", etapes: ["Entrée", "Plat", "Dessert"], prix: 16.5 }]);
  }
  function getEmployeesPos() {
    // Aucun champ « password » (code PIN) : il ne doit jamais exister côté écran.
    return reponse(EMPLOYES.map(function (e) { return { id: e.id, name: e.name, isOwner: e.isOwner }; }));
  }
  function getRooms() {
    return reponse(SALLES.map(function (s) { return { id: s.id, name: s.nom, enabled: s.actif, type: s.type, tables: s.tables }; }));
  }
  function getPrintersList() {
    return reponse([
      { id: "i1", name: "Bar", ip: "10.0.0.21", port: 6001, mac: "00:11:22:33:44:01", marque: "MARQUE INCONNUE", modele: "MODELE-A", interface: "RÉSEAU", poste: "Bar" },
      { id: "i2", name: "Cuisine", ip: "10.0.0.22", port: 6001, mac: "00:11:22:33:44:02", marque: "MARQUE INCONNUE", modele: "MODELE-A", interface: "RÉSEAU", poste: "Cuisine" },
      { id: "i3", name: "Crêperie", ip: "10.0.0.23", port: 6001, mac: "00:11:22:33:44:03", marque: "MARQUE INCONNUE", modele: "MODELE-B", interface: "RÉSEAU", poste: "Crêperie" },
      { id: "i4", name: "Imprimante Ticket", ip: "10.0.0.24", port: 8001, mac: "00:11:22:33:44:04", marque: "MARQUE INCONNUE", modele: "MODELE-A", interface: "RÉSEAU", poste: "Ticket" },
      { id: "i5", name: "Dessert", ip: "10.0.0.25", port: 9100, mac: "00:11:22:33:44:05", marque: "MARQUE INCONNUE", modele: "MODELE-C", interface: "RÉSEAU", poste: "Dessert" }
    ]);
  }
  function getAllPreparationStations() {
    return reponse([
      { id: "s1", name: "Cuisine", recap: true, imprimante: "Cuisine" }, { id: "s2", name: "Bar", recap: false, imprimante: "Bar" },
      { id: "s3", name: "Dessert", recap: true, imprimante: "Dessert" }, { id: "s4", name: "Crêperie", recap: true, imprimante: "Crêperie" }
    ]);
  }
  function getPricingList() {
    return reponse({
      salle: [{ name: "Normal" }, { name: "Comptoir" }, { name: "À emporter" }, { name: "Terrasse" }],
      horaires: [{ name: "Happy Hour", actif: true }, { name: "Prix carte d'été", actif: true }],
      evenements: [1, 2, 3, 4, 5, 6, 7].map(function (n) { return { name: "Évènement " + n, actif: true }; })
    });
  }
  function getAllTaxes() {
    return reponse(TAXES.map(function (t) { return { id: t.id, name: t.name, rate: t.rate, nbProduits: PRODUITS.filter(function (p) { return p.tva === t.rate; }).length }; }));
  }
  function getDiscounts() { return reponse(REMISES); }
  function getCashMovementReasons() { return reponse([{ id: "cm1", name: "Fond de caisse" }, { id: "cm2", name: "Retrait banque" }, { id: "cm3", name: "Petite dépense" }]); }
  function getAllPayments() {
    return reponse(MODES_PAIEMENT.map(function (m) { return { id: m.id, name: m.nom, enabled: m.actif !== false, voucher: m.voucher, openCashDrawer: m.tiroir, tips: m.tips }; }));
  }
  function getReceiptSettings() {
    if (RECU) return reponse(RECU);
    return reponse({
      establishmentName: SITES[0].name, address1: "1 rue de l'Exemple", address2: "", zipCode: "00000", city: "Ville", country: "France",
      phoneNumber: "01 00 00 00 00", siretCode: "000 000 000 00000", nafCode: "0000Z", tvaCode: "FR00000000000",
      customHeader: "Bienvenue !", customFooter: "Merci de votre visite"
    });
  }
  function getMiscSettings() {
    return reponse({
      timezone: "Europe/Paris", defaultPrinter: "Imprimante Ticket", qrCodeLogin: false, allowGapInTillStats: true, allowCatalogEditOnPos: true,
      printOnPay: true, detailedReport: true, groupProductsOnOrder: true, askForInitialCashFloat: true, enablePreparationCall: false,
      closeAfterOrderCall: false, doNotPrintClaim: false, groupProductsOnPrepaReceipt: true, cutBetweenSteps: true, printOnlyFirstPrepaReceipt: false
    });
  }
  function getLogicalDevices() {
    var noms = ["iPad principal", "iPad salle 1", "iPad salle 2", "iPad terrasse", "iPad bar", "iPad crêperie", "iPad comptoir"];
    if (APPAREILS_REELS) {
      return reponse({
        contrat: { type: "-", principal: [Math.min(1, APPAREILS_REELS.length), 1], secondaire: [Math.max(0, APPAREILS_REELS.length - 1), Math.max(0, APPAREILS_REELS.length - 1)], bornes: [0, 0], ecrans: [0, 0] },
        appareils: APPAREILS_REELS
      });
    }
    return reponse({
      contrat: { type: "Contrat de démonstration avec renouvellement tacite", principal: [1, 1], secondaire: [6, 6], bornes: [0, 0], ecrans: [0, 0] },
      appareils: noms.map(function (n, i) {
        return { id: "a" + i, name: n, derniereConnexion: (i === 0 ? "10h 27m 42s" : (i * 3 + 2) + "j 4h 12m"), modele: "Tablette (démo)", os: "iOS", version: "17.5." + i, role: i === 0 ? "Caisse principale" : "Caisse secondaire" };
      })
    });
  }

  // Mise en page de la caisse : catégories -> sous-catégories -> boutons produit
  function getLayout() {
    return reponse(CATEGORIES.map(function (c, ci) {
      return {
        nom: c.nom, couleur: c.couleur, nbMenus: 5,
        sous: c.sous.map(function (s, si) {
          return { nom: s, produits: PRODUITS.filter(function (p) { return p.cat === ci && p.sous === si; }).map(function (p) { return { nom: p.nom, prix: p.prix }; }) };
        })
      };
    }));
  }

  // ======================================================================
  // API : réservations, clients
  // ======================================================================
  var PRENOMS = ["Louise", "Hugo", "Camille", "Noé", "Jade", "Lucas", "Manon", "Théo", "Sarah", "Léo", "Zoé", "Adam", "Nina", "Paul", "Lina", "Tom", "Inès", "Axel", "Anna", "Marc"];
  var NOMS = ["Martin", "Bernard", "Dubois", "Thomas", "Robert", "Richard", "Petit", "Durand", "Leroy", "Moreau", "Simon", "Laurent", "Lefebvre", "Michel", "Garcia", "David", "Bertrand", "Roux", "Vincent", "Fournier"];
  var CLIENTS = [];
  (function () {
    for (var i = 0; i < 120; i++) {
      var nom = choisir(PRENOMS) + " " + choisir(NOMS);
      var solde = alea() < 0.18 ? -arrondi(entre(20, 300) + alea()) : 0;
      var cagnotte = alea() < 0.25 ? arrondi(entre(5, 120)) : 0;
      CLIENTS.push({
        id: "k" + (i + 1), name: nom, solde: solde, cagnotte: cagnotte,
        phone: alea() < 0.6 ? "06 00 00 " + deux(entre(0, 99)) + " " + deux(entre(0, 99)) : "",
        email: alea() < 0.3 ? nom.toLowerCase().replace(/[^a-z]+/g, ".") + "@exemple.test" : "",
        address: "", city: "", zip: "", company: alea() < 0.1 ? "Société Exemple" : "", orders: entre(0, 14), unpaid: solde < 0 ? entre(1, 3) : 0,
        comment: ""
      });
    }
    CLIENTS.sort(function (a, b) { return a.name < b.name ? -1 : 1; });
  })();
  function getReservationList(date) {
    var jour = new Date(date + "T12:00:00");
    var future = date > AUJ_ISO && jour.getDay() !== 1 && jour.getDay() !== 2;
    var liste = future ? [
      { heure: "12:00", nom: "Famille Exemple", couverts: 4, statut: "En attente", note: "" },
      { heure: "12:30", nom: "Dupont", couverts: 2, statut: "En attente", note: "Terrasse" },
      { heure: "19:30", nom: "Groupe Démo", couverts: 8, statut: "En attente", note: "Anniversaire" }
    ] : [];
    var cv = 0; liste.forEach(function (r) { cv += r.couverts; });
    return reponse({ reservations: liste, totalNumberOfGuests: cv });
  }
  // ---- Bons cadeaux : PARTIE FACTICE (aucune source dans l'API), gardés dans le navigateur ----
  // Un bon : { id, code, montant, solde, creeLe, expireLe, clientId, note, annule, historique:[{date,type,montant,note}] }
  var CLE_BONS = "bons-factices";
  var BONS = null;
  function ajouterJours(iso, n) { var d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return jourIso(d); }
  function ajouterMois(iso, n) {
    var d = new Date(iso + "T12:00:00"), j = d.getDate();
    d.setDate(1); d.setMonth(d.getMonth() + n);
    d.setDate(Math.min(j, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    return jourIso(d);
  }
  function statutBon(b) {
    if (b.annule) return "annule";
    if (b.solde <= 0) return "epuise";
    return b.expireLe < AUJ_ISO ? "expire" : "actif";
  }
  function initBons() {
    if (BONS) return;
    try {
      var s = JSON.parse(localStorage.getItem(CLE_BONS) || "null");
      if (s && s.length) { BONS = s; return; }
    } catch (e) { /* stockage indisponible ou illisible : on régénère */ }
    // Générateur propre (graine fixe) pour ne pas décaler les autres données inventées
    var g = 20261019;
    function r() { g = (g * 1103515245 + 12345) % 2147483648; return g / 2147483648; }
    var lettres = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    function code() { var c = "BC-"; for (var i = 0; i < 6; i++) c += lettres.charAt(Math.floor(r() * lettres.length)) + (i === 3 ? "-" : ""); return c; }
    var montants = [20, 25, 30, 50, 50, 75, 100, 150];
    var notes = ["", "", "Anniversaire", "Noël", "Cadeau d'entreprise", "Offert par la maison", "Fête des mères", "Remerciement"];
    BONS = [];
    for (var i = 0; i < 24; i++) {
      var m = montants[Math.floor(r() * montants.length)], cree = ajouterJours(AUJ_ISO, -Math.floor(r() * 300) - 5);
      var duree = [3, 6, 12, 12, 24][Math.floor(r() * 5)], expire = ajouterMois(cree, duree);
      var type = i % 8 === 0 ? "epuise" : i % 11 === 5 ? "annule" : i % 5 === 3 ? "partiel" : "plein";
      if (i < 5 && type !== "partiel") type = "plein";
      var solde = type === "epuise" ? 0 : type === "partiel" ? Math.max(5, Math.round(m * (0.2 + r() * 0.6))) : m;
      // quelques bons proches de leur fin de validité pour illustrer le tri et les alertes
      if (i < 5) expire = ajouterJours(AUJ_ISO, [3, 9, 18, 26, 45][i]);
      var hist = [{ date: cree, type: "creation", montant: m, note: "" }];
      if (solde < m) hist.push({ date: ajouterJours(cree, Math.floor(r() * 30) + 1), type: "debit", montant: arrondi(m - solde), note: "Utilisé en caisse" });
      BONS.push({
        id: "b" + (i + 1), code: code(), montant: m, solde: solde, creeLe: cree, expireLe: expire,
        clientId: r() < 0.6 ? "k" + (Math.floor(r() * 120) + 1) : "", note: notes[Math.floor(r() * notes.length)],
        annule: type === "annule", historique: hist
      });
    }
  }
  function sauverBons() { try { localStorage.setItem(CLE_BONS, JSON.stringify(BONS)); } catch (e) { /* stockage indisponible */ } }
  function bonComplet(b) {
    var c = CLIENTS.filter(function (x) { return x.id === b.clientId; })[0];
    var o = copie(b); o.statut = statutBon(b); o.clientNom = c ? c.name : ""; return o;
  }
  function getVouchers() { initBons(); return reponse(BONS.map(bonComplet)); }
  function trouverBon(id) { initBons(); return BONS.filter(function (b) { return b.id === id; })[0]; }
  // v = { montant, expireLe, clientId, note } ; rejette avec un message si invalide
  function createVoucher(v) {
    initBons();
    var m = Math.round(+v.montant * 100) / 100;
    if (!isFinite(m) || m <= 0) return Promise.reject("Saisir un montant supérieur à 0.");
    if (m > 5000) return Promise.reject("Montant maximum : 5 000 €.");
    if (!v.expireLe) return Promise.reject("Choisir une date de fin de validité.");
    if (v.expireLe < AUJ_ISO) return Promise.reject("La fin de validité ne peut pas être dans le passé.");
    var n = BONS.length + 1, code = "BC-" + ("0000" + Math.floor(Math.random() * 1679616).toString(36).toUpperCase()).slice(-4) + "-" + ("00" + n).slice(-2);
    var b = { id: "b" + Date.now(), code: code, montant: m, solde: m, creeLe: AUJ_ISO, expireLe: v.expireLe, clientId: v.clientId || "", note: v.note || "", annule: false,
      historique: [{ date: AUJ_ISO, type: "creation", montant: m, note: "" }] };
    BONS.push(b); sauverBons();
    return reponse(bonComplet(b));
  }
  // Change la date de fin de validité (prolonger ou raccourcir) et/ou la note
  function updateVoucher(id, ch) {
    var b = trouverBon(id);
    if (!b) return Promise.reject("Bon introuvable.");
    if (b.annule) return Promise.reject("Ce bon est annulé.");
    if (ch.expireLe !== undefined) {
      if (!ch.expireLe) return Promise.reject("Choisir une date de fin de validité.");
      if (ch.expireLe < AUJ_ISO) return Promise.reject("La fin de validité ne peut pas être dans le passé.");
      if (ch.expireLe !== b.expireLe) { b.historique.push({ date: AUJ_ISO, type: "validite", montant: 0, note: "Validité : " + b.expireLe + " → " + ch.expireLe }); b.expireLe = ch.expireLe; }
    }
    if (ch.note !== undefined) b.note = ch.note;
    sauverBons();
    return reponse(bonComplet(b));
  }
  function debitVoucher(id, montant, note) {
    var b = trouverBon(id), m = Math.round(+montant * 100) / 100;
    if (!b) return Promise.reject("Bon introuvable.");
    if (statutBon(b) !== "actif") return Promise.reject("Ce bon n'est plus utilisable.");
    if (!isFinite(m) || m <= 0) return Promise.reject("Saisir un montant supérieur à 0.");
    if (m > b.solde) return Promise.reject("Le montant dépasse le solde du bon (" + b.solde + " €).");
    b.solde = Math.round((b.solde - m) * 100) / 100;
    b.historique.push({ date: AUJ_ISO, type: "debit", montant: m, note: note || "Utilisé en caisse" });
    sauverBons();
    return reponse(bonComplet(b));
  }
  function cancelVoucher(id) {
    var b = trouverBon(id);
    if (!b) return Promise.reject("Bon introuvable.");
    b.annule = true; b.historique.push({ date: AUJ_ISO, type: "annulation", montant: b.solde, note: "" });
    sauverBons();
    return reponse(bonComplet(b));
  }
  // La cagnotte d'un client = solde de ses bons cadeaux encore valables
  function cagnotteClient(c) {
    initBons();
    var o = copie(c), t = 0;
    BONS.forEach(function (b) { if (b.clientId === c.id && statutBon(b) === "actif") t += b.solde; });
    o.cagnotte = arrondi(t);
    return o;
  }
  function getCustomers() { return reponse(CLIENTS.map(cagnotteClient)); }
  function viewCustomer(id) { var c = CLIENTS.filter(function (x) { return x.id === id; })[0]; return reponse(c ? cagnotteClient(c) : null); }

  // ======================================================================
  // API : réglages, intégrations, contenus
  // ======================================================================
  function getOrganizationUsers() {
    return reponse([
      { id: "u1", name: "Utilisateur Démo", email: "demo@exemple.test", sites: 1, role: "Membre", level: "OWNER", invite: false },
      { id: "u2", name: "Gérant", email: "", sites: 1, role: "Membre", level: "OWNER", invite: false },
      { id: "u3", name: "Camille Exemple", email: "camille@exemple.test", sites: 1, role: "Membre", level: "OWNER", invite: false },
      { id: "u4", name: "invite1@exemple.test", email: "invite1@exemple.test", sites: 1, role: "", level: "OWNER", invite: true },
      { id: "u5", name: "invite2@exemple.test", email: "invite2@exemple.test", sites: 1, role: "", level: "OWNER", invite: true }
    ]);
  }
  function getRoles() { return reponse([{ id: "ro1", name: "COMPTABLE", userCount: 0 }, { id: "ro2", name: "OWNER", userCount: 5 }, { id: "ro3", name: "RESPONSABLE DE SALLE", userCount: 0 }]); }
  function getProfile() { return reponse({ name: "Utilisateur Démo", email: "demo@exemple.test" }); }

  var CATEGORIES_INTEGRATIONS = [
    ["Sélection", ["Commande Express", "ComptaLink", "StockMaster", "RH Simple", "Fidélio", "CaisseBI"]],
    ["Gestion des stocks", ["StockMaster", "Inventaire+", "AchatPro", "Cave Manager"]],
    ["Comptabilité", ["ComptaLink", "FacturePlus", "ExpertCompta"]],
    ["E-Ticket", ["Ticket Digital", "Reçu Mail"]],
    ["Business intelligence", ["CaisseBI", "Dataviz Resto"]],
    ["Commandes en ligne", ["Commande Express", "Click & Collect", "Livraison Facile"]],
    ["Solutions de Fidélité", ["Fidélio", "Cagnotte Club"]],
    ["Ressources humaines", ["RH Simple", "Planning Équipe"]],
    ["Développeur", ["API publique", "Webhooks"]]
  ];
  function getIntegrationList() {
    return reponse(CATEGORIES_INTEGRATIONS.map(function (c) {
      return { categorie: c[0], integrations: c[1].map(function (n) { return { nom: n, description: "Intégration de démonstration : description inventée pour la maquette de l'écran." }; }) };
    }));
  }
  function getNews() {
    return reponse([{
      id: "n1", titre: "Note de version - Septembre 2026", auteur: "Équipe Démo", date: "11 sept. 2026",
      resume: "Ces derniers mois, nous avons fait évoluer la gestion des clients, la fidélité, les rapports et la programmation de caisse. Voici les nouveautés et les détails.",
      astuce: "Les fonctionnalités disponibles dépendent des modules activés et de la version de l'application.",
      sections: [
        { titre: "Rapports", texte: "De nouveaux indicateurs apparaissent dans le tableau de bord, avec une comparaison entre périodes." },
        { titre: "Clients", texte: "La fiche client affiche désormais le solde et la cagnotte en un coup d'œil." },
        { titre: "Caisse", texte: "La mise en page de la caisse gagne en lisibilité." }
      ]
    }]);
  }
  function getAgencyInfo() {
    return reponse({
      site: SITES[0].name, reference: "0000000", agence: "Agence Démo", ville: "Ville",
      agences: [{ nom: "Agence Démo", adresse: "10 rue de l'Exemple - 00000 VILLE", tel: "+33 0 00 00 00 00" }, { nom: "Agence Exemple 2", adresse: "20 avenue Test - 00000 AUTRE", tel: "+33 0 00 00 00 01" }]
    });
  }

  // ======================================================================
  // Météo (mode météo facultatif). Vraie météo : fichier meteo.js produit par outils\recuperer-meteo.ps1.
  // En mode Test, les jours déjà passés sont INVENTÉS (marqués factices) ; aujourd'hui et le futur sont réels.
  // ======================================================================
  var METEO = window.MeteoDonnees || null;
  // Poids du score de clémence (somme = 1) : température, pluie, vent, ensoleillement
  var METEO_POIDS = { temp: 0.35, pluie: 0.3, vent: 0.1, soleil: 0.25 };
  function borne(v) { return Math.max(0, Math.min(100, v)); }
  // Score 0-100 : confort pour un bar-restaurant (terrasse). Idéal : 21-28 °C, sec, peu de vent, soleil.
  function scoreMeteo(m) {
    if (!m || m.tmax == null) return null;
    var dist = m.tmax < 21 ? 21 - m.tmax : (m.tmax > 28 ? m.tmax - 28 : 0);
    var sTemp = borne(100 - dist * 5);
    var sPluie = borne(100 - (m.pluie || 0) * 12);
    var sVent = borne(100 - Math.max(0, (m.vent || 0) - 15) * 3);
    var sSoleil = m.soleil == null ? 50 : borne(m.soleil / 10 * 100);
    return Math.round(sTemp * METEO_POIDS.temp + sPluie * METEO_POIDS.pluie + sVent * METEO_POIDS.vent + sSoleil * METEO_POIDS.soleil);
  }
  // Hasard stable par date (n'utilise pas le générateur principal : les fausses commandes ne changent pas)
  function hasard(iso, k) {
    var h = 2166136261, s = iso + "#" + k;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 100000) / 100000;
  }
  function fausseMeteo(iso) {
    var d = new Date(iso + "T12:00:00"), an = new Date(d.getFullYear(), 0, 0);
    var jourAn = Math.round((d - an) / 86400000);
    var saison = -Math.cos((jourAn - 15) / 365 * 2 * Math.PI); // -1 en janvier, +1 en juillet
    var tmax = Math.round((15 + 9 * saison + (hasard(iso, 1) - 0.5) * 9) * 10) / 10;
    var pluvieux = hasard(iso, 2) < 0.32 - 0.1 * saison;
    var pluie = pluvieux ? Math.round(hasard(iso, 3) * 120) / 10 : 0;
    var soleil = Math.round(Math.max(0, (pluvieux ? 1 + hasard(iso, 4) * 3 : 4 + hasard(iso, 4) * 7) * (0.6 + 0.4 * (saison + 1) / 2)) * 10) / 10;
    var vent = Math.round((8 + hasard(iso, 5) * 28) * 10) / 10;
    var code = pluie > 5 ? 63 : (pluie > 0 ? 61 : (soleil > 8 ? 0 : (soleil > 5 ? 2 : 3)));
    return { tmax: tmax, tmin: Math.round((tmax - 4 - hasard(iso, 6) * 5) * 10) / 10, pluie: pluie, vent: vent, soleil: soleil, code: code };
  }
  // Un jour de météo : { date, tmax, tmin, pluie, vent, soleil, code, score, factice, prevision } ou null
  function jourMeteo(iso) {
    var r = METEO && METEO.jours && METEO.jours[iso];
    var passe = iso < AUJ_ISO, m;
    if (MODE === "test" && passe) { m = fausseMeteo(iso); m.factice = true; }
    else if (r) m = { tmax: r[0], tmin: r[1], pluie: r[2], vent: r[3], soleil: r[4], code: r[5], factice: false };
    else return { date: iso, tmax: null, tmin: null, pluie: null, vent: null, soleil: null, code: null, score: null, factice: false, prevision: !passe };
    m.date = iso; m.score = scoreMeteo(m); m.prevision = !passe;
    return m;
  }
  function getWeatherDays(p) {
    var jours = [], d = new Date(p.dateStart + "T12:00:00"), fin = new Date(p.dateEnd + "T12:00:00");
    while (d <= fin) { jours.push(jourMeteo(jourIso(d))); d.setDate(d.getDate() + 1); }
    return reponse({ jours: jours, recupereLe: METEO ? METEO.recupereLe : null, fichier: !!METEO });
  }
  function getWeatherForecast(nb) {
    var jours = [], i;
    for (i = 0; i < (nb || 16); i++) jours.push(jourMeteo(jourIso(new Date(AUJ.getFullYear(), AUJ.getMonth(), AUJ.getDate() + i))));
    return reponse({ jours: jours, recupereLe: METEO ? METEO.recupereLe : null, fichier: !!METEO });
  }
  // Ventes moyennes (TTC) par tranche de score, sur le passé disponible : pour estimer l'effet d'une prévision
  function getWeatherImpact() {
    var par = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], tous = 0, nbTous = 0;
    Object.keys(COMMANDES.reduce(function (o, c) { o[c.date] = 1; return o; }, {})).forEach(function (iso) {
      var m = jourMeteo(iso);
      if (!m || m.score == null) return;
      var t = totaux(payees({ dateStart: iso, dateEnd: iso })).ttc;
      if (!t) return;
      var k = m.score < 40 ? 0 : (m.score < 70 ? 1 : 2);
      par[k][0] += t; par[k][1]++; tous += t; nbTous++;
    });
    return reponse({ tranches: par.map(function (x) { return { moyenne: x[1] ? arrondi(x[0] / x[1]) : null, jours: x[1] }; }), moyenne: nbTous ? arrondi(tous / nbTous) : null });
  }

  // ======================================================================
  // Exposition
  // ======================================================================
  window.DonneesTest = {
    getWeatherDays: getWeatherDays, getWeatherForecast: getWeatherForecast, getWeatherImpact: getWeatherImpact,
    scoreMeteo: scoreMeteo, METEO_POIDS: METEO_POIDS, meteoFichier: !!METEO,
    AUJOURDHUI: AUJ_ISO,
    mode: MODE, reelDisponible: !!REEL, recupereLe: REEL ? REEL.recupereLe : null,
    getLocations: function () { return reponse(SITES); },
    getHomePage: getHomePage, getOrders: getOrders, getOrderById: getOrderById,
    getReportTotalSales: getReportTotalSales, getReportProductsAndCategories: getReportProductsAndCategories,
    getReportClerkShifts: getReportClerkShifts, getObjectifs: getObjectifs, setObjectif: setObjectif, deleteObjectif: deleteObjectif, getRealTime: getRealTime, getHybridStock: getHybridStock, getAlertesStock: getAlertesStock,
    getStockMovements: getStockMovements, setStockMovement: setStockMovement, MOTIFS_PERTE: MOTIFS_PERTE,
    getReportProductData: getReportProductData, getReportModifiers: getReportModifiers, getEmployees: getEmployees,
    getReportCancelation: getReportCancelation, getReportLosses: getReportLosses, getReportDiscount: getReportDiscount,
    getReportTaxes: getReportTaxes, getReportPaymentMode: getReportPaymentMode, getReportCategories: getReportCategories,
    getSalesDistribution: getSalesDistribution, getCreneaux: getCreneaux, setCreneaux: setCreneaux, creneauxDefaut: CRENEAUX_DEFAUT, getReportMenuSales: getReportMenuSales, getNewHistoryZTill: getNewHistoryZTill,
    getReportById: getReportById, getFiscalArchives: getFiscalArchives, getRoomsReport: getRoomsReport,
    getProduct: getProduct, setProduct: setProduct, resetProduct: resetProduct, getGestionAchat: getGestionAchat, setGestionAchat: setGestionAchat, calculMarge: calculMarge,
    getCatalogue: getCatalogue, getAllModifierGroups: getAllModifierGroups, getAllMeals: getAllMeals, getEmployeesPos: getEmployeesPos,
    getRooms: getRooms, getPrintersList: getPrintersList, getAllPreparationStations: getAllPreparationStations,
    getPricingList: getPricingList, getAllTaxes: getAllTaxes, getDiscounts: getDiscounts, getCashMovementReasons: getCashMovementReasons,
    getAllPayments: getAllPayments, getReceiptSettings: getReceiptSettings, getMiscSettings: getMiscSettings,
    getLogicalDevices: getLogicalDevices, getLayout: getLayout,
    getReservationList: getReservationList, getCustomers: getCustomers, viewCustomer: viewCustomer,
    getVouchers: getVouchers, createVoucher: createVoucher, updateVoucher: updateVoucher, debitVoucher: debitVoucher, cancelVoucher: cancelVoucher,
    ajouterJours: ajouterJours, ajouterMois: ajouterMois,
    getOrganizationUsers: getOrganizationUsers, getRoles: getRoles, getProfile: getProfile,
    getIntegrationList: getIntegrationList, getNews: getNews, getAgencyInfo: getAgencyInfo
  };
})();
