# PRD — Application Tombola V1

## 1. Objectif
Créer une application web responsive pour gérer une tombola simple.

L’admin doit pouvoir :
- créer une tombola ;
- définir une plage de numéros ;
- ajouter une liste de lots ;
- exclure certains numéros ;
- lancer un tirage au sort ;
- publier les résultats.

Les participants doivent pouvoir :
- entrer leur numéro ;
- savoir s’ils ont gagné ;
- voir le lot associé à leur numéro ;
- consulter la liste publique des gagnants si l’admin l’a activée.

## 2. Contexte légal / contrainte produit
Cette application ne doit pas gérer la vente de tickets en ligne ni le paiement en ligne.

En France, les tombolas/loteries associatives ont un cadre réglementé. Service-public indique notamment que les loteries doivent se dérouler en présentiel et que les loteries en ligne sont interdites. La demande d’autorisation peut dépendre de la mairie, ou de la préfecture de police pour Paris. L’ANJ rappelle aussi que les jeux d’argent et de hasard en ligne sont limités aux opérateurs autorisés.

Sources : Service-public et ANJ.

Donc la V1 doit être positionnée comme :
- outil d’administration du tirage ;
- outil de publication / consultation des résultats ;
- pas comme une tombola jouable ou achetable en ligne.

## 3. Stack cible
Utiliser :
- Next.js avec App Router ;
- TypeScript ;
- Tailwind CSS ;
- shadcn/ui si disponible ;
- Prisma ou Drizzle pour la base ;
- PostgreSQL ;
- auth admin simple.

Si le repo existant utilise une autre stack, adapter en gardant les mêmes règles métier.

## 4. Rôles
### Admin
L’admin peut :
- se connecter ;
- créer une tombola ;
- modifier une tombola tant qu’elle est en brouillon ;
- ajouter / modifier / supprimer des lots tant que le tirage n’a pas eu lieu ;
- lancer le tirage ;
- publier les résultats ;
- consulter les résultats après publication.

### Participant
Le participant peut :
- accéder à une page publique sans compte ;
- entrer son numéro ;
- voir s’il est gagnant ;
- voir le lot gagné si son numéro est gagnant ;
- voir la liste des gagnants si l’admin a activé l’option.

## 5. États d’une tombola
```ts
type RaffleStatus = "draft" | "drawn" | "published"
```

### draft
État initial.

L’admin peut :
- modifier le nom ;
- modifier le range de numéros ;
- modifier les numéros exclus ;
- ajouter / modifier / supprimer des lots ;
- modifier les options publiques ;
- lancer le tirage.

La page publique ne doit pas afficher les résultats.

### drawn
Le tirage a été lancé mais les résultats ne sont pas encore publiés.

L’admin peut :
- consulter les résultats ;
- publier les résultats.

L’admin ne peut plus :
- modifier le range ;
- modifier les numéros exclus ;
- modifier les lots ;
- relancer le tirage.

La page publique ne doit pas afficher les résultats.

### published
Les résultats sont publics.

L’admin peut :
- consulter les résultats.

L’admin ne peut plus :
- modifier la tombola ;
- modifier les lots ;
- modifier les résultats ;
- relancer le tirage ;
- dépublier.

La page publique peut afficher les résultats selon les options définies.

## 6. Pages à créer

### 6.1 Page admin — Liste des tombolas
Route suggérée :
- `/admin/raffles`

Contenu :
- titre : Tombolas
- bouton : Créer une tombola
- tableau des tombolas existantes

Colonnes :
- nom ;
- statut ;
- plage de numéros ;
- nombre de lots ;
- date de création ;
- date du tirage ;
- date de publication ;
- action Ouvrir.

États vides :
- si aucune tombola : afficher un message et un bouton Créer une tombola.

### 6.2 Page admin — Créer / éditer une tombola
Routes suggérées :
- `/admin/raffles/new`
- `/admin/raffles/:raffleId/settings`

Champs :
- Nom de la tombola
- Numéro minimum
- Numéro maximum
- Numéros exclus
- toggle Afficher tous les gagnants
- toggle Recherche par numéro

