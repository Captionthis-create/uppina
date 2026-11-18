/*
 * timeline.js : place chaque phrase de la voix off dans le temps.
 * Entrées : scenario.json, build/voix/durees.json, build/captures/captures.json
 * Sorties : build/timeline.json (minutage), build/timeline.js (même chose + captures, pour la scène animée),
 *           build/uppina-accueil.srt (sous-titres)
 */
const fs = require("fs");
const path = require("path");

const ICI = __dirname;
const sc = JSON.parse(fs.readFileSync(path.join(ICI, "scenario.json"), "utf8"));
const durees = JSON.parse(fs.readFileSync(path.join(ICI, "build", "voix", "durees.json"), "utf8"));
const captures = JSON.parse(fs.readFileSync(path.join(ICI, "build", "captures", "captures.json"), "utf8"));
// Créneau minimal de chaque phrase à l'écran (montage validé) : une voix plus courte n'avance pas les animations
const CRENEAUX = fs.existsSync(path.join(ICI, "durees-ecran.json")) ? JSON.parse(fs.readFileSync(path.join(ICI, "durees-ecran.json"), "utf8")).durees : {};

const FPS = 30;
const AMORCE = 2.4;        // animation du logo avant la première phrase
const ECART = 0.35;        // silence entre deux phrases d'une même séquence
const TRANSITION = 1.15;   // silence entre deux séquences (titre de l'heure)
const FIN = 5.2;           // générique après la dernière phrase
// Temps supplémentaire après certaines phrases, pour laisser jouer l'animation
const APRES = {
  i2: 0.9,
  m1: 0.2, m2: 0.2, m3: 0.6, m4: 0.4, m5: 0.3, m6: 0.2, m7: 0.3,
  d1: 0.2, d2: 1.1, d3: 0.3, d5: 0.2, d6: 0.9, d7: 0.8, d8: 1.0,
  a1: 0.2, a2: 0.6, a3: 0.5, a4: 0.4, a5: 1.0, a6: 0.4,
  s1: 0.2, s2: 0.4, s3: 0.8, s4: 1.2,
  n1: 0.3, n2: 0.7, n3: 1.6, n4: 1.3, n5: 1.3, n6: 0.5, n7: 1.6
};

const r3 = (x) => Math.round(x * 1000) / 1000;
// Typographie française : espaces insécables avant « : ; ? ! % € » et dans « 8 h 05 », « 4 976 € »
function typo(txt) {
  return txt.replace(/ ([:;?!%€»])/g, "\u00a0$1").replace(/(«) /g, "$1\u00a0")
    .replace(/(\d) h (\d)/g, "$1\u00a0h\u00a0$2").replace(/(\d) (\d{3})/g, "$1\u00a0$2");
}
let t = AMORCE;
const scenes = [], beats = {}, ordre = [];
sc.scenes.forEach(function (s, i) {
  if (i > 0) t += TRANSITION;
  const debutScene = i === 0 ? 0 : t - 0.75;
  s.beats.forEach(function (b, j) {
    if (j > 0) t += ECART;
    const d = durees[b.id];
    if (d === undefined) throw new Error("Durée manquante pour " + b.id + " : relancer voix.py");
    const creneau = Math.max(d, CRENEAUX[b.id] || 0);
    // fin = fin du créneau (repère des animations) ; finVoix = fin réelle de la phrase (sous-titres)
    beats[b.id] = { debut: r3(t), fin: r3(t + creneau), finVoix: r3(t + d), scene: s.id, texte: typo(b.texte) };
    ordre.push(b.id);
    t += creneau + (APRES[b.id] || 0);
  });
  scenes.push({ id: s.id, heure: s.heure, titre: s.titre, debut: r3(debutScene) });
});
const duree = r3(t + FIN);
scenes.forEach(function (s, i) { s.fin = i + 1 < scenes.length ? scenes[i + 1].debut : duree; });

const timeline = { fps: FPS, duree, images: Math.ceil(duree * FPS), scenes, beats, ordre };
fs.writeFileSync(path.join(ICI, "build", "timeline.json"), JSON.stringify(timeline, null, 1));
fs.writeFileSync(path.join(ICI, "build", "timeline.js"),
  "window.TIMELINE = " + JSON.stringify(timeline) + ";\nwindow.CAPTURES = " + JSON.stringify(captures.captures) + ";\nwindow.TEXTES = " + JSON.stringify(captures.textes) + ";\n");

// Sous-titres .srt (deux lignes au plus, coupées près du milieu)
function hms(x) {
  const ms = Math.round(x * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0") + "," + String(ms % 1000).padStart(3, "0");
}
function coupe(txt, n) {
  // Coupe en n morceaux équilibrés, de préférence après une ponctuation ; jamais sur une espace insécable
  const mots = txt.split(" ");
  if (n === 1 || mots.length < 2) return [txt];
  let best = null;
  for (let k = 1; k < mots.length; k++) {
    const a = mots.slice(0, k).join(" "), b = mots.slice(k).join(" ");
    const cout = Math.abs(a.length - b.length) - (/[,:;.…]$/.test(a) ? 12 : 0);
    if (!best || cout < best.cout) best = { cout, parts: [a, b] };
  }
  return best.parts;
}
const cues = [];
ordre.forEach(function (id, i) {
  const b = beats[id];
  const suivant = ordre[i + 1] ? beats[ordre[i + 1]].debut : duree;
  const fin = Math.min(b.finVoix + 0.6, suivant - 0.05);
  const morceaux = b.texte.length > 84 ? coupe(b.texte, 2) : [b.texte];
  let t0 = b.debut;
  morceaux.forEach(function (m, j) {
    const t1 = j === morceaux.length - 1 ? fin : b.debut + (b.finVoix - b.debut) * (morceaux.slice(0, j + 1).join(" ").length / b.texte.length);
    const lignes = m.length > 42 ? coupe(m, 2).join("\n") : m;
    cues.push({ debut: t0, fin: t1, texte: lignes.replace(/\u00a0/g, " ") });
    t0 = t1 + 0.04;
  });
});
const srt = cues.map(function (c, i) { return (i + 1) + "\n" + hms(c.debut) + " --> " + hms(c.fin) + "\n" + c.texte + "\n"; }).join("\n");
fs.writeFileSync(path.join(ICI, "build", "uppina-accueil.srt"), srt);

console.log("Durée : " + Math.floor(duree / 60) + " min " + (duree % 60).toFixed(1) + " s (" + timeline.images + " images)");
scenes.forEach(function (s) { console.log("  " + s.id.padEnd(6) + " " + s.debut.toFixed(2).padStart(7) + " → " + s.fin.toFixed(2).padStart(7)); });
