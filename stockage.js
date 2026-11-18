/*
 * stockage.js : tout ce que la démo garde dans le navigateur (localStorage), sous le préfixe « uppina: ».
 * Une nouvelle version de la démo efface une fois les anciens réglages, pour que chacun reparte des valeurs par défaut.
 * « Réinitialiser la démo » efface tout sauf le thème.
 */
(function () {
  "use strict";
  var VERSION = "2";
  var PREFIXE = "uppina:";
  var GARDES = ["theme"]; // conservés par « Réinitialiser la démo »
  var ANCIENNES = ["donnees-copie", "meteo-copie", "objectifs-liste", "objectifs-copie", "stock-factice", "creneaux-copie",
    "produits-copie", "bons-factices", "compta-copie"];
  var memoire = {}; // secours quand le navigateur refuse le stockage (navigation privée stricte)
  var dispo = (function () {
    try { localStorage.setItem(PREFIXE + "test", "1"); localStorage.removeItem(PREFIXE + "test"); return true; } catch (e) { return false; }
  })();

  function cles() {
    var l = [];
    if (!dispo) return Object.keys(memoire);
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf(PREFIXE) === 0) l.push(k.slice(PREFIXE.length)); } } catch (e) { /* ignoré */ }
    return l;
  }
  function lire(cle, defaut) {
    try {
      var brut = dispo ? localStorage.getItem(PREFIXE + cle) : memoire[cle];
      if (brut === null || brut === undefined) return defaut;
      return JSON.parse(brut);
    } catch (e) { return defaut; }
  }
  function ecrire(cle, valeur) {
    var brut = JSON.stringify(valeur);
    memoire[cle] = brut;
    if (!dispo) return true;
    try { localStorage.setItem(PREFIXE + cle, brut); return true; } catch (e) { return false; }
  }
  function retirer(cle) {
    delete memoire[cle];
    if (dispo) try { localStorage.removeItem(PREFIXE + cle); } catch (e) { /* ignoré */ }
  }
  function toutEffacer() {
    cles().forEach(function (k) { if (GARDES.indexOf(k) < 0 && k !== "version") retirer(k); });
  }

  // Migration : ancienne version (ou première visite) -> on repart des réglages par défaut
  if (lire("version", null) !== VERSION) {
    var theme = null;
    try { theme = dispo ? localStorage.getItem("theme-copie") : null; } catch (e) { /* ignoré */ }
    ANCIENNES.concat(["theme-copie"]).forEach(function (k) { try { if (dispo) localStorage.removeItem(k); } catch (e) { /* ignoré */ } });
    toutEffacer();
    if (theme && lire("theme", null) === null) ecrire("theme", theme);
    ecrire("version", VERSION);
  }

  window.Stockage = { lire: lire, ecrire: ecrire, retirer: retirer, toutEffacer: toutEffacer, disponible: dispo };
})();
