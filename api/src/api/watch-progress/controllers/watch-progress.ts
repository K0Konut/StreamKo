/**
 * watch-progress controller
 */

import { factories } from '@strapi/strapi';

const WATCH_PROGRESS_UID = 'api::watch-progress.watch-progress';
const ALLOWED_KINDS = new Set(['movie', 'episode']);
const DEFAULT_LIST_META = {
  pagination: {
    page: 1,
    pageSize: 0,
    pageCount: 0,
    total: 0,
  },
};

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

const asPayload = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
};

export default factories.createCoreController(
  WATCH_PROGRESS_UID,
  ({ strapi }) => ({
    async find(ctx) {
      const userId = ctx.state.user?.id;
      if (!userId) {
        return ctx.unauthorized('Authentication required');
      }

      await this.validateQuery(ctx);
      const sanitizedQuery = await this.sanitizeQuery(ctx);
      const ownerFilter = { user: { id: { $eq: userId } } };
      const queryFilters = (sanitizedQuery as Record<string, unknown>).filters;
      const query = {
        ...(sanitizedQuery as Record<string, unknown>),
        filters: queryFilters ? { $and: [queryFilters, ownerFilter] } : ownerFilter,
      };

      const result = await strapi.service(WATCH_PROGRESS_UID).find(query);
      const results = Array.isArray(result?.results) ? result.results : [];
      const sanitizedResults = await this.sanitizeOutput(results, ctx);
      const pagination =
        result && typeof result === 'object' && 'pagination' in result
          ? (result as { pagination?: object }).pagination ?? DEFAULT_LIST_META.pagination
          : DEFAULT_LIST_META.pagination;

      return this.transformResponse(sanitizedResults, { pagination });
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

      await this.validateQuery(ctx);
      const sanitizedQuery = await this.sanitizeQuery(ctx);
      const docId = String(
        normalizeRelationValue((existing as Record<string, unknown>).documentId) ?? id,
      );
      const entity = await strapi
        .service(WATCH_PROGRESS_UID)
        .findOne(docId, sanitizedQuery as Record<string, unknown>);

      if (!entity) {
        return ctx.notFound('Watch progress not found');
      }

      const sanitizedEntity = await this.sanitizeOutput(entity, ctx);
      return this.transformResponse(sanitizedEntity);
    },

    async create(ctx) {
      const userId = ctx.state.user?.id;
      if (!userId) {
        return ctx.unauthorized('Authentication required');
      }

      const body = ctx.request.body ?? {};
      const payload = asPayload((body as Record<string, unknown>).data);

      await this.validateInput(payload, ctx);
      const sanitizedPayload = (await this.sanitizeInput(payload, ctx)) as Record<
        string,
        unknown
      >;

      const kind = sanitizedPayload.kind;
      const movie = normalizeRelationValue(sanitizedPayload.movie);
      const episode = normalizeRelationValue(sanitizedPayload.episode);

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

      const created = await strapi.db.query(WATCH_PROGRESS_UID).create({
        data: {
          ...sanitizedPayload,
          user: userId,
        },
      });

      const sanitizedEntity = await this.sanitizeOutput(created, ctx);
      ctx.status = 201;
      return this.transformResponse(sanitizedEntity);
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
      const payload = asPayload((body as Record<string, unknown>).data);

      await this.validateInput(payload, ctx);
      const sanitizedPayload = (await this.sanitizeInput(payload, ctx)) as Record<
        string,
        unknown
      >;

      const nextKind =
        typeof sanitizedPayload.kind === 'string' ? sanitizedPayload.kind : existing.kind;

      if (!ALLOWED_KINDS.has(nextKind)) {
        return ctx.badRequest('kind must be either "movie" or "episode"');
      }

      const nextMovie = hasOwn(sanitizedPayload, 'movie')
        ? normalizeRelationValue(sanitizedPayload.movie)
        : normalizeRelationValue(existing.movie);

      const nextEpisode = hasOwn(sanitizedPayload, 'episode')
        ? normalizeRelationValue(sanitizedPayload.episode)
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

      const updated = await strapi.db.query(WATCH_PROGRESS_UID).update({
        where: { id },
        data: {
          ...sanitizedPayload,
          user: userId,
        },
      });

      if (!updated) {
        return ctx.notFound('Watch progress not found');
      }

      const sanitizedEntity = await this.sanitizeOutput(updated, ctx);
      return this.transformResponse(sanitizedEntity);
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
