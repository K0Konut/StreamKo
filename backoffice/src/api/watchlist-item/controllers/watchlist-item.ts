import { factories } from '@strapi/strapi';

const getOwnerId = (entity: any) => {
  const user = entity?.user;
  if (!user) return null;
  return typeof user === 'object' ? user.id : user;
};

const validatePayload = (data: any, ctx: any) => {
  const itemType = data?.itemType;
  const movie = data?.movie;
  const series = data?.series;

  if (!itemType) {
    return ctx.badRequest('itemType is required');
  }

  if (movie && series) {
    return ctx.badRequest('Only one of movie or series must be set');
  }

  if (itemType === 'movie' && !movie) {
    return ctx.badRequest('movie is required when itemType=movie');
  }

  if (itemType === 'series' && !series) {
    return ctx.badRequest('series is required when itemType=series');
  }

  return null;
};

export default factories.createCoreController('api::watchlist-item.watchlist-item', ({ strapi }) => ({
  async find(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized();
    }

    ctx.query = {
      ...ctx.query,
      filters: {
        ...(ctx.query?.filters || {}),
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
      'api::watchlist-item.watchlist-item',
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
      'api::watchlist-item.watchlist-item',
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
      'api::watchlist-item.watchlist-item',
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
