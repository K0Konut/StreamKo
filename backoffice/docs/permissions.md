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
- `api::series.series.find`
- `api::series.series.findOne`
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
- Les actions `find`/`findOne` sur watchlist/progression doivent etre filtrees par utilisateur.
- Strapi ne gere pas la regle "owner" automatiquement ici : on ajoutera une policy ou un controleur custom.

## Chemin dans l'admin
`Settings` -> `Users & Permissions Plugin` -> `Roles` -> choisir le role -> cocher les permissions.