Bouton :
- Enregistrer

Section lots :
- titre Lots
- bouton Ajouter un lot
- liste/table des lots

Champs d’un lot :
- nom du lot ;
- description optionnelle ;
- ordre d’attribution.

Exemples :
- Vélo adulte
- Bon d’achat 50 €
- Panier garni

Règles UI :
- désactiver tous les champs si la tombola est drawn ou published ;
- afficher un message clair : Cette tombola a déjà été tirée. Les paramètres ne peuvent plus être modifiés. ;
- empêcher l’enregistrement si le range est invalide ;
- empêcher l’enregistrement s’il n’y a aucun lot.

### 6.3 Page admin — Tirage
Route suggérée :
- `/admin/raffles/:raffleId/draw`

Contenu :
- titre : Tirage au sort
- résumé :
  - nombre total de numéros disponibles ;
  - nombre de lots ;
  - nombre de numéros exclus ;
  - statut de conflit.

Bouton principal :
- Lancer le tirage

Avant tirage :
- afficher un warning :
  > Cette action attribuera un numéro gagnant à chaque lot. Le tirage ne pourra plus être modifié.

Après tirage :
- afficher les résultats :
  - rang ;
  - numéro gagnant ;
  - lot gagné.

Bouton secondaire :
- Publier les résultats

Règles :
- le bouton Lancer le tirage est visible uniquement si statut = draft ;
- le bouton Publier les résultats est visible uniquement si statut = drawn ;
- si statut = published, afficher un badge Résultats publiés.

### 6.4 Page publique — Vérifier son numéro
Route suggérée :
- `/r/:publicSlug`

Contenu :
- nom de la tombola ;
- titre : Vérifier mon numéro
- input : Entrez votre numéro
- bouton : Vérifier

Cas possibles :

**Tombola non publiée**
- Afficher : `Les résultats ne sont pas encore publiés.`
- Ne pas permettre la vérification.

**Numéro invalide**
- Si le numéro est hors plage : `Ce numéro ne fait pas partie de cette tombola.`

**Numéro exclu**
- `Ce numéro n’est pas éligible pour cette tombola.`

**Numéro perdant**
- `Le numéro {number} n’est pas gagnant.`

**Numéro gagnant**
- `Bravo, le numéro {number} gagne : {prizeName}`
- Afficher aussi la description du lot si disponible.

### 6.5 Page publique — Liste des gagnants
Sur la même page publique, si `showPublicWinners = true`, afficher une section :

**Résultats de la tombola**

Colonnes :
- rang ;
- numéro ;
- lot.

Si `showPublicWinners = false`, ne pas afficher la liste complète.

## 7. Modèle de données

### 7.1 raffles
```ts
type Raffle = {
  id: string
  publicSlug: string
  title: string
  numberMin: number
  numberMax: number
  status: "draft" | "drawn" | "published"
  showPublicWinners: boolean
  allowNumberLookup: boolean
  drawnAt: Date | null
  publishedAt: Date | null
  createdAt: Date
  updatedAt: Date
}
```

Contraintes :
- numberMin doit être inférieur ou égal à numberMax
- publicSlug doit être unique
- status par défaut = draft

### 7.2 prizes
```ts
type Prize = {
  id: string
  raffleId: string
  name: string
  description: string | null
  position: number
  winningNumber: number | null
  createdAt: Date
  updatedAt: Date
}
```

Contraintes :
- raffleId + position unique
- raffleId + winningNumber unique quand winningNumber n’est pas null
- winningNumber doit être null tant que le tirage n’a pas eu lieu

### 7.3 excluded_numbers
```ts
type ExcludedNumber = {
  id: string
  raffleId: string
  number: number
  createdAt: Date
}
```

Contraintes :
- raffleId + number unique
- number doit être compris entre numberMin et numberMax

### 7.4 draw_audits
Créer une trace complète du tirage.

