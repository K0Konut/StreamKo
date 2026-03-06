# Deploy Docker (VM unique + NPM)

Ce projet est prévu pour tourner sur ta VM Docker unique avec `nginx-proxy-manager` comme unique point d'entree.

## 1) Prerequis (une fois)

```bash
docker network create npm 2>/dev/null || true
```

## 2) Variables front + compose

A la racine du projet, creer `.env.production` :

```bash
cp .env.production.example .env.production
```

Par defaut :

```env
VITE_API_URL=https://api.costamask.dev
```

Obligatoire pour la prod : binder les uploads Strapi sur le HDD monte de la VM.

Exemple a ajouter dans `.env.production` :

```env
STREAMKO_API_UPLOADS_PATH=/mnt/hdd5to/streamko/uploads
# optionnel (si tu veux aussi sortir SQLite de la VM)
STREAMKO_API_DATA_PATH=/mnt/hdd5to/streamko/api-data
```

Puis creer les dossiers :

```bash
mkdir -p /mnt/hdd5to/streamko/api-data /mnt/hdd5to/streamko/uploads
```

## 3) Variables Strapi

Dans `api/.env`, configure des secrets de prod (ne jamais commiter) :

- `APP_KEYS` (4 cles, separees par virgule)
- `API_TOKEN_SALT`
- `ADMIN_JWT_SECRET`
- `TRANSFER_TOKEN_SALT`
- `JWT_SECRET`
- `ENCRYPTION_KEY`
- `HLS_TRANSCODE_ENABLED=true` (optionnel, laisse active la conversion auto MP4 -> HLS)
- `OMDB_API_KEY=<ta-cle>` (optionnel, active l'import metadata via IMDb/OMDb)
- `OWNER_USER_ID=<id>` ou `OWNER_ADMIN_USER_ID=<id>` ou `OWNER_USER_EMAIL=<email>` (recommande, limite l'import IMDb au proprietaire)

La conversion HLS utilise `ffmpeg`/`ffprobe` (installes dans l'image `api/Dockerfile`).
Attention: les premieres conversions peuvent consommer du CPU apres upload.

La stack force SQLite avec stockage persistant :

- `DATABASE_CLIENT=sqlite`
- `DATABASE_FILENAME=/opt/app/.tmp/data.db` (override via compose)

`docker-compose.prod.yml` impose `STREAMKO_API_UPLOADS_PATH` (fail fast si non defini),
pour eviter que les videos partent sur le disque de la VM.
`STREAMKO_API_DATA_PATH` reste optionnel (volume nomme par defaut).

## 4) Build + run

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
```

## 5) Config Nginx Proxy Manager

Creer 2 Proxy Hosts :

1. `app.costamask.dev`
- Scheme: `http`
- Forward Hostname/IP: `streamko-web`
- Forward Port: `80`
- SSL: Let's Encrypt + Force SSL

2. `api.costamask.dev`
- Scheme: `http`
- Forward Hostname/IP: `streamko-api`
- Forward Port: `1337`
- SSL: Let's Encrypt + Force SSL
- Advanced (Custom Nginx Configuration):

```nginx
client_max_body_size 10G;
proxy_request_buffering off;
proxy_read_timeout 3600s;
proxy_send_timeout 3600s;
```

Les conteneurs sont deja sur le reseau externe `npm`, donc NPM peut les joindre par nom.

## 6) Cloudflare (important pour upload)

Pour `api.costamask.dev`, mets le record en **DNS only** (nuage gris), sinon Cloudflare peut bloquer les gros uploads.

## 7) Mise a jour

```bash
git pull
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

## 8) Logs utiles

```bash
docker compose -f docker-compose.prod.yml logs -f streamko-api
docker compose -f docker-compose.prod.yml logs -f streamko-web
```

## 9) Compat HLS (master.m3u8 auto)

Si certains dossiers HLS contiennent des playlists variantes (ex: `720p.m3u8`, `480p.m3u8`)
mais pas `master.m3u8`, tu peux activer une sync automatique.

Le repo contient:

- `deploy/scripts/streamko-master-sync.sh`

Installation sur la VM:

```bash
cd /srv/docker/Projects/StreamKo
chmod +x deploy/scripts/streamko-master-sync.sh
sudo ln -sf /srv/docker/Projects/StreamKo/deploy/scripts/streamko-master-sync.sh /usr/local/bin/streamko-master-sync.sh
sudo /usr/local/bin/streamko-master-sync.sh /mnt/media/streamko/uploads/hls
```

Cron (toutes les minutes):

```bash
( sudo crontab -l 2>/dev/null | grep -v 'streamko-master-sync.sh' ; echo '* * * * * /usr/local/bin/streamko-master-sync.sh /mnt/media/streamko/uploads/hls >/dev/null 2>&1' ) | sudo crontab -
```
