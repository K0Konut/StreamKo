import type { Core } from '@strapi/strapi';

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

export type ImdbImportError = Error & { status: number };

export type ResolvedImdbMovie = {
  movieData: {
    imdbId: string;
    title: string;
    year: number;
    synopsis: string;
    genres: number[];
    cast: number[];
  };
  omdb: {
    imdbId: string;
    title: string;
    year: number;
  };
};

export const createHttpError = (status: number, message: string): ImdbImportError => {
  const error = new Error(message) as ImdbImportError;
  error.status = status;
  return error;
};

export const normalizeImdbId = (value: string): string => value.trim();

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

const resolveGenreIds = async (strapi: Core.Strapi, genreNames: string[]): Promise<number[]> => {
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

  return genreIds;
};

const resolveCastIds = async (strapi: Core.Strapi, castNames: string[]): Promise<number[]> => {
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

  return castIds;
};

export const resolveImdbMovieData = async (
  strapi: Core.Strapi,
  rawImdbId: string,
): Promise<ResolvedImdbMovie> => {
  const apiKey = process.env.OMDB_API_KEY?.trim();
  if (!apiKey) {
    throw createHttpError(500, 'OMDB_API_KEY is missing on the API server.');
  }

  const imdbId = normalizeImdbId(rawImdbId);
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
  const [genreIds, castIds] = await Promise.all([
    resolveGenreIds(strapi, genreNames),
    resolveCastIds(strapi, castNames),
  ]);

  return {
    movieData: {
      imdbId,
      title,
      year,
      synopsis: normalizeSynopsis(payload.Plot),
      genres: genreIds,
      cast: castIds,
    },
    omdb: {
      imdbId,
      title,
      year,
    },
  };
};
