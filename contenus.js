/*
 * contenus.js : textes de la démo (Quoi de neuf, Documentation, pages légales).
 * Les nouveautés reprennent la présentation « Up'Pina, les nouveautés » ; chacune renvoie vers son écran.
 */
(function () {
  "use strict";
  var OBJECTIFS = [
    { cle: "piloter", titre: "Piloter", couleur: "#3b6fd8", texte: "Savoir où l'on en est, au bon niveau de détail." },
    { cle: "anticiper", titre: "Anticiper", couleur: "#d98a1e", texte: "Préparer les prochains services plutôt que les subir." },
    { cle: "temps", titre: "Gagner du temps", couleur: "#1f9d55", texte: "Supprimer les ressaisies et les tableurs annexes." },
    { cle: "modules", titre: "Nouveaux modules", couleur: "#7b4fd6", texte: "Des outils absents du back-office d'origine, prêts à l'emploi." }
  ];
  var NOUVEAUTES = [
    { n: "01", obj: "piloter", titre: "Les chiffres de la caisse", resume: "Up'Pina peut lire les chiffres de la caisse grâce à l'API officielle, en lecture seule. Cette démonstration tourne sur des données simulées (Crêperie Démo, Rennes).",
      apports: ["Catalogue, commandes et clôtures de caisse récupérés tels quels, sans ressaisie.", "Aucun risque pour la caisse : l'accès se fait en lecture seule."],
      etapes: ["Ouvrir un rapport : les chiffres viennent de la caisse (ici, simulés)."], lien: "/reports/dashboard", libelle: "Voir le tableau de bord" },
    { n: "02", obj: "piloter", titre: "Un accueil qui résume le service", resume: "Dès l'ouverture, l'essentiel de la journée (ou de la veille) en un regard, avec de quoi juger si c'est un bon jour.",
      apports: ["4 tuiles : CA TTC, CA HT, couverts et couvert moyen, avec l'écart par rapport au même jour de la semaine précédente.", "La tendance : une mini-courbe des 14 derniers jours sous chaque chiffre.",
        "En direct : les derniers encaissements, l'objectif du mois, les alertes de stock et les réservations du jour.", "Midi / soir, météo du jour et des 7 prochains jours, meilleures ventes."],
      etapes: ["Ouvrir Up'Pina : l'accueil s'affiche directement.", "Basculer entre Hier et Aujourd'hui.", "Cliquer sur un bloc pour ouvrir l'écran détaillé."], lien: "/", libelle: "Voir l'accueil" },
    { n: "03", obj: "piloter", titre: "Le filtre « Jours & heures »", resume: "Isoler un moment précis de la semaine (les samedis midi, les soirs en semaine…) et comparer ce qui est comparable.",
      apports: ["Jours et horaires combinables, appliqués au tableau de bord et à tous les rapports calculés depuis les commandes.", "Des moyennes parlantes : CA, couverts et commandes « par samedi », avec une alerte si l'échantillon est trop petit.",
        "Le filtre suit la navigation et se retire en un clic.", "Comparaison à la période précédente ou à la même période l'an dernier."],
      etapes: ["Rapports › Tableau de bord (ou un rapport de ventes).", "Bouton Jours & heures : cocher les jours, choisir la plage horaire.", "Lire la deuxième rangée de chiffres : les moyennes par jour retenu."],
      lien: "/reports/dashboard?jours=6&de=11:00&a=15:00", libelle: "Essayer : les samedis midi" },
    { n: "04", obj: "piloter", titre: "Des objectifs suivis au jour le jour", resume: "Fixer un cap de chiffre d'affaires ou de couverts, et savoir chaque matin si l'on est en avance ou en retard.",
      apports: ["Plusieurs objectifs nommés (mois, saison, année), en CA HT ou TTC et/ou en couverts.", "Une barre de progression avec le repère « attendu à ce jour » et l'écart en euros ou en couverts.",
        "La projection en fin de période et le reste à faire par jour.", "Un bilan automatique : « Atteint » ou « Non atteint » une fois la période terminée."],
      etapes: ["Rapports › Objectifs › Nouvel objectif.", "Donner un nom, les dates et le montant visé.", "Revenir sur la page : tout se recalcule avec les ventes du jour."], lien: "/reports/objectifs", libelle: "Voir les objectifs" },
    { n: "05", obj: "anticiper", titre: "La météo, reliée aux ventes", resume: "En restauration, le temps qu'il fait pèse sur la fréquentation. Up'Pina le mesure et s'en sert pour éclairer les jours à venir.",
      apports: ["Un score de clémence 0-100 par jour : température (35 %), pluie (30 %), ensoleillement (25 %), vent (10 %).", "Prévisions à 16 jours avec, pour chaque jour, le CA attendu d'après les jours comparables.",
        "Météo et ventes côte à côte sur le tableau de bord et en tête des rapports de ventes.", "Vraie météo en direct (Open-Meteo, service public gratuit) ; la ville se choisit dans le menu du compte."],
      etapes: ["Menu du compte › Météo : On (activée par défaut), puis la ville.", "Rapports › Prévisions météo pour les 16 prochains jours."], lien: "/reports/forecast", libelle: "Voir les prévisions" },
    { n: "06", obj: "anticiper", titre: "Les ventes par créneau de service", resume: "Analyser l'activité selon vos vrais services, et pas seulement heure par heure, pour ajuster équipes et mise en place.",
      apports: ["2 ou 3 créneaux nommés librement (midi, après-midi, soir…) avec leurs horaires, y compris après minuit.", "Un graphique par créneau et par catégorie dans le Taux de répartition ; les ventes hors créneau sont regroupées à part.",
        "Le total de chaque créneau dans l'historique des caisses.", "Combinable avec le filtre Jours & heures et avec l'assistant."],
      etapes: ["Point de vente › Réglages › Créneaux de service : régler les horaires.", "Rapports des ventes › Taux de répartition : lire « Ventes par créneau de service »."], lien: "/reports/sales-report/sales-distribution", libelle: "Voir le taux de répartition" },
    { n: "07", obj: "temps", titre: "L'assistant Pop'IA : demander, c'est obtenir", resume: "Plus besoin de savoir quel rapport ouvrir : on pose sa question en français, l'assistant répond par un chiffre ou un graphique.",
      apports: ["Il comprend les périodes (« hier », « le mois dernier »), les jours, les heures, les « top 5 », un produit précis, une comparaison.", "Il répond en graphique (courbe, barres, camembert ou tableau), avec export CSV et bouton « Ouvrir le rapport ».",
        "Il enchaîne : « et le mois dernier ? », « en camembert », « seulement le soir ».", "Confidentiel : il fonctionne dans le navigateur, sans service extérieur."],
      etapes: ["Cliquer sur la bulle ronde, en bas à droite de chaque page.", "Taper une question ou choisir une suggestion ; « aide » donne la liste."], action: "assistant", libelle: "Ouvrir l'assistant" },
    { n: "08", obj: "temps", titre: "L'export comptable, sans ressaisie", resume: "Les ventes et encaissements de la période deviennent un fichier prêt à importer dans le logiciel de comptabilité.",
      apports: ["Format FEC (celui de l'administration fiscale) ou CSV standard.", "Des écritures équilibrées par clôture de caisse, par jour ou par mois : encaissements par mode de paiement, ventes HT et TVA par taux.",
        "Plan comptable restauration pré-rempli, modifiable compte par compte.", "Contrôles avant export : équilibre, comptes manquants, écarts de caisse, SIREN."],
      etapes: ["Rapports des ventes › Export comptable (ou depuis l'Historique des caisses).", "Choisir la période et vérifier les comptes proposés.", "Télécharger l'export et l'importer en comptabilité."], lien: "/reports/sales-report/accounting-export", libelle: "Voir l'export comptable" },
    { n: "09", obj: "temps", titre: "Prix d'achat et marges par produit", resume: "Savoir ce que rapporte vraiment chaque produit.",
      apports: ["Prix d'achat HT sur chaque produit : marge, taux de marque et coefficient calculés en direct.", "Colonnes de marge dans la liste et dans l'export CSV, triables pour repérer les produits les moins rentables.", "Fiche produit complète en 4 onglets : générales, tarifs, références, libellés."],
      etapes: ["Point de vente › Produits : le bouton Prix d'achat est activé.", "Trier par taux de marque, ouvrir un produit pour ajuster son prix d'achat."], lien: "/point-of-sale/products-list", libelle: "Voir les produits" },
    { n: "10", obj: "temps", titre: "Modification en lot", resume: "Mettre à jour la carte en une seule opération.",
      apports: ["Sélection multiple : case par case, Maj+clic, ou tous les produits filtrés.", "Catégorie, TVA, pôles, options, seuil de réapprovisionnement… appliqués d'un coup.", "Les modifications sont enregistrées dans Up'Pina ; la caisse n'est pas modifiée."],
      etapes: ["Point de vente › Produits : cocher des produits.", "Modifier la sélection, cocher les réglages à changer, appliquer."], lien: "/point-of-sale/products-list", libelle: "Voir les produits" },
    { n: "11", obj: "modules", titre: "Stocks et alertes de réapprovisionnement", resume: "Suivre les entrées, les inventaires et les pertes, et être prévenu avant la rupture.",
      apports: ["Trois gestes simples par produit : ajouter une livraison, saisir un inventaire, déclarer une perte.", "Le stock baisse au fil des ventes de la journée.", "Pertes justifiées : motif obligatoire (date dépassée, casse, vol, autre).",
        "Historique de chaque mouvement et cloche d'alerte quand un produit atteint son seuil."],
      etapes: ["Rapports › Stocks, puis le crayon d'une ligne.", "Fixer le seuil dans la fiche produit (ou en lot)."], lien: "/reports/stocks", libelle: "Voir les stocks" },
    { n: "12", obj: "modules", titre: "Les bons cadeaux, sans tableur", resume: "Créer, suivre et encaisser les bons cadeaux, et ne plus laisser expirer un solde sans le voir venir.",
      apports: ["Création en quelques clics : montant, fin de validité, bénéficiaire, avec un aperçu du bon.", "Vue d'ensemble : bons actifs, solde restant à consommer, bons qui expirent sous 30 jours.",
        "Échéances visibles : rouge à 7 jours, orange à 30 jours.", "Gestion complète : prolonger, débiter en plusieurs fois, annuler ; la cagnotte apparaît sur la fiche client."],
      etapes: ["Client › Bons cadeaux › Créer un bon cadeau.", "Le crayon d'une ligne pour débiter, prolonger ou annuler."], lien: "/customers/vouchers", libelle: "Voir les bons cadeaux" }
  ];
  var LEGAL = {
    cgu: { titre: "Conditions d'utilisation", blocs: [
      ["Objet", "Up'Pina est une démonstration du back-office d'un logiciel de caisse pour la restauration. Elle sert à présenter des fonctionnalités : elle n'est reliée à aucune caisse et n'enregistre aucune vente réelle."],
      ["Données affichées", "Le restaurant (Crêperie Démo, Rennes), ses ventes, ses clients, ses stocks et ses réservations sont entièrement simulés. Seule la météo est réelle (Open-Meteo). Les chiffres ne doivent pas servir à prendre des décisions."],
      ["Utilisation", "Vous pouvez naviguer, créer et modifier des éléments librement : tout reste dans votre navigateur. Le bouton « Réinitialiser la démo », dans le menu du compte, remet tout à zéro."],
      ["Disponibilité", "La démonstration est fournie telle quelle, sans garantie de disponibilité ni de continuité."]] },
    confidentialite: { titre: "Politique de confidentialité", blocs: [
      ["Aucune donnée collectée", "Up'Pina ne collecte aucune donnée personnelle : pas de compte, pas de traceur, pas de mesure d'audience."],
      ["Stockage dans votre navigateur", "Vos réglages et les éléments que vous créez (stocks, objectifs, produits, clients, réservations…) sont gardés dans le stockage local de votre navigateur, sur votre appareil uniquement. « Réinitialiser la démo » les efface."],
      ["Météo", "Pour afficher la météo, la page interroge Open-Meteo avec les coordonnées de la ville choisie. Aucune autre information n'est transmise."],
      ["Contact", "Pour toute question sur cette démonstration, adressez-vous à la personne qui vous a transmis le lien."]] },
    mentions: { titre: "Mentions légales", blocs: [
      ["Éditeur", "Démonstration Up'Pina, réalisée à des fins de présentation interne. Le restaurant « Crêperie Démo » et toutes les personnes citées sont fictifs ; toute ressemblance serait fortuite."],
      ["Hébergement", "Site statique hébergé par GitHub Pages (GitHub, Inc.)."],
      ["Données météo", "Données météorologiques : Open-Meteo.com, sous licence CC BY 4.0."],
      ["Propriété", "Les marques et logos éventuellement cités appartiennent à leurs propriétaires respectifs."]] }
  };
  window.Contenus = { objectifs: OBJECTIFS, nouveautes: NOUVEAUTES, legal: LEGAL };
})();
