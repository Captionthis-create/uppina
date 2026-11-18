/*
 * film.js : la chorégraphie. Neuf modules présentés comme des nouveautés : pour chacun, un carton « Nouveau »,
 * une démonstration sur les vraies captures, puis un bandeau « L'avantage ». Tout est calé sur le minutage des
 * phrases de la voix off (window.TIMELINE).
 */
(function () {
  "use strict";
  var TL = window.TIMELINE, TX = window.TEXTES || {};
  var p = M.p, m = M.m, k = M.k, kCam = M.kCam, R = M.R, present = M.present, FEN = M.FEN;

  function B(id) { var b = TL.beats[id]; if (!b) throw new Error("Phrase inconnue : " + id); return b; }
  function S(id) { for (var i = 0; i < TL.scenes.length; i++) if (TL.scenes[i].id === id) return TL.scenes[i]; throw new Error("Séquence inconnue : " + id); }
  // Instant approximatif où un mot est prononcé dans une phrase (au prorata des caractères)
  function motA(id, mot) {
    var b = B(id), i = b.texte.toLowerCase().indexOf(mot.toLowerCase());
    if (i < 0) throw new Error("Mot « " + mot + " » absent de " + id);
    return b.debut + ((b.finVoix || b.fin) - b.debut) * (i / b.texte.length);
  }
  function vue(rv) { return M.vueVersScene(rv); }
  var MODULES = TL.scenes.filter(function (s) { return s.num; });
  function premierBeat(sid) { return B(TL.ordre.filter(function (id) { return TL.beats[id].scene === sid; })[0]); }
  function dernierBeat(sid) { var l = TL.ordre.filter(function (id) { return TL.beats[id].scene === sid; }); return B(l[l.length - 1]); }

  // ------------------------------------------------------------------ éléments communs
  function fond(t) {
    M.bloc("fond", "fond", 0, 0, 1920, 1080, 1, 0);
    M.bloc("grille-fond", "grille-fond", 0, 0, 1920, 1080, 0.55, 1);
    var a = t * 0.11, b = t * 0.07 + 2;
    M.bloc("halo-or", "halo or", -260 + 160 * Math.cos(a), -420 + 120 * Math.sin(a * 1.3), 1400, 1400, 1, 1);
    M.bloc("halo-violet", "halo violet", 900 + 180 * Math.cos(b), 160 + 140 * Math.sin(b * 0.8), 1400, 1400, 1, 1);
  }

  // Frise des neuf modules, au-dessus de la fenêtre
  function xModule(i) { return 20 + i * (1400 / (MODULES.length - 1)); }
  function frise(t) {
    var a = B("i2").fin - 0.1, f = S("fin").debut + 0.6;
    var o = present(t, a, f + 0.6, 0.8, 0.6);
    if (o <= 0) return;
    var e = M.noeud("frise", "div", "frise", null, function (d) {
      d.innerHTML = '<div class="rail"></div><div class="rempli"></div>' + MODULES.map(function (s, i) {
        return '<div class="jalon" style="left:' + xModule(i).toFixed(1) + 'px"><i></i><div class="lib"><b>' + s.num + "</b>" + s.court + "</div></div>";
      }).join("");
      d.__rail = d.querySelector(".rail"); d.__rempli = d.querySelector(".rempli"); d.__jalons = d.querySelectorAll(".jalon");
    });
    M.place(e, FEN.x, 22, 1, o, 5);
    M.css(e.__rail, { width: (1440 * p(t, a, a + 1.0, "inOut")).toFixed(1) + "px" });
    var x = 0;
    MODULES.forEach(function (s, i) {
      var u = p(t, s.debut, s.debut + 1.2, "inOut");
      if (u > 0) x = m(i ? xModule(i - 1) : 0, xModule(i), u);
      var cls = "jalon" + (t >= s.debut + 0.6 ? " fait" : "") + (t >= s.debut + 0.6 && t < s.fin ? " actif" : "");
      if (e.__jalons[i].className !== cls) e.__jalons[i].className = cls;
    });
    M.css(e.__rempli, { width: x.toFixed(1) + "px" });
  }

  function sousTitres(t) {
    TL.soustitres.forEach(function (c, i) {
      var a = c.debut - (c.suite ? 0 : 0.08), b = c.fin;
      if (t < a || (c.coupe ? t >= b : t > b)) return;
      var o = present(t, a, b, c.suite ? 0 : 0.12, c.coupe ? 0 : 0.12);
      var e = M.noeud("st-" + i, "div", "sous-titre", null, function (d) { d.innerHTML = "<span>" + c.lignes.join("<br>") + "</span>"; });
      var h = e.__h || (e.__h = e.offsetHeight);
      M.place(e, 0, 1058 - h, 1, o, 80);
    });
  }

  function etatFenetre(t) {
    var a = B("i2").fin - 0.35, f = S("fin").debut + 0.25;
    var u = p(t, a, a + 1.5, "outQuint"), v = p(t, f, f + 1.4, "inOutQuint");
    return { dx: 0, dy: m(560, 0, u) + m(0, 40, v), s: m(0.84, 1, u) * m(1, 0.6, v), rx: m(24, 0, u), o: Math.min(p(t, a, a + 0.6, "out"), 1 - p(t, f + 0.5, f + 1.3, "in")) };
  }

  // Carton « Nouveau » au début de chaque module : affiché pendant la première phrase, puis effacé en glissant
  function carton(t, contenu) {
    MODULES.forEach(function (s) {
      var pb = premierBeat(s.id), a = s.debut, b = (pb.finVoix || pb.fin) + 0.3;
      if (t < a - 0.1 || t > b + 0.1) return;
      var o = present(t, a, b, 0.45, 0.5);
      M.bloc("carton-fond-" + s.id, "carton-fond", 0, 0, 1440, 810, o, 70, contenu);
      var e = M.noeud("carton-" + s.id, "div", "carton", null, function (d) {
        d.innerHTML = '<div class="ligne-nouveau"><span class="pastille-nouveau">Nouveau</span><span class="num">' + s.num + " / " + String(MODULES.length).padStart(2, "0") + "</span></div>" +
          '<div class="titre-module">' + s.titre + "</div>";
      });
      var h = e.__h || (e.__h = e.offsetHeight);
      var entree = p(t, a, a + 0.8, "outQuint"), sortie = p(t, b - 0.5, b, "inOutQuint");
      M.place(e, FEN.x + m(60, 110, entree) - 60 * sortie, FEN.y + 40 + (810 - h) / 2 - 20, 1, o, 72);
    });
  }

  // Bandeau « L'avantage » pendant la dernière phrase de chaque module
  function oAvantage(t, sid) {
    var s = S(sid), b = dernierBeat(sid);
    return present(t, b.debut - 0.15, s.fin + 0.15, 0.4, 0.45);
  }
  function avantage(t) {
    MODULES.forEach(function (s) {
      var o = oAvantage(t, s.id);
      if (o <= 0.001) return;
      var e = M.noeud("avantage-" + s.id, "div", "avantage", null, function (d) {
        d.innerHTML = '<div class="coche">✓</div><div><div class="lib">L\'avantage</div><div class="txt">' + s.avantage + "</div></div>";
      });
      var w = e.__w || (e.__w = e.offsetWidth), h = e.__h || (e.__h = e.offsetHeight);
      M.place(e, 960 - w / 2, 922 - h + 30 * (1 - o), 1, o, 58);
    });
  }

  // ------------------------------------------------------------------ outils
  var Z = { voile: 60, tiroir: 62, notif: 81, toast: 82 };
  function ecran(contenu, id, nom, cam, o, z) { if (o <= 0.001) return null; return M.page(id, nom, cam, o, z, contenu); }
  function voile(contenu, id, o) { if (o > 0.001) M.bloc("voile-" + id, "voile", 0, 0, 1440, 810, o, Z.voile, contenu); }
  function calque(id, nom, r, parent, x, y, o, z, cls) {
    if (o !== undefined && o <= 0.001) return null;
    var e = M.recadre(id, nom, r, parent, cls);
    M.place(e, x === undefined ? r[0] : x, y === undefined ? r[1] : y, 1, o === undefined ? 1 : o, z || 2);
    return e;
  }
  function revele(id, nom, r, parent, u, z, effacer) {
    if (effacer) M.bloc("efface-" + id, "", r[0] + 3, r[1] + 3, r[2] - 6, r[3] - 6, 1, (z || 5) - 1, parent).style.background = "#f3f3f3";
    if (u <= 0.001) return null;
    var e = calque(id, nom, r, parent, r[0], r[1], 1, z || 5);
    M.css(e, { clipPath: "inset(0 " + ((1 - u) * 100).toFixed(2) + "% 0 0)" });
    return e;
  }
  function tiroir(contenu, id, nom, t, ta, tb) {
    if (t < ta || t > tb) return null;
    var u = Math.min(p(t, ta, ta + 0.45, "outQuint"), 1 - p(t, tb - 0.4, tb, "inOutQuint"));
    M.bloc("voile-tiroir-" + id, "voile-tiroir", 0, 0, 1440, 810, u, Z.tiroir - 1, contenu);
    var e = M.recadre("tiroir-" + id, nom, null, contenu, "tiroir-img");
    M.place(e, -600 * (1 - u), 0, 1, 1, Z.tiroir);
    return e;
  }
  function toast(contenu, id, nom, t, ta, tb) {
    if (t < ta || t > tb) return;
    var c = M.cap(nom), u = present(t, ta, tb, 0.25, 0.3);
    var e = M.recadre("toast-" + id, nom, null, contenu, "toast-app");
    M.place(e, 720 - c.largeur * 1.3 / 2, 810 - 34 - c.hauteur * 1.3 + 18 * (1 - u), 1.3, u, Z.toast);
  }
  function panneauCapture(id, l, h, etat, o, z) {
    var e = M.noeud("pc-" + id, "div", "recadre flottant");
    M.css(e, { width: l + "px", height: h + "px", borderRadius: "12px" });
    M.place(e, etat.x, etat.y, etat.s, o, z || 30);
    return e;
  }
  function etiquetteSous(id, txt, rs, o, theme, ecart) { M.etiquette(id, txt, rs[0] + rs[2] / 2, rs[1] + rs[3] + (ecart || 22), o, theme || "or", "b"); }
  function etiquetteDessus(id, txt, rs, o, theme, ecart) { M.etiquette(id, txt, rs[0] + rs[2] / 2, rs[1] - (ecart || 22), o, theme || "or", "h"); }
  function etiquetteDroite(id, txt, rs, o, theme, ecart) { M.etiquette(id, txt, rs[0] + rs[2] + (ecart || 26), rs[1] + rs[3] / 2, o, theme || "or", "g"); }
  function cliqueSur(rs) { return [rs[0] + rs[2] / 2, rs[1] + rs[3] / 2 + 2]; }
  var ONGLET_COURANT = "Accueil";

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
    var oFin = 1 - p(t, sortie, sortie + 0.7, "in"), monte = p(t, b1.debut - 0.4, b1.debut + 0.5, "inOut"), haut = 60 * p(t, sortie, sortie + 0.7, "inOut");
    logo("intro", t, 0.4, 960, m(470, 380, monte) - haut, m(0.92, 1, p(t, 0.4, 1.6, "out")) * m(1, 0.86, p(t, sortie, sortie + 0.7, "inOut")), p(t, 0.3, 1.0, "out") * oFin);
    var o1 = p(t, b1.debut - 0.1, b1.debut + 0.5, "out") * oFin, o2 = p(t, b2.debut - 0.1, b2.debut + 0.5, "out") * oFin;
    M.texte("intro-l2", '<div class="l2">Les nouveautés de l\'accueil</div>', "titre-intro", 0, 500 + 16 * (1 - o1) - haut, o1);
    M.texte("intro-l1", '<div class="l1">9 modules · démonstration Crêperie Démo, Rennes</div>', "titre-intro", 0, 590 + 16 * (1 - o2) - haut, o2);
  }

  // ------------------------------------------------------------------ 01 · l'accueil en direct
  function accueil(t, c) {
    var a1 = B("a1"), a2 = B("a2"), a3 = B("a3"), s = S("accueil"), fa = dernierBeat("accueil").debut;
    var E = ["midi-accueil-0", "midi-accueil-1", "midi-accueil-2", "midi-accueil-3"], EB = ["midi-accueil-0", "midi-accueil-1b", "midi-accueil-2b", "midi-accueil-3b"];
    var A = "midi-accueil-3b";
    var tN = [a2.debut + 0.2, a2.debut + 1.95, a2.debut + 3.7];
    var cList = M.camSur(A, [212, 512, 1015, 412], 26), cKpi = M.camSur(A, R(A, "kpis"), 40, 1.32);
    var camA = kCam(t, [[s.debut, M.camHaut(A)], [a1.debut + 0.4, M.camHaut(A)], [a2.debut, cList], [a3.debut - 0.2, cList], [a3.debut + 0.5, cKpi], [fa - 0.2, cKpi], [fa + 0.6, M.camHaut(A)]]);
    var w = M.monde("acc-A", camA, 1, 2, c);
    var i = 0; tN.forEach(function (x, j) { if (t >= x) i = j + 1; });
    var ti = i ? tN[i - 1] : -99;
    calque("acc-prec-" + i, i ? EB[i - 1] : EB[0], M.plein(EB[0]), w, 0, 0, 1, 1);
    if (i) {
      calque("acc-cour-" + i, E[i], M.plein(E[i]), w, 0, 0, p(t, ti + 0.45, ti + 0.75), 2);
      calque("acc-fin-" + i, EB[i], M.plein(EB[i]), w, 0, 0, p(t, ti + 2.6, ti + 3.3), 3);
      var u = p(t, ti, ti + 0.6, "inOutQuint");
      if (t < ti + 0.8) {
        var L = R(A, "listeEnc");
        var clip = M.bloc("acc-clip-" + i, "recadre", L[0], L[1], L[2], L[3], 1, 6, w);
        calque("acc-liste-" + i, EB[i - 1], L, clip, 0, 56 * u, 1, 1);
        calque("acc-neuve-" + i, E[i], R(E[i], "enc1"), clip, 0, -56 * (1 - u), u, 2);
      }
    }
    // Notifications d'encaissement, empilées en bas à gauche comme dans l'application
    var NS = 1.45;
    tN.forEach(function (tn, j) {
      if (t < tn || t > tn + 5.4) return;
      var nom = "midi-notif-" + (j + 1), cp = M.cap(nom), un = present(t, tn, tn + 5.4, 0.3, 0.45);
      var y = 810 - 26 - cp.hauteur * NS;
      for (var q = j + 1; q < tN.length; q++) if (t >= tN[q]) y -= (M.cap("midi-notif-" + (q + 1)).hauteur + 8) * NS * p(t, tN[q], tN[q] + 0.3, "out");
      var e = M.recadre("notif-" + j, nom, null, c, "notif");
      M.place(e, 26, y + 14 * (1 - un), NS, un, Z.notif);
    });
    // Indicateurs comparés au même jour de la semaine précédente
    var tC = motA("a3", "comparés");
    ["tuileTTC", "tuileHT", "tuileCouverts", "tuileMoyen"].forEach(function (cle, j) {
      var r = R(A, cle), d = [motA("a3", "chiffre"), motA("a3", "chiffre"), motA("a3", "couverts et"), motA("a3", "couvert moyen")][j] + 0.1;
      if (t < d || t > fa + 0.6) return;
      var dep = M.depuis(M.versScene(camA, r), r), uu = Math.min(p(t, d, d + 0.5, "outQuint"), 1 - p(t, fa, fa + 0.5, "inOut"));
      var et = { x: dep.x, y: dep.y - 18 * uu, s: dep.s };
      M.carte("acc-" + cle, A, r, et, 1, 31 + j);
      M.anneau("acc-d-" + cle, M.dansCarte(et, r, R(A, cle.replace("tuile", "delta"))), present(t, tC, fa + 0.3, 0.35, 0.3), "vert", 5, 10);
    });
    if (t > tC - 0.2 && t < fa + 0.4) {
      var rk = M.versScene(camA, R(A, "kpis"));
      etiquetteSous("acc-vs", "▲ vs même jour de la semaine précédente, à la même heure", [rk[0], rk[1], rk[2], rk[3] - 10], present(t, tC, fa + 0.3, 0.35, 0.3), "vert", 28);
    }
    voile(c, "acc", oAvantage(t, "accueil") * 0.45);
  }

  // ------------------------------------------------------------------ 02 · météo et CA attendu
  function meteo(t, c) {
    var A = "matin-accueil", P = "matin-previsions";
    var b1 = B("b1"), b2 = B("b2"), b3 = B("b3"), s = S("meteo");
    var tP = b3.debut - 0.45, tG = motA("b3", "sur 16") - 0.3;
    var camA = kCam(t, [[s.debut, M.camHaut(A)], [b1.debut + 0.3, M.camHaut(A)], [b2.debut, M.camA(A, 720, 420, 1.07)]]);
    var cG = M.camSur(P, [360, 171, 1015, 560], 28);
    var camP = kCam(t, [[tP, M.camHaut(P)], [tG, M.camHaut(P)], [tG + 0.8, cG], [s.fin + 1, M.camSur(P, [360, 171, 1015, 560], 28, 1.4, 0, 6)]]);
    ecran(c, "met-A", A, camA, t < tP + 0.6 ? 1 : 0, 2);
    ecran(c, "met-P", P, camP, t >= tP ? p(t, tP, tP + 0.5) : 0, 3);
    if (t >= tP) ONGLET_COURANT = "Prévisions météo";
    var dim = 0;
    // Score de clémence : la météo du jour soulevée, puis ses quatre critères
    var rC = R(A, "meteoJour"), l2 = M.souleve("met-chip", A, rC, camA, t, b2.debut - 0.1, b2.debut + 0.7, tP - 0.4, tP + 0.2, M.cible(rC, 600, 470, 680));
    if (l2) {
      dim = Math.max(dim, l2.u * 0.6);
      var rsScore = M.dansCarte(l2.etat, rC, R(A, "meteoScore")), oSc = present(t, motA("b2", "score") - 0.1, tP - 0.4, 0.35, 0.3);
      M.anneau("met-score", rsScore, oSc, null, 6, 16);
      etiquetteSous("met-score", "Score de clémence : 63 / 100", rsScore, oSc, "or", 30);
    }
    var oPan = present(t, motA("b2", "qui combine") - 0.4, tP - 0.3, 0.45, 0.4);
    if (oPan > 0) {
      var pan = M.noeud("met-crit", "div", "panneau", null, function (d) {
        d.innerHTML = "<h3>Score de clémence</h3><p>Note de 0 à 100 : la météo du jour, vue par la terrasse.</p>" +
          [["🌡️ Température", 35], ["☔ Pluie", 30], ["☀️ Ensoleillement", 25], ["💨 Vent", 10]].map(function (cr) {
            return '<div class="barre-critere"><div class="lib">' + cr[0] + '</div><div class="val">' + cr[1] + ' %</div><div class="fond-barre"></div><div class="plein" data-v="' + cr[1] + '"></div></div>';
          }).join("");
        d.__pleins = d.querySelectorAll(".plein"); d.__crits = d.querySelectorAll(".barre-critere");
      });
      M.css(pan, { width: "640px" });
      M.place(pan, 1010 + 40 * (1 - oPan), 250, 1, oPan, 40);
      ["température", "pluie", "ensoleillement", "vent"].forEach(function (mot, j) {
        var tm = motA("b2", mot);
        M.css(pan.__pleins[j], { width: (p(t, tm, tm + 0.7, "outQuint") * +pan.__pleins[j].getAttribute("data-v") / 35 * 100).toFixed(1) + "%" });
        M.css(pan.__crits[j], { opacity: (0.35 + 0.65 * p(t, tm - 0.1, tm + 0.3)).toFixed(3) });
      });
    }
    // CA attendu : la journée de prévision soulevée, avec la formule
    var rJ = R(P, "j1"), l3 = M.souleve("met-j1", P, rJ, camP, t, b3.debut + 0.2, b3.debut + 1.0, tG - 0.4, tG + 0.2, M.cibleH(rJ, 520, 500, 560));
    if (l3) {
      dim = Math.max(dim, l3.u * 0.6);
      M.anneau("met-ca", M.dansCarte(l3.etat, rJ, R(P, "j1Ca")), present(t, motA("b3", "chiffre d'affaires attendu"), tG - 0.4, 0.35, 0.3), null, 6, 12);
      M.anneau("met-j1score", M.dansCarte(l3.etat, rJ, R(P, "j1Score")), present(t, motA("b3", "corrigée"), tG - 0.4, 0.35, 0.3), "violet", 6, 16);
      var oF = present(t, b3.debut + 1.0, tG - 0.2, 0.45, 0.4);
      if (oF > 0) {
        var f = M.noeud("met-formule", "div", "panneau", null, function (d) {
          d.innerHTML = "<h3>Chiffre d'affaires attendu</h3><p>Ce que la journée devrait rapporter, avant l'ouverture.</p>" +
            '<div class="formule" style="margin-top:22px">Moyenne des <em>samedis</em><br><span style="font-size:20px;font-weight:500;color:rgba(255,255,255,.65)">sur les 8 dernières semaines</span></div>' +
            '<div class="formule" style="margin-top:14px">× correction <em>météo</em><br><span style="font-size:20px;font-weight:500;color:rgba(255,255,255,.65)">selon le score de clémence du jour</span></div>' +
            '<div class="formule" style="margin-top:18px;font-size:34px">= <em>≈ 4 900 €</em></div>';
        });
        M.css(f, { width: "700px" });
        M.place(f, 900 + 40 * (1 - oF), 260, 1, oF, 40);
      }
    }
    // Les 16 jours : meilleur et pire jour
    M.anneau("met-k2", M.versScene(camP, R(P, "k2")), present(t, tG + 0.8, s.fin + 0.2, 0.35, 0.3), "vert");
    M.anneau("met-k3", M.versScene(camP, R(P, "k3")), present(t, tG + 1.3, s.fin + 0.2, 0.35, 0.3));
    voile(c, "met", Math.max(dim, oAvantage(t, "meteo") * 0.45));
  }

  // ------------------------------------------------------------------ 03 · gestion des stocks
  function stocks(t, c) {
    var c2 = B("c2"), c3 = B("c3"), c4 = B("c4"), s = S("stocks");
    var A = "midi-accueil-3b", ST = "midi-stocks", STA = "midi-stocks-apres";
    var cStock = M.camSur(A, [212, 578, 1015, 600], 24);
    var tCl = motA("c2", "dans la cloche") - 0.5, tS = c3.debut - 0.35, tS2 = c4.debut + 3.4;
    var camA = kCam(t, [[s.debut, cStock], [tCl - 0.5, cStock], [tCl + 0.3, M.camHaut(A)]]);
    var cRows = M.camSur(ST, [360, 330, 1015, 330], 30, 1.34);
    var camS = kCam(t, [[tS, M.camHaut(ST)], [c3.debut + 0.2, M.camHaut(ST)], [c3.debut + 0.9, cRows], [tS2 - 0.1, cRows], [tS2 + 0.5, M.camHaut(ST)]]);
    ecran(c, "stk-A", A, camA, t < tS + 0.6 ? 1 : 0, 2);
    ecran(c, "stk-S", ST, camS, t >= tS ? p(t, tS, tS + 0.5) : 0, 3);
    if (t >= tS2) ecran(c, "stk-S2", STA, camS, p(t, tS2, tS2 + 0.3), 4);
    if (t >= tS) ONGLET_COURANT = "Stocks";
    function vs(nom, cle) { return M.versScene(camS, R(nom, cle)); }
    // Une vente de Cidre doux 75cl fait passer le stock de 3 à 2, sous le seuil de 6
    var tSeuil = motA("c2", "sous le seuil"), rsV = M.versScene(camA, R(A, "enc3"));
    M.anneau("stk-vente", rsV, present(t, c2.debut + 0.1, tSeuil + 1.6, 0.35, 0.3), null, 2, 10);
    M.etiquette("stk-vente", "Cidre doux 75cl vendu", rsV[0] + rsV[2] - 20, rsV[1] - 22, present(t, c2.debut + 0.4, tSeuil + 1.4, 0.35, 0.3), "clair", "d");
    var rsCi = M.versScene(camA, R(A, "alerteCidre"));
    M.anneau("stk-cidre", rsCi, present(t, tSeuil - 0.2, tCl, 0.35, 0.3), null, 2, 10);
    etiquetteDroite("stk-cidre", "Stock 3 → 2 · seuil 6", [rsCi[0] + rsCi[2] - 10, rsCi[1], 0, rsCi[3]], present(t, tSeuil, tCl, 0.35, 0.3), "or", 24);
    toast(c, "alerte", "midi-toast-alerte", t, motA("c2", "une alerte") - 0.2, tS - 0.2);
    if (t > tCl && t < tS + 0.3) {
      var oM = present(t, tCl + 0.4, tS + 0.3, 0.3, 0.3), rMenu = R("midi-cloche", "menu");
      calque("stk-menu", "midi-cloche", rMenu, c, rMenu[0], rMenu[1] - 10 * (1 - oM), oM, 70, "notif");
      M.anneau("stk-cloche", vue(R("midi-cloche", "cloche")), present(t, tCl + 0.1, tS - 0.2, 0.3, 0.3), null, 6, 20);
      M.anneau("stk-menu", vue(rMenu), present(t, tCl + 0.6, tS + 0.2, 0.3, 0.3), null, 4, 12);
    }
    // Tableau des stocks, fiche du produit et historique des mouvements
    var tT = motA("c3", "avec l'historique") - 0.2;
    var oRows = present(t, c3.debut + 0.6, tT + 0.2, 0.35, 0.3);
    M.anneau("stk-r-cidre", vs(ST, "cidre"), oRows, null, 2, 8);
    M.anneau("stk-r-blanc", vs(ST, "blanc"), oRows, null, 2, 8);
    etiquetteDessus("stk-acommander", "À commander", vs(ST, "cidreStock"), oRows, "or", 26);
    var tir = tiroir(c, "stock", "midi-stock-tiroir-seul-vide", t, tT, c4.debut + 3.3);
    if (tir) {
      var VQ = "midi-stock-tiroir-seul-rempli";
      revele("stk-q", VQ, R(VQ, "quantite"), tir, p(t, c4.debut + 0.75, c4.debut + 1.0, "lin"), 5, t > c4.debut + 0.7);
      revele("stk-c", VQ, R(VQ, "commentaire"), tir, p(t, c4.debut + 1.45, c4.debut + 2.2, "lin"), 5, t > c4.debut + 1.4);
    }
    var rH = [24, 376, 552, 420], tH = tT + 0.7;
    if (t > tH && t < c4.debut + 0.2) {
      var uH = Math.min(p(t, tH, tH + 0.7, "inOutQuint"), 1 - p(t, c4.debut - 0.4, c4.debut + 0.2, "inOut"));
      var etH = M.interp(M.depuis(vue(rH), rH), M.cible(rH, 1250, 575, 820), uH);
      M.carte("stk-histo", "midi-stock-tiroir-seul-vide", rH, etH, 1, 33);
      etiquetteDessus("stk-histo", "Ventes, livraisons, inventaires, pertes : chaque mouvement est tracé", [etH.x, etH.y, rH[2] * etH.s, rH[3] * etH.s], present(t, tH + 0.6, c4.debut, 0.35, 0.25), "clair", 22);
    }
    // Saisie d'une livraison
    var VV = "midi-stock-tiroir-seul-vide";
    var pQ = cliqueSur(vue(R(VV, "quantite"))), pC = cliqueSur(vue(R(VV, "commentaire"))), pE = cliqueSur(vue(R(VV, "enregistrer")));
    if (t > c4.debut - 0.4 && t < c4.debut + 4.2) {
      M.curseur(t, [[c4.debut - 0.4, 1120, 760], [c4.debut + 0.5, pQ[0] - 120, pQ[1]], [c4.debut + 1.2, pC[0] - 60, pC[1]], [c4.debut + 2.8, pE[0], pE[1]], [c4.debut + 3.6, pE[0] + 40, pE[1] + 60]],
        [c4.debut + 0.6, c4.debut + 1.3, c4.debut + 3.0], present(t, c4.debut - 0.4, c4.debut + 4.2, 0.3, 0.4));
    }
    toast(c, "stock", "midi-toast-stock", t, c4.debut + 3.3, c4.debut + 5.8);
    var oApres = present(t, c4.debut + 3.7, s.fin + 0.3, 0.35, 0.3), oAv = oAvantage(t, "stocks");
    M.anneau("stk-r-cidre2", vs(STA, "cidre"), oApres * (1 - oAv * 0.6), "vert", 2, 8);
    etiquetteDessus("stk-14", "Stock 14 · alerte levée", vs(STA, "cidreStock"), oApres * (1 - oAv * 0.6), "vert", 26);
    M.anneau("stk-cloche2", vs(STA, "cloche"), present(t, c4.debut + 4.2, s.fin + 0.3, 0.3, 0.3) * (1 - oAv * 0.6), "vert", 6, 20);
    voile(c, "stk", oAv * 0.45);
  }

  // ------------------------------------------------------------------ 04 · créneaux de service
  function creneaux(t, c) {
    var e2 = B("e2"), e3 = B("e3"), s = S("creneaux");
    var CR = "aprem-creneaux", RP = "aprem-repartition";
    var tRp = e3.debut - 0.3;
    var camR = kCam(t, [[tRp, M.camSur(RP, R(RP, "creneaux"), 30, 1.15)], [s.fin + 1, M.camSur(RP, R(RP, "creneaux"), 30, 1.3)]]);
    ecran(c, "cre-C", CR, M.camHaut(CR), t < tRp + 0.6 ? 1 : 0, 2);
    ONGLET_COURANT = t >= tRp ? "Taux de répartition" : "Créneaux de service";
    var dim = 0;
    var rCa = R(CR, "carte"), l2 = M.souleve("cre-carte", CR, rCa, M.camHaut(CR), t, e2.debut - 0.2, e2.debut + 0.6, tRp - 0.5, tRp + 0.1, M.cible(rCa, 960, 362, 1150));
    var tc = [motA("e2", "midi"), motA("e2", "limonade"), motA("e2", "soir")];
    if (l2) {
      dim = Math.max(dim, l2.u * 0.6);
      ["c1", "c2", "c3"].forEach(function (cc, j) { M.anneau("cre-" + cc, M.dansCarte(l2.etat, rCa, R(CR, cc)), present(t, tc[j], tRp - 0.4, 0.3, 0.3), ["", "vert", "violet"][j] || null, 4, 10); });
      var rsC2 = M.dansCarte(l2.etat, rCa, R(CR, "c2"));
      M.anneau("cre-heures", [rsC2[0] + rsC2[2] * 0.26, rsC2[1], rsC2[2] * 0.36, rsC2[3]], present(t, motA("e2", "librement") - 0.1, tc[0] - 0.1, 0.3, 0.3), null, 6, 12);
      var oJ = present(t, e2.debut + 0.5, tRp - 0.3, 0.45, 0.4);
      if (oJ > 0) {
        var jr = M.noeud("cre-journee", "div", "panneau", null, function (d) {
          var X = function (h) { return ((h - 8) / 16 * 1100).toFixed(1); };
          d.innerHTML = '<div class="journee" style="position:relative"><div class="axe"></div>' +
            '<div class="seg" style="left:' + X(8) + 'px;width:' + (X(15) - X(8)) + 'px;background:linear-gradient(90deg,#e8a33d,#f2c062)"></div>' +
            '<div class="seg" style="left:' + (+X(15) + 4) + 'px;width:' + (X(18.5) - X(15) - 4) + 'px;background:linear-gradient(90deg,#20a39e,#45c4b0)"></div>' +
            '<div class="seg" style="left:' + (+X(18.5) + 4) + 'px;width:' + (X(24) - X(18.5) - 4) + 'px;background:linear-gradient(90deg,#4a5fc1,#6c7fe0)"></div>' +
            '<div class="seg-lib" style="left:' + X(8) + 'px;color:#f2c062">Service du midi<small>08:00 – 15:00</small></div>' +
            '<div class="seg-lib" style="left:' + (+X(15) + 6) + 'px;color:#45c4b0">Limonade<small>15:00 – 18:30</small></div>' +
            '<div class="seg-lib" style="left:' + (+X(18.5) + 8) + 'px;color:#8a9bf0">Service du soir<small>18:30 – 00:00</small></div>' +
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
    if (t > tRp - 0.1) {
      var wR = M.monde("cre-R", camR, p(t, tRp, tRp + 0.5), 3, c);
      M.recadre("page-cre-R", RP, null, wR);
      var rCo = R(RP, "creneauxCorps"), hCache = 335 * (1 - p(t, tRp + 0.5, tRp + 1.6, "outQuint"));
      if (hCache > 0.5) M.bloc("cre-cache", "cache-blanc", rCo[0] + 2, rCo[1] + 4, rCo[2] - 4, hCache, 1, 5, wR);
      M.anneau("cre-repart", M.versScene(camR, R(RP, "creneaux")), present(t, tRp + 1.4, dernierBeat("creneaux").debut, 0.35, 0.3), null, 4, 14);
    }
    voile(c, "cre", Math.max(dim, oAvantage(t, "creneaux") * 0.45));
  }

  // ------------------------------------------------------------------ 05 · réservations
  function resas(t, c) {
    var r1 = B("r1"), r2 = B("r2"), r3 = B("r3"), r4 = B("r4"), s = S("resas");
    var A = "soir-accueil", RS = "soir-resas", RA = "soir-resas-apres", RV = "soir-resas-arrive";
    var tR = r2.debut + 2.7, tRA = r3.debut + 5.35, tRV = r4.debut + 2.75;
    var r1f = r1.finVoix || r1.fin;  // après le carton « Nouveau »
    var camA = kCam(t, [[s.debut, M.camHaut(A)], [r1f - 0.2, M.camHaut(A)], [r1f + 0.6, M.camA(A, 720, 1490, 1)]]);
    var camR = kCam(t, [[tR, M.camHaut(RS)], [tR + 0.6, M.camHaut(RS)], [motA("r2", "allergie") - 0.2, M.camA(RS, 720, 960, 1)], [r3.debut - 0.4, M.camA(RS, 720, 960, 1)], [r3.debut + 0.3, M.camHaut(RS)],
      [tRA + 0.3, M.camHaut(RS)], [tRA + 1.1, M.camA(RS, 720, 1060, 1)], [s.fin + 1, M.camA(RS, 720, 1060, 1)]]);
    ecran(c, "res-A", A, camA, t < tR + 0.6 ? 1 : 0, 2);
    ecran(c, "res-R", RS, camR, t >= tR && t < tRA + 0.4 ? p(t, tR, tR + 0.5) : 0, 3);
    ecran(c, "res-RA", RA, camR, t >= tRA && t < tRV + 0.4 ? p(t, tRA, tRA + 0.3) : 0, 4);
    ecran(c, "res-RV", RV, camR, t >= tRV ? p(t, tRV, tRV + 0.3) : 0, 5);
    if (t >= tR) ONGLET_COURANT = "Réservations";
    var dim = 0;
    // La carte « Réservations du jour » de l'accueil
    var rRe = R(A, "resa"), l1 = M.souleve("res-carte", A, rRe, camA, t, r1f + 0.6, r1f + 1.3, tR - 0.6, tR, M.cible(rRe, 960, 470, 940));
    if (l1) {
      dim = Math.max(dim, l1.u * 0.6);
      M.anneau("res-resume", M.dansCarte(l1.etat, rRe, R(A, "resaResume")), present(t, r2.debut + 0.2, tR - 0.6, 0.35, 0.3));
    }
    // La liste complète : statuts et notes
    M.anneau("res-onglets", M.versScene(camR, R(RS, "onglets")), present(t, tR + 0.4, motA("r2", "allergie") - 0.3, 0.35, 0.3), null, 4, 12);
    M.anneau("res-allergie", M.versScene(camR, R(RS, "allergie")), present(t, motA("r2", "allergie"), r3.debut - 0.3, 0.35, 0.3), null, 2, 8);
    // Saisie d'une réservation
    var pAj = cliqueSur(M.versScene(M.camHaut(RS), R(RS, "ajouter")));
    var tir = tiroir(c, "resa", "soir-resa-tiroir-vide", t, r3.debut + 0.6, r3.debut + 5.3);
    var TR = "soir-resa-tiroir-rempli";
    if (tir) {
      revele("res-nom", TR, R(TR, "nom"), tir, p(t, r3.debut + 1.0, r3.debut + 1.5, "lin"), 5, t > r3.debut + 0.95);
      revele("res-tel", TR, R(TR, "tel"), tir, p(t, r3.debut + 1.55, r3.debut + 2.05, "lin"), 5, t > r3.debut + 1.5);
      revele("res-heure", TR, R(TR, "heure"), tir, p(t, r3.debut + 2.15, r3.debut + 2.4, "lin"), 5, t > r3.debut + 2.1);
      revele("res-couv", TR, R(TR, "couverts"), tir, p(t, r3.debut + 2.5, r3.debut + 2.65, "lin"), 5, t > r3.debut + 2.45);
      revele("res-note", TR, R(TR, "note"), tir, p(t, r3.debut + 2.75, r3.debut + 3.25, "lin"), 5, t > r3.debut + 2.7);
      M.anneau("res-sms", vue(R(TR, "sms")), present(t, motA("r3", "SMS") - 0.9, r3.debut + 5.0, 0.3, 0.3), null, 6, 10);
    }
    M.etiquette("res-appel", "📞 Une table de 4 pour 21 h", FEN.x + FEN.l - 30, FEN.y + 120, present(t, r3.debut - 0.2, r3.debut + 1.4, 0.3, 0.3), "clair", "d");
    toast(c, "resa", "soir-toast-resa", t, r3.debut + 5.4, r3.debut + 7.6);
    M.anneau("res-legall", M.versScene(camR, R(RA, "legall")), present(t, tRA + 1.1, r4.debut + 0.2, 0.35, 0.3), null, 2, 8);
    // Une table en retard arrive : statut en un clic
    var rsDa = M.versScene(camR, R(RS, "david"));
    M.anneau("res-david", rsDa, present(t, r4.debut, r4.debut + 1.0, 0.35, 0.3), null, 2, 8);
    var tir2 = tiroir(c, "statut", "soir-resa-statut", t, r4.debut + 0.95, r4.debut + 2.7);
    if (tir2) M.anneau("res-statuts", vue(R("soir-resa-statut", "statuts")), present(t, r4.debut + 1.3, r4.debut + 2.6, 0.3, 0.3), null, 6, 10);
    M.anneau("res-david2", rsDa, present(t, r4.debut + 3.0, s.fin + 0.3, 0.35, 0.3) * (1 - oAvantage(t, "resas") * 0.6), "vert", 2, 8);
    toast(c, "statut", "soir-toast-statut", t, r4.debut + 2.75, r4.debut + 4.9);
    var pNom = [rsDa[0] + 260, rsDa[1] + rsDa[3] / 2 + 2], pArr = cliqueSur(vue(R("soir-resa-statut", "arrive"))), pOk = cliqueSur(vue(R(TR, "ok")));
    if (t > r3.debut - 0.3 && t < r4.debut + 3.6) {
      M.curseur(t, [[r3.debut - 0.3, 1000, 640], [r3.debut + 0.35, pAj[0], pAj[1]], [r3.debut + 1.1, pAj[0] - 320, pAj[1] + 320], [r3.debut + 4.8, pOk[0], pOk[1]],
        [r3.debut + 5.8, pOk[0] + 200, pOk[1] - 150], [r4.debut + 0.1, pNom[0] + 60, pNom[1] + 60], [r4.debut + 0.75, pNom[0], pNom[1]], [r4.debut + 2.2, pArr[0], pArr[1]], [r4.debut + 3.3, pArr[0] + 200, pArr[1] + 160]],
        [r3.debut + 0.5, r3.debut + 5.0, r4.debut + 0.85, r4.debut + 2.4], present(t, r3.debut - 0.3, r4.debut + 3.6, 0.3, 0.4));
    }
    voile(c, "res", Math.max(dim, oAvantage(t, "resas") * 0.45));
  }

  // ------------------------------------------------------------------ 06 · bons cadeaux
  function bons(t, c) {
    var g2 = B("g2"), g3 = B("g3"), s = S("bons");
    var BO = "aprem-bons", BA = "aprem-bons-apres", B30 = "aprem-bons-30j";
    var t50 = Math.max(motA("g2", "montant"), g2.debut + 0.9), tNote = Math.max(motA("g2", "occasion"), t50 + 1.0), tOk = Math.max(motA("g2", "code unique"), tNote + 0.9) + 0.2;
    var tBa = tOk + 0.25, tB30 = g3.debut + 0.45;
    ecran(c, "bon-B", BO, M.camHaut(BO), t < tBa + 0.5 ? 1 : 0, 2);
    ecran(c, "bon-BA", BA, M.camHaut(BA), t >= tBa && t < tB30 + 0.5 ? p(t, tBa, tBa + 0.3) : 0, 3);
    ecran(c, "bon-B30", B30, M.camHaut(B30), t >= tB30 ? p(t, tB30, tB30 + 0.3) : 0, 4);
    ONGLET_COURANT = "Bons cadeaux";
    var VB = t < t50 + 0.05 ? "aprem-bon-tiroir-vide" : "aprem-bon-tiroir-50";
    var tir = tiroir(c, "bon-" + VB, VB, t, g2.debut + 0.35, tOk + 0.2);
    if (tir) {
      if (t >= t50 + 0.05 && t < t50 + 0.35) calque("bon-fondu", "aprem-bon-tiroir-vide", M.plein("aprem-bon-tiroir-vide"), tir, 0, 0, 1 - p(t, t50 + 0.05, t50 + 0.35), 3);
      revele("bon-note", "aprem-bon-tiroir-rempli", R("aprem-bon-tiroir-rempli", "note"), tir, p(t, tNote, tNote + 0.55, "lin"), 5, t > tNote - 0.05);
      M.anneau("bon-apercu", vue(R("aprem-bon-tiroir-vide", "apercu")), present(t, t50 + 0.3, tNote - 0.1, 0.3, 0.3), null, 4, 16);
    }
    var TB = "aprem-bon-tiroir-vide";
    var pCr = cliqueSur(vue(R(BO, "creer"))), p50 = cliqueSur(vue(R(TB, "chip50"))), pNote = cliqueSur(vue(R(TB, "note"))), pOk = cliqueSur(vue(R(TB, "creer"))), pTab = cliqueSur(vue(R(BA, "tabProche")));
    if (t > g2.debut - 0.8 && t < g3.debut + 1.5) {
      M.curseur(t, [[g2.debut - 0.8, 980, 620], [g2.debut + 0.1, pCr[0], pCr[1]], [t50 - 0.4, p50[0] + 140, p50[1] + 120], [t50 - 0.05, p50[0], p50[1]],
        [tNote - 0.2, pNote[0] - 80, pNote[1]], [tOk - 0.15, pOk[0], pOk[1]], [tOk + 0.7, pOk[0] + 120, pOk[1] - 200], [g3.debut + 0.05, pTab[0] + 60, pTab[1] + 80], [g3.debut + 0.35, pTab[0], pTab[1]], [g3.debut + 1.4, pTab[0] + 70, pTab[1] + 140]],
        [g2.debut + 0.25, t50, tNote - 0.1, tOk, g3.debut + 0.42], present(t, g2.debut - 0.8, g3.debut + 1.5, 0.3, 0.4));
    }
    toast(c, "bon", "aprem-toast-bon", t, tBa, tBa + 2.6);
    var oK = present(t, tBa + 0.4, g3.debut + 0.4, 0.35, 0.3);
    M.anneau("bon-kactifs", vue(R(BA, "kActifs")), oK, "vert", 2, 12);
    M.anneau("bon-ksolde", vue(R(BA, "kSolde")), oK, "vert", 2, 12);
    M.anneau("bon-l1", vue(R(BA, "l1")), present(t, tBa + 0.6, g3.debut + 0.4, 0.35, 0.3), null, 2, 8);
    etiquetteSous("bon-nouveau", "Nouveau bon · 50,00 € · valable 1 an", vue(R(BA, "l1")), present(t, tBa + 0.7, g3.debut + 0.4, 0.35, 0.3), "or", 18);
    var oAv = oAvantage(t, "bons");
    M.anneau("bon-ksol30", vue(R(B30, "kSolde")), present(t, motA("g3", "soldes") + 0.3, s.fin + 0.3, 0.35, 0.3) * (1 - oAv * 0.6), null, 2, 12);
    M.anneau("bon-kexp", vue(R(B30, "kExpirent")), present(t, motA("g3", "expirent"), s.fin + 0.3, 0.35, 0.3) * (1 - oAv * 0.6), null, 2, 12);
    M.anneau("bon-exp", vue([360, 481, 1013, 120]), present(t, motA("g3", "expirent") + 0.3, s.fin + 0.3, 0.35, 0.3) * (1 - oAv * 0.6), null, 2, 8);
    voile(c, "bon", oAv * 0.45);
  }

  // ------------------------------------------------------------------ 07 · objectifs
  function objectifs(t, c) {
    var o2 = B("o2"), o3 = B("o3"), s = S("objectifs");
    var OB = "nuit-objectifs", NA = "nuit-accueil";
    var tNA = o3.debut - 0.4;
    var camO = kCam(t, [[s.debut, M.camSur(OB, R(OB, "novembre"), 30, 1.15)], [tNA + 1, M.camSur(OB, R(OB, "novembre"), 30, 1.3)]]);
    if (t < tNA + 0.6) {
      var wO = M.monde("obj-O", camO, 1, 2, c);
      M.recadre("page-obj-O", OB, null, wO);
      var rG = R(OB, "novGraphe"), lc = rG[2] * (1 - p(t, o2.debut + 0.1, o2.debut + 1.8, "inOut"));
      if (lc > 0.5) M.bloc("obj-cache", "cache-blanc", rG[0] + rG[2] - lc, rG[1] + 2, lc, rG[3] - 40, 1, 5, wO);
    }
    ONGLET_COURANT = t >= tNA ? "Accueil" : "Objectifs";
    M.anneau("obj-ca", M.versScene(camO, R(OB, "novCA")), present(t, motA("o2", "chiffre"), tNA, 0.35, 0.3), null, 4, 12);
    M.anneau("obj-couv", M.versScene(camO, R(OB, "novCouverts")), present(t, motA("o2", "couverts"), tNA, 0.35, 0.3), null, 4, 12);
    ecran(c, "obj-NA", NA, M.camHaut(NA), t >= tNA ? p(t, tNA, tNA + 0.5) : 0, 3);
    // Sur l'accueil : avancement, écart, projection
    var rO = [728, 501, 500, 200], l3 = M.souleve("obj-carte", NA, rO, M.camHaut(NA), t, o3.debut + 0.15, o3.debut + 0.85, s.fin - 0.2, s.fin + 0.4, M.cible(rO, 960, 430, 1000));
    var dim = 0;
    if (l3) {
      dim = Math.max(dim, l3.u * 0.6);
      M.anneau("obj-pct", M.dansCarte(l3.etat, rO, R(NA, "objPct")), present(t, motA("o3", "avancement"), s.fin, 0.35, 0.3), null, 4, 12);
      M.anneau("obj-ecart", M.dansCarte(l3.etat, rO, R(NA, "objEcart")), present(t, motA("o3", "l'écart"), s.fin, 0.35, 0.3), "vert", 4, 12);
      var rD = R(NA, "objDetail"), rE = R(NA, "objEcart");
      M.anneau("obj-proj", M.dansCarte(l3.etat, rO, [rE[0] + rE[2] + 16, rD[1], rD[2] - rE[2] - 16, rD[3]]), present(t, motA("o3", "projection"), s.fin, 0.35, 0.3), "vert", 4, 12);
    }
    voile(c, "obj", Math.max(dim, oAvantage(t, "objectifs") * 0.3));
  }

  // ------------------------------------------------------------------ 08 · assistant Pop'IA
  var QUESTIONS = [
    { k: 1, frappe: function () { return [B("p2").debut + 0.1, B("p2").debut + 1.1]; } },
    { k: 2, frappe: function () { return [B("p3").debut - 0.4, B("p3").debut + 0.55]; } },
    { k: 3, frappe: function () { return [B("p4").debut - 0.4, B("p4").debut + 0.5]; } }
  ];
  function popia(t, c) {
    var p1 = B("p1"), s = S("popia"), NA = "nuit-accueil";
    ecran(c, "pop-NA", NA, M.camHaut(NA), 1, 2);
    ONGLET_COURANT = "Accueil";
    var dim = 0;
    var rB = R("nuit-popia-ecran", "bouton"), rP = R("nuit-popia-ecran", "panneau");
    var tClic = (p1.finVoix || p1.fin) + 0.35, tOuv = tClic + 0.1, tLeve = tOuv + 0.55, tFin = s.fin - 0.1;  // clic après le carton
    if (t > s.debut && t < tOuv + 0.4) {
      calque("pop-bouton", "nuit-popia-ecran", rB, c, rB[0], rB[1], present(t, s.debut, tOuv + 0.4, 0.3, 0.2), 70);
      M.anneau("pop-bouton", vue(rB), present(t, p1.debut - 0.1, tOuv, 0.3, 0.2), null, 6, 34);
      var pB = cliqueSur(vue(rB));
      M.curseur(t, [[p1.debut - 0.2, 1350, 620], [tClic - 0.15, pB[0], pB[1]], [tOuv + 0.4, pB[0] + 30, pB[1] + 40]], [tClic], present(t, p1.debut - 0.2, tOuv + 0.4, 0.3, 0.3));
    }
    if (t >= tOuv && t < tFin + 0.6) {
      var uO = p(t, tOuv, tOuv + 0.4, "outQuint"), uL = Math.min(p(t, tLeve, tLeve + 0.7, "inOutQuint"), 1 - p(t, tFin, tFin + 0.6, "inOutQuint"));
      var rsP = vue(rP), depP = { x: rsP[0] + rsP[2] * (1 - uO) * 0.92, y: rsP[1] + rsP[3] * (1 - uO) * 0.95, s: m(0.08, 1, uO) };
      // Pendant le bandeau « L'avantage », le panneau remonte et rétrécit un peu pour lui laisser la place
      var oA = oAvantage(t, "popia");
      var et = M.interp(depP, M.cible([0, 0, 760, 700], 960, m(520, 450, oA), m(900, 780, oA)), uL);
      dim = Math.max(dim, uL * 0.65);
      var pan = panneauCapture("popia", 760, 700, et, Math.min(uO * 1.5, 1) * (1 - p(t, tFin + 0.2, tFin + 0.6)), 35);
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
      if (q.k > 1 && t < f[0] + 0.5) {
        var nomP = "nuit-popia-" + (q.k - 1), uU = p(t, f[0] - 0.4, f[0] + 0.3, "inOut");
        calque("pop-prec-q-" + q.k, nomP, R(nomP, "question"), pan, R(nomP, "question")[0], R(nomP, "question")[1] - 60 * uU, 1 - uU, 3);
        calque("pop-prec-r-" + q.k, nomP, R(nomP, "reponse"), pan, R(nomP, "reponse")[0], R(nomP, "reponse")[1] - 60 * uU, 1 - uU, 3);
      }
      var rsQ = M.dansCarte(et, [0, 0, 760, 700], rQ);
      M.etiquette("pop-lib-" + q.k, ["Ses samedis midi", "Crêpes au goûter", "Top 10 du mois"][q.k - 1], et.x - 24, rsQ[1] + rsQ[3] / 2,
        present(t, tEnvoi, (q.k < 3 ? QUESTIONS[q.k].frappe()[0] - 0.3 : tFin), 0.35, 0.3) * uL * (1 - oA), "or", "d");
    }
    voile(c, "pop", dim);
  }

  // ------------------------------------------------------------------ 09 · export comptable
  function exportCompta(t, c) {
    var x2 = B("x2"), EX = "nuit-export";
    var cEx = M.camSur(EX, [360, 118, 1015, 600], 26);
    ecran(c, "exp-E", EX, cEx, 1, 2);
    ONGLET_COURANT = "Export comptable";
    var dim = 0;
    M.anneau("exp-kpis", M.versScene(cEx, R(EX, "kpis")), present(t, x2.debut + 0.2, motA("x2", "FEC") - 0.3, 0.35, 0.3), null, 4, 14);
    M.anneau("exp-format", M.versScene(cEx, R(EX, "format")), present(t, motA("x2", "FEC") - 0.2, motA("x2", "contrôles"), 0.35, 0.3), null, 6, 12);
    var rsT = M.versScene(cEx, R(EX, "telecharger")), pT = cliqueSur(rsT), tClic = Math.max(motA("x2", "contrôles"), x2.debut + 3.2);
    if (t > x2.debut + 1.2 && t < tClic + 1.2) M.curseur(t, [[x2.debut + 1.2, 1240, 760], [tClic - 0.2, pT[0], pT[1]], [tClic + 1.2, pT[0] - 80, pT[1] + 180]], [tClic], present(t, x2.debut + 1.2, tClic + 1.2, 0.3, 0.4));
    toast(c, "export", "nuit-toast-export", t, tClic + 0.15, tClic + 2.8);
    var tFi = tClic + 0.5, finFi = S("fin").debut + 0.5;
    if (t > tFi && t < finFi + 0.6) {
      var uFi = p(t, tFi, tFi + 0.8, "outQuint"), oFi = Math.min(p(t, tFi, tFi + 0.3), 1 - p(t, finFi, finFi + 0.5));
      dim = Math.max(dim, uFi * 0.6 * (1 - p(t, finFi, finFi + 0.5)));
      var fi = M.noeud("exp-fichier", "div", "fichier", null, function (d) {
        var lignes = (TX["nuit.fecDebut"] || []).map(function (l) { return l.split("\t"); });
        function pad(sx, n) { sx = String(sx || ""); return sx.length > n ? sx.slice(0, n - 1) + "…" : sx + new Array(n - sx.length + 1).join(" "); }
        function padG(sx, n) { sx = String(sx || ""); return new Array(Math.max(0, n - sx.length) + 1).join(" ") + sx; }
        var corps = lignes.slice(0, 9).map(function (cc, i) {
          var l = pad(cc[3], 10) + pad(cc[4], 8) + pad(cc[5], 30) + padG(cc[11], 10) + padG(cc[12], 10);
          return i === 0 ? "<b>" + l + "</b>" : l;
        }).join("\n");
        d.innerHTML = '<div class="tete-fichier"><div class="ico">FEC</div><div><div class="nom">' + (TX["nuit.fichierFec"] || "FEC.txt") + '</div><div class="meta">Fichier des écritures comptables · 18 colonnes · ' + ((TX["nuit.toastExport"] || "").replace(/\D+/g, "") || "252") + " lignes</div></div></div><pre>" + corps + "\n…</pre>";
      });
      M.place(fi, m(pT[0] - 980 * 0.12, 940 - 490, uFi), m(pT[1], 150, uFi), m(0.12, 1, uFi), oFi, 42);
    }
    voile(c, "exp", Math.max(dim, oAvantage(t, "export") * 0.45));
  }

  // ------------------------------------------------------------------ générique de fin
  var TUILES = [
    ["01 · Accueil en direct", "midi-accueil-3", "encaissements"], ["02 · Météo et CA attendu", "matin-accueil", "meteo"], ["03 · Gestion des stocks", "midi-stocks", "carte"],
    ["04 · Créneaux de service", "aprem-repartition", "creneaux"], ["05 · Réservations", "soir-accueil", "resa"], ["06 · Bons cadeaux", "aprem-bon-tiroir-50", "apercu"],
    ["07 · Objectifs", "nuit-objectifs", "novembre"], ["08 · Assistant Pop'IA", "nuit-popia-1", "reponse"], ["09 · Export comptable", "nuit-export", "parametrage"]
  ];
  function fin(t) {
    var f1 = B("f1"), s = S("fin"), a = s.debut + 0.7, sortie = f1.fin - 0.1, tLogo = sortie + 0.6;
    TUILES.forEach(function (tu, i) {
      var col = i % 3, lig = Math.floor(i / 3), ta = a + i * 0.1, tb = sortie + (8 - i) * 0.04;
      if (t < ta || t > tb + 0.6) return;
      var u = p(t, ta, ta + 0.7, "outBack"), v = p(t, tb, tb + 0.5, "inOut"), o = Math.min(p(t, ta, ta + 0.35), 1 - v);
      var cx = 960 + (col - 1) * 420, cy = 255 + lig * 245;
      var e = M.noeud("tuile-" + i, "div", "mosaique-tuile grande", null, function (d) { d.innerHTML = '<div class="lib">' + tu[0] + "</div>"; });
      M.css(e, { transformOrigin: "50% 50%" });
      M.place(e, cx - 195, cy - 112 + 30 * (1 - u), m(0.86, 1, u) * m(1, 0.9, v), o, 44);
      var r = R(tu[1], tu[2]), sc = Math.max(366 / r[2], 160 / r[3]);
      var clip = M.bloc("tuile-clip-" + i, "tuile-clip", 12, 12, 366, 160, 1, 1, e);
      var cr = M.recadre("tuile-img-" + i, tu[1], r, clip, "");
      M.place(cr, 0, 0, sc, 1, 1);  // ancrée en haut à gauche : le titre de la carte reste visible
    });
    var oL = present(t, tLogo, TL.duree + 1, 0.8, 0.01) * (1 - p(t, TL.duree - 0.9, TL.duree - 0.15));
    logo("fin", t, tLogo, 960, 420, 1, oL);
    var oS = p(t, tLogo + 0.5, tLogo + 1.2) * (1 - p(t, TL.duree - 0.9, TL.duree - 0.15));
    M.texte("fin-slogan", "Neuf nouveautés, un seul accueil : <b>tout le service au même endroit</b>.", "slogan", 0, 540 + 14 * (1 - p(t, tLogo + 0.5, tLogo + 1.2)), oS);
    M.texte("fin-mention", "Démonstration · Crêperie Démo, Rennes · toutes les données affichées sont simulées<br>" + TL.creditVoix, "mention", 0, 968, p(t, tLogo + 0.9, tLogo + 1.6) * (1 - p(t, TL.duree - 0.9, TL.duree - 0.15)));
  }

  // ------------------------------------------------------------------ assemblage
  var SEQUENCES = [["accueil", accueil], ["meteo", meteo], ["stocks", stocks], ["creneaux", creneaux], ["resas", resas], ["bons", bons], ["objectifs", objectifs], ["popia", popia], ["export", exportCompta]];
  function rendre(t) {
    M.debutImage();
    fond(t);
    frise(t);
    if (t < MODULES[0].debut + 1) intro(t);
    var ef = etatFenetre(t);
    if (ef.o > 0.001) {
      ONGLET_COURANT = "Accueil";
      var contenu = M.fenetre(ef, "Accueil");
      SEQUENCES.forEach(function (sq, i) {
        var sc = S(sq[0]);
        var debut = i === 0 ? 0 : sc.debut - 0.05, finSc = sc.fin + 1.0;
        if (t < debut || t > finSc) return;
        var oSeq = i === 0 ? 1 : p(t, sc.debut + 0.3, sc.debut + 0.85);
        var couche = M.bloc("seq-" + sq[0], "", 0, 0, 1440, 810, oSeq, 1 + i, contenu);
        if (t >= sc.debut + 0.55 || i === 0) ONGLET_COURANT = "Accueil"; // la séquence au premier plan impose son onglet
        sq[1](t, couche);
      });
      carton(t, contenu);
      M.fenetre(ef, ONGLET_COURANT);
    }
    avantage(t);
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
