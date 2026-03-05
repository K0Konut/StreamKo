import type { Core } from '@strapi/strapi';
import { isOwnerUser } from '../utils/ownerAccess';

type RequestUser = {
  id?: number | string;
  email?: string;
};

type OwnerPolicyContext = Core.PolicyContext & {
  state?: {
    user?: RequestUser | null;
  };
};

export default (policyContext: OwnerPolicyContext, _config: unknown, { strapi }: { strapi: Core.Strapi }) => {
  const user = (policyContext.state?.user ?? null) as RequestUser | null;
  if (!process.env.OWNER_USER_ID && !process.env.OWNER_ADMIN_USER_ID && !process.env.OWNER_USER_EMAIL) {
    strapi.log.warn(
      '[owner-only] OWNER_USER_ID / OWNER_ADMIN_USER_ID / OWNER_USER_EMAIL is not configured. Blocking protected endpoint.',
    );
    return false;
  }

  return isOwnerUser(user);
};
