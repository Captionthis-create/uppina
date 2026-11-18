/*
 * captures.js : captures HD (×2) de la démo Up'Pina pour la vidéo, aux 5 heures du samedi 21 novembre 2026.
 * Sortie : build/captures/<nom>.png et build/captures/captures.json
 *   - taille de chaque capture en pixels CSS,
 *   - rectangles [x, y, l, h] des éléments utiles (même repère que l'image),
 *   - quelques chiffres lus à l'écran (pour caler la voix off).
 * Usage : node captures.js            (toutes les heures)
 *         node captures.js midi soir  (seulement certaines)
 */
const fs = require("fs");
const path = require("path");
const { lancer, ouvrir, aller, patienter } = require("./app-demo");

const SORTIE = path.join(__dirname, "build", "captures");
const FICHIER_META = path.join(SORTIE, "captures.json");
const JOUR = "2026-11-21";
// Graine du hasard de la démo : avec elle, la vente de 12h44 (Salle S1) contient un Cidre doux 75cl (stock 3 → 2)
const GRAINE = 1;
fs.mkdirSync(SORTIE, { recursive: true });
const meta = fs.existsSync(FICHIER_META) ? JSON.parse(fs.readFileSync(FICHIER_META, "utf8")) : { jour: JOUR, captures: {}, textes: {} };

// ---------------------------------------------------------------------------------------------
// Outils injectés dans la page
// ---------------------------------------------------------------------------------------------
async function outiller(page) {
  await page.evaluate(() => {
    if (!document.getElementById("__video")) {
      const s = document.createElement("style");
      s.id = "__video";
      s.textContent = [
        "body.v-sans-notifs .pile-encaissements, body.v-sans-notifs .toast { visibility: hidden !important; }",
        "body.v-sans-flottants .chat-bouton, body.v-sans-flottants .chat-nouveau { visibility: hidden !important; }",
        "input, textarea { caret-color: transparent !important; }",
        ".tuile.flash { animation: none !important; }"
      ].join("\n");
      document.head.appendChild(s);
    }
    window.__v = {
      carte(titre) {
        return Array.prototype.find.call(document.querySelectorAll(".carte"), function (c) {
          const h = c.querySelector(":scope > .carte-tete h2");
          return h && h.textContent.replace(/\s+/g, " ").trim().indexOf(titre) === 0;
        }) || null;
      },
      texte(sel) { const e = document.querySelector(sel); return e ? e.innerText.replace(/\s+/g, " ").trim() : ""; },
      ligne(sel, motif) { return Array.prototype.find.call(document.querySelectorAll(sel), function (e) { return e.innerText.indexOf(motif) >= 0; }) || null; }
    };
  });
}

async function notifs(page, visibles) {
  await page.evaluate((v) => document.body.classList.toggle("v-sans-notifs", !v), visibles);
}

// Rectangles des éléments demandés : { nom: "expression JS qui renvoie un élément" }
async function rectangles(page, demandes, mode, base) {
  return page.evaluate(({ demandes, mode, base }) => {
    const b = base ? eval(base) : null;
    const rb = b ? b.getBoundingClientRect() : null;
    const o = {};
    Object.keys(demandes).forEach(function (k) {
      let el = null;
      try { el = eval(demandes[k]); } catch (e) { el = null; }
      if (!el) { o[k] = null; return; }
      const r = el.getBoundingClientRect();
      let x = r.left, y = r.top;
      if (mode === "page") { x += scrollX; y += scrollY; }
      if (mode === "element") { x -= rb.left; y -= rb.top; }
      o[k] = [x, y, r.width, r.height].map(function (v) { return Math.round(v * 100) / 100; });
    });
    return o;
  }, { demandes, mode, base });
}

