/*
 * donnees-gestion.js : suite de DonneesTest pour la gestion (point de vente, clients, réservations, bons cadeaux,
 * utilisateurs, réglages, intégrations). Tout ce que l'utilisateur crée ou modifie est gardé dans ce navigateur
 * (Stockage, préfixe « uppina: ») et effacé par « Réinitialiser la démo ».
 */
(function () {
  "use strict";
  var D = window.DonneesTest, I = D._, S = I.S;
  var reponse = I.reponse, copie = I.copie, arrondi = I.arrondi, deux = I.deux, decaler = I.decaler, date = I.date, hhmm = I.hhmm;
  var entre = I.entre, choisir = I.choisir, pondere = I.pondere, graine = I.graine, AUJ_ISO = I.AUJ_ISO;

  function liste(cle) { return S.lire(cle, []); }
  function ajouterA(cle, o) { var l = liste(cle); l.push(o); S.ecrire(cle, l); return o; }
  function nouvelId(pfx) { return pfx + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }
  function texte(v) { return String(v == null ? "" : v).trim(); }
  function refus(m) { return Promise.reject(m); }

  // ======================================================================
  // Catalogue et réglages de caisse
  // ======================================================================
  var POLES = ["Cuisine", "Bar", "Crêperie", "Dessert"];
  function taxes() { return I.TAXES.concat(liste("taxes-ajouts")); }
  function getCatalogue() {
    return reponse({
      produits: I.tousProduits(), categories: I.CATEGORIES.map(function (c) { return { nom: c.nom, couleur: c.couleur, sous: c.sous }; }),
      poles: POLES, taxes: taxes().map(function (t) { return t.name; })
    });
  }
  function getAllModifierGroups() {
    return reponse(I.GROUPES_OPTIONS.map(function (g) { return { id: g.id, nom: g.nom, valeurs: g.options.map(function (o) { return { nom: o[0], prix: o[1] }; }) }; })
      .concat(liste("options-ajouts")));
  }
  function createModifierGroup(o) {
    var nom = texte(o.nom), valeurs = (o.valeurs || []).filter(function (v) { return texte(v.nom); }).map(function (v) { return { nom: texte(v.nom), prix: Math.max(0, +v.prix || 0) }; });
    if (!nom) return refus("Donnez un nom à l'option.");
    if (!valeurs.length) return refus("Ajoutez au moins une valeur.");
    return reponse(ajouterA("options-ajouts", { id: nouvelId("g"), nom: nom, valeurs: valeurs, ajoute: true }));
  }
  function getAllMeals() {
    return reponse(I.FORMULES.map(function (f) { return { id: f.id, nom: f.nom, etapes: f.etapes, prix: f.prix }; }).concat(liste("menus-ajouts")));
  }
  function createMeal(o) {
    var nom = texte(o.nom), prix = Math.round(+o.prix * 100) / 100, etapes = (o.etapes || []).map(texte).filter(Boolean);
    if (!nom) return refus("Donnez un nom au menu.");
    if (!isFinite(prix) || prix <= 0) return refus("Indiquez le prix du menu.");
    if (!etapes.length) return refus("Ajoutez au moins une étape.");
    return reponse(ajouterA("menus-ajouts", { id: nouvelId("ml"), nom: nom, etapes: etapes, prix: prix, ajoute: true }));
  }
  var ROLES_EMPLOYES = { "Gérant": "Gérant", "Alice": "Serveuse", "Bruno": "Serveur", "Chloé": "Crêpière", "David": "Cuisinier", "Emma": "Serveuse", "Farid": "Barman",
    "Gaëlle": "Crêpière", "Hugo": "Serveur", "Inès": "Serveuse", "Jules": "Commis", "Karim": "Serveur" };
  function getEmployeesPos() {
    return reponse(I.EMPLOYES.map(function (e) { return { id: e.id, name: e.name, isOwner: e.isOwner, role: ROLES_EMPLOYES[e.name] || "" }; }).concat(liste("employes-ajouts")));
  }
  function createEmployee(o) {
    var nom = texte(o.name);
    if (!nom) return refus("Indiquez le nom de l'employé.");
    return reponse(ajouterA("employes-ajouts", { id: nouvelId("e"), name: nom, isOwner: false, role: texte(o.role), ajoute: true }));
  }
  function getRooms() { return reponse(I.SALLES.map(function (s) { return { id: s.id, name: s.nom, enabled: s.actif, type: s.type, tables: s.tables, prefixe: s.prefixe }; })); }
  function getPrintersList() {
    return reponse([
      { id: "i1", name: "Bar", ip: "192.168.1.21", port: 9100, mac: "00:26:AB:4C:10:21", marque: "EPSON", modele: "TM-m30III", interface: "RÉSEAU", poste: "Bar" },
      { id: "i2", name: "Cuisine", ip: "192.168.1.22", port: 9100, mac: "00:26:AB:4C:10:22", marque: "EPSON", modele: "TM-T20III", interface: "RÉSEAU", poste: "Cuisine" },
      { id: "i3", name: "Crêperie", ip: "192.168.1.23", port: 9100, mac: "00:26:AB:4C:10:23", marque: "EPSON", modele: "TM-T20III", interface: "RÉSEAU", poste: "Crêperie" },
      { id: "i4", name: "Imprimante Ticket", ip: "192.168.1.24", port: 9100, mac: "00:11:62:2A:30:24", marque: "STAR", modele: "TSP143IV", interface: "RÉSEAU", poste: "Ticket" },
      { id: "i5", name: "Dessert", ip: "192.168.1.25", port: 9100, mac: "00:26:AB:4C:10:25", marque: "EPSON", modele: "TM-m30III", interface: "RÉSEAU", poste: "Dessert" }
    ]);
  }
  function getAllPreparationStations() {
    return reponse([
      { id: "s1", name: "Cuisine", recap: true, imprimante: "Cuisine" }, { id: "s2", name: "Bar", recap: false, imprimante: "Bar" },
      { id: "s3", name: "Dessert", recap: true, imprimante: "Dessert" }, { id: "s4", name: "Crêperie", recap: true, imprimante: "Crêperie" }
    ].concat(liste("postes-ajouts")));
  }
  function createPreparationStation(o) {
    var nom = texte(o.name);
    if (!nom) return refus("Indiquez le nom du poste.");
    return reponse(ajouterA("postes-ajouts", { id: nouvelId("s"), name: nom, recap: !!o.recap, imprimante: texte(o.imprimante) || "Imprimante Ticket", ajoute: true }));
  }
  function getPricingList() {
    return reponse({
      salle: [{ name: "Normal" }, { name: "Comptoir" }, { name: "À emporter" }, { name: "Terrasse" }],
      horaires: [{ name: "Happy Hour (17h-19h)", actif: true }, { name: "Prix carte d'été", actif: false }],
      evenements: [["Chandeleur", true], ["Mardi gras", true], ["Saint-Valentin", true], ["Fête de la musique", true], ["Soirée privée", false], ["Marché de Noël", true], ["Brunch du dimanche", false]]
        .map(function (e) { return { name: e[0], actif: e[1] }; })
    });
  }
  function getAllTaxes() {
    var produits = I.tousProduits();
    return reponse(taxes().map(function (t) { return { id: t.id, name: t.name, rate: t.rate, nbProduits: produits.filter(function (p) { return +p.tva === +t.rate; }).length }; }));
  }
  function createTax(o) {
    var nom = texte(o.name), taux = +String(o.rate).replace(",", ".");
    if (!nom) return refus("Indiquez le nom de la taxe.");
    if (!isFinite(taux) || taux < 0 || taux > 100) return refus("Taux invalide.");
    return reponse(ajouterA("taxes-ajouts", { id: nouvelId("t"), name: nom, rate: taux, ajoute: true }));
  }
  function getDiscounts() { return reponse(I.REMISES.concat(liste("remises-ajouts"))); }
  function createDiscount(o) {
    var nom = texte(o.nom), v = +String(o.valeur).replace(",", ".");
    if (!nom) return refus("Indiquez le nom de la remise.");
    if (!isFinite(v) || v <= 0 || (o.type === "percentage" && v > 100)) return refus("Valeur invalide.");
    return reponse(ajouterA("remises-ajouts", { id: nouvelId("d"), nom: nom, type: o.type === "amount" ? "amount" : "percentage", valeur: v, ajoute: true }));
  }
  function getCashMovementReasons() {
    return reponse([{ id: "cm1", name: "Fond de caisse" }, { id: "cm2", name: "Retrait banque" }, { id: "cm3", name: "Petite dépense" }, { id: "cm4", name: "Achat marché" }].concat(liste("mouvements-ajouts")));
  }
  function createCashMovementReason(o) {
    var nom = texte(o.name);
    if (!nom) return refus("Indiquez le motif du mouvement.");
    return reponse(ajouterA("mouvements-ajouts", { id: nouvelId("cm"), name: nom, ajoute: true }));
  }
  function getAllPayments() {
    return reponse(I.MODES_PAIEMENT.map(function (m) { return { id: m.id, name: m.nom, enabled: true, voucher: m.voucher, openCashDrawer: m.tiroir, tips: m.tips }; }).concat(liste("paiements-ajouts")));
  }
  function createPaymentMode(o) {
    var nom = texte(o.name);
    if (!nom) return refus("Indiquez le nom du mode de paiement.");
    return reponse(ajouterA("paiements-ajouts", { id: nouvelId("m"), name: nom, enabled: true, voucher: !!o.voucher, openCashDrawer: !!o.openCashDrawer, tips: !!o.tips, ajoute: true }));
  }
  var TICKET_DEFAUT = {
    establishmentName: "Crêperie Démo", address1: "12 rue de l'Exemple", address2: "", zipCode: "35000", city: "Rennes", country: "France",
    phoneNumber: "02 99 00 00 00", siretCode: "000 000 000 00000", nafCode: "5610A", tvaCode: "FR00 000000000",
    customHeader: "Bienvenue à la Crêperie Démo !", customFooter: "Merci de votre visite, à bientôt !"
  };
  function getReceiptSettings() { var t = S.lire("ticket", {}), o = copie(TICKET_DEFAUT); Object.keys(t).forEach(function (k) { o[k] = t[k]; }); return reponse(o); }
  function setReceiptSettings(o) {
    if (!texte(o.establishmentName)) return refus("Le nom de l'établissement est obligatoire.");
    var t = {}; ["establishmentName", "address1", "address2", "zipCode", "city", "country", "phoneNumber", "customHeader", "customFooter"].forEach(function (k) { t[k] = texte(o[k]); });
    S.ecrire("ticket", t);
    return getReceiptSettings();
  }
  var DIVERS_DEFAUT = {
    timezone: "Europe/Paris", defaultPrinter: "Imprimante Ticket", qrCodeLogin: false, allowGapInTillStats: true, allowCatalogEditOnPos: true,
    printOnPay: true, detailedReport: true, groupProductsOnOrder: true, askForInitialCashFloat: true, enablePreparationCall: true,
    closeAfterOrderCall: false, doNotPrintClaim: false, groupProductsOnPrepaReceipt: true, cutBetweenSteps: true, printOnlyFirstPrepaReceipt: false
  };
  function getMiscSettings() { var t = S.lire("reglages-divers", {}), o = copie(DIVERS_DEFAUT); Object.keys(t).forEach(function (k) { o[k] = t[k]; }); return reponse(o); }
  function setMiscSettings(o) { S.ecrire("reglages-divers", o); return getMiscSettings(); }
  function getLogicalDevices() {
    var now = D.maintenantMin(), ouvert = now >= 465 && now < 1395;
    var noms = ["iPad principal", "iPad salle 1", "iPad salle 2", "iPad terrasse", "iPad bar", "iPad crêperie", "iPad comptoir"];
    return reponse({
      contrat: { type: "Contrat Up'Pina Restaurant, renouvellement tacite", principal: [1, 1], secondaire: [6, 6], bornes: [0, 0], ecrans: [0, 0] },
      appareils: noms.map(function (n, i) {
        var dc = ouvert ? (i === 0 ? "il y a quelques secondes" : i < 5 ? "il y a " + (i * 2 + 1) + " min" : "il y a " + (i * 7) + " min") : (i === 0 ? "hier à 23:12" : "hier à 22:" + (40 + i));
        return { id: "a" + i, name: n, derniereConnexion: dc, modele: i === 0 ? "iPad Pro 11 pouces" : "iPad 10e génération", os: "iPadOS", version: "Up'Pina Caisse 4.12." + (i % 3), role: i === 0 ? "Caisse principale" : "Caisse secondaire", enLigne: ouvert };
      })
    });
  }
  // Mise en page de la caisse : catégories -> sous-catégories -> boutons produit, avec les réglages saisis
  function getLayout() {
    var reg = S.lire("mise-en-page", { nbCategories: 12, cats: {} });
    return reponse({
      nbCategories: reg.nbCategories || 12,
      categories: I.CATEGORIES.map(function (c, ci) {
        var r = reg.cats[c.nom] || {};
        return {
          nom: c.nom, libelle: r.libelle || c.nom, couleur: c.couleur, nbMenus: r.nbMenus || 5, masquee: !!r.masquee,
          sous: c.sous.map(function (s, si) { return { nom: s, produits: I.PRODUITS.filter(function (p) { return p.cat === ci && p.sous === si; }).map(function (p) { return { nom: p.nom, prix: p.prix }; }) }; })
        };
      })
    });
  }
  function setLayout(o) {
    var reg = S.lire("mise-en-page", { nbCategories: 12, cats: {} });
    if (o.nbCategories !== undefined) { var n = Math.round(+o.nbCategories); if (!isFinite(n) || n < 1 || n > 24) return refus("Entre 1 et 24 catégories visibles."); reg.nbCategories = n; }
    if (o.categorie) {
      var r = reg.cats[o.categorie] = reg.cats[o.categorie] || {};
      if (o.libelle !== undefined) { if (!texte(o.libelle)) return refus("Le nom de la catégorie est obligatoire."); r.libelle = texte(o.libelle); }
      if (o.nbMenus !== undefined) { var m = Math.round(+o.nbMenus); if (!isFinite(m) || m < 0 || m > 20) return refus("Entre 0 et 20 menus affichés."); r.nbMenus = m; }
      if (o.masquee !== undefined) r.masquee = !!o.masquee;
    }
    S.ecrire("mise-en-page", reg);
    return getLayout();
  }

  // ======================================================================
  // Réservations : générées pour chaque jour (graine propre à la date) + celles saisies dans la démo
  // ======================================================================
  var NOTES_RESA = [["", 60], ["Terrasse si possible", 6], ["Anniversaire", 6], ["Chaise bébé", 5], ["Allergie : gluten (galettes au sarrasin OK)", 4], ["Table au calme", 5], ["Près de la fenêtre", 4], ["Groupe, menu à l'avance", 3], ["Client habitué", 4]];
  function minutes(t) { var s = String(t).split(":"); return +s[0] * 60 + (+s[1] || 0); }
  function genererResas(iso) {
    if (iso < I.OUVERTURE) return [];
    var r = graine("resa|" + iso), js = date(iso).getDay(), l = [];
    var nbMidi = entre(r, 3, 6) + (js === 0 || js === 6 ? 3 : 0), nbSoir = entre(r, 4, 8) + (js === 5 || js === 6 ? 6 : 0) - (js === 0 ? 2 : 0);
    function une(heures) {
      var lie = r() < 0.55, c = lie ? choisir(r, I.CLIENTS) : null;
      var nom = c ? c.name : (r() < 0.5 ? "M. " : "Mme ") + choisir(r, I.NOMS);
      return { heure: choisir(r, heures), nom: nom, clientId: c ? c.id : "", couverts: pondere(r, [2, 3, 4, 5, 6, 8, 10, 12], [30, 12, 25, 8, 12, 6, 4, 3]),
        note: pondere(r, NOTES_RESA.map(function (n) { return n[0]; }), NOTES_RESA.map(function (n) { return n[1]; })), tel: "06 00 00 " + deux(entre(r, 0, 99)) + " " + deux(entre(r, 0, 99)), alea: r() };
    }
    var i;
    for (i = 0; i < nbMidi; i++) l.push(une(["12:00", "12:15", "12:30", "12:30", "12:45", "13:00", "13:15", "13:30"]));
    for (i = 0; i < nbSoir; i++) l.push(une(["19:00", "19:15", "19:30", "19:45", "20:00", "20:00", "20:15", "20:30", "20:45", "21:00", "21:30"]));
    l.sort(function (a, b) { return a.heure < b.heure ? -1 : a.heure > b.heure ? 1 : 0; });
    l.forEach(function (x, k) { x.id = "rs" + iso.replace(/-/g, "") + "-" + (k + 1); x.date = iso; });
    return l;
  }
  function statutResa(x) {
    var surcharges = S.lire("reservations-statuts", {});
    if (surcharges[x.id]) return surcharges[x.id];
    if (x.ajoutee && x.date >= AUJ_ISO) { if (x.date > AUJ_ISO || minutes(x.heure) > D.maintenantMin()) return "En attente"; }
    if (x.date > AUJ_ISO) return x.alea < 0.15 ? "Confirmée" : "En attente";
    var now = x.date < AUJ_ISO ? 2000 : D.maintenantMin(), h = minutes(x.heure);
    if (h > now) return x.alea < 0.25 ? "Confirmée" : "En attente";
    if (h + 20 > now) return x.alea < 0.5 ? "Arrivé" : "En retard";
    return x.alea < 0.03 ? "Non venu" : x.alea < 0.08 ? "Annulé" : "Arrivé";
  }
  function resasDu(iso) {
    var l = genererResas(iso).concat(liste("reservations-ajouts").filter(function (x) { return x.date === iso; }).map(function (x) { x.ajoutee = true; return x; }));
    l.forEach(function (x) { x.statut = statutResa(x); });
    return l.sort(function (a, b) { return a.heure < b.heure ? -1 : a.heure > b.heure ? 1 : 0; });
  }
  function getReservationList(iso) {
    var l = resasDu(iso), cv = 0;
    l.forEach(function (r) { if (r.statut !== "Annulé" && r.statut !== "Non venu") cv += r.couverts; });
    return reponse({ reservations: l, totalNumberOfGuests: cv });
  }
  function createReservation(o) {
    var nom = texte(o.nom), couverts = Math.round(+o.couverts), heure = texte(o.heure), d = texte(o.date);
    if (!nom) return refus("Indiquez le nom du client.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return refus("Choisissez une date.");
    if (d < AUJ_ISO) return refus("La date est déjà passée.");
    if (!/^\d{2}:\d{2}$/.test(heure)) return refus("Choisissez une heure.");
    if (minutes(heure) < 480 || minutes(heure) > 1350) return refus("Le restaurant est ouvert de 8h à 23h (dernière réservation 22h30).");
    if (!isFinite(couverts) || couverts < 1 || couverts > 40) return refus("Nombre de couverts invalide (1 à 40).");
    return reponse(ajouterA("reservations-ajouts", { id: nouvelId("ra"), date: d, heure: heure, nom: nom, couverts: couverts, note: texte(o.note), tel: texte(o.tel), clientId: "" }));
  }
  function setReservationStatus(id, statut) {
    var s = S.lire("reservations-statuts", {}); s[id] = statut; S.ecrire("reservations-statuts", s);
    return reponse(true);
  }

  // ======================================================================
  // Clients : fichier généré + clients ajoutés ou modifiés dans la démo
  // ======================================================================
  var CHAMPS_CLIENT = ["name", "phone", "email", "address", "city", "zip", "company", "comment"];
  function commandeDuClient(iso, id) {
    var j = I.jourVisible(iso);
    return j ? j.commandes.filter(function (c) { return c.client === id; })[0] || null : null;
  }
  function soldeEtImpayes(id) {
    var s = 0, n = 0;
    Object.keys(I.IMPAYES).forEach(function (k) {
      var p = k.split("|");
      if (p[1] !== id) return;
      var c = commandeDuClient(p[0], id);
      if (c && c.statut === "paid") { s += c.total; n++; }
    });
    return { solde: -arrondi(s), impayes: n };
  }
  function clientComplet(c) {
    var m = S.lire("clients-modifs", {})[c.id] || {}, o = { id: c.id };
    CHAMPS_CLIENT.forEach(function (k) { o[k] = m[k] !== undefined ? m[k] : (c[k] || ""); });
    var si = c.ajoute ? { solde: 0, impayes: 0 } : soldeEtImpayes(c.id);
    o.solde = si.solde; o.unpaid = si.impayes;
    o.orders = c.ajoute ? 0 : (I.VISITES ? Object.keys(I.VISITES).filter(function (d) { return d <= AUJ_ISO && I.VISITES[d].indexOf(c.id) >= 0; }).length : 0);
    o.creeLe = c.inscrit || c.creeLe || AUJ_ISO; o.ajoute = !!c.ajoute;
    o.cagnotte = cagnotte(c.id);
    return o;
  }
  function tousClients() { return I.CLIENTS.concat(liste("clients-ajouts")); }
  function getCustomers() { return reponse(tousClients().map(clientComplet).sort(function (a, b) { return a.name.localeCompare(b.name, "fr"); })); }
  function viewCustomer(id) { var c = tousClients().filter(function (x) { return x.id === id; })[0]; return reponse(c ? clientComplet(c) : null); }
  function getCustomerOrders(id) {
    var c = tousClients().filter(function (x) { return x.id === id; })[0];
    if (!c || c.ajoute) return reponse({ payees: [], impayees: [], depots: c && c.depots ? c.depots : [] });
    var dates = Object.keys(I.VISITES).filter(function (d) { return d <= AUJ_ISO && I.VISITES[d].indexOf(id) >= 0; }).sort().reverse().slice(0, 40), payees = [], impayees = [];
    dates.forEach(function (d) {
      var cmd = commandeDuClient(d, id);
      if (!cmd || cmd.statut !== "paid") return;
      var o = { id: cmd.id, date: d, heure: hhmm(cmd.min), total: cmd.total, paiement: cmd.paiement, salle: cmd.salle, table: cmd.table, couverts: cmd.couverts };
      (cmd.impaye ? impayees : payees).push(o);
    });
    return reponse({ payees: payees, impayees: impayees, depots: (c.depots || []).filter(function (x) { return x.date <= AUJ_ISO; }) });
  }
  function validerClient(o) {
    var c = {};
    CHAMPS_CLIENT.forEach(function (k) { c[k] = texte(o[k]); });
    if (!c.name) return { erreur: "Le nom est obligatoire." };
    if (c.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email)) return { erreur: "Adresse e-mail invalide." };
    if (c.zip && !/^\d{5}$/.test(c.zip)) return { erreur: "Code postal invalide (5 chiffres)." };
    return c;
  }
  function createCustomer(o) {
    var c = validerClient(o);
    if (c.erreur) return refus(c.erreur);
    c.id = nouvelId("k"); c.ajoute = true; c.creeLe = AUJ_ISO; c.depots = [];
    ajouterA("clients-ajouts", c);
    return viewCustomer(c.id);
  }
  function updateCustomer(id, o) {
    var c = validerClient(o);
    if (c.erreur) return refus(c.erreur);
    var ajouts = liste("clients-ajouts"), a = ajouts.filter(function (x) { return x.id === id; })[0];
    if (a) { CHAMPS_CLIENT.forEach(function (k) { a[k] = c[k]; }); S.ecrire("clients-ajouts", ajouts); }
    else { var m = S.lire("clients-modifs", {}); m[id] = c; S.ecrire("clients-modifs", m); }
    return viewCustomer(id);
  }

  // ======================================================================
  // Bons cadeaux : générés une fois puis gardés dans le navigateur
  // ======================================================================
  var BONS = null;
  function ajouterJours(iso, n) { return decaler(iso, n); }
  function ajouterMois(iso, n) {
    var d = date(iso), j = d.getDate();
    d.setDate(1); d.setMonth(d.getMonth() + n);
    d.setDate(Math.min(j, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    return I.jourIso(d);
  }
  function statutBon(b) { if (b.annule) return "annule"; if (b.solde <= 0) return "epuise"; return b.expireLe < AUJ_ISO ? "expire" : "actif"; }
  function initBons() {
    if (BONS) return;
    var s = S.lire("bons", null);
    if (s && s.length) { BONS = s; return; }
    var r = graine("bons"), lettres = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    function code() { var c = "BC-"; for (var i = 0; i < 6; i++) c += lettres.charAt(Math.floor(r() * lettres.length)) + (i === 3 ? "-" : ""); return c; }
    var montants = [20, 25, 30, 50, 50, 75, 100, 150], notes = ["", "", "Anniversaire", "Noël", "Cadeau d'entreprise", "Offert par la maison", "Fête des mères", "Remerciement"];
    BONS = [];
    for (var i = 0; i < 28; i++) {
      var m = montants[Math.floor(r() * montants.length)], cree = ajouterJours(AUJ_ISO, -Math.floor(r() * 300) - 5);
      var expire = ajouterMois(cree, [3, 6, 12, 12, 24][Math.floor(r() * 5)]);
      var type = i % 8 === 0 ? "epuise" : i % 11 === 5 ? "annule" : i % 5 === 3 ? "partiel" : "plein";
      if (i < 5 && type !== "partiel") type = "plein";
      var solde = type === "epuise" ? 0 : type === "partiel" ? Math.max(5, Math.round(m * (0.2 + r() * 0.6))) : m;
      if (i < 5) expire = ajouterJours(AUJ_ISO, [3, 9, 18, 26, 45][i]);
      var hist = [{ date: cree, type: "creation", montant: m, note: "" }];
      if (solde < m) hist.push({ date: ajouterJours(cree, Math.floor(r() * 30) + 1), type: "debit", montant: arrondi(m - solde), note: "Utilisé en caisse" });
      if (type === "annule") hist.push({ date: ajouterJours(cree, Math.floor(r() * 20) + 1), type: "annulation", montant: solde, note: "" });
      BONS.push({ id: "b" + (i + 1), code: code(), montant: m, solde: solde, creeLe: cree, expireLe: expire, clientId: r() < 0.6 ? I.CLIENTS[Math.floor(r() * I.CLIENTS.length)].id : "",
        note: notes[Math.floor(r() * notes.length)], annule: type === "annule", historique: hist });
    }
  }
  function sauverBons() { S.ecrire("bons", BONS); }
  function nomClient(id) { var c = tousClients().filter(function (x) { return x.id === id; })[0]; return c ? (S.lire("clients-modifs", {})[id] || {}).name || c.name : ""; }
  function bonComplet(b) { var o = copie(b); o.statut = statutBon(b); o.clientNom = nomClient(b.clientId); return o; }
  function cagnotte(id) { initBons(); var t = 0; BONS.forEach(function (b) { if (b.clientId === id && statutBon(b) === "actif") t += b.solde; }); return arrondi(t); }
  function getVouchers() { initBons(); return reponse(BONS.map(bonComplet)); }
  function trouverBon(id) { initBons(); return BONS.filter(function (b) { return b.id === id; })[0]; }
  function createVoucher(v) {
    initBons();
    var m = Math.round(+v.montant * 100) / 100;
    if (!isFinite(m) || m <= 0) return refus("Saisir un montant supérieur à 0.");
    if (m > 5000) return refus("Montant maximum : 5 000 €.");
    if (!v.expireLe) return refus("Choisir une date de fin de validité.");
    if (v.expireLe < AUJ_ISO) return refus("La fin de validité ne peut pas être dans le passé.");
    var n = BONS.length + 1, code = "BC-" + ("0000" + Math.floor(Math.random() * 1679616).toString(36).toUpperCase()).slice(-4) + "-" + ("00" + n).slice(-2);
    var b = { id: "b" + Date.now(), code: code, montant: m, solde: m, creeLe: AUJ_ISO, expireLe: v.expireLe, clientId: v.clientId || "", note: v.note || "", annule: false,
      historique: [{ date: AUJ_ISO, type: "creation", montant: m, note: "" }] };
    BONS.push(b); sauverBons();
    return reponse(bonComplet(b));
  }
  function updateVoucher(id, ch) {
    var b = trouverBon(id);
    if (!b) return refus("Bon introuvable.");
    if (b.annule) return refus("Ce bon est annulé.");
    if (ch.expireLe !== undefined) {
      if (!ch.expireLe) return refus("Choisir une date de fin de validité.");
      if (ch.expireLe < AUJ_ISO) return refus("La fin de validité ne peut pas être dans le passé.");
      if (ch.expireLe !== b.expireLe) { b.historique.push({ date: AUJ_ISO, type: "validite", montant: 0, note: "Validité : " + b.expireLe + " → " + ch.expireLe }); b.expireLe = ch.expireLe; }
    }
    if (ch.note !== undefined) b.note = ch.note;
    sauverBons();
    return reponse(bonComplet(b));
  }
  function debitVoucher(id, montant, note) {
    var b = trouverBon(id), m = Math.round(+montant * 100) / 100;
    if (!b) return refus("Bon introuvable.");
    if (statutBon(b) !== "actif") return refus("Ce bon n'est plus utilisable.");
    if (!isFinite(m) || m <= 0) return refus("Saisir un montant supérieur à 0.");
    if (m > b.solde) return refus("Le montant dépasse le solde du bon (" + b.solde + " €).");
    b.solde = Math.round((b.solde - m) * 100) / 100;
    b.historique.push({ date: AUJ_ISO, type: "debit", montant: m, note: note || "Utilisé en caisse" });
    sauverBons();
    return reponse(bonComplet(b));
  }
  function cancelVoucher(id) {
    var b = trouverBon(id);
    if (!b) return refus("Bon introuvable.");
    b.annule = true; b.historique.push({ date: AUJ_ISO, type: "annulation", montant: b.solde, note: "" });
    sauverBons();
    return reponse(bonComplet(b));
  }

  // ======================================================================
  // Compte, organisation, intégrations
  // ======================================================================
  var UTILISATEURS = [
    { id: "u1", name: "Utilisateur Démo", email: "demo@exemple.test", sites: 1, role: "Membre", level: "OWNER", invite: false },
    { id: "u2", name: "Gérant", email: "gerant@exemple.test", sites: 1, role: "Membre", level: "OWNER", invite: false },
    { id: "u3", name: "Camille Exemple", email: "camille@exemple.test", sites: 1, role: "Membre", level: "COMPTABLE", invite: false },
    { id: "u4", name: "Yann Morvan", email: "yann@exemple.test", sites: 1, role: "Membre", level: "RESPONSABLE DE SALLE", invite: false },
    { id: "u5", name: "Nolwenn Tanguy", email: "nolwenn@exemple.test", sites: 1, role: "Membre", level: "RESPONSABLE DE SALLE", invite: false }
  ];
  function getOrganizationUsers() {
    return reponse(UTILISATEURS.concat(liste("invitations").map(function (x) { return { id: x.id, name: x.email, email: x.email, sites: 1, role: "", level: x.role, invite: true, envoyeLe: x.envoyeLe }; })));
  }
  function inviteUser(o) {
    var email = texte(o.email).toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return refus("Adresse e-mail invalide.");
    if (UTILISATEURS.some(function (u) { return u.email === email; }) || liste("invitations").some(function (u) { return u.email === email; })) return refus("Cette personne fait déjà partie de l'organisation.");
    return reponse(ajouterA("invitations", { id: nouvelId("u"), email: email, role: texte(o.role) || "OWNER", envoyeLe: AUJ_ISO }));
  }
  var ROLES = [
    { id: "ro1", name: "COMPTABLE", permissions: ["Rapports", "Export comptable"] },
    { id: "ro2", name: "OWNER", permissions: ["Tous les droits"] },
    { id: "ro3", name: "RESPONSABLE DE SALLE", permissions: ["Rapports", "Réservations", "Fiches clients", "Stocks"] }
  ];
  function getRoles() {
    return getOrganizationUsers().then(function (us) {
      return ROLES.concat(liste("roles-ajouts")).map(function (r) {
        var o = copie(r); o.userCount = us.filter(function (u) { return u.level === r.name; }).length; return o;
      });
    });
  }
  function createRole(o) {
    var nom = texte(o.name).toUpperCase();
    if (!nom) return refus("Donnez un nom au rôle.");
    if (ROLES.concat(liste("roles-ajouts")).some(function (r) { return r.name === nom; })) return refus("Ce rôle existe déjà.");
    return reponse(ajouterA("roles-ajouts", { id: nouvelId("ro"), name: nom, permissions: o.permissions || [], ajoute: true }));
  }
  function getProfile() { var p = S.lire("profil", {}); return reponse({ name: p.name || "Utilisateur Démo", email: p.email || "demo@exemple.test" }); }
  function setProfile(o) {
    var p = S.lire("profil", {});
    if (o.name !== undefined) { if (!texte(o.name)) return refus("Le nom est obligatoire."); p.name = texte(o.name); }
    if (o.email !== undefined) { if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(texte(o.email))) return refus("Adresse e-mail invalide."); p.email = texte(o.email); }
    S.ecrire("profil", p);
    return getProfile();
  }
  function getNotifications() { var n = S.lire("notifications", {}); return reponse({ rapports: n.rapports !== false, alertesStock: n.alertesStock !== false, hebdo: !!n.hebdo }); }
  function setNotifications(o) { S.ecrire("notifications", o); return getNotifications(); }
  function getLinkedAccounts() { return reponse(S.lire("comptes-lies", { google: false, apple: false })); }
  function setLinkedAccount(fournisseur, lie) { var c = S.lire("comptes-lies", { google: false, apple: false }); c[fournisseur] = !!lie; S.ecrire("comptes-lies", c); return reponse(c); }

  // Intégrations : liste et textes repris du vrai back-office (une même intégration peut apparaître dans plusieurs catégories)
  var CATEGORIES_INTEGRATIONS = [
    ["Sélection", ["Popina Order", "Pennylane", "Gestion +", "Esperoo", "Inexweb", "Fulll"]],
    ["Gestion des stocks", ["Gestion +", "Fullsoon", "SOMM'IT", "GoStan", "Inpulse", "Yokitup", "Koust"]],
    ["Comptabilité", ["Evoliz", "Fulll", "Inexweb", "My Unisoft", "Pennylane", "Inqom", "CEGID", "Bleez", "ISA COMPTA", "Dext", "iPaidThat"]],
    ["E-Ticket", ["Billiv"]],
    ["Business Intelligence", ["Otami", "Skello", "Dvore", "N8N", "Foodforecast", "Orkelo"]],
    ["Commandes en ligne", ["Popina Order"]],
    ["Solutions de Fidélité", ["LittleBill", "Hey Pongo", "Qoodos", "Ticat", "Fidelatoo"]],
    ["Ressources humaines", ["Esperoo"]],
    ["Développeur", ["Accès développeur"]]
  ];
  var DESCRIPTIONS_INTEGRATIONS = {
    "Popina Order": "Une solution intuitive pour la livraison et la vente à emporter pour votre restaurant.",
    "Pennylane": "Pennylane rassemble tous les outils et toutes les intégrations nécessaires pour gérer l’ensemble de vos dépenses, votre facturation, votre trésorerie ainsi que votre comptabilité.",
    "Gestion +": "Logiciel de gestion des factures fournisseurs et des stocks : un outil puissant pour accroître votre performance.",
    "Esperoo": "Gérez facilement votre personnel avec une solution RH complète et intuitive. Esperoo vous accompagne au quotidien dans la gestion du personnel, des plannings, des absences et bien plus encore.",
    "Inexweb": "Inexweb est une plateforme collaborative proposée à ses clients par le groupe In Extenso, cabinet national leader de l’expertise comptable des services professionnels pour les TPE-PME en France. Avec un réseau de 6 200 collaborateurs et plus de 250 agences réparties sur tout le territoire, In Extenso propose aux chefs d’entreprises, artisans, commerçants, professions libérales et responsables d’associations un service professionnel complet, à tous les stades de la vie de leur entreprise et sur l’ensemble des domaines liés à la gestion de leur activité : comptabilité, fiscalité, gestion, juridique, conseil social et paies, gestion du patrimoine, conseil en innovation-croissance, conseil en tourisme, culture et hôtellerie, transmission d’entreprise. In Extenso est l’interlocuteur privilégié de plus de 130 000 clients appartenant à tous les secteurs d’activité.",
    "Fulll": "Aujourd’hui, notre mission est d’accompagner les experts-comptables dans le pilotage de leur activité, en mettant à leur disposition des outils innovants, complets, agiles et évolutifs qui simplifient la collaboration avec leurs clients (TPE/PME) tout en les accompagnant dans la mise en place de leur méthode de travail.",
    "Fullsoon": "Fullsoon constitue un véritable outil décisionnel vous permettant d’anticiper vos ventes, optimiser la gestion de vos stocks et accélérer le développement de vos établissements.",
    "SOMM'IT": "SOMM'IT a été créé à partir d’un constat fait par des sommeliers POUR des restaurateurs. La solution a été conçue pour améliorer la rentabilité des restaurateurs à travers la carte des vins.",
    "GoStan": "Maîtrisez votre stock de boissons, pilotez votre stratégie commerciale et augmentez vos revenus. GoStan s’emploie à mettre la technologie et l’intelligence de la donnée au service de vos objectifs.",
    "Inpulse": "Inpulse.ai révolutionne la gestion des stocks et des commandes fournisseurs : assistés par l’intelligence artificielle, vos points de vente gagnent jusqu’à 5 points de marge sur le coût matière. Vous pilotez les performances de votre réseau en temps réel pour agir vite.",
    "Yokitup": "La solution complète pour gérer les stocks et les commandes fournisseurs de tous vos restaurants.",
    "Koust": "Nous sommes Koust. Nous aidons les restaurateurs à se concentrer sur les actions qui leurs permettent d’améliorer leurs profits. Koust est un outil de contrôle de gestion conçu par un restaurateur pour les restaurateurs",
    "Evoliz": "LOGICIEL DE FACTURATION ET PRÉ COMPTABILITÉ. Facturez en toute légalité, contrôlez vos dépenses, maîtrisez vos mouvements bancaires… Faîtes encore plus que ça, au même endroit.",
    "My Unisoft": "MyUnisoft est la solution de compta augmentée pour les cabinets de demain. Un outil comptable complet pour gérer tous les dossiers",
    "Inqom": "Logiciel moderne de production comptable et fiscale pensé pour la productivité, la qualité et la sécurité",
    "CEGID": "Automatisez le transfert de vos données financières vers Cegid. Cette intégration synchronise vos transactions pour une tenue comptable en temps réel, garantissant une collaboration fluide avec votre expert-comptable et une conformité fiscale totale.",
    "Bleez": "Bleez révolutionne la gestion comptable pour les entrepreneurs, les assos et les experts-comptables. Un logiciel en ligne, intuitif et collaboratif, qui vous fait gagner du temps et vous redonne la main sur ce qui compte vraiment.",
    "ISA COMPTA": "Gagnez en autonomie, en visibilité et en sérénité grâce à un logiciel 100% conçu pour les TPE-PME. Conforme, simple, et connecté à la réalité terrain.",
    "Dext": "Dext est une Plateforme Agréée certifiée par l'État qui aide les cabinets d'expertise comptable et les entreprises à simplifier la comptabilité et la facturation électronique grâce à l'IA. Gagnez du temps au quotidien avec nos outils pour gérer facilement vos documents administratifs, automatiser les tâches comptables répétitives et rester en conformité avec la réforme.",
    "iPaidThat": "Gérez facilement votre facturation, vos notes de frais, vos paiements et votre trésorerie depuis une seule plateforme. iPaidThat inclus une Plateforme Agréée par la DGFiP garantissant votre conformité sur la facturation électronique.",
    "Billiv": "Billiv propose une solution éco-responsable de dématérialisation de tickets de caisse via QR code, sans inscription ni téléchargement requis, transformant le ticket en un puissant outil marketing qui augmente l’embasement client, multiplie le nombre d’avis clients et la portée des communications par rapport au ticket par email.",
    "Otami": "Otami est le partenaire rentabilité des professionnels de la boulangerie, pâtisserie et restauration. La solution permet de mieux piloter ses achats, ses coûts matières, ses marges et sa production, simplement et au quotidien. À la clé : jusqu’à 200 heures gagnées par an, jusqu’à 5 points de marge supplémentaires et des décisions plus rapides grâce à des données fiables. Plus de 4 000 professionnels font déjà confiance à Otami pour gagner en sérénité et en temps.",
    "Skello": "Intégrez Skello à votre gestion d’équipe pour optimiser vos plannings et améliorer la communication interne. Simplifiez vos tâches RH et offrez à vos employés un accès en temps réel à leurs informations.",
    "Dvore": "Centralisez et analysez vos données en temps réel. Optimisez vos opérations grâce à des tableaux de bord personnalisés et simplifiez la gestion des performances de votre restaurant avec une intégration rapide et sécurisée.",
    "N8N": "Construisez visuellement, allez plus loin avec le code, connectez-vous à tout. Chaque étape du raisonnement de vos agents est traçable sur le canevas. Déployez sur votre infrastructure ou la nôtre.",
    "Foodforecast": "foodforecast est une solution d'IA prédictive spécialisée pour les produits frais. Notre technologie anticipe les ventes de chaque produit, jour par jour et heure par heure, afin d'aider les boulangeries et restaurateurs à produire au plus juste et commander la bonne quantité auprès de leurs fournisseurs. Grâce à l'intégration foodforecast × Popina, les données de ventes Popina alimentent en temps réel notre IA, qui te renvoie chaque jour des prévisions précises et des recommandations de commande directement exploitables. Résultats moyens chez nos clients européens : -34 % d'invendus, -90 % de ruptures, +11 % de chiffre d'affaires. Déjà déployée dans plus de 6 000 points de vente.",
    "Orkelo": "Orkelo est le copilote intelligent des restaurateurs, experts-comptables et copilotes d’entreprise. Il centralise les ventes, les achats, les marges, les plannings et le pointage. Grâce à l’IA, son copilote analyse les performances, détecte les hausses de prix et les pertes de rentabilité, puis propose des actions concrètes. Orkelo prédit également les ventes de chaque journée afin de mieux anticiper les achats, la production et les besoins en personnel. Résultat : moins de ressaisie, d’erreurs, de gaspillage et de dépenses invisibles, plus de temps gagné et des décisions rapides pour améliorer durablement la rentabilité du restaurant.",
    "LittleBill": "Boostez la rétention de vos clients avec LittleBill, la solution de fidélité digitale sans friction. Grâce à sa technologie NFC, captez les données de vos clients en un instant, automatisez vos campagnes SMS et dématérialisez vos tickets de caisse. Un outil tout-en-un pour transformer vos clients de passage en habitués fidèles et améliorer votre visibilité Google.",
    "Hey Pongo": "Captez, activez, fidélisez. Parce que tous vos visiteurs devraient vous rapporter du chiffre d’affaires.",
    "Qoodos": "Qoodos est une solution de fidélisation pour commerces de proximité et restaurants, offrant un programme de fidélité digital qui permet aux entreprises de récompenser leurs clients pour leurs achats.",
    "Ticat": "TICAT propose un ticket intelligent pour redonner de la valeur aux données d’achat et réinventer la relation entre commerçants et consommateurs, notamment autour de la fidélité et de l’expérience client.",
    "Fidelatoo": "🛍️ Commerçants, boostez vos visites ici ! Vos clients vont devenir accros 🔥 Votre programme de fidélité 100% digital dans leur iPhone/Android.",
    "Accès développeur": "Créez vos propres intégrations et connectez vos outils internes grâce à des clés API indépendantes de toute application tierce."
  };
  var INTEGRATIONS_ACTIVES_DEFAUT = ["Popina Order"];
  function integrationsActives() { return S.lire("integrations-actives", INTEGRATIONS_ACTIVES_DEFAUT); }
  function getIntegrationList() {
    var act = integrationsActives();
    return reponse(CATEGORIES_INTEGRATIONS.map(function (c) {
      return { categorie: c[0], integrations: c[1].map(function (n) { return { nom: n, description: DESCRIPTIONS_INTEGRATIONS[n] || "", active: act.indexOf(n) >= 0 }; }) };
    }));
  }
  function setIntegrationActive(nom, actif) {
    var act = integrationsActives().filter(function (n) { return n !== nom; });
    if (actif) act.push(nom);
    S.ecrire("integrations-actives", act);
    return reponse(act.indexOf(nom) >= 0);
  }
  function getAgencyInfo() {
    return reponse({
      site: I.SITES[0].name, reference: "CD-35-0412", agence: "Agence Rennes", ville: "Rennes",
      agences: [{ nom: "Agence Rennes", adresse: "1 place de l'Exemple - 35000 RENNES", tel: "02 99 00 00 00" }, { nom: "Agence Nantes", adresse: "8 quai de l'Exemple - 44000 NANTES", tel: "02 40 00 00 00" }]
    });
  }

  var X = {
    getCatalogue: getCatalogue, getAllModifierGroups: getAllModifierGroups, createModifierGroup: createModifierGroup, getAllMeals: getAllMeals, createMeal: createMeal,
    getEmployeesPos: getEmployeesPos, createEmployee: createEmployee, getRooms: getRooms, getPrintersList: getPrintersList,
    getAllPreparationStations: getAllPreparationStations, createPreparationStation: createPreparationStation, getPricingList: getPricingList,
    getAllTaxes: getAllTaxes, createTax: createTax, getDiscounts: getDiscounts, createDiscount: createDiscount,
    getCashMovementReasons: getCashMovementReasons, createCashMovementReason: createCashMovementReason, getAllPayments: getAllPayments, createPaymentMode: createPaymentMode,
    getReceiptSettings: getReceiptSettings, setReceiptSettings: setReceiptSettings, getMiscSettings: getMiscSettings, setMiscSettings: setMiscSettings,
    getLogicalDevices: getLogicalDevices, getLayout: getLayout, setLayout: setLayout,
    getReservationList: getReservationList, createReservation: createReservation, setReservationStatus: setReservationStatus,
    getCustomers: getCustomers, viewCustomer: viewCustomer, getCustomerOrders: getCustomerOrders, createCustomer: createCustomer, updateCustomer: updateCustomer,
    getVouchers: getVouchers, createVoucher: createVoucher, updateVoucher: updateVoucher, debitVoucher: debitVoucher, cancelVoucher: cancelVoucher,
    ajouterJours: ajouterJours, ajouterMois: ajouterMois,
    getOrganizationUsers: getOrganizationUsers, inviteUser: inviteUser, getRoles: getRoles, createRole: createRole,
    getProfile: getProfile, setProfile: setProfile, getNotifications: getNotifications, setNotifications: setNotifications,
    getLinkedAccounts: getLinkedAccounts, setLinkedAccount: setLinkedAccount,
    getIntegrationList: getIntegrationList, setIntegrationActive: setIntegrationActive, getAgencyInfo: getAgencyInfo
  };
  Object.keys(X).forEach(function (k) { D[k] = X[k]; });
})();
