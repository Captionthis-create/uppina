/*
 * donnees-test.js : moteur de données de la démo Up'Pina (Crêperie Démo, Rennes). Tout est INVENTÉ.
 *
 * - Chaque journée est générée à partir d'une graine propre à sa date : un jour passé a toujours les mêmes chiffres,
 *   pour tout le monde. Historique depuis l'ouverture (1er novembre 2024).
 * - Aujourd'hui se remplit au fil de l'heure réelle (on ne voit que les encaissements déjà passés), plus les
 *   « encaissements de démo » propres à ce navigateur (voir ajouterEncaissementsDemo).
 * - Ouvert 7j/7 de 8h à 23h ; environ 3 500 € TTC et 150 couverts par jour en moyenne, saisons, +8 % sur un an,
 *   effet de la météo réelle de Rennes (MeteoDemo.pourVentes).
 *
 * Les fonctions publiques gardent les noms des procédures de l'API observée (getReportPaymentMode...) et renvoient
 * une Promise. La suite (point de vente, clients, réservations, réglages) est dans donnees-gestion.js.
 */
(function () {
  "use strict";
  var S = window.Stockage, M = window.MeteoDemo;

  // ======================================================================
  // Outils
  // ======================================================================
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function generateur(graine) {
    var a = graine >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function graine(cle) { return generateur(hash("uppina|" + cle)); }
  function entre(r, a, b) { return a + Math.floor(r() * (b - a + 1)); }
  function choisir(r, t) { return t[Math.floor(r() * t.length)]; }
  function pondere(r, t, poids) {
    var total = 0, i;
    for (i = 0; i < poids.length; i++) total += poids[i];
    var x = r() * total;
    for (i = 0; i < t.length; i++) { x -= poids[i]; if (x < 0) return t[i]; }
    return t[t.length - 1];
  }
  function triangle(r, a, b, c) { var u = r(), f = (c - a) / (b - a); return u < f ? a + Math.sqrt(u * (b - a) * (c - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - c)); }
  function arrondi(n) { return Math.round(n * 100) / 100; }
  function deux(n) { return ("0" + n).slice(-2); }
  function jourIso(d) { return d.getFullYear() + "-" + deux(d.getMonth() + 1) + "-" + deux(d.getDate()); }
  function date(iso) { return new Date(iso + "T12:00:00"); }
  function decaler(iso, n) { var d = date(iso); d.setDate(d.getDate() + n); return jourIso(d); }
  function ecartJours(a, b) { return Math.round((date(b) - date(a)) / 86400000); }
  function copie(v) { return JSON.parse(JSON.stringify(v)); }
  function reponse(v) { return Promise.resolve(copie(v)); }
  function hhmm(min) { return deux(Math.floor(min / 60)) + ":" + deux(min % 60); }
  function maintenantMin() { var n = new Date(); return n.getHours() * 60 + n.getMinutes(); }

  var AUJ_ISO = jourIso(new Date());
  var OUVERTURE = "2024-11-01";          // premier jour d'activité du restaurant
  var REF = "2026-11-01", BASE_CA = 3400; // niveau de CA moyen d'une journée « normale » à cette date
  var OUVRE = 480, FERME = 1380;          // 8h00 - 23h00

  // ======================================================================
  // Établissement
  // ======================================================================
  var SITE_ID = "00000000-0000-4000-8000-000000000001";
  var SITES = [{ id: SITE_ID, name: "Crêperie Démo", sigle: "CD", address: "12 rue de l'Exemple", city: "Rennes", zip: "35000", country: "France" }];

  // ======================================================================
  // Catalogue
  // ======================================================================
  var CATEGORIES = [
    { nom: "Boissons chaudes", couleur: "#a3380b", sous: ["Cafés", "Thés", "Chocolats"] },
    { nom: "Softs", couleur: "#1a8fb5", sous: ["Jus", "Sodas", "Eaux"] },
    { nom: "Bières", couleur: "#d99a1e", sous: ["Pression", "Bouteilles"] },
    { nom: "Cidres", couleur: "#e0703a", sous: ["Bolées", "Bouteilles", "Apéritifs"] },
    { nom: "Vins", couleur: "#b3123f", sous: ["Rouges", "Blancs", "Bulles"] },
    { nom: "Galettes", couleur: "#0e8a8a", sous: ["Classiques", "Spéciales"] },
    { nom: "Crêpes", couleur: "#8e44ad", sous: ["Sucrées", "Flambées"] },
    { nom: "Plats", couleur: "#5a7d1a", sous: ["Burgers", "Salades", "Assiettes"] },
    { nom: "Desserts", couleur: "#5b4bc4", sous: ["Glaces", "Pâtisseries"] },
    { nom: "Épicerie", couleur: "#6d6d6d", sous: ["Épicerie fine"] }
  ];
  // [nom, catégorie, sous-catégorie, prix TTC, TVA %, pôle, prix d'achat HT, famille, groupe d'options]
  var PRODUITS_DEF = [
    ["Café", 0, 0, 2.2, 10, "Bar", 0.28, "chaud"], ["Café crème", 0, 0, 3.2, 10, "Bar", 0.45, "chaud"], ["Cappuccino", 0, 0, 4, 10, "Bar", 0.55, "chaud"],
    ["Thé", 0, 1, 3.5, 10, "Bar", 0.3, "chaud"], ["Infusion", 0, 1, 3.5, 10, "Bar", 0.3, "chaud"], ["Chocolat chaud", 0, 2, 4, 10, "Bar", 0.6, "chaud"],
    ["Chocolat viennois", 0, 2, 4.8, 10, "Bar", 0.85, "chaud"],
    ["Jus de pomme 25cl", 1, 0, 3.5, 10, "Bar", 0.7, "soft"], ["Jus d'orange pressé", 1, 0, 4.5, 10, "Bar", 1.1, "soft"], ["Limonade", 1, 1, 3.2, 10, "Bar", 0.45, "soft", "Sirop"],
    ["Diabolo", 1, 1, 3.5, 10, "Bar", 0.55, "soft", "Sirop"], ["Cola 33cl", 1, 1, 3.8, 10, "Bar", 0.75, "soft"], ["Sirop à l'eau", 1, 1, 2, 10, "Bar", 0.2, "sirop", "Sirop"],
    ["Eau gazeuse 50cl", 1, 2, 3.5, 10, "Bar", 0.6, "soft"], ["Carafe d'eau", 1, 2, 0, 10, "Bar", 0, "eau"],
    ["Blonde pression 25cl", 2, 0, 3.5, 20, "Bar", 0.7, "biere"], ["Blonde pression 50cl", 2, 0, 6.5, 20, "Bar", 1.3, "biere"], ["IPA pression 25cl", 2, 0, 4.2, 20, "Bar", 0.95, "biere"],
    ["Bière bretonne 33cl", 2, 1, 5.5, 20, "Bar", 1.6, "biere"],
    ["Bolée de cidre brut", 3, 0, 4.2, 20, "Bar", 0.7, "bolee"], ["Bolée de cidre doux", 3, 0, 4.2, 20, "Bar", 0.7, "bolee"], ["Cidre brut 75cl", 3, 1, 18.5, 20, "Bar", 4.2, "cidre"],
    ["Cidre doux 75cl", 3, 1, 18.5, 20, "Bar", 4.2, "cidre"], ["Kir breton", 3, 2, 5.5, 20, "Bar", 1.2, "apero"], ["Chouchen 6cl", 3, 2, 4.5, 20, "Bar", 1.1, "digestif"],
    ["Rouge verre 12cl", 4, 0, 4.5, 20, "Bar", 0.9, "vinVerre"], ["Rouge bouteille 75cl", 4, 0, 24, 20, "Bar", 7, "vinBouteille"], ["Blanc verre 12cl", 4, 1, 4.5, 20, "Bar", 0.9, "vinVerre"],
    ["Blanc bouteille 75cl", 4, 1, 24, 20, "Bar", 7, "vinBouteille"], ["Crémant verre 12cl", 4, 2, 6.5, 20, "Bar", 1.6, "apero"],
    ["Complète", 5, 0, 11.5, 10, "Crêperie", 2.3, "galette", "Suppléments galette"], ["Jambon fromage", 5, 0, 10.5, 10, "Crêperie", 2, "galette", "Suppléments galette"],
    ["Galette saucisse", 5, 0, 6.5, 10, "Crêperie", 1.6, "saucisse"], ["Végétarienne", 5, 0, 12.5, 10, "Crêperie", 2.4, "galette", "Suppléments galette"],
    ["Chèvre miel", 5, 1, 12.9, 10, "Crêperie", 2.7, "galette"], ["Forestière", 5, 1, 13.9, 10, "Crêperie", 3, "galette"], ["Océane", 5, 1, 15.5, 10, "Crêperie", 3.6, "galette"],
    ["Andouille de Guémené", 5, 1, 14.5, 10, "Crêperie", 3.3, "galette"],
    ["Crêpe beurre sucre", 6, 0, 4.5, 10, "Crêperie", 0.45, "crepe", "Suppléments crêpe"], ["Crêpe citron", 6, 0, 5.2, 10, "Crêperie", 0.55, "crepe", "Suppléments crêpe"],
    ["Crêpe chocolat maison", 6, 0, 6.2, 10, "Crêperie", 0.9, "crepe", "Suppléments crêpe"], ["Crêpe caramel beurre salé", 6, 0, 6.8, 10, "Crêperie", 0.95, "crepe", "Suppléments crêpe"],
    ["Crêpe pommes caramel", 6, 0, 7.9, 10, "Crêperie", 1.3, "crepe", "Suppléments crêpe"], ["Crêpe banane chocolat", 6, 0, 7.5, 10, "Crêperie", 1.2, "crepe", "Suppléments crêpe"],
    ["Crêpe flambée", 6, 1, 9.5, 10, "Crêperie", 1.9, "flambee"],
    ["Burger maison", 7, 0, 17.5, 10, "Cuisine", 4.2, "plat", "Cuisson"], ["Burger végé", 7, 0, 16.5, 10, "Cuisine", 3.9, "plat"], ["Salade bretonne", 7, 1, 15.5, 10, "Cuisine", 3.4, "plat"],
    ["Assiette du jour", 7, 2, 16, 10, "Cuisine", 3.8, "plat"], ["Frites", 7, 2, 4, 10, "Cuisine", 0.6, "accomp"],
    ["Coupe 2 boules", 8, 0, 5.5, 10, "Dessert", 1.1, "glace", "Parfum"], ["Coupe 3 boules", 8, 0, 7, 10, "Dessert", 1.5, "glace", "Parfum"],
    ["Fondant chocolat", 8, 1, 7, 10, "Dessert", 1.6, "patisserie"], ["Far breton", 8, 1, 5.5, 10, "Dessert", 0.9, "patisserie"], ["Kouign-amann", 8, 1, 5.5, 10, "Dessert", 1, "patisserie"],
    ["Tarte du jour", 8, 1, 6.5, 10, "Dessert", 1.4, "patisserie"],
    ["Pot de caramel 220g", 9, 0, 6.9, 5.5, "Bar", 2.8, "epicerie"]
  ];
  var PRODUITS = PRODUITS_DEF.map(function (d, i) {
    return {
      id: "p" + (i + 1), nom: d[0], cat: d[1], sous: d[2], categorie: CATEGORIES[d[1]].nom, sousCategorie: CATEGORIES[d[1]].sous[d[2]],
      couleur: CATEGORIES[d[1]].couleur, prix: d[3], tva: d[4], pole: d[5], achat: d[6], famille: d[7], groupe: d[8] || null
    };
  });
  var PAR_ID = {}, PAR_NOM = {};
  PRODUITS.forEach(function (p) { PAR_ID[p.id] = p; PAR_NOM[p.nom] = p; });
  function P(nom) { return PAR_NOM[nom]; }

  var GROUPES_OPTIONS = [
    { id: "g1", nom: "Cuisson", options: [["Saignant", 0], ["À point", 0], ["Bien cuit", 0]], poids: [2, 5, 3] },
    { id: "g2", nom: "Parfum", options: [["Vanille", 0], ["Chocolat", 0], ["Fraise", 0], ["Café", 0], ["Citron", 0], ["Caramel beurre salé", 0]], poids: [5, 4, 3, 2, 2, 4] },
    { id: "g3", nom: "Sirop", options: [["Menthe", 0], ["Grenadine", 0], ["Citron", 0], ["Fraise", 0]], poids: [4, 4, 1, 2] },
    { id: "g4", nom: "Suppléments crêpe", options: [["+ Chantilly", 1], ["+ Boule de glace", 1.5], ["+ Amandes grillées", 0.8]], poids: [5, 3, 1] },
    { id: "g5", nom: "Suppléments galette", options: [["+ Œuf", 1], ["+ Fromage", 1.5], ["+ Champignons", 1.5]], poids: [3, 4, 2] }
  ];
  function groupeParNom(n) { return GROUPES_OPTIONS.filter(function (g) { return g.nom === n; })[0]; }

  var TAXES = [{ id: "t1", name: "TVA 0%", rate: 0 }, { id: "t2", name: "TVA 5,5%", rate: 5.5 }, { id: "t3", name: "TVA 20%", rate: 20 }, { id: "t4", name: "TVA 10%", rate: 10 }];
  function nomTaxe(rate) { return rate === 5.5 ? "TVA 5,5%" : "TVA " + rate + "%"; }

  var EMPLOYES = ["Gérant", "Alice", "Bruno", "Chloé", "David", "Emma", "Farid", "Gaëlle", "Hugo", "Inès", "Jules", "Karim"]
    .map(function (n, i) { return { id: "e" + (i + 1), name: n, isOwner: i === 0 }; });
  var SERVEURS = EMPLOYES.slice(1).map(function (e) { return e.name; });

  var SALLES = [
    { id: "r1", nom: "Salle", type: "room", actif: true, tables: 16, prefixe: "S" },
    { id: "r2", nom: "Terrasse", type: "room", actif: true, tables: 10, prefixe: "T" },
    { id: "r3", nom: "Comptoir", type: "bar", actif: true, tables: 6, prefixe: "C" },
    { id: "r4", nom: "Véranda", type: "room", actif: true, tables: 6, prefixe: "V" },
    { id: "r5", nom: "À emporter", type: "takeOut", actif: true, tables: 0, prefixe: "E" },
    { id: "r6", nom: "Livraison", type: "extOrder", actif: false, tables: 0, prefixe: "L" }
  ];
  function salleParNom(n) { return SALLES.filter(function (s) { return s.nom === n; })[0]; }

  var MODES_PAIEMENT = [
    { id: "m1", nom: "Carte de crédit", couleur: "#a3380b", voucher: false, tiroir: false, tips: true },
    { id: "m2", nom: "Espèces", couleur: "#8e44ad", voucher: false, tiroir: true, tips: false },
    { id: "m3", nom: "Chèque", couleur: "#0e8a8a", voucher: false, tiroir: true, tips: false },
    { id: "m4", nom: "Chèque Vacances", couleur: "#5b4bc4", voucher: false, tiroir: true, tips: false },
    { id: "m5", nom: "Titre restaurant", couleur: "#0f8a5f", voucher: false, tiroir: true, tips: false },
    { id: "m6", nom: "Compte client", couleur: "#b3123f", voucher: false, tiroir: false, tips: false },
    { id: "m7", nom: "Cagnotte", couleur: "#1a73c8", voucher: true, tiroir: false, tips: false },
    { id: "m8", nom: "Virement", couleur: "#d17a00", voucher: false, tiroir: false, tips: false },
    { id: "m9", nom: "Paiement en ligne", couleur: "#2b6cb0", voucher: false, tiroir: false, tips: true }
  ];
  var REMISES = [
    { id: "d1", nom: "Offert", type: "percentage", valeur: 100 }, { id: "d2", nom: "Remise équipe", type: "percentage", valeur: 20 },
    { id: "d3", nom: "Bon d'achat", type: "amount", valeur: 15 }, { id: "d4", nom: "Geste commercial", type: "percentage", valeur: 10 }
  ];
  var MOTIFS_ANNULATION = [["Annulation à la volée", 50], ["Faute de frappe", 30], ["Client a changé d'avis", 10], ["Stock épuisé", 7], ["Produit endommagé", 3]];
  var FORMULES = [
    { id: "ml1", nom: "Formule midi", prix: 16.9, etapes: ["Galette", "Crêpe", "Boisson"],
      choix: [["Complète", "Jambon fromage", "Végétarienne", "Galette saucisse"], ["Crêpe beurre sucre", "Crêpe citron", "Crêpe chocolat maison", "Crêpe caramel beurre salé"],
        ["Bolée de cidre brut", "Bolée de cidre doux", "Limonade", "Jus de pomme 25cl"]], poids: [[5, 4, 2, 2], [4, 2, 4, 3], [4, 3, 2, 2]] },
    { id: "ml2", nom: "Formule enfant", prix: 9.9, etapes: ["Galette", "Crêpe", "Boisson"],
      choix: [["Jambon fromage"], ["Crêpe chocolat maison"], ["Sirop à l'eau"]], poids: [[1], [1], [1]] }
  ];

  // ======================================================================
  // Calendrier : combien vend une journée
  // ======================================================================
  var JOUR_SEM = [1.25, 0.75, 0.72, 0.86, 0.92, 1.15, 1.55];           // dimanche ... samedi
  var MOIS_F = [0.84, 0.88, 0.93, 1, 1.05, 1.1, 1.18, 1.08, 1, 0.97, 0.93, 1.15];
  // Part de chaque service dans la journée : matin (8h-11h), midi (11h30-15h), après-midi (15h-18h30), soir (18h30-23h)
  var PARTS = { 0: [0.05, 0.47, 0.15, 0.33], 1: [0.03, 0.43, 0.08, 0.46], 2: [0.03, 0.43, 0.08, 0.46], 3: [0.03, 0.43, 0.08, 0.46], 4: [0.03, 0.42, 0.08, 0.47], 5: [0.03, 0.38, 0.08, 0.51], 6: [0.04, 0.36, 0.13, 0.47] };
  var SERVICES = [
    { cle: "matin", de: 485, a: 659, pic: 560 }, { cle: "midi", de: 700, a: 900, pic: 805 },
    { cle: "aprem", de: 900, a: 1109, pic: 990 }, { cle: "soir", de: 1112, a: 1379, pic: 1268 }
  ];
  function paques(an) {
    var a = an % 19, b = Math.floor(an / 100), c = an % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    var h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    var mois = Math.floor((h + l - 7 * m + 114) / 31), jour = ((h + l - 7 * m + 114) % 31) + 1;
    return jourIso(new Date(an, mois - 1, jour, 12));
  }
  var FETES_CACHE = {};
  function fete(iso) {
    var an = +iso.slice(0, 4), md = iso.slice(5);
    if (!FETES_CACHE[an]) {
      var p = paques(an), f = {};
      f[decaler(p, -47).slice(5)] = { f: 1.3, crepe: 1.7, nom: "Mardi gras" };
      f[decaler(p, 1).slice(5)] = { f: 1.15, nom: "Lundi de Pâques" };
      f[decaler(p, 39).slice(5)] = { f: 1.15, nom: "Ascension" };
      f[decaler(p, 50).slice(5)] = { f: 1.1, nom: "Lundi de Pentecôte" };
      FETES_CACHE[an] = f;
    }
    var fixes = {
      "02-02": { f: 1.8, crepe: 2.2, nom: "Chandeleur" }, "02-14": { f: 1.15, soir: 1.35, nom: "Saint-Valentin" }, "05-01": { f: 0.85 }, "05-08": { f: 1.1 },
      "06-21": { f: 1.2, soir: 1.2 }, "07-14": { f: 1.15 }, "08-15": { f: 1.05 }, "11-01": { f: 1.1 }, "11-11": { f: 1.1 },
      "12-24": { f: 0.85, soir: 0.6 }, "12-25": { f: 0.7 }, "12-31": { f: 1.3, soir: 1.45 }, "01-01": { f: 0.6 }
    };
    return FETES_CACHE[an][md] || fixes[md] || null;
  }
  function tendance(iso) { return Math.pow(1.08, ecartJours(REF, iso) / 365.25); }
  // Contexte d'une journée : objectif de CA, parts des services, météo (terrasse, boissons chaudes, glaces)
  var CTX = {};
  function contexte(iso) {
    if (CTX[iso]) return CTX[iso];
    var r = graine("jour|" + iso), d = date(iso), js = d.getDay(), mo = d.getMonth();
    var met = M.pourVentes(iso), sc = M.score(met), ecart = (sc - M.moyenneMois[mo]) / 50;
    var fMeteo = Math.max(0.86, Math.min(1.14, 1 + 0.12 * ecart)) * ((met.pluie || 0) >= 8 ? 0.95 : 1);
    var fe = fete(iso), bruit = 1 + (r() + r() + r() - 1.5) * 0.12;
    var total = BASE_CA * JOUR_SEM[js] * MOIS_F[mo] * tendance(iso) * fMeteo * (fe ? fe.f : 1) * bruit;
    var parts = PARTS[js].slice();
    if (met.tmax >= 22 && (met.pluie || 0) < 1) { parts[2] += 0.04; parts[1] -= 0.02; parts[3] -= 0.02; }
    if (fe && fe.soir) { parts[3] *= fe.soir; var s = parts[0] + parts[1] + parts[2] + parts[3]; parts = parts.map(function (x) { return x / s; }); }
    var tf = 0, pl = met.pluie || 0;
    if (pl < 2 && met.tmax >= 12) tf = Math.max(0.15, Math.min(1.3, (met.tmax - 12) / 10)) * (pl >= 0.5 ? 0.5 : 1) * ((met.vent || 0) > 35 ? 0.5 : 1);
    var c = CTX[iso] = {
      iso: iso, js: js, mois: mo, total: total, parts: parts, meteo: met, terrasse: tf,
      chaud: Math.max(0.4, Math.min(2, 1 + (16 - met.tmax) / 10)), glace: Math.max(0.15, Math.min(2.6, 0.5 + (met.tmax - 14) / 7)),
      crepe: fe && fe.crepe ? fe.crepe : 1, semaine: js >= 1 && js <= 5, ete: mo >= 6 && mo <= 7
    };
    return c;
  }
  // Valeur attendue (sans aléa) d'une journée : sert aux objectifs pré-remplis
  function attendu(iso) {
    var d = date(iso), fe = fete(iso);
    var met = M.pourVentes(iso), ecart = (M.score(met) - M.moyenneMois[d.getMonth()]) / 50;
    return BASE_CA * JOUR_SEM[d.getDay()] * MOIS_F[d.getMonth()] * tendance(iso) * Math.max(0.86, Math.min(1.14, 1 + 0.12 * ecart)) * (fe ? fe.f : 1);
  }

  // ======================================================================
  // Clients (fichier client) et jours de visite
  // ======================================================================
  var PRENOMS = ["Louise", "Hugo", "Camille", "Noé", "Jade", "Lucas", "Manon", "Théo", "Sarah", "Léo", "Zoé", "Adam", "Nina", "Paul", "Lina", "Tom", "Inès", "Axel", "Anna", "Marc",
    "Gwenaëlle", "Yann", "Maël", "Nolwenn", "Erwan", "Soazig", "Loïc", "Morgane", "Ronan", "Clara"];
  var NOMS = ["Martin", "Bernard", "Dubois", "Thomas", "Robert", "Richard", "Petit", "Durand", "Leroy", "Moreau", "Simon", "Laurent", "Lefebvre", "Michel", "Garcia", "David",
    "Bertrand", "Roux", "Vincent", "Fournier", "Le Gall", "Le Goff", "Le Roux", "Guillou", "Tanguy", "Le Bihan", "Morvan", "Jaouen"];
  var RUES = ["rue de Saint-Malo", "boulevard de la Liberté", "rue d'Antrain", "avenue Janvier", "rue de Brest", "boulevard de Sévigné", "rue de Fougères", "rue Saint-Hélier",
    "quai Saint-Cast", "rue de Nantes", "avenue du Général Leclerc", "rue Jean Guéhenno", "rue de Châteaugiron", "rue de Lorient", "rue Alphonse Guérin", "rue de Vern", "rue de Dinan", "rue Saint-Michel"];
  var COMMUNES = [["Rennes", "35000", 50], ["Rennes", "35200", 14], ["Rennes", "35700", 14], ["Cesson-Sévigné", "35510", 8], ["Saint-Grégoire", "35760", 6], ["Chantepie", "35135", 4], ["Bruz", "35170", 4]];
  var CLIENTS = [], VISITES = {};
  (function () {
    var r = graine("clients");
    for (var i = 0; i < 120; i++) {
      var prenom = choisir(r, PRENOMS), nom = choisir(r, NOMS), commune = pondere(r, COMMUNES, COMMUNES.map(function (c) { return c[2]; }));
      var profil = pondere(r, ["habitue", "regulier", "occasionnel"], [15, 35, 50]);
      var inscrit = decaler(OUVERTURE, entre(r, 0, 600));
      var c = {
        id: "k" + (i + 1), name: prenom + " " + nom, prenom: prenom, nomFamille: nom,
        phone: r() < 0.7 ? "06 00 00 " + deux(entre(r, 0, 99)) + " " + deux(entre(r, 0, 99)) : "",
        email: r() < 0.45 ? (prenom + "." + nom).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z.]+/g, "") + "@exemple.test" : "",
        address: r() < 0.6 ? entre(r, 1, 120) + " " + choisir(r, RUES) : "", city: "", zip: "", company: r() < 0.1 ? choisir(r, ["Cabinet Exemple", "Société Démo", "Agence Test"]) : "",
        comment: "", inscrit: inscrit, profil: profil, ardoise: r() < 0.16, depots: []
      };
      if (c.address) { c.city = commune[0]; c.zip = commune[1]; }
      if (r() < 0.12) c.depots.push({ date: decaler(inscrit, entre(r, 5, 200)), montant: choisir(r, [100, 150, 200, 250]), mode: choisir(r, ["Virement", "Carte de crédit"]), note: "Acompte réservation de groupe" });
      if (c.ardoise) c.comment = "Règle sur facture en fin de mois";
      // Jours de visite (du jour d'inscription à aujourd'hui)
      var pas = profil === "habitue" ? [5, 12] : profil === "regulier" ? [14, 35] : [45, 120], d = inscrit, n = 0;
      while (d <= AUJ_ISO && n < 200) {
        if (d >= OUVERTURE) { (VISITES[d] = VISITES[d] || []).push(c.id); n++; }
        d = decaler(d, entre(r, pas[0], pas[1]));
      }
      c.nbVisites = n;
      CLIENTS.push(c);
    }
    CLIENTS.sort(function (a, b) { return a.name < b.name ? -1 : 1; });
  })();
  var CLIENT_PAR_ID = {};
  CLIENTS.forEach(function (c) { CLIENT_PAR_ID[c.id] = c; });
  // Les clients « ardoise » ont leurs 1 à 3 dernières visites réglées sur leur compte client (encore dues)
  var IMPAYES = {};
  CLIENTS.forEach(function (c) {
    if (!c.ardoise) return;
    var dates = Object.keys(VISITES).filter(function (d) { return d < AUJ_ISO && VISITES[d].indexOf(c.id) >= 0; }).sort().reverse();
    dates.slice(0, 1 + (hash(c.id) % 3)).forEach(function (d) { IMPAYES[d + "|" + c.id] = true; });
  });

  // ======================================================================
  // Génération d'une commande
  // ======================================================================
  function totalItem(it) { var s = it.prix; it.opts.forEach(function (o) { s += o.prix; }); return arrondi(s * it.q); }
  function ajouter(items, nom, q, opts, prix, menu) {
    var p = P(nom);
    if (!p) return;
    opts = opts || [];
    var cleOpts = opts.map(function (o) { return o.nom; }).join("|");
    var px = prix === undefined ? p.prix : prix;
    for (var i = 0; i < items.length; i++) {
      var x = items[i];
      if (x.p === p.id && x.prix === px && (x.menu || "") === (menu || "") && x.opts.map(function (o) { return o.nom; }).join("|") === cleOpts) { x.q += q; return; }
    }
    var it = { p: p.id, q: q, prix: px, opts: opts };
    if (menu) it.menu = menu;
    items.push(it);
  }
  function options(r, nom, proba) {
    var p = P(nom), g = p && p.groupe ? groupeParNom(p.groupe) : null;
    if (!g) return [];
    if (g.nom === "Parfum") {
      var n = nom.indexOf("3") >= 0 ? 3 : 2, l = [];
      for (var k = 0; k < n; k++) { var o = pondere(r, g.options, g.poids); l.push({ nom: o[0], groupe: g.nom, prix: o[1] }); }
      return l;
    }
    if (g.nom === "Cuisson" || g.nom === "Sirop") { var c = pondere(r, g.options, g.poids); return [{ nom: c[0], groupe: g.nom, prix: c[1] }]; }
    if (r() < (proba || 0.15)) { var s = pondere(r, g.options, g.poids); return [{ nom: s[0], groupe: g.nom, prix: s[1] }]; }
    return [];
  }
  function parFamille(f) { return PRODUITS.filter(function (p) { return p.famille === f; }); }
  var POIDS_PRODUITS = {
    chaud: { "Café": 45, "Café crème": 18, "Cappuccino": 10, "Thé": 8, "Infusion": 4, "Chocolat chaud": 10, "Chocolat viennois": 5 },
    soft: { "Jus de pomme 25cl": 6, "Jus d'orange pressé": 4, "Limonade": 6, "Diabolo": 4, "Cola 33cl": 6, "Eau gazeuse 50cl": 3 },
    biere: { "Blonde pression 25cl": 5, "Blonde pression 50cl": 3, "IPA pression 25cl": 2, "Bière bretonne 33cl": 3 },
    bolee: { "Bolée de cidre brut": 6, "Bolée de cidre doux": 4 }, cidre: { "Cidre brut 75cl": 6, "Cidre doux 75cl": 4 },
    vinVerre: { "Rouge verre 12cl": 5, "Blanc verre 12cl": 4 }, vinBouteille: { "Rouge bouteille 75cl": 5, "Blanc bouteille 75cl": 4 },
    apero: { "Kir breton": 6, "Crémant verre 12cl": 3 },
    galette: { "Complète": 14, "Jambon fromage": 9, "Végétarienne": 5, "Chèvre miel": 7, "Forestière": 6, "Océane": 5, "Andouille de Guémené": 4, "Galette saucisse": 4 },
    crepe: { "Crêpe beurre sucre": 9, "Crêpe citron": 4, "Crêpe chocolat maison": 9, "Crêpe caramel beurre salé": 10, "Crêpe pommes caramel": 4, "Crêpe banane chocolat": 4 },
    plat: { "Burger maison": 8, "Burger végé": 2, "Salade bretonne": 5, "Assiette du jour": 6 },
    patisserie: { "Fondant chocolat": 5, "Far breton": 5, "Kouign-amann": 4, "Tarte du jour": 3 },
    glace: { "Coupe 2 boules": 6, "Coupe 3 boules": 3 }
  };
  function unDe(r, famille) { var t = POIDS_PRODUITS[famille], n = Object.keys(t); return pondere(r, n, n.map(function (k) { return t[k]; })); }
  // Une formule : composants au prorata de leur prix carte, total = prix de la formule
  function formule(r, items, menus, f) {
    var noms = f.choix.map(function (l, i) { return pondere(r, l, f.poids[i]); }), carte = 0;
    noms.forEach(function (n) { carte += P(n).prix; });
    var reste = f.prix;
    noms.forEach(function (n, i) {
      var px = i === noms.length - 1 ? arrondi(reste) : arrondi(P(n).prix * f.prix / carte);
      reste -= px;
      ajouter(items, n, 1, options(r, n, 0), px, f.nom);
    });
    menus.push({ nom: f.nom, montant: f.prix });
  }
  // Ce que commande une table, selon le moment de la journée et la météo
  function remplir(r, c, service, cmd) {
    var items = cmd.items, menus = cmd.menus, n = cmd.couverts, i, emporter = cmd.salle === "À emporter";
    if (emporter) {
      var nb = entre(r, 1, 3);
      for (i = 0; i < nb; i++) {
        var choix = pondere(r, ["saucisse", "galette", "crepe", "boisson", "epicerie"], [service === "midi" ? 6 : 3, 3, 4 * c.crepe, 3, 0.8]);
        if (choix === "saucisse") ajouter(items, "Galette saucisse", entre(r, 1, 2));
        else if (choix === "galette") { var g = unDe(r, "galette"); ajouter(items, g, 1, options(r, g, 0.1)); }
        else if (choix === "crepe") { var cr = unDe(r, "crepe"); ajouter(items, cr, 1, options(r, cr, 0.1)); }
        else if (choix === "boisson") ajouter(items, pondere(r, ["Cola 33cl", "Jus de pomme 25cl", "Eau gazeuse 50cl", "Cidre brut 75cl"], [5, 4, 2, 1]), 1);
        else ajouter(items, "Pot de caramel 220g", 1);
      }
      if (service === "matin" && r() < 0.6) ajouter(items, pondere(r, ["Café", "Cappuccino", "Thé"], [6, 3, 1]), 1);
      return;
    }
    if (service === "matin") {
      for (i = 0; i < n; i++) {
        if (r() < 0.88) ajouter(items, unDe(r, "chaud"), 1); else ajouter(items, "Jus d'orange pressé", 1);
        if (r() < 0.3) { var cm = pondere(r, ["Crêpe beurre sucre", "Crêpe citron", "Crêpe chocolat maison", "Kouign-amann"], [5, 2, 3, 2]); ajouter(items, cm, 1); }
        if (r() < 0.12) ajouter(items, "Jus d'orange pressé", 1);
      }
      return;
    }
    if (service === "aprem") {
      for (i = 0; i < n; i++) {
        var d = pondere(r, ["crepe", "glace", "patisserie", "rien"], [6 * c.crepe, 2.5 * c.glace, 1.5, 1.2]);
        if (d === "crepe") { var x = unDe(r, "crepe"); ajouter(items, x, 1, options(r, x, 0.25)); }
        else if (d === "glace") { var gl = unDe(r, "glace"); ajouter(items, gl, 1, options(r, gl)); }
        else if (d === "patisserie") ajouter(items, unDe(r, "patisserie"), 1);
        var b = pondere(r, ["chaud", "soft", "bolee", "biere", "sirop"], [4 * c.chaud, 3, 2.5, 1.5, 0.6]);
        if (b === "sirop") ajouter(items, "Sirop à l'eau", 1, options(r, "Sirop à l'eau"));
        else { var bb = unDe(r, b); ajouter(items, bb, 1, options(r, bb)); }
      }
      if (n >= 2 && r() < 0.06) ajouter(items, "Galette saucisse", 1);
      return;
    }
    // Midi et soir : repas
    var soir = service === "soir", enfants = n >= 3 && r() < (c.js === 0 || c.js === 6 || c.ete ? 0.35 : 0.12) ? entre(r, 1, Math.min(2, n - 1)) : 0;
    if (soir && r() < 0.18) for (i = 0; i < Math.max(1, n - entre(r, 0, 1)); i++) ajouter(items, unDe(r, pondere(r, ["apero", "biere"], [3, 2])), 1);
    var bouteille = n >= 2 && r() < (soir ? 0.32 : 0.16), vinB = n >= 3 && soir && r() < 0.14;
    if (bouteille) ajouter(items, unDe(r, "cidre"), Math.max(1, Math.round(n / 3)));
    if (vinB) ajouter(items, unDe(r, "vinBouteille"), 1);
    for (i = 0; i < n; i++) {
      if (i < enfants) { formule(r, items, menus, FORMULES[1]); continue; }
      if (!soir && c.semaine && r() < 0.32) { formule(r, items, menus, FORMULES[0]); if (r() < 0.3) ajouter(items, "Café", 1); continue; }
      if (r() < (soir ? 0.72 : 0.7)) { var gal = unDe(r, "galette"); ajouter(items, gal, 1, options(r, gal, 0.18)); if (r() < 0.08) ajouter(items, "Frites", 1); }
      else { var pl = unDe(r, "plat"); ajouter(items, pl, 1, options(r, pl)); if (pl.indexOf("Burger") === 0 || r() < 0.1) ajouter(items, "Frites", r() < 0.15 ? 1 : 0); }
      if (!bouteille && !vinB) {
        var boi = pondere(r, ["bolee", "soft", "eau", "biere", "vinVerre"], [soir ? 3.5 : 3.2, 2.6, soir ? 1.2 : 1.6, 1.2 * (c.ete ? 1.5 : 1), soir ? 1.6 : 0.9]);
        if (boi === "eau") ajouter(items, "Carafe d'eau", 1); else { var bo = unDe(r, boi); ajouter(items, bo, 1, options(r, bo)); }
      } else if (r() < 0.25) ajouter(items, "Carafe d'eau", 1);
      var des = pondere(r, ["crepe", "glace", "patisserie", "flambee", "rien"], [soir ? 5.8 : 4.6, 1 * c.glace, 1.1, soir ? 0.5 : 0.1, soir ? 3 : 4.2]);
      if (des === "crepe") { var cp = unDe(r, "crepe"); ajouter(items, cp, 1, options(r, cp, 0.2)); }
      else if (des === "glace") { var co = unDe(r, "glace"); ajouter(items, co, 1, options(r, co)); }
      else if (des === "patisserie") ajouter(items, unDe(r, "patisserie"), 1);
      else if (des === "flambee") ajouter(items, "Crêpe flambée", 1);
      if (r() < (soir ? 0.2 : 0.33)) ajouter(items, pondere(r, ["Café", "Café crème", "Thé", "Infusion"], [8, 1, 1, 1.5 * c.chaud]), 1);
      if (soir && r() < 0.04) ajouter(items, "Chouchen 6cl", 1);
    }
    for (i = items.length - 1; i >= 0; i--) if (!items[i].q) items.splice(i, 1);
    if (!soir && r() < 0.02) ajouter(items, "Pot de caramel 220g", 1);
  }

  var LETTRES = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  function reference(r, n) { var s = ""; for (var i = 0; i < n; i++) s += LETTRES.charAt(Math.floor(r() * LETTRES.length)); return s; }
  // Règlement : mode(s) de paiement et pourboires
  function regler(r, c, service, cmd) {
    var t = cmd.total;
    cmd.pourboire = 0;
    if (t <= 0) { cmd.paiements = [{ nom: "Espèces", montant: 0, pourboire: 0 }]; cmd.paiement = "Espèces"; return; }
    if (cmd.enLigne) { cmd.paiements = [{ nom: "Paiement en ligne", montant: t, pourboire: 0 }]; cmd.paiement = "Paiement en ligne"; return; }
    var midiSemaine = service === "midi" && c.semaine;
    var petit = t < 10;
    var mode = pondere(r, ["Carte de crédit", "Espèces", "Chèque", "Titre restaurant", "Chèque Vacances", "Cagnotte", "Virement"],
      [petit ? 55 : 66, petit ? 40 : 11, petit ? 0 : 1.2, midiSemaine ? 15 : 0.4, c.ete ? 5 : 0.6, petit ? 0 : 1, t > 150 ? 30 : 0]);
    var pays = [];
    if (mode === "Titre restaurant") {
      var tr = Math.min(t, arrondi(cmd.couverts * pondere(r, [9, 10, 11, 12, 13.5], [2, 3, 3, 2, 1]) * Math.min(1.6, entre(r, 1, 2))));
      pays.push({ nom: "Titre restaurant", montant: tr });
      if (t - tr > 0.009) pays.push({ nom: "Carte de crédit", montant: arrondi(t - tr) });
    } else if (cmd.couverts >= 3 && mode === "Carte de crédit" && r() < 0.16) {
      var parts = Math.min(cmd.couverts, entre(r, 2, 3)), base = arrondi(t / parts), reste = t;
      for (var k = 0; k < parts; k++) {
        var m = k === parts - 1 ? arrondi(reste) : base;
        reste -= m;
        pays.push({ nom: k === 1 && r() < 0.25 ? "Espèces" : "Carte de crédit", montant: m });
      }
    } else pays.push({ nom: mode, montant: t });
    var proba = service === "soir" ? 0.14 : service === "midi" ? 0.07 : 0.03;
    pays.forEach(function (pa) {
      pa.pourboire = 0;
      if (pa.nom === "Carte de crédit" && r() < proba) {
        pa.pourboire = cmd.couverts >= 4 ? arrondi(Math.max(2, Math.round(pa.montant * pondere(r, [0.05, 0.08, 0.1], [3, 2, 1])))) : pondere(r, [0.5, 1, 1.5, 2, 3, 5], [2, 4, 2, 4, 2, 1]);
        cmd.pourboire = arrondi(cmd.pourboire + pa.pourboire);
      }
    });
    cmd.paiements = pays;
    cmd.paiement = pays.slice().sort(function (a, b) { return b.montant - a.montant; })[0].nom;
  }

  // Une commande complète (statut, annulations, remise, règlement)
  function commande(r, c, service, min, salle, numTable, emp, id) {
    var s = salleParNom(salle);
    var couverts = salle === "À emporter" ? 0 : salle === "Comptoir" ? pondere(r, [0, 1, 2], [6, 3, 1]) :
      service === "matin" ? pondere(r, [1, 2, 3], [70, 25, 5]) : service === "aprem" ? pondere(r, [1, 2, 3, 4], [30, 45, 15, 10]) :
        service === "midi" ? pondere(r, [1, 2, 3, 4, 5, 6, 8], [16, 40, 16, 15, 5, 6, 2]) : pondere(r, [1, 2, 3, 4, 5, 6, 8, 10], [5, 44, 14, 18, 6, 8, 3, 2]);
    var cmd = {
      id: id, date: c.iso, min: min, salle: salle, table: salle === "À emporter" ? "E" + numTable : s.prefixe + entre(r, 1, s.tables),
      emp: emp, couverts: couverts, items: [], annules: [], menus: [], remise: null, statut: "paid", client: null, enLigne: null
    };
    if (salle === "À emporter" && r() < 0.35) {
      cmd.enLigne = { ref: "CC-" + reference(r, 6), canal: "Click & Collect", commandeA: Math.max(OUVRE, min - entre(r, 12, 70)) };
      cmd.emp = "Commande en ligne";
    }
    remplir(r, c, service, cmd);
    if (!cmd.items.length) ajouter(cmd.items, "Café", 1);
    if (r() < 0.012 && !cmd.enLigne) {
      cmd.statut = "cancelled";
      cmd.annules = cmd.items.map(function (x) { return { p: x.p, q: x.q, prix: x.prix, motif: pondere(r, ["Client a changé d'avis", "Faute de frappe"], [3, 2]), apres: false }; });
      cmd.items = []; cmd.menus = [];
    } else if (r() < 0.05 && cmd.items.length > 1) {
      var idx = entre(r, 0, cmd.items.length - 1), a = cmd.items[idx];
      if (!a.menu) {
        cmd.annules.push({ p: a.p, q: 1, prix: a.prix, motif: pondere(r, MOTIFS_ANNULATION, MOTIFS_ANNULATION.map(function (m) { return m[1]; }))[0], apres: r() < 0.06 });
        if (a.q > 1) a.q--; else cmd.items.splice(idx, 1);
      }
    }
    var brut = 0;
    cmd.items.forEach(function (x) { brut += totalItem(x); });
    if (cmd.statut === "paid" && cmd.items.length && !cmd.enLigne && r() < 0.04) {
      var rem = pondere(r, REMISES, [3, 4, 1, 3]), montant;
      if (rem.nom === "Offert") { var cible = cmd.items[cmd.items.length - 1]; montant = Math.min(brut, arrondi(cible.prix)); }
      else montant = rem.type === "percentage" ? arrondi(brut * rem.valeur / 100) : Math.min(brut, rem.valeur);
      if (montant > 0) cmd.remise = { nom: rem.nom, montant: montant };
    }
    cmd.total = cmd.statut === "paid" ? arrondi(brut - (cmd.remise ? cmd.remise.montant : 0)) : 0;
    if (cmd.statut === "paid") regler(r, c, service, cmd);
    else { cmd.paiements = []; cmd.paiement = "Non réglé"; cmd.pourboire = 0; }
    return cmd;
  }

  // ======================================================================
  // Génération d'une journée (graine propre à la date)
  // ======================================================================
  var SALLES_SERVICE = {
    matin: [["Comptoir", 45], ["Salle", 25], ["Terrasse", 20], ["À emporter", 15], ["Véranda", 5]],
    midi: [["Salle", 52], ["Véranda", 12], ["Terrasse", 22], ["Comptoir", 6], ["À emporter", 12]],
    aprem: [["Salle", 30], ["Terrasse", 35], ["Comptoir", 18], ["Véranda", 8], ["À emporter", 12]],
    soir: [["Salle", 60], ["Véranda", 15], ["Terrasse", 18], ["Comptoir", 5], ["À emporter", 6]]
  };
  function choisirSalle(r, c, service) {
    var l = SALLES_SERVICE[service];
    return pondere(r, l.map(function (x) { return x[0]; }), l.map(function (x) { return x[0] === "Terrasse" ? x[1] * c.terrasse : x[1]; }));
  }
  function equipe(r) {
    var dispo = SERVEURS.slice(), choisis = [];
    for (var i = 0; i < 4; i++) choisis.push(dispo.splice(Math.floor(r() * dispo.length), 1)[0]);
    return choisis;
  }
  function serviceDe(min) { return min < 690 ? "matin" : min < 900 ? "midi" : min < 1110 ? "aprem" : "soir"; }

  var CACHE = {}, ORDRE_CACHE = [], RESUMES = {};
  function genererJour(iso) {
    var c = contexte(iso), r = graine("cmd|" + iso), cmds = [];
    var midi = equipe(r), soir = equipe(r), numEmporter = 0;
    SERVICES.forEach(function (sv, k) {
      var cible = c.total * c.parts[k], cumul = 0, garde = 0;
      var staff = sv.cle === "soir" || sv.cle === "aprem" ? soir.concat(["Gérant"]) : midi.concat(["Gérant"]);
      while (cumul < cible && garde++ < 400) {
        var min = Math.round(triangle(r, sv.de, sv.a, sv.pic)), salle = choisirSalle(r, c, sv.cle);
        if (salle === "À emporter") numEmporter++;
        var cmd = commande(r, c, sv.cle, min, salle, numEmporter, pondere(r, staff, staff.map(function (x) { return x === "Gérant" ? 1 : 3; })), "");
        cmds.push(cmd); cumul += cmd.total;
      }
    });
    cmds.sort(function (a, b) { return a.min - b.min; });
    var cle = iso.replace(/-/g, "");
    cmds.forEach(function (x, i) { x.id = "c" + cle + "-" + ("00" + (i + 1)).slice(-3); x.numero = i + 1; });
    // Clients qui viennent ce jour-là : rattachés à une table du midi ou du soir
    var rc = graine("clients|" + iso), libres = cmds.filter(function (x) { return x.statut === "paid" && x.min >= 700 && x.salle !== "À emporter" && x.salle !== "Comptoir"; });
    (VISITES[iso] || []).forEach(function (kid) {
      if (!libres.length) return;
      var cmd = libres.splice(Math.floor(rc() * libres.length), 1)[0];
      cmd.client = kid;
      if (IMPAYES[iso + "|" + kid]) { cmd.paiements = [{ nom: "Compte client", montant: cmd.total, pourboire: 0 }]; cmd.paiement = "Compte client"; cmd.pourboire = 0; cmd.impaye = true; }
    });
    var ouverture = 465 + entre(r, 0, 12), derniere = cmds.length ? cmds[cmds.length - 1].min : FERME;
    return {
      date: iso, numero: ecartJours(OUVERTURE, iso) + 1, ouvertureMin: ouverture, fermetureMin: Math.max(FERME + entre(r, 4, 14), derniere + entre(r, 6, 18)),
      fondInitial: 150, commandes: cmds, pertes: genererPertes(iso)
    };
  }
  // Pertes déclarées en caisse (produit, motif) : pâtisseries en fin de journée, casse, plus rarement vol
  function genererPertes(iso) {
    var r = graine("pertes|" + iso), l = [];
    var n = r() < 0.35 ? 1 : 0; if (r() < 0.12) n++;
    for (var i = 0; i < n; i++) {
      var motif = pondere(r, ["DLC dépassée", "Casse", "Vol", "Autre"], [6, 4, 0.6, 1]), nom, q = 1, min;
      if (motif === "DLC dépassée") { nom = choisir(r, ["Far breton", "Tarte du jour", "Fondant chocolat", "Kouign-amann", "Jus d'orange pressé"]); q = entre(r, 1, 3); min = entre(r, 1350, 1376); }
      else if (motif === "Casse") { nom = choisir(r, ["Cidre brut 75cl", "Cidre doux 75cl", "Rouge bouteille 75cl", "Bière bretonne 33cl", "Cola 33cl", "Pot de caramel 220g"]); min = entre(r, 600, 1360); }
      else if (motif === "Vol") { nom = choisir(r, ["Bière bretonne 33cl", "Pot de caramel 220g"]); min = entre(r, 900, 1300); }
      else { nom = choisir(r, ["Jus de pomme 25cl", "Eau gazeuse 50cl", "Crêpe beurre sucre"]); min = entre(r, 700, 1300); }
      var p = P(nom);
      l.push({ id: "x" + iso.replace(/-/g, "") + "-" + (i + 1), date: iso, min: min, p: p.id, q: q, motif: motif, emp: choisir(r, SERVEURS), montant: arrondi(p.prix * q) });
    }
    return l;
  }
  function jourComplet(iso) {
    var j = CACHE[iso];
    if (j) return j;
    j = CACHE[iso] = genererJour(iso);
    ORDRE_CACHE.push(iso);
    if (ORDRE_CACHE.length > 240) { var vieux = ORDRE_CACHE.shift(); if (vieux !== AUJ_ISO) delete CACHE[vieux]; }
    return j;
  }

  // ======================================================================
  // Aujourd'hui : on ne voit que ce qui est déjà encaissé, plus les encaissements de démo de ce navigateur
  // ======================================================================
  var CLE_DIRECT = "direct-" + AUJ_ISO;
  var DIRECT = S.lire(CLE_DIRECT, null) || { liste: [], dernier: 0 };
  (function () { // nettoyage des jours précédents
    var j = decaler(AUJ_ISO, -1); S.retirer("direct-" + j); S.retirer("direct-" + decaler(AUJ_ISO, -2));
  })();
  function jourVisible(iso) {
    if (iso < OUVERTURE || iso > AUJ_ISO) return null;
    var j = jourComplet(iso);
    if (iso < AUJ_ISO) return j;
    var now = maintenantMin();
    var cmds = j.commandes.filter(function (c) { return c.min <= now; }).concat(DIRECT.liste).sort(function (a, b) { return a.min - b.min || (a.seq || 0) - (b.seq || 0); });
    return {
      date: iso, numero: j.numero, ouvertureMin: j.ouvertureMin, fermetureMin: j.fermetureMin, fondInitial: j.fondInitial, commandes: cmds,
      pertes: j.pertes.filter(function (x) { return x.min <= now; }), enCours: now >= j.ouvertureMin && now < j.fermetureMin, ouverte: now >= j.ouvertureMin
    };
  }
  function caisseCloturee(iso) {
    if (iso < AUJ_ISO) return true;
    if (iso > AUJ_ISO) return false;
    return maintenantMin() >= jourComplet(iso).fermetureMin;
  }
  var MAX_DEMO = 80;
  // Ajoute n encaissements « maintenant » (démonstration, propres à ce navigateur). Renvoie les commandes créées.
  function ajouterEncaissementsDemo(n) {
    var now = maintenantMin();
    if (now < OUVRE || now >= FERME || DIRECT.liste.length >= MAX_DEMO) return [];
    var c = contexte(AUJ_ISO), r = generateur(hash(String(Date.now()) + "|" + Math.random())), service = serviceDe(now), crees = [];
    var staff = jourComplet(AUJ_ISO).commandes.filter(function (x) { return serviceDe(x.min) === service; }).map(function (x) { return x.emp; }).filter(function (e) { return e !== "Commande en ligne"; });
    if (!staff.length) staff = ["Gérant"];
    for (var i = 0; i < n && DIRECT.liste.length < MAX_DEMO; i++) {
      var salle = choisirSalle(r, c, service), num = 100 + DIRECT.liste.length;
      var cmd = commande(r, c, service, now, salle, num, choisir(r, staff), "d" + AUJ_ISO.replace(/-/g, "") + "-" + (DIRECT.liste.length + 1));
      if (cmd.statut !== "paid") { cmd.statut = "paid"; continue; }
      cmd.seq = Date.now() + i; cmd.demo = true; cmd.numero = 900 + DIRECT.liste.length;
      DIRECT.liste.push(cmd); crees.push(cmd);
    }
    DIRECT.dernier = Date.now();
    S.ecrire(CLE_DIRECT, DIRECT);
    return crees;
  }
  // Encaissements arrivés depuis un instant donné (commandes de la journée + démo) : pour les notifications
  function encaissementsDepuis(minDepuis, seqDepuis) {
    var now = maintenantMin(), j = jourComplet(AUJ_ISO);
    var base = j.commandes.filter(function (c) { return c.statut === "paid" && c.min > minDepuis && c.min <= now; });
    var demo = DIRECT.liste.filter(function (c) { return (c.seq || 0) > (seqDepuis || 0); });
    return copie(base.concat(demo).sort(function (a, b) { return a.min - b.min; }));
  }

  // ======================================================================
  // Agrégats
  // ======================================================================
  function joursEntre(p) {
    var d1 = p.dateStart < OUVERTURE ? OUVERTURE : p.dateStart, d2 = p.dateEnd > AUJ_ISO ? AUJ_ISO : p.dateEnd, l = [];
    var iso = d1;
    while (iso <= d2) { l.push(iso); iso = decaler(iso, 1); }
    return l;
  }
  var DOW = {};
  function jourSemaine(iso) { return DOW[iso] !== undefined ? DOW[iso] : (DOW[iso] = date(iso).getDay()); }
  function jourOk(iso, p) { return !p.jours || p.jours.indexOf(jourSemaine(iso)) >= 0; }
  function heureOk(c, p) { return (p.h1 == null || c.min >= p.h1) && (p.h2 == null || c.min < p.h2); }
  function commandesDe(p) {
    var out = [];
    joursEntre(p).forEach(function (iso) {
      if (!jourOk(iso, p)) return;
      var j = jourVisible(iso);
      if (!j) return;
      j.commandes.forEach(function (c) { if (heureOk(c, p)) out.push(c); });
    });
    return out;
  }
  function payees(p) { return commandesDe(p).filter(function (c) { return c.statut === "paid"; }); }
  function produitParId(id) { return PAR_ID[id] || AJOUTS_PRODUITS()[id] || { id: id, nom: "Produit", categorie: "Divers", sousCategorie: "Divers", tva: 10, prix: 0, couleur: "#888" }; }
  function ht(ttc, tva) { return ttc / (1 + tva / 100); }
  function paiementsDe(c) { return c.paiements || [{ nom: c.paiement, montant: c.total, pourboire: 0 }]; }
  function typePrix(c) { return c.salle === "Terrasse" ? "Terrasse" : c.salle === "Comptoir" ? "Comptoir" : c.salle === "À emporter" ? "À emporter" : "Normal"; }
  // Lignes de ventes (une ligne par produit commandé), remise répartie au prorata
  function lignesVentes(cmds) {
    var out = [];
    cmds.forEach(function (c) {
      var brut = 0; c.items.forEach(function (x) { brut += totalItem(x); });
      var coef = brut > 0 ? (brut - (c.remise ? c.remise.montant : 0)) / brut : 1;
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
  // Résumé d'une journée (gardé en mémoire pour les jours passés)
  function resume(iso) {
    if (iso < AUJ_ISO && RESUMES[iso]) return RESUMES[iso];
    var j = jourVisible(iso);
    if (!j) return { date: iso, ttc: 0, ht: 0, couverts: 0, n: 0, midi: { ttc: 0, couverts: 0 }, soir: { ttc: 0, couverts: 0 }, ventes: {} };
    var paye = j.commandes.filter(function (c) { return c.statut === "paid"; }), t = totaux(paye);
    var m = totaux(paye.filter(function (c) { return c.min < 960; })), s = totaux(paye.filter(function (c) { return c.min >= 960; })), ventes = {};
    paye.forEach(function (c) { c.items.forEach(function (x) { ventes[x.p] = (ventes[x.p] || 0) + x.q; }); });
    var o = { date: iso, ttc: t.ttc, ht: t.ht, couverts: t.couverts, n: t.n, midi: { ttc: m.ttc, couverts: m.couverts }, soir: { ttc: s.ttc, couverts: s.couverts }, ventes: ventes };
    if (iso < AUJ_ISO) RESUMES[iso] = o;
    return o;
  }
  function nomsCats() { return CATEGORIES.map(function (c) { return c.nom; }); }

  // ======================================================================
  // API : accueil, commandes
  // ======================================================================
  function getHomePage() {
    var jours = [];
    for (var i = 21; i >= 0; i--) {
      var iso = decaler(AUJ_ISO, -i), s = resume(iso);
      jours.push({ date: iso, turnover: s.ttc, turnoverHT: s.ht, guestCount: s.couverts, orderCount: s.n, averageGuest: s.couverts ? arrondi(s.ttc / s.couverts) : 0,
        midi: { turnover: s.midi.ttc, guestCount: s.midi.couverts }, soir: { turnover: s.soir.ttc, guestCount: s.soir.couverts } });
    }
    var j = jourComplet(AUJ_ISO), now = maintenantMin(), il7 = decaler(AUJ_ISO, -7);
    // Pour la journée en cours : la même journée la semaine dernière, arrêtée à la même heure
    if (il7 >= OUVERTURE) {
      var cm = jourComplet(il7).commandes.filter(function (c) { return c.statut === "paid" && c.min <= now; }), t7 = totaux(cm);
      jours[jours.length - 8].parHeure = { turnover: t7.ttc, turnoverHT: t7.ht, guestCount: t7.couverts, averageGuest: t7.couverts ? arrondi(t7.ttc / t7.couverts) : 0 };
    }
    return reponse({ jours: jours, maintenant: now, ouvertureMin: OUVRE, fermetureMin: FERME, caisseOuverteA: hhmm(j.ouvertureMin), avantOuverture: now < OUVRE });
  }
  // Derniers encaissements du jour (fil en direct de l'accueil)
  function getDerniersEncaissements(n, iso) {
    var j = jourVisible(iso || AUJ_ISO), l = j ? j.commandes.filter(function (c) { return c.statut === "paid"; }) : [];
    return reponse(l.slice(-(n || 6)).reverse().map(function (c) {
      return { id: c.id, heure: hhmm(c.min), salle: c.salle, table: c.table, total: c.total, paiement: c.paiement, couverts: c.couverts, demo: !!c.demo, enLigne: !!c.enLigne,
        resume: c.items.slice(0, 3).map(function (x) { return produitParId(x.p).nom; }).join(", ") + (c.items.length > 3 ? "…" : "") };
    }));
  }
  function getTopProduitsJour(iso, n) {
    var l = lignesVentes(payees({ dateStart: iso, dateEnd: iso })), o = {};
    l.forEach(function (x) { var e = o[x.prod.nom] = o[x.prod.nom] || { name: x.prod.nom, category: x.prod.categorie, couleur: x.prod.couleur, quantity: 0, total: 0 }; e.quantity += x.q; e.total += x.ttc; });
    return reponse(Object.keys(o).map(function (k) { o[k].total = arrondi(o[k].total); return o[k]; }).filter(function (e) { return e.total > 0; })
      .sort(function (a, b) { return b.quantity - a.quantity; }).slice(0, n || 5));
  }

  function getOrders(f) {
    f = f || {};
    var p = { dateStart: f.dateStart, dateEnd: f.dateEnd }, q = String(f.recherche || "").trim().toLowerCase();
    var liste = commandesDe(p).filter(function (c) {
      if (f.paiement && paiementsDe(c).every(function (x) { return x.nom !== f.paiement; }) && c.paiement !== f.paiement) return false;
      if (f.statut && c.statut !== f.statut) return false;
      if (f.salle && c.salle !== f.salle) return false;
      if (f.employe && c.emp !== f.employe) return false;
      if (q && f.critere === "table" && String(c.table).toLowerCase().indexOf(q) < 0) return false;
      if (q && f.critere === "produit" && !c.items.concat(c.annules).some(function (x) { return produitParId(x.p).nom.toLowerCase().indexOf(q) >= 0; })) return false;
      return true;
    });
    var jours = {};
    liste.forEach(function (c) { (jours[c.date] = jours[c.date] || []).push(c); });
    var res = Object.keys(jours).sort().reverse().map(function (d) {
      var cm = jours[d].slice().sort(function (a, b) { return b.min - a.min || (b.seq || 0) - (a.seq || 0); }), z = jourComplet(d), cloture = caisseCloturee(d);
      return {
        date: d, ouvertA: hhmm(z.ouvertureMin), fermeA: cloture ? hhmm(z.fermetureMin) : null,
        commandes: cm.map(function (c) {
          return {
            id: c.id, heure: hhmm(c.min), statut: c.statut, total: c.total, paiement: c.paiement, salle: c.salle, table: c.table, enLigne: !!c.enLigne, demo: !!c.demo,
            produits: c.items.map(function (x) { return { nom: produitParId(x.p).nom, annule: false }; }).concat(c.annules.map(function (a) { return { nom: produitParId(a.p).nom, annule: true }; }))
          };
        })
      };
    });
    return reponse({
      jours: res,
      filtres: {
        paiements: MODES_PAIEMENT.map(function (m) { return m.nom; }), salles: SALLES.filter(function (s) { return s.actif; }).map(function (s) { return s.nom; }),
        employes: EMPLOYES.map(function (e) { return e.name; }).concat(["Commande en ligne"])
      }
    });
  }
  function trouverCommande(id) {
    var m = /^[cd](\d{4})(\d{2})(\d{2})-/.exec(id || "");
    if (!m) return null;
    var j = jourVisible(m[1] + "-" + m[2] + "-" + m[3]);
    return j ? j.commandes.filter(function (x) { return x.id === id; })[0] || null : null;
  }
  function getOrderById(id) {
    var c = trouverCommande(id);
    if (!c) return reponse(null);
    var lignes = c.items.map(function (x) {
      var p = produitParId(x.p);
      return { quantite: x.q, produit: p.nom, prix: totalItem(x), options: x.opts.map(function (o) { return o.nom; }), menu: x.menu || "" };
    });
    var cl = c.client ? CLIENT_PAR_ID[c.client] : null;
    return reponse({
      id: c.id, date: c.date, heure: hhmm(c.min), salle: c.salle, table: c.table, total: c.total, serveur: c.emp, couverts: c.couverts, statut: c.statut, lignes: lignes,
      annules: c.annules.map(function (a) { return { quantite: a.q, produit: produitParId(a.p).nom, motif: a.motif }; }),
      paiement: c.paiement, paiements: paiementsDe(c), pourboire: c.pourboire || 0, remise: c.remise, menus: c.menus || [],
      client: cl ? { id: cl.id, nom: cl.name } : null, impaye: !!c.impaye,
      enLigne: c.enLigne ? { ref: c.enLigne.ref, canal: c.enLigne.canal, commandeA: hhmm(c.enLigne.commandeA), montant: c.total } : null,
      numeroFiscal: "F" + c.date.replace(/-/g, "") + "-" + ("00" + (c.numero || 0)).slice(-3)
    });
  }

  // ======================================================================
  // API : rapports
  // ======================================================================
  function getReportTotalSales(p) {
    var jours = [], iso = p.dateStart, occurrences = 0, ouverts = 0, tot = { ttc: 0, ht: 0, couverts: 0, n: 0 }, tills = 0;
    var tranche = p.jours || p.h1 != null || p.h2 != null;
    while (iso <= p.dateEnd) {
      if (jourOk(iso, p)) {
        var t;
        if (tranche) t = totaux(payees({ dateStart: iso, dateEnd: iso, h1: p.h1, h2: p.h2 }));
        else { var s = resume(iso); t = { ttc: s.ttc, ht: s.ht, couverts: s.couverts, n: s.n }; }
        jours.push({ date: iso, totalSales: t.ttc, totalSalesWithoutTaxes: t.ht });
        if (iso <= AUJ_ISO && iso >= OUVERTURE) occurrences++;
        if (t.n) { ouverts++; if (caisseCloturee(iso)) tills++; }
        tot.ttc += t.ttc; tot.ht += t.ht; tot.couverts += t.couverts; tot.n += t.n;
      }
      iso = decaler(iso, 1);
    }
    tot.ttc = arrondi(tot.ttc); tot.ht = arrondi(tot.ht);
    return reponse({
      occurrences: occurrences, joursOuverts: ouverts, totalSales: tot.ttc, totalSalesWithoutTaxes: tot.ht, guestsNumber: tot.couverts, orderCount: tot.n,
      averageGuest: tot.couverts ? arrondi(tot.ttc / tot.couverts) : 0, closedTillsCount: tills, reportFromPeriod: jours
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
    return reponse(Object.keys(o).map(function (k) { return { name: k, totalSalesOwner: arrondi(o[k]) }; }).sort(function (a, b) { return b.totalSalesOwner - a.totalSalesOwner; }));
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
      e.pricingList = Object.keys(e.pricing).map(function (z) { var r = e.pricing[z]; r.sales = arrondi(r.sales); r.excludingTax = arrondi(r.excludingTax); return r; })
        .sort(function (a, b) { return b.sales - a.sales; });
      delete e.pricing; e.establishment = SITES[0].name; return e;
    }).sort(function (a, b) { return b.netAmount - a.netAmount; });
    var tot = { quantity: 0, excludingTax: 0, netAmount: 0 };
    items.forEach(function (e) { tot.quantity += e.quantity; tot.excludingTax += e.excludingTax; tot.netAmount += e.netAmount; });
    tot.excludingTax = arrondi(tot.excludingTax); tot.netAmount = arrondi(tot.netAmount);
    var vendus = items.filter(function (e) { return e.netAmount > 0; });
    return reponse({
      totals: tot, items: items, topFive: vendus.slice(0, 5),
      flopFive: vendus.slice().sort(function (a, b) { return a.netAmount - b.netAmount; }).slice(0, 5),
      parQuantite: items.slice().sort(function (a, b) { return b.quantity - a.quantity; }).slice(0, 5)
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
    return reponse(Object.keys(o).map(function (k) { o[k].totalAmount = arrondi(o[k].totalAmount); return o[k]; }).sort(function (a, b) { return b.totalQuantity - a.totalQuantity; }));
  }
  function pertesDe(p) {
    var l = [];
    joursEntre(p).forEach(function (iso) {
      if (!jourOk(iso, p)) return;
      var j = jourVisible(iso);
      if (j) j.pertes.forEach(function (x) { if (heureOk(x, p)) l.push(x); });
    });
    return l;
  }
  function getEmployees(p) {
    var o = {};
    function e0(n) { return o[n] = o[n] || { operatorName: n, operatorTotalOrderSales: 0, operatorTotalCashed: 0, operatorOrderCount: 0, operatorGuestCount: 0, operatorTotalDiscount: 0, operatorTotalDiscountQuantity: 0, operatorTotalTips: 0, operatorTotalCanceled: 0, operatorTotalCanceledQuantity: 0, operatorTotalLoss: 0, operatorTotalLossQuantity: 0 }; }
    commandesDe(p).forEach(function (c) {
      var e = e0(c.emp);
      if (c.statut === "paid") {
        e.operatorTotalOrderSales += c.total; e.operatorTotalCashed += c.total + (c.pourboire || 0); e.operatorOrderCount++; e.operatorGuestCount += c.couverts; e.operatorTotalTips += c.pourboire || 0;
        if (c.remise) { e.operatorTotalDiscount += c.remise.montant; e.operatorTotalDiscountQuantity++; }
      }
      c.annules.forEach(function (a) { e.operatorTotalCanceled += a.prix * a.q; e.operatorTotalCanceledQuantity += a.q; });
    });
    pertesDe(p).forEach(function (x) { var e = e0(x.emp); e.operatorTotalLoss += x.montant; e.operatorTotalLossQuantity += x.q; });
    return reponse(Object.keys(o).map(function (k) {
      var e = o[k];
      ["operatorTotalOrderSales", "operatorTotalCashed", "operatorTotalDiscount", "operatorTotalCanceled", "operatorTotalTips", "operatorTotalLoss"].forEach(function (f) { e[f] = arrondi(e[f]); });
      e.operatorAverageOrder = e.operatorOrderCount ? arrondi(e.operatorTotalOrderSales / e.operatorOrderCount) : 0;
      e.operatorAverageCover = e.operatorGuestCount ? arrondi(e.operatorTotalOrderSales / e.operatorGuestCount) : 0;
      return e;
    }).filter(function (e) { return e.operatorOrderCount > 0 || e.operatorTotalCanceledQuantity > 0 || e.operatorTotalLossQuantity > 0; })
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
        e.productList = Object.keys(e.produits).map(function (z) { e.produits[z].amount = arrondi(e.produits[z].amount); return e.produits[z]; }).sort(function (a, b) { return b.quantity - a.quantity; });
        delete e.produits; return e;
      }).sort(function (a, b) { return b.quantity - a.quantity; });
    }
    return reponse({
      blocStats: { totalCanceledAmountBeforeCashIn: arrondi(totAv), totalCanceledAmountAfterCashIn: arrondi(totAp), totalCanceledAmount: arrondi(totAv + totAp) },
      cancelByReasonBeforeCashIn: liste(av), cancelByReasonAfterCashIn: liste(ap)
    });
  }
  function getReportLosses(p) {
    var o = {}, tot = 0, q = 0, l = pertesDe(p);
    l.forEach(function (x) {
      var e = o[x.motif] = o[x.motif] || { reason: x.motif, quantity: 0, amount: 0, produits: {} }, nom = produitParId(x.p).nom;
      e.quantity += x.q; e.amount += x.montant; tot += x.montant; q += x.q;
      var pp = e.produits[nom] = e.produits[nom] || { name: nom, quantity: 0, amount: 0 };
      pp.quantity += x.q; pp.amount += x.montant;
    });
    return reponse({
      blocStats: { total: arrondi(tot), totalQuantity: q },
      lossByReason: Object.keys(o).map(function (k) {
        var e = o[k]; e.amount = arrondi(e.amount);
        e.productList = Object.keys(e.produits).map(function (z) { e.produits[z].amount = arrondi(e.produits[z].amount); return e.produits[z]; }).sort(function (a, b) { return b.amount - a.amount; });
        delete e.produits; return e;
      }).sort(function (a, b) { return b.amount - a.amount; }),
      lossListByOrder: l.slice().reverse().map(function (x) { return { date: x.date, heure: hhmm(x.min), produit: produitParId(x.p).nom, quantite: x.q, motif: x.motif, employe: x.emp, montant: x.montant }; })
    });
  }
  function getReportDiscount(p) {
    var o = {}, tot = 0, offert = 0;
    payees(p).forEach(function (c) {
      if (!c.remise) return;
      var e = o[c.remise.nom] = o[c.remise.nom] || { discountName: c.remise.nom, quantity: 0, discountAmount: 0, taxes: {}, produits: {} };
      e.quantity++; e.discountAmount += c.remise.montant; tot += c.remise.montant;
      if (c.remise.nom === "Offert") offert += c.remise.montant;
      var brut = 0; c.items.forEach(function (x) { brut += totalItem(x); });
      c.items.forEach(function (x) {
        var prod = produitParId(x.p), taux = prod.tva, part = brut ? c.remise.montant * totalItem(x) / brut : 0;
        var pr = e.produits[prod.nom] = e.produits[prod.nom] || { name: prod.nom, taxRate: taux, quantity: 0, amountTTC: 0 };
        pr.quantity += x.q; pr.amountTTC += part;
        var tx = e.taxes[taux] = e.taxes[taux] || { taxName: nomTaxe(taux), taxRate: taux, quantity: 0, amountHT: 0, amountTVA: 0, amountTTC: 0 };
        tx.quantity += x.q; tx.amountTTC += part; tx.amountHT += ht(part, taux); tx.amountTVA += part - ht(part, taux);
      });
    });
    return reponse({
      blocStats: { discountSum: arrondi(tot - offert), giftedSum: arrondi(offert), total: arrondi(tot) },
      discountList: Object.keys(o).map(function (k) {
        var e = o[k]; e.discountAmount = arrondi(e.discountAmount);
        e.taxRepartition = Object.keys(e.taxes).map(function (t) { var x = e.taxes[t]; x.amountHT = arrondi(x.amountHT); x.amountTVA = arrondi(x.amountTVA); x.amountTTC = arrondi(x.amountTTC); return x; });
        e.productList = Object.keys(e.produits).map(function (k2) { var x = e.produits[k2]; x.amountTTC = arrondi(x.amountTTC); x.amountHT = arrondi(ht(x.amountTTC, x.taxRate)); x.amountTVA = arrondi(x.amountTTC - x.amountHT); return x; });
        delete e.taxes; delete e.produits; return e;
      }).sort(function (a, b) { return b.discountAmount - a.discountAmount; })
    });
  }
  function getReportTaxes(p) {
    var o = {};
    lignesVentes(payees(p)).forEach(function (l) {
      var e = o[l.tva] = o[l.tva] || { taxName: nomTaxe(l.tva), taxRate: l.tva, totalWithoutTax: 0, totalTax: 0, totalWithTax: 0 };
      e.totalWithoutTax += l.ht; e.totalWithTax += l.ttc;
    });
    return reponse(Object.keys(o).map(function (k) {
      var e = o[k]; e.totalWithoutTax = arrondi(e.totalWithoutTax); e.totalWithTax = arrondi(e.totalWithTax); e.totalTax = arrondi(e.totalWithTax - e.totalWithoutTax); return e;
    }).sort(function (a, b) { return b.totalWithTax - a.totalWithTax; }));
  }
  function couleurMode(nom) { var m = MODES_PAIEMENT.filter(function (x) { return x.nom === nom; })[0]; return m ? m.couleur : "#999"; }
  function getReportPaymentMode(p) {
    var o = {};
    payees(p).forEach(function (c) {
      paiementsDe(c).forEach(function (pa) {
        var e = o[pa.nom] = o[pa.nom] || { paymentName: pa.nom, paymentModeSum: 0, paymentModeQuantity: 0, paymentModeTips: 0, couleur: couleurMode(pa.nom) };
        e.paymentModeSum += pa.montant; e.paymentModeQuantity++; e.paymentModeTips += pa.pourboire || 0;
      });
    });
    return reponse(Object.keys(o).map(function (k) { o[k].paymentModeSum = arrondi(o[k].paymentModeSum); o[k].paymentModeTips = arrondi(o[k].paymentModeTips); return o[k]; })
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
      c.subCategoryList = Object.keys(c.subs).map(function (z) { var s = c.subs[z]; s.sales = arrondi(s.sales); s.salesWithoutTaxes = arrondi(s.salesWithoutTaxes); return s; }).sort(function (a, b) { return b.sales - a.sales; });
      delete c.subs; c.sales = arrondi(c.sales); c.salesWithoutTaxes = arrondi(c.salesWithoutTaxes); return c;
    }).sort(function (a, b) { return b.sales - a.sales; });
    return reponse({ categorySales: liste, timed: temps, ordreCategories: liste.map(function (c) { return c.name; }) });
  }

  // ---------- Créneaux de service (2 ou 3, horaires libres, mémorisés dans le navigateur) ----------
  var CRENEAUX_DEFAUT = [{ nom: "Service du midi", debut: "08:00", fin: "15:00" }, { nom: "Limonade", debut: "15:00", fin: "18:30" }, { nom: "Service du soir", debut: "18:30", fin: "24:00" }];
  function enMinutes(t) { var s = String(t || "").split(":"); return (+s[0]) * 60 + (+s[1] || 0); }
  function getCreneaux() {
    var l = S.lire("creneaux", null);
    if (l && l.length >= 2 && l.length <= 3) return l;
    return CRENEAUX_DEFAUT.map(function (c) { return { nom: c.nom, debut: c.debut, fin: c.fin }; });
  }
  function setCreneaux(liste) { if (liste) return S.ecrire("creneaux", liste); S.retirer("creneaux"); return true; }
  function indexCreneau(liste, min) {
    for (var i = 0; i < liste.length; i++) {
      var d = enMinutes(liste[i].debut), f = enMinutes(liste[i].fin);
      if (f <= d) f += 1440;
      if ((min >= d && min < f) || (min + 1440 >= d && min + 1440 < f)) return i;
    }
    return -1;
  }
  function getSalesDistribution(p) {
    var cren = getCreneaux(), parCreneau = cren.map(function (c) { return { slot: c.nom, horaire: c.debut + " – " + c.fin, valeurs: {}, quantites: {} }; });
    var horsCreneau = { slot: "Hors créneau", horaire: "", valeurs: {}, quantites: {}, vide: true };
    var jours = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"], cats = nomsCats(), parJour = [], i, heat = {}, tranches = {};
    for (i = 0; i < 7; i++) parJour.push({ day: jours[i], valeurs: {}, quantites: {}, sessions: {} });
    lignesVentes(payees(p)).forEach(function (l) {
      var dj = (jourSemaine(l.cmd.date) + 6) % 7, o = parJour[dj];
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
      (c.menus || []).forEach(function (m) { var e = o[m.nom] = o[m.nom] || { menuName: m.nom, quantity: 0, total: 0 }; e.quantity++; e.total += m.montant; });
    });
    return reponse(Object.keys(o).map(function (k) { o[k].total = arrondi(o[k].total); return o[k]; }).sort(function (a, b) { return b.total - a.total; }));
  }

  // ---------- Caisses (Z) ----------
  function totauxCreneaux(cmds) {
    var cren = getCreneaux(), t = cren.map(function (c) { return { nom: c.nom, total: 0 }; });
    lignesVentes(cmds).forEach(function (l) { var i = indexCreneau(cren, l.cmd.min); if (i >= 0) t[i].total += l.ttc; });
    return t.map(function (x) { x.total = arrondi(x.total); return x; });
  }
  function getNewHistoryZTill(p) {
    var l = [];
    joursEntre(p).forEach(function (iso) {
      if (!caisseCloturee(iso)) return;
      var j = jourVisible(iso), paye = j.commandes.filter(function (c) { return c.statut === "paid"; });
      l.push({ id: "z" + iso, date: iso, reportNumber: j.numero, startedAt: hhmm(j.ouvertureMin), finalizedAt: hhmm(j.fermetureMin), totalSales: totaux(paye).ttc, creneaux: totauxCreneaux(paye) });
    });
    return reponse(l.reverse());
  }
  function getReportById(id) {
    var iso = String(id).replace(/^z/, "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || !caisseCloturee(iso) || iso < OUVERTURE) return reponse(null);
    var z = jourVisible(iso), cm = z.commandes.filter(function (c) { return c.statut === "paid"; }), t = totaux(cm);
    var pay = {}, taxes = {}, rooms = {}, prods = {}, ann = {}, tips = 0, especes = 0;
    cm.forEach(function (c) {
      paiementsDe(c).forEach(function (pa) {
        var pp = pay[pa.nom] = pay[pa.nom] || { name: pa.nom, quantity: 0, totalAmount: 0, tips: 0 };
        pp.quantity++; pp.totalAmount += pa.montant; pp.tips += pa.pourboire || 0; tips += pa.pourboire || 0;
        if (pa.nom === "Espèces") especes += pa.montant;
      });
      var r = rooms[c.salle] = rooms[c.salle] || { name: c.salle, orderCount: 0, guestCount: 0, total: 0, totalExcludingTax: 0 };
      r.orderCount++; r.guestCount += c.couverts; r.total += c.total;
    });
    lignesVentes(cm).forEach(function (l) {
      var x = taxes[l.tva] = taxes[l.tva] || { taxName: nomTaxe(l.tva), taxRate: l.tva, taxableAmount: 0, taxAmount: 0 };
      x.taxableAmount += l.ht; x.taxAmount += l.ttc - l.ht;
      var q = prods[l.prod.id] = prods[l.prod.id] || { productName: l.prod.nom, category: l.prod.categorie, productQuantity: 0, productSales: 0 };
      q.productQuantity += l.q; q.productSales += l.ttc;
      rooms[l.cmd.salle].totalExcludingTax += l.ht;
    });
    z.commandes.forEach(function (c) { c.annules.forEach(function (a) { var e = ann[a.motif] = ann[a.motif] || { name: a.motif, quantity: 0, amount: 0 }; e.quantity += a.q; e.amount += a.prix * a.q; }); });
    function r2(o) { return Object.keys(o).map(function (k) { var e = o[k]; Object.keys(e).forEach(function (f) { if (typeof e[f] === "number") e[f] = arrondi(e[f]); }); return e; }); }
    return reponse({
      id: "z" + iso, date: iso, reportNumber: z.numero, startedAt: hhmm(z.ouvertureMin), finalizedAt: hhmm(z.fermetureMin),
      totalOrders: cm.length, guestsNumberTotal: t.couverts, totalSalesSum: t.ttc, totalSalesWithoutTax: t.ht,
      averageGuest: t.couverts ? arrondi(t.ttc / t.couverts) : 0, averageOrder: cm.length ? arrondi(t.ttc / cm.length) : 0,
      taxSummary: r2(taxes).sort(function (a, b) { return a.taxRate - b.taxRate; }), paymentSummary: r2(pay).sort(function (a, b) { return b.totalAmount - a.totalAmount; }),
      productSummary: r2(prods).sort(function (a, b) { return b.productSales - a.productSales; }),
      cancelationSummary: r2(ann), roomSummary: r2(rooms).sort(function (a, b) { return b.total - a.total; }), creneaux: totauxCreneaux(cm),
      salesStatisticsData: { totalOrdered: t.ttc, totalCharged: arrondi(t.ttc + tips), totalTips: arrondi(tips), initialCashFloat: z.fondInitial, finalCashFloat: arrondi(z.fondInitial + especes), gap: 0 }
    });
  }
  function getFiscalArchives(p) {
    var jours = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"], mois = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
    function fr(iso) { var d = date(iso); return jours[d.getDay()] + " " + d.getDate() + " " + mois[d.getMonth()] + " " + d.getFullYear(); }
    function jjmmaaaa(iso) { var s = iso.split("-"); return s[2] + "-" + s[1] + "-" + s[0]; }
    var res = [];
    joursEntre(p).forEach(function (iso) {
      if (!caisseCloturee(iso)) return;
      res.push({ id: "f" + iso, titre: "Archive fiscale du " + fr(iso), sauvegarde: jjmmaaaa(decaler(iso, 1)), type: "Journalière", fichier: "ArchiveFiscale_" + iso.replace(/-/g, "") + ".csv", date: iso, debut: iso, fin: iso });
    });
    var d = date(p.dateStart < OUVERTURE ? OUVERTURE : p.dateStart); d = new Date(d.getFullYear(), d.getMonth(), 1, 12);
    var fin = date(p.dateEnd);
    while (d <= fin) {
      var iso = jourIso(d), finMois = jourIso(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12));
      if (finMois < AUJ_ISO && iso >= OUVERTURE.slice(0, 8) + "01") res.push({ id: "m" + iso, titre: "Archive fiscale de " + mois[d.getMonth()] + " " + d.getFullYear(), sauvegarde: jjmmaaaa(decaler(finMois, 1)), type: "Mensuelle", fichier: "ArchiveFiscale_" + iso.slice(0, 7).replace("-", "") + "_mois.csv", date: finMois, debut: iso, fin: finMois });
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1, 12);
    }
    return reponse(res.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (a.type === "Mensuelle" ? -1 : 1); }));
  }
  // Contenu d'une archive : une ligne par caisse clôturée (totaux, TVA par taux, règlements)
  function getContenuArchive(id) {
    var arch = /^f/.test(id) ? { debut: id.slice(1), fin: id.slice(1) } : { debut: id.slice(1), fin: jourIso(new Date(+id.slice(1, 5), +id.slice(6, 8), 0, 12)) };
    var modes = MODES_PAIEMENT.map(function (m) { return m.nom; }), entetes = ["Date", "N° Z", "Ouverture", "Clôture", "Commandes", "Couverts", "Total HT", "TVA 5,5 %", "TVA 10 %", "TVA 20 %", "Total TTC"].concat(modes).concat(["Pourboires", "Annulations"]);
    var lignes = [];
    joursEntre({ dateStart: arch.debut, dateEnd: arch.fin }).forEach(function (iso) {
      if (!caisseCloturee(iso)) return;
      var z = jourVisible(iso), cm = z.commandes.filter(function (c) { return c.statut === "paid"; }), tva = { "5.5": 0, "10": 0, "20": 0 }, h = 0, ttc = 0, pay = {}, tips = 0, ann = 0;
      lignesVentes(cm).forEach(function (l) { tva[String(l.tva)] = (tva[String(l.tva)] || 0) + (l.ttc - l.ht); h += l.ht; ttc += l.ttc; });
      cm.forEach(function (c) { paiementsDe(c).forEach(function (pa) { pay[pa.nom] = (pay[pa.nom] || 0) + pa.montant; tips += pa.pourboire || 0; }); });
      z.commandes.forEach(function (c) { c.annules.forEach(function (a) { ann += a.prix * a.q; }); });
      var couv = 0; cm.forEach(function (c) { couv += c.couverts; });
      lignes.push([iso.split("-").reverse().join("/"), z.numero, hhmm(z.ouvertureMin), hhmm(z.fermetureMin), cm.length, couv, h, tva["5.5"], tva["10"], tva["20"], ttc]
        .concat(modes.map(function (m) { return pay[m] || 0; })).concat([tips, ann]));
    });
    return reponse({ entetes: entetes, lignes: lignes });
  }
  function getRoomsReport(p) {
    var cm = payees(p), t = totaux(cm), o = {}, modes = {};
    cm.forEach(function (c) { var r = o[c.salle] = o[c.salle] || { roomName: c.salle, totalSales: 0, guestCount: 0, orderCount: 0 }; r.totalSales += c.total; r.guestCount += c.couverts; r.orderCount++; });
    Object.keys(o).forEach(function (k) {
      var s = salleParNom(k) || { type: "room" }, lib = s.type === "bar" ? "Comptoir" : s.type === "takeOut" ? "À emporter" : "Sur place";
      var m = modes[lib] = modes[lib] || { type: lib, orderCount: 0, guestCount: 0, total: 0, rooms: [] };
      m.orderCount += o[k].orderCount; m.guestCount += o[k].guestCount; m.total += o[k].totalSales;
      m.rooms.push({ name: k, orderCount: o[k].orderCount, guestCount: o[k].guestCount, total: arrondi(o[k].totalSales) });
    });
    var l = Object.keys(modes).map(function (k) { modes[k].total = arrondi(modes[k].total); return modes[k]; }).sort(function (a, b) { return b.total - a.total; });
    return reponse({
      summary: { orderCount: cm.length, averagePerOrder: cm.length ? arrondi(t.ttc / cm.length) : 0, totalTTC: t.ttc, guestCount: t.couverts, averagePerGuest: t.couverts ? arrondi(t.ttc / t.couverts) : 0 },
      barChart: l.map(function (m) { return { roomName: m.type, totalSales: m.total }; }), modes: l
    });
  }

  // ---------- Caisse en cours (temps réel) ----------
  function parHeure(cmds) {
    var h = {};
    cmds.forEach(function (c) { if (c.statut === "paid") { var k = Math.floor(c.min / 60); h[k] = (h[k] || 0) + c.total; } });
    var l = []; for (var x = 8; x <= 22; x++) l.push({ hour: x, total: arrondi(h[x] || 0) });
    return l;
  }
  function getRealTime() {
    var j = jourVisible(AUJ_ISO), il7 = decaler(AUJ_ISO, -7), now = maintenantMin();
    var paye = j.commandes.filter(function (c) { return c.statut === "paid"; }), t = totaux(paye), ann = 0, cumul = 0, courbe = [], pourboires = 0;
    j.commandes.forEach(function (c) { c.annules.forEach(function (a) { ann += a.prix * a.q; }); pourboires += c.pourboire || 0; });
    paye.forEach(function (c) { cumul += c.total; courbe.push({ heure: hhmm(c.min), min: c.min, cumul: arrondi(cumul) }); });
    var semaine = il7 >= OUVERTURE ? jourComplet(il7).commandes : [], memeHeure = 0;
    semaine.forEach(function (c) { if (c.statut === "paid" && c.min <= now) memeHeure += c.total; });
    var parSalle = {};
    paye.forEach(function (c) { parSalle[c.salle] = (parSalle[c.salle] || 0) + c.total; });
    return reponse({
      realTimeData: { totalSales: t.ttc, totalSalesWithoutTaxes: t.ht, guestsNumber: t.couverts, orderCount: paye.length, totalCanceled: arrondi(ann), totalTips: arrondi(pourboires), totalByHours: parHeure(j.commandes) },
      lastWeekData: { totalByHours: parHeure(semaine), memeHeure: arrondi(memeHeure), date: il7 },
      cumul: courbe, parSalle: Object.keys(parSalle).map(function (k) { return { salle: k, total: arrondi(parSalle[k]) }; }).sort(function (a, b) { return b.total - a.total; }),
      ouverteA: hhmm(j.ouvertureMin), fermeeA: j.enCours || !j.ouverte ? null : hhmm(j.fermetureMin), enCours: !!j.enCours, avantOuverture: !j.ouverte, maintenant: hhmm(now), numero: j.numero
    });
  }

  // ======================================================================
  // Stocks : niveau suivi au fil des ventes, des livraisons, de la production et des pertes
  // ======================================================================
  var STOCKES = [
    { nom: "Cola 33cl", seuil: 12, livraison: [1, 4], pack: 24, marge: 1.1 }, { nom: "Jus de pomme 25cl", seuil: 12, livraison: [1, 4], pack: 12, marge: 1.1 },
    { nom: "Eau gazeuse 50cl", seuil: 10, livraison: [1, 4], pack: 12, marge: 1.1 }, { nom: "Bière bretonne 33cl", seuil: 8, livraison: [2, 5], pack: 12, marge: 1.1 },
    { nom: "Cidre brut 75cl", seuil: 6, livraison: [2, 5], pack: 6, marge: 1.1 }, { nom: "Cidre doux 75cl", seuil: 6, livraison: [2, 5], pack: 6, marge: 1, chronique: true },
    { nom: "Rouge bouteille 75cl", seuil: 4, livraison: [3], pack: 6, marge: 1.1 }, { nom: "Blanc bouteille 75cl", seuil: 4, livraison: [3], pack: 6, marge: 1, chronique: true },
    { nom: "Pot de caramel 220g", seuil: 5, livraison: [1], pack: 6, marge: 1.1 },
    { nom: "Far breton", seuil: 3, production: true }, { nom: "Kouign-amann", seuil: 3, production: true },
    { nom: "Tarte du jour", seuil: 2, production: true }, { nom: "Fondant chocolat", seuil: 3, production: true }
  ];
  STOCKES.forEach(function (s) { s.p = P(s.nom); });
  var MOTIFS_PERTE = ["DLC dépassée", "Casse", "Vol", "Autre"];
  var JOURS_STOCK = 21;
  function mouvementsUtilisateur() { return S.lire("stock-mouvements", {}); }
  function minuteDe(isoComplet) { var d = new Date(isoComplet); return { date: jourIso(d), min: d.getHours() * 60 + d.getMinutes() }; }
  // Simulation des 3 dernières semaines : renvoie le niveau courant et l'historique des mouvements
  function simulerStock(s) {
    var debut = decaler(AUJ_ISO, -JOURS_STOCK), ventes = [], i, iso;
    for (i = 0; i <= JOURS_STOCK; i++) { iso = decaler(debut, i); ventes.push(iso >= OUVERTURE ? (resume(iso).ventes[s.p.id] || 0) : 0); }
    // Ventes moyennes par jour de la semaine (3 dernières semaines) : sert à commander et à produire juste ce qu'il faut
    var parJS = [0, 0, 0, 0, 0, 0, 0], nbJS = [0, 0, 0, 0, 0, 0, 0], moyenne = 0;
    for (i = 0; i < JOURS_STOCK; i++) { var w = date(decaler(debut, i)).getDay(); parJS[w] += ventes[i]; nbJS[w]++; moyenne += ventes[i]; }
    moyenne = moyenne / JOURS_STOCK;
    function prevu(js) { return nbJS[js] ? parJS[js] / nbJS[js] : moyenne; }
    function besoinJusquA(isoD) { // ventes prévues jusqu'à la prochaine livraison (exclue)
      var b = 0, d = isoD;
      for (var k = 0; k < 8; k++) { b += prevu(date(d).getDay()); d = decaler(d, 1); if (s.livraison.indexOf(date(d).getDay()) >= 0) break; }
      return b;
    }
    var plafond = s.livraison ? Math.max(s.pack, Math.round(s.seuil + moyenne * 3.5 * s.marge)) : 0;
    var niveau = s.livraison ? Math.round(plafond * 0.6) : 0, histo = [], user = mouvementsUtilisateur()[s.p.id] || [], derniereDecl = null;
    function mvt(iso, min, type, delta, motif, note) {
      var avant = niveau;
      niveau = type === "inventaire" ? Math.max(0, avant + delta) : Math.max(0, avant + delta);
      histo.push({ date: iso + "T" + hhmm(min) + ":00", type: type, delta: arrondi(niveau - avant), avant: avant, apres: niveau, motif: motif || "", note: note || "" });
    }
    for (i = 0; i <= JOURS_STOCK; i++) {
      iso = decaler(debut, i);
      var js = date(iso).getDay(), r = graine("stock|" + s.nom + "|" + iso), estAuj = iso === AUJ_ISO, now = maintenantMin();
      if (estAuj && now < 450) break;
      if (s.production) {
        if (niveau > 0) mvt(iso, 450, "perte", -niveau, "DLC dépassée", "Invendus de la veille");
        mvt(iso, 455, "ajout", Math.max(s.seuil + 2, Math.round(prevu(js) + s.seuil + 1) + entre(r, -1, 1)), "", "Production du jour");
      } else {
        if (js === 1 && i > 0) { mvt(iso, 470, "inventaire", pondere(r, [-1, 0, 0, 1], [1, 3, 3, 1]), "", "Inventaire du lundi"); derniereDecl = iso; }
        if (s.livraison.indexOf(js) >= 0) {
          if (s.chronique) { // livraisons partielles (rupture chez le fournisseur) : le produit reste à recommander
            var reste = s.seuil - entre(r, 0, 2) - niveau;
            if (reste > 0) mvt(iso, 570, "ajout", reste, "", "Livraison partielle (rupture fournisseur)");
          } else {
            var cible = s.seuil + besoinJusquA(iso) * s.marge, manque = cible - niveau;
            if (manque > s.pack / 3) mvt(iso, 570, "ajout", Math.max(s.pack, Math.round(manque / s.pack) * s.pack), "", "Livraison fournisseur");
          }
        }
      }
      // Ventes de la journée (jusqu'à maintenant pour aujourd'hui), pertes déclarées, mouvements saisis
      var evts = [];
      if (estAuj) {
        var visibles = jourVisible(iso).commandes, parHeureVente = {};
        visibles.forEach(function (c) { if (c.statut === "paid") c.items.forEach(function (x) { if (x.p === s.p.id) parHeureVente[Math.floor(c.min / 60)] = (parHeureVente[Math.floor(c.min / 60)] || 0) + x.q; }); });
        Object.keys(parHeureVente).forEach(function (h) { evts.push({ min: +h * 60 + 59 > now ? now : +h * 60 + 59, type: "vente", delta: -parHeureVente[h] }); });
      } else if (ventes[i]) evts.push({ min: 1375, type: "vente", delta: -ventes[i] });
      if (iso >= OUVERTURE) jourVisible(iso).pertes.forEach(function (x) { if (x.p === s.p.id) evts.push({ min: x.min, type: "perte", delta: -x.q, motif: x.motif, note: "Déclarée en caisse par " + x.emp }); });
      user.forEach(function (u) { var w = minuteDe(u.date); if (w.date === iso) evts.push({ min: w.min, type: u.type, delta: u.type === "inventaire" ? null : u.delta, valeur: u.apres, motif: u.motif, note: u.note, user: true }); });
      evts.sort(function (a, b) { return a.min - b.min; }).forEach(function (e) {
        if (e.type === "vente") { var avant = niveau; niveau = Math.max(0, niveau + e.delta); histo.push({ date: iso + "T" + hhmm(Math.min(e.min, 1439)) + ":00", type: "vente", delta: arrondi(niveau - avant), avant: avant, apres: niveau, motif: "", note: estAuj ? "Ventes en caisse" : "Ventes de la journée" }); }
        else if (e.type === "inventaire") { mvt(iso, e.min, "inventaire", e.valeur - niveau, "", e.note); if (e.user) derniereDecl = iso; }
        else mvt(iso, e.min, e.type, e.delta, e.motif, e.note);
      });
    }
    if (!derniereDecl) { var lundi = AUJ_ISO; while (date(lundi).getDay() !== 1) lundi = decaler(lundi, -1); derniereDecl = s.production ? AUJ_ISO : lundi; }
    return { niveau: niveau, historique: histo.reverse(), derniereDecl: derniereDecl };
  }
  function seuils() {
    var o = {};
    tousProduits().forEach(function (p) { if (p.seuilReappro !== null && p.seuilReappro !== undefined) o[p.id] = p.seuilReappro; });
    return o;
  }
  function lignesStock() {
    var sl = seuils();
    return STOCKES.map(function (s) {
      var sim = simulerStock(s);
      return { id: s.p.id, productName: s.nom, quantity: sim.niveau, lastDeclaredAt: sim.derniereDecl, category: s.p.categorie, subCategory: s.p.sousCategorie, seuil: sl[s.p.id] === undefined ? null : sl[s.p.id] };
    });
  }
  function getHybridStock() { return reponse(lignesStock()); }
  function getAlertesStock() {
    return reponse(lignesStock().filter(function (l) { return l.seuil !== null && l.quantity <= l.seuil; })
      .map(function (l) { return { id: l.id, productName: l.productName, quantity: l.quantity, seuil: l.seuil }; }).sort(function (a, b) { return a.quantity - b.quantity; }));
  }
  function getStockMovements(id) {
    var s = STOCKES.filter(function (x) { return x.p.id === id; })[0];
    return reponse(s ? simulerStock(s).historique : []);
  }
  // m = { type: "ajout" | "inventaire" | "perte", quantite, motif, note }
  function setStockMovement(id, m) {
    var s = STOCKES.filter(function (x) { return x.p.id === id; })[0], q = Math.round(+m.quantite * 100) / 100;
    if (!s) return Promise.reject("Produit introuvable.");
    if (!isFinite(q) || q < 0 || (m.type !== "inventaire" && q === 0)) return Promise.reject("Quantité invalide.");
    if (m.type === "perte" && MOTIFS_PERTE.indexOf(m.motif) < 0) return Promise.reject("Choisir le motif de la perte.");
    var avant = simulerStock(s).niveau;
    if (m.type === "perte" && q > avant) return Promise.reject("La perte dépasse le stock actuel (" + avant + ").");
    var tous = mouvementsUtilisateur(), l = tous[id] = tous[id] || [];
    var apres = m.type === "ajout" ? avant + q : m.type === "perte" ? avant - q : q;
    l.push({ date: new Date().toISOString(), type: m.type, delta: arrondi(apres - avant), apres: apres, motif: m.type === "perte" ? m.motif : "", note: m.note || "" });
    S.ecrire("stock-mouvements", tous);
    var ligne = lignesStock().filter(function (x) { return x.id === id; })[0];
    return reponse(ligne);
  }

  // ======================================================================
  // Objectifs : trois objectifs proposés (mois précédent, mois en cours, année) + ceux de l'utilisateur
  // ======================================================================
  var MOIS_NOMS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  function deMois(m) { return (/^[aeiouyéèêàâ]/.test(m) ? "d'" : "de ") + m; }
  function sommeAttendue(d1, d2) { var s = 0, iso = d1 < OUVERTURE ? OUVERTURE : d1; while (iso <= d2) { s += attendu(iso); iso = decaler(iso, 1); } return s; }
  function ratioCouverts() {
    var ca = 0, cv = 0;
    for (var i = 1; i <= 14; i++) { var s = resume(decaler(AUJ_ISO, -i)); ca += s.ttc; cv += s.couverts; }
    return ca ? cv / ca : 1 / 22.5;
  }
  function objectifsAuto() {
    var d = date(AUJ_ISO), y = d.getFullYear(), m = d.getMonth(), rc = ratioCouverts();
    var debM = jourIso(new Date(y, m, 1, 12)), finM = jourIso(new Date(y, m + 1, 0, 12));
    var debP = jourIso(new Date(y, m - 1, 1, 12)), finP = jourIso(new Date(y, m, 0, 12));
    var nomP = MOIS_NOMS[new Date(y, m - 1, 1).getMonth()], nomM = MOIS_NOMS[m];
    var caP = sommeAttendue(debP, finP), caM = sommeAttendue(debM, finM), caA = sommeAttendue(y + "-01-01", y + "-12-31");
    return [
      { id: "auto-annee", nom: "Objectif " + y, debut: y + "-01-01", fin: y + "-12-31", base: "ttc", ca: Math.round(caA * 0.985 / 1000) * 1000, couverts: 0, auto: true },
      { id: "auto-mois-prec", nom: "Objectif " + deMois(nomP), debut: debP, fin: finP, base: "ttc", ca: Math.round(caP / 1.04 / 100) * 100, couverts: Math.round(caP * rc / 1.03 / 10) * 10, auto: true },
      { id: "auto-mois", nom: "Objectif " + deMois(nomM), debut: debM, fin: finM, base: "ttc", ca: Math.round(caM * 0.95 / 100) * 100, couverts: Math.round(caM * rc * 0.95 / 10) * 10, auto: true }
    ];
  }
  function lireObjectifs() {
    var u = S.lire("objectifs", { liste: [], supprimes: [] });
    var l = objectifsAuto().filter(function (o) { return u.supprimes.indexOf(o.id) < 0 && !u.liste.some(function (x) { return x.id === o.id; }); });
    return l.concat(u.liste);
  }
  function getObjectifs() { return reponse(lireObjectifs().sort(function (a, b) { return a.debut < b.debut ? -1 : a.debut > b.debut ? 1 : (b.fin < a.fin ? -1 : 1); })); }
  function setObjectif(o) {
    var nom = String(o.nom || "").trim(), ca = Math.max(0, +o.ca || 0), cv = Math.max(0, Math.round(+o.couverts || 0));
    if (!nom) return Promise.reject("Donnez un nom à l'objectif.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(o.debut || "") || !/^\d{4}-\d{2}-\d{2}$/.test(o.fin || "")) return Promise.reject("Renseignez les dates de début et de fin.");
    if (o.fin < o.debut) return Promise.reject("La date de fin précède la date de début.");
    if (!ca && !cv) return Promise.reject("Saisissez un objectif de CA et/ou de couverts.");
    var u = S.lire("objectifs", { liste: [], supprimes: [] });
    var n = { id: o.id || "o" + Date.now().toString(36), nom: nom, debut: o.debut, fin: o.fin, base: o.base === "ht" ? "ht" : "ttc", ca: ca, couverts: cv }, trouve = false;
    u.liste = u.liste.map(function (x) { if (x.id === n.id) { trouve = true; return n; } return x; });
    if (!trouve) u.liste.push(n);
    return S.ecrire("objectifs", u) ? reponse(n) : Promise.reject("Stockage du navigateur indisponible.");
  }
  function deleteObjectif(id) {
    var u = S.lire("objectifs", { liste: [], supprimes: [] });
    u.liste = u.liste.filter(function (x) { return x.id !== id; });
    if (/^auto-/.test(id) && u.supprimes.indexOf(id) < 0) u.supprimes.push(id);
    return S.ecrire("objectifs", u) ? reponse(true) : Promise.reject("Stockage du navigateur indisponible.");
  }

  // ======================================================================
  // Produits : catalogue d'origine + modifications et ajouts gardés dans le navigateur ; prix d'achat activés par défaut
  // ======================================================================
  var CHAMPS_PRODUIT = ["nom", "categorie", "sousCategorie", "poles", "niveau", "options", "typePrix", "prix", "tva", "achat", "codeBarre", "sku", "plu", "nomBouton", "nomPrepa", "seuilReappro"];
  var SEUILS_DEFAUT = {};
  STOCKES.forEach(function (s) { SEUILS_DEFAUT[s.p.id] = s.seuil; });
  function edits() {
    var e = S.lire("produits", null) || {};
    e.modifs = e.modifs || {}; e.ajouts = e.ajouts || []; if (e.achat === undefined) e.achat = true;
    return e;
  }
  function sauverEdits(e) { return S.ecrire("produits", e); }
  function AJOUTS_PRODUITS() { var o = {}; edits().ajouts.forEach(function (a) { o[a.id] = { id: a.id, nom: a.nom, categorie: a.categorie, sousCategorie: a.sousCategorie, tva: a.tva, prix: a.prix, couleur: couleurCategorie(a.categorie) }; }); return o; }
  function couleurCategorie(nom, defaut) { var c = CATEGORIES.filter(function (x) { return x.nom === nom; })[0]; return c ? c.couleur : (defaut || "#888888"); }
  function poles(p) { return !p.pole ? [] : (p.pole === "Crêperie" ? ["Crêperie", "Cuisine"] : [p.pole]); }
  function codeBarre(i) { var s = "376000" + ("000000" + (1000 + i * 37)).slice(-6), t = 0; for (var k = 0; k < 12; k++) t += (+s[k]) * (k % 2 ? 3 : 1); return s + ((10 - t % 10) % 10); }
  function produitComplet(base, ajout, e) {
    var m = ajout ? base : (e.modifs[base.id] || {}), idx = ajout ? 0 : +base.id.slice(1);
    var o = {
      id: base.id, nom: base.nom, categorie: base.categorie, sousCategorie: base.sousCategorie, poles: ajout ? [] : poles(base),
      niveau: ajout ? "Aucun" : (base.famille === "galette" || base.famille === "plat" || base.famille === "saucisse" ? "1" : base.famille === "crepe" || base.famille === "glace" || base.famille === "patisserie" || base.famille === "flambee" ? "2" : "Direct"),
      options: !ajout && base.groupe ? [base.groupe] : [], typePrix: "unitaire", prix: base.prix, tva: base.tva, achat: ajout ? null : base.achat,
      codeBarre: ajout ? "" : (base.famille === "soft" || base.famille === "biere" || base.famille === "cidre" || base.famille === "vinBouteille" || base.famille === "epicerie" ? codeBarre(idx) : ""),
      sku: ajout ? "" : "CD-" + ("000" + idx).slice(-3), plu: "", nomBouton: "", nomPrepa: "", seuilReappro: ajout ? null : (SEUILS_DEFAUT[base.id] === undefined ? null : SEUILS_DEFAUT[base.id]),
      nbPrix: ajout ? 1 : (base.pole === "Bar" ? 3 : 2), ajoute: !!ajout, modifie: !ajout && !!e.modifs[base.id]
    };
    CHAMPS_PRODUIT.forEach(function (k) { if (m[k] !== undefined) o[k] = m[k]; });
    o.couleur = couleurCategorie(o.categorie, base.couleur);
    return o;
  }
  function tousProduits() {
    var e = edits();
    return PRODUITS.map(function (p) { return produitComplet(p, false, e); }).concat(e.ajouts.map(function (a) { return produitComplet(a, true, e); }));
  }
  function getProduct(id) {
    var p = tousProduits().filter(function (x) { return x.id === id; })[0];
    return p ? reponse(p) : Promise.reject("Produit introuvable.");
  }
  function ecrireProduit(e, id, d) {
    var nom = String(d.nom || "").trim(), prix = Math.round(+d.prix * 100) / 100, tva = +d.tva, achat = d.achat === null || d.achat === "" || d.achat === undefined ? null : Math.round(+d.achat * 100) / 100;
    if (!nom) return { erreur: "Le nom est obligatoire." };
    if (!d.categorie) return { erreur: "Choisir une catégorie." };
    if (!isFinite(prix) || prix < 0) return { erreur: "Prix invalide." };
    if (achat !== null && (!isFinite(achat) || achat < 0)) return { erreur: "Prix d'achat invalide." };
    var seuil = d.seuilReappro === null || d.seuilReappro === "" || d.seuilReappro === undefined ? null : +d.seuilReappro;
    if (seuil !== null && (!isFinite(seuil) || seuil < 0)) return { erreur: "Seuil de réapprovisionnement invalide." };
    var val = {
      nom: nom, categorie: d.categorie, sousCategorie: d.sousCategorie || "", poles: d.poles || [], niveau: d.niveau || "Aucun", options: d.options || [], typePrix: d.typePrix || "unitaire",
      prix: prix, tva: tva, achat: achat, codeBarre: String(d.codeBarre || "").trim(), sku: String(d.sku || "").trim(), plu: String(d.plu || "").trim(),
      nomBouton: String(d.nomBouton || "").trim(), nomPrepa: String(d.nomPrepa || "").trim(), seuilReappro: seuil
    };
    var ajout = id ? e.ajouts.filter(function (a) { return a.id === id; })[0] : null;
    if (!id) { val.id = "n" + Date.now().toString(36); e.ajouts.push(val); return { id: val.id }; }
    if (ajout) { CHAMPS_PRODUIT.forEach(function (k) { ajout[k] = val[k]; }); return { id: id }; }
    if (PAR_ID[id]) { e.modifs[id] = val; return { id: id }; }
    return { erreur: "Produit introuvable." };
  }
  function setProduct(id, d) {
    var e = edits(), r = ecrireProduit(e, id, d);
    if (r.erreur) return Promise.reject(r.erreur);
    return sauverEdits(e) ? getProduct(r.id) : Promise.reject("Stockage du navigateur indisponible.");
  }
  function setProductsLot(ids, lot) {
    var e = edits(), tous = tousProduits(), n = 0, err = null;
    ids.forEach(function (id) {
      if (err) return;
      var p = tous.filter(function (x) { return x.id === id; })[0];
      if (!p) return;
      var d = {}; CHAMPS_PRODUIT.forEach(function (k) { d[k] = p[k]; });
      Object.keys(lot).forEach(function (k) {
        var v = lot[k];
        if (k === "poles" || k === "options") {
          var cur = (d[k] || []).slice();
          if (v.mode === "remplacer") cur = v.valeurs.slice();
          else if (v.mode === "ajouter") v.valeurs.forEach(function (x) { if (cur.indexOf(x) < 0) cur.push(x); });
          else cur = cur.filter(function (x) { return v.valeurs.indexOf(x) < 0; });
          d[k] = cur;
        } else d[k] = v;
      });
      if (lot.categorie && !lot.sousCategorie) {
        var c = CATEGORIES.filter(function (x) { return x.nom === lot.categorie; })[0];
        if (c && c.sous.indexOf(d.sousCategorie) < 0) d.sousCategorie = "";
      }
      var r = ecrireProduit(e, id, d);
      if (r.erreur) err = p.nom + " : " + r.erreur; else n++;
    });
    if (err) return Promise.reject(err);
    return sauverEdits(e) ? reponse(n) : Promise.reject("Stockage du navigateur indisponible.");
  }
  function resetProduct(id) {
    var e = edits();
    e.ajouts = e.ajouts.filter(function (a) { return a.id !== id; });
    delete e.modifs[id];
    return sauverEdits(e) ? reponse(true) : Promise.reject("Stockage du navigateur indisponible.");
  }
  function getGestionAchat() { return reponse(edits().achat); }
  function setGestionAchat(actif) { var e = edits(); e.achat = !!actif; sauverEdits(e); return reponse(e.achat); }
  function calculMarge(prix, tva, achat) {
    if (achat === null || achat === undefined || achat === "" || !isFinite(+achat) || !isFinite(+prix)) return null;
    var vente = ht(+prix, +tva || 0), marge = vente - +achat;
    return { ht: vente, marge: marge, taux: vente > 0 ? marge / vente * 100 : null, coef: +achat > 0 ? vente / +achat : null };
  }

  // ======================================================================
  // Météo (affichage : ville choisie ; ventes : Rennes) et lien avec les ventes
  // ======================================================================
  function getWeatherDays(p) {
    return M.jours(p.dateStart, p.dateEnd).then(function (j) { return { jours: j, recupereLe: M.recupereLe(), fichier: true, ville: M.ville().nom }; });
  }
  function getWeatherForecast(nb) {
    return M.jours(AUJ_ISO, decaler(AUJ_ISO, (nb || 16) - 1)).then(function (j) { return { jours: j, recupereLe: M.recupereLe(), fichier: true, ville: M.ville().nom }; });
  }
  // CA moyen des jours passés selon leur clémence (365 derniers jours) et selon le jour de la semaine (8 dernières semaines)
  var IMPACT = null;
  function getWeatherImpact() {
    if (!IMPACT) {
      var par = [[0, 0], [0, 0], [0, 0]], tous = 0, nb = 0, sem = [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]];
      for (var i = 1; i <= 365; i++) {
        var iso = decaler(AUJ_ISO, -i);
        if (iso < OUVERTURE) break;
        var t = resume(iso).ttc, sc = M.score(M.pourVentes(iso));
        if (!t || sc === null) continue;
        var k = sc < 40 ? 0 : (sc < 70 ? 1 : 2);
        par[k][0] += t; par[k][1]++; tous += t; nb++;
        if (i <= 56) { var js = jourSemaine(iso); sem[js][0] += t; sem[js][1]++; }
      }
      IMPACT = {
        tranches: par.map(function (x) { return { moyenne: x[1] ? arrondi(x[0] / x[1]) : null, jours: x[1] }; }), moyenne: nb ? arrondi(tous / nb) : null,
        parJourSemaine: sem.map(function (x) { return x[1] ? arrondi(x[0] / x[1]) : null; })
      };
    }
    return reponse(IMPACT);
  }
  // Estimation du CA d'un jour à venir : moyenne du même jour de semaine, corrigée par la clémence
  function estimation(impact, iso, score) {
    var base = impact.parJourSemaine[jourSemaine(iso)], t = score == null ? null : impact.tranches[score < 40 ? 0 : (score < 70 ? 1 : 2)];
    if (!base) return null;
    var f = t && t.moyenne && impact.moyenne && t.jours >= 5 ? Math.max(0.85, Math.min(1.15, t.moyenne / impact.moyenne)) : 1;
    return Math.round(base * f / 10) * 10;
  }

  // ======================================================================
  // Exposition
  // ======================================================================
  window.DonneesTest = {
    pret: function () { return M.pret.then(function () { return true; }); },
    AUJOURDHUI: AUJ_ISO, OUVERTURE: OUVERTURE, HEURE_OUVERTURE: OUVRE, HEURE_FERMETURE: FERME, mode: "demo",
    getLocations: function () { return reponse(SITES); },
    getHomePage: getHomePage, getDerniersEncaissements: getDerniersEncaissements, getTopProduitsJour: getTopProduitsJour,
    getOrders: getOrders, getOrderById: getOrderById,
    ajouterEncaissementsDemo: function (n) { return copie(ajouterEncaissementsDemo(n)); }, encaissementsDepuis: encaissementsDepuis,
    dernierEncaissementDemo: function () { return DIRECT.dernier || 0; }, maintenantMin: maintenantMin,
    getReportTotalSales: getReportTotalSales, getReportProductsAndCategories: getReportProductsAndCategories, getReportClerkShifts: getReportClerkShifts,
    getObjectifs: getObjectifs, setObjectif: setObjectif, deleteObjectif: deleteObjectif, getRealTime: getRealTime,
    getHybridStock: getHybridStock, getAlertesStock: getAlertesStock, getStockMovements: getStockMovements, setStockMovement: setStockMovement, MOTIFS_PERTE: MOTIFS_PERTE,
    getReportProductData: getReportProductData, getReportModifiers: getReportModifiers, getEmployees: getEmployees,
    getReportCancelation: getReportCancelation, getReportLosses: getReportLosses, getReportDiscount: getReportDiscount,
    getReportTaxes: getReportTaxes, getReportPaymentMode: getReportPaymentMode, getReportCategories: getReportCategories,
    getSalesDistribution: getSalesDistribution, getCreneaux: getCreneaux, setCreneaux: setCreneaux, creneauxDefaut: CRENEAUX_DEFAUT,
    getReportMenuSales: getReportMenuSales, getNewHistoryZTill: getNewHistoryZTill, getReportById: getReportById,
    getFiscalArchives: getFiscalArchives, getContenuArchive: getContenuArchive, getRoomsReport: getRoomsReport,
    getProduct: getProduct, setProduct: setProduct, setProductsLot: setProductsLot, resetProduct: resetProduct,
    getGestionAchat: getGestionAchat, setGestionAchat: setGestionAchat, calculMarge: calculMarge,
    getWeatherDays: getWeatherDays, getWeatherForecast: getWeatherForecast, getWeatherImpact: getWeatherImpact, estimationMeteo: estimation,
    scoreMeteo: M.score, METEO_POIDS: M.POIDS,
    // Partagé avec donnees-gestion.js
    _: {
      S: S, SITES: SITES, CATEGORIES: CATEGORIES, PRODUITS: PRODUITS, GROUPES_OPTIONS: GROUPES_OPTIONS, TAXES: TAXES, EMPLOYES: EMPLOYES, SALLES: SALLES,
      MODES_PAIEMENT: MODES_PAIEMENT, REMISES: REMISES, FORMULES: FORMULES, CLIENTS: CLIENTS, CLIENT_PAR_ID: CLIENT_PAR_ID, VISITES: VISITES, IMPAYES: IMPAYES, PRENOMS: PRENOMS, NOMS: NOMS,
      graine: graine, entre: entre, choisir: choisir, pondere: pondere, arrondi: arrondi, deux: deux, jourIso: jourIso, decaler: decaler, date: date, copie: copie, reponse: reponse, hhmm: hhmm,
      hash: hash, maintenantMin: maintenantMin, jourVisible: jourVisible, jourComplet: jourComplet, totalItem: totalItem, produitParId: produitParId, paiementsDe: paiementsDe,
      tousProduits: tousProduits, couleurCategorie: couleurCategorie, poles: poles, AUJ_ISO: AUJ_ISO, OUVERTURE: OUVERTURE, edits: edits, sauverEdits: sauverEdits
    }
  };
})();
