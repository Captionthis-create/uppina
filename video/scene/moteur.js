/*
 * moteur.js : boîte à outils de la scène animée.
 * Chaque image est calculée à partir du seul temps t (mode « immédiat ») : rendre(t) déclare ce qui est visible
 * et où ; ce qui n'est pas déclaré pendant une image est masqué. Aucune animation CSS : le rendu image par image
 * (rendu.js) est donc exact et reproductible.
 */
(function () {
  "use strict";
  var racine = document.getElementById("scene");
  var FEN = { x: 240, y: 98, l: 1440, h: 850, barre: 40, vl: 1440, vh: 810 };

  // ---------------------------------------------------------------- courbes et interpolations
  var C = {
    lin: function (x) { return x; },
    inOut: function (x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; },
    out: function (x) { return 1 - Math.pow(1 - x, 3); },
    "in": function (x) { return x * x * x; },
    outQuint: function (x) { return 1 - Math.pow(1 - x, 5); },
    inOutQuint: function (x) { return x < 0.5 ? 16 * Math.pow(x, 5) : 1 - Math.pow(-2 * x + 2, 5) / 2; },
    outBack: function (x) { var c1 = 1.3, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
    outExpo: function (x) { return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x); },
    sine: function (x) { return -(Math.cos(Math.PI * x) - 1) / 2; }
  };
  function borne(v, a, b) { return v < a ? a : v > b ? b : v; }
  // Progression 0 → 1 entre a et b
  function p(t, a, b, c) { if (b <= a) return t >= a ? 1 : 0; return C[c || "inOut"](borne((t - a) / (b - a), 0, 1)); }
  function m(a, b, u) { return a + (b - a) * u; }
  // Apparition / disparition : 0 avant a, monte jusqu'à a+fi, 1 jusqu'à b-fo, redescend à 0 en b
  function present(t, a, b, fi, fo) {
    if (fi === undefined) fi = 0.35; if (fo === undefined) fo = fi;
    if (t < a || t > b) return 0;
    return Math.min(fi > 0 ? p(t, a, a + fi, "out") : 1, fo > 0 ? 1 - p(t, b - fo, b, "in") : 1);
  }
  function interp(a, b, u) {
    if (typeof a === "number") return m(a, b, u);
    var o = {}, k;
    for (k in a) o[k] = (typeof a[k] === "number" && typeof b[k] === "number") ? m(a[k], b[k], u) : (u < 0.5 ? a[k] : b[k]);
    for (k in b) if (!(k in o)) o[k] = b[k];
    return o;
  }
  // Images clés : [[t, valeur], [t, valeur, "courbe"], ...] ; la courbe s'applique au segment qui arrive sur la clé
  function k(t, cles, f) {
    f = f || interp;
    if (t <= cles[0][0]) return cles[0][1];
    for (var i = 1; i < cles.length; i++) {
      if (t < cles[i][0]) { var a = cles[i - 1], b = cles[i]; return f(a[1], b[1], p(t, a[0], b[0], b[2])); }
    }
    return cles[cles.length - 1][1];
  }
  // Caméra : centre linéaire, zoom géométrique
  function interpCam(a, b, u) {
    return { cx: m(a.cx, b.cx, u), cy: m(a.cy, b.cy, u), z: Math.exp(m(Math.log(a.z), Math.log(b.z), u)) };
  }
  function kCam(t, cles) { return k(t, cles, interpCam); }

  // ---------------------------------------------------------------- nœuds en mode immédiat
  var reg = {}, vus = {};
  function noeud(id, tag, cls, parent, init) {
    var e = reg[id];
    if (!e) {
      e = document.createElement(tag || "div");
      e.className = cls === undefined ? "a" : "a " + cls;
      e.__s = {};
      (parent || racine).appendChild(e);
      if (init) init(e);
      reg[id] = e;
    }
    vus[id] = 1;
    if (e.__cache !== "") { e.style.display = ""; e.__cache = ""; }
    return e;
  }
  function css(e, o) { if (!e.__s) e.__s = {}; for (var cle in o) { var v = o[cle]; if (e.__s[cle] !== v) { e.style[cle] = v; e.__s[cle] = v; } } return e; }
  function html(e, h) { if (e.__html !== h) { e.innerHTML = h; e.__html = h; } return e; }
  function debutImage() { vus = {}; }
  function finImage() { for (var id in reg) if (!vus[id] && reg[id].__cache !== "none") { reg[id].style.display = "none"; reg[id].__cache = "none"; } }
  function place(e, x, y, s, o, z, extra) {
    return css(e, { transform: "translate(" + x.toFixed(2) + "px," + y.toFixed(2) + "px) scale(" + (s === undefined ? 1 : s).toFixed(5) + ")" + (extra || ""),
      opacity: String(o === undefined ? 1 : borne(o, 0, 1).toFixed(3)), zIndex: String(z || 0) });
  }

  // ---------------------------------------------------------------- captures
  function cap(nom) { var c = window.CAPTURES[nom]; if (!c) throw new Error("Capture inconnue : " + nom); return c; }
  function R(nom, cle) { var r = cap(nom).rects[cle]; if (!r) throw new Error("Rectangle inconnu : " + nom + "." + cle); return r; }
  function plein(nom) { var c = cap(nom); return [0, 0, c.largeur, c.hauteur]; }
  function url(nom) { return "../build/captures/" + cap(nom).fichier; }
  var images = [];
  function precharger() {
    return Promise.all(Object.keys(window.CAPTURES).map(function (nom) {
      var im = new Image(); im.src = url(nom); images.push(im);
      return im.decode().catch(function () {});
    })).then(function () {
      // Les polices doivent être chargées avant toute mesure de texte (sous-titres, étiquettes, logo)
      return Promise.all([300, 400, 500, 600, 700, 800].map(function (g) { return document.fonts.load(g + " 24px Poppins", "Up'Pina àéèêç€"); })
        .concat([document.fonts.load("24px 'Noto Color Emoji'", "🌡☔☀💨📞")]));
    }).then(function () { return document.fonts.ready; });
  }
  // Recadrage d'une capture (rectangle r en px CSS de la capture), placé en (x, y) avec l'échelle s
  function recadre(id, nom, r, parent, cls) {
    var c = cap(nom); r = r || plein(nom);
    var e = noeud(id, "div", "recadre" + (cls ? " " + cls : ""), parent, function (d) {
      var im = document.createElement("img"); im.draggable = false; im.src = url(nom); d.appendChild(im); d.__img = im;
    });
    if (e.__nom === undefined) e.__nom = nom;
    else if (e.__nom !== nom) { console.warn("recadre " + id + " : capture changée (" + e.__nom + " → " + nom + ")"); e.__img.src = url(nom); e.__nom = nom; }
    css(e, { width: r[2] + "px", height: r[3] + "px" });
    css(e.__img, { width: c.largeur + "px", height: c.hauteur + "px", transform: "translate(" + (-r[0]) + "px," + (-r[1]) + "px)" });
    return e;
  }

  // ---------------------------------------------------------------- fenêtre de navigateur et caméra
  var FEN_DEFAUT = { dx: 0, dy: 0, s: 1, rx: 0, o: 1 };
  function fenetre(etat, titre) {
    etat = Object.assign({}, FEN_DEFAUT, etat);
    var f = noeud("fen", "div", "fenetre", null, function (d) {
      d.innerHTML = '<div class="fen-barre"><i></i><i></i><i></i><div class="fen-onglet"></div></div>';
      var c = document.createElement("div"); c.className = "fen-contenu"; d.appendChild(c); d.__contenu = c; d.__onglet = d.querySelector(".fen-onglet");
    });
    css(f, { left: FEN.x + "px", top: FEN.y + "px", zIndex: "10", opacity: String(borne(etat.o, 0, 1).toFixed(3)),
      transform: "translate(" + etat.dx.toFixed(2) + "px," + etat.dy.toFixed(2) + "px) perspective(2600px) rotateX(" + etat.rx.toFixed(3) + "deg) scale(" + etat.s.toFixed(5) + ")" });
    html(f.__onglet, "<b>Up'Pina</b> · " + (titre || "Accueil"));
    return f.__contenu;
  }
  // Monde : couche transformée par la caméra (coordonnées = px CSS de la page capturée)
  function monde(id, cam, o, z, parent) {
    var e = noeud("monde-" + id, "div", "monde", parent);
    css(e, { transform: "translate(" + (FEN.vl / 2 - cam.cx * cam.z).toFixed(2) + "px," + (FEN.vh / 2 - cam.cy * cam.z).toFixed(2) + "px) scale(" + cam.z.toFixed(5) + ")",
      opacity: String(borne(o === undefined ? 1 : o, 0, 1).toFixed(3)), zIndex: String(z || 1) });
    return e;
  }
  // Une page entière dans un monde
  function page(id, nom, cam, o, z, parent) {
    var w = monde(id, cam, o, z, parent);
    recadre("page-" + id, nom, null, w);
    return w;
  }
  function camHaut(nom, z) { z = z || 1; return borneCam(nom, { cx: FEN.vl / 2 / z, cy: FEN.vh / 2 / z, z: z }); }
  function camSur(nom, r, marge, zmax, dx, dy) {
    marge = marge === undefined ? 40 : marge;
    var z = Math.min((FEN.vl - 2 * marge) / r[2], (FEN.vh - 2 * marge) / r[3]);
    if (zmax) z = Math.min(z, zmax);
    return borneCam(nom, { cx: r[0] + r[2] / 2 + (dx || 0), cy: r[1] + r[3] / 2 + (dy || 0), z: z });
  }
  function camA(nom, cx, cy, z) { return borneCam(nom, { cx: cx, cy: cy, z: z }); }
  function borneCam(nom, cam) {
    var c = cap(nom), hw = FEN.vl / 2 / cam.z, hh = FEN.vh / 2 / cam.z;
    cam.cx = c.largeur <= 2 * hw ? c.largeur / 2 : borne(cam.cx, hw, c.largeur - hw);
    cam.cy = c.hauteur <= 2 * hh ? hh : borne(cam.cy, hh, c.hauteur - hh);
    return cam;
  }
  // Rectangle de page (px CSS) → rectangle à l'écran (px de la scène), pour une caméra et un état de fenêtre
  function versScene(cam, r, fen) {
    fen = Object.assign({}, FEN_DEFAUT, fen);
    var vx = (r[0] - cam.cx) * cam.z + FEN.vl / 2, vy = (r[1] - cam.cy) * cam.z + FEN.vh / 2;
    return vueVersScene([vx, vy, r[2] * cam.z, r[3] * cam.z], fen);
  }
  // Rectangle dans la zone visible de la fenêtre (px du contenu) → scène
  function vueVersScene(v, fen) {
    fen = Object.assign({}, FEN_DEFAUT, fen);
    var ox = FEN.l / 2, oy = FEN.h / 2, lx = v[0], ly = FEN.barre + v[1];
    return [FEN.x + ox + fen.dx + fen.s * (lx - ox), FEN.y + oy + fen.dy + fen.s * (ly - oy), v[2] * fen.s, v[3] * fen.s];
  }

  // ---------------------------------------------------------------- cartes flottantes (éléments « soulevés »)
  // Position d'une carte : { x, y, s } (coin haut-gauche à l'écran, échelle px écran / px CSS)
  function depuis(rs, r) { return { x: rs[0], y: rs[1], s: rs[2] / r[2] }; }
  function cible(r, cx, cy, largeur) { var s = largeur / r[2]; return { x: cx - r[2] * s / 2, y: cy - r[3] * s / 2, s: s }; }
  function cibleH(r, cx, cy, hauteur) { var s = hauteur / r[3]; return { x: cx - r[2] * s / 2, y: cy - r[3] * s / 2, s: s }; }
  function carte(id, nom, r, etat, o, z, cls) {
    var e = recadre("carte-" + id, nom, r, null, cls === undefined ? "flottant" : cls);
    place(e, etat.x, etat.y, etat.s, o, z || 30);
    return e;
  }
  // Soulève l'élément r de la page : de sa place (caméra cam) vers « arrivee », tenu, puis retour à sa place
  function souleve(id, nom, r, cam, t, t0, t1, t2, t3, arrivee, fen, z) {
    if (t < t0 || t > t3) return null;
    var dep = depuis(versScene(cam, r, fen), r);
    var u = t < t2 ? p(t, t0, t1, "inOutQuint") : 1 - p(t, t2, t3, "inOutQuint");
    var et = interp(dep, arrivee, u);
    carte(id, nom, r, et, 1, z);
    return { etat: et, u: u };
  }
  // Rectangle à l'écran d'un sous-élément d'une carte flottante
  function dansCarte(etat, rCarte, rSous) {
    return [etat.x + (rSous[0] - rCarte[0]) * etat.s, etat.y + (rSous[1] - rCarte[1]) * etat.s, rSous[2] * etat.s, rSous[3] * etat.s];
  }

  // ---------------------------------------------------------------- surlignages, étiquettes, curseur
  function anneau(id, rs, o, couleur, marge, rayon) {
    if (o <= 0.001) return null;
    marge = marge === undefined ? 8 : marge;
    var e = noeud("anneau-" + id, "div", "anneau" + (couleur ? " " + couleur : ""));
    var g = 1 + 0.06 * (1 - o);
    var w = rs[2] + 2 * marge, h = rs[3] + 2 * marge;
    css(e, { width: w.toFixed(1) + "px", height: h.toFixed(1) + "px", borderRadius: (rayon || 14) + "px", transformOrigin: "50% 50%" });
    place(e, rs[0] - marge, rs[1] - marge, g, o, 50);
    return e;
  }
  // ancre : "g" (le point est le bord gauche), "d", "c" (centre), "h" (centré au-dessus), "b" (centré dessous)
  function etiquette(id, contenu, x, y, o, theme, ancre) {
    if (o <= 0.001) return null;
    var e = noeud("etiq-" + id, "div", "etiquette" + (theme ? " " + theme : ""));
    html(e, contenu);
    var w = e.__w, h = e.__h;
    if (w === undefined || e.__mesure !== contenu) { w = e.offsetWidth; h = e.offsetHeight; e.__w = w; e.__h = h; e.__mesure = contenu; }
    var x0 = x, y0 = y - h / 2;
    if (ancre === "d") x0 = x - w;
    else if (ancre === "c") x0 = x - w / 2;
    else if (ancre === "h") { x0 = x - w / 2; y0 = y - h; }
    else if (ancre === "b") { x0 = x - w / 2; y0 = y; }
    place(e, x0, y0 + 14 * (1 - o), 1, o, 55);
    return e;
  }
  var SVG_CURSEUR = '<svg viewBox="0 0 40 40"><path d="M9 4 L9 32 L16.5 25.5 L21.5 36 L26 34 L21 23.5 L31 23.5 Z" fill="#fff" stroke="#111" stroke-width="2.2" stroke-linejoin="round"/></svg>';
  // pts : [[t, x, y], ...] ; clics : [t, ...]
  function curseur(t, pts, clics, o) {
    if (o === undefined) o = 1;
    if (o <= 0.001 || !pts.length) return;
    var pos = k(t, pts.map(function (q) { return [q[0], { x: q[1], y: q[2] }, q[3] || "inOut"]; }));
    var press = 0;
    (clics || []).forEach(function (tc) {
      var d = t - tc;
      if (d >= -0.12 && d <= 0.12) press = Math.max(press, 1 - Math.abs(d) / 0.12);
      if (d >= 0 && d <= 0.5) {
        var on = noeud("onde-" + tc, "div", "onde");
        var s = m(0.3, 1.25, p(t, tc, tc + 0.5, "out"));
        css(on, { transformOrigin: "50% 50%" });
        place(on, pos.x - 35 + 4, pos.y - 35 + 4, s, (1 - p(t, tc, tc + 0.5, "lin")) * o, 69);
      }
    });
    var e = noeud("curseur", "div", "curseur", null, function (d) { d.innerHTML = SVG_CURSEUR; });
    css(e, { transformOrigin: "9px 4px" });
    place(e, pos.x - 9, pos.y - 4, 1 - 0.12 * press, o, 70);
  }

  // ---------------------------------------------------------------- texte libre
  function texte(id, contenu, cls, x, y, o, s, z) {
    if (o <= 0.001) return null;
    var e = noeud("txt-" + id, "div", cls);
    html(e, contenu);
    place(e, x, y, s === undefined ? 1 : s, o, z || 45);
    return e;
  }
  function bloc(id, cls, x, y, l, h, o, z, parent) {
    var e = noeud(id, "div", cls, parent);
    css(e, { width: l + "px", height: h + "px" });
    place(e, x, y, 1, o, z);
    return e;
  }

  window.M = {
    FEN: FEN, C: C, p: p, m: m, k: k, kCam: kCam, interp: interp, borne: borne, present: present,
    noeud: noeud, css: css, html: html, place: place, debutImage: debutImage, finImage: finImage,
    cap: cap, R: R, plein: plein, precharger: precharger, recadre: recadre,
    fenetre: fenetre, monde: monde, page: page, camHaut: camHaut, camSur: camSur, camA: camA, versScene: versScene, vueVersScene: vueVersScene,
    depuis: depuis, cible: cible, cibleH: cibleH, carte: carte, souleve: souleve, dansCarte: dansCarte,
    anneau: anneau, etiquette: etiquette, curseur: curseur, texte: texte, bloc: bloc
  };
})();
