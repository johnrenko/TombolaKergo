# Backend Convex (Tombola)

Ce dossier contient une base backend Convex pour la tombola :

- `schema.ts` : tables `raffles`, `prizes`, `winners`, comptes admin, invitations et journal d’audit.
- `raffles.ts` : création, listing et transitions d'état.
- `prizes.ts` : gestion des lots.
- `winners.ts` : tirage aléatoire et consultation des résultats.
- `auth.ts` : login admin, liens d’invitation limités en nombre de comptes, sessions et historique.

## Démarrage

1. Installer les dépendances : `npm install`
2. Configurer et lancer Convex en développement : `npm run convex:dev`
3. Copier l’URL Convex dans `.env.local` :

```bash
NEXT_PUBLIC_CONVEX_URL="https://..."
```

4. Définir le secret utilisé par le propriétaire pour générer le premier lien d’invitation admin :

```bash
npx convex env set ADMIN_INVITE_SECRET "change-me"
```

5. Générer un lien de création de compte avec ce secret, ou depuis l’écran admin `Invitations` une fois connecté.
6. Lancer l’application Next.js : `npm run dev`

Sans `NEXT_PUBLIC_CONVEX_URL`, l’application affiche un écran de configuration au lieu de charger les pages.
