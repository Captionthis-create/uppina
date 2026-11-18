/*
 * direct.js : la démo « vit » pendant qu'on la regarde.
 * - À chaque arrivée sur l'accueil ou un rapport : 1 à 3 nouveaux encaissements (si au moins 20 s depuis le dernier).
 * - Ensuite, toutes les 30 à 60 s : les encaissements arrivés entre-temps (ceux de la journée simulée, sinon un
 *   encaissement de démo), avec une notification. L'accueil et « Caisses en cours » se mettent à jour sous les yeux.
 * Uniquement pendant les heures d'ouverture (8h - 23h). Les encaissements de démo sont propres à ce navigateur.
 */
(function () {
  "use strict";
  var A = App, D = DonneesTest, E = A.echapper;
  var DELAI_ARRIVEE = 20000;
  var dernierMin = D.maintenantMin(), dernierSeq = Date.now(), derniereArrivee = 0, minuteur = null, jour = D.AUJOURDHUI;

  function ouvert() { var m = D.maintenantMin(); return m >= D.HEURE_OUVERTURE && m < D.HEURE_FERMETURE; }
  function routeVivante(chemin) { return chemin === "/" || chemin === "/reports/tills-in-progress"; }
  function routeArrivee(chemin) { return chemin === "/" || chemin.indexOf("/reports/") === 0; }

  // Notification d'encaissement (en bas à gauche, cliquable)
  var pile = null;
  function notifier(liste) {
    if (!liste.length || document.body.classList.contains("page-pleine")) return;
    if (!pile) { pile = document.createElement("div"); pile.className = "pile-encaissements"; document.body.appendChild(pile); }
    var c = liste[liste.length - 1], n = liste.length, total = 0;
    liste.forEach(function (x) { total += x.total; });
    var lieu = c.salle === "À emporter" ? (c.enLigne ? "À emporter (en ligne)" : "À emporter") : c.salle + " · " + c.table;
    var el = document.createElement("a");
    el.className = "notif-encaissement";
    el.href = "#/orders";
    el.innerHTML = '<span class="notif-point"></span><span><b>' + (n > 1 ? n + " nouveaux encaissements" : "Nouvel encaissement") + "</b>" +
      '<span class="notif-detail">' + E(lieu) + " · " + A.euro(n > 1 ? total : c.total) + (n > 1 ? "" : " · " + E(c.paiement)) + "</span></span>";
    pile.appendChild(el);
    setTimeout(function () { el.classList.add("visible"); }, 20);
    setTimeout(function () { el.classList.remove("visible"); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 400); }, 5200);
    while (pile.children.length > 3) pile.removeChild(pile.firstChild);
  }

  function chemin() { return (location.hash.replace(/^#/, "") || "/").split("?")[0]; }
  function marquer() { dernierMin = D.maintenantMin(); dernierSeq = Date.now(); }

  // Arrivée sur l'accueil ou un rapport : de nouveaux encaissements avant d'afficher l'écran
  A.avantAffichage.push(function (ch, ctx, opts) {
    if (opts.doux || !ouvert() || !routeArrivee(ch)) return;
    // Dès la première visite, puis à chaque retour (au plus une fois toutes les 20 s)
    if (Date.now() - Math.max(D.dernierEncaissementDemo(), derniereArrivee) < DELAI_ARRIVEE) return;
    derniereArrivee = Date.now();
    var base = D.encaissementsDepuis(dernierMin, dernierSeq);
    var demo = D.ajouterEncaissementsDemo(1 + Math.floor(Math.random() * 3));
    marquer();
    var tous = base.concat(demo);
    if (tous.length) {
      ctx.etat.nouveaux = tous.map(function (c) { return c.id; });
      setTimeout(function () { notifier(tous); }, 600);
    }
  });

  function tick() {
    minuteur = setTimeout(tick, 30000 + Math.floor(Math.random() * 30000));
    if (D.AUJOURDHUI !== jour || A.jourIso(new Date()) !== jour) { location.reload(); return; } // minuit passé : nouvelle journée
    if (document.hidden || !ouvert() || document.body.classList.contains("page-pleine")) return;
    var nouveaux = D.encaissementsDepuis(dernierMin, dernierSeq);
    if (!nouveaux.length) nouveaux = D.ajouterEncaissementsDemo(1);
    marquer();
    if (!nouveaux.length) return;
    notifier(nouveaux);
    var ch = chemin();
    if (routeVivante(ch)) {
      if (A.ctxCourant) A.ctxCourant.etat.nouveaux = nouveaux.map(function (c) { return c.id; });
      A.rafraichirDoux();
    } else A.majAlertes();
  }
  minuteur = setTimeout(tick, 25000 + Math.floor(Math.random() * 15000));
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && A.jourIso(new Date()) !== jour) location.reload();
  });
})();