// mode "page" : page entière ; "ecran" : fenêtre visible ; "element" : un élément (base = expression JS)
async function prendre(page, nom, mode, demandes, base) {
  await page.mouse.move(2, 400);
  await page.evaluate(() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); });
  await page.evaluate((m) => document.body.classList.toggle("v-sans-flottants", m === "page"), mode);
  await page.waitForTimeout(150);
  const fichier = nom + ".png";
  let taille;
  if (mode === "page") {
    taille = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight]);
    await page.screenshot({ path: path.join(SORTIE, fichier), fullPage: true });
  } else if (mode === "ecran") {
    taille = await page.evaluate(() => [innerWidth, innerHeight]);
    await page.screenshot({ path: path.join(SORTIE, fichier) });
  } else {
    const el = await page.evaluateHandle((b) => eval(b), base);
    const r = await el.evaluate((e) => { const x = e.getBoundingClientRect(); return [x.width, x.height]; });
    taille = r;
    await el.screenshot({ path: path.join(SORTIE, fichier) });
  }
  const rects = demandes ? await rectangles(page, demandes, mode, base) : {};
  meta.captures[nom] = { fichier, mode, largeur: taille[0], hauteur: taille[1], rects };
  const manquants = Object.keys(rects).filter((k) => !rects[k]);
  console.log("  ✓ " + nom + " (" + taille.join("×") + ")" + (manquants.length ? "  ⚠ introuvables : " + manquants.join(", ") : ""));
  await page.evaluate(() => document.body.classList.remove("v-sans-flottants"));
}

async function lire(page, cle, expression) {
  meta.textes[cle] = await page.evaluate((e) => { try { return eval(e); } catch (x) { return null; } }, expression);
}

// Avance l'horloge simulée seconde par seconde jusqu'à l'arrivée d'une notification d'encaissement
async function attendreEncaissement(page, maxSecondes) {
  await page.evaluate(() => document.querySelectorAll(".notif-encaissement").forEach((n) => n.setAttribute("data-vu", "1")));
  for (let i = 0; i < maxSecondes; i++) {
    await page.clock.runFor(1000);
    const ok = await page.evaluate(() => !!document.querySelector(".notif-encaissement:not([data-vu])"));
    if (ok) {
      await page.clock.runFor(100);
      await page.waitForTimeout(700);
      return true;
    }
  }
  return false;
}

// Rectangles communs à l'accueil
const ACCUEIL = {
  entete: "document.querySelector('.entete')",
  cloche: "document.querySelector('.bouton-cloche')",
  tete: "document.querySelector('.accueil-tete')",
  meteoJour: "document.querySelector('.accueil-meteo')",
  kpis: "document.querySelector('#page .kpis')",
  tuileTTC: "document.querySelectorAll('#page .kpis .tuile')[0]",
  tuileHT: "document.querySelectorAll('#page .kpis .tuile')[1]",
  tuileCouverts: "document.querySelectorAll('#page .kpis .tuile')[2]",
  tuileMoyen: "document.querySelectorAll('#page .kpis .tuile')[3]",
  encaissements: "__v.carte('Derniers encaissements')",
  listeEnc: "document.querySelector('.fil-direct')",
  enc1: "document.querySelectorAll('.fil-direct .fd-ligne')[0]",
  enc2: "document.querySelectorAll('.fil-direct .fd-ligne')[1]",
  objectif: "__v.carte('Objectif')",
  midiSoir: "__v.carte('Midi / soir')",
  alertes: "__v.carte('Alertes de stock')",
  meteo: "__v.carte('Météo des 7 prochains jours')",
  meteoJ1: "document.querySelectorAll('.meteo-grille .meteo-jour')[0]",
  resa: "__v.carte('Réservations')",
  top: "__v.carte('Meilleures ventes')",
  assistant: "document.querySelector('.assistant-accueil')",
  sousTitre: "document.querySelector('.accueil-sous')",
  meteoScore: "document.querySelector('.accueil-meteo .score')",
  deltaTTC: "document.querySelectorAll('#page .kpis .tuile-delta')[0]",
  deltaHT: "document.querySelectorAll('#page .kpis .tuile-delta')[1]",
  deltaCouverts: "document.querySelectorAll('#page .kpis .tuile-delta')[2]",
  deltaMoyen: "document.querySelectorAll('#page .kpis .tuile-delta')[3]",
  enc3: "document.querySelectorAll('.fil-direct .fd-ligne')[2]",
  enc4: "document.querySelectorAll('.fil-direct .fd-ligne')[3]",
  objPct: "document.querySelector('.obj-accueil .obj-haut')",
  objBarre: "document.querySelector('.obj-accueil .obj-barre')",
  objDetail: "document.querySelector('.obj-accueil .obj-detail')",
  objEcart: "document.querySelector('.obj-accueil .obj-detail > div')",
  msCumul: "document.querySelector('.ms-cumul')",
  msMidi: "document.querySelectorAll('.ms-bloc')[0]",
  msSoir: "document.querySelectorAll('.ms-bloc')[1]",
  msNote: "Array.prototype.slice.call(document.querySelectorAll('.ms-corps > .doux')).pop()",
  alerteBlanc: "__v.ligne('.liste-alertes .la-ligne', 'Blanc')",
  alerteCidre: "__v.ligne('.liste-alertes .la-ligne', 'Cidre doux')",
  resaResume: "document.querySelector('.resa-resume')"
};

