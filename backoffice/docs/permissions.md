# Permissions Strapi (configuration manuelle)

Objectif : acces prive au site (login obligatoire) et autorisations minimales.

## Roles
### Public
Autoriser uniquement la connexion :
- `plugin::users-permissions.auth.callback`

Optionnel (si besoin) :
- `plugin::users-permissions.auth.forgotPassword`
- `plugin::users-permissions.auth.resetPassword`

### Authenticated
Lecture catalogue :
- `api::movie.movie.find`
- `api::movie.movie.findOne`
- `api::serie.serie.find`
- `api::serie.serie.findOne`
- `api::season.season.find`
- `api::episode.episode.find`
- `api::episode.episode.findOne`

Watchlist & progression :
- `api::watchlist-item.watchlist-item.find`
- `api::watchlist-item.watchlist-item.findOne`
- `api::watchlist-item.watchlist-item.create`
- `api::watchlist-item.watchlist-item.update`
- `api::watchlist-item.watchlist-item.delete`
- `api::watch-progress.watch-progress.find`
- `api::watch-progress.watch-progress.findOne`
- `api::watch-progress.watch-progress.create`
- `api::watch-progress.watch-progress.update`
- `api::watch-progress.watch-progress.delete`

Profil utilisateur :
- `plugin::users-permissions.user.me`

## Notes importantes
- Les actions `find`/`findOne` sur watchlist/progression sont filtrees par utilisateur via controleur custom.
- Les operations `create/update/delete` forcent `user` a l'utilisateur connecte (owner-only).

## Chemin dans l'admin
`Settings` -> `Users & Permissions Plugin` -> `Roles` -> choisir le role -> cocher les permissions.
