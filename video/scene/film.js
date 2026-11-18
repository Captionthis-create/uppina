/*
 * film.js : la chorégraphie. Une fonction par séquence (intro, 8h05, 12h45, 16h30, 19h30, 23h15, fin),
 * toutes calées sur le minutage des phrases de la voix off (window.TIMELINE).
 */
(function () {
  "use strict";
  var TL = window.TIMELINE, TX = window.TEXTES || {};
  var p = M.p, m = M.m, k = M.k, kCam = M.kCam, R = M.R, present = M.present, FEN = M.FEN;

  function B(id) { var b = TL.beats[id]; if (!b) throw new Error("Phrase inconnue : " + id); return b; }
  function S(id) { for (var i = 0; i < TL.scenes.length; i++) if (TL.scenes[i].id === id) return TL.scenes[i]; throw new Error("Séquence inconnue : " + id); }
  function centre(rs) { return [rs[0] + rs[2] / 2, rs[1] + rs[3] / 2]; }
  function plus(r, d) { return [r[0] - d, r[1] - d, r[2] + 2 * d, r[3] + 2 * d]; }
  function vue(rv) { return M.vueVersScene(rv); }

  // ------------------------------------------------------------------ éléments communs à toutes les séquences
  function fond(t) {
    M.bloc("fond", "fond", 0, 0, 1920, 1080, 1, 0);
    M.bloc("grille-fond", "grille-fond", 0, 0, 1920, 1080, 0.55, 1);
    var a = t * 0.11, b = t * 0.07 + 2;
    M.bloc("halo-or", "halo or", -260 + 160 * Math.cos(a), -420 + 120 * Math.sin(a * 1.3), 1400, 1400, 1, 1);
    M.bloc("halo-violet", "halo violet", 900 + 180 * Math.cos(b), 160 + 140 * Math.sin(b * 0.8), 1400, 1400, 1, 1);
  }

  // Frise de la journée (8 h → 23 h 30), au-dessus de la fenêtre
  var JALONS = [["matin", "8h05", "Ouverture", 485], ["midi", "12h45", "Coup de feu", 765], ["aprem", "16h30", "Limonade", 990],
    ["soir", "19h30", "Service du soir", 1170], ["nuit", "23h15", "Clôture", 1395]];
  function xJalon(min) { return (min - 480) / 930 * 1400 + 20; }
  function frise(t) {
    var a = B("i2").fin - 0.1, f = S("fin").debut + 0.6;
    var o = present(t, a, f + 0.6, 0.8, 0.6);
    if (o <= 0) return;
    var e = M.noeud("frise", "div", "frise", null, function (d) {
      d.innerHTML = '<div class="rail"></div><div class="rempli"></div>' + JALONS.map(function (j) {
        return '<div class="jalon" style="left:' + xJalon(j[3]).toFixed(1) + 'px"><i></i><div class="lib"><b>' + j[1] + "</b>" + j[2] + "</div></div>";
      }).join("");
      d.__rail = d.querySelector(".rail"); d.__rempli = d.querySelector(".rempli"); d.__jalons = d.querySelectorAll(".jalon");
    });
    M.place(e, FEN.x, 22, 1, o, 5);
    M.css(e.__rail, { width: (1440 * p(t, a, a + 1.0, "inOut")).toFixed(1) + "px" });
    // Progression : avance vers le jalon de la séquence en cours pendant son carton
    var x = 0;
    JALONS.forEach(function (j, i) {
      var s = S(j[0]), u = p(t, s.debut, s.debut + 1.2, "inOut");
      if (u > 0) x = m(i ? xJalon(JALONS[i - 1][3]) : 0, xJalon(j[3]), u);
      var cls = "jalon" + (t >= s.debut + 0.6 ? " fait" : "") + (t >= s.debut + 0.6 && t < s.fin ? " actif" : "");
      if (e.__jalons[i].className !== cls) e.__jalons[i].className = cls;
    });
    M.css(e.__rempli, { width: x.toFixed(1) + "px" });
  }

  function sousTitres(t) {
    var ids = TL.ordre;
    for (var i = 0; i < ids.length; i++) {
      var b = TL.beats[ids[i]], suiv = ids[i + 1] ? TL.beats[ids[i + 1]].debut : TL.duree;
      var fin = Math.min(b.fin + 0.35, suiv - 0.06);
      if (t >= b.debut - 0.08 && t <= fin) {
        var o = present(t, b.debut - 0.08, fin, 0.12, 0.12);
        var e = M.noeud("st-" + ids[i], "div", "sous-titre", null, function (d) { d.innerHTML = "<span></span>"; });
        M.html(e.firstChild, b.texte);
        var h = e.__h || (e.__h = e.offsetHeight);
        M.place(e, 0, 1058 - h, 1, o, 80);
      }
    }
  }

  // État de la fenêtre (apparition après l'intro, disparition au générique)
  function etatFenetre(t) {
    var a = B("i2").fin - 0.35, f = S("fin").debut + 0.25;
    var u = p(t, a, a + 1.5, "outQuint"), v = p(t, f, f + 1.4, "inOutQuint");
    return { dx: 0, dy: m(560, 0, u) + m(0, 40, v), s: m(0.84, 1, u) * m(1, 0.6, v), rx: m(24, 0, u), o: Math.min(p(t, a, a + 0.6, "out"), 1 - p(t, f + 0.5, f + 1.3, "in")) };
  }
  var ONGLETS = [];
  function onglet(t) { var o = "Accueil"; ONGLETS.forEach(function (x) { if (t >= x[0]) o = x[1]; }); return o; }

  // Carton d'heure au début de chaque séquence
  function carton(t, contenu) {
    JALONS.forEach(function (j) {
      var s = S(j[0]), a = s.debut, b = TL.beats[TL.ordre.filter(function (id) { return TL.beats[id].scene === j[0]; })[0]].debut + 1.0;
      if (t < a - 0.1 || t > b + 0.1) return;
      var o = present(t, a, b, 0.45, 0.55);
      M.bloc("carton-fond-" + j[0], "carton-fond", 0, 0, 1440, 810, o, 70, contenu);
      var e = M.noeud("carton-" + j[0], "div", "carton", null, function (d) { d.innerHTML = '<div class="heure">' + j[1] + '</div><div class="nom">' + j[2] + "</div>"; });
      var x = m(FEN.x + 60, FEN.x + 110, p(t, a, a + 0.6, "outQuint"));
      var u = p(t, b - 0.55, b, "inOutQuint");
      M.css(e, { transformOrigin: "0 0" });
      M.place(e, m(x, FEN.x + xJalon(j[3]) - 40, u), m(FEN.y + 290, 28, u), m(1, 0.25, u), o, 72);
    });
  }

  // ------------------------------------------------------------------ outils propres au film
  var Z = { voile: 60, tiroir: 62, notif: 81, toast: 82, carton: 70 };
  function ecran(contenu, id, nom, cam, o, z) { if (o <= 0.001) return null; return M.page(id, nom, cam, o, z, contenu); }
  function voile(contenu, id, o) { if (o > 0.001) M.bloc("voile-" + id, "voile", 0, 0, 1440, 810, o, Z.voile, contenu); }
  // Calque d'une capture, placé en (x, y) dans un parent (coordonnées du parent)
  function calque(id, nom, r, parent, x, y, o, z, cls) {
    if (o !== undefined && o <= 0.001) return null;
    var e = M.recadre(id, nom, r, parent, cls);
    M.place(e, x === undefined ? r[0] : x, y === undefined ? r[1] : y, 1, o === undefined ? 1 : o, z || 2);
    return e;
  }
  // Révélation gauche → droite (frappe au clavier) d'une zone d'une autre capture
  function revele(id, nom, r, parent, u, z, effacer) {
    if (effacer) M.bloc("efface-" + id, "", r[0] + 3, r[1] + 3, r[2] - 6, r[3] - 6, 1, (z || 5) - 1, parent).style.background = "#f3f3f3";
    if (u <= 0.001) return null;
    var e = calque(id, nom, r, parent, r[0], r[1], 1, z || 5);
    M.css(e, { clipPath: "inset(0 " + ((1 - u) * 100).toFixed(2) + "% 0 0)" });
    return e;
  }
  // Tiroir latéral (600 × 810) qui glisse depuis la gauche ; renvoie l'élément pour y superposer des calques
  function tiroir(contenu, id, nom, t, ta, tb) {
    if (t < ta || t > tb) return null;
    var u = Math.min(p(t, ta, ta + 0.45, "outQuint"), 1 - p(t, tb - 0.4, tb, "inOutQuint"));
    M.bloc("voile-tiroir-" + id, "voile-tiroir", 0, 0, 1440, 810, u, Z.tiroir - 1, contenu);
    var e = M.recadre("tiroir-" + id, nom, null, contenu, "tiroir-img");
    M.place(e, -600 * (1 - u), 0, 1, 1, Z.tiroir);
    return e;
  }
  // Message « toast » de l'application, en bas au centre de la fenêtre
  function toast(contenu, id, nom, t, ta, tb) {
    if (t < ta || t > tb) return;
    var c = M.cap(nom), u = present(t, ta, tb, 0.25, 0.3);
    var e = M.recadre("toast-" + id, nom, null, contenu, "toast-app");
    M.css(e, { transformOrigin: "50% 100%" });
    M.place(e, 720 - c.largeur * 1.3 / 2, 810 - 34 - c.hauteur * 1.3 + 18 * (1 - u), 1.3, u, Z.toast);
  }
  // Conteneur flottant (sur la scène) aux dimensions d'une capture d'élément
  function panneauCapture(id, l, h, etat, o, z) {
    var e = M.noeud("pc-" + id, "div", "recadre flottant");
    M.css(e, { width: l + "px", height: h + "px", borderRadius: "12px" });
    M.place(e, etat.x, etat.y, etat.s, o, z || 30);
    return e;
  }
  function etiquetteSous(id, txt, rs, o, theme, ecart) { M.etiquette(id, txt, rs[0] + rs[2] / 2, rs[1] + rs[3] + (ecart || 22), o, theme || "or", "b"); }
  function etiquetteDessus(id, txt, rs, o, theme, ecart) { M.etiquette(id, txt, rs[0] + rs[2] / 2, rs[1] - (ecart || 22), o, theme || "or", "h"); }
  function etiquetteDroite(id, txt, rs, o, theme, ecart) { M.etiquette(id, txt, rs[0] + rs[2] + (ecart || 26), rs[1] + rs[3] / 2, o, theme || "or", "g"); }
  function etiquetteGauche(id, txt, rs, o, theme, ecart) { M.etiquette(id, txt, rs[0] - (ecart || 26), rs[1] + rs[3] / 2, o, theme || "or", "d"); }
  function cliqueSur(rs) { return [rs[0] + rs[2] / 2, rs[1] + rs[3] / 2 + 2]; }

  // ------------------------------------------------------------------ intro
  var LOGO = '<svg viewBox="0 0 28 28" aria-hidden="true"><path class="bulle" pathLength="100" d="M14 2.5C7.9 2.5 3 7 3 12.7c0 3.2 1.6 6 4 7.8V25l4.6-3.1c.8.2 1.5.3 2.4.3 6.1 0 11-4.5 11-10.2S20.1 2.5 14 2.5z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"></path><path class="etoile" d="M14 6.8l1.7 4.5 4.5 1.7-4.5 1.7L14 19.2l-1.7-4.5L7.8 13l4.5-1.7z" fill="#f2b33d"></path></svg>';
  function logo(id, t, ta, cx, cy, s, o) {
    if (o <= 0.001) return;
    var e = M.noeud("logo-" + id, "div", "logo", null, function (d) { d.innerHTML = LOGO + "<span>Up'Pina</span>"; d.__bulle = d.querySelector(".bulle"); d.__etoile = d.querySelector(".etoile"); });
    var w = e.__w || (e.__w = e.offsetWidth), h = e.__h || (e.__h = e.offsetHeight);
    M.css(e.__bulle, { strokeDasharray: "100", strokeDashoffset: (100 * (1 - p(t, ta, ta + 1.1, "inOut"))).toFixed(2) });
    var ue = p(t, ta + 0.5, ta + 1.2, "outBack");
    M.css(e.__etoile, { transformOrigin: "14px 13px", transform: "rotate(" + (-120 * (1 - ue)).toFixed(1) + "deg) scale(" + ue.toFixed(3) + ")" });
    M.place(e, cx - w * s / 2, cy - h * s / 2, s, o, 46);
  }
  function intro(t) {
    var b1 = B("i1"), b2 = B("i2"), sortie = b2.fin + 0.15;
    var oFin = 1 - p(t, sortie, sortie + 0.7, "in");
    var monte = p(t, b1.debut - 0.4, b1.debut + 0.5, "inOut");
    logo("intro", t, 0.4, 960, m(470, 390, monte) - 60 * p(t, sortie, sortie + 0.7, "inOut"), m(0.92, 1, p(t, 0.4, 1.6, "out")) * m(1, 0.86, p(t, sortie, sortie + 0.7, "inOut")), p(t, 0.3, 1.0, "out") * oFin);
    var o1 = p(t, b1.debut - 0.1, b1.debut + 0.5, "out") * oFin, o2 = p(t, b2.debut - 0.1, b2.debut + 0.5, "out") * oFin;
    M.texte("intro-l1", '<div class="l1">Samedi 21 novembre · Rennes</div>', "titre-intro", 0, 520 + 16 * (1 - o1) - 60 * p(t, sortie, sortie + 0.7, "inOut"), o1);
    M.texte("intro-l2", '<div class="l2">Une journée à la Crêperie Démo</div>', "titre-intro", 0, 580 + 16 * (1 - o2) - 60 * p(t, sortie, sortie + 0.7, "inOut"), o2);
  }

  // ------------------------------------------------------------------ 8h05 · ouverture
  function matin(t, contenu) {
    var A = "matin-accueil", P = "matin-previsions";
    var m1 = B("m1"), m2 = B("m2"), m3 = B("m3"), m4 = B("m4"), m5 = B("m5"), m6 = B("m6"), m7 = B("m7"), s = S("matin");
    var tP = m4.debut - 0.5, tA2 = m6.debut - 0.55;
    var camA = kCam(t, [[s.debut, M.camHaut(A)], [m1.debut + 0.2, M.camHaut(A)], [m1.fin, M.camA(A, 720, 420, 1.07)],
      [m2.debut + 0.3, M.camA(A, 720, 420, 1.07)], [m3.fin, M.camA(A, 720, 420, 1.0)], [tA2, M.camHaut(A)], [m6.fin + 0.2, M.camHaut(A)], [m7.debut + 0.2, M.camA(A, 720, 1390, 1)]]);
    var camP = kCam(t, [[tP, M.camHaut(P)], [m5.debut, M.camHaut(P)], [m5.debut + 0.9, M.camSur(P, [360, 171, 1015, 560], 28)], [m6.debut, M.camSur(P, [360, 171, 1015, 560], 28, 1.4, 0, 6)]]);
    var oP = t >= tP && t < tA2 + 0.6 ? p(t, tP, tP + 0.5) : 0;
    ecran(contenu, "matin-A", A, camA, t < tP + 0.6 ? 1 : 0, 2);
    ecran(contenu, "matin-P", P, camP, oP, 3);
    ecran(contenu, "matin-A2", A, camA, t >= tA2 ? p(t, tA2, tA2 + 0.5) : 0, 4);
    if (t >= tP && t < tA2) ONGLET_COURANT = "Prévisions météo";
    var dim = 0;

    // m1 : l'accueil, « Bonjour »
    M.anneau("m-tete", M.versScene(camA, R(A, "tete")), present(t, m1.debut + 1.3, m1.fin + 0.2, 0.35, 0.3));

    // m2-m3 : la météo du jour soulevée, puis la composition du score
    var rC = R(A, "meteoJour"), l2 = M.souleve("m-meteo", A, rC, camA, t, m2.debut - 0.15, m2.debut + 0.7, m3.fin + 0.35, m3.fin + 1.0, M.cible(rC, 600, 470, 680));
    if (l2) {
      dim = Math.max(dim, l2.u * 0.6);
      var rsScore = M.dansCarte(l2.etat, rC, R(A, "meteoScore"));
      var oSc = present(t, m2.debut + 1.2, m3.fin + 0.3, 0.35, 0.3);
      M.anneau("m-score", rsScore, oSc, null, 6, 16);
      etiquetteSous("m-score", "Score de clémence : 63 / 100", rsScore, oSc, "or", 30);
    }
    var oPan = present(t, m3.debut - 0.3, m3.fin + 0.45, 0.45, 0.4);
    if (oPan > 0) {
      var pan = M.noeud("m-crit", "div", "panneau", null, function (d) {
        d.innerHTML = "<h3>Score de clémence</h3><p>Note de 0 à 100 : la météo du jour, vue par la terrasse.</p>" +
          [["🌡️ Température", 35], ["☔ Pluie", 30], ["☀️ Ensoleillement", 25], ["💨 Vent", 10]].map(function (c) {
            return '<div class="barre-critere"><div class="lib">' + c[0] + '</div><div class="val">' + c[1] + ' %</div><div class="fond-barre"></div><div class="plein" data-v="' + c[1] + '"></div></div>';
          }).join("");
        d.__pleins = d.querySelectorAll(".plein"); d.__crits = d.querySelectorAll(".barre-critere");
      });
      M.css(pan, { width: "640px" });
      M.place(pan, 1010 + 40 * (1 - oPan), 250, 1, oPan, 40);
      [1.2, 2.2, 3.1, 4.0].forEach(function (d, i) {
        var u = p(t, m3.debut + d, m3.debut + d + 0.7, "outQuint");
        M.css(pan.__pleins[i], { width: (u * +pan.__pleins[i].getAttribute("data-v") / 35 * 100).toFixed(1) + "%" });
        M.css(pan.__crits[i], { opacity: (0.35 + 0.65 * p(t, m3.debut + d - 0.1, m3.debut + d + 0.3)).toFixed(3) });
      });
    }

    // m4 : prévisions, le « ≈ 4 900 € » expliqué
    var rJ = R(P, "j1"), l4 = M.souleve("m-j1", P, rJ, camP, t, m4.debut + 0.3, m4.debut + 1.1, m4.fin + 0.3, m4.fin + 0.9, M.cibleH(rJ, 520, 500, 560));
    if (l4) {
      dim = Math.max(dim, l4.u * 0.6);
      var rsCa = M.dansCarte(l4.etat, rJ, R(P, "j1Ca")), oCa = present(t, m4.debut + 1.6, m4.fin + 0.3, 0.35, 0.3);
      M.anneau("m-ca", rsCa, oCa, null, 6, 12);
      M.anneau("m-j1score", M.dansCarte(l4.etat, rJ, R(P, "j1Score")), present(t, m4.debut + 4.2, m4.fin + 0.3, 0.35, 0.3), "violet", 6, 16);
      var oF = present(t, m4.debut + 1.2, m4.fin + 0.6, 0.45, 0.4);
      if (oF > 0) {
        var f = M.noeud("m-formule", "div", "panneau", null, function (d) {
          d.innerHTML = "<h3>Chiffre d'affaires attendu</h3><p>Ce que la journée devrait rapporter, avant l'ouverture.</p>" +
            '<div class="formule" style="margin-top:22px">Moyenne des <em>samedis</em><br><span style="font-size:20px;font-weight:500;color:rgba(255,255,255,.65)">sur les 8 dernières semaines</span></div>' +
            '<div class="formule" style="margin-top:14px">× correction <em>météo</em><br><span style="font-size:20px;font-weight:500;color:rgba(255,255,255,.65)">selon le score de clémence du jour</span></div>' +
            '<div class="formule" style="margin-top:18px;font-size:34px">= <em>≈ 4 900 €</em></div>';
        });
        M.css(f, { width: "700px" });
        M.place(f, 900 + 40 * (1 - oF), 260, 1, oF, 40);
      }
    }
    // m5 : les 16 jours
    M.anneau("m-k2", M.versScene(camP, R(P, "k2")), present(t, m5.debut + 1.0, m5.fin + 0.3, 0.35, 0.3), "vert");
    M.anneau("m-k3", M.versScene(camP, R(P, "k3")), present(t, m5.debut + 1.7, m5.fin + 0.3, 0.35, 0.3));

    // m6 : objectif du mois
    var rO = R(A, "objectif"), l6 = M.souleve("m-obj", A, rO, camA, t, m6.debut - 0.1, m6.debut + 0.7, m6.fin + 0.15, m6.fin + 0.75, M.cible(rO, 960, 470, 1040));
    if (l6) {
      dim = Math.max(dim, l6.u * 0.6);
      M.anneau("m-objpct", M.dansCarte(l6.etat, rO, R(A, "objPct")), present(t, m6.debut + 1.0, m6.fin + 0.15, 0.35, 0.3));
      M.anneau("m-objecart", M.dansCarte(l6.etat, rO, R(A, "objEcart")), present(t, m6.debut + 2.6, m6.fin + 0.15, 0.35, 0.3), "vert");
    }
    // m7 : réservations du jour
    var rRe = R(A, "resa"), l7 = M.souleve("m-resa", A, rRe, camA, t, m7.debut + 0.25, m7.debut + 1.0, m7.fin + 0.2, m7.fin + 0.8, M.cible(rRe, 960, 470, 940));
    if (l7) {
      dim = Math.max(dim, l7.u * 0.6);
      M.anneau("m-resume", M.dansCarte(l7.etat, rRe, R(A, "resaResume")), present(t, m7.debut + 1.4, m7.fin + 0.2, 0.35, 0.3));
    }
    voile(contenu, "matin", dim);
  }

  // ------------------------------------------------------------------ 12h45 · coup de feu
  function midi(t, contenu) {
    var d1 = B("d1"), d2 = B("d2"), d3 = B("d3"), d5 = B("d5"), d6 = B("d6"), d7 = B("d7"), d8 = B("d8"), s = S("midi");
    var E = ["midi-accueil-0", "midi-accueil-1", "midi-accueil-2", "midi-accueil-3"], EB = ["midi-accueil-0", "midi-accueil-1b", "midi-accueil-2b", "midi-accueil-3b"];
    var A = "midi-accueil-3b", ST = "midi-stocks", STA = "midi-stocks-apres";
    var tN = [d2.debut + 0.25, d2.debut + 2.1, d2.debut + 3.95];
    var tS = d7.debut - 0.35, tS2 = d8.debut + 3.4;
    var cList = M.camSur(A, [212, 512, 1015, 412], 26), cKpi = M.camSur(A, R(A, "kpis"), 40, 1.32), cStock = M.camSur(A, [212, 578, 1015, 600], 24);
    var camA = kCam(t, [[s.debut, M.camHaut(A)], [d1.debut + 0.4, M.camHaut(A)], [d2.debut, cList], [d3.debut - 0.2, cList], [d3.debut + 0.6, cKpi],
      [d5.debut - 0.2, cKpi], [d5.debut + 0.7, cStock], [d6.debut + 2.2, cStock], [d6.debut + 3.0, M.camHaut(A)]]);
    var oA = t < tS + 0.6 ? 1 : 0, oS = t >= tS ? p(t, tS, tS + 0.5) : 0;

    // Accueil : état courant (0 à 3) + transition de la liste des encaissements
    if (oA > 0) {
      var w = M.monde("midi-A", camA, 1, 2, contenu);
      var i = 0; tN.forEach(function (x, j) { if (t >= x) i = j + 1; });
      var ti = i ? tN[i - 1] : -99;
      calque("midi-base-prec-" + i, i ? EB[i - 1] : EB[0], M.plein(EB[0]), w, 0, 0, 1, 1);
      if (i) {
        calque("midi-base-cour-" + i, E[i], M.plein(E[i]), w, 0, 0, p(t, ti + 0.45, ti + 0.75), 2);
        calque("midi-base-fin-" + i, EB[i], M.plein(EB[i]), w, 0, 0, p(t, ti + 2.6, ti + 3.3), 3);
        var u = p(t, ti, ti + 0.6, "inOutQuint");
        if (t < ti + 0.8) {
          var L = R(A, "listeEnc");
          var clip = M.bloc("midi-clip-" + i, "recadre", L[0], L[1], L[2], L[3], 1, 6, w);
          calque("midi-liste-ancienne-" + i, EB[i - 1], L, clip, 0, 56 * u, 1, 1);
          calque("midi-ligne-neuve-" + i, E[i], R(E[i], "enc1"), clip, 0, -56 * (1 - u), u, 2);
        }
      }
    }
    var cRows = M.camSur(ST, [360, 330, 1015, 330], 30, 1.34);
    var camS = kCam(t, [[tS, M.camHaut(ST)], [d7.debut + 0.2, M.camHaut(ST)], [d7.debut + 0.9, cRows], [tS2 - 0.1, cRows], [tS2 + 0.5, M.camHaut(ST)]]);
    ecran(contenu, "midi-S", ST, camS, oS, 3);
    if (t >= tS2) ecran(contenu, "midi-S2", STA, camS, p(t, tS2, tS2 + 0.3), 4);
    function vs(nom, cle) { return M.versScene(camS, R(nom, cle)); }
    if (t >= tS) ONGLET_COURANT = "Stocks";
    var dim = 0;

    // d2 : notifications en bas à gauche, empilées comme dans l'application
    var NS = 1.45;
    tN.forEach(function (tn, j) {
      if (t < tn || t > tn + 5.6) return;
      var nom = "midi-notif-" + (j + 1), c = M.cap(nom), u = present(t, tn, tn + 5.6, 0.3, 0.45);
      var y = 810 - 26 - c.hauteur * NS;
      for (var q = j + 1; q < tN.length; q++) if (t >= tN[q]) y -= (M.cap("midi-notif-" + (q + 1)).hauteur + 8) * NS * p(t, tN[q], tN[q] + 0.3, "out");
      var e = M.recadre("notif-" + j, nom, null, contenu, "notif");
      M.place(e, 26, y + 14 * (1 - u), NS, u, Z.notif);
    });

    // d3 : les quatre indicateurs, comparés au samedi précédent
    ["tuileTTC", "tuileHT", "tuileCouverts", "tuileMoyen"].forEach(function (cle, j) {
      var r = R(A, cle), d = [0.5, 0.5, 1.6, 2.4][j];
      var a = d3.debut + d, b = d3.fin + 0.25;
      if (t < a || t > b + 0.6) return;
      var dep = M.depuis(M.versScene(camA, r), r), u = Math.min(p(t, a, a + 0.5, "outQuint"), 1 - p(t, b, b + 0.5, "inOut"));
      var et = { x: dep.x, y: dep.y - 18 * u, s: dep.s };
      M.carte("midi-" + cle, A, r, et, 1, 31 + j);
      M.anneau("midi-d-" + cle, M.dansCarte(et, r, R(A, cle.replace("tuile", "delta"))), present(t, d3.debut + 3.2, b + 0.3, 0.35, 0.3), "vert", 5, 10);
    });
    if (t > d3.debut + 3.0 && t < d3.fin + 0.6) {
      var rk = M.versScene(camA, R(A, "kpis"));
      etiquetteSous("midi-vs", "▲ vs samedi dernier, à la même heure", [rk[0], rk[1] + rk[2] * 0, rk[2], rk[3] - 10], present(t, d3.debut + 3.3, d3.fin + 0.3, 0.35, 0.3), "vert", 28);
    }

    // d5 : la vente de 12h44 (Salle S1) contient un Cidre doux 75cl → stock 3 → 2
    var oV = present(t, d5.debut + 0.7, d6.debut + 1.4, 0.35, 0.3);
    var rs3 = M.versScene(camA, R(A, "enc3")), rsCi = M.versScene(camA, R(A, "alerteCidre"));
    M.anneau("midi-vente", rs3, oV, null, 2, 10);
    M.anneau("midi-cidre", rsCi, present(t, d5.debut + 1.6, d6.debut + 2.0, 0.35, 0.3), null, 2, 10);
    etiquetteDroite("midi-cidre", "Stock 3 → 2", [rsCi[0] + rsCi[2] - 10, rsCi[1], 0, rsCi[3]], present(t, d5.debut + 1.9, d6.debut + 2.0, 0.35, 0.3), "or", 24);
    // d6 : alerte sur l'accueil et dans la cloche
    M.anneau("midi-alertes", M.versScene(camA, R(A, "alertes")), present(t, d6.debut + 0.4, d6.debut + 2.2, 0.35, 0.3));
    var tC = d6.debut + 3.0;
    if (t > tC && t < tS + 0.3) {
      var oM = present(t, tC + 0.1, tS + 0.3, 0.3, 0.3), rMenu = R("midi-cloche", "menu");
      var me = calque("midi-menu", "midi-cloche", rMenu, contenu, rMenu[0], rMenu[1] - 10 * (1 - oM), oM, 70, "notif");
      var rsCl = vue(R("midi-cloche", "cloche"));
      M.anneau("midi-cloche", rsCl, present(t, tC - 0.2, tC + 2.4, 0.3, 0.3), null, 6, 20);
      M.anneau("midi-menu", vue(rMenu), present(t, tC + 0.5, tS + 0.2, 0.3, 0.3), null, 4, 12);
    }
    toast(contenu, "alerte", "midi-toast-alerte", t, d6.debut + 0.9, d6.debut + 3.6);

    // d7 : tableau des stocks, puis la fiche du produit et son historique
    var oRows = present(t, d7.debut + 0.5, d7.debut + 2.8, 0.35, 0.3);
    M.anneau("midi-r-cidre", vs(ST, "cidre"), oRows, null, 2, 8);
    M.anneau("midi-r-blanc", vs(ST, "blanc"), oRows, null, 2, 8);
    etiquetteDessus("midi-acommander", "À commander", vs(ST, "cidreStock"), oRows, "or", 26);
    var tT = d7.debut + 2.4, tF = d8.debut + 3.3;
    var tir = tiroir(contenu, "stock", "midi-stock-tiroir-seul-vide", t, tT, tF);
    if (tir) {
      var VQ = "midi-stock-tiroir-seul-rempli";
      revele("midi-q", VQ, R(VQ, "quantite"), tir, p(t, d8.debut + 0.75, d8.debut + 1.0, "lin"), 5, t > d8.debut + 0.7);
      revele("midi-c", VQ, R(VQ, "commentaire"), tir, p(t, d8.debut + 1.45, d8.debut + 2.2, "lin"), 5, t > d8.debut + 1.4);
    }
    // Historique soulevé à droite
    var rH = [24, 376, 552, 420], tH = d7.debut + 3.1;
    if (t > tH && t < d8.debut + 0.2) {
      var uH = Math.min(p(t, tH, tH + 0.7, "inOutQuint"), 1 - p(t, d8.debut - 0.4, d8.debut + 0.2, "inOut"));
      var depH = M.depuis(vue(rH), rH), arrH = M.cible(rH, 1250, 575, 820);
      var etH = M.interp(depH, arrH, uH);
      M.carte("midi-histo", "midi-stock-tiroir-seul-vide", rH, etH, 1, 33);
      etiquetteDessus("midi-histo", "Ventes, livraisons, inventaires, pertes : chaque mouvement est tracé", [etH.x, etH.y, rH[2] * etH.s, rH[3] * etH.s], present(t, tH + 0.6, d8.debut, 0.35, 0.25), "clair", 22);
    }
    // d8 : saisie d'une livraison
    var VV = "midi-stock-tiroir-seul-vide";
    var pQ = cliqueSur(vue(R(VV, "quantite"))), pC = cliqueSur(vue(R(VV, "commentaire"))), pE = cliqueSur(vue(R(VV, "enregistrer")));
    if (t > d8.debut - 0.4 && t < d8.debut + 4.2) {
      M.curseur(t, [[d8.debut - 0.4, 1120, 760], [d8.debut + 0.5, pQ[0] - 120, pQ[1]], [d8.debut + 1.2, pC[0] - 60, pC[1]], [d8.debut + 2.8, pE[0], pE[1]], [d8.debut + 3.6, pE[0] + 40, pE[1] + 60]],
        [d8.debut + 0.6, d8.debut + 1.3, d8.debut + 3.0], present(t, d8.debut - 0.4, d8.debut + 4.2, 0.3, 0.4));
    }
    toast(contenu, "stock", "midi-toast-stock", t, d8.debut + 3.3, d8.debut + 6.0);
    var oApres = present(t, d8.debut + 3.7, d8.fin + 1.0, 0.35, 0.3);
    M.anneau("midi-r-cidre2", vs(STA, "cidre"), oApres, "vert", 2, 8);
    etiquetteDessus("midi-14", "Stock 14 · alerte levée", vs(STA, "cidreStock"), oApres, "vert", 26);
    M.anneau("midi-cloche2", vs(STA, "cloche"), present(t, d8.debut + 4.2, d8.fin + 1.0, 0.3, 0.3), "vert", 6, 20);
    voile(contenu, "midi", dim);
  }

  // ------------------------------------------------------------------ 16h30 · limonade
  function aprem(t, contenu) {
    var a1 = B("a1"), a2 = B("a2"), a3 = B("a3"), a4 = B("a4"), a5 = B("a5"), a6 = B("a6"), s = S("aprem");
    var A = "aprem-accueil", CR = "aprem-creneaux", RP = "aprem-repartition", BO = "aprem-bons", BA = "aprem-bons-apres", B30 = "aprem-bons-30j";
    var tCr = a2.debut - 0.45, tRp = a3.debut + 1.8, tBo = a4.debut - 0.45;
    var camA = kCam(t, [[s.debut, M.camHaut(A)], [a1.debut + 0.1, M.camHaut(A)], [a1.debut + 0.9, M.camSur(A, R(A, "midiSoir"), 60, 1.25)]]);
    var camR = kCam(t, [[tRp, M.camSur(RP, R(RP, "creneaux"), 30, 1.15)], [a4.debut, M.camSur(RP, R(RP, "creneaux"), 30, 1.3)]]);
    ecran(contenu, "aprem-A", A, camA, t < tCr + 0.6 ? 1 : 0, 2);
    ecran(contenu, "aprem-C", CR, M.camHaut(CR), t >= tCr && t < tRp + 0.6 ? p(t, tCr, tCr + 0.5) : 0, 3);
    ecran(contenu, "aprem-R", RP, camR, t >= tRp && t < tBo + 0.6 ? p(t, tRp, tRp + 0.5) : 0, 4);
    var tBa = a5.debut + 4.5, tB30 = a6.debut + 0.6;
    ecran(contenu, "aprem-B", BO, M.camHaut(BO), t >= tBo && t < tBa + 0.5 ? p(t, tBo, tBo + 0.5) : 0, 5);
    ecran(contenu, "aprem-BA", BA, M.camHaut(BA), t >= tBa && t < tB30 + 0.5 ? p(t, tBa, tBa + 0.3) : 0, 6);
    ecran(contenu, "aprem-B30", B30, M.camHaut(B30), t >= tB30 ? p(t, tB30, tB30 + 0.3) : 0, 7);
    if (t >= tCr) ONGLET_COURANT = "Créneaux de service";
    if (t >= tRp) ONGLET_COURANT = "Taux de répartition";
    if (t >= tBo) ONGLET_COURANT = "Bons cadeaux";
    var dim = 0;

    // a1 : carte Midi / soir
    var rM = R(A, "midiSoir"), l1 = M.souleve("a-ms", A, rM, camA, t, a1.debut + 0.9, a1.debut + 1.7, a1.fin + 0.1, a1.fin + 0.7, M.cible(rM, 960, 480, 960));
    if (l1) {
      dim = Math.max(dim, l1.u * 0.6);
      M.anneau("a-msmidi", M.dansCarte(l1.etat, rM, R(A, "msMidi")), present(t, a1.debut + 2.0, a1.fin + 0.1, 0.35, 0.3));
      M.anneau("a-msnote", M.dansCarte(l1.etat, rM, R(A, "msNote")), present(t, a1.debut + 3.6, a1.fin + 0.1, 0.35, 0.3), "violet", 6, 10);
    }
    // a2 : les trois créneaux de service
    var rCa = R(CR, "carte"), l2 = M.souleve("a-cren", CR, rCa, M.camHaut(CR), t, a2.debut + 0.3, a2.debut + 1.1, a3.debut + 1.6, a3.debut + 2.2, M.cible(rCa, 960, 362, 1150));
    if (l2) {
      dim = Math.max(dim, l2.u * 0.6);
      var tc = [a2.debut + 4.5, a2.debut + 5.25, a2.debut + 5.95];
      ["c1", "c2", "c3"].forEach(function (c, j) { M.anneau("a-" + c, M.dansCarte(l2.etat, rCa, R(CR, c)), present(t, tc[j], a3.debut + 1.6, 0.3, 0.3), ["", "vert", "violet"][j] || null, 4, 10); });
      // Les horaires se règlent librement
      var rsC2 = M.dansCarte(l2.etat, rCa, R(CR, "c2"));
      var champs = [rsC2[0] + rsC2[2] * 0.26, rsC2[1], rsC2[2] * 0.36, rsC2[3]];
      M.anneau("a-heures", champs, present(t, a3.debut + 0.1, a3.debut + 1.7, 0.3, 0.3), null, 6, 12);
      var oJ = present(t, a2.debut + 1.0, a3.debut + 1.6, 0.45, 0.4);
      if (oJ > 0) {
        var jr = M.noeud("a-journee", "div", "panneau", null, function (d) {
          var X = function (h) { return ((h - 8) / 16 * 1100).toFixed(1); };
          d.innerHTML = '<div class="journee" style="position:relative">' +
            '<div class="axe"></div>' +
            '<div class="seg" data-i="0" style="left:' + X(8) + 'px;width:' + (X(15) - X(8)) + 'px;background:linear-gradient(90deg,#e8a33d,#f2c062)"></div>' +
            '<div class="seg" data-i="1" style="left:' + (+X(15) + 4) + 'px;width:' + (X(18.5) - X(15) - 4) + 'px;background:linear-gradient(90deg,#20a39e,#45c4b0)"></div>' +
            '<div class="seg" data-i="2" style="left:' + (+X(18.5) + 4) + 'px;width:' + (X(24) - X(18.5) - 4) + 'px;background:linear-gradient(90deg,#4a5fc1,#6c7fe0)"></div>' +
            '<div class="seg-lib" data-i="0" style="left:' + X(8) + 'px;color:#f2c062">Service du midi<small>08:00 – 15:00</small></div>' +
            '<div class="seg-lib" data-i="1" style="left:' + (+X(15) + 6) + 'px;color:#45c4b0">Limonade<small>15:00 – 18:30</small></div>' +
            '<div class="seg-lib" data-i="2" style="left:' + (+X(18.5) + 8) + 'px;color:#8a9bf0">Service du soir<small>18:30 – 00:00</small></div>' +
            [8, 12, 15, 18.5, 24].map(function (h) { return '<div class="graduation" style="left:' + X(h) + 'px">' + (h === 18.5 ? "18h30" : h === 24 ? "0h" : h + "h") + "</div>"; }).join("") + "</div>";
          d.__segs = d.querySelectorAll(".seg"); d.__libs = d.querySelectorAll(".seg-lib");
        });
        M.css(jr, { width: "1172px", padding: "26px 36px 30px" });
        M.place(jr, 374, 668 + 30 * (1 - oJ), 1, oJ, 40);
        tc.forEach(function (x, j) {
          var u = p(t, x - 0.1, x + 0.45, "outQuint");
          M.css(jr.__segs[j], { transformOrigin: "0 50%", transform: "scaleX(" + u.toFixed(3) + ")" });
          M.css(jr.__libs[j], { opacity: p(t, x, x + 0.4).toFixed(3), transform: "translateY(" + (10 * (1 - p(t, x, x + 0.4))).toFixed(1) + "px)" });
        });
      }
    }
    // a3 : ventes par créneau de service (les barres montent)
    var rCo = R(RP, "creneauxCorps");
    if (t > tRp - 0.1 && t < tBo + 0.6) {
      var wR = M.monde("aprem-R", camR, p(t, tRp, tRp + 0.5), 4, contenu);
      var hCache = 335 * (1 - p(t, tRp + 0.5, tRp + 1.6, "outQuint"));
      if (hCache > 0.5) M.bloc("aprem-cache", "cache-blanc", rCo[0] + 2, rCo[1] + 4, rCo[2] - 4, hCache, 1, 5, wR);
      M.anneau("a-repart", M.versScene(camR, R(RP, "creneaux")), present(t, tRp + 1.4, a4.debut - 0.4, 0.35, 0.3), null, 4, 14);
    }

    // a4 : créer un bon cadeau
    var rCr = vue(R(BO, "creer")), pCr = cliqueSur(rCr);
    var tTir = a4.debut + 1.75, tTirF = a5.debut + 4.45;
    var VB = t < a5.debut + 0.65 ? "aprem-bon-tiroir-vide" : "aprem-bon-tiroir-50";
    var tir = tiroir(contenu, "bon-" + VB, VB, t, tTir, tTirF);
    if (tir) {
      if (t >= a5.debut + 0.65 && t < a5.debut + 0.95) calque("bon-vide-fondu", "aprem-bon-tiroir-vide", M.plein("aprem-bon-tiroir-vide"), tir, 0, 0, 1 - p(t, a5.debut + 0.65, a5.debut + 0.95), 3);
      revele("bon-note", "aprem-bon-tiroir-rempli", R("aprem-bon-tiroir-rempli", "note"), tir, p(t, a5.debut + 2.75, a5.debut + 3.3, "lin"), 5, t > a5.debut + 2.7);
      var TV = "aprem-bon-tiroir-vide";
      M.anneau("a-apercu", vue(R(TV, "apercu")), present(t, a5.debut + 1.0, a5.debut + 2.5, 0.3, 0.3), null, 4, 16);
    }
    var TB = "aprem-bon-tiroir-vide";
    var p50 = cliqueSur(vue(R(TB, "chip50"))), pNote = cliqueSur(vue(R(TB, "note"))), pOk = cliqueSur(vue(R(TB, "creer")));
    var pTab = cliqueSur(vue(R(BA, "tabProche")));
    if (t > a4.debut - 0.2 && t < a6.debut + 1.6) {
      M.curseur(t, [[a4.debut - 0.2, 980, 620], [a4.debut + 1.3, pCr[0], pCr[1]], [a5.debut + 0.1, p50[0] + 140, p50[1] + 120], [a5.debut + 0.5, p50[0], p50[1]],
        [a5.debut + 2.5, pNote[0] - 80, pNote[1]], [a5.debut + 4.0, pOk[0], pOk[1]], [a5.debut + 4.9, pOk[0] + 120, pOk[1] - 200], [a6.debut + 0.1, pTab[0] + 60, pTab[1] + 80], [a6.debut + 0.45, pTab[0], pTab[1]], [a6.debut + 1.4, pTab[0] + 70, pTab[1] + 140]],
        [a4.debut + 1.55, a5.debut + 0.62, a5.debut + 2.6, a5.debut + 4.2, a6.debut + 0.55], present(t, a4.debut - 0.2, a6.debut + 1.6, 0.3, 0.4));
    }
    toast(contenu, "bon", "aprem-toast-bon", t, a5.debut + 4.5, a5.debut + 7.2);
    var oK = present(t, a5.debut + 4.9, a6.debut + 0.5, 0.35, 0.3);
    M.anneau("a-kactifs", vue(R(BA, "kActifs")), oK, "vert", 2, 12);
    M.anneau("a-ksolde", vue(R(BA, "kSolde")), oK, "vert", 2, 12);
    M.anneau("a-l1", vue(R(BA, "l1")), present(t, a5.debut + 5.4, a6.debut + 0.5, 0.35, 0.3), null, 2, 8);
    etiquetteSous("a-nouveau", "Nouveau bon · 50,00 € · valable 1 an", vue(R(BA, "l1")), present(t, a5.debut + 5.5, a6.debut + 0.5, 0.35, 0.3), "or", 18);
    // a6 : les bons qui expirent sous 30 jours
    M.anneau("a-kexp", vue(R(B30, "kExpirent")), present(t, a6.debut + 1.0, a6.fin + 0.4, 0.35, 0.3), null, 2, 12);
    M.anneau("a-exp", vue([360, 481, 1013, 120]), present(t, a6.debut + 1.9, a6.fin + 0.4, 0.35, 0.3), null, 2, 8);
    voile(contenu, "aprem", dim);
  }

  // ------------------------------------------------------------------ 19h30 · réservations
  function soir(t, contenu) {
    var s1 = B("s1"), s2 = B("s2"), s3 = B("s3"), s4 = B("s4"), s = S("soir");
    var A = "soir-accueil", RS = "soir-resas", RA = "soir-resas-apres", RV = "soir-resas-arrive";
    var tR = s2.debut - 0.35, tRA = s3.debut + 6.35, tRV = s4.debut + 3.15;
    var camA = kCam(t, [[s.debut, M.camHaut(A)], [s1.debut + 0.2, M.camHaut(A)], [s1.debut + 0.9, M.camA(A, 720, 1490, 1)]]);
    var camR = kCam(t, [[tR, M.camHaut(RS)], [s2.debut + 1.0, M.camHaut(RS)], [s2.debut + 4.6, M.camA(RS, 720, 960, 1)], [s3.debut - 0.3, M.camA(RS, 720, 960, 1)], [s3.debut + 0.5, M.camHaut(RS)],
      [tRA + 0.3, M.camHaut(RS)], [tRA + 1.1, M.camA(RS, 720, 1060, 1)], [s4.debut + 6, M.camA(RS, 720, 1060, 1)]]);
    ecran(contenu, "soir-A", A, camA, t < tR + 0.6 ? 1 : 0, 2);
    ecran(contenu, "soir-R", RS, camR, t >= tR && t < tRA + 0.4 ? p(t, tR, tR + 0.5) : 0, 3);
    ecran(contenu, "soir-RA", RA, camR, t >= tRA && t < tRV + 0.4 ? p(t, tRA, tRA + 0.3) : 0, 4);
    ecran(contenu, "soir-RV", RV, camR, t >= tRV ? p(t, tRV, tRV + 0.3) : 0, 5);
    if (t >= tR) ONGLET_COURANT = "Réservations";
    var dim = 0;
    // s1 : réservations du jour sur l'accueil
    var rRe = R(A, "resa"), l1 = M.souleve("s-resa", A, rRe, camA, t, s1.debut + 0.9, s1.debut + 1.6, s1.fin + 0.2, s1.fin + 0.7, M.cible(rRe, 960, 470, 940));
    if (l1) {
      dim = Math.max(dim, l1.u * 0.6);
      M.anneau("s-resume", M.dansCarte(l1.etat, rRe, R(A, "resaResume")), present(t, s1.debut + 1.6, s1.fin + 0.2, 0.35, 0.3));
    }
    // s2 : la liste complète
    M.anneau("s-onglets", M.versScene(camR, R(RS, "onglets")), present(t, s2.debut + 0.4, s2.debut + 2.4, 0.35, 0.3), null, 4, 12);
    M.anneau("s-allergie", M.versScene(camR, R(RS, "allergie")), present(t, s2.debut + 4.3, s3.debut - 0.2, 0.35, 0.3), null, 2, 8);
    // s3 : un appel, une réservation saisie
    var rAj = M.versScene(M.camHaut(RS), R(RS, "ajouter")), pAj = cliqueSur(rAj);
    var tir = tiroir(contenu, "resa", "soir-resa-tiroir-vide", t, s3.debut + 1.15, s3.debut + 6.3);
    var TR = "soir-resa-tiroir-rempli";
    if (tir) {
      revele("r-nom", TR, R(TR, "nom"), tir, p(t, s3.debut + 1.8, s3.debut + 2.3, "lin"), 5, t > s3.debut + 1.75);
      revele("r-tel", TR, R(TR, "tel"), tir, p(t, s3.debut + 2.35, s3.debut + 2.85, "lin"), 5, t > s3.debut + 2.3);
      revele("r-heure", TR, R(TR, "heure"), tir, p(t, s3.debut + 3.0, s3.debut + 3.25, "lin"), 5, t > s3.debut + 2.95);
      revele("r-couv", TR, R(TR, "couverts"), tir, p(t, s3.debut + 3.35, s3.debut + 3.5, "lin"), 5, t > s3.debut + 3.3);
      revele("r-note", TR, R(TR, "note"), tir, p(t, s3.debut + 3.6, s3.debut + 4.1, "lin"), 5, t > s3.debut + 3.55);
      M.anneau("s-sms", vue(R(TR, "sms")), present(t, s3.debut + 4.4, s3.debut + 6.0, 0.3, 0.3), null, 6, 10);
    }
    M.etiquette("s-appel", "📞 Appel : une table de 4 pour 21 h", FEN.x + FEN.l - 30, FEN.y + 120, present(t, s3.debut - 0.1, s3.debut + 1.3, 0.3, 0.3), "clair", "d");
    toast(contenu, "resa", "soir-toast-resa", t, s3.debut + 6.4, s3.debut + 8.7);
    M.anneau("s-legall", M.versScene(camR, R(RA, "legall")), present(t, s3.debut + 7.0, s4.debut + 0.2, 0.35, 0.3), null, 2, 8);
    // s4 : une table en retard arrive
    var rDa = R(RS, "david"), rsDa = M.versScene(camR, rDa);
    M.anneau("s-david", rsDa, present(t, s4.debut, s4.debut + 1.6, 0.35, 0.3), null, 2, 8);
    var tir2 = tiroir(contenu, "statut", "soir-resa-statut", t, s4.debut + 1.45, s4.debut + 3.2);
    if (tir2) M.anneau("s-statuts", vue(R("soir-resa-statut", "statuts")), present(t, s4.debut + 1.9, s4.debut + 3.1, 0.3, 0.3), null, 6, 10);
    M.anneau("s-david2", rsDa, present(t, s4.debut + 3.5, s4.fin + 1.2, 0.35, 0.3), "vert", 2, 8);
    toast(contenu, "statut", "soir-toast-statut", t, s4.debut + 3.25, s4.debut + 5.6);
    var pNom = [rsDa[0] + 260, rsDa[1] + rsDa[3] / 2 + 2], pArr = cliqueSur(vue(R("soir-resa-statut", "arrive"))), pOk = cliqueSur(vue(R(TR, "ok")));
    if (t > s3.debut - 0.2 && t < s4.debut + 4.2) {
      M.curseur(t, [[s3.debut - 0.2, 1000, 640], [s3.debut + 0.8, pAj[0], pAj[1]], [s3.debut + 1.6, pAj[0] - 320, pAj[1] + 320], [s3.debut + 5.6, pOk[0], pOk[1]],
        [s3.debut + 6.6, pOk[0] + 200, pOk[1] - 150], [s4.debut + 0.3, pNom[0] + 60, pNom[1] + 60], [s4.debut + 1.2, pNom[0], pNom[1]], [s4.debut + 2.7, pArr[0], pArr[1]], [s4.debut + 3.9, pArr[0] + 200, pArr[1] + 160]],
        [s3.debut + 0.95, s3.debut + 6.15, s4.debut + 1.35, s4.debut + 2.95], present(t, s3.debut - 0.2, s4.debut + 4.2, 0.3, 0.4));
    }
    voile(contenu, "soir", dim);
  }

  // ------------------------------------------------------------------ 23h15 · clôture
  var QUESTIONS = [
    { k: 1, frappe: function () { return [B("n2").fin - 0.95, B("n2").fin + 0.2]; } },
    { k: 2, frappe: function () { return [B("n3").fin + 0.75, B("n3").fin + 1.75]; } },
    { k: 3, frappe: function () { return [B("n4").fin + 0.75, B("n4").fin + 1.6]; } }
  ];
  function nuit(t, contenu) {
    var n1 = B("n1"), n2 = B("n2"), n5 = B("n5"), n6 = B("n6"), n7 = B("n7"), s = S("nuit");
    var A = "nuit-accueil", OB = "nuit-objectifs", EX = "nuit-export";
    var tOb = n6.debut - 0.45, tEx = n7.debut - 0.45;
    var camO = kCam(t, [[tOb, M.camSur(OB, R(OB, "novembre"), 30, 1.15)], [n6.fin, M.camSur(OB, R(OB, "novembre"), 30, 1.3)]]);
    var cEx = M.camSur(EX, [360, 118, 1015, 600], 26);
    ecran(contenu, "nuit-A", A, M.camHaut(A), t < tOb + 0.6 ? 1 : 0, 2);
    ecran(contenu, "nuit-O", OB, camO, t >= tOb && t < tEx + 0.6 ? p(t, tOb, tOb + 0.5) : 0, 3);
    ecran(contenu, "nuit-E", EX, cEx, t >= tEx ? p(t, tEx, tEx + 0.5) : 0, 4);
    if (t >= tOb) ONGLET_COURANT = "Objectifs";
    if (t >= tEx) ONGLET_COURANT = "Export comptable";
    var dim = 0;

    // n1 : la journée en chiffres
    M.anneau("n-sous", vue(R(A, "sousTitre")), present(t, n1.debut + 0.6, n1.debut + 2.4, 0.35, 0.3), null, 6, 10);
    ["tuileTTC", "tuileHT", "tuileCouverts", "tuileMoyen"].forEach(function (cle, j) {
      var r = R(A, cle), l = M.souleve("n-" + cle, A, r, M.camHaut(A), t, n1.debut + 1.9 + j * 0.12, n1.debut + 2.7 + j * 0.12, n1.fin + 0.1, n1.fin + 0.7, M.cible(r, 315 + j * 430, 470, 400));
      if (l) {
        dim = Math.max(dim, l.u * 0.62);
        if (j === 0) M.anneau("n-ttc", M.dansCarte(l.etat, r, R(A, "tuileTTC")), present(t, n1.debut + 3.2, n1.fin + 0.1, 0.35, 0.3), null, 4, 16);
        if (j === 0 || j === 2) M.anneau("n-d" + j, M.dansCarte(l.etat, r, R(A, j ? "deltaCouverts" : "deltaTTC")), present(t, n1.debut + 5.6, n1.fin + 0.1, 0.35, 0.3), "vert", 4, 8);
      }
    });

    // n2-n5 : Pop'IA, trois questions
    var rB = R("nuit-popia-ecran", "bouton"), rP = R("nuit-popia-ecran", "panneau");
    var tOuv = n2.debut + 1.35, tLeve = n2.debut + 1.9, tFin = n5.fin + 1.25;
    if (t > n2.debut - 0.3 && t < tOuv + 0.4) {
      calque("n-bouton", "nuit-popia-ecran", rB, contenu, rB[0], rB[1], present(t, n2.debut - 0.3, tOuv + 0.4, 0.3, 0.2), 70);
      M.anneau("n-bouton", vue(rB), present(t, n2.debut + 0.3, tOuv, 0.3, 0.2), null, 6, 34);
      var pB = cliqueSur(vue(rB));
      M.curseur(t, [[n2.debut + 0.1, 1350, 620], [n2.debut + 1.1, pB[0], pB[1]], [tOuv + 0.4, pB[0] + 30, pB[1] + 40]], [n2.debut + 1.25], present(t, n2.debut + 0.1, tOuv + 0.4, 0.3, 0.3));
    }
    if (t >= tOuv && t < tFin + 0.6) {
      var uO = p(t, tOuv, tOuv + 0.4, "outQuint"), uL = Math.min(p(t, tLeve, tLeve + 0.7, "inOutQuint"), 1 - p(t, tFin, tFin + 0.6, "inOutQuint"));
      var rsP = vue(rP), depP = { x: rsP[0] + rsP[2] * (1 - uO) * 0.92, y: rsP[1] + rsP[3] * (1 - uO) * 0.95, s: m(0.08, 1, uO) };
      var et = M.interp(depP, M.cible([0, 0, 760, 700], 960, 520, 900), uL);
      dim = Math.max(dim, uL * 0.65);
      var pan = panneauCapture("popia", 760, 700, et, Math.min(uO * 1.5, 1) * (1 - p(t, tFin + 0.2, tFin + 0.6)), 35);
      // Question en cours
      var q = QUESTIONS[0];
      QUESTIONS.forEach(function (x) { if (t >= x.frappe()[0] - 0.4) q = x; });
      var f = q.frappe(), nomV = "nuit-popia-" + q.k + "-vide", nomS = "nuit-popia-" + q.k + "-saisie", nomR = "nuit-popia-" + q.k;
      calque("pop-base-" + q.k, nomV, M.plein(nomV), pan, 0, 0, 1, 1);
      var tEnvoi = f[1] + 0.12, tRep = tEnvoi + 0.6;
      if (t < tEnvoi) revele("pop-saisie-" + q.k, nomS, R(nomS, "champ"), pan, p(t, f[0], f[1], "lin"), 4, t > f[0] - 0.05);
      var rQ = R(nomR, "question"), rRp = R(nomR, "reponse");
      var oQ = p(t, tEnvoi, tEnvoi + 0.25, "out"), oR = p(t, tRep, tRep + 0.45, "out");
      if (oQ > 0) calque("pop-q-" + q.k, nomR, rQ, pan, rQ[0], rQ[1] + 10 * (1 - oQ), oQ, 3);
      if (oR > 0) calque("pop-r-" + q.k, nomR, rRp, pan, rRp[0], rRp[1] + 26 * (1 - oR), oR, 3);
      if (t >= tEnvoi && t < tRep + 0.1) {
        var at = M.bloc("pop-attente", "etiquette clair", rRp[0] + 6, rRp[1] + 6, 64, 36, (1 - p(t, tRep - 0.1, tRep + 0.1)) * oQ, 3, pan);
        M.html(at, "•••"); M.css(at, { fontSize: "20px", padding: "6px 14px", boxShadow: "none", border: "1px solid #e2e2e2" });
      }
      // Question précédente qui s'efface vers le haut
      if (q.k > 1 && t < f[0] + 0.5) {
        var nomP = "nuit-popia-" + (q.k - 1), uU = p(t, f[0] - 0.4, f[0] + 0.3, "inOut");
        calque("pop-prec-q-" + q.k, nomP, R(nomP, "question"), pan, R(nomP, "question")[0], R(nomP, "question")[1] - 60 * uU, 1 - uU, 3);
        calque("pop-prec-r-" + q.k, nomP, R(nomP, "reponse"), pan, R(nomP, "reponse")[0], R(nomP, "reponse")[1] - 60 * uU, 1 - uU, 3);
      }
      var rsQ = M.dansCarte(et, [0, 0, 760, 700], rQ);
      M.etiquette("pop-lib-" + q.k, ["Ses samedis midi", "Crêpes au goûter", "Top 10 du mois"][q.k - 1], et.x - 24, rsQ[1] + rsQ[3] / 2,
        present(t, tEnvoi, (q.k < 3 ? QUESTIONS[q.k].frappe()[0] - 0.3 : tFin), 0.35, 0.3) * uL, "or", "d");
    }

    // n6 : objectif de novembre
    var rG = R(OB, "novGraphe");
    if (t > tOb && t < tEx + 0.6) {
      var wO = M.monde("nuit-O", camO, p(t, tOb, tOb + 0.5), 3, contenu);
      var lc = rG[2] * (1 - p(t, n6.debut + 0.2, n6.debut + 1.9, "inOut"));
      if (lc > 0.5) M.bloc("nuit-cache-graphe", "cache-blanc", rG[0] + rG[2] - lc, rG[1] + 2, lc, rG[3] - 40, 1, 5, wO);
      M.anneau("n-pct", M.versScene(camO, R(OB, "novPct")), present(t, n6.debut + 0.9, n6.debut + 2.6, 0.35, 0.3), null, 6, 12);
      M.anneau("n-ecart", M.versScene(camO, R(OB, "novEcart")), present(t, n6.debut + 2.5, n6.fin + 0.4, 0.35, 0.3), "vert", 6, 12);
      M.anneau("n-proj", M.versScene(camO, R(OB, "novProj")), present(t, n6.debut + 4.3, n6.fin + 0.4, 0.35, 0.3), "vert", 6, 12);
    }

    // n7 : export comptable FEC
    M.anneau("n-kpis", M.versScene(cEx, R(EX, "kpis")), present(t, n7.debut + 0.3, n7.debut + 2.2, 0.35, 0.3), null, 4, 14);
    M.anneau("n-format", M.versScene(cEx, R(EX, "format")), present(t, n7.debut + 2.0, n7.debut + 3.8, 0.35, 0.3), null, 6, 12);
    var rsT = M.versScene(cEx, R(EX, "telecharger")), pT = cliqueSur(rsT), tClic = n7.debut + 3.5;
    if (t > n7.debut + 1.6 && t < tClic + 1.2) M.curseur(t, [[n7.debut + 1.6, 1240, 760], [tClic - 0.2, pT[0], pT[1]], [tClic + 1.2, pT[0] - 80, pT[1] + 180]], [tClic], present(t, n7.debut + 1.6, tClic + 1.2, 0.3, 0.4));
    toast(contenu, "export", "nuit-toast-export", t, tClic + 0.15, tClic + 2.8);
    var tFi = tClic + 0.5, finFi = S("fin").debut + 0.5;
    if (t > tFi && t < finFi + 0.6) {
      var uFi = p(t, tFi, tFi + 0.8, "outQuint"), oFi = Math.min(p(t, tFi, tFi + 0.3), 1 - p(t, finFi, finFi + 0.5));
      dim = Math.max(dim, uFi * 0.6 * (1 - p(t, finFi, finFi + 0.5)));
      var fi = M.noeud("n-fichier", "div", "fichier", null, function (d) {
        var lignes = (TX["nuit.fecDebut"] || []).map(function (l) { return l.split("\t"); });
        function pad(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s + new Array(n - s.length + 1).join(" "); }
        function padG(s, n) { s = String(s || ""); return new Array(Math.max(0, n - s.length) + 1).join(" ") + s; }
        var corps = lignes.slice(0, 11).map(function (c, i) {
          var l = pad(c[3], 10) + pad(c[4], 8) + pad(c[5], 30) + padG(c[11], 10) + padG(c[12], 10);
          return i === 0 ? "<b>" + l + "</b>" : l;
        }).join("\n");
        d.innerHTML = '<div class="tete-fichier"><div class="ico">FEC</div><div><div class="nom">' + (TX["nuit.fichierFec"] || "FEC.txt") + '</div><div class="meta">Fichier des écritures comptables · 18 colonnes · ' + ((TX["nuit.toastExport"] || "").replace(/\D+/g, "") || "252") + " lignes</div></div></div><pre>" + corps + "\n…</pre>";
      });
      var x0 = pT[0] - 980 * 0.12, y0 = pT[1];
      M.place(fi, m(x0, 940 - 490, uFi), m(y0, 210, uFi), m(0.12, 1, uFi), oFi, 42);
    }
    voile(contenu, "nuit", dim);
  }

  // ------------------------------------------------------------------ générique de fin
  var TUILES = [
    ["Encaissements en direct", "midi-accueil-3", "encaissements"], ["Chiffres du jour", "nuit-accueil", "kpis"], ["Météo et CA attendu", "matin-accueil", "meteo"],
    ["Stocks et alertes", "midi-stocks", "carte"], ["Créneaux de service", "aprem-repartition", "creneaux"], ["Bons cadeaux", "aprem-bon-tiroir-50", "apercu"],
    ["Réservations", "soir-accueil", "resa"], ["Assistant Pop'IA", "nuit-popia-1", "reponse"], ["Objectifs", "nuit-objectifs", "novembre"], ["Export comptable FEC", "nuit-export", "parametrage"]
  ];
  function fin(t) {
    var f1 = B("f1"), s = S("fin"), a = s.debut + 0.7, sortie = f1.fin - 0.2, tLogo = sortie + 0.6;
    TUILES.forEach(function (tu, i) {
      var col = i % 5, lig = Math.floor(i / 5), ta = a + i * 0.11, tb = sortie + (9 - i) * 0.04;
      if (t < ta || t > tb + 0.6) return;
      var u = p(t, ta, ta + 0.7, "outBack"), v = p(t, tb, tb + 0.5, "inOut"), o = Math.min(p(t, ta, ta + 0.35), 1 - v);
      var cx = 960 + (col - 2) * 356, cy = 345 + lig * 290;
      var e = M.noeud("tuile-" + i, "div", "mosaique-tuile", null, function (d) { d.innerHTML = '<div class="lib">' + tu[0] + "</div>"; });
      M.css(e, { transformOrigin: "50% 50%" });
      M.place(e, cx - 165, cy - 120 + 30 * (1 - u), m(0.86, 1, u) * m(1, 0.9, v), o, 44);
      var r = R(tu[1], tu[2]), sc = Math.min(306 / r[2], 176 / r[3]);
      var c = M.recadre("tuile-img-" + i, tu[1], r, e, "");
      M.css(c, { borderRadius: "8px" });
      M.place(c, 165 - r[2] * sc / 2, 12 + (176 - r[3] * sc) / 2, sc, 1, 1);
    });
    var oL = present(t, tLogo, TL.duree + 1, 0.8, 0.01) * (1 - p(t, TL.duree - 0.9, TL.duree - 0.15));
    logo("fin", t, tLogo, 960, 430, 1, oL);
    M.texte("fin-slogan", "De l'ouverture à la clôture, <b>tout le service au même endroit</b>.", "slogan", 0, 545 + 14 * (1 - p(t, tLogo + 0.5, tLogo + 1.2)), p(t, tLogo + 0.5, tLogo + 1.2) * (1 - p(t, TL.duree - 0.9, TL.duree - 0.15)));
    M.texte("fin-mention", "Démonstration · Crêperie Démo, Rennes · toutes les données affichées sont simulées", "mention", 0, 985, p(t, tLogo + 0.9, tLogo + 1.6) * (1 - p(t, TL.duree - 0.9, TL.duree - 0.15)));
  }

  // ------------------------------------------------------------------ assemblage
  var ONGLET_COURANT = "Accueil";
  var SEQUENCES = [["matin", matin], ["midi", midi], ["aprem", aprem], ["soir", soir], ["nuit", nuit]];
  function rendre(t) {
    M.debutImage();
    fond(t);
    frise(t);
    if (t < S("matin").debut + 1) intro(t);
    var ef = etatFenetre(t);
    if (ef.o > 0.001) {
      ONGLET_COURANT = "Accueil";
      var contenu = M.fenetre(ef, "Accueil");
      SEQUENCES.forEach(function (sq, i) {
        var sc = S(sq[0]);
        var debut = sq[0] === "matin" ? 0 : sc.debut - 0.05, finSc = sc.fin + 1.0;
        if (t < debut || t > finSc) return;
        // Chaque séquence a sa couche, qui apparaît en fondu sous le carton d'heure
        var oSeq = sq[0] === "matin" ? 1 : p(t, sc.debut + 0.3, sc.debut + 0.85);
        var couche = M.bloc("seq-" + sq[0], "", 0, 0, 1440, 810, oSeq, 1 + i, contenu);
        sq[1](t, couche);
      });
      carton(t, contenu);
      M.fenetre(ef, ONGLET_COURANT);
    }
    if (t > S("fin").debut - 0.5) fin(t);
    sousTitres(t);
    var noir = Math.max(1 - p(t, 0, 0.8, "out"), p(t, TL.duree - 0.6, TL.duree, "in"));
    if (noir > 0.001) M.bloc("noir", "noir", 0, 0, 1920, 1080, noir, 95);
    M.finImage();
  }

  var pret = M.precharger();
  window.FILM = {
    pret: pret,
    rendre: rendre,
    prechauffer: function () {
      for (var t = 0; t < TL.duree; t += 0.2) rendre(t);
      rendre(0);
      var imgs = Array.prototype.slice.call(document.querySelectorAll("#scene img"));
      return Promise.all(imgs.map(function (im) { return im.decode().catch(function () {}); })).then(function () { return true; });
    }
  };
})();