// ---------------------------------------------------------------------------------------------
// 8h05 : ouverture
// ---------------------------------------------------------------------------------------------
async function matin(navigateur) {
  console.log("08:05 · ouverture");
  const { page, fermer } = await ouvrir({ navigateur, graine: GRAINE, heure: JOUR + "T08:05:00" });
  await aller(page, "/", 3500); await outiller(page); await notifs(page, false);
  await prendre(page, "matin-accueil", "page", ACCUEIL);
  await lire(page, "matin.objectif", "__v.texte('.obj-accueil')");
  await lire(page, "matin.resa", "__v.texte('.resa-resume')");
  await lire(page, "matin.meteo", "__v.texte('.accueil-meteo')");
  await aller(page, "/reports/forecast"); await outiller(page); await notifs(page, false);
  await prendre(page, "matin-previsions", "page", {
    kpis: "document.querySelector('#page .kpis')",
    grille: "__v.carte('Les 16 prochains jours')",
    j1: "document.querySelectorAll('.meteo-grille .meteo-jour')[0]",
    j2: "document.querySelectorAll('.meteo-grille .meteo-jour')[1]",
    j5: "document.querySelectorAll('.meteo-grille .meteo-jour')[4]",
    j1Score: "document.querySelector('.meteo-grille .meteo-jour .score')",
    j1Ca: "document.querySelector('.meteo-grille .meteo-jour .mj-ca')",
    j5Score: "document.querySelectorAll('.meteo-grille .meteo-jour')[4].querySelector('.score')",
    k1: "document.querySelectorAll('#page .kpis .kpi')[0]",
    k2: "document.querySelectorAll('#page .kpis .kpi')[1]",
    k3: "document.querySelectorAll('#page .kpis .kpi')[2]",
    k4: "document.querySelectorAll('#page .kpis .kpi')[3]",
    note: "Array.prototype.slice.call(document.querySelectorAll('#page p.doux')).pop()",
    menu: "document.querySelector('.menu-lateral, .lateral, nav.menu, aside')"
  });
  await lire(page, "matin.previsions", "__v.texte('#page .kpis')");
  await fermer();
}

// ---------------------------------------------------------------------------------------------
// 12h45 : coup de feu (encaissements en direct, stocks)
// ---------------------------------------------------------------------------------------------
// Séquence « en direct » de l'accueil, pilotée uniquement par l'horloge simulée (donc reproductible).
// capturer = true : prend les captures ; false : se contente de résumer (recherche de graine).
async function sequenceDirect(page, capturer) {
  await aller(page, "/", 1000);   // arrivée sur l'accueil : 1 à 3 encaissements de démo et leur notification
  await outiller(page);
  await patienter(page, 8000);    // la notification d'arrivée disparaît
  if (capturer) { await notifs(page, false); await prendre(page, "midi-accueil-0", "page", ACCUEIL); }
  const resume = { notifs: [] };
  for (let k = 1; k <= 3; k++) {
    const ok = await attendreEncaissement(page, 75);
    if (!ok) { console.log("  ⚠ pas de nouvel encaissement"); break; }
    const texte = await page.evaluate(() => Array.prototype.slice.call(document.querySelectorAll(".notif-encaissement")).pop().textContent.replace(/\s+/g, " ").trim());
    resume.notifs.push(texte);
    if (capturer) {
      meta.textes["midi.notif" + k] = texte;
      await notifs(page, true);
      await prendre(page, "midi-notif-" + k, "element", null, "Array.prototype.slice.call(document.querySelectorAll('.notif-encaissement')).pop()");
      await notifs(page, false);
      await prendre(page, "midi-accueil-" + k, "page", ACCUEIL);
    }
    await page.clock.runFor(3000); // fin de la surbrillance verte (minuteur de l'application)
    await page.waitForTimeout(1500); // fondu CSS du fond (temps réel)
    if (capturer) await prendre(page, "midi-accueil-" + k + "b", "page", ACCUEIL);
  }
  Object.assign(resume, await page.evaluate(() => ({
    kpis: __v.texte("#page .kpis"),
    lignes: Array.prototype.slice.call(document.querySelectorAll(".fil-direct .fd-ligne"), 0, 4).map((l) => l.innerText.replace(/\s+/g, " ")).join(" || "),
    alertes: __v.texte(".liste-alertes"),
    heure: new Date().toTimeString().slice(0, 8)
  })));
  return resume;
}

