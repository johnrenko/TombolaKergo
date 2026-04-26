# Backend Convex (Tombola)

Ce dossier contient une base backend Convex pour la tombola :

- `schema.ts` : tables `raffles`, `prizes`, `winners`.
- `raffles.ts` : création, listing et transitions d'état.
- `prizes.ts` : gestion des lots.
- `winners.ts` : tirage aléatoire et consultation des résultats.

## Démarrage

1. Installer les dépendances : `npm install`
2. Lancer Convex en développement : `npm run dev`
