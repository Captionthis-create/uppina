# Up'Pina

Démonstration du back-office Up'Pina (Crêperie Démo, Rennes) : **toutes les données sont simulées**, sauf la météo (Open-Meteo, en direct).

- En ligne : https://captionthis-create.github.io/uppina/
- Sur le poste : ouvrir `index.html` dans un navigateur (aucune installation).

## Comment fonctionne la démo

- **Ventes** : deux ans d'historique depuis le 1er novembre 2024, 7j/7 de 8h à 23h. Chaque jour passé est figé (mêmes chiffres pour tout le monde). La journée en cours se remplit au fil de l'heure, avec en plus quelques « encaissements de démo » à chaque visite et toutes les 30 à 60 secondes.
- **Météo** : vraie météo de la ville choisie (Rennes par défaut) ; les ventes simulées suivent la météo réelle de Rennes (`meteo-rennes.js` pour l'historique).
- **Modifications** (stocks, objectifs, produits, clients, réservations, réglages…) : gardées dans le navigateur. Menu du compte › *Réinitialiser la démo* pour tout effacer.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `stockage.js` | Stockage navigateur versionné (préfixe `uppina:`) |
| `meteo-rennes.js`, `meteo-demo.js` | Historique météo de Rennes, météo en direct et secours simulé |
| `donnees-test.js`, `donnees-gestion.js` | Moteur de données simulées (ventes, stocks, clients, réservations, réglages) |
| `direct.js` | Encaissements en direct et notifications |
| `contenus.js` | Quoi de neuf, documentation, pages légales |
| `noyau.js`, `ecrans-*.js`, `style.css` | Interface |

Aucune vraie donnée de caisse ne doit être ajoutée à ce dépôt (il est public).
