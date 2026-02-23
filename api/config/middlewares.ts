import type { Core } from '@strapi/strapi';

const config = (): Core.Config.Middlewares => {
  const uploadMaxFileSizeMb = 8192;
  const uploadMaxFileSizeBytes = uploadMaxFileSizeMb * 1024 * 1024;

  return [
    'strapi::logger',
    'strapi::errors',
    'strapi::security',
    'strapi::cors',
    'strapi::poweredBy',
    'strapi::query',
    {
      name: 'strapi::body',
      config: {
        formLimit: `${uploadMaxFileSizeMb}mb`,
        jsonLimit: '10mb',
        textLimit: '10mb',
        formidable: {
          maxFileSize: uploadMaxFileSizeBytes,
        },
      },
    },
    'strapi::session',
    'strapi::favicon',
    'strapi::public',
  ];
};

export default config;