async function midi(navigateur) {
  console.log("12:45 · coup de feu");
  const { page, fermer } = await ouvrir({ navigateur, graine: GRAINE, heure: JOUR + "T12:44:10", pause: true });
  const r = await sequenceDirect(page, true);
  meta.textes["midi.kpis"] = r.kpis; meta.textes["midi.alertes"] = r.alertes; meta.textes["midi.heure"] = r.heure; meta.textes["midi.lignes"] = r.lignes;
  await page.clock.resume();
  page.__enPause = false;

  // Cloche d'alertes ouverte
  await page.click(".bouton-cloche"); await page.waitForTimeout(500);
  await prendre(page, "midi-cloche", "ecran", { menu: "document.getElementById('menu-alertes')", cloche: "document.querySelector('.bouton-cloche')" });
  await page.mouse.click(700, 760); await page.waitForTimeout(300);

  // Message d'alerte de stock, tel que l'application l'affiche
  await notifs(page, true);
  const alerte = await page.evaluate(() => { const l = document.querySelectorAll('.liste-alertes .la-ligne'); return l.length ? l[l.length - 1].innerText.split("\n") : null; });
  await page.evaluate(() => {
    document.querySelectorAll(".toast").forEach((t) => t.remove());
    return DonneesTest.getAlertesStock().then((l) => {
      const a = l.filter((x) => x.quantity > 0).pop() || l[0];
      App.info("Alerte stock : " + a.productName + " a atteint son seuil (" + a.quantity + " ≤ " + a.seuil + ").");
    });
  });
  await page.waitForTimeout(500);
  await prendre(page, "midi-toast-alerte", "element", null, "document.querySelector('.toast.visible')");
  await page.waitForTimeout(3200);

  // Tableau des stocks
  await aller(page, "/reports/stocks"); await outiller(page); await notifs(page, false);
  const STOCKS = {
    carte: "__v.carte('Tableau des stocks')",
    entete: "document.querySelector('.entete')",
    cloche: "document.querySelector('.bouton-cloche')",
    filtreSeuil: "document.querySelector('[data-act=stkAlertes]')",
    cidre: "__v.ligne('#page tbody tr', 'Cidre doux')",
    blanc: "__v.ligne('#page tbody tr', 'Blanc bouteille')",
    crayonCidre: "__v.ligne('#page tbody tr', 'Cidre doux').querySelector('[data-act=stkEdit]')",
    cidreStock: "__v.ligne('#page tbody tr', 'Cidre doux').querySelectorAll('td')[4]",
    blancStock: "__v.ligne('#page tbody tr', 'Blanc bouteille').querySelectorAll('td')[4]"
  };
  await prendre(page, "midi-stocks", "ecran", STOCKS);
  await lire(page, "midi.stockCidre", "__v.ligne('#page tbody tr', 'Cidre doux').innerText.replace(/\\s+/g, ' ')");
  // Fiche du produit : historique et saisie d'une livraison
  await page.evaluate(() => __v.ligne("#page tbody tr", "Cidre doux").querySelector("[data-act=stkEdit]").click());
  await page.waitForTimeout(700);
  const TIROIR_STOCK = {
    tiroir: "document.querySelector('.tiroir')",
    titre: "document.querySelector('.tiroir .tiroir-tete')",
    types: "document.querySelector('.tiroir .stk-type')",
    quantite: "document.getElementById('stk-q')",
    commentaire: "document.getElementById('stk-note')",
    historique: "document.querySelector('.tiroir .stk-titre')",
    tableau: "document.querySelector('.tiroir table')",
    enregistrer: "document.querySelector('.tiroir [data-valider]')"
  };
  await prendre(page, "midi-stock-tiroir-vide", "ecran", TIROIR_STOCK);
  await prendre(page, "midi-stock-tiroir-seul-vide", "element", { quantite: TIROIR_STOCK.quantite, commentaire: TIROIR_STOCK.commentaire, enregistrer: TIROIR_STOCK.enregistrer, tableau: TIROIR_STOCK.tableau, types: TIROIR_STOCK.types }, "document.querySelector('.tiroir')");
  await page.fill("#stk-q", "12");
  await page.fill("#stk-note", "Livraison du fournisseur");
  await prendre(page, "midi-stock-tiroir-seul-rempli", "element", { quantite: TIROIR_STOCK.quantite, commentaire: TIROIR_STOCK.commentaire, enregistrer: TIROIR_STOCK.enregistrer }, "document.querySelector('.tiroir')");
  await notifs(page, true);
  await page.click(".tiroir [data-valider]");
  await page.waitForTimeout(600);
  await prendre(page, "midi-toast-stock", "element", null, "document.querySelector('.toast.visible')");
  await lire(page, "midi.toastStock", "__v.texte('.toast.visible')");
  await notifs(page, false);
  await page.waitForTimeout(400);
  await prendre(page, "midi-stocks-apres", "ecran", STOCKS);
  await fermer();
}

