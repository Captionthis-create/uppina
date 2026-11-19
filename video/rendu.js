/*
 * rendu.js : rend la scène animée (scene/index.html) image par image.
 *   node rendu.js apercu 12.5 31 47.2   → build/apercu/t-0012.50.png … (images isolées, pour vérifier le montage)
 *   node rendu.js video [--travailleurs 4] [--de 0 --a 30]  → build/video-sans-son.mp4
 * Les temps donnés sont ceux de la vidéo finale : l'image de l'instant t montre le film à t × vitesse (scenario.json).
 * Chaque image est calculée par window.FILM.rendre(t), puis capturée (CDP) et envoyée à ffmpeg.
 */
const fs = require("fs");
const path = require("path");
const { spawn, execFileSync } = require("child_process");
const { chromium } = require("playwright");

const ICI = __dirname;
const BUILD = path.join(ICI, "build");
const HOTE = "http://video.local/";
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".woff2": "font/woff2", ".png": "image/png", ".json": "application/json" };
const TL = JSON.parse(fs.readFileSync(path.join(BUILD, "timeline.json"), "utf8"));

function arg(nom, defaut) { const i = process.argv.indexOf("--" + nom); return i > 0 ? process.argv[i + 1] : defaut; }

async function ouvrirScene(navigateur) {
  const contexte = await navigateur.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await contexte.route(HOTE + "**", function (r) {
    const p = decodeURIComponent(new URL(r.request().url()).pathname);
    const f = path.join(ICI, p);
    if (!f.startsWith(ICI) || !fs.existsSync(f)) return r.fulfill({ status: 404, body: "introuvable : " + p });
    return r.fulfill({ path: f, headers: { "content-type": TYPES[path.extname(f)] || "application/octet-stream" } });
  });
  const page = await contexte.newPage();
  page.on("pageerror", function (e) { console.error("[scène] " + e.message); });
  page.on("console", function (m) { if (m.type() === "error" || m.type() === "warning") console.error("[scène] " + m.text()); });
  await page.goto(HOTE + "scene/index.html");
  await page.waitForFunction(function () { return window.FILM && window.FILM.pret; }, null, { timeout: 120000 });
  await page.evaluate(function () { return window.FILM.pret; });
  await page.evaluate(function () { return window.FILM.prechauffer(); });
  const cdp = await contexte.newCDPSession(page);
  return { contexte, page, cdp };
}

async function image(page, cdp, t, format) {
  await page.evaluate(function (x) { window.FILM.rendre(x); }, t);
  const r = await cdp.send("Page.captureScreenshot", format === "png" ? { format: "png" } : { format: "jpeg", quality: 94 });
  return Buffer.from(r.data, "base64");
}

function ffmpegVers(sortie, fps) {
  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-",
    "-vf", "scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p",
    "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-tune", "animation",
    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv", sortie], { stdio: ["pipe", "inherit", "inherit"] });
  const fin = new Promise(function (ok, ko) { ff.on("close", function (c) { c === 0 ? ok() : ko(new Error("ffmpeg : code " + c)); }); });
  return { ff, fin };
}

async function apercu(temps) {
  const dossier = path.join(BUILD, "apercu");
  fs.mkdirSync(dossier, { recursive: true });
  const nav = await chromium.launch();
  const { page, cdp } = await ouvrirScene(nav);
  for (const t of temps) {
    const f = path.join(dossier, "t-" + t.toFixed(2).padStart(7, "0") + ".png");
    fs.writeFileSync(f, await image(page, cdp, t * (TL.vitesse || 1), "png"));
    console.log(f);
  }
  await nav.close();
}

async function video() {
  const fps = TL.fps, total = TL.images;
  const de = Math.max(0, Math.round(parseFloat(arg("de", "0")) * fps));
  const a = Math.min(total, arg("a") ? Math.round(parseFloat(arg("a")) * fps) : total);
  const n = parseInt(arg("travailleurs", "4"), 10);
  const morceaux = [];
  const taille = Math.ceil((a - de) / n);
  for (let i = 0; i < n; i++) { const d = de + i * taille, f = Math.min(a, d + taille); if (f > d) morceaux.push({ i, d, f }); }
  const dossier = path.join(BUILD, "morceaux");
  fs.mkdirSync(dossier, { recursive: true });
  const nav = await chromium.launch();
  const debut = Date.now();
  let faites = 0;
  await Promise.all(morceaux.map(async function (mc) {
    const { contexte, page, cdp } = await ouvrirScene(nav);
    mc.fichier = path.join(dossier, "morceau-" + mc.i + ".mp4");
    const { ff, fin } = ffmpegVers(mc.fichier, fps);
    for (let i = mc.d; i < mc.f; i++) {
      const buf = await image(page, cdp, i / fps * (TL.vitesse || 1), "jpeg");
      if (!ff.stdin.write(buf)) await new Promise(function (ok) { ff.stdin.once("drain", ok); });
      faites++;
      if (faites % 150 === 0) {
        const s = (Date.now() - debut) / 1000;
        console.log("  " + faites + " / " + (a - de) + " images · " + s.toFixed(0) + " s · reste ≈ " + ((a - de - faites) * s / faites).toFixed(0) + " s");
      }
    }
    ff.stdin.end();
    await fin;
    await contexte.close();
  }));
  await nav.close();
  const liste = path.join(dossier, "liste.txt");
  fs.writeFileSync(liste, morceaux.map(function (mc) { return "file '" + mc.fichier + "'"; }).join("\n") + "\n");
  const sortie = path.join(BUILD, arg("sortie", "video-sans-son.mp4"));
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", liste, "-c", "copy", sortie]);
  console.log("Vidéo : " + sortie + " (" + (a - de) + " images en " + ((Date.now() - debut) / 1000).toFixed(0) + " s)");
}

(async function () {
  const mode = process.argv[2];
  if (mode === "apercu") await apercu(process.argv.slice(3).filter(function (x) { return !/^--/.test(x); }).map(Number));
  else if (mode === "video") await video();
  else console.log("Usage : node rendu.js apercu <t> [t…] | node rendu.js video [--travailleurs 4] [--de s --a s]");
})();
