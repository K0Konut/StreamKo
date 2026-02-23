import type { Core } from '@strapi/strapi';

const config = (): Core.Config.Plugin => {
  const uploadMaxFileSizeMb = 8192;
  const uploadMaxFileSizeBytes = uploadMaxFileSizeMb * 1024 * 1024;

  return {
    upload: {
      config: {
        sizeLimit: uploadMaxFileSizeBytes,
        security: {
          allowedTypes: [],
        },
      },
    },
  };
};

export default config;
