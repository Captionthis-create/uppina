/*
 * ecrans-pdv.js : écrans de la section « Point de vente » (catalogue et réglages de la caisse).
 * Les boutons de création/modification affichent « non disponible » : la copie est en lecture seule.
 */
(function () {
  "use strict";
  var A = App, E = A.echapper, D = DonneesTest;
  var PDV = "/point-of-sale/";

  function fil(nom, reglage) { return reglage ? ["Réglages", nom] : ["Point-of-sale", nom]; }
  function creer(libelle) { A.act.creer = A.nonDispo; return A.bouton(libelle, "creer", { classe: "sombre" }); }
  function exportCsv() { return A.bouton("Exporter CSV", "export", { classe: "bouton-export", chevron: true }); }
  function rgba(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return "rgba(" + (n >> 16) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }
  function grille(items, colonnes) { return '<div class="grille-cartes" style="--n:' + (colonnes || 3) + '">' + items.join("") + "</div>"; }
  function badge(actif) { return '<span class="badge-actif ' + (actif ? "on" : "off") + '"><i></i>' + (actif ? "Actif" : "Inactif") + "</span>"; }
  function onOff(v) { return v ? '<span class="on">On</span>' : '<span class="off">Off</span>'; }

  // ---------- Produits ----------
  var CHEMIN_PRODUITS = PDV + "products-list";
  function pct(n) { return n === null || n === undefined ? "-" : String(Math.round(n * 10) / 10).replace(".", ",") + " %"; }
  // Texte du résumé de marge (formulaire et liste)
  function texteMarge(m) {
    if (!m) return "Saisir un prix d'achat pour calculer la marge.";
    return "Marge " + A.euro(m.marge) + " HT · taux de marque " + pct(m.taux) + (m.coef ? " · coefficient " + String(Math.round(m.coef * 100) / 100).replace(".", ",") : "");
  }

  A.ecran(CHEMIN_PRODUITS, {
    section: "pdv", fil: fil("Products-list"), filtres: [],
    actions: function () { A.act.creer = function () { A.allerA(CHEMIN_PRODUITS + "/create"); }; return exportCsv() + A.bouton("Ajouter un produit", "creer", { classe: "sombre" }); },
    rendre: function (ctx, zone) {
      var et = ctx.etat;
      Promise.all([D.getCatalogue(), D.getGestionAchat(), D.getAllModifierGroups()]).then(function (r) {
        var c = r[0], achat = r[1];
        c.groupes = r[2].map(function (g) { return g.nom; });
        A.act["achat-bascule"] = function () { D.setGestionAchat(!achat).then(function () { ctx.rafraichir(); }); };
        var lignes = c.produits.filter(function (p) {
          return (!et.cat || p.categorie === et.cat) && (!et.sous || p.sousCategorie === et.sous) && (!et.pole || p.poles.indexOf(et.pole) >= 0) && (!et.tva || ("TVA " + p.tva) === et.tva);
        });
        // Sélection multiple : on ne garde que les produits encore affichés après un changement de filtre
        var sel = et.sel = et.sel || {}, visibles = {};
        lignes.forEach(function (p) { visibles[p.id] = p; });
        Object.keys(sel).forEach(function (k) { if (!visibles[k]) delete sel[k]; });
        A.act.lot = function () {
          var ids = Object.keys(sel);
          if (ids.length) tiroirLot(c, ids, visibles, function () { ctx.rafraichir(); });
        };
        A.act.export = function () {
          A.telechargerCsv("produits.csv", ["Nom", "Catégorie", "Sous-catégorie", "Prix", "TVA"].concat(achat ? ["Prix d'achat HT", "Marge HT", "Taux de marque"] : []), lignes.map(function (p) {
            var m = D.calculMarge(p.prix, p.tva, p.achat);
            return [p.nom, p.categorie, p.sousCategorie, A.montantCsv(p.prix), p.tva].concat(achat ? [p.achat === null ? "" : A.montantCsv(p.achat), m ? A.montantCsv(m.marge) : "", m ? pct(m.taux) : ""] : []);
          }));
        };
        var sous = [];
        c.categories.forEach(function (x) { if (!et.cat || x.nom === et.cat) x.sous.forEach(function (s) { sous.push([s, s]); }); });
        var filtres =
          A.liste("pf-cat", "Catégorie", c.categories.map(function (x) { return [x.nom, x.nom]; }), et.cat, function (v) { et.cat = v; et.sous = ""; ctx.rafraichir(); }) +
          A.liste("pf-sous", "Sous-catégorie", sous, et.sous, function (v) { et.sous = v; ctx.rafraichir(); }) +
          A.liste("pf-pole", "Pôles de préparation", c.poles.map(function (x) { return [x, x]; }), et.pole, function (v) { et.pole = v; ctx.rafraichir(); }) +
          A.liste("pf-tva", "TVA", [["TVA 5.5", "TVA 5,5%"], ["TVA 10", "TVA 10%"], ["TVA 20", "TVA 20%"]], et.tva, function (v) { et.tva = v; ctx.rafraichir(); });
        zone.innerHTML = A.carte("Tous les articles", '<div id="td"></div>', { classe: "avec-tableau" });
        A.monterTable(document.getElementById("td"), {
          colonnes: [{ t: "Nom", k: "nom" },
            { t: "Catégorie", f: function (p) { return '<span class="ic-nom"><i class="carre" style="background:' + p.couleur + '"></i>' + E(p.categorie) + "</span>"; }, tri: function (p) { return p.categorie; } },
            { t: "Sous-catégorie", f: function (p) { return '<span class="ic-nom"><i class="carre" style="background:' + p.couleur + '"></i>' + E(p.sousCategorie) + "</span>"; }, tri: function (p) { return p.sousCategorie; } },
            { t: "Pôles de préparation", f: function (p) { return p.poles.map(function (x) { return '<span class="puce">' + E(x) + "</span>"; }).join(" "); } },
            { t: "Prix", a: "d", f: function (p) { return A.euro(p.prix); }, tri: function (p) { return p.prix; } },
            { t: "TVA", f: function (p) { return "TVA " + String(p.tva).replace(".", ",") + "% (" + A.decimal(p.tva).replace(".", ",") + " %)"; } },
            { t: "Type de Prix", a: "d", f: function (p) { return p.nbPrix + " Prix"; } }]
            .concat(!achat ? [] : [
              { t: "Prix d'achat HT", a: "d", f: function (p) { return p.achat === null ? '<span class="doux">-</span>' : A.euro(p.achat); }, tri: function (p) { return p.achat === null ? -1 : p.achat; } },
              { t: "Marge HT", a: "d", f: function (p) { var m = D.calculMarge(p.prix, p.tva, p.achat); return m ? '<span class="' + (m.marge < 0 ? "marge-neg" : "marge-pos") + '">' + A.euro(m.marge) + "</span>" : "-"; },
                tri: function (p) { var m = D.calculMarge(p.prix, p.tva, p.achat); return m ? m.marge : -1e9; } },
              { t: "Taux de marque", a: "d", f: function (p) { var m = D.calculMarge(p.prix, p.tva, p.achat); return m ? pct(m.taux) : "-"; },
                tri: function (p) { var m = D.calculMarge(p.prix, p.tva, p.achat); return m && m.taux !== null ? m.taux : -1e9; } }]),
          lignes: lignes, rech: { ph: "Rechercher un article", texte: function (p) { return p.nom; } }, filtres: filtres, pageSize: 20,
          selection: { sel: sel, id: function (p) { return p.id; }, actions: '<button class="bouton sombre" data-act="lot">Modifier la sélection</button>' },
          onLigne: function (p) { A.allerA(CHEMIN_PRODUITS + "/edit/" + encodeURIComponent(p.id)); },
          droite: '<button class="bouton bascule' + (achat ? " actif" : "") + '" data-act="achat-bascule" title="Active la saisie du prix d\'achat et le calcul de marge"><i class="interrupteur"></i> Prix d\'achat</button>'
        });
      });
    }
  });

  // ---------- Modification en lot (produits cochés dans la liste) ----------
  // Chaque réglage a une case « Modifier » : seuls les réglages cochés sont appliqués à tous les produits choisis.
  function tiroirLot(cat, ids, produits, apres) {
    var o = { cat: false, sous: false, poles: false, niveau: false, options: false, typePrix: false, tva: false, seuil: false };
    var v = { cat: "", sous: "", poles: [], modePoles: "remplacer", niveau: "Aucun", options: [], modeOptions: "remplacer", typePrix: "unitaire", tva: 10, seuil: "" };
    var erreur = "";
    var t = A.tiroir("");
    function aff(cle) { return o[cle] ? "" : " masque"; }
    function bloc(cle, titre, contenu) {
      return '<div class="lot-bloc"><label class="lot-tete"><input type="checkbox" data-lot="' + cle + '"' + (o[cle] ? " checked" : "") + "> " + titre + '</label><div class="lot-champ' + aff(cle) + '">' + contenu + "</div></div>";
    }
    function puces(liste, choisis, cle) {
      return '<div class="pf-puces">' + liste.map(function (x) {
        return '<button type="button" class="pf-puce' + (choisis.indexOf(x) >= 0 ? " actif" : "") + '" data-puce="' + cle + '" data-val="' + E(x) + '">' + E(x) + "</button>";
      }).join("") + "</div>";
    }
    function modes(cle, courant) {
      return '<div class="segment">' + [["remplacer", "Remplacer"], ["ajouter", "Ajouter"], ["retirer", "Retirer"]].map(function (m) {
        return '<button type="button" class="' + (m[0] === courant ? "actif" : "") + '" data-mode="' + cle + '" data-val="' + m[0] + '">' + m[1] + "</button>";
      }).join("") + "</div>";
    }
    function opt(liste, valeur) {
      return liste.map(function (x) { return '<option value="' + E(x[0]) + '"' + (String(x[0]) === String(valeur) ? " selected" : "") + ">" + E(x[1]) + "</option>"; }).join("");
    }
    function sousListe() { var c = cat.categories.filter(function (x) { return x.nom === v.cat; })[0]; return c ? c.sous : []; }
    function nbModifs() { return Object.keys(o).filter(function (k) { return o[k]; }).length; }
    function dessiner() {
      var noms = ids.slice(0, 4).map(function (i) { return produits[i].nom; });
      var groupes = {};
      ids.forEach(function (i) { (groupes[produits[i].categorie] = groupes[produits[i].categorie] || []).push(i); });
      t.innerHTML = '<div class="tiroir-tete"><div><h3>Modifier ' + ids.length + (ids.length > 1 ? " produits" : " produit") + '</h3><div class="doux">' + E(noms.join(", ")) + (ids.length > 4 ? "…" : "") +
        '</div></div><button class="fermer" data-act="fermer-tiroir">✕</button></div><div class="tiroir-corps">' +
        '<p class="doux">Cochez les réglages à changer : ils seront appliqués à tous les produits sélectionnés. Les autres restent inchangés.</p>' +
        bloc("cat", "Catégorie", '<select class="pf-in" data-k="cat"><option value="">Sélectionnez une catégorie</option>' + opt(cat.categories.map(function (x) { return [x.nom, x.nom]; }), v.cat) + "</select>") +
        bloc("sous", "Sous-catégorie", '<select class="pf-in" data-k="sous"><option value="">Aucune</option>' + opt(sousListe().map(function (x) { return [x, x]; }), v.sous) + "</select>" +
          (o.cat ? "" : '<span class="doux pf-aide">Doit exister dans la catégorie de chaque produit.</span>')) +
        bloc("poles", "Pôles de préparation", modes("modePoles", v.modePoles) + puces(cat.poles, v.poles, "poles")) +
        bloc("niveau", "Niveau de suite", '<div class="pf-puces">' + NIVEAUX.map(function (n) { return '<button type="button" class="pf-puce' + (n === v.niveau ? " actif" : "") + '" data-niveau="' + n + '">' + n + "</button>"; }).join("") + "</div>") +
        bloc("options", "Options", modes("modeOptions", v.modeOptions) + puces(cat.groupes, v.options, "options")) +
        bloc("typePrix", "Type de prix", '<div class="segment">' + TYPES_PRIX.map(function (x) { return '<button type="button" class="' + (x[0] === v.typePrix ? "actif" : "") + '" data-typeprix="' + x[0] + '">' + x[1] + "</button>"; }).join("") + "</div>") +
        bloc("tva", "TVA", '<select class="pf-in pf-tva" data-k="tva">' + opt(TAUX_TVA.map(function (x) { return [x, "TVA " + String(x).replace(".", ",") + "%"]; }), v.tva) + "</select>") +
        bloc("seuil", "Seuil de réapprovisionnement", '<div class="pf-prix"><input class="pf-in" data-k="seuil" inputmode="decimal" placeholder="Aucun" value="' + E(v.seuil) + '"><span class="pf-unite">unités</span></div>') +
        '<div class="pf-erreur" id="lot-erreur">' + E(erreur) + "</div></div>" +
        '<div class="tiroir-pied"><button type="button" class="bouton" data-act="fermer-tiroir">Annuler</button><button type="button" class="bouton sombre" data-appliquer' + (nbModifs() ? "" : " disabled") + ">Appliquer à " + ids.length + (ids.length > 1 ? " produits" : " produit") + "</button></div>";
    }
    function basculer(liste, x) { var i = liste.indexOf(x); if (i >= 0) liste.splice(i, 1); else liste.push(x); }
    function nombre(s) { var n = parseFloat(String(s).replace(",", ".")); return String(s).trim() === "" || !isFinite(n) ? null : n; }
    t.addEventListener("change", function (e) {
      var l = e.target.getAttribute("data-lot");
      if (l) { o[l] = e.target.checked; if (l === "cat" && !o.cat) { /* la sous-catégorie reste libre */ } dessiner(); }
      else if (e.target.getAttribute("data-k") === "cat") { v.cat = e.target.value; v.sous = ""; dessiner(); }
      else if (e.target.getAttribute("data-k") === "sous") v.sous = e.target.value;
      else if (e.target.getAttribute("data-k") === "tva") v.tva = +e.target.value;
    });
    t.addEventListener("input", function (e) { if (e.target.getAttribute("data-k") === "seuil") v.seuil = e.target.value; });
    t.addEventListener("click", function (e) {
      var b = e.target.closest("[data-puce],[data-mode],[data-niveau],[data-typeprix],[data-appliquer]");
      if (!b || b.disabled) return;
      if (b.hasAttribute("data-puce")) { basculer(v[b.getAttribute("data-puce")], b.getAttribute("data-val")); dessiner(); }
      else if (b.hasAttribute("data-mode")) { v[b.getAttribute("data-mode")] = b.getAttribute("data-val"); dessiner(); }
      else if (b.hasAttribute("data-niveau")) { v.niveau = b.getAttribute("data-niveau"); dessiner(); }
      else if (b.hasAttribute("data-typeprix")) { v.typePrix = b.getAttribute("data-typeprix"); dessiner(); }
      else {
        var lot = {};
        if (o.cat) { if (!v.cat) { erreur = "Choisir une catégorie."; dessiner(); return; } lot.categorie = v.cat; }
        if (o.sous) lot.sousCategorie = v.sous;
        if (o.poles) lot.poles = { mode: v.modePoles, valeurs: v.poles };
        if (o.niveau) lot.niveau = v.niveau;
        if (o.options) lot.options = { mode: v.modeOptions, valeurs: v.options };
        if (o.typePrix) lot.typePrix = v.typePrix;
        if (o.tva) lot.tva = v.tva;
        if (o.seuil) { lot.seuilReappro = nombre(v.seuil); }
        D.setProductsLot(ids, lot).then(function (n) { A.fermerTiroir(); A.info(n + (n > 1 ? " produits modifiés." : " produit modifié.")); apres(); },
          function (msg) { erreur = String(msg); dessiner(); });
      }
    });
    dessiner();
  }

  // ---------- Formulaire produit (création et modification) ----------
  var ONGLETS_PRODUIT = [["gen", "Générales"], ["tarifs", "Tarifs"], ["refs", "Références"], ["lib", "Libellés"]];
  var NIVEAUX = ["Aucun", "Direct", "1", "2", "3"];
  var TYPES_PRIX = [["unitaire", "Prix unitaire"], ["poids", "Prix au poids"], ["libre", "Prix libre"]];
  var TAUX_TVA = [0, 5.5, 10, 20];

  function formulaireProduit(ctx, zone, id) {
    Promise.all([D.getCatalogue(), D.getAllModifierGroups(), D.getGestionAchat(), id ? D.getProduct(id) : Promise.resolve(null)]).then(function (r) {
      var cat = r[0], groupes = r[1], achat = r[2], p = r[3];
      var f = p ? JSON.parse(JSON.stringify(p)) : { nom: "", categorie: "", sousCategorie: "", poles: [], niveau: "Aucun", options: [], typePrix: "unitaire", prix: 0, tva: 10, achat: null, codeBarre: "", sku: "", plu: "", nomBouton: "", nomPrepa: "", seuilReappro: null };
      var seuilTxt = f.seuilReappro === null || f.seuilReappro === undefined ? "" : String(f.seuilReappro).replace(".", ",");
      var onglet = ctx.etat.onglet || "gen", erreur = "";
      // Les champs numériques sont gardés en texte pour ne pas perdre la saisie en cours
      var prixTxt = p ? p.prix.toFixed(2).replace(".", ",") : "", achatTxt = p && p.achat !== null ? String(p.achat).replace(".", ",") : "";
      var achatOuvert = achatTxt !== "";
      function nombre(t) { var n = parseFloat(String(t).replace(",", ".")); return String(t).trim() === "" || !isFinite(n) ? null : n; }
      function ligne(libelle, contenu) { return '<div class="pf-ligne"><div class="pf-lib">' + libelle + '</div><div class="pf-champ">' + contenu + "</div></div>"; }
      function puces(liste, choisis, cle) {
        if (!liste.length) return '<span class="doux">Aucun élément disponible</span>';
        return '<div class="pf-puces">' + liste.map(function (x) {
          return '<button type="button" class="pf-puce' + (choisis.indexOf(x) >= 0 ? " actif" : "") + '" data-puce="' + cle + '" data-val="' + E(x) + '">' + E(x) + "</button>";
        }).join("") + "</div>";
      }
      function sousCats() {
        var c = cat.categories.filter(function (x) { return x.nom === f.categorie; })[0];
        return c ? c.sous : [];
      }
      function options(liste, valeur) {
        return liste.map(function (x) { return '<option value="' + E(x[0]) + '"' + (String(x[0]) === String(valeur) ? " selected" : "") + ">" + E(x[1]) + "</option>"; }).join("");
      }
      function blocMarge() {
        var m = D.calculMarge(nombre(prixTxt) || 0, f.tva, nombre(achatTxt));
        return '<span class="pf-marge' + (m && m.marge < 0 ? " neg" : "") + '" id="pf-marge">' + E(texteMarge(m)) + "</span>";
      }
      function contenu() {
        if (onglet === "tarifs") {
          if (!achat) return '<p class="doux">La gestion des prix d\'achat est désactivée. Activez-la avec le bouton « Prix d\'achat » de la liste des produits.</p>';
          if (!achatOuvert) return '<div><button type="button" class="bouton" data-ajout-achat>' + A.icones.plus + " Ajouter un prix d'achat</button></div>";
          return ligne("Prix d'achat", '<div class="pf-prix"><input class="pf-in" data-k="achat" inputmode="decimal" placeholder="0,00" value="' + E(achatTxt) + '"><span class="pf-unite">€ HT</span>' +
            '<button type="button" class="bouton-icone" data-retire-achat title="Retirer le prix d\'achat">✕</button></div>' + blocMarge());
        }
        if (onglet === "refs") return ligne("Code-barre",'<input class="pf-in" data-k="codeBarre" value="' + E(f.codeBarre) + '">') + ligne("SKU", '<input class="pf-in" data-k="sku" value="' + E(f.sku) + '">') + ligne("PLU", '<input class="pf-in" data-k="plu" value="' + E(f.plu) + '">');
        if (onglet === "lib") return ligne("Nom du bouton", '<input class="pf-in" data-k="nomBouton" placeholder="Insérez le nom du bouton sur la caisse" value="' + E(f.nomBouton) + '">') + ligne("Nom de préparation", '<input class="pf-in" data-k="nomPrepa" value="' + E(f.nomPrepa) + '">');
        var tvaListe = TAUX_TVA.indexOf(+f.tva) >= 0 ? TAUX_TVA : TAUX_TVA.concat([+f.tva]);
        return ligne("Nom*", '<input class="pf-in" data-k="nom" value="' + E(f.nom) + '">') +
          ligne("Catégorie*", '<select class="pf-in" data-k="categorie"><option value="">Sélectionnez une catégorie</option>' + options(cat.categories.map(function (x) { return [x.nom, x.nom]; }), f.categorie) + "</select>") +
          ligne("Sous-catégorie", '<select class="pf-in" data-k="sousCategorie"><option value="">Aucune</option>' + options(sousCats().map(function (x) { return [x, x]; }), f.sousCategorie) + "</select>") +
          ligne("Pôle", puces(cat.poles, f.poles, "poles")) +
          ligne("Niveau de suite", '<div class="pf-puces">' + NIVEAUX.map(function (n) { return '<button type="button" class="pf-puce' + (n === f.niveau ? " actif" : "") + '" data-niveau="' + n + '">' + n + "</button>"; }).join("") + "</div>") +
          ligne("Options", puces(groupes.map(function (g) { return g.nom; }), f.options, "options")) +
          ligne("Prix", '<div class="segment">' + TYPES_PRIX.map(function (t) { return '<button type="button" class="' + (t[0] === f.typePrix ? "actif" : "") + '" data-typeprix="' + t[0] + '">' + t[1] + "</button>"; }).join("") + "</div>") +
          ligne("Normal*", '<div class="pf-prix"><input class="pf-in" data-k="prix" inputmode="decimal" placeholder="0,00" value="' + E(prixTxt) + '"><span class="pf-unite">€ TTC</span><select class="pf-in pf-tva" data-k="tva">' +
            options(tvaListe.map(function (t) { return [t, "TVA " + String(t).replace(".", ",") + "%"]; }), f.tva) + "</select></div>") +
          ligne("Seuil de réapprovisionnement", '<div class="pf-prix"><input class="pf-in" data-k="seuilReappro" inputmode="decimal" placeholder="Aucun" value="' + E(seuilTxt) + '"><span class="pf-unite">unités</span></div>' +
            '<span class="doux pf-aide">Une alerte (cloche en haut à droite) apparaît quand le stock déclaré atteint ce seuil.</span>');
      }
      function dessiner() {
        zone.innerHTML = '<div class="carte pf"><h2 class="pf-titre">' + (p ? "Modifier un produit" : "Créer un produit") + "</h2>" +
          '<div class="pf-onglets">' + ONGLETS_PRODUIT.map(function (o) { return '<button type="button" class="' + (o[0] === onglet ? "actif" : "") + '" data-onglet="' + o[0] + '">' + o[1] + "</button>"; }).join("") + "</div>" +
          '<div class="pf-corps">' + contenu() + "</div>" +
          '<div class="pf-erreur" id="pf-erreur">' + E(erreur) + "</div>" +
          '<div class="pf-pied"><button type="button" class="bouton" data-annuler>Annuler</button>' +
          (p && (p.ajoute || p.modifie) ? '<button type="button" class="bouton rouge" data-reset>' + (p.ajoute ? "Supprimer" : "Rétablir l'original") + "</button>" : "") +
          '<button type="button" class="bouton sombre" data-sauver>Sauvegarder</button></div></div>';
      }
      function basculer(liste, v) { var i = liste.indexOf(v); if (i >= 0) liste.splice(i, 1); else liste.push(v); }
      zone.onclick = function (e) {
        var t = e.target.closest("[data-onglet],[data-puce],[data-niveau],[data-typeprix],[data-annuler],[data-sauver],[data-reset],[data-nondispo],[data-ajout-achat],[data-retire-achat]");
        if (!t) return;
        if (t.hasAttribute("data-ajout-achat")) { achatOuvert = true; dessiner(); return; }
        if (t.hasAttribute("data-retire-achat")) { achatOuvert = false; achatTxt = ""; dessiner(); return; }
        if (t.hasAttribute("data-onglet")) { onglet = ctx.etat.onglet = t.getAttribute("data-onglet"); dessiner(); }
        else if (t.hasAttribute("data-puce")) { basculer(f[t.getAttribute("data-puce")], t.getAttribute("data-val")); dessiner(); }
        else if (t.hasAttribute("data-niveau")) { f.niveau = t.getAttribute("data-niveau"); dessiner(); }
        else if (t.hasAttribute("data-typeprix")) { f.typePrix = t.getAttribute("data-typeprix"); dessiner(); }
        else if (t.hasAttribute("data-nondispo")) A.nonDispo();
        else if (t.hasAttribute("data-annuler")) { ctx.etat.onglet = "gen"; A.allerA(CHEMIN_PRODUITS); }
        else if (t.hasAttribute("data-reset")) {
          D.resetProduct(id).then(function () { A.info(p.ajoute ? "Produit supprimé." : "Produit rétabli."); ctx.etat.onglet = "gen"; A.allerA(CHEMIN_PRODUITS); });
        } else {
          var prix = nombre(prixTxt);
          D.setProduct(id, { nom: f.nom, categorie: f.categorie, sousCategorie: f.sousCategorie, poles: f.poles, niveau: f.niveau, options: f.options, typePrix: f.typePrix,
            prix: prix === null ? NaN : prix, tva: f.tva, achat: achat ? nombre(achatTxt) : f.achat, codeBarre: f.codeBarre, sku: f.sku, plu: f.plu, nomBouton: f.nomBouton, nomPrepa: f.nomPrepa, seuilReappro: nombre(seuilTxt) })
            .then(function () { A.info(p ? "Produit modifié." : "Produit créé."); ctx.etat.onglet = "gen"; A.allerA(CHEMIN_PRODUITS); },
              function (msg) { erreur = String(msg); onglet = ctx.etat.onglet = "gen"; dessiner(); });
        }
      };
      // Saisie : on met à jour l'état sans redessiner (sauf catégorie/TVA qui changent d'autres champs)
      zone.oninput = function (e) {
        var k = e.target.getAttribute("data-k");
        if (!k) return;
        if (k === "prix") prixTxt = e.target.value; else if (k === "achat") achatTxt = e.target.value;
        else if (k === "seuilReappro") seuilTxt = e.target.value;
        else if (k === "tva") f.tva = +e.target.value; else f[k] = e.target.value;
        if (k === "categorie") { f.sousCategorie = ""; dessiner(); return; }
        var b = document.getElementById("pf-marge");
        if (b) { var m = D.calculMarge(nombre(prixTxt) || 0, f.tva, nombre(achatTxt)); b.textContent = texteMarge(m); b.classList.toggle("neg", !!m && m.marge < 0); }
      };
      dessiner();
    }, function (msg) {
      zone.innerHTML = A.carte("Produit introuvable", '<p class="doux">' + E(String(msg)) + "</p>");
    });
  }
  A.ecran(CHEMIN_PRODUITS + "/create", {
    section: "pdv", fil: ["Point-of-sale", "Products-list", "Create"], filtres: [],
    rendre: function (ctx, zone) { formulaireProduit(ctx, zone, null); }
  });
  A.ecran(CHEMIN_PRODUITS + "/edit/:id", {
    section: "pdv", fil: ["Point-of-sale", "Products-list", "Edit"], filtres: [],
    rendre: function (ctx, zone) { formulaireProduit(ctx, zone, ctx.ids.id); }
  });

  // ---------- Mise en page de la caisse ----------
  A.ecran(PDV + "catalog", {
    section: "pdv", fil: fil("Mise en page"), filtres: [],
    rendre: function (ctx, zone) {
      var et = ctx.etat;
      D.getLayout().then(function (cats) {
        var ci = et.cat || 0, si = et.sous || 0, cat = cats[ci], sous = cat.sous[si] || cat.sous[0];
        var colCats = cats.map(function (c, i) {
          return '<button class="lay-cat' + (i === ci ? " actif" : "") + '" style="--c:' + c.couleur + '" data-act="lay-cat" data-val="' + i + '"><i style="background:' + c.couleur + '"></i><span>' + E(c.nom) + "</span></button>";
        }).join("");
        var colSous = cat.sous.map(function (s, i) {
          return '<button class="lay-sous' + (i === si ? " actif" : "") + '" style="background:' + rgba(cat.couleur, i === si ? 0.28 : 0.12) + '" data-act="lay-sous" data-val="' + i + '">' + E(s.nom) + "</button>";
        }).join("");
        var tuiles = sous.produits.map(function (p) {
          return '<div class="lay-tuile" style="background:' + rgba(cat.couleur, 0.3) + ';color:' + cat.couleur + '"><b>' + E(p.nom) + "</b><span>" + A.euro(p.prix) + "</span></div>";
        }).join("");
        for (var k = sous.produits.length; k < 6; k++) tuiles += '<div class="lay-tuile vide"></div>';
        A.act["lay-cat"] = function (v) { et.cat = +v; et.sous = 0; ctx.rafraichir(); };
        A.act["lay-sous"] = function (v) { et.sous = +v; ctx.rafraichir(); };
        A.act["lay-sup"] = A.nonDispo;
        zone.innerHTML = A.carte("Mise en page",
          '<div class="lay-reglage"><div><b>Nombre de catégories visibles</b><div class="doux">Choisissez le nombre de catégories à afficher sur le caissier</div></div><input class="champ" value="12" readonly></div>' +
          '<div class="lay-editeur"><div class="lay-col lay-cats">' + colCats + '</div><div class="lay-col lay-soustitres">' + colSous + '</div><div class="lay-grille">' + tuiles + "</div>" +
          '<div class="lay-props"><div class="lay-props-t">' + A.icones.cible + " " + E(cat.nom) + '</div><label>Nom<input class="champ" value="' + E(cat.nom) + '" readonly></label>' +
          '<label>Color<div class="champ"><i class="carre" style="background:' + cat.couleur + '"></i> ' + E(cat.nom) + '</div></label><label>Logo<div class="champ">' + A.icones.couverts + ' logo</div></label>' +
          '<label>Modifier le nombre de menus affichés<input class="champ" value="' + cat.nbMenus + '" readonly></label><button class="bouton rouge" data-act="lay-sup">Supprimer la catégorie</button></div></div>');
      });
    }
  });

  // ---------- Options ----------
  A.ecran(PDV + "modifiers", {
    section: "pdv", fil: fil("Modifiers"), actions: function () { return creer("Créer une option"); },
    filtres: ['<div class="filtres-droite"><label class="champ-recherche">' + A.icones.loupe + '<input type="search" placeholder="Rechercher" data-recherche></label></div>'],
    rendre: function (ctx, zone) {
      D.getAllModifierGroups().then(function (l) {
        function dessiner(q) {
          zone.innerHTML = l.filter(function (g) { return !q || g.nom.toLowerCase().indexOf(q.toLowerCase()) >= 0; }).map(function (g) {
            return '<div class="ligne-carte"><span class="poignee">⋮⋮</span><b>' + E(g.nom) + '</b><span class="doux petit">' + g.valeurs.length + " Valeurs</span></div>";
          }).join("");
        }
        dessiner("");
        document.querySelector("[data-recherche]").oninput = function () { dessiner(this.value); };
      });
    }
  });

  // ---------- Menus ----------
  A.ecran(PDV + "meals", {
    section: "pdv", fil: fil("Meals"), actions: function () { return creer("Créer un menu"); }, filtres: [],
    rendre: function (ctx, zone) {
      D.getAllMeals().then(function (l) {
        zone.innerHTML = grille(l.map(function (m) { return '<div class="carte-simple"><b>' + E(m.nom) + '</b> <span class="doux petit">' + m.etapes.length + " Étapes</span></div>"; }), 2);
      });
    }
  });

  // ---------- Employés (jamais de code PIN) ----------
  A.ecran(PDV + "employees", {
    section: "pdv", fil: fil("Employees"), actions: function () { return creer("Créer un employé"); }, filtres: [],
    rendre: function (ctx, zone) {
      D.getEmployeesPos().then(function (l) {
        zone.innerHTML = grille(l.map(function (e) {
          return '<div class="carte-simple"><b>' + E(e.name) + "</b>" + (e.isOwner ? ' <span class="badge-actif on"><i></i>Propriétaire</span>' : "") + "</div>";
        }), 3);
      });
    }
  });

  // ---------- Salles ----------
  A.ecran(PDV + "rooms", {
    section: "pdv", fil: fil("Rooms"), filtres: [],
    rendre: function (ctx, zone) {
      D.getRooms().then(function (l) {
        zone.innerHTML = grille(l.map(function (s) {
          return '<div class="carte-simple haute"><div><b>' + E(s.name) + "</b> " + badge(s.enabled) + '</div><a class="lien-doux" data-act="tables" data-val="' + s.id + '">Voir les tables</a></div>';
        }), 3);
        A.act.tables = function (id) {
          var s = l.filter(function (x) { return x.id === id; })[0], t = "";
          for (var i = 1; i <= s.tables; i++) t += '<div class="table-ronde">' + (s.name.charAt(0) + i) + "</div>";
          var t1 = A.tiroir('<div class="tiroir-tete"><div><h3>' + E(s.name) + '</h3><div class="doux">' + s.tables + ' tables</div></div><button class="fermer" data-act="fermer-tiroir">✕</button></div><div class="tiroir-corps tables">' + (t || '<div class="doux">Aucune table</div>') + "</div>");
          A.act["fermer-tiroir"] = A.fermerTiroir;
          return t1;
        };
      });
    }
  });

  // ---------- Réglages : imprimantes ----------
  A.ecran(PDV + "settings/printers", {
    section: "pdv", fil: fil("Imprimantes", true), filtres: [],
    rendre: function (ctx, zone) {
      D.getPrintersList().then(function (l) {
        zone.innerHTML = l.map(function (p) {
          return '<div class="ligne-carte imprimante"><div><b>' + E(p.name) + '</b><div class="doux petit">' + p.ip + ":" + p.port + " - " + p.mac + '</div>' +
            '<div class="meta"><span>' + A.icones.couche + E(p.marque) + "</span><span>" + A.icones.cible + E(p.modele) + "</span><span>" + A.icones.liste + E(p.interface) + "</span></div></div>" +
            '<span class="puce">' + E(p.poste) + "</span></div>";
        }).join("");
      });
    }
  });

  // ---------- Réglages : postes de préparation ----------
  A.ecran(PDV + "settings/prepa-stations", {
    section: "pdv", fil: fil("Postes de préparation", true), actions: function () { return creer("Ajouter un poste"); },
    filtres: function (ctx) {
      var et = ctx.etat;
      return A.liste("pp-imp", "Sélectionner une imprimante", ["Bar", "Cuisine", "Crêperie", "Dessert", "Imprimante Ticket"].map(function (x) { return [x, x]; }), et.imp, function (v) { et.imp = v; ctx.rafraichir(); });
    },
    rendre: function (ctx, zone) {
      var et = ctx.etat;
      D.getAllPreparationStations().then(function (l) {
        zone.innerHTML = l.filter(function (s) { return !et.imp || s.imprimante === et.imp; }).map(function (s) {
          return '<div class="ligne-carte"><b>' + E(s.name) + "</b>" + (s.recap ? ' <span class="badge-actif recap"><i></i>Récap</span>' : "") + "</div>";
        }).join("");
      });
    }
  });

  // ---------- Réglages : types de prix ----------
  A.ecran(PDV + "settings/price-types", {
    section: "pdv", fil: fil("Types de prix", true), filtres: [],
    rendre: function (ctx, zone) {
      D.getPricingList().then(function (r) {
        function groupe(titre, liste, actifs) {
          return '<div class="titre-groupe"><span>' + titre + "</span></div>" + grille(liste.map(function (x) {
            return '<div class="carte-simple"><b>' + E(x.name) + "</b>" + (actifs ? " " + badge(x.actif) : "") + "</div>";
          }), 3);
        }
        zone.innerHTML = groupe("Tarifs par Salle", r.salle, false) + groupe("Tarifs par horaires", r.horaires, true) + groupe("Tarifs par Évènements", r.evenements, true);
      });
    }
  });

  // ---------- Réglages : taxes ----------
  A.ecran(PDV + "settings/taxes", {
    section: "pdv", fil: fil("Taxes", true), actions: function () { return creer("Créer une taxe"); }, filtres: [],
    rendre: function (ctx, zone) {
      D.getAllTaxes().then(function (l) {
        zone.innerHTML = grille(l.map(function (t) {
          return '<div class="carte-simple haute"><b>' + E(t.name) + '</b><div>' + A.decimal(t.rate).replace(",", ".") + ' %</div><a class="lien-doux" href="#' + PDV + 'products-list">Voir les produits</a></div>';
        }), 3);
      });
    }
  });

  // ---------- Réglages : remises ----------
  A.ecran(PDV + "settings/discounts", {
    section: "pdv", fil: fil("Remises", true), actions: function () { return creer("Créer une remise"); }, filtres: [],
    rendre: function (ctx, zone) {
      D.getDiscounts().then(function (l) {
        zone.innerHTML = grille(l.map(function (r) {
          return '<div class="carte-simple haute"><b>' + E(r.nom) + "</b><div>" + (r.type === "amount" ? A.decimal(r.valeur).replace(",", ".") + " €" : A.decimal(r.valeur).replace(",", ".") + " %") + "</div></div>";
        }), 3);
      });
    }
  });

  // ---------- Réglages : mouvements de caisse ----------
  A.ecran(PDV + "settings/cash-movements", {
    section: "pdv", fil: fil("Mouvements de caisse", true), actions: function () { return creer("Créer un mouvement"); }, filtres: [],
    rendre: function (ctx, zone) {
      D.getCashMovementReasons().then(function (l) {
        zone.innerHTML = grille(l.map(function (r) { return '<div class="carte-simple"><b>' + E(r.name) + "</b></div>"; }), 3);
      });
    }
  });

  // ---------- Réglages : ticket de caisse ----------
  A.ecran(PDV + "settings/receipt", {
    section: "pdv", fil: fil("Ticket de caisse", true), filtres: [],
    rendre: function (ctx, zone) {
      D.getReceiptSettings().then(function (r) {
        var champs = [["Nom de l'établissement", r.establishmentName, ""], ["Adresse", r.address1, ""], ["Complément d'adresse", r.address2, "Complément d'adresse"],
          ["Code postal", r.zipCode, ""], ["Ville", r.city, ""], ["Pays", r.country, "Pays"], ["Téléphone", r.phoneNumber, ""], ["SIRET", r.siretCode, ""], ["Code NAF", r.nafCode, ""], ["N° de TVA", r.tvaCode, ""],
          ["En-tête du ticket", r.customHeader, ""], ["Pied du ticket", r.customFooter, ""]];
        A.act.apercu = function () {
          A.tiroir('<div class="tiroir-tete"><h3>Aperçu du ticket</h3><button class="fermer" data-act="fermer-tiroir">✕</button></div><div class="tiroir-corps"><div class="ticket"><b>' + E(r.establishmentName) + "</b><br>" + E(r.address1) + "<br>" + E(r.zipCode + " " + r.city) +
            "<br>Tél. " + E(r.phoneNumber) + "<br>SIRET " + E(r.siretCode) + "<hr>" + E(r.customHeader) + "<hr>1 x Café ........ " + A.euro(2.2) + "<br>1 x Crêpe ........ " + A.euro(5) + "<hr><b>Total " + A.euro(7.2) + "</b><hr>" + E(r.customFooter) + "</div></div>");
          A.act["fermer-tiroir"] = A.fermerTiroir;
        };
        zone.innerHTML = A.carte("Ticket de caisse", '<div class="encart"><b>Champs fiscaux</b><div class="doux petit">Les champs relatifs à l\'identification fiscale doivent être saisis directement sur le système d\'encaissement</div></div>' +
          champs.map(function (c) { return '<div class="champ-ligne"><label>' + c[0] + '</label><div class="champ' + (c[1] ? "" : " vide") + '">' + E(c[1] || c[2]) + "</div></div>"; }).join(""),
          { droite: A.bouton(A.icones.oeil + " Aperçu", "apercu"), classe: "grande-carte" });
      });
    }
  });

  // ---------- Réglages : modes de paiement ----------
  A.ecran(PDV + "settings/payments", {
    section: "pdv", fil: ["Réglages", "Mode de paiements"], actions: function () { return creer("Créer mode paiement"); }, filtres: [],
    rendre: function (ctx, zone) {
      D.getAllPayments().then(function (l) {
        zone.innerHTML = l.map(function (p) {
          return '<div class="ligne-carte grande"><span class="poignee">⋮⋮</span><div><b>' + E(p.name) + "</b> " + badge(p.enabled) +
            '<div class="doux petit">Bon d\'achat ' + onOff(p.voucher) + " &nbsp; Ouvrir le tiroir-caisse " + onOff(p.openCashDrawer) + " &nbsp; Pourboires " + onOff(p.tips) + "</div></div></div>";
        }).join("");
      });
    }
  });

  // ---------- Réglages : créneaux de service (2 ou 3, horaires libres, utilisés par Taux de répartition) ----------
  A.ecran(PDV + "settings/service-slots", {
    section: "pdv", fil: fil("Créneaux de service", true), filtres: [],
    rendre: function (ctx, zone) {
      var et = ctx.etat;
      if (!et.brouillon) et.brouillon = D.getCreneaux();
      var b = et.brouillon;
      function lire() {
        zone.querySelectorAll("[data-cren]").forEach(function (champ) {
          var p = champ.getAttribute("data-cren").split("-");
          if (b[+p[0]]) b[+p[0]][p[1]] = champ.value;
        });
      }
      function plage(c) { var x = +c.debut.slice(0, 2) * 60 + +c.debut.slice(3), y = +c.fin.slice(0, 2) * 60 + +c.fin.slice(3); return [x, y <= x ? y + 1440 : y]; }
      A.act.crenNb = function (v) {
        lire();
        var n = +v;
        while (b.length > n) b.pop();
        while (b.length < n) b.push({ nom: "Service " + (b.length + 1), debut: "18:00", fin: "23:00" });
        ctx.rafraichir();
      };
      A.act.crenAnnuler = function () { et.brouillon = null; ctx.rafraichir(); };
      A.act.crenDefaut = function () { D.setCreneaux(null); et.brouillon = null; A.info("Créneaux par défaut rétablis."); ctx.rafraichir(); };
      A.act.crenSauver = function () {
        lire();
        for (var i = 0; i < b.length; i++) {
          var c = b[i];
          c.nom = String(c.nom || "").replace(/^\s+|\s+$/g, "");
          if (!c.nom) { A.info("Donnez un nom à chaque créneau."); return; }
          if (!/^\d\d:\d\d$/.test(c.debut) || !/^\d\d:\d\d$/.test(c.fin)) { A.info("Renseignez les horaires de « " + c.nom + " »."); return; }
          if (c.debut === c.fin) { A.info("Début et fin identiques pour « " + c.nom + " »."); return; }
        }
        for (var x = 0; x < b.length; x++) for (var y = x + 1; y < b.length; y++) {
          var p1 = plage(b[x]), p2 = plage(b[y]);
          if ((p1[0] < p2[1] && p2[0] < p1[1]) || (p1[0] < p2[1] - 1440 && p2[0] - 1440 < p1[1]) || (p2[0] < p1[1] - 1440 && p1[0] - 1440 < p2[1])) { A.info("« " + b[x].nom + " » et « " + b[y].nom + " » se chevauchent."); return; }
        }
        if (!D.setCreneaux(b)) { A.info("Stockage du navigateur indisponible."); return; }
        et.brouillon = null; A.info("Créneaux enregistrés."); ctx.rafraichir();
      };
      zone.innerHTML = '<div class="carte"><div class="carte-tete"><h2>Créneaux de service</h2></div><div class="carte-corps pad"><div class="cren-edit">' +
        '<p class="doux">Ces horaires découpent les ventes dans Rapports des ventes › Taux de répartition › « Ventes par créneau de service ».</p>' +
        '<div class="cren-ligne"><span>Nombre de créneaux</span>' + A.segment("crenNb", [["2", "2"], ["3", "3"]], String(b.length), A.act.crenNb) + "</div>" +
        b.map(function (c, i) {
          return '<div class="cren-ligne"><input class="cren-nom" type="text" maxlength="30" data-cren="' + i + '-nom" value="' + E(c.nom) + '" aria-label="Nom du créneau ' + (i + 1) + '">' +
            '<label>de <input type="time" data-cren="' + i + '-debut" value="' + E(c.debut) + '"></label>' +
            '<label>à <input type="time" data-cren="' + i + '-fin" value="' + E(c.fin === "24:00" ? "00:00" : c.fin) + '"></label></div>';
        }).join("") +
        '<div class="cren-note">Une fin plus petite que le début passe minuit (ex. 18:00 → 01:00). Les ventes hors créneau sont regroupées à part.</div>' +
        '<div class="cren-actions">' + A.bouton("Enregistrer", "crenSauver", { classe: "sombre" }) + A.bouton("Annuler", "crenAnnuler") + A.bouton("Rétablir par défaut", "crenDefaut") + "</div></div></div></div>";
    }
  });

  // ---------- Réglages : réglages divers ----------
  A.ecran(PDV + "settings/misc-settings", {
    section: "pdv", fil: fil("Réglages divers", true), filtres: [],
    rendre: function (ctx, zone) {
      var et = ctx.etat;
      D.getMiscSettings().then(function (m) {
        if (!et.v) { et.v = {}; Object.keys(m).forEach(function (k) { et.v[k] = m[k]; }); }
        var onglet = et.onglet || "gen", v = et.v;
        function inter(cle, titre, desc) {
          return '<div class="reglage"><div><b>' + titre + '</b><div class="doux petit">' + desc + '</div></div><button class="interrupteur' + (v[cle] ? " on" : "") + '" data-act="bascule" data-val="' + cle + '" aria-label="' + titre + '"><i></i></button></div>';
        }
        var contenu = {
          gen: '<div class="reglage"><div><b class="gros">Fuseau horaire</b><div class="doux petit">Fuseau horaire</div></div><select class="champ"><option>' + E(v.timezone) + "</option></select></div>" +
            '<div class="reglage"><div><b class="gros">Imprimante générale</b><div class="doux petit">Imprimante utilisée pour les tickets lorsqu\'aucune imprimante spécifique n\'est configurée sur un appareil ou une salle.</div></div><select class="champ" disabled><option>Sélectionner une option</option></select></div>' +
            inter("qrCodeLogin", "Utiliser l'authentification par QR-Code", "Passez votre badge devant l'iPad pour déverrouiller l'application") +
            inter("allowGapInTillStats", "Écart de caisse", "Autoriser la fermeture d'une caisse ayant un écart") +
            inter("allowCatalogEditOnPos", "Modifier le catalogue sur la caisse", "Autoriser la modification du catalogue de produits depuis la caisse"),
          cmd: inter("printOnPay", "Impression à l'encaissement", "Imprimer le ticket lors de chaque encaissement") + inter("detailedReport", "Rapport détaillé", "Détailler les produits dans le rapport de fin de caisse") +
            inter("groupProductsOnOrder", "Grouper les produits", "Regrouper les produits identiques sur la commande") + inter("askForInitialCashFloat", "Fond de caisse initial", "Demander le fond de caisse à l'ouverture"),
          cui: inter("enablePreparationCall", "Appel de préparation", "Activer l'appel des commandes prêtes") + inter("cutBetweenSteps", "Couper entre les étapes", "Couper le papier entre deux étapes d'un menu") +
            inter("groupProductsOnPrepaReceipt", "Grouper sur le ticket de préparation", "Regrouper les produits identiques") + inter("printOnlyFirstPrepaReceipt", "Premier ticket seulement", "N'imprimer que le premier ticket de préparation")
        }[onglet];
        A.act.onglet = function (o) { et.onglet = o; ctx.rafraichir(); };
        A.act.bascule = function (cle) { v[cle] = !v[cle]; ctx.rafraichir(); };
        zone.innerHTML = '<div class="carte"><div class="carte-tete"><h2>Réglages divers</h2></div><div class="onglets-bouton">' +
          [["gen", "Réglages généraux"], ["cmd", "Commandes"], ["cui", "Envoi en cuisine"]].map(function (o) { return '<button class="' + (o[0] === onglet ? "actif" : "") + '" data-act="onglet" data-val="' + o[0] + '">' + o[1] + "</button>"; }).join("") +
          '</div><div class="carte-corps pad">' + contenu + '</div><div class="pied-formulaire"><button class="bouton large" data-act="creer">Annuler</button><button class="bouton large inactif" disabled>Sauvegarder</button></div></div>';
        A.act.creer = A.nonDispo;
      });
    }
  });

  // ---------- Réglages : appareils et contrats ----------
  A.ecran(PDV + "settings/devices-contracts", {
    section: "pdv", fil: fil("Appareils et Contrats", true), actions: function () { return '<button class="bouton sombre inactif" disabled>Créer un appareil</button>'; }, filtres: [],
    rendre: function (ctx, zone) {
      D.getLogicalDevices().then(function (r) {
        var c = r.contrat;
        function cpt(t, v) { return '<div class="kpi large"><div class="kpi-l">' + t + '</div><div class="kpi-v">' + v[0] + " / " + v[1] + "</div></div>"; }
        zone.innerHTML = '<div class="kpi large"><div class="kpi-l">Type de contrat</div><div class="kpi-v">' + E(c.type) + "</div></div>" +
          cpt("Nombre de caisse principale", c.principal) + cpt("Nombre de caisse secondaire", c.secondaire) + cpt("Nombre de bornes", c.bornes) + cpt("Nombre d'écrans cuisine", c.ecrans) +
          r.appareils.map(function (a) {
            return '<div class="appareil"><div class="appareil-img"></div><div><b>' + E(a.name) + '</b><div class="doux petit">Dernière connexion: ' + E(a.derniereConnexion) + '</div><div class="meta petit"><span>' + E(a.modele) + "</span><span>" + E(a.os) + "</span><span>" + E(a.version) + '</span></div></div><span class="badge-actif recap">' + E(a.role) + "</span></div>";
          }).join("");
      });
    }
  });
})();
