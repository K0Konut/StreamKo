import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Server => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  http: {
    serverOptions: {
      requestTimeout: env.int('UPLOAD_REQUEST_TIMEOUT_MS', 30 * 60 * 1000),
    },
  },
  app: {
    keys: env.array('APP_KEYS'),
  },
});

export default config;
