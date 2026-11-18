# Vidéo « Une journée avec Up'Pina »

Vidéo de présentation de l'accueil d'Up'Pina (environ 3 min 30, 1920 × 1080, 30 images/s), destinée à la direction.
Elle est **entièrement générée** à partir de la démo de ce dépôt : captures HD de la vraie interface, animées en
motion design, voix off de synthèse, musique générée et sous-titres incrustés. Toutes les données affichées sont
celles, simulées, de la démo (Crêperie Démo, Rennes).

## Le film

Une journée de service, le samedi 21 novembre, racontée à la troisième personne :

| Moment | Ce qui est montré |
| --- | --- |
| Intro | Logo, date, Crêperie Démo |
| **8h05 · Ouverture** | Accueil ; météo du jour et **score de clémence** (température 35 %, pluie 30 %, ensoleillement 25 %, vent 10 %) ; **CA attendu** (moyenne des mêmes jours de la semaine sur 8 semaines, corrigée par la météo) ; prévisions sur 16 jours ; objectif du mois ; réservations du jour |
| **12h45 · Coup de feu** | Notifications d'encaissement et liste en direct ; CA, couverts, couvert moyen comparés au samedi précédent ; **stocks** : vente d'un Cidre doux 75cl (stock 3 → 2), alerte sur l'accueil et dans la cloche, tableau des stocks, historique des mouvements, saisie d'une livraison qui lève l'alerte |
| **16h30 · Limonade** | Carte Midi / soir ; **créneaux de service** personnalisés (midi, limonade, soir) ; ventes par créneau ; création d'un **bon cadeau** de 50 € ; bons qui expirent sous 30 jours |
| **19h30 · Service du soir** | Réservations du jour ; saisie d'une réservation (confirmation SMS) ; une table en retard passe en « Arrivé » |
| **23h15 · Clôture** | Chiffres de la journée ; **Pop'IA** (3 questions : samedis midi, crêpes au goûter, top 10 du mois) ; **objectif** de novembre ; **export comptable** FEC |
| Fin | Mosaïque des fonctionnalités, logo, mention « données simulées » |

Le texte de la voix off et des sous-titres est dans [`scenario.json`](scenario.json) (`texte` = sous-titre,
`dit` = texte prononcé, écrit phonétiquement : « Eupe-pina », « Pop hi ha »).

## Fabriquer la vidéo

```bash
npm install
npx playwright install chromium
python3 -m venv .venv && .venv/bin/pip install piper-tts==1.8.0 numpy scipy
PYTHON=.venv/bin/python ./fabriquer.sh
```

Il faut aussi ffmpeg, et sous Linux les polices Noto Color Emoji et DejaVu Sans Mono (paquets `fonts-noto-color-emoji`,
`fonts-dejavu-core`). La police de l'interface, Poppins, vient de `@fontsource/poppins`.

Résultat : `build/uppina-accueil.mp4` et `build/uppina-accueil.srt`. Le dossier `build/` n'est pas versionné.

Étapes (chacune se relance seule) :

1. `node captures.js` : ouvre la démo dans Chromium à 8h05, 12h45, 16h30, 19h30 et 23h15 (horloge simulée),
   joue les interactions et enregistre les captures (×2) et la position de chaque élément utile
   (`build/captures/captures.json`). Le hasard de la démo est fixé (graine 1) et, pour la séquence en direct de midi,
   l'horloge simulée avance par pas fixes : on retrouve exactement les mêmes encaissements à chaque lancement
   (dont la vente de 12h44 qui fait passer le Cidre doux 75cl de 3 à 2). Les appels météo sont coupés : la démo
   affiche sa météo simulée.
2. `python voix.py` : voix off avec [Piper](https://github.com/rhasspy/piper) (modèle `fr_FR-upmc-medium`,
   locuteur « Pierre », débit −5 %), une phrase par fichier. Le modèle est téléchargé dans `voix/` s'il manque.
3. `node timeline.js` : place chaque phrase dans le temps et écrit le minutage et les sous-titres `.srt`.
4. `python musique.py` : nappe musicale générée (ré majeur, 92 BPM), plus présente au coup de feu de midi.
5. `node rendu.js video` : rend la scène animée [`scene/`](scene/) image par image (Chromium) et l'encode en H.264.
   `node rendu.js apercu 12.5 47` produit des images isolées dans `build/apercu/` pour vérifier le montage.
6. `python mixage.py` puis l'assemblage ffmpeg de `fabriquer.sh` : voix + musique (baissée sous la voix),
   normalisée à −16 LUFS.

## Modifier

- **Le texte** : `scenario.json`, puis `python voix.py <id>` pour les phrases changées, puis `./fabriquer.sh rendu`.
- **Le montage** : `scene/film.js` (une fonction par moment de la journée, calée sur le minutage des phrases).
- **Les temps morts** après une phrase (pour laisser jouer une animation) : table `APRES` de `timeline.js`.