// ---------------------------------------------------------------------------------------------
// 16h30 : limonade (créneaux de service, bons cadeaux)
// ---------------------------------------------------------------------------------------------
async function aprem(navigateur) {
  console.log("16:30 · limonade");
  const { page, fermer } = await ouvrir({ navigateur, graine: GRAINE, heure: JOUR + "T16:30:00" });
  await aller(page, "/", 3500); await outiller(page); await notifs(page, false);
  await prendre(page, "aprem-accueil", "page", ACCUEIL);
  await lire(page, "aprem.midiSoir", "__v.texte('.ms-corps')");
  await aller(page, "/point-of-sale/settings/service-slots"); await outiller(page); await notifs(page, false);
  await prendre(page, "aprem-creneaux", "ecran", {
    carte: "__v.carte('Créneaux de service')",
    explication: "document.querySelector('.cren-edit p.doux')",
    nombre: "document.querySelectorAll('.cren-ligne')[0]",
    c1: "document.querySelectorAll('.cren-ligne')[1]",
    c2: "document.querySelectorAll('.cren-ligne')[2]",
    c3: "document.querySelectorAll('.cren-ligne')[3]",
    actions: "document.querySelector('.cren-actions')",
    menu: "__v.ligne('a', 'Créneaux de service')"
  });
  await aller(page, "/reports/sales-report/sales-distribution"); await outiller(page); await notifs(page, false);
  await prendre(page, "aprem-repartition", "page", {
    creneaux: "__v.carte('Ventes par créneau de service')",
    jours: "__v.carte('Ventes par jour de la semaine')",
    creneauxCorps: "__v.carte('Ventes par créneau de service').querySelector('.carte-corps')"
  });

  // Bons cadeaux : liste, création, expirations
  await aller(page, "/customers/vouchers"); await outiller(page); await notifs(page, false);
  const BONS = {
    kpis: "document.querySelector('#page .kpis')",
    kActifs: "document.querySelectorAll('#page .kpis .kpi')[0]",
    kSolde: "document.querySelectorAll('#page .kpis .kpi')[1]",
    kExpirent: "document.querySelectorAll('#page .kpis .kpi')[2]",
    kExpire: "document.querySelectorAll('#page .kpis .kpi')[3]",
    carte: "__v.carte('Bons cadeaux')",
    onglets: "document.querySelector('#page .onglets-bouton')",
    tabProche: "document.querySelector('[data-act=bonFiltre][data-val=proche]')",
    l1: "document.querySelectorAll('#page tbody tr')[0]",
    l2: "document.querySelectorAll('#page tbody tr')[1]",
    l3: "document.querySelectorAll('#page tbody tr')[2]",
    creer: "document.querySelector('[data-act=bonNouveau]')"
  };
  await prendre(page, "aprem-bons", "ecran", BONS);
  await lire(page, "aprem.bonsKpis", "__v.texte('#page .kpis')");
  await page.click("[data-act=bonNouveau]"); await page.waitForTimeout(500);
  const TIROIR_BON = {
    apercu: "document.getElementById('bon-apercu')",
    montant: "document.getElementById('bon-montant')",
    chips: "document.querySelector('.tiroir .bon-chips')",
    chip50: "document.querySelector('[data-montant=\"50\"]')",
    fin: "document.getElementById('bon-fin')",
    chip1an: "document.querySelector('[data-mois=\"12\"]')",
    client: "document.getElementById('bon-client')",
    note: "document.getElementById('bon-note')",
    creer: "document.querySelector('.tiroir [data-valider]')"
  };
  await prendre(page, "aprem-bon-tiroir-vide", "element", TIROIR_BON, "document.querySelector('.tiroir')");
  await page.click("[data-montant='50']"); await page.waitForTimeout(200);
  await prendre(page, "aprem-bon-tiroir-50", "element", TIROIR_BON, "document.querySelector('.tiroir')");
  await page.fill("#bon-note", "Anniversaire"); await page.dispatchEvent("#bon-note", "input"); await page.waitForTimeout(200);
  await prendre(page, "aprem-bon-tiroir-rempli", "element", TIROIR_BON, "document.querySelector('.tiroir')");
  await prendre(page, "aprem-bon-ecran", "ecran", { tiroir: "document.querySelector('.tiroir')" });
  await notifs(page, true);
  await page.click(".tiroir [data-valider]"); await page.waitForTimeout(600);
  await prendre(page, "aprem-toast-bon", "element", null, "document.querySelector('.toast.visible')");
  await lire(page, "aprem.toastBon", "__v.texte('.toast.visible')");
  await notifs(page, false);
  await page.evaluate(() => { App.etat["/customers/vouchers"].tri = "recent"; App.ctxCourant.rafraichir(); });
  await page.waitForTimeout(800);
  await prendre(page, "aprem-bons-apres", "ecran", BONS);
  await lire(page, "aprem.bonsKpisApres", "__v.texte('#page .kpis')");
  await page.evaluate(() => { App.etat["/customers/vouchers"].tri = "fin"; App.ctxCourant.rafraichir(); });
  await page.waitForTimeout(500);
  await page.click("[data-act=bonFiltre][data-val=proche]"); await page.waitForTimeout(700);
  await prendre(page, "aprem-bons-30j", "ecran", BONS);
  await fermer();
}

