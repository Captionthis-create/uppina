# Vidéo « Les nouveautés de l'accueil Up'Pina »

Vidéo de présentation de l'accueil d'Up'Pina (environ 3 min 30, 1920 × 1080, 30 images/s), destinée à la direction.
Elle est **entièrement générée** à partir de la démo de ce dépôt : captures HD de la vraie interface, animées en
motion design, voix off de synthèse, musique générée et sous-titres incrustés. Toutes les données affichées sont
celles, simulées, de la démo (Crêperie Démo, Rennes).

## Le film

Neuf nouveautés, présentées une à une, toujours de la même façon : un carton « Nouveau », une présentation
factuelle sur la vraie interface, puis un bandeau « L'avantage ». Une frise en haut de l'écran situe le module.

| Module | Présentation | L'avantage |
| --- | --- | --- |
| Intro | Logo, « Les nouveautés de l'accueil » | |
| **01 · L'accueil en direct** | Notifications d'encaissement et liste en temps réel ; CA TTC et HT, couverts et couvert moyen comparés au même jour de la semaine précédente, à la même heure | Piloter le service d'un coup d'œil |
| **02 · Météo et CA attendu** | **Score de clémence** sur 100 (température 35 %, pluie 30 %, ensoleillement 25 %, vent 10 %) ; **CA attendu** : moyenne des mêmes jours de la semaine, corrigée par la météo, sur 16 jours | Anticiper les commandes et le planning |
| **03 · La gestion des stocks** | Vente d'un Cidre doux 75cl (stock 3 → 2, seuil 6) ; alerte sur l'accueil et dans la cloche ; tableau « À commander » et historique des mouvements ; saisie d'une livraison qui lève l'alerte | Moins de ruptures, des commandes au plus juste |
| **04 · Les créneaux de service** | Journée découpée librement (service du midi, limonade, service du soir) ; ventes par créneau | Chaque moment de la journée mesuré |
| **05 · Les réservations** | Réservations du jour (heure, couverts, statut, allergie) ; saisie avec confirmation par SMS ; passage en « Arrivé » d'un clic | Toute l'équipe sait qui arrive |
| **06 · Les bons cadeaux** | Création d'un bon de 50 € (montant, validité, occasion, code unique) ; soldes à consommer ; bons qui expirent sous 30 jours | Plus de bons vendus, aucun solde oublié |
| **07 · Les objectifs** | Objectif de CA ou de couverts sur une période ; avancement, écart avec le rythme attendu, projection de fin de mois | Savoir chaque jour où l'on en est |
| **08 · L'assistant Pop'IA** | Trois questions : samedis midi des six dernières semaines, crêpes vendues au goûter, top 10 des produits du mois | Une réponse immédiate, sans chercher |
| **09 · L'export comptable** | Écritures de la période au format FEC ou CSV, avec leurs contrôles | Prêt pour le cabinet comptable |
| Fin | Mosaïque des neuf modules, logo, mention « données simulées », crédits de la voix | |

Le texte de la voix off et des sous-titres est dans [`scenario.json`](scenario.json) (`texte` = sous-titre,
`dit` = texte prononcé, écrit phonétiquement : « Eupe-pina », « Pop i a », « F E C » ; `avantage` = texte du bandeau).

## La voix

La voix se choisit dans le champ `voix` de `scenario.json`. Deux moteurs de [Kyutai](https://kyutai.org), qui
tournent sur le processeur, sans service en ligne :

| `moteur` | Modèle | `nom` | Vitesse |
| --- | --- | --- | --- |
| `pocket-tts` (par défaut) | [Pocket TTS](https://huggingface.co/kyutai/pocket-tts-without-voice-cloning), français 24 couches (`langue` : `french_24l`) | voix prédéfinie, ex. `estelle` | ≈ temps réel |
| `kyutai-1.6b` | [Kyutai TTS 1.6B](https://huggingface.co/kyutai/tts-1.6b-en_fr) (français et anglais) | fichier de la banque [`kyutai/tts-voices`](https://huggingface.co/kyutai/tts-voices), ex. `cml-tts/fr/928_486_000075-0001_enhanced.wav` | ≈ 5 à 6 × le temps réel |

Les modèles sont sous licence **CC-BY 4.0** ; les voix `cml-tts/fr` sont sous CC-BY 4.0, celles enregistrées par
Kyutai (`unmute-prod-website`) sous CC0. Le champ `credit` est affiché au générique de fin : l'adapter quand on
change de voix. Éviter les voix `expresso` (licence non commerciale).

Le moteur `kyutai-1.6b` demande en plus le paquet `moshi`, dont les dépendances déclarées sont plus anciennes que
celles de Pocket TTS ; l'installer sans elles :

```bash
.venv/bin/pip install --no-deps moshi==0.2.13
.venv/bin/pip install "sphn>=0.2,<0.3" "sentencepiece>=0.2,<0.3" "einops>=0.7,<0.9" pyyaml
```

## Fabriquer la vidéo

```bash
npm install
npx playwright install chromium
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
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
2. `python voix.py` : voix off, une phrase par fichier. Chaque phrase est **contrôlée automatiquement** : Whisper
   (`large-v3-turbo`) la retranscrit, et si l'écart avec le texte est trop grand ou si le débit est anormal, elle est
   régénérée avec une autre graine (6 essais au plus, le meilleur est gardé). Les transcriptions sont dans
   `build/voix/controle.json`. Pour refaire une phrase : `python voix.py --strict <id>` (transcription exacte
   exigée), et `--graine 1`, `--graine 2`… pour essayer d'autres tirages.
3. `node timeline.js` : place chaque phrase dans le temps et écrit le minutage et les sous-titres `.srt`.
   La table `MIN_ECRAN` de `timeline.js` fixe la durée d'écran minimale des phrases qui portent une animation :
   une voix plus rapide ne raccourcit pas les démonstrations.
4. `python musique.py` : nappe musicale générée (ré majeur, 92 BPM), dont l'intensité suit les modules.
5. `node rendu.js video` : rend la scène animée [`scene/`](scene/) image par image (Chromium) et l'encode en H.264.
   `node rendu.js apercu 12.5 47` produit des images isolées dans `build/apercu/` pour vérifier le montage.
6. `python mixage.py` puis l'assemblage ffmpeg de `fabriquer.sh` : voix + musique (baissée sous la voix),
   normalisée à −16 LUFS.

## Modifier

- **Le texte** : `scenario.json`, puis `python voix.py <id>` pour les phrases changées, puis `./fabriquer.sh rendu`.
- **Le montage** : `scene/film.js` (une fonction par module, calée sur le minutage des phrases).
- **Les temps morts** après une phrase (cartons, bandeaux « L'avantage ») : table `APRES` de `timeline.js`.
