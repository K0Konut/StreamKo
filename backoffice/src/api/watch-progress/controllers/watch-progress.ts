import { factories } from '@strapi/strapi';

const getOwnerId = (entity: any) => {
  const user = entity?.user;
  if (!user) return null;
  return typeof user === 'object' ? user.id : user;
};

const validatePayload = (data: any, ctx: any) => {
  const itemType = data?.itemType;
  const movie = data?.movie;
  const episode = data?.episode;

  if (!itemType) {
    return ctx.badRequest('itemType is required');
  }

  if (movie && episode) {
    return ctx.badRequest('Only one of movie or episode must be set');
  }

  if (itemType === 'movie' && !movie) {
    return ctx.badRequest('movie is required when itemType=movie');
  }

  if (itemType === 'episode' && !episode) {
    return ctx.badRequest('episode is required when itemType=episode');
  }

  return null;
};

export default factories.createCoreController('api::watch-progress.watch-progress', ({ strapi }) => ({
  async find(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized();
    }

    const existingFilters =
      typeof ctx.query?.filters === 'object' && ctx.query?.filters !== null
        ? ctx.query.filters
        : {};

    ctx.query = {
      ...ctx.query,
      filters: {
        ...existingFilters,
        user: user.id,
      },
    };

    return await super.find(ctx);
  },

  async findOne(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized();
    }

    const entity = await strapi.entityService.findOne(
      'api::watch-progress.watch-progress',
      ctx.params.id,
      { populate: ['user'] }
    );

    if (!entity) {
      return ctx.notFound();
    }

    if (getOwnerId(entity) !== user.id) {
      return ctx.forbidden();
    }

    return await super.findOne(ctx);
  },

  async create(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized();
    }

    const data = ctx.request?.body?.data || {};
    const error = validatePayload(data, ctx);
    if (error) return error;

    ctx.request.body = {
      ...(ctx.request.body || {}),
      data: {
        ...data,
        user: user.id,
      },
    };

    return await super.create(ctx);
  },

  async update(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized();
    }

    const entity = await strapi.entityService.findOne(
      'api::watch-progress.watch-progress',
      ctx.params.id,
      { populate: ['user'] }
    );

    if (!entity) {
      return ctx.notFound();
    }

    if (getOwnerId(entity) !== user.id) {
      return ctx.forbidden();
    }

    const data = ctx.request?.body?.data || {};
    const error = validatePayload(data, ctx);
    if (error) return error;

    ctx.request.body = {
      ...(ctx.request.body || {}),
      data: {
        ...data,
        user: user.id,
      },
    };

    return await super.update(ctx);
  },

  async delete(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized();
    }

    const entity = await strapi.entityService.findOne(
      'api::watch-progress.watch-progress',
      ctx.params.id,
      { populate: ['user'] }
    );

    if (!entity) {
      return ctx.notFound();
    }

    if (getOwnerId(entity) !== user.id) {
      return ctx.forbidden();
    }

    return await super.delete(ctx);
  },
}));
