# Deploy Docker (VM unique + NPM)

Ce projet est prévu pour tourner sur ta VM Docker unique avec `nginx-proxy-manager` comme unique point d'entree.

## 1) Prerequis (une fois)

```bash
docker network create npm 2>/dev/null || true
```

## 2) Variables front

A la racine du projet, creer `.env.production` :

```bash
cp .env.production.example .env.production
```

Par defaut :

```env
VITE_API_URL=https://api.costamask.dev
```

## 3) Variables Strapi

Dans `api/.env`, configure des secrets de prod (ne jamais commiter) :

- `APP_KEYS` (4 cles, separees par virgule)
- `API_TOKEN_SALT`
- `ADMIN_JWT_SECRET`
- `TRANSFER_TOKEN_SALT`
- `JWT_SECRET`
- `ENCRYPTION_KEY`

La stack force SQLite avec volume persistant :

- `DATABASE_CLIENT=sqlite`
- `DATABASE_FILENAME=/opt/app/.tmp/data.db` (override via compose)

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
