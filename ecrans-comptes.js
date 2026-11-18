/*
 * ecrans-comptes.js : Mon compte (profil, authentification, notifications, utilisateurs, rôles, sites),
 * pages légales et page de connexion. Tout fonctionne en démonstration : rien n'est envoyé, tout reste dans le navigateur.
 */
(function () {
  "use strict";
  var A = App, E = A.echapper, D = DonneesTest;

  function carteReglage(titre, corps, pied) {
    return '<div class="carte grande-carte"><div class="carte-tete"><h2>' + titre + '</h2></div><div class="carte-corps">' + corps + "</div>" + (pied || "") + "</div>";
  }
  function piedFormulaire(modifie) {
    return '<div class="pied-formulaire"><button class="bouton large" data-act="regAnnuler"' + (modifie ? "" : " disabled") + '>Annuler</button><button class="bouton large sombre' + (modifie ? "" : " inactif") + '" data-act="regSauver"' + (modifie ? "" : " disabled") + ">Sauvegarder</button></div>";
  }
  var mail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  // ---------- Profil ----------
  A.ecran("/settings/profile", {
    section: "reglages", fil: ["Réglages", "Profil"],
    rendre: function (ctx, zone) {
      var et = ctx.etat;
      D.getProfile().then(function (p) {
        var nom = et.nom !== undefined ? et.nom : p.name, modifie = nom !== p.name;
        zone.innerHTML = carteReglage("Réglage du profil",
          '<div class="champ-ligne"><label for="pr-nom"><span class="ic-nom">' + A.icones.utilisateur + 'Nom et prénom</span></label><div class="champ"><input class="champ-saisie" id="pr-nom" value="' + E(nom) + '"></div></div><hr>' +
          '<div class="ligne-action"><div><b>Changer l\'adresse e-mail liée au Back Office</b><div class="doux petit">Connecté avec : ' + E(p.email) + '</div><b class="espace-h">Changer de mot de passe</b><div class="doux petit">Dernière modification il y a 3 mois</div></div>' +
          '<div class="colonne"><button class="bouton" data-act="prMail">Changer l\'adresse</button><button class="bouton" data-act="prMdp">Modifier le mot de passe</button></div></div><hr>',
          piedFormulaire(modifie));
        var champNom = document.getElementById("pr-nom");
        champNom.oninput = function () { et.nom = champNom.value; var b = zone.querySelectorAll(".pied-formulaire button"); var m = champNom.value !== p.name; b.forEach(function (x) { x.disabled = !m; x.classList.toggle("inactif", !m); }); };
        A.act.regAnnuler = function () { et.nom = undefined; ctx.rafraichir(); };
        A.act.regSauver = function () {
          D.setProfile({ name: champNom.value }).then(function (n) { et.nom = undefined; A.profil = n; A.construireMenuCompte(); A.info("Profil enregistré."); ctx.rafraichir(); }, function (m) { A.info(String(m)); });
        };
        A.act.prMail = function () {
          A.tiroirFormulaire("Changer l'adresse e-mail", "Un lien de confirmation est envoyé à la nouvelle adresse (simulé).",
            A.champ("pr-mail", "Nouvelle adresse e-mail", "", { type: "email", ph: "vous@exemple.fr" }) + A.champ("pr-mdp1", "Mot de passe actuel", "", { type: "password" }), "Changer l'adresse",
            function (v) {
              if (!mail.test(v("pr-mail"))) return Promise.reject("Adresse e-mail invalide.");
              if (!v("pr-mdp1")) return Promise.reject("Saisissez votre mot de passe actuel.");
              return D.setProfile({ email: v("pr-mail") }).then(function (n) { A.profil = n; A.construireMenuCompte(); A.fermerTiroir(); A.info("Adresse modifiée : " + n.email + "."); ctx.rafraichir(); });
            });
        };
        A.act.prMdp = function () {
          A.tiroirFormulaire("Modifier le mot de passe", "8 caractères minimum, dont un chiffre.",
            A.champ("mdp-a", "Mot de passe actuel", "", { type: "password" }) + A.champ("mdp-n", "Nouveau mot de passe", "", { type: "password" }) + A.champ("mdp-c", "Confirmer le nouveau mot de passe", "", { type: "password" }),
            "Modifier le mot de passe", function (v) {
              if (!v("mdp-a")) return Promise.reject("Saisissez votre mot de passe actuel.");
              if (v("mdp-n").length < 8 || !/\d/.test(v("mdp-n"))) return Promise.reject("Le nouveau mot de passe doit faire 8 caractères minimum, dont un chiffre.");
              if (v("mdp-n") !== v("mdp-c")) return Promise.reject("Les deux mots de passe ne correspondent pas.");
              A.fermerTiroir(); A.info("Mot de passe modifié.");
              return Promise.resolve();
            });
        };
      });
    }
  });

  // ---------- Méthodes d'authentification ----------
  A.ecran("/settings/auth-methods", {
    section: "reglages", fil: ["Réglages", "Méthodes d'authentification"],
    rendre: function (ctx, zone) {
      D.getLinkedAccounts().then(function (c) {
        function bloc(cle, nom, lettre) {
          var lie = !!c[cle];
          return '<div class="bloc-lie"><b>' + nom + '</b><div class="doux petit">Liez votre compte ' + nom + ' au Back Office pour pouvoir vous connecter avec.</div><div class="ligne-lien"><span class="rond-logo">' + lettre + "</span>" +
            (lie ? "Compte " + nom + " lié · " + E(A.profil ? A.profil.email : "") : "Se connecter avec " + nom) + '<span class="td-espace"></span>' +
            (lie ? '<span class="badge-bon ok">Lié</span><button class="bouton" data-act="lier" data-val="' + cle + '">Délier</button>' : '<button class="bouton sombre" data-act="lier" data-val="' + cle + '">Lier le compte</button>') + "</div></div>";
        }
        A.act.lier = function (cle) {
          var nom = cle === "google" ? "Google" : "Apple";
          D.setLinkedAccount(cle, !c[cle]).then(function (n) { A.info(n[cle] ? "Compte " + nom + " lié." : "Compte " + nom + " délié."); ctx.rafraichir(); });
        };
        zone.innerHTML = carteReglage("Gestion des comptes liés", bloc("google", "Google", "G") + bloc("apple", "Apple", "A"));
      });
    }
  });

  // ---------- Notifications ----------
  A.ecran("/settings/notifications", {
    section: "reglages", fil: ["Réglages", "Notifications"],
    rendre: function (ctx, zone) {
      var et = ctx.etat;
      D.getNotifications().then(function (n) {
        var v = et.v || (et.v = { rapports: n.rapports, alertesStock: n.alertesStock, hebdo: n.hebdo });
        var modifie = Object.keys(v).some(function (k) { return v[k] !== n[k]; });
        function inter(cle, titre, desc) {
          return '<div class="reglage"><div><b>' + titre + '</b><div class="doux petit">' + desc + '</div></div><button class="interrupteur' + (v[cle] ? " on" : "") + '" data-act="bascule" data-val="' + cle + '" aria-label="' + titre + '"><i></i></button></div>';
        }
        A.act.bascule = function (cle) { v[cle] = !v[cle]; ctx.rafraichir(); };
        A.act.regAnnuler = function () { et.v = null; ctx.rafraichir(); };
        A.act.regSauver = function () { D.setNotifications(v).then(function () { et.v = null; A.info("Préférences de notification enregistrées."); ctx.rafraichir(); }); };
        zone.innerHTML = carteReglage("Gestion des notifications",
          inter("rapports", "Recevoir les rapports", "Recevoir chaque jour le rapport de caisse par e-mail") +
          inter("alertesStock", "Alertes de stock", "Être prévenu par e-mail quand un produit atteint son seuil de réapprovisionnement") +
          inter("hebdo", "Synthèse de la semaine", "Recevoir chaque lundi le bilan de la semaine (CA, couverts, objectifs)"), piedFormulaire(modifie));
      });
    }
  });

  // ---------- Utilisateurs ----------
  var NIVEAUX = ["OWNER", "COMPTABLE", "RESPONSABLE DE SALLE"];
  A.ecran("/settings/users", {
    section: "reglages", fil: ["Réglages", "Gestion des utilisateurs"], actions: function () { return A.bouton("Inviter un utilisateur", "inviter", { classe: "sombre" }); },
    rendre: function (ctx, zone) {
      Promise.all([D.getOrganizationUsers(), D.getRoles()]).then(function (r) {
        var l = r[0], roles = r[1].map(function (x) { return x.name; });
        A.act.inviter = function () {
          A.tiroirFormulaire("Inviter un utilisateur", "Une invitation est envoyée par e-mail (simulée).",
            A.champ("inv-mail", "Adresse e-mail", "", { type: "email", ph: "prenom@exemple.fr" }) +
            '<label>Rôle<select id="inv-role">' + roles.map(function (x) { return '<option value="' + E(x) + '">' + E(x) + "</option>"; }).join("") + "</select></label>", "Envoyer l'invitation",
            function (v) { return D.inviteUser({ email: v("inv-mail"), role: v("inv-role") }).then(function (u) { A.fermerTiroir(); A.info("Invitation envoyée à " + u.email + "."); ctx.rafraichir(); }); });
        };
        A.act.renvoyer = function (email) { A.info("Invitation renvoyée à " + email + "."); };
        zone.innerHTML = l.map(function (u) {
          return '<div class="ligne-carte utilisateur"><span class="avatar-u">' + (u.invite ? "" : A.icones.utilisateur) + "</span><span>" + E(u.name) + (u.invite ? ' <span class="doux petit">· invitation envoyée</span>' : "") + '</span><span class="puce">' + A.icones.pin + " " + u.sites + ' Site</span><span class="td-espace"></span>' +
            (u.invite ? '<button class="bouton sombre" data-act="renvoyer" data-val="' + E(u.email) + '">Renvoyer l\'invitation</button>' : "<span>" + E(u.role) + "</span>") + '<span class="niveau">' + E(u.level) + "</span></div>";
        }).join("");
      });
    }
  });

  // ---------- Rôles ----------
  var PERMISSIONS = ["Rapports", "Export comptable", "Commandes", "Réservations", "Fiches clients", "Bons cadeaux", "Stocks", "Point de vente (catalogue)", "Réglages de caisse", "Utilisateurs"];
  A.ecran("/settings/roles", {
    section: "reglages", fil: ["Réglages", "Gestion des rôles"], actions: function () { return A.bouton("Créer un rôle", "creerRole", { classe: "sombre" }); },
    rendre: function (ctx, zone) {
      D.getRoles().then(function (l) {
        A.act.creerRole = function () {
          A.tiroirFormulaire("Créer un rôle", "Choisissez ce que les personnes de ce rôle peuvent voir et faire.",
            A.champ("role-nom", "Nom du rôle", "", { ph: "ex. SERVEUR" }) + '<div class="cases">' + PERMISSIONS.map(function (p, i) { return '<label class="case"><input type="checkbox" id="perm-' + i + '"> ' + E(p) + "</label>"; }).join("") + "</div>",
            "Créer le rôle", function (v) {
              var perms = PERMISSIONS.filter(function (p, i) { return v("perm-" + i); });
              if (!perms.length) return Promise.reject("Cochez au moins une permission.");
              return D.createRole({ name: v("role-nom"), permissions: perms }).then(function (r) { A.fermerTiroir(); A.info("Rôle " + r.name + " créé."); ctx.rafraichir(); });
            });
        };
        A.act.voirRole = function (id) {
          var r = l.filter(function (x) { return x.id === id; })[0];
          A.tiroir('<div class="tiroir-tete"><div><h3>' + E(r.name) + '</h3><span class="doux">' + r.userCount + " utilisateur" + (r.userCount > 1 ? "s" : "") + '</span></div><button class="fermer" data-act="fermer-tiroir">✕</button></div>' +
            '<div class="tiroir-corps"><h4 class="stk-titre">Permissions</h4><ul class="liste-points">' + r.permissions.map(function (p) { return "<li>" + E(p) + "</li>"; }).join("") + "</ul></div>");
        };
        zone.innerHTML = l.map(function (r) {
          return '<button class="ligne-carte cliquable-l" data-act="voirRole" data-val="' + E(r.id) + '"><b>' + E(r.name) + "</b>" + (r.userCount ? ' <span class="puce">' + A.icones.personnes + " " + r.userCount + " utilisateur" + (r.userCount > 1 ? "s" : "") + "</span>" : "") +
            '<span class="td-espace"></span><span class="doux petit">' + E(r.permissions.slice(0, 3).join(", ") + (r.permissions.length > 3 ? "…" : "")) + "</span></button>";
        }).join("");
      });
    }
  });

  // ---------- Sites ----------
  A.ecran("/settings/sites", {
    section: "reglages", fil: ["Réglages", "Gestion des sites"],
    rendre: function (ctx, zone) {
      D.getLocations().then(function (l) {
        zone.innerHTML = carteReglage("Liste des sites", l.map(function (s) {
          return '<div class="site-ligne"><span class="badge-site">' + E(s.sigle) + "</span><div><b>" + E(s.name) + '</b><div class="doux petit">Adresse : ' + E(s.address + ", " + s.zip + " " + s.city + ", " + s.country) + '</div><div class="doux petit">7 caisses · ouvert 7j/7 de 8h à 23h</div></div></div>';
        }).join(""));
      });
    }
  });

  // ---------- Pages légales ----------
  A.ecran("/legal/:page", {
    section: null, fil: function (ctx) { var p = window.Contenus.legal[ctx.ids.page]; return [p ? p.titre : "Informations légales"]; },
    rendre: function (ctx, zone) {
      var p = window.Contenus.legal[ctx.ids.page];
      if (!p) { zone.innerHTML = A.vide("Page introuvable"); return; }
      zone.innerHTML = '<article class="carte article legal"><h1>' + E(p.titre) + '</h1><p class="doux petit">Dernière mise à jour : novembre 2026</p>' +
        p.blocs.map(function (b) { return "<h2>" + E(b[0]) + "</h2><p>" + E(b[1]) + "</p>"; }).join("") + "</article>";
    }
  });

  // ---------- Connexion (après « Se déconnecter ») ----------
  A.ecran("/connexion", {
    section: null, plein: true, bandeau: false,
    rendre: function (ctx, zone) {
      var email = A.profil ? A.profil.email : "demo@exemple.test";
      zone.innerHTML = '<div class="connexion"><div class="connexion-carte"><div class="connexion-logo">' + document.querySelector(".logo-icone").outerHTML + "<span>Up'Pina</span></div>" +
        '<h1>Connexion au back-office</h1><p class="doux">Démonstration : n\'importe quel mot de passe fonctionne.</p>' +
        '<div class="stk-form"><label>Adresse e-mail<input type="email" id="cx-mail" value="' + E(email) + '" autocomplete="username"></label>' +
        '<label>Mot de passe<input type="password" id="cx-mdp" autocomplete="current-password" placeholder="••••••••"></label><div class="stk-erreur" id="cx-err"></div></div>' +
        '<button class="bouton sombre large-100" id="cx-ok">Se connecter</button><button class="lien-bouton" id="cx-oubli">Mot de passe oublié ?</button>' +
        '<div class="connexion-ou"><span>ou</span></div><button class="bouton large-100" id="cx-google"><span class="rond-logo">G</span>Se connecter avec Google</button></div></div>';
      function entrer() {
        var m = document.getElementById("cx-mail").value.trim(), p = document.getElementById("cx-mdp").value;
        if (!mail.test(m)) { document.getElementById("cx-err").textContent = "Adresse e-mail invalide."; return; }
        if (!p) { document.getElementById("cx-err").textContent = "Saisissez votre mot de passe."; return; }
        window.Stockage.retirer("deconnecte");
        location.hash = "/";
        setTimeout(function () { A.info("Bienvenue sur Up'Pina !"); }, 300);
      }
      document.getElementById("cx-ok").onclick = entrer;
      document.getElementById("cx-mdp").onkeydown = function (e) { if (e.key === "Enter") entrer(); };
      document.getElementById("cx-mail").onkeydown = function (e) { if (e.key === "Enter") entrer(); };
      document.getElementById("cx-google").onclick = function () { window.Stockage.retirer("deconnecte"); location.hash = "/"; };
      document.getElementById("cx-oubli").onclick = function () {
        var m = document.getElementById("cx-mail").value.trim();
        if (!mail.test(m)) { document.getElementById("cx-err").textContent = "Saisissez d'abord votre adresse e-mail."; return; }
        A.info("Un lien de réinitialisation a été envoyé à " + m + ".");
      };
      document.getElementById("cx-mdp").focus();
    }
  });
})();