```ts
type DrawAudit = {
  id: string
  raffleId: string
  drawnAt: Date
  drawnByUserId: string | null
  numberMinSnapshot: number
  numberMaxSnapshot: number
  excludedNumbersSnapshot: number[]
  prizesSnapshot: {
    id: string
    name: string
    description: string | null
    position: number
  }[]
  resultsSnapshot: {
    prizeId: string
    prizeName: string
    position: number
    winningNumber: number
  }[]
  algorithm: string
  createdAt: Date
}
```

Objectif :
- pouvoir vérifier ce qui a été tiré ;
- éviter les contestations ;
- conserver l’état exact du tirage.

## 8. Règles métier

### 8.1 Range de numéros
Un range est défini par :
- numberMin
- numberMax

Exemple : `1 → 500`

Les numéros disponibles sont tous les entiers entre numberMin et numberMax, inclus.

### 8.2 Numéros exclus
Les numéros exclus :
- ne peuvent pas être tirés ;
- doivent être compris dans la plage ;
- ne doivent pas être dupliqués.

### 8.3 Nombre de lots vs numéros disponibles
Avant de lancer le tirage, vérifier :

`availableNumbersCount >= prizesCount`

Sinon, bloquer le tirage et afficher :
`Il n’y a pas assez de numéros disponibles pour attribuer tous les lots.`

### 8.4 Tirage
Le tirage doit :
- être effectué côté serveur ;
- attribuer un numéro différent à chaque lot ;
- respecter l’ordre des lots ;
- exclure les numéros exclus ;
- être atomique en base de données ;
- créer une ligne dans draw_audits.

Ne pas utiliser `Math.random()`.

Utiliser une source de hasard adaptée côté serveur, par exemple `crypto.randomInt` en Node.js, ou une méthode équivalente.

Pseudo-code :
```ts
function drawRaffle(raffle, prizes, excludedNumbers) {
  if (raffle.status !== "draft") {
    throw new Error("Raffle already drawn")
  }
  const allNumbers = range(raffle.numberMin, raffle.numberMax)
  const excluded = new Set(excludedNumbers)
  const availableNumbers = allNumbers.filter(number => !excluded.has(number))
  if (availableNumbers.length < prizes.length) {
    throw new Error("Not enough available numbers")
  }
  const shuffledNumbers = secureShuffle(availableNumbers)
  const orderedPrizes = prizes.sort((a, b) => a.position - b.position)
  return orderedPrizes.map((prize, index) => ({
    prizeId: prize.id,
    winningNumber: shuffledNumbers[index],
  }))
}
```

### 8.5 Verrouillage
Après tirage :
- les paramètres sont verrouillés ;
- les lots sont verrouillés ;
- les résultats sont verrouillés ;
- aucun bouton de relance n’est disponible.

Après publication :
- aucun retour arrière.

## 9. API / Server actions
Adapter selon la stack du repo.

### 9.1 Créer une tombola
`POST /api/admin/raffles`

Payload :
```json
{
  "title": "string",
  "numberMin": 1,
  "numberMax": 500,
  "showPublicWinners": true,
  "allowNumberLookup": true,
  "excludedNumbers": [13, 42],
  "prizes": [
    {
      "name": "Vélo adulte",
      "description": "string",
      "position": 1
    }
  ]
}
```

Réponse :
```json
{
  "raffleId": "string",
  "publicSlug": "string"
}
```

### 9.2 Mettre à jour une tombola
`PATCH /api/admin/raffles/:raffleId`

Autorisé uniquement si `status = draft`.

### 9.3 Lancer le tirage
`POST /api/admin/raffles/:raffleId/draw`

Règles :
- nécessite admin ;
- autorisé uniquement si status = draft ;
- effectue tout dans une transaction ;
- met à jour les winningNumber des lots ;
- passe la tombola à drawn ;
- remplit drawnAt ;
- crée un draw_audit.

### 9.4 Publier les résultats
`POST /api/admin/raffles/:raffleId/publish`

Règles :
- nécessite admin ;
- autorisé uniquement si status = drawn ;
- passe la tombola à published ;
- remplit publishedAt.

### 9.5 Vérifier un numéro
`GET /api/public/raffles/:publicSlug/check?number=142`

