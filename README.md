# StreamKo

Site de streaming prive pour moi et mon entourage, avec un front Vue 3 + Vite et un backoffice Strapi (API/CMS).

## Fonctionnalites
- Connexion par `username` et `password` (comptes crees par l'admin)
- Catalogue films et series
- Recherche et filtres
- Liste personnelle (ajouter/enlever films et series)
- Lecture video
- Reprise de lecture films/series (sauvegarde de la progression)
- Reprise de series a l'episode et au timecode ou je me suis arrete

## Style
- Interface "premium" (sobre, elegante, finitions propres)

## Backoffice
- Ajout/gestion des films et series
- Ajout/gestion des videos associees
- Gestion des comptes utilisateurs

## Modele de donnees (proposition)
- `User` : `username`, `password_hash`, `role`
- `Movie` : `title`, `synopsis`, `genres`, `duration`, `releaseDate`, `poster`, `video`
- `Series` : `title`, `synopsis`, `genres`, `poster`
- `Season` : `number`, `series`
- `Episode` : `number`, `title`, `synopsis`, `duration`, `series`, `season`, `video`
- `Video` : `file`, `quality`, `language`, `subtitles`
- `WatchProgress` : `user`, `itemType` (`movie`|`episode`), `item`, `positionSeconds`, `completed`
- `WatchlistItem` : `user`, `itemType` (`movie`|`series`), `item`, `createdAt`

## Prerequis
- Node.js `>=20` (requis par Strapi)
- npm

## Demarrage rapide
### Frontend (Vue)
```
npm install
npm run dev
```

### Backoffice (Strapi)
```
cd backoffice
npm install
npm run develop
```

## Structure
- `src` : application frontend Vue 3
- `backoffice` : Strapi (admin + API)

## Build
### Frontend
```
npm run build
```

### Backoffice
```
cd backoffice
npm run build
```

## Configuration
Par defaut, Strapi utilise SQLite avec le fichier `backoffice/.tmp/data.db`.
Les variables d'environnement principales se trouvent dans `backoffice/config/database.ts`.

## Deploiement (homelab costamask.dev)
Architecture cible : VM Debian 12 avec Docker, reverse proxy via Nginx Proxy Manager (NPM).
- Les apps ne doivent pas exposer de ports publiquement. Seul NPM expose `80/443`.
- Les conteneurs applicatifs doivent etre relies au reseau Docker externe `npm`.
- Chemin recommande pour les projets : `/srv/docker/projects/streamko/`.

Contraintes reseau :
- IP publique : `86.247.79.251`
- NAT/PAT Livebox : `80/443` vers `192.168.1.89`
- NPM admin local : `http://192.168.1.89:81`

DNS :
- Domaine : `costamask.dev` (Cloudflare)
- Les sous-domaines pointent vers l'IP publique via DDNS Cloudflare

## A completer
- Routes API et contrats frontend
- Environnements (dev/staging/prod)

## Workflow Git
- `main` = versions stables
- `dev` = integration continue
- Une branche par feature : `feature/<nom>` (commits sur cette branche)
- Merge de la feature vers `dev`
- Merge de `dev` vers `main` uniquement pour les releases
