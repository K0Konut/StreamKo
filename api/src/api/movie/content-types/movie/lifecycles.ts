import type { Core } from '@strapi/strapi';
import { resolveImdbMovieData } from '../../services/imdb';
import { isOwnerUser } from '../../../../utils/ownerAccess';

type LifecycleEvent = {
  params?: {
    data?: Record<string, unknown>;
  };
};

const asString = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim();
  }

  return '';
};

const getImdbIdFromPayload = (event: LifecycleEvent): string => {
  return asString(event.params?.data?.imdbId);
};

const payloadAlreadyHasResolvedImdbData = (event: LifecycleEvent): boolean => {
  const data = event.params?.data;
  if (!data) {
    return false;
  }

  const title = asString(data.title);
  const year = typeof data.year === 'number' ? data.year : Number(data.year);
  const hasGenres = Array.isArray(data.genres);
  const hasCast = Array.isArray(data.cast);

  return Boolean(title) && Number.isFinite(year) && year >= 1888 && hasGenres && hasCast;
};

const isOwnerRequest = (strapi: Core.Strapi): boolean => {
  const requestContext = strapi.requestContext.get();
  const user = requestContext?.state?.user as { id?: number | string; email?: string } | undefined;
  return isOwnerUser(user);
};

const applyImdbDataToPayload = async (strapi: Core.Strapi, event: LifecycleEvent): Promise<void> => {
  const imdbId = getImdbIdFromPayload(event);
  if (!imdbId) {
    return;
  }

  if (payloadAlreadyHasResolvedImdbData(event)) {
    return;
  }

  if (!isOwnerRequest(strapi)) {
    return;
  }

  const resolved = await resolveImdbMovieData(strapi, imdbId);
  event.params = event.params || {};
  event.params.data = event.params.data || {};
  Object.assign(event.params.data, resolved.movieData);
};

export default {
  async beforeCreate(event: LifecycleEvent) {
    const strapi = (globalThis as { strapi: Core.Strapi }).strapi;
    await applyImdbDataToPayload(strapi, event);
  },

  async beforeUpdate(event: LifecycleEvent) {
    const strapi = (globalThis as { strapi: Core.Strapi }).strapi;
    await applyImdbDataToPayload(strapi, event);
  },
};
