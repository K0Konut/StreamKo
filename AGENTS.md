## Resume
StreamKo est un site de streaming prive pour un cercle d'utilisateurs.
Deux parties principales :
- Frontend Vue 3 + Vite dans la racine du repo.
- Backoffice Strapi 5 dans `backoffice` (admin + API).
Style attendu : interface "premium" (sobre, elegante, finitions propres).

## Environnement
- Node.js `>=20` (contrainte Strapi)
- npm

## Commandes utiles
Frontend
```
npm install
npm run dev
npm run build
```

Backoffice
```
cd backoffice
npm install
npm run develop
npm run build
```

## Base de donnees
Par defaut, Strapi utilise SQLite avec le fichier `backoffice/.tmp/data.db`.
Variables d'environnement definies dans `backoffice/config/database.ts`.

## Permissions
Documentation : `backoffice/docs/permissions.md`.

## Arborescence
- `src` : app Vue (SFC TypeScript)
- `backoffice/src` : logique Strapi (content-types, api, etc.)

## Workflow Git
- `main` = versions stables
- `dev` = integration continue
- Une branche par feature : `feature/<nom>` (commits sur cette branche)
- Merge de la feature vers `dev`
- Merge de `dev` vers `main` uniquement pour les releases

## Deploiement (homelab costamask.dev)
Contexte :
- VM Debian 12 (Docker) : `192.168.1.89`
- Reverse proxy : Nginx Proxy Manager (NPM)
- Ports publics : uniquement `80/443` sur NPM

Regles :
- Ne pas exposer de ports des apps (pas de `ports:` dans `docker-compose.yml`).
- Attacher les conteneurs applicatifs au reseau Docker externe `npm`.
- Dossier projet recommande : `/srv/docker/projects/streamko/`.
- Les certifs TLS sont geres par NPM (Let's Encrypt).

DNS :
- Domaine `costamask.dev` gere par Cloudflare
- Sous-domaines pointent vers l'IP publique via DDNS Cloudflare

## Notes pour les agents
- Eviter de modifier `backoffice/node_modules` et `node_modules`.
- Preferer des changements petits et traces.
- Si vous ajoutez une config ou un script, documentez-le dans `README.md`.