// ---------------------------------------------------------------------------------------------
// 19h30 : soir (réservations)
// ---------------------------------------------------------------------------------------------
async function soir(navigateur) {
  console.log("19:30 · soir");
  const { page, fermer } = await ouvrir({ navigateur, graine: GRAINE, heure: JOUR + "T19:30:00" });
  await aller(page, "/", 3500); await outiller(page); await notifs(page, false);
  await prendre(page, "soir-accueil", "page", ACCUEIL);
  await lire(page, "soir.resa", "__v.texte('.resa-resume')");
  await aller(page, "/reservations"); await outiller(page); await notifs(page, false);
  const RESAS = {
    kpis: "document.querySelector('#page .kpis')",
    carte: "__v.carte('Réservations')",
    onglets: "document.querySelector('#page .onglets-bouton')",
    tableau: "document.querySelector('#page table')",
    ajouter: "document.querySelector('[data-act=resaAjout]')",
    david: "__v.ligne('#page tbody tr', 'Mme David')",
    allergie: "__v.ligne('#page tbody tr', 'Allergie')",
    legall: "__v.ligne('#page tbody tr', 'M. Le Gall')",
    tabToutes: "document.querySelectorAll('[data-act=onglet]')[0]",
    tabAttente: "document.querySelectorAll('[data-act=onglet]')[1]",
    tabRetard: "document.querySelectorAll('[data-act=onglet]')[2]",
    tabArrives: "document.querySelectorAll('[data-act=onglet]')[3]"
  };
  await prendre(page, "soir-resas", "page", RESAS);
  await lire(page, "soir.onglets", "__v.texte('#page .onglets-bouton')");
  await page.click("[data-act=resaAjout]"); await page.waitForTimeout(500);
  const TIROIR_RESA = {
    nom: "document.getElementById('rs-nom')", tel: "document.getElementById('rs-tel')", date: "document.getElementById('rs-date')",
    heure: "document.getElementById('rs-heure')", couverts: "document.getElementById('rs-couverts')", note: "document.getElementById('rs-note')",
    sms: "document.querySelector('.tiroir .tiroir-tete .doux')", ok: "document.querySelector('.tiroir [data-form-ok]')"
  };
  await prendre(page, "soir-resa-tiroir-vide", "element", TIROIR_RESA, "document.querySelector('.tiroir')");
  await page.fill("#rs-nom", "M. Le Gall"); await page.fill("#rs-tel", "06 39 98 42 17"); // plage réservée à la fiction (ARCEP)
  await page.fill("#rs-heure", "21:00"); await page.fill("#rs-couverts", "4"); await page.fill("#rs-note", "Table au calme");
  await prendre(page, "soir-resa-tiroir-rempli", "element", TIROIR_RESA, "document.querySelector('.tiroir')");
  await notifs(page, true);
  await page.click(".tiroir [data-form-ok]"); await page.waitForTimeout(600);
  await prendre(page, "soir-toast-resa", "element", null, "document.querySelector('.toast.visible')");
  await lire(page, "soir.toastResa", "__v.texte('.toast.visible')");
  await notifs(page, false); await page.waitForTimeout(2600);
  await prendre(page, "soir-resas-apres", "page", RESAS);
  // Changer le statut d'une réservation en retard
  await page.evaluate(() => { const l = __v.ligne('#page tbody tr', 'Mme David'); l.querySelector('[data-act=resaVoir]').click(); });
  await page.waitForTimeout(500);
  await prendre(page, "soir-resa-statut", "element", {
    statuts: "document.querySelector('.tiroir .resa-statuts')",
    arrive: "document.querySelector('.tiroir [data-statut=\"Arrivé\"]')",
    retard: "document.querySelector('.tiroir [data-statut=\"En retard\"]')"
  }, "document.querySelector('.tiroir')");
  await notifs(page, true);
  await page.click(".tiroir [data-statut='Arrivé']"); await page.waitForTimeout(600);
  await prendre(page, "soir-toast-statut", "element", null, "document.querySelector('.toast.visible')");
  await lire(page, "soir.toastStatut", "__v.texte('.toast.visible')");
  await notifs(page, false); await page.waitForTimeout(400);
  await prendre(page, "soir-resas-arrive", "page", RESAS);
  await fermer();
}

