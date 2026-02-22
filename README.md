# Streamy — PRD (MVP)

**Objectif**  
Créer une plateforme de streaming privée accessible uniquement à toi et tes amis (comptes gérés par l’admin), permettant de parcourir un catalogue films/séries, lire un film ou un épisode dans un player web, reprendre la lecture via un système de watch progress, et afficher une Home personnalisée (nouveautés + reprendre + pour toi).

**Périmètre**

Inclus (MVP)
- Authentification (login uniquement, pas de signup)
- Gestion des contenus via Strapi (admin)
- Catalogue + filtres de base
- Pages détails (film / série)
- Player (MP4) + reprise de lecture
- Watch progress par utilisateur (films + épisodes)
- Déploiement sous ton domaine (front + api)

Hors scope (pas MVP)
- Recommandations avancées (ML)
- Profils multiples par compte
- Téléchargement offline
- Multi-audio/sous-titres avancés (on pourra ajouter plus tard)
- DRM
- Paiement / abonnement
- Commentaires / notes

**Utilisateurs & rôles**

Admin (toi)
- Crée / supprime des utilisateurs autorisés
- Ajoute / supprime films, séries, épisodes

Utilisateur autorisé
- Se connecte
- Consulte / regarde / reprend
- N’a pas accès à l’admin Strapi

**Parcours utilisateur**

Connexion
- L’utilisateur arrive sur `/login`
- Saisie identifiant (email ou username) + password
- Si OK → redirection `/`
- Sinon → message d’erreur
- Pas de création de compte depuis le front
- Les comptes sont créés/supprimés côté Strapi admin

Home (page d’accueil)
- Sections : Pour toi, Nouveautés, Reprendre
- Pour toi (MVP) : basé sur genres les + regardés / derniers contenus vus
- Nouveautés : tri par `createdAt` ou `publishedAt` desc
- Reprendre : liste des contenus en cours (watch progress non complété)

Catalogue
- Liste films + séries
- Filtres MVP : type (film/série), recherche texte (titre), genre, année (range simple ou exact), tri (récent / A-Z)

Détail (film)
- Affiche : poster/backdrop, titre, année, synopsis, genres, cast
- Bouton principal : Regarder si pas de progress, Reprendre si progress existe et non complété (position > seuil)

Détail (série)
- Même infos que film
- Sélecteur Saison + Episodes
- Bouton principal : Reprendre (dernier épisode/position) si progress existe, sinon Lire épisode (par défaut S1E1)

Player
- Lecture MP4 dans `<video>`
- Sauvegarde du progress automatique
- Reprise : au chargement, seek au timecode sauvegardé
- Fin : marque “completed” si l’utilisateur arrive à la fin

**Exigences fonctionnelles**

Authentification & sécurité
- Connexion via Strapi Users & Permissions (`/auth/local`)
- Stockage JWT côté front (MVP : `localStorage`)
- Routes protégées via router guard (tout sauf `/login`)
- Pas d’accès aux endpoints sans JWT

Gestion contenus (admin)
- Ajout films/séries/épisodes via Strapi
- Upload MP4 via Media Library Strapi
- Chaque film/épisode doit avoir un MP4 associé (ou considéré “non disponible”)

Watch progress
- Stockage par utilisateur et par média (film ou épisode)
- Champs minimum : `positionSeconds`, `completed`, `updatedAt`
- Règles : autosave toutes 5–10 secondes (si lecture en cours), `completed` si fin atteinte (ou > 95% de la durée), “Reprendre” si `positionSeconds` > 30s et non complété

Home personnalisée (MVP)
- Pour toi = derniers contenus consultés + genres fréquents
- Reprendre = watch progress non complétés
- Nouveautés = derniers contenus ajoutés

**Modèle de données (Strapi)**

Content types
- `genre` : name (unique)
- `person` : name, photo (optionnel)
- `movie` : title, slug, year, synopsis, poster (image), video (media: mp4), genres (M2M), cast (M2M), createdAt / publishedAt
- `series` : title, slug, year, synopsis, poster (image), genres (M2M), cast (M2M), seasons (1-N)
- `season` : number, series (N-1), episodes (1-N)
- `episode` : title, number, synopsis (optionnel), video (media: mp4), season (N-1)
- `watch-progress` : user (N-1 vers users-permissions user), kind (enum: movie|episode), movie (N-1 nullable), episode (N-1 nullable), positionSeconds (int), durationSeconds (int optionnel), completed (boolean)

**API (MVP)**

Auth
- `POST /api/auth/local`

Contenus
- `GET /api/movies?populate=poster,genres,cast,video`
- `GET /api/movies/:id?populate=...`
- `GET /api/series?populate=poster,genres,cast,seasons.episodes`
- `GET /api/series/:id?populate=...`
- `GET /api/episodes/:id?populate=video`

Progress
- `GET /api/watch-progresses?filters[user][id][$eq]=<me>&populate=movie,episode`
- `POST /api/watch-progresses`
- `PUT /api/watch-progresses/:id`

Sécurité progress (exigence)
- Un utilisateur ne doit voir/modifier que ses progress.
- MVP : filtre strict côté front + permissions côté Strapi.
- Évolution recommandée : policy / route custom pour forcer user=me.

**Front-end (Vue) — exigences UI**

Design
- Tailwind + DaisyUI
- Layout : Navbar (Home, Catalogue, Logout), cartes média (poster + titre + badge type), rails horizontaux sur Home

Pages
- `/login`
- `/` (home)
- `/catalog`
- `/movie/:id`
- `/series/:id`
- `/player/:kind/:id` (kind = movie|episode)

Composants MVP
- MediaCard
- MediaRail (liste horizontale)
- FilterBar
- EpisodePicker
- ProgressBadge (ex: “reprendre à 12:32”)

**Exigences non-fonctionnelles**

Performance
- Lazy loading pages (import dynamique)
- Pagination catalogue (MVP : 20/40 items par page)
- Images optimisées (thumbnails Strapi)

Compatibilité
- Desktop + mobile
- Navigateur : Chrome/Firefox/Safari récent

Streaming MP4 (contraintes)
- Nécessite support “seek” fiable : serveur doit accepter HTTP Range requests
- À valider sur ton hébergement (Nginx/Apache/CDN)

**Déploiement sous ton domaine (architecture)**

Sous-domaines recommandés
- `app.tondomaine.com` → Front (Vue build)
- `api.tondomaine.com` → Strapi

CORS / sécurité
- CORS Strapi autorise `https://app.tondomaine.com`
- Cookies non requis (JWT localStorage MVP)
- HTTPS obligatoire (Let’s Encrypt)

Stockage média
- MVP : stockage local sur serveur Strapi (uploads)
- Évolution : S3/Cloudflare R2 si besoin de scalabilité

**Critères d’acceptation (MVP)**
- Un utilisateur sans compte ne peut pas accéder à autre chose que `/login`.
- Un utilisateur connecté voit : Home avec “Nouveautés” et “Reprendre” si progress.
- Catalogue affiche films + séries avec filtres de base.
- Détail film : bouton “Regarder” puis après lecture → devient “Reprendre”.
- Player : sauvegarde la progression automatiquement, reprend au bon timecode au retour.
- Série : sélection saison/épisode, progress stocké par épisode.

**Découpage en itérations**

Sprint 1 — “Film end-to-end”
- Strapi : movie + watch-progress + permissions
- Front : login, catalogue films, détail film, player film + progress

Sprint 2 — “Séries + Home”
- Strapi : series/season/episode
- Front : détail série + episode picker + player episode
- Home : nouveautés + reprendre + pour toi (simple)
