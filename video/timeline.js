/*
 * timeline.js : place chaque phrase de la voix off dans le temps.
 * Entrées : scenario.json, build/voix/durees.json, build/captures/captures.json
 * Usage   : node timeline.js            (node timeline.js --estimer : estime les durées des phrases sans voix)
 * Sorties : build/timeline.json (minutage), build/timeline.js (même chose + captures, pour la scène animée),
 *           build/uppina-accueil.srt (sous-titres)
 */
const fs = require("fs");
const path = require("path");

const ICI = __dirname;
const sc = JSON.parse(fs.readFileSync(path.join(ICI, "scenario.json"), "utf8"));
const durees = JSON.parse(fs.readFileSync(path.join(ICI, "build", "voix", "durees.json"), "utf8"));
const captures = JSON.parse(fs.readFileSync(path.join(ICI, "build", "captures", "captures.json"), "utf8"));
// Tout le minutage est en « temps du film » (celui de la chorégraphie). À la sortie, le film est accéléré de VITESSE :
// l'image de l'instant t montre le film à t × VITESSE. Chaque phrase de la voix est accélérée de v (au plus VITESSE,
// voix.accelerationMax et DEBIT_MAX mots par seconde) ; une phrase moins accélérée occupe d × VITESSE / v de film.
const VITESSE = sc.vitesse || 1;
const ACCEL_VOIX = sc.voix.accelerationMax === undefined ? VITESSE : sc.voix.accelerationMax;
const DEBIT_MAX = 3.6;
const ESTIMER = process.argv.includes("--estimer");  // durées manquantes estimées (aperçu avant la voix)
const estimees = [];
const FPS = 30;
const AMORCE = 2.0;        // animation du logo avant la première phrase
const ECART = 0.3;         // silence entre deux phrases d'un même module
const TRANSITION = 0.85;   // silence entre deux modules (carton « Nouveau »)
const FIN = 6.0;           // générique après la dernière phrase
// Durée d'écran minimale de certaines phrases (s, depuis leur début) : le temps que jouent leurs animations
const MIN_ECRAN = {
  a2: 6.0, a3: 5.6, b2: 5.6, b3: 7.6, c2: 7.2, c3: 5.6, c4: 5.4, e2: 5.8, e3: 3.6,
  r2: 6.0, r3: 7.2, r4: 4.6, g2: 6.6, g3: 4.4, o2: 4.6, o3: 5.2, p1: 2.6, p2: 5.2, p3: 3.4, p4: 4.0, x2: 7.0
};
// Temps supplémentaire après certaines phrases : cartons, bandeaux « L'avantage »
const APRES = {
  i2: 0.7,
  a1: 0.2, b1: 0.2, c1: 0.2, e1: 0.2, r1: 0.2, g1: 0.2, o1: 0.2, x1: 0.2,
  a4: 0.6, b4: 0.6, c5: 0.6, e4: 0.6, r5: 0.6, g4: 0.6, o4: 0.6, p5: 0.6, x3: 1.0
};

