/**
 * movie service
 */

import { factories } from '@strapi/strapi';
import { resolveImdbMovieData } from './imdb';

type ImdbImportInput = {
  imdbId: string;
  publish?: boolean;
  videoId?: number;
};

const normalizeVideoId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }

  return null;
};

export default factories.createCoreService('api::movie.movie', ({ strapi }) => ({
  async importFromImdb(input: ImdbImportInput) {
    const resolvedMovie = await resolveImdbMovieData(strapi, input.imdbId);
    const movieData: Record<string, unknown> = { ...resolvedMovie.movieData };

    const normalizedVideoId = normalizeVideoId(input.videoId);
    if (normalizedVideoId !== null) {
      movieData.video = normalizedVideoId;
    }

    if (input.publish) {
      movieData.publishedAt = new Date().toISOString();
    }

    const existingMovie = await strapi.db.query('api::movie.movie').findOne({
      where: { imdbId: resolvedMovie.movieData.imdbId },
      select: ['id'],
    });

    const updateData: Record<string, unknown> = { ...movieData };
    delete updateData.imdbId;

    const savedMovie = existingMovie
      ? await strapi.db.query('api::movie.movie').update({
          where: { id: existingMovie.id },
          data: updateData,
          select: ['id'],
        })
      : await strapi.db.query('api::movie.movie').create({
          data: movieData,
          select: ['id'],
        });

    const movie = await strapi.db.query('api::movie.movie').findOne({
      where: { id: savedMovie.id },
      populate: {
        poster: true,
        video: true,
        genres: true,
        cast: true,
      },
    });

    return {
      operation: existingMovie ? 'updated' : 'created',
      movie,
      omdb: resolvedMovie.omdb,
    };
  },
}));
