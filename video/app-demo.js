/*
 * app-demo.js : ouvre la démo Up'Pina dans Chromium (Playwright) à une heure simulée.
 * - Les fichiers du dépôt sont servis sous http://uppina.demo/ (interception Playwright, aucun serveur).
 * - La police Poppins (prévue par style.css) est injectée depuis @fontsource/poppins.
 * - Les appels Open-Meteo sont coupés : la démo bascule sur sa météo simulée, stable pour une date.
 */
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

const RACINE = path.resolve(__dirname, "..");
const POLICES = path.join(__dirname, "node_modules", "@fontsource", "poppins", "files");
const HOTE = "http://uppina.demo/";
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png" };

function cssPolices() {
  return [300, 400, 500, 600, 700, 800].map(function (g) {
    return "@font-face{font-family:'Poppins';font-style:normal;font-weight:" + g + ";font-display:block;src:url(/__polices/poppins-latin-" + g + "-normal.woff2) format('woff2');}";
  }).join("\n");
}

// Chromium en français : sans LANG / LANGUAGE, les champs date et heure s'affichent à l'américaine (AM/PM)
function lancer() {
  return chromium.launch({ args: ["--lang=fr-FR"], env: Object.assign({}, process.env, { LANG: "fr_FR.UTF-8", LANGUAGE: "fr_FR:fr" }) });
}

async function ouvrir(options) {
  const o = Object.assign({ largeur: 1440, hauteur: 810, echelle: 2, heure: "2026-11-21T12:45:00", navigateur: null, graine: 1, pause: false }, options || {});
  const navigateur = o.navigateur || await lancer();
  const contexte = await navigateur.newContext({
    viewport: { width: o.largeur, height: o.hauteur }, deviceScaleFactor: o.echelle,
    timezoneId: "Europe/Paris", locale: "fr-FR", colorScheme: "light", reducedMotion: "no-preference"
  });
  // Hasard reproductible (encaissements de démo, délais) : mêmes captures à chaque lancement
  await contexte.addInitScript(function (graine) {
    var a = graine >>> 0;
    Math.random = function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }, o.graine);
  await contexte.route(/open-meteo\.com/, function (r) { return r.abort("internetdisconnected"); });
  await contexte.route(HOTE + "**", async function (r) {
    const url = new URL(r.request().url());
    let p = decodeURIComponent(url.pathname);
    if (p.indexOf("/__polices/") === 0) return r.fulfill({ path: path.join(POLICES, path.basename(p)), headers: { "content-type": "font/woff2" } });
    if (p === "/") p = "/index.html";
    const f = path.join(RACINE, p);
    if (!f.startsWith(RACINE) || !fs.existsSync(f)) return r.fulfill({ status: 404, body: "introuvable" });
    let corps = fs.readFileSync(f);
    if (p === "/style.css") corps = Buffer.concat([Buffer.from(cssPolices() + "\n"), corps]);
    return r.fulfill({ body: corps, headers: { "content-type": TYPES[path.extname(f)] || "application/octet-stream" } });
  });
  const page = await contexte.newPage();
  page.on("pageerror", function (e) { console.error("[page] " + e.message); });
  // Heure simulée (fuseau de Paris). Sans pause, le temps s'écoule ensuite normalement ; avec pause, il n'avance
  // que par page.clock.runFor() : la séquence devient reproductible à la milliseconde (contenu des encaissements de démo).
  const debut = new Date(o.heure + "+01:00");
  await page.clock.install({ time: debut });
  if (o.pause) await page.clock.pauseAt(new Date(debut.getTime() + 100));
  page.__enPause = !!o.pause;
  return { navigateur, contexte, page, fermer: async function () { await contexte.close(); if (!o.navigateur) await navigateur.close(); } };
}

// Laisse passer du temps : temps simulé si l'horloge est en pause, temps réel sinon
async function patienter(page, ms) {
  if (page.__enPause) { await page.clock.runFor(ms); await page.waitForTimeout(Math.min(ms, 300)); }
  else await page.waitForTimeout(ms);
}

// Va sur une route de la démo et attend la fin du chargement
async function aller(page, route, attente) {
  const cible = HOTE + "index.html#" + route;
  if (!page.url().startsWith(HOTE)) await page.goto(cible);
  else await page.evaluate(function (r) { location.hash = r; }, route);
  for (let i = 0; i < 1200; i++) {
    const pret = await page.evaluate(function () { var p = document.getElementById("page"); return !!p && p.children.length > 0 && !p.querySelector(".chargement"); });
    if (pret) break;
    if (page.__enPause) await page.clock.runFor(50); else await page.waitForTimeout(50);
  }
  await page.evaluate(function () { return document.fonts.ready; });
  await patienter(page, attente === undefined ? 900 : attente);
}

module.exports = { lancer, ouvrir, aller, patienter, HOTE };
