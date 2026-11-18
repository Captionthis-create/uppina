/*
 * ecrans-meteo.js : météo (activée par défaut ; ville et On/Off dans le menu du compte).
 * Composants (App.meteo) utilisés par le Tableau de bord et les rapports de ventes, et écran « Prévisions météo ».
 * Les données viennent de DonneesTest (getWeatherDays, getWeatherForecast, getWeatherImpact).
 */
(function () {
  "use strict";
  var A = App, E = A.echapper, D = DonneesTest, M = A.meteo = {};

  // Codes météo WMO -> [libellé, pictogramme]
  function infoCode(c) {
    if (c == null) return ["Inconnu", "·"];
    if (c === 0) return ["Dégagé", "☀️"];
    if (c <= 2) return ["Peu nuageux", "⛅"];
    if (c === 3) return ["Couvert", "☁️"];
    if (c === 45 || c === 48) return ["Brouillard", "🌫️"];
    if (c >= 51 && c <= 57) return ["Bruine", "🌦️"];
    if (c >= 61 && c <= 67) return ["Pluie", "🌧️"];
    if ((c >= 71 && c <= 77) || c === 85 || c === 86) return ["Neige", "❄️"];
    if (c >= 80 && c <= 82) return ["Averses", "🌦️"];
    if (c >= 95) return ["Orage", "⛈️"];
    return ["Variable", "⛅"];
  }
  M.libelle = function (c) { return infoCode(c)[0]; };
  M.icone = function (c) { return infoCode(c)[1]; };
  M.classeScore = function (s) { return s == null ? "score-nd" : (s >= 70 ? "score-bon" : (s >= 40 ? "score-moyen" : "score-mauvais")); };
  M.pastille = function (s) { return '<span class="score ' + M.classeScore(s) + '" title="Score de clémence météo (0-100)">' + (s == null ? "–" : s) + "</span>"; };

  function dateCourte(iso) { return new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }); }
  function moy(liste, cle) {
    var s = 0, n = 0;
    liste.forEach(function (j) { if (j[cle] != null) { s += j[cle]; n++; } });
    return n ? s / n : null;
  }
  function somme(liste, cle) {
    var s = 0, n = 0;
    liste.forEach(function (j) { if (j[cle] != null) { s += j[cle]; n++; } });
    return n ? s : null;
  }
  function un(v) { return v == null ? "–" : String(Math.round(v * 10) / 10).replace(".", ","); }
  // Résumé d'une période : moyennes (score, température max, soleil, vent), total de pluie
  M.resume = function (jours) {
    return {
      n: jours.length, score: moy(jours, "score"), tmax: moy(jours, "tmax"), soleil: moy(jours, "soleil"), vent: moy(jours, "vent"),
      pluie: somme(jours, "pluie"), joursPluie: jours.filter(function (j) { return j.pluie != null && j.pluie >= 1; }).length,
      factice: jours.some(function (j) { return j.factice; }), connu: jours.some(function (j) { return j.tmax != null; })
    };
  };
  // Écart avec la période comparée. meilleurSiHaut : true (score, soleil), false (pluie, vent), null (neutre)
  function delta(a, b, unite, meilleurSiHaut, entier) {
    if (a == null || b == null) return "";
    var d = a - b, txt = (d > 0 ? "+" : "") + (entier ? Math.round(d) : un(d)).toString().replace("-", "−") + " " + unite;
    var cl = meilleurSiHaut == null || Math.abs(d) < 0.05 ? "" : ((d > 0) === meilleurSiHaut ? "delta-bon" : "delta-mauvais");
    return ' <span class="' + cl + '">' + txt + "</span>";
  }
  function kpiMeteo(libelle, valeur, sous) {
    return '<div class="kpi"><div class="kpi-l">' + libelle + '</div><div class="kpi-v">' + valeur + '</div><div class="meteo-kpi-sous">' + (sous || "&nbsp;") + "</div></div>";
  }
  function messageAbsent() {
    return A.vide("Météo momentanément indisponible. Réessayez dans quelques instants.");
  }
  function ville() { return window.MeteoDemo ? MeteoDemo.ville().nom : "Rennes"; }

  // Carte du Tableau de bord : score et chiffres de la période, comparés à l'autre période, avec courbe du score par jour.
  // jours / joursComp : tableaux de getWeatherDays ; nomComp : libellé de la période comparée (ou null)
  M.carte = function (periode, jours, joursComp, nomComp) {
    var r = M.resume(jours);
    if (!r.connu) return A.carte("Météo", messageAbsent());
    var c = joursComp ? M.resume(joursComp) : null;
    if (c && !c.connu) c = null;
    var kpis = '<div class="kpis" style="--n:4">' +
      kpiMeteo("Score météo", M.pastille(r.score == null ? null : Math.round(r.score)), c ? "vs " + E(nomComp) + " : " + (c.score == null ? "–" : Math.round(c.score)) + delta(r.score, c.score, "pts", true, true) : "Clémence 0-100") +
      kpiMeteo("Température max moyenne", un(r.tmax) + " °C", c ? "vs " + un(c.tmax) + " °C" + delta(r.tmax, c.tmax, "°C", null) : "") +
      kpiMeteo("Pluie", r.pluie == null ? "–" : un(r.pluie) + " mm", (r.joursPluie + " jour" + (r.joursPluie > 1 ? "s" : "") + " de pluie") + (c ? " · vs " + c.joursPluie + delta(r.pluie, c.pluie, "mm", false) : "")) +
      kpiMeteo("Ensoleillement", un(r.soleil) + " h/jour", c ? "vs " + un(c.soleil) + " h" + delta(r.soleil, c.soleil, "h", true) : "") + "</div>";
    var labels = jours.map(function (j) { return +j.date.slice(8); });
    var series = [{ nom: A.libellePeriode(periode), couleur: "#d99a1e", valeurs: jours.map(function (j) { return j.score; }) }];
    if (c) series.push({ nom: nomComp, couleur: "#999", tirets: true, valeurs: joursComp.slice(0, jours.length).map(function (j) { return j.score; }) });
    var graphe = A.graph.courbe({ labels: labels, series: series, hauteur: 220 });
    var legende = '<div class="legende"><span><i class="trait" style="background:#d99a1e"></i>Score météo · ' + E(A.libellePeriode(periode)) + "</span>" +
      (c ? '<span><i class="trait" style="background:#999"></i>' + E(nomComp) + "</span>" : "") + "</div>";
    return A.carte("Météo · " + E(ville()) + ' <span class="badge-nouveau">Nouveau</span>', kpis + graphe + legende);
  };

  // Grille de jours à venir (bandeau du Tableau de bord, écran Prévisions). impact : résultat de getWeatherImpact (facultatif)
  M.grille = function (jours, impact) {
    return '<div class="meteo-grille">' + jours.map(function (j) {
      var ca = "";
      if (impact && j.score != null) {
        var est = D.estimationMeteo(impact, j.date, j.score);
        if (est) ca = '<div class="mj-ca" title="CA attendu : moyenne des mêmes jours de la semaine (8 dernières semaines), corrigée par la clémence de la météo">≈ ' + A.euro(est).replace(/,00\s/, " ") + "</div>";
      }
      if (j.tmax == null) return '<div class="meteo-jour"><div class="mj-date">' + E(dateCourte(j.date)) + '</div><div class="mj-ico">·</div><div class="mj-det">Non disponible</div></div>';
      return '<div class="meteo-jour"><div class="mj-date">' + E(dateCourte(j.date)) + '</div><div class="mj-ico" title="' + E(M.libelle(j.code)) + '">' + M.icone(j.code) + "</div>" +
        '<div class="mj-temp">' + Math.round(j.tmax) + "° / " + Math.round(j.tmin) + "°</div>" +
        '<div class="mj-det">' + (j.pluie ? un(j.pluie) + " mm" : "Sec") + " · " + Math.round(j.vent) + " km/h</div>" +
        '<div style="margin-top:6px">' + M.pastille(j.score) + "</div>" + ca + "</div>";
    }).join("") + "</div>";
  };

  // Bandeau 7 jours du Tableau de bord
  M.carteBandeau = function () {
    return Promise.all([D.getWeatherForecast(7), D.getWeatherImpact()]).then(function (res) {
      if (!M.resume(res[0].jours).connu) return "";
      return A.carte("Météo des 7 prochains jours · " + E(ville()), M.grille(res[0].jours, res[1]), { droite: '<a class="bouton" href="#/reports/forecast">Prévisions</a>' });
    });
  };

  // Bande météo en tête des rapports de ventes (période affichée)
  App.meteoBandeau = function (ctx, el) {
    var p = { dateStart: ctx.periode.dateStart, dateEnd: ctx.periode.dateEnd };
    D.getWeatherDays(p).then(function (res) {
      var r = M.resume(res.jours);
      if (!r.connu) { el.innerHTML = ""; return; }
      el.innerHTML = A.carte("", '<div class="meteo-ligne"><span>☀️ <b>Météo de la période · ' + E(ville()) + "</b></span><span>Score " + M.pastille(r.score == null ? null : Math.round(r.score)) +
        "</span><span>Température max <b>" + un(r.tmax) + " °C</b></span><span>Pluie <b>" + (r.pluie == null ? "–" : un(r.pluie) + " mm") + "</b> (" + r.joursPluie + " j)</span><span>Soleil <b>" + un(r.soleil) + " h/j</b></span>" +
        "</div>", { classe: "meteo-bandeau" });
    });
  };

  // ---------- Écran Prévisions météo ----------
  A.ecran("/reports/forecast", {
    section: "rapports", fil: ["Prévisions météo"],
    rendre: function (ctx, zone) {
      if (!A.meteoActif()) {
        A.act.activerMeteo = function () { MeteoDemo.activer(true); A.construireMenuCompte(); A.info("Météo activée."); ctx.rafraichir(); };
        zone.innerHTML = A.carte("", A.vide("La météo est désactivée.") + '<p class="centre"><button class="bouton sombre" data-act="activerMeteo">Activer la météo</button></p>');
        return;
      }
      Promise.all([D.getWeatherForecast(16), D.getWeatherImpact()]).then(function (res) {
        var jours = res[0].jours, impact = res[1];
        if (!M.resume(jours).connu) { zone.innerHTML = A.carte("", messageAbsent()); return; }
        var sept = jours.slice(0, 7), r = M.resume(sept), meilleur = null, pire = null;
        sept.forEach(function (j) {
          if (j.score == null) return;
          if (!meilleur || j.score > meilleur.score) meilleur = j;
          if (!pire || j.score < pire.score) pire = j;
        });
        var kpis = A.kpis([
          ["Score moyen (7 jours)", M.pastille(r.score == null ? null : Math.round(r.score))],
          ["Meilleur jour", meilleur ? E(dateCourte(meilleur.date)) + " " + M.pastille(meilleur.score) : "–"],
          ["Jour le moins clément", pire ? E(dateCourte(pire.date)) + " " + M.pastille(pire.score) : "–"],
          ["Pluie prévue (7 jours)", r.pluie == null ? "–" : un(r.pluie) + " mm"]
        ]);
        var heure = res[0].recupereLe ? new Date(res[0].recupereLe).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : null;
        var note = '<p class="doux">Score de clémence 0-100 : température (35 %), pluie (30 %), ensoleillement (25 %), vent (10 %). Le montant « ≈ » est le CA attendu : moyenne des mêmes jours de la semaine, corrigée par la météo (indicatif).' +
          " Prévisions Open-Meteo pour " + E(res[0].ville) + (heure ? ", mises à jour à " + heure : "") + '. <a class="lien-souligne" data-act="changerVille">Changer de ville</a></p>';
        A.act.changerVille = function () { document.getElementById("menu-compte").classList.add("ouvert"); if (A.actGlobal.ville) A.actGlobal.ville(); };
        zone.innerHTML = kpis + A.carte("Les 16 prochains jours · " + E(res[0].ville) + ' <span class="badge-nouveau">Nouveau</span>', M.grille(jours, impact)) + note;
      });
    }
  });
})();