Réponses possibles :
```ts
type CheckNumberResponse =
  | { status: "not_published" }
  | { status: "invalid_number"; message: string }
  | { status: "excluded_number"; message: string }
  | { status: "losing_number"; number: number }
  | {
      status: "winning_number"
      number: number
      prize: {
        name: string
        description: string | null
        position: number
      }
    }
```

### 9.6 Résultats publics
`GET /api/public/raffles/:publicSlug/results`

Réponse :
- si non publié : ne rien retourner sauf statut ;
- si publié et `showPublicWinners = true` : retourner la liste des gagnants ;
- si publié et `showPublicWinners = false` : retourner uniquement les métadonnées publiques.

## 10. Design UI
S’inspirer du design déjà généré :
- interface claire ;
- fond gris très léger ;
- cartes blanches ;
- coins arrondis ;
- ombres légères ;
- couleur primaire bleu/violet ;
- typographie sobre ;
- mobile-first ;
- responsive desktop.

### 10.1 Layout desktop admin
Desktop :
- sidebar gauche ;
- header supérieur ;
- contenu central max-width ;
- cartes pour les sections.

Navigation admin :
- Dashboard
- Tombolas
- Lots
- Résultats
- Paramètres

Pour la V1, seules les routes utiles doivent fonctionner. Les autres entrées peuvent être masquées ou désactivées.

### 10.2 Layout mobile admin
Mobile :
- header avec logo Tombola ;
- bouton menu ;
- contenu en une colonne ;
- bottom nav optionnelle :
  - Tombolas
  - Lots
  - Résultats

### 10.3 Page publique
La page publique doit être très simple :
- aucun besoin de compte ;
- gros champ de recherche par numéro ;
- CTA clair ;
- résultat lisible ;
- liste des gagnants si activée.

## 11. Validation formulaire
### Tombola
**title**
- requis ;
- min 2 caractères ;
- max 120 caractères.

**numberMin**
- requis ;
- entier ;
- >= 0.

**numberMax**
- requis ;
- entier ;
- doit être >= numberMin.

**excludedNumbers**
- entiers uniquement ;
- pas de doublons ;
- doivent être dans la plage.

### Lots
Chaque lot doit avoir :
- un nom requis ;
- une position unique ;
- description optionnelle.

Le tirage est impossible s’il n’y a aucun lot.

## 12. Messages d’erreur
Utiliser des messages simples en français.

Exemples :
- Le nom de la tombola est obligatoire.
- Le numéro maximum doit être supérieur ou égal au numéro minimum.
- Ce numéro est en dehors de la plage définie.
- Il n’y a pas assez de numéros disponibles pour tous les lots.
- Cette tombola a déjà été tirée.
- Les résultats ne sont pas encore publiés.

## 13. Sécurité
- Toutes les actions admin doivent être protégées.
- Les routes publiques ne doivent pas exposer d’informations non publiées.
- Le tirage doit se faire côté serveur.
- Le tirage doit être transactionnel.
- Une tombola tirée ne doit plus être modifiable.
- Une tombola publiée ne doit plus être modifiable.
- Ne jamais faire confiance aux données envoyées par le client.
- Valider toutes les entrées côté serveur.

## 14. Accessibilité
Prévoir :
- labels visibles sur les inputs ;
- focus states ;
- boutons accessibles au clavier ;
- contrastes suffisants ;
- messages d’erreur lisibles ;
- états loading ;
- états disabled explicites.

## 15. États UI à gérer
Pour chaque page :
- loading ;
- empty state ;
- error state ;
- success state.

Pour les actions :
- bouton disabled pendant submit ;
- toast de succès ;
- toast d’erreur ;
- confirmation avant tirage.

## 16. Acceptance criteria
### Création de tombola
- L’admin peut créer une tombola avec un titre, une plage de numéros et des lots.
- L’admin peut ajouter des numéros exclus.
- Le système bloque les numéros exclus hors plage.
- Le système bloque les plages invalides.
- Le système bloque la création sans lot.
- Une tombola créée est en statut draft.

