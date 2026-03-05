/**
 * movie service
 */

import { factories } from '@strapi/strapi';

type ImdbImportInput = {
  imdbId: string;
  publish?: boolean;
  videoId?: number;
};

type OmdbMovieResponse = {
  Response?: string;
  Error?: string;
  Type?: string;
  imdbID?: string;
  Title?: string;
  Year?: string;
  Plot?: string;
  Genre?: string;
  Actors?: string;
};

type HttpError = Error & { status: number };

const createHttpError = (status: number, message: string): HttpError => {
  const error = new Error(message) as HttpError;
  error.status = status;
  return error;
};

const normalizeImdbId = (value: string): string => value.trim();

const parseCommaSeparatedNames = (value: unknown): string[] => {
  if (typeof value !== 'string') {
    return [];
  }

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0 && entry.toUpperCase() !== 'N/A');
};

const parseMovieYear = (value: unknown): number | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const match = value.match(/(\d{4})/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  if (!Number.isFinite(year) || year < 1888) {
    return null;
  }

  return year;
};

const normalizeSynopsis = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }

  const synopsis = value.trim();
  if (!synopsis || synopsis.toUpperCase() === 'N/A') {
    return '';
  }

  return synopsis;
};

const normalizeTitle = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
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
    const apiKey = process.env.OMDB_API_KEY?.trim();
    if (!apiKey) {
      throw createHttpError(500, 'OMDB_API_KEY is missing on the API server.');
    }

    const imdbId = normalizeImdbId(input.imdbId);
    if (!/^tt\d{6,10}$/.test(imdbId)) {
      throw createHttpError(400, 'Invalid imdbId format. Expected something like tt1234567.');
    }

    const omdbUrl = new URL('https://www.omdbapi.com/');
    omdbUrl.searchParams.set('apikey', apiKey);
    omdbUrl.searchParams.set('i', imdbId);
    omdbUrl.searchParams.set('plot', 'full');
    omdbUrl.searchParams.set('type', 'movie');

    const response = await fetch(omdbUrl);
    if (!response.ok) {
      throw createHttpError(502, `OMDb request failed (${response.status}).`);
    }

    const payload = (await response.json()) as OmdbMovieResponse;
    if (payload.Response !== 'True') {
      throw createHttpError(404, payload.Error || 'Movie not found on OMDb.');
    }

    if (payload.Type !== 'movie') {
      throw createHttpError(400, 'The provided imdbId is not a movie.');
    }

    const title = normalizeTitle(payload.Title);
    if (!title) {
      throw createHttpError(400, 'OMDb response is missing title.');
    }

    const year = parseMovieYear(payload.Year);
    if (year === null) {
      throw createHttpError(400, 'OMDb response is missing a valid release year.');
    }

    const genreNames = parseCommaSeparatedNames(payload.Genre);
    const castNames = parseCommaSeparatedNames(payload.Actors);

    const genreIds: number[] = [];
    for (const genreName of genreNames) {
      const existingGenre = await strapi.db.query('api::genre.genre').findOne({
        where: { name: genreName },
        select: ['id'],
      });

      if (existingGenre?.id) {
        genreIds.push(existingGenre.id);
        continue;
      }

      const createdGenre = await strapi.db.query('api::genre.genre').create({
        data: { name: genreName },
        select: ['id'],
      });

      if (createdGenre?.id) {
        genreIds.push(createdGenre.id);
      }
    }

    const castIds: number[] = [];
    for (const castMember of castNames) {
      const existingPerson = await strapi.db.query('api::person.person').findOne({
        where: { name: castMember },
        select: ['id'],
      });

      if (existingPerson?.id) {
        castIds.push(existingPerson.id);
        continue;
      }

      const createdPerson = await strapi.db.query('api::person.person').create({
        data: { name: castMember },
        select: ['id'],
      });

      if (createdPerson?.id) {
        castIds.push(createdPerson.id);
      }
    }

    const movieData: Record<string, unknown> = {
      title,
      imdbId,
      year,
      synopsis: normalizeSynopsis(payload.Plot),
      genres: genreIds,
      cast: castIds,
    };

    const normalizedVideoId = normalizeVideoId(input.videoId);
    if (normalizedVideoId !== null) {
      movieData.video = normalizedVideoId;
    }

    if (input.publish) {
      movieData.publishedAt = new Date().toISOString();
    }

    const existingMovie = await strapi.db.query('api::movie.movie').findOne({
      where: { imdbId },
      select: ['id'],
    });

    const savedMovie = existingMovie
      ? await strapi.db.query('api::movie.movie').update({
          where: { id: existingMovie.id },
          data: movieData,
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
      omdb: {
        imdbId,
        title,
        year,
      },
    };
  },
}));
