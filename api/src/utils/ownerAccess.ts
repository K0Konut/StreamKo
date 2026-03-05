type OwnerLikeUser = {
  id?: number | string;
  email?: string;
};

export const normalizeUserId = (value: unknown): number | null => {
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

export const isOwnerUser = (user: OwnerLikeUser | null | undefined): boolean => {
  if (!user) {
    return false;
  }

  const ownerUserId = normalizeUserId(process.env.OWNER_USER_ID);
  const ownerAdminUserId = normalizeUserId(process.env.OWNER_ADMIN_USER_ID);
  const ownerUserEmail = (process.env.OWNER_USER_EMAIL || '').trim().toLowerCase();

  if (ownerUserId === null && ownerAdminUserId === null && !ownerUserEmail) {
    return false;
  }

  const requesterId = normalizeUserId(user.id);
  if (ownerUserId !== null && requesterId !== null && requesterId === ownerUserId) {
    return true;
  }

  if (ownerAdminUserId !== null && requesterId !== null && requesterId === ownerAdminUserId) {
    return true;
  }

  const requesterEmail = typeof user.email === 'string' ? user.email.trim().toLowerCase() : '';
  if (ownerUserEmail && requesterEmail && requesterEmail === ownerUserEmail) {
    return true;
  }

  return false;
};
