import type { Core } from '@strapi/strapi';

type RequestUser = {
  id?: number | string;
  email?: string;
};

const normalizeId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }

  return null;
};

type OwnerPolicyContext = Core.PolicyContext & {
  state?: {
    user?: RequestUser | null;
  };
};

export default (policyContext: OwnerPolicyContext, _config: unknown, { strapi }: { strapi: Core.Strapi }) => {
  const user = (policyContext.state?.user ?? null) as RequestUser | null;
  if (!user) {
    return false;
  }

  const ownerUserId = normalizeId(process.env.OWNER_USER_ID);
  const ownerUserEmail = (process.env.OWNER_USER_EMAIL || '').trim().toLowerCase();

  if (ownerUserId === null && !ownerUserEmail) {
    strapi.log.warn(
      '[owner-only] OWNER_USER_ID / OWNER_USER_EMAIL is not configured. Blocking protected endpoint.',
    );
    return false;
  }

  const requesterId = normalizeId(user.id);
  if (ownerUserId !== null && requesterId !== null && requesterId === ownerUserId) {
    return true;
  }

  const requesterEmail = typeof user.email === 'string' ? user.email.trim().toLowerCase() : '';
  if (ownerUserEmail && requesterEmail && requesterEmail === ownerUserEmail) {
    return true;
  }

  return false;
};
