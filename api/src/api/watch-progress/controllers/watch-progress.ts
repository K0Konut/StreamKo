/**
 * watch-progress controller
 */

import { factories } from '@strapi/strapi';

const WATCH_PROGRESS_UID = 'api::watch-progress.watch-progress';
const ALLOWED_KINDS = new Set(['movie', 'episode']);

const hasOwn = (value: unknown, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value ?? {}, key);

const normalizeRelationValue = (
  value: unknown,
): string | number | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? normalizeRelationValue(value[0]) : null;
  }

  if (typeof value !== 'object') {
    return undefined;
  }

  const objectValue = value as Record<string, unknown>;

  if ('id' in objectValue) {
    return normalizeRelationValue(objectValue.id);
  }

  if ('documentId' in objectValue) {
    return normalizeRelationValue(objectValue.documentId);
  }

  if ('set' in objectValue) {
    const setValue = objectValue.set;
    if (Array.isArray(setValue) && setValue.length > 0) {
      return normalizeRelationValue(setValue[0]);
    }
    return null;
  }

  if ('connect' in objectValue) {
    const connectValue = objectValue.connect;
    if (Array.isArray(connectValue) && connectValue.length > 0) {
      return normalizeRelationValue(connectValue[0]);
    }

    return normalizeRelationValue(connectValue);
  }

  if ('disconnect' in objectValue) {
    return null;
  }

  return undefined;
};

const hasRelation = (value: unknown): boolean =>
  value !== null && value !== undefined && value !== '';

const isOwner = (ownerValue: unknown, userId: unknown): boolean =>
  String(ownerValue) === String(userId);

const parseEntityId = (id: string | number): string | number => {
  const numericId = Number(id);
  return Number.isNaN(numericId) ? id : numericId;
};

export default factories.createCoreController(
  WATCH_PROGRESS_UID,
  ({ strapi }) => ({
    async find(ctx) {
      const userId = ctx.state.user?.id;
      if (!userId) {
        return ctx.unauthorized('Authentication required');
      }

      const ownerFilter = { user: { id: { $eq: userId } } };

      ctx.query = {
        ...ctx.query,
        filters: ctx.query?.filters
          ? { $and: [ctx.query.filters, ownerFilter] }
          : ownerFilter,
      };

      return super.find(ctx);
    },

    async findOne(ctx) {
      const userId = ctx.state.user?.id;
      if (!userId) {
        return ctx.unauthorized('Authentication required');
      }

      const id = parseEntityId(ctx.params.id);
      const existing = await strapi.db.query(WATCH_PROGRESS_UID).findOne({
        where: { id },
        populate: { user: true },
      });

      if (!existing) {
        return ctx.notFound('Watch progress not found');
      }

      if (!isOwner(normalizeRelationValue(existing.user), userId)) {
        return ctx.forbidden('You cannot access this watch progress');
      }

      return super.findOne(ctx);
    },

    async create(ctx) {
      const userId = ctx.state.user?.id;
      if (!userId) {
        return ctx.unauthorized('Authentication required');
      }

      const body = ctx.request.body ?? {};
      const data = (body as Record<string, unknown>).data as
        | Record<string, unknown>
        | undefined;
      const payload = data ?? {};

      const kind = payload.kind;
      const movie = normalizeRelationValue(payload.movie);
      const episode = normalizeRelationValue(payload.episode);

      if (typeof kind !== 'string' || !ALLOWED_KINDS.has(kind)) {
        return ctx.badRequest('kind must be either "movie" or "episode"');
      }

      if (kind === 'movie' && (!hasRelation(movie) || hasRelation(episode))) {
        return ctx.badRequest(
          'For kind "movie", movie must be set and episode must be empty',
        );
      }

      if (kind === 'episode' && (!hasRelation(episode) || hasRelation(movie))) {
        return ctx.badRequest(
          'For kind "episode", episode must be set and movie must be empty',
        );
      }

      ctx.request.body = {
        ...body,
        data: {
          ...payload,
          user: userId,
        },
      };

      return super.create(ctx);
    },

    async update(ctx) {
      const userId = ctx.state.user?.id;
      if (!userId) {
        return ctx.unauthorized('Authentication required');
      }

      const id = parseEntityId(ctx.params.id);
      const existing = await strapi.db.query(WATCH_PROGRESS_UID).findOne({
        where: { id },
        populate: { user: true, movie: true, episode: true },
      });

      if (!existing) {
        return ctx.notFound('Watch progress not found');
      }

      if (!isOwner(normalizeRelationValue(existing.user), userId)) {
        return ctx.forbidden('You cannot update this watch progress');
      }

      const body = ctx.request.body ?? {};
      const data = (body as Record<string, unknown>).data as
        | Record<string, unknown>
        | undefined;
      const payload = data ?? {};

      const nextKind =
        typeof payload.kind === 'string' ? payload.kind : existing.kind;

      if (!ALLOWED_KINDS.has(nextKind)) {
        return ctx.badRequest('kind must be either "movie" or "episode"');
      }

      const nextMovie = hasOwn(payload, 'movie')
        ? normalizeRelationValue(payload.movie)
        : normalizeRelationValue(existing.movie);

      const nextEpisode = hasOwn(payload, 'episode')
        ? normalizeRelationValue(payload.episode)
        : normalizeRelationValue(existing.episode);

      if (nextKind === 'movie' && (!hasRelation(nextMovie) || hasRelation(nextEpisode))) {
        return ctx.badRequest(
          'For kind "movie", movie must be set and episode must be empty',
        );
      }

      if (nextKind === 'episode' && (!hasRelation(nextEpisode) || hasRelation(nextMovie))) {
        return ctx.badRequest(
          'For kind "episode", episode must be set and movie must be empty',
        );
      }

      ctx.request.body = {
        ...body,
        data: {
          ...payload,
          user: userId,
        },
      };

      return super.update(ctx);
    },

    async delete(ctx) {
      const userId = ctx.state.user?.id;
      if (!userId) {
        return ctx.unauthorized('Authentication required');
      }

      const id = parseEntityId(ctx.params.id);
      const existing = await strapi.db.query(WATCH_PROGRESS_UID).findOne({
        where: { id },
        populate: { user: true },
      });

      if (!existing) {
        return ctx.notFound('Watch progress not found');
      }

      if (!isOwner(normalizeRelationValue(existing.user), userId)) {
        return ctx.forbidden('You cannot delete this watch progress');
      }

      return super.delete(ctx);
    },
  }),
);