const r3 = (x) => Math.round(x * 1000) / 1000;
// Typographie française : espaces insécables avant « : ; ? ! % € » et dans « 8 h 05 », « 4 976 € » ;
// les sous-titres ne coupent pas non plus « chiffre d'affaires » ni « top 10 »
function typo(txt) {
  return txt.replace(/ ([:;?!%€»])/g, "\u00a0$1").replace(/(«) /g, "$1\u00a0")
    .replace(/(\d) h (\d)/g, "$1\u00a0h\u00a0$2").replace(/(\d) (\d{3})/g, "$1\u00a0$2")
    .replace(/(chiffres?) (d'affaires)/gi, "$1\u00a0$2").replace(/(top) (\d)/gi, "$1\u00a0$2");
}
let t = AMORCE;
const scenes = [], beats = {}, ordre = [];
sc.scenes.forEach(function (s, i) {
  if (i > 0) t += TRANSITION;
  const debutScene = i === 0 ? 0 : t - 0.75;
  s.beats.forEach(function (b, j) {
    if (j > 0) t += ECART;
    let d = durees[b.id];
    if (d === undefined && ESTIMER) {
      // Aperçu du montage avant la voix : environ 2,9 mots par seconde
      d = r3(b.dit.split(/\s+/).length / 2.9 + 0.3);
      estimees.push(b.id);
    }
    if (d === undefined) throw new Error("Durée manquante pour " + b.id + " : relancer voix.py (ou node timeline.js --estimer)");
    const mots = b.texte.split(/\s+/).length;
    const v = Math.min(VITESSE, ACCEL_VOIX, Math.max(1, DEBIT_MAX * d / mots));
    const dF = d * VITESSE / v;  // durée de la phrase en temps du film
    const creneau = Math.max(dF, MIN_ECRAN[b.id] || 0);
    // fin = fin du créneau (repère des animations) ; finVoix = fin de la phrase (sous-titres, mots repérés par film.js)
    beats[b.id] = { debut: r3(t), fin: r3(t + creneau), finVoix: r3(t + dF), vitesseVoix: r3(v), scene: s.id, texte: typo(b.texte) };
    ordre.push(b.id);
    t += creneau + (APRES[b.id] || 0);
  });
  scenes.push({ id: s.id, num: s.num || null, titre: s.titre, court: s.court || null, avantage: s.avantage || null, debut: r3(debutScene) });
});
const duree = r3(t + FIN);
scenes.forEach(function (s, i) { s.fin = i + 1 < scenes.length ? scenes[i + 1].debut : duree; });

// Sous-titres : chaque phrase est découpée en cartons (au prorata des caractères pour le minutage),
// chaque carton en deux lignes au plus, coupées près du milieu, de préférence après une ponctuation.
// Mots-outils : on préfère couper avant eux, jamais juste après
const OUTILS = /^(de|du|des|la|le|les|un|une|d'un|d'une|et|ou|à|au|aux|en|sur|par|pour|dans|avec|sans|sous|qui|que|se|si|sa|son|ses|sont|est|ce)$/i;
function coupe(txt) {
  // Coupe en 2 morceaux : longueurs équilibrées, de préférence après une ponctuation (si les deux morceaux restent
  // consistants) ou avant un mot-outil ; jamais sur une espace insécable
  const mots = txt.split(" ");
  if (mots.length < 2) return [txt];
  let best = null;
  for (let k = 1; k < mots.length; k++) {
    const a = mots.slice(0, k).join(" "), b = mots.slice(k).join(" ");
    const consistant = Math.min(a.length, b.length) >= 0.3 * txt.length;
    const cout = Math.abs(a.length - b.length)
      - (consistant && /[.:;…]$/.test(a) ? 50 : consistant && /,$/.test(a) ? 16 : 0)
      - (OUTILS.test(mots[k]) ? 6 : 0) + (OUTILS.test(mots[k - 1]) ? 12 : 0);
    if (!best || cout < best.cout) best = { cout, parts: [a, b] };
  }
  return best.parts;
}
function decouper(maxCarton, maxLigne, ecartCartons) {
  const cartons = [];
  ordre.forEach(function (id, i) {
    const b = beats[id];
    const suivant = ordre[i + 1] ? beats[ordre[i + 1]].debut : duree;
    const fin = Math.min(b.finVoix + 0.6, suivant - 0.05);
    const morceaux = b.texte.length > maxCarton ? coupe(b.texte) : [b.texte];
    let t0 = b.debut;
    morceaux.forEach(function (m, j) {
      const t1 = j === morceaux.length - 1 ? fin : b.debut + (b.finVoix - b.debut) * (morceaux.slice(0, j + 1).join(" ").length / b.texte.length);
      cartons.push({ debut: r3(t0), fin: r3(t1), lignes: m.length > maxLigne ? coupe(m) : [m], suite: j > 0, coupe: j < morceaux.length - 1 });
      t0 = t1 + ecartCartons;
    });
  });
  return cartons;
}
// .srt : normes usuelles (42 caractères par ligne, 2 lignes) ; incrustés : lignes plus longues, l'écran est large
const cartonsSrt = decouper(84, 42, 0.04), cartonsFilm = decouper(110, 56, 0);

const timeline = { fps: FPS, duree, vitesse: VITESSE, dureeSortie: r3(duree / VITESSE), images: Math.ceil(duree / VITESSE * FPS), titre: sc.titre, creditVoix: sc.voix.credit || "", scenes, beats, ordre, soustitres: cartonsFilm };
fs.writeFileSync(path.join(ICI, "build", "timeline.json"), JSON.stringify(timeline, null, 1));
fs.writeFileSync(path.join(ICI, "build", "timeline.js"),
  "window.TIMELINE = " + JSON.stringify(timeline) + ";\nwindow.CAPTURES = " + JSON.stringify(captures.captures) + ";\nwindow.TEXTES = " + JSON.stringify(captures.textes) + ";\n");

function hms(x) {
  const ms = Math.round(x * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0") + "," + String(ms % 1000).padStart(3, "0");
}
const srt = cartonsSrt.map(function (c, i) {
  return (i + 1) + "\n" + hms(c.debut / VITESSE) + " --> " + hms(c.fin / VITESSE) + "\n" + c.lignes.join("\n").replace(/\u00a0/g, " ") + "\n";
}).join("\n");
fs.writeFileSync(path.join(ICI, "build", "uppina-accueil.srt"), srt);

if (estimees.length) console.log("⚠ Durées estimées (voix pas encore générée) : " + estimees.join(" "));
const ds = duree / VITESSE;
console.log("Durée : " + Math.floor(ds / 60) + " min " + (ds % 60).toFixed(1) + " s (" + timeline.images + " images, vitesse ×" + VITESSE + ")");
scenes.forEach(function (s) { console.log("  " + s.id.padEnd(9) + " " + (s.debut / VITESSE).toFixed(2).padStart(7) + " → " + (s.fin / VITESSE).toFixed(2).padStart(7)); });