// ---------------------------------------------------------------------------------------------
// 23h15 : clôture (Pop'IA, objectifs, export comptable)
// ---------------------------------------------------------------------------------------------
const QUESTIONS = [
  "CA des samedis midi des 6 dernières semaines en barres",
  "Combien de crêpes vendues au goûter cette semaine ?",
  "Top 10 des produits ce mois-ci"
];
async function nuit(navigateur) {
  console.log("23:15 · clôture");
  const { page, contexte, fermer } = await ouvrir({ navigateur, graine: GRAINE, heure: JOUR + "T23:15:00" });
  await aller(page, "/", 3500); await outiller(page); await notifs(page, false);
  await prendre(page, "nuit-accueil", "page", ACCUEIL);
  await lire(page, "nuit.kpis", "__v.texte('#page .kpis')");
  await lire(page, "nuit.objectif", "__v.texte('.obj-accueil')");
  await lire(page, "nuit.sousTitre", "__v.texte('.accueil-sous')");

  // Pop'IA en grand
  await page.evaluate(() => { App.chatbot.ouvrir(); document.getElementById("chat-panneau").classList.add("large"); });
  await page.waitForTimeout(300);
  await prendre(page, "nuit-popia-ecran", "ecran", { panneau: "document.getElementById('chat-panneau')", bouton: "document.getElementById('chat-bouton')" });
  const PANNEAU = "document.getElementById('chat-panneau')";
  for (let k = 0; k < QUESTIONS.length; k++) {
    await page.evaluate(() => { document.getElementById("chat-fil").innerHTML = ""; });
    await page.fill("#chat-champ", "");
    await prendre(page, "nuit-popia-" + (k + 1) + "-vide", "element", { champ: "document.getElementById('chat-champ')", envoyer: "document.querySelector('.chat-saisie button')" }, PANNEAU);
    await page.fill("#chat-champ", QUESTIONS[k]);
    await prendre(page, "nuit-popia-" + (k + 1) + "-saisie", "element", { champ: "document.getElementById('chat-champ')", texte: "document.getElementById('chat-champ')" }, PANNEAU);
    await page.click(".chat-saisie button");
    await page.waitForTimeout(1200);
    await page.evaluate(() => { const f = document.getElementById("chat-fil"); f.scrollTop = 0; });
    await prendre(page, "nuit-popia-" + (k + 1), "element", {
      question: "document.querySelector('#chat-fil .chat-moi')",
      reponse: "Array.prototype.slice.call(document.querySelectorAll('#chat-fil .chat-lui')).pop()",
      fil: "document.getElementById('chat-fil')"
    }, PANNEAU);
    await lire(page, "nuit.popia" + (k + 1), "Array.prototype.slice.call(document.querySelectorAll('#chat-fil .chat-lui')).pop().innerText.replace(/\\s+/g, ' ').slice(0, 300)");
  }
  await page.evaluate(() => { document.querySelector("[data-chat=toggle]").click(); });

  // Objectifs
  await aller(page, "/reports/objectifs"); await outiller(page); await notifs(page, false);
  const NOV = "Array.prototype.find.call(document.querySelectorAll('.carte'), c => c.innerText.indexOf('Objectif de novembre') === 0)";
  await prendre(page, "nuit-objectifs", "page", {
    novembre: NOV,
    novCA: NOV + ".querySelector('.obj-bloc')",
    novPct: NOV + ".querySelector('.obj-haut')",
    novBarre: NOV + ".querySelector('.obj-barre')",
    novEcart: NOV + ".querySelectorAll('.obj-detail > div')[1]",
    novProj: NOV + ".querySelectorAll('.obj-detail > div')[2]",
    novCouverts: NOV + ".querySelectorAll('.obj-bloc')[1]",
    novGraphe: NOV + ".querySelector('svg')"
  });
  await lire(page, "nuit.objectifs", "Array.prototype.find.call(document.querySelectorAll('.carte'), c => c.innerText.indexOf('Objectif de novembre') >= 0).innerText.replace(/\\s+/g, ' ').slice(0, 400)");

  // Export comptable (période : ce mois-ci)
  await aller(page, "/reports/sales-report/accounting-export", 1500); await outiller(page); await notifs(page, false);
  const EXPORT = {
    filtres: "document.querySelector('.filtres, .barre-filtres, #filtres')",
    kpis: "document.querySelector('#cpt-kpis .kpis')",
    k1: "document.querySelectorAll('#cpt-kpis .kpi')[0]",
    k2: "document.querySelectorAll('#cpt-kpis .kpi')[1]",
    k3: "document.querySelectorAll('#cpt-kpis .kpi')[2]",
    k4: "document.querySelectorAll('#cpt-kpis .kpi')[3]",
    parametrage: "__v.carte('Paramétrage')",
    format: "document.querySelector('.cpt-grille .segment')",
    tva: "__v.carte('Ventes et TVA collectée par taux')",
    paiements: "__v.carte('Encaissements par mode de paiement')",
    telecharger: "document.querySelector('[data-act=comptaExport]')"
  };
  await prendre(page, "nuit-export", "page", EXPORT);
  await lire(page, "nuit.exportKpis", "__v.texte('#cpt-kpis')");
  await notifs(page, true);
  const [telechargement] = await Promise.all([page.waitForEvent("download"), page.click("[data-act=comptaExport]")]);
  await page.waitForTimeout(500);
  await prendre(page, "nuit-toast-export", "element", null, "document.querySelector('.toast.visible')");
  await lire(page, "nuit.toastExport", "__v.texte('.toast.visible')");
  const cheminFec = path.join(SORTIE, "export-fec.txt");
  await telechargement.saveAs(cheminFec);
  meta.textes["nuit.fichierFec"] = telechargement.suggestedFilename();
  meta.textes["nuit.fecDebut"] = fs.readFileSync(cheminFec, "utf8").split(/\r?\n/).slice(0, 14);
  await fermer();
}

