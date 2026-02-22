import type { Core } from '@strapi/strapi';

type PermissionAction = {
  enabled: boolean;
  policy: string;
};

type PermissionTree = Record<
  string,
  {
    controllers: Record<string, Record<string, PermissionAction>>;
  }
>;

const AUTHENTICATED_ALLOWED_ACTIONS = [
  'plugin::users-permissions.auth.changePassword',
  'plugin::users-permissions.auth.logout',
  'plugin::users-permissions.user.me',
  'plugin::upload.content-api.find',
  'plugin::upload.content-api.findOne',
  'api::genre.genre.find',
  'api::genre.genre.findOne',
  'api::person.person.find',
  'api::person.person.findOne',
  'api::movie.movie.find',
  'api::movie.movie.findOne',
  'api::serie.serie.find',
  'api::serie.serie.findOne',
  'api::season.season.find',
  'api::season.season.findOne',
  'api::episode.episode.find',
  'api::episode.episode.findOne',
  'api::watch-progress.watch-progress.find',
  'api::watch-progress.watch-progress.findOne',
  'api::watch-progress.watch-progress.create',
  'api::watch-progress.watch-progress.update',
  'api::watch-progress.watch-progress.delete',
];

const PUBLIC_ALLOWED_ACTIONS = ['plugin::users-permissions.auth.callback'];

const parsePermissionAction = (action: string): [string, string, string] | null => {
  const match = action.match(/^((?:api|plugin)::[^.]+)\.([^.]+)\.([^.]+)$/);

  if (!match) {
    return null;
  }

  return [match[1], match[2], match[3]];
};

const disableAllActions = (permissions: PermissionTree) => {
  for (const typePermissions of Object.values(permissions)) {
    for (const controllerPermissions of Object.values(typePermissions.controllers ?? {})) {
      for (const actionPermission of Object.values(controllerPermissions ?? {})) {
        actionPermission.enabled = false;
      }
    }
  }
};

const enableAction = (permissions: PermissionTree, action: string): boolean => {
  const parsed = parsePermissionAction(action);

  if (!parsed) {
    return false;
  }

  const [type, controller, actionName] = parsed;
  const actionConfig = permissions[type]?.controllers?.[controller]?.[actionName];

  if (!actionConfig) {
    return false;
  }

  actionConfig.enabled = true;
  return true;
};

const syncRolePermissions = async (
  strapi: Core.Strapi,
  roleType: 'authenticated' | 'public',
  allowedActions: string[],
) => {
  const roleService = strapi.plugin('users-permissions').service('role');
  const roleRecord = await strapi.db.query('plugin::users-permissions.role').findOne({
    where: { type: roleType },
  });

  if (!roleRecord) {
    strapi.log.warn(`[permissions] Role "${roleType}" not found. Skipping permissions sync.`);
    return;
  }

  const role = await roleService.findOne(roleRecord.id);
  const permissions = role.permissions as PermissionTree;
  const unknownActions: string[] = [];

  disableAllActions(permissions);

  for (const action of allowedActions) {
    const enabled = enableAction(permissions, action);

    if (!enabled) {
      unknownActions.push(action);
    }
  }

  await roleService.updateRole(role.id, {
    name: role.name,
    description: role.description,
    permissions,
  });

  if (unknownActions.length > 0) {
    strapi.log.warn(
      `[permissions] Unknown actions for "${roleType}": ${unknownActions.join(', ')}`,
    );
  }

  strapi.log.info(
    `[permissions] Role "${roleType}" synchronized (${allowedActions.length - unknownActions.length}/${allowedActions.length} actions).`,
  );
};

export default {
  register() {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await syncRolePermissions(strapi, 'authenticated', AUTHENTICATED_ALLOWED_ACTIONS);
    await syncRolePermissions(strapi, 'public', PUBLIC_ALLOWED_ACTIONS);
  },
};