### Tirage
- L’admin peut lancer un tirage uniquement si la tombola est en draft.
- Le tirage attribue un numéro unique à chaque lot.
- Aucun numéro exclu ne peut être tiré.
- Le tirage est impossible s’il y a plus de lots que de numéros disponibles.
- Après tirage, la tombola passe en drawn.
- Après tirage, les paramètres sont verrouillés.
- Une trace est créée dans draw_audits.

### Publication
- L’admin peut publier uniquement une tombola en drawn.
- Après publication, la tombola passe en published.
- La page publique affiche les résultats uniquement après publication.
- Les résultats ne sont plus modifiables après publication.

### Vérification publique
- Un participant peut entrer son numéro.
- Si le numéro gagne, le lot est affiché.
- Si le numéro perd, un message clair est affiché.
- Si le numéro est hors plage, un message clair est affiché.
- Si le numéro est exclu, un message clair est affiché.
- Si la tombola n’est pas publiée, aucun résultat n’est exposé.

### Liste publique des gagnants
- Si `showPublicWinners = true`, la liste des gagnants est visible.
- Si `showPublicWinners = false`, la liste complète est masquée.
- La recherche par numéro reste possible si `allowNumberLookup = true`.

### Responsive
- L’admin est utilisable sur desktop.
- L’admin est utilisable sur mobile.
- La page publique est optimisée mobile.
- La page publique est lisible sur desktop.

## 17. Hors périmètre V1
Ne pas coder en V1 :
- achat de tickets ;
- paiement en ligne ;
- création de tickets par participant ;
- inscription participant ;
- envoi d’email ou SMS ;
- QR code ;
- scan de ticket ;
- multi-tombolas publiques complexes ;
- gestion de plusieurs admins ;
- personnalisation avancée du thème ;
- import CSV ;
- export PDF ;
- analytics ;
- relance de tirage ;
- annulation de publication.

## 18. Données de test
Créer une seed avec :

```json
{
  "title": "Tombola Fête du Village 2025",
  "numberMin": 1,
  "numberMax": 500,
  "excludedNumbers": [13, 42, 101, 256],
  "showPublicWinners": true,
  "allowNumberLookup": true,
  "prizes": [
    {
      "position": 1,
      "name": "Vélo adulte",
      "description": "Vélo tout chemin pour adulte, cadre aluminium."
    },
    {
      "position": 2,
      "name": "Bon d’achat 50 €",
      "description": "Bon d’achat valable dans les commerces partenaires."
    },
    {
      "position": 3,
      "name": "Panier garni",
      "description": "Sélection de produits locaux et artisanaux."
    }
  ]
}
```

## 19. Comportement attendu final
À la fin de l’implémentation, je dois pouvoir :
1. me connecter à l’admin ;
2. créer une tombola ;
3. définir les numéros de 1 à 500 ;
4. exclure quelques numéros ;
5. ajouter 3 lots ;
6. lancer le tirage ;
7. voir les numéros gagnants ;
8. publier les résultats ;
9. ouvrir une URL publique ;
10. entrer un numéro ;
11. savoir si ce numéro a gagné ;
12. consulter la liste des gagnants si l’option est activée.

## 20. Priorité d’implémentation
Ordre conseillé :
1. modèle de données ;
2. seed ;
3. pages admin ;
4. création / édition tombola ;
5. gestion des lots ;
6. logique de tirage serveur ;
7. audit du tirage ;
8. publication ;
9. page publique ;
10. responsive ;
11. polish UI ;
12. tests.

## 21. Tests minimum à ajouter
Ajouter des tests unitaires pour :
- génération du range ;
- exclusion des numéros ;
- impossibilité de tirer plus de lots que de numéros disponibles ;
- unicité des numéros gagnants ;
- absence de numéros exclus dans les résultats ;
- blocage du tirage si statut différent de draft ;
- blocage de la publication si statut différent de drawn.

Ajouter des tests e2e simples pour :
- création d’une tombola ;
- lancement du tirage ;
- publication ;
- vérification d’un numéro gagnant ;
- vérification d’un numéro perdant.

---
Ce document est prêt à être donné à Codex tel quel.
