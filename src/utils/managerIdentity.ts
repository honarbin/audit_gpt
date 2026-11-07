/**
 * Single source of truth for an office manager's personal identity.
 *
 * Personal data (full name, national id, mobile, e-mail, username) lives ONLY in the
 * users table (role OFFICE_USER). The office-manager record keeps just a reference
 * (`userId`) plus office-specific data (landline, appointment date, status, notes).
 * Everything that displays a manager must read the personal fields through
 * `resolveManager` so the list view and the detail view can never disagree.
 *
 * This module is shared by the browser bundle and the server, so it must stay
 * dependency-free.
 */

export interface ManagerLike {
  id: string;
  userId?: string;
  assignedOfficeCode: string;
  managerCode?: string;
  username?: string;
  nationalId?: string;
  fullName?: string;
  mobilePhone?: string;
  email?: string;
}

export interface UserLike {
  id: string;
  role?: string;
  isActive?: boolean;
  assignedOfficeCode?: string;
  username?: string;
  nationalId?: string;
  fullName?: string;
  mobilePhone?: string;
  email?: string;
}

export interface OfficeLike {
  code: string;
  managerId?: string;
  managerName?: string;
}

/** "دکتر مسعود رضوی (دفتر ۳۲۴)" -> "دکتر مسعود رضوی" */
export function cleanPersonName(fullName?: string | null): string {
  if (!fullName) return '';
  return fullName.replace(/\s*\([^)]*\)\s*$/, '').trim() || fullName.trim();
}

/** Finds the OFFICE_USER account that represents this manager. */
export function findManagerUser<U extends UserLike>(
  manager: ManagerLike | null | undefined,
  users: U[] | null | undefined
): U | undefined {
  if (!manager || !Array.isArray(users) || users.length === 0) return undefined;

  if (manager.userId) {
    const byId = users.find((u) => u.id === manager.userId);
    if (byId) return byId;
  }

  const code = String(manager.assignedOfficeCode || '').trim();
  if (!code) return undefined;
  const candidates = users.filter(
    (u) => u.role === 'OFFICE_USER' && String(u.assignedOfficeCode || '').trim() === code
  );
  return candidates.find((u) => u.isActive !== false) || candidates[0];
}

/** Returns the manager with personal fields taken from the linked user. */
export function resolveManager<M extends ManagerLike, U extends UserLike>(
  manager: M,
  users: U[] | null | undefined
): M {
  const user = findManagerUser(manager, users);
  if (!user) return manager;
  return {
    ...manager,
    userId: user.id,
    username: user.username || undefined,
    nationalId: user.nationalId || '',
    fullName: cleanPersonName(user.fullName),
    mobilePhone: user.mobilePhone || '',
    email: user.email || undefined,
  };
}

export function resolveManagers<M extends ManagerLike, U extends UserLike>(
  managers: M[] | null | undefined,
  users: U[] | null | undefined
): M[] {
  return (managers || []).map((m) => resolveManager(m, users));
}

/** Office list rows show the manager name: derive it from the same resolved manager. */
export function resolveOffices<O extends OfficeLike, M extends ManagerLike>(
  offices: O[] | null | undefined,
  resolvedManagers: M[] | null | undefined
): O[] {
  const list = offices || [];
  if (!resolvedManagers || resolvedManagers.length === 0) return list;
  const byOffice = new Map<string, M>();
  resolvedManagers.forEach((m) => {
    const code = String(m.assignedOfficeCode || '').trim();
    if (code && m.userId && !byOffice.has(code)) byOffice.set(code, m);
  });
  return list.map((o) => {
    const m = byOffice.get(String(o.code).trim());
    return m && m.fullName && o.managerName !== m.fullName ? { ...o, managerName: m.fullName } : o;
  });
}

/**
 * Before persisting: if the manager is linked to a user, drop the duplicated personal
 * fields and keep only the reference. Unlinked (legacy) managers are left untouched so
 * no data is ever lost.
 */
export function stripManagerPersonalFields<M extends ManagerLike, U extends UserLike>(
  manager: M,
  users: U[] | null | undefined
): M {
  const user = findManagerUser(manager, users);
  if (!user) return manager;
  return {
    ...manager,
    userId: user.id,
    username: undefined,
    nationalId: '',
    fullName: '',
    mobilePhone: '',
    email: undefined,
  };
}

export function stripManagersPersonalFields<M extends ManagerLike, U extends UserLike>(
  managers: M[] | null | undefined,
  users: U[] | null | undefined
): M[] {
  return (managers || []).map((m) => stripManagerPersonalFields(m, users));
}

/** Copies personal fields edited on a manager form onto the user (the real owner). */
export function applyManagerPersonalFieldsToUser<U extends UserLike>(manager: ManagerLike, user: U): U {
  const name = cleanPersonName(manager.fullName);
  return {
    ...user,
    fullName: name || user.fullName,
    nationalId: manager.nationalId?.trim() ? manager.nationalId.trim() : user.nationalId,
    mobilePhone: manager.mobilePhone?.trim() ? manager.mobilePhone.trim() : user.mobilePhone,
    email: manager.email?.trim() ? manager.email.trim() : user.email,
  };
}
