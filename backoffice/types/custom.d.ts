import type { Schema } from '@strapi/strapi';

declare module '@strapi/strapi' {
  export module Public {
    export interface ContentTypeSchemas {
      'api::movie.movie': Schema.CollectionTypeSchema;
      'api::serie.serie': Schema.CollectionTypeSchema;
      'api::season.season': Schema.CollectionTypeSchema;
      'api::episode.episode': Schema.CollectionTypeSchema;
      'api::watch-progress.watch-progress': Schema.CollectionTypeSchema;
      'api::watchlist-item.watchlist-item': Schema.CollectionTypeSchema;
    }
  }
}
