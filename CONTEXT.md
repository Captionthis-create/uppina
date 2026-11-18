# Up'Pina

Back-office de démonstration d'Up'Pina pour un restaurant (Crêperie Démo, Rennes) : suivi du service, des ventes et de la gestion courante, avec des données simulées.

## Service et ventes

**Encaissement** :
Un paiement enregistré en caisse pour une table ou une vente à emporter ; il alimente l'accueil en direct et déclenche une notification.
_Éviter_ : vente, transaction, ticket

**Couvert** :
Une personne servie ; le « couvert moyen » est le CA TTC divisé par le nombre de couverts.
_Éviter_ : client, personne

**Créneau de service** :
Une plage horaire nommée et personnalisable de la journée (par défaut : Service du midi, Limonade, Service du soir) qui découpe les ventes.
_Éviter_ : service, tranche horaire

**Limonade** :
Le créneau de service de l'après-midi, entre le midi et le soir (par défaut 15h à 18h30), où l'on sert surtout des boissons et des crêpes.
_Éviter_ : goûter, après-midi

**Carte Midi / soir** :
La carte de l'accueil qui partage la journée en deux à 16 h, sans tenir compte des créneaux de service.
_Éviter_ : créneaux (ce n'en sont pas)

## Réservations

**Réservation** :
Une table retenue par un client pour une date, une heure et un nombre de couverts, saisie dans le back-office.
_Éviter_ : booking, résa

**Statut de réservation** :
L'étape où en est une réservation : En attente, Confirmée, Arrivé, En retard, Annulé ou Non venu.
