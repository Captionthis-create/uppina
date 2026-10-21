/*
 * ecrans-compta.js : export comptable construit à partir des clôtures de caisse (Z).
 * Écran /reports/sales-report/accounting-export. Le paramétrage (comptes, journal, format) est gardé dans le navigateur
 * (localStorage, clé « compta-copie ») ; les données viennent de DonneesTest (getNewHistoryZTill, getReportById).
 * Principe : une écriture équilibrée par caisse / jour / mois = débit des modes de paiement, crédit des ventes HT
 * et de la TVA collectée par taux ; l'écart éventuel (arrondis, écart de caisse) va sur un compte dédié.
 */
(function () {
  "use strict";
  var A = App, E = A.echapper, D = DonneesTest;
  var CLE = "compta-copie";

  // ---------- Paramétrage par défaut (plan comptable général, restauration) ----------
  var VENTES_DEFAUT = {
    "0": { cv: "707000", lv: "Ventes exonérées de TVA", ct: "", lt: "" },
    "5.5": { cv: "707055", lv: "Ventes à 5,5 %", ct: "445713", lt: "TVA collectée 5,5 %" },
    "10": { cv: "706100", lv: "Ventes restauration 10 %", ct: "445711", lt: "TVA collectée 10 %" },
    "20": { cv: "707200", lv: "Ventes à 20 %", ct: "445712", lt: "TVA collectée 20 %" }
  };
  var DEFAUT = {
    format: "fec", regroupement: "z", journalCode: "VT", journalLib: "Journal des ventes", siren: "",
    ecartPlus: { c: "758000", l: "Écarts de caisse (produit)" }, ecartMoins: { c: "658000", l: "Écarts de caisse (charge)" },
    attente: { c: "471000", l: "Compte d'attente" }
  };
  var FORMATS = [["fec", "FEC"], ["csv", "CSV standard"]];
  var REGROUPEMENTS = [["z", "Par caisse (Z)"], ["jour", "Par jour"], ["mois", "Par mois"]];

  // Compte proposé pour un mode de paiement, d'après son nom
  function devinerPaiement(nom) {
    var n = nom.toLowerCase();
    if (/esp[eè]ces?|cash/.test(n)) return { c: "530000", l: "Caisse espèces" };
    if (/ch[eè]que.*vacances|ancv/.test(n)) return { c: "511400", l: "Chèques vacances à encaisser" };
    if (/ch[eè]que/.test(n)) return { c: "511200", l: "Chèques à encaisser" };
    if (/titre|restaurant|ticket|swile|edenred|up |pluxee/.test(n)) return { c: "511300", l: "Titres restaurant à encaisser" };
    if (/carte|cb|visa|mastercard|card|bancaire/.test(n)) return { c: "511500", l: "Cartes bancaires à encaisser" };
    if (/virement/.test(n)) return { c: "512000", l: "Banque" };
    if (/compte client|cr[eé]dit|ardoise|client/.test(n)) return { c: "411000", l: "Clients" };
    if (/cagnotte|bon|cadeau|avoir/.test(n)) return { c: "419100", l: "Bons cadeaux et avoirs" };
    return null;
  }

  function fus(base, sur) { var o = {}, k; for (k in base) o[k] = base[k]; for (k in (sur || {})) if (sur[k] !== undefined) o[k] = sur[k]; return o; }
  function lireBrut() { try { var c = JSON.parse(localStorage.getItem(CLE) || "null"); return c && typeof c === "object" ? c : {}; } catch (e) { return {}; } }
  function sauver(c) { try { localStorage.setItem(CLE, JSON.stringify(c)); return true; } catch (e) { A.info("Stockage du navigateur indisponible."); return false; } }
  function lireConfig() {
    var b = lireBrut(), c = fus(DEFAUT, b);
    c.ecartPlus = fus(DEFAUT.ecartPlus, b.ecartPlus); c.ecartMoins = fus(DEFAUT.ecartMoins, b.ecartMoins); c.attente = fus(DEFAUT.attente, b.attente);
    c.ventes = b.ventes || {}; c.paiements = b.paiements || {};
    return c;
  }
  function reglVente(cfg, taux) {
    var d = VENTES_DEFAUT[taux] || { cv: "707000", lv: "Ventes TVA " + taux.replace(".", ",") + " %", ct: "44571", lt: "TVA collectée " + taux.replace(".", ",") + " %" };
    return fus(d, cfg.ventes[taux]);
  }
  function reglPaiement(cfg, nom) {
    var g = devinerPaiement(nom), d = g || { c: cfg.attente.c, l: cfg.attente.l };
    var r = fus(d, cfg.paiements[nom]); r.connu = !!(g || (cfg.paiements[nom] && cfg.paiements[nom].c)); return r;
  }
  function poser(c, chemin, valeur) {
    var o = c;
    for (var i = 0; i < chemin.length - 1; i++) { o[chemin[i]] = o[chemin[i]] || {}; o = o[chemin[i]]; }
    o[chemin[chemin.length - 1]] = valeur;
  }

  // ---------- Construction des écritures (montants en centimes) ----------
  function cents(x) { return Math.round(x * 100); }
  function libTaux(s) { return s.replace(".", ",") + " %"; }
  function pieceDe(mode, g) { return mode === "z" ? "Z" + g.numeros[0] : mode === "jour" ? "J" + g.date.replace(/-/g, "") : "M" + g.date.slice(0, 7).replace("-", ""); }

  function construire(cfg, rapports) {
    var tri = rapports.slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.reportNumber - b.reportNumber; });
    var groupes = {}, ordre = [], parTaux = {}, parMode = {};
    tri.forEach(function (r) {
      var k = cfg.regroupement === "z" ? r.id : cfg.regroupement === "jour" ? r.date : r.date.slice(0, 7), g = groupes[k];
      if (!g) { g = groupes[k] = { date: r.date, numeros: [], taux: {}, pay: {} }; ordre.push(g); }
      g.date = r.date; g.numeros.push(r.reportNumber);
      r.taxSummary.forEach(function (t) {
        var s = String(t.taxRate), x = g.taux[s] = g.taux[s] || { ht: 0, tva: 0 }, y = parTaux[s] = parTaux[s] || { ht: 0, tva: 0 };
        x.ht += cents(t.taxableAmount); x.tva += cents(t.taxAmount); y.ht += cents(t.taxableAmount); y.tva += cents(t.taxAmount);
      });
      r.paymentSummary.forEach(function (p) { g.pay[p.name] = (g.pay[p.name] || 0) + cents(p.totalAmount); parMode[p.name] = (parMode[p.name] || 0) + cents(p.totalAmount); });
    });

    var lignes = [], ecarts = [], totD = 0, totC = 0, n = 0;
    ordre.forEach(function (g) {
      n++;
      var piece = pieceDe(cfg.regroupement, g), pref = piece + (cfg.regroupement === "mois" ? "" : " " + A.dateCourte(g.date)) + " - ", ls = [];
      // montant > 0 dans le sens normal (« d » ou « c »), sinon dans le sens inverse
      function ajoute(compte, libCompte, detail, mont, normal) {
        if (!mont) return;
        var d = 0, c = 0;
        if ((normal === "d") === (mont > 0)) d = Math.abs(mont); else c = Math.abs(mont);
        ls.push({ n: n, date: g.date, piece: piece, compte: compte, lib: libCompte, ecr: pref + detail, d: d, c: c });
      }
      Object.keys(g.pay).sort().forEach(function (nom) { var rg = reglPaiement(cfg, nom); ajoute(rg.c, rg.l, "Encaissement " + nom, g.pay[nom], "d"); });
      Object.keys(g.taux).sort(function (a, b) { return parseFloat(a) - parseFloat(b); }).forEach(function (s) {
        var rg = reglVente(cfg, s), x = g.taux[s];
        ajoute(rg.cv, rg.lv, "Ventes TVA " + libTaux(s), x.ht, "c");
        ajoute(rg.ct, rg.lt, "TVA collectée " + libTaux(s), x.tva, "c");
      });
      var d = 0, c = 0; ls.forEach(function (l) { d += l.d; c += l.c; });
      var ec = d - c;
      if (ec) {
        var cp = ec > 0 ? cfg.ecartPlus : cfg.ecartMoins;
        ajoute(cp.c, cp.l, "Écart de caisse / arrondi", ec, "c");
        ecarts.push({ date: g.date, piece: piece, cents: ec });
      }
      ls.forEach(function (l) { totD += l.d; totC += l.c; lignes.push(l); });
    });
    return { lignes: lignes, ecritures: n, totalD: totD, totalC: totC, parTaux: parTaux, parMode: parMode, ecarts: ecarts, nbCaisses: rapports.length };
  }

  // ---------- Fichiers ----------
  function mnt(c) { return (c / 100).toFixed(2).replace(".", ","); }
  function propre(v) { return String(v).replace(/[\t\r\n]+/g, " "); }
  function fec(cfg, res) {
    var ent = ["JournalCode", "JournalLib", "EcritureNum", "EcritureDate", "CompteNum", "CompteLib", "CompAuxNum", "CompAuxLib", "PieceRef", "PieceDate", "EcritureLib", "Debit", "Credit", "EcritureLet", "DateLet", "ValidDate", "Montantdevise", "Idevise"];
    var rows = res.lignes.map(function (l) {
      var d = l.date.replace(/-/g, "");
      return [cfg.journalCode, cfg.journalLib, l.n, d, l.compte, l.lib, "", "", l.piece, d, l.ecr, mnt(l.d), mnt(l.c), "", "", d, "", ""].map(propre).join("\t");
    });
    return [ent.join("\t")].concat(rows).join("\r\n") + "\r\n";
  }
  function telechargerTexte(nom, texte) {
    var blob = new Blob([texte], { type: "text/plain;charset=utf-8" }), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = nom; a.click(); URL.revokeObjectURL(a.href);
  }
  function exporter(cfg, res, periode) {
    if (cfg.format === "fec") {
      var siren = /^\d{9}$/.test(cfg.siren) ? cfg.siren : "000000000";
      telechargerTexte(siren + "FEC" + periode.dateEnd.replace(/-/g, "") + ".txt", fec(cfg, res));
    } else {
      A.telechargerCsv("export-comptable-" + periode.dateStart + "_" + periode.dateEnd + ".csv", ["Date", "Journal", "Pièce", "Compte", "Libellé du compte", "Libellé de l'écriture", "Débit", "Crédit"],
        res.lignes.map(function (l) { return [A.dateCourte(l.date), cfg.journalCode, l.piece, l.compte, l.lib, l.ecr, A.montantCsv(l.d / 100), A.montantCsv(l.c / 100)]; }));
    }
  }

  // ---------- Contrôles avant export ----------
  function controles(cfg, res) {
    var l = [], comptes = {}, mauvais = [];
    res.lignes.forEach(function (x) { comptes[x.compte] = 1; });
    Object.keys(comptes).forEach(function (c) { if (!/^\d{3,}$/.test(c)) mauvais.push(c || "(vide)"); });
    if (!res.lignes.length) return [["ko", "Aucune écriture à produire sur la période."]];
    l.push(["ok", "Chaque écriture est équilibrée (total débit = total crédit : " + A.euro(res.totalD / 100) + ")."]);
    if (mauvais.length) l.push(["ko", "Comptes invalides (3 chiffres minimum, uniquement des chiffres) : " + mauvais.map(E).join(", ") + "."]);
    if (!cfg.journalCode.trim()) l.push(["ko", "Le code journal est vide."]);
    var inconnus = Object.keys(res.parMode).filter(function (n) { return !reglPaiement(cfg, n).connu; });
    if (inconnus.length) l.push(["attention", "Mode(s) de paiement sans compte paramétré, ventilé(s) sur le compte d'attente " + E(cfg.attente.c) + " : " + inconnus.map(E).join(", ") + "."]);
    var gros = res.ecarts.filter(function (e) { return Math.abs(e.cents) >= 100; }), somme = 0;
    res.ecarts.forEach(function (e) { somme += e.cents; });
    if (gros.length) l.push(["attention", gros.length + " écriture(s) avec un écart supérieur à 1 € entre encaissements et ventes (" + gros.slice(0, 4).map(function (e) { return E(e.piece) + " : " + A.euro(e.cents / 100); }).join(", ") + (gros.length > 4 ? "…" : "") + "). À expliquer avant d'envoyer au comptable."]);
    else if (res.ecarts.length) l.push(["ok", "Écarts d'arrondi sur " + res.ecarts.length + " écriture(s), total " + A.euro(somme / 100) + " (compte " + E(cfg.ecartPlus.c) + " / " + E(cfg.ecartMoins.c) + ")."]);
    else l.push(["ok", "Encaissements = ventes TTC sur toutes les écritures."]);
    if (cfg.format === "fec" && !/^\d{9}$/.test(cfg.siren)) l.push(["attention", "SIREN absent ou invalide (9 chiffres) : le fichier FEC sera nommé 000000000FEC… ; renommez-le avant remise à l'administration."]);
    return l;
  }

  // ---------- Écran ----------
  function champ(chemin, val, cls) { return '<input class="cpt-in ' + (cls || "") + '" data-k="' + E(chemin) + '" value="' + E(val) + '" autocomplete="off">'; }
  var LIB_NIVEAU = { ok: "✓", attention: "!", ko: "✕" };

  A.ecran("/reports/sales-report/accounting-export", {
    section: "rapports", fil: ["Rapports", "Export comptable"], filtres: ["periode", "sites"],
    actions: function () { return A.bouton("Télécharger l'export", "comptaExport", { classe: "sombre" }); },
    rendre: function (ctx, zone) {
      var et = ctx.etat, clePeriode = ctx.periode.dateStart + "|" + ctx.periode.dateEnd;
      function charger() {
        if (et.cle === clePeriode && et.rapports) return Promise.resolve(et.rapports);
        return D.getNewHistoryZTill(ctx.periode).then(function (l) {
          return Promise.all(l.map(function (z) { return D.getReportById(z.id); }));
        }).then(function (rs) { et.cle = clePeriode; et.rapports = rs.filter(Boolean); return et.rapports; });
      }
      charger().then(function (rs) {
        if (!rs.length) { A.act.comptaExport = function () { A.info("Aucune caisse clôturée sur la période."); }; zone.innerHTML = A.vide("Aucune caisse clôturée sur la période"); return; }
        var cfg = lireConfig(), res = construire(cfg, rs);
        var taux = Object.keys(res.parTaux).sort(function (a, b) { return parseFloat(a) - parseFloat(b); });
        var modes = Object.keys(res.parMode).sort();

        var segFormat = A.segment("comptaFormat", FORMATS, cfg.format, function (v) { var c = lireBrut(); c.format = v; sauver(c); ctx.rafraichir(); });
        var segRegroup = A.segment("comptaRegroup", REGROUPEMENTS, cfg.regroupement, function (v) { var c = lireBrut(); c.regroupement = v; sauver(c); ctx.rafraichir(); });
        A.act.comptaReset = function () { if (window.confirm("Rétablir le paramétrage comptable par défaut ?")) { try { localStorage.removeItem(CLE); } catch (e) { /* ignoré */ } ctx.rafraichir(); } };

        var general = '<div class="cpt-grille">' +
          '<div><div class="cpt-lib">Format du fichier</div>' + segFormat + '<p class="doux cpt-aide">' + (cfg.format === "fec" ? "Fichier des écritures comptables (18 colonnes, séparateur tabulation) : celui que demande l'administration fiscale et que tous les logiciels comptables importent." : "CSV « ; » avec Date, Journal, Pièce, Compte, Libellés, Débit, Crédit : à importer dans Excel ou à faire correspondre aux colonnes de l'import du logiciel du comptable.") + "</p></div>" +
          '<div><div class="cpt-lib">Une écriture</div>' + segRegroup + '<p class="doux cpt-aide">Une écriture = un total équilibré (encaissements = ventes HT + TVA). « Par mois » donne un journal très court, « par caisse » garde la trace de chaque Z.</p></div>' +
          '<label>Code du journal' + champ("journalCode", cfg.journalCode) + "</label><label>Libellé du journal" + champ("journalLib", cfg.journalLib) + "</label>" +
          "<label>SIREN (9 chiffres, nom du fichier FEC)" + champ("siren", cfg.siren) + '</label><div></div></div>';

        var tVentes = A.table([{ t: "Taux" }, { t: "Compte de vente" }, { t: "Libellé" }, { t: "Compte de TVA" }, { t: "Libellé" }, { a: "d", t: "Base HT" }, { a: "d", t: "TVA" }],
          taux.map(function (s) {
            var r = reglVente(cfg, s), p = "ventes|" + s + "|";
            return ["<b>" + libTaux(s) + "</b>", champ(p + "cv", r.cv, "cpt-compte"), champ(p + "lv", r.lv), champ(p + "ct", r.ct, "cpt-compte"), champ(p + "lt", r.lt), A.euro(res.parTaux[s].ht / 100), A.euro(res.parTaux[s].tva / 100)];
          }), null, { classe: "cpt-table" });
        var tPaie = A.table([{ t: "Mode de paiement" }, { t: "Compte" }, { t: "Libellé du compte" }, { a: "d", t: "Encaissé" }],
          modes.map(function (nom) {
            var r = reglPaiement(cfg, nom), p = "paiements|" + nom + "|";
            return [E(nom) + (r.connu ? "" : ' <span class="badge-bon attention">à paramétrer</span>'), champ(p + "c", r.c, "cpt-compte"), champ(p + "l", r.l), A.euro(res.parMode[nom] / 100)];
          }), null, { classe: "cpt-table" });
        var tEcart = A.table([{ t: "Cas" }, { t: "Compte" }, { t: "Libellé du compte" }],
          [["Encaissements supérieurs aux ventes (écart, arrondi)", champ("ecartPlus|c", cfg.ecartPlus.c, "cpt-compte"), champ("ecartPlus|l", cfg.ecartPlus.l)],
            ["Encaissements inférieurs aux ventes", champ("ecartMoins|c", cfg.ecartMoins.c, "cpt-compte"), champ("ecartMoins|l", cfg.ecartMoins.l)],
            ["Mode de paiement sans compte (attente)", champ("attente|c", cfg.attente.c, "cpt-compte"), champ("attente|l", cfg.attente.l)]], null, { classe: "cpt-table" });

        zone.innerHTML = '<div id="cpt-kpis"></div>' +
          A.carte("Paramétrage", general, { droite: A.bouton("Rétablir par défaut", "comptaReset") }) +
          A.carte("Ventes et TVA collectée par taux", tVentes, { classe: "avec-tableau" }) +
          A.carte("Encaissements par mode de paiement", tPaie, { classe: "avec-tableau" }) +
          A.carte("Écarts et compte d'attente", tEcart, { classe: "avec-tableau" }) +
          '<div id="cpt-ctrl"></div><div id="cpt-apercu"></div>' +
          '<p class="doux cpt-note">Les ventes sont comptabilisées à la clôture de caisse, sur les commandes payées (annulations exclues). Les pourboires et la TVA sur encaissements / sur les débits ne sont pas traités à part : le plan de comptes et la méthode sont à valider avec votre expert-comptable.</p>';

        function maj() {
          var c = lireConfig(), r = construire(c, rs), ctrl = controles(c, r);
          A.act.comptaExport = function () {
            if (ctrl.some(function (x) { return x[0] === "ko"; })) { A.info("Corrigez d'abord les erreurs signalées dans « Contrôles »."); return; }
            exporter(c, r, ctx.periode); A.info("Export généré (" + r.lignes.length + " lignes).");
          };
          document.getElementById("cpt-kpis").innerHTML = A.kpis([["Caisses retenues", A.entier(r.nbCaisses)], ["Écritures", A.entier(r.ecritures)], ["Total débit", A.euro(r.totalD / 100)], ["Total crédit", A.euro(r.totalC / 100)]]);
          document.getElementById("cpt-ctrl").innerHTML = A.carte("Contrôles", '<ul class="cpt-ctrl">' + ctrl.map(function (x) { return '<li class="' + x[0] + '"><b>' + LIB_NIVEAU[x[0]] + "</b> " + x[1] + "</li>"; }).join("") + "</ul>");
          var MAX = 300;
          document.getElementById("cpt-apercu").innerHTML = A.carte("Aperçu des écritures",
            A.table([{ t: "Date" }, { t: "Pièce" }, { t: "Compte" }, { t: "Libellé du compte" }, { t: "Libellé" }, { a: "d", t: "Débit" }, { a: "d", t: "Crédit" }],
              r.lignes.slice(0, MAX).map(function (l) { return [A.dateCourte(l.date), E(l.piece), '<span class="mono">' + E(l.compte) + "</span>", E(l.lib), E(l.ecr), l.d ? A.euro(l.d / 100) : "", l.c ? A.euro(l.c / 100) : ""]; }),
              ["<b>Total</b>", "", "", "", "", "<b>" + A.euro(r.totalD / 100) + "</b>", "<b>" + A.euro(r.totalC / 100) + "</b>"], { classe: "zebre cpt-table" }) +
            (r.lignes.length > MAX ? '<p class="doux cpt-note">' + MAX + " premières lignes affichées sur " + r.lignes.length + " : le fichier téléchargé contient tout.</p>" : ""), { classe: "avec-tableau" });
        }
        zone.onchange = function (e) {
          var k = e.target.getAttribute && e.target.getAttribute("data-k");
          if (!k) return;
          var c = lireBrut(); poser(c, k.split("|"), e.target.value.trim()); sauver(c);
          // un changement de compte peut changer le nombre de lignes à afficher : on repart du paramétrage complet
          maj();
        };
        maj();
      });
    }
  });

  A.compta = { lireConfig: lireConfig, construire: construire, fec: fec, controles: controles };
})();
