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

## Pilotage

**Objectif du mois** :
Un montant de CA à atteindre sur une période, comparé à ce qui était attendu à date (écart d'avance ou de retard) et projeté en fin de période.
_Éviter_ : cible, budget

**Score de clémence** :
Une note de 0 à 100 qui résume la météo d'un jour selon son effet sur la fréquentation (température, pluie, ensoleillement, vent).
_Éviter_ : score météo, indice

**Alerte de stock** :
Le signal qu'un produit est passé sous son seuil de réapprovisionnement ou en rupture.
_Éviter_ : notification de stock

**Bon cadeau** :
Un montant prépayé, identifié par un code, que son bénéficiaire consomme en une ou plusieurs fois avant sa fin de validité.
_Éviter_ : carte cadeau, avoir

**Export comptable** :
Le fichier des écritures de ventes d'une période, au format FEC ou CSV, destiné au comptable.

**Pop'IA** :
L'assistant du back-office qui répond en français, par un chiffre ou un graphique, à une question sur les ventes. Se prononce « pop-i-a ».
_Éviter_ : chatbot, IA

**Up'Pina** :
Le nom du produit. Se prononce « eupe-pina ».
