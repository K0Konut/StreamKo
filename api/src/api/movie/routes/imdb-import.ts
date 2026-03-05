export default {
  routes: [
    {
      method: 'POST',
      path: '/movies/import-imdb',
      handler: 'movie.importFromImdb',
      config: {
        policies: ['global::owner-only'],
      },
    },
  ],
};
