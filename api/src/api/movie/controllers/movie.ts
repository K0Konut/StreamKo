/**
 * movie controller
 */

import { factories } from '@strapi/strapi';

type MovieImportBody = {
  imdbId?: unknown;
  publish?: unknown;
  videoId?: unknown;
};

type MovieServiceWithImport = {
  importFromImdb: (input: {
    imdbId: string;
    publish?: boolean;
    videoId?: number;
  }) => Promise<unknown>;
};

const toOptionalPositiveNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }

  return undefined;
};

export default factories.createCoreController('api::movie.movie', ({ strapi }) => ({
  async importFromImdb(ctx) {
    const body = (ctx.request.body ?? {}) as MovieImportBody;
    const imdbId = typeof body.imdbId === 'string' ? body.imdbId.trim() : '';
    const publish = body.publish === true;
    const videoId = toOptionalPositiveNumber(body.videoId);

    if (!imdbId) {
      return ctx.badRequest('imdbId is required.');
    }

    const movieService = strapi.service('api::movie.movie') as unknown as MovieServiceWithImport;

    try {
      const result = await movieService.importFromImdb({
        imdbId,
        publish,
        videoId,
      });

      ctx.body = { data: result };
    } catch (error) {
      const statusCode =
        typeof (error as { status?: unknown })?.status === 'number'
          ? Number((error as { status: number }).status)
          : 500;
      const message = error instanceof Error ? error.message : 'Failed to import movie from IMDb.';

      if (statusCode >= 400 && statusCode < 500) {
        return ctx.badRequest(message);
      }

      strapi.log.error(`[imdb] ${message}`);
      return ctx.internalServerError(message);
    }
  },
}));
