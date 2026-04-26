# Backend Convex (Tombola)

Ce dossier contient une base backend Convex pour la tombola :

- `schema.ts` : tables `raffles`, `prizes`, `winners`.
- `raffles.ts` : création, listing et transitions d'état.
- `prizes.ts` : gestion des lots.
- `winners.ts` : tirage aléatoire et consultation des résultats.

## Démarrage

1. Installer les dépendances : `npm install`
2. Configurer et lancer Convex en développement : `npm run convex:dev`
3. Copier l’URL Convex dans `.env.local` :

```bash
NEXT_PUBLIC_CONVEX_URL="https://..."
```

4. Définir le mot de passe admin côté Convex :

```bash
npx convex env set ADMIN_PASSWORD "change-me"
```

5. Lancer l’application Next.js : `npm run dev`

Sans `NEXT_PUBLIC_CONVEX_URL`, l’application affiche un écran de configuration au lieu de charger les pages.