// node captures.js chercher 1 2 3 : résume la séquence de midi pour plusieurs graines (sans capture)
async function chercher(navigateur, graines) {
  for (const g of graines) {
    const { page, fermer } = await ouvrir({ navigateur, graine: g, heure: JOUR + "T12:44:10", pause: true, echelle: 1 });
    const r = await sequenceDirect(page, false);
    console.log("graine " + g + " | " + r.kpis.replace(/ vs samedi dernier à la même heure/g, "").replace(/Direct /g, "") + "\n   " + r.notifs.join(" / ") + "\n   " + r.lignes + "\n   alertes : " + r.alertes);
    await fermer();
  }
}

(async () => {
  const quoi = process.argv.slice(2);
  if (quoi[0] === "chercher") {
    const nav = await lancer();
    try { await chercher(nav, quoi.slice(1).map(Number)); } finally { await nav.close(); }
    return;
  }
  const tout = { matin, midi, aprem, soir, nuit };
  const liste = quoi.length ? quoi : Object.keys(tout);
  const navigateur = await lancer();
  try {
    for (const q of liste) await tout[q](navigateur);
  } finally {
    await navigateur.close();
    fs.writeFileSync(FICHIER_META, JSON.stringify(meta, null, 1));
  }
  console.log("Métadonnées : " + FICHIER_META);
})();
