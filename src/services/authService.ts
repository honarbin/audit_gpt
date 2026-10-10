import { AppUser, UserRole, UserPermissionConfig, DEFAULT_ROLE_PERMISSIONS, AuthSession, UserAccessLog } from '../types/auth';
import { OfficeProfile, OfficeManager } from '../types';
import { EXPANDED_INITIAL_OFFICES, INITIAL_MANAGERS } from '../data/iranGeoData';

export type { UserAccessLog };

export const STORAGE_KEY_AUTH_USERS = 'ra_audit_users_v2';
export const STORAGE_KEY_AUTH_SESSION = 'ra_audit_session_v2';
export const STORAGE_KEY_ACCESS_LOGS = 'ra_audit_access_logs_v2';
export const STORAGE_KEY_SHOW_QUICK_LOGIN = 'ra_audit_show_quick_login_v2';

export function getStoredShowQuickLogin(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SHOW_QUICK_LOGIN);
    return raw !== null ? JSON.parse(raw) : false; // Default: false (hidden)
  } catch {
    return false;
  }
}

export function saveStoredShowQuickLogin(show: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY_SHOW_QUICK_LOGIN, JSON.stringify(show));
  } catch (e) {
    console.error('Failed to save show quick login setting', e);
  }
}

// Initial default users with username field and passwordHash set to username for first-time login
export const INITIAL_USERS: AppUser[] = [
  {
    id: 'user-1788248374468',
    username: 'admin',
    nationalId: '0074971239',
    passwordHash: '12345678',
    fullName: 'ندا هنربین',
    role: 'SYSTEM_ADMIN',
    mobilePhone: '09120000000',
    email: 'honarbin@gmail.com',
    isActive: true,
    isPasswordChanged: true,
    createdAt: '1403/01/01',
    notes: 'مدیر ارشد و دارای دسترسی سراسری نظارت بر کلیه دفاتر',
    customPermissions: {
      canManageUsers: true,
      canManageOffices: true,
      canRunSampling: true,
      canViewAllOffices: true,
      canReviewAndVerdict: true,
      canUploadOfficeDocuments: true,
      canViewAnalytics: true,
      canManageNotifications: true,
      canManageDatabaseSync: true,
      canEditOwnProfile: true
    }
  },
  {
    id: 'user-senior-inspector-1',
    username: 'lead_inspector',
    nationalId: '0070011223',
    passwordHash: 'lead_inspector', // رمز عبور اولیه برابر با نام کاربری
    fullName: 'دکتر علیرضا محمدی (بازرس ارشد و سرپرست ممیزی)',
    role: 'SENIOR_INSPECTOR',
    mobilePhone: '09129998877',
    email: 'lead.inspector@gov.ir',
    isActive: true,
    isPasswordChanged: false,
    createdAt: '1403/01/05',
    notes: 'سرپرست ممیزی و مقام عالی نظارت (سطح ۲) - اتخاذ تصمیم نهایی، رصد تذکرات کارشناسان بدون دخل و تصرف در نمونه‌گیری',
  },
  {
    id: 'user-inspector-1',
    username: 'inspector1',
    nationalId: '0078901234',
    passwordHash: 'inspector1', // رمز اولیه برابر با نام کاربری
    fullName: 'مهندس کامران کریمی (کارشناس بازرسی - سطح ۱)',
    role: 'INSPECTOR',
    mobilePhone: '09123334455',
    email: 'karimi.inspector@gov.ir',
    isActive: true,
    isPasswordChanged: false,
    createdAt: '1403/01/10',
    notes: 'کارشناس ممیزی و بررسی مدارک - ثبت نواقص، برگشت به کارتابل دفتر جهت رفع نقص یا ارجاع به بازرس ارشد',
  },
  {
    id: 'user-inspector-2',
    username: 'inspector2',
    nationalId: '0055443322',
    passwordHash: 'inspector2', // رمز اولیه برابر با نام کاربری
    fullName: 'سرکار خانم مهندس رضایی (کارشناس بازرسی - سطح ۱)',
    role: 'INSPECTOR',
    mobilePhone: '09128887766',
    email: 'rezaei.audit@gov.ir',
    isActive: true,
    isPasswordChanged: false,
    createdAt: '1403/02/01',
    notes: 'کارشناس تطبیق احراز هویت متقاضیان و کشف نواقص اسناد دفاتر',
  },
  // Default Office User for office 1607
  {
    id: 'user-off-1607',
    username: 'office1607',
    nationalId: '0071234567', // کد ملی مدیر دفتر ۱۶۰۷
    passwordHash: 'office1607', // رمز عبور اولیه همان نام کاربری است
    fullName: 'مهندس احمد باقری (دفتر پیشخوان ۱۶۰۷)',
    role: 'OFFICE_USER',
    assignedOfficeCode: '1607',
    assignedOfficeName: 'دفتر پیشخوان خدمات دولت کد ۱۶۰۷',
    mobilePhone: '09121234567',
    email: 'bagheri.pishkhan1607@gmail.com',
    isActive: true,
    isPasswordChanged: false, // با اولین لاگین درخواست تغییر رمز خواهد شد
    createdAt: '1403/01/15',
    notes: 'مسئول دفتر صدور گواهی الکترونیکی کد ۱۶۰۷',
  },
  // Default Office User for office 324 Mashhad
  {
    id: 'user-off-324',
    username: 'office324',
    nationalId: '0941234567', // کد ملی سردفتر ۳۲۴ مشهد
    passwordHash: 'office324', // رمز عبور اولیه برابر با نام کاربری
    fullName: 'دکتر مسعود رضوی (دفتر اسناد رسمی ۳۲۴ مشهد)',
    role: 'OFFICE_USER',
    assignedOfficeCode: '324',
    assignedOfficeName: 'دفتر اسناد رسمی ۳۲۴ مشهد',
    mobilePhone: '09151113324',
    email: 'notary324.mashhad@ssaa.ir',
    isActive: true,
    isPasswordChanged: false, // نیازمند تغییر رمز در اولین ورود
    createdAt: '1402/05/10',
    notes: 'سردفتر و مسئول دفتر صدور گواهی الکترونیکی اسناد رسمی ۳۲۴ مشهد',
  },
];

// Helper to clean and normalize Iranian national ID (converts Persian/Arabic digits to English and strips non-digits)
export function normalizeNationalId(nid?: string | null): string {
  if (!nid) return '';
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let res = String(nid).trim();
  for (let i = 0; i < 10; i++) {
    res = res.replaceAll(persianDigits[i], String(i)).replaceAll(arabicDigits[i], String(i));
  }
  return res.replace(/\D/g, '');
}

// Helper to clean and normalize username
export function normalizeUsername(uname?: string | null): string {
  if (!uname) return '';
  return String(uname).trim().toLowerCase();
}

// Reconcile and clean user list to strictly eliminate duplicate usernames & duplicate nationalIds,
// resolve conflicting assignments, and optionally synchronize missing accounts for all offices
export function sanitizeAndReconcileUsers(
  rawUsers: AppUser[],
  offices?: OfficeProfile[],
  managers?: OfficeManager[]
): AppUser[] {
  if (!Array.isArray(rawUsers) || rawUsers.length === 0) {
    rawUsers = INITIAL_USERS;
  }

  const seenIds = new Set<string>();
  const seenUsernames = new Map<string, AppUser>();
  const seenNationalIds = new Map<string, AppUser>();
  const sanitizedList: AppUser[] = [];

  // If offices are provided, map office code to office for authoritative credential syncing
  const officeMap = new Map<string, OfficeProfile>();
  if (Array.isArray(offices)) {
    offices.forEach(o => {
      if (o.code) officeMap.set(String(o.code).trim(), o);
    });
  }

  rawUsers.forEach((u) => {
    if (!u || typeof u !== 'object') return;
    const user: AppUser = { ...u };

    // 1. Normalize unique ID
    if (!user.id || seenIds.has(user.id)) {
      user.id = `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    }

    // 2. Normalize role
    if (!user.role) {
      user.role = user.assignedOfficeCode ? 'OFFICE_USER' : 'SYSTEM_ADMIN';
    }

    // 3. Role-specific sanitization: Admin/Inspectors must have global access, no conflicting office binding
    if (user.role === 'SYSTEM_ADMIN' || user.role === 'SENIOR_INSPECTOR' || user.role === 'INSPECTOR') {
      user.assignedOfficeCode = undefined;
      user.assignedOfficeName = undefined;
    }

    // 4. Normalize clean username
    let cleanUsername = normalizeUsername(user.username);
    if (!cleanUsername) {
      if (user.role === 'OFFICE_USER' && user.assignedOfficeCode) {
        cleanUsername = `office${user.assignedOfficeCode}`;
      } else if (user.role === 'SYSTEM_ADMIN') {
        cleanUsername = user.fullName.includes('حمیدفر') ? 'admin_hamidfar' : 'admin';
      } else if (user.role === 'SENIOR_INSPECTOR') {
        cleanUsername = 'lead_inspector';
      } else {
        cleanUsername = `user_${user.nationalId ? user.nationalId.slice(-4) : Date.now().toString().slice(-4)}`;
      }
    }
    user.username = cleanUsername;

    // 5. Normalize clean National ID (10 digits)
    let cleanNid = normalizeNationalId(user.nationalId);
    if (!cleanNid || cleanNid.length < 10) {
      if (user.assignedOfficeCode) {
        cleanNid = `00${String(user.assignedOfficeCode).padStart(8, '0')}`.slice(-10);
      } else if (user.nationalId) {
        cleanNid = cleanNid.padStart(10, '0');
      }
    }
    user.nationalId = cleanNid;

    // 6. Strict Uniqueness Check: Username and National ID must each be unique
    const duplicateByUsername = seenUsernames.get(cleanUsername);
    const duplicateByNid = cleanNid ? seenNationalIds.get(cleanNid) : undefined;
    const existingMatch = duplicateByUsername || duplicateByNid;

    if (existingMatch && existingMatch.id !== user.id) {
      // Merge useful properties into the existing primary user and skip duplicate
      if (!existingMatch.assignedOfficeCode && user.assignedOfficeCode && existingMatch.role === 'OFFICE_USER') {
        existingMatch.assignedOfficeCode = user.assignedOfficeCode;
        existingMatch.assignedOfficeName = user.assignedOfficeName;
      }
      if (!existingMatch.mobilePhone && user.mobilePhone) {
        existingMatch.mobilePhone = user.mobilePhone;
      }
      if (!existingMatch.email && user.email) {
        existingMatch.email = user.email;
      }
      if (user.isPasswordChanged) {
        existingMatch.isPasswordChanged = true;
        existingMatch.passwordHash = user.passwordHash || existingMatch.passwordHash;
      }
      if (user.customPermissions && !existingMatch.customPermissions) {
        existingMatch.customPermissions = user.customPermissions;
      }
      return; // Skip adding duplicate user!
    }

    // New unique user verified
    seenIds.add(user.id);
    seenUsernames.set(cleanUsername, user);
    if (cleanNid) seenNationalIds.set(cleanNid, user);

    user.passwordHash = user.passwordHash || cleanUsername;
    user.isPasswordChanged = user.isPasswordChanged ?? false;
    user.isActive = user.isActive ?? true;

    // Sync office name if bound to an office
    if (user.assignedOfficeCode && officeMap.has(String(user.assignedOfficeCode).trim())) {
      const off = officeMap.get(String(user.assignedOfficeCode).trim())!;
      user.assignedOfficeName = off.name;
    }

    sanitizedList.push(user);
  });

  // 7. Ensure every office in `offices` has a valid and synchronized office user account
  if (Array.isArray(offices) && offices.length > 0) {
    offices.forEach((office) => {
      const officeCode = String(office.code).trim();
      if (!officeCode) return;

      const existingUserForOffice = sanitizedList.find(
        u => u.role === 'OFFICE_USER' && String(u.assignedOfficeCode).trim() === officeCode
      );

      if (!existingUserForOffice) {
        // Office is missing an account: automatically create and link one
        let desiredUsername = `office${officeCode}`;
        if (seenUsernames.has(desiredUsername)) {
          desiredUsername = `office_${officeCode}`;
        }
        if (seenUsernames.has(desiredUsername)) {
          desiredUsername = `office_${officeCode}_${Date.now().toString().slice(-3)}`;
        }

        const matchedMgr = managers?.find(m => String(m.assignedOfficeCode).trim() === officeCode);
        let desiredNid = normalizeNationalId(matchedMgr?.nationalId) || `00${officeCode.padStart(8, '0')}`.slice(-10);
        if (seenNationalIds.has(desiredNid)) {
          desiredNid = `99${officeCode.padStart(8, '0')}`.slice(-10);
        }

        const mgrFullName = getCleanManagerName(office.managerName || matchedMgr?.fullName || 'مسئول دفتر');

        const newOfficeUser: AppUser = {
          id: `user-off-${officeCode}`,
          username: desiredUsername,
          nationalId: desiredNid,
          passwordHash: desiredUsername,
          fullName: mgrFullName ? `${mgrFullName} (${office.name})` : office.name,
          role: 'OFFICE_USER',
          assignedOfficeCode: officeCode,
          assignedOfficeName: office.name,
          mobilePhone: matchedMgr?.mobilePhone || office.phone || '09120000000',
          email: matchedMgr?.email || office.email,
          isActive: office.status !== 'REVOKED' && office.status !== 'INACTIVE',
          isPasswordChanged: false,
          createdAt: office.createdAt || '1403/01/01',
          notes: `حساب کاربری دفتر ${office.name} (کد ${officeCode})`,
        };

        seenIds.add(newOfficeUser.id);
        seenUsernames.set(desiredUsername, newOfficeUser);
        seenNationalIds.set(desiredNid, newOfficeUser);
        sanitizedList.push(newOfficeUser);
      }
    });
  }

  return sanitizedList;
}

// Helper to get all users from storage or fallback
export function getStoredUsers(): AppUser[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AUTH_USERS);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const sanitized = sanitizeAndReconcileUsers(parsed);
        saveStoredUsers(sanitized);
        return sanitized;
      }
    }
  } catch (e) {
    console.error('Error loading users from localStorage:', e);
  }
  // Initialize once if never saved
  saveStoredUsers(INITIAL_USERS);
  return INITIAL_USERS;
}

export const loadStoredUsers = getStoredUsers;

// Helper to check if a user is from initial test seed
export function isTestUser(user: AppUser): boolean {
  const testIds = ['user-admin-1', 'user-senior-inspector-1', 'user-inspector-1', 'user-inspector-2', 'user-off-1607', 'user-off-324'];
  const testUsernames = ['admin', 'lead_inspector', 'inspector1', 'inspector2', 'office1607', 'office324'];
  return testIds.includes(user.id) || testUsernames.includes(user.username.toLowerCase());
}

// Reset all users back to initial default seed
export function resetUsersToDefault(): AppUser[] {
  saveStoredUsers(INITIAL_USERS);
  return INITIAL_USERS;
}

// Helper to save users
export function saveStoredUsers(users: AppUser[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_AUTH_USERS, JSON.stringify(users));
  } catch (e) {
    console.error('Error saving users to localStorage:', e);
  }
}

// Access Logs Management
export function getStoredAccessLogs(): UserAccessLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACCESS_LOGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Error loading access logs:', e);
  }
  return [];
}

export const loadUserAccessLogs = getStoredAccessLogs;

export function clearUserAccessLogs(): void {
  localStorage.removeItem(STORAGE_KEY_ACCESS_LOGS);
}

export function saveStoredAccessLogs(logs: UserAccessLog[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_ACCESS_LOGS, JSON.stringify(logs.slice(0, 500))); // Keep last 500 logs
  } catch (e) {
    console.error('Error saving access logs:', e);
  }
}

export function logUserAccessAction(
  user: AppUser,
  actionType: UserAccessLog['actionType'],
  details?: string
): UserAccessLog {
  const newLog: UserAccessLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    userId: user.id,
    username: user.username || user.nationalId,
    fullName: user.fullName,
    role: user.role,
    officeCode: user.assignedOfficeCode,
    officeName: user.assignedOfficeName,
    actionType,
    timestamp: new Date().toLocaleDateString('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }),
    details,
  };

  const currentLogs = getStoredAccessLogs();
  const updatedLogs = [newLog, ...currentLogs];
  saveStoredAccessLogs(updatedLogs);
  return newLog;
}

// Helper to get active session
export function getStoredSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AUTH_SESSION);
    if (raw) {
      const session: AuthSession = JSON.parse(raw);
      return session;
    }
  } catch (e) {
    console.error('Error loading auth session:', e);
  }
  return null;
}

export function getCurrentSessionUser(): AppUser | null {
  const session = getStoredSession();
  return session ? session.user : null;
}

export function setCurrentSessionUser(user: AppUser | null): void {
  if (!user) {
    saveStoredSession(null);
  } else {
    saveStoredSession({
      user,
      token: `tok-${user.id}-${Date.now()}`,
      loginTime: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }
}

export function clearCurrentSession(): void {
  saveStoredSession(null);
}

// Helper to save active session
export function saveStoredSession(session: AuthSession | null): void {
  if (!session) {
    localStorage.removeItem(STORAGE_KEY_AUTH_SESSION);
  } else {
    localStorage.setItem(STORAGE_KEY_AUTH_SESSION, JSON.stringify(session));
  }
}

// Compute effective permissions for a user
export function getUserPermissions(user?: AppUser | null): UserPermissionConfig {
  if (!user) return DEFAULT_ROLE_PERMISSIONS.OFFICE_USER;
  const base = DEFAULT_ROLE_PERMISSIONS[user.role] || DEFAULT_ROLE_PERMISSIONS.OFFICE_USER;
  return {
    ...base,
    ...(user.customPermissions || {}),
  };
}

// Check if user has administrative or cross-office inspection privileges
export function isPrivilegedUser(user?: AppUser | null): boolean {
  if (!user) return false;
  if (user.role === 'SYSTEM_ADMIN' || user.role === 'SENIOR_INSPECTOR') return true;
  const perms = getUserPermissions(user);
  return !!(
    perms.canManageUsers ||
    perms.canManageOffices ||
    perms.canManageSystemConfig ||
    perms.canManageNotifications
  );
}

// Check if user has permission to access a specific navigation tab
export function canUserAccessTab(tab: string, user?: AppUser | null): boolean {
  if (!user) return false;
  if (user.role === 'SYSTEM_ADMIN') return true;
  const perms = getUserPermissions(user);
  const isStrict = isStrictOfficeBoundUser(user);

  switch (tab) {
    case 'OFFICE_KARTABLE':
      return true; // All authenticated users can access kartable (office user for their office, inspectors/admins for all)
    case 'SAMPLING':
      return !isStrict && (perms.canRunSampling || user.role === 'SENIOR_INSPECTOR');
    case 'CERTIFICATES_POOL':
      return !isStrict && (perms.canRunSampling || user.role === 'SENIOR_INSPECTOR' || user.role === 'INSPECTOR');
    case 'INSPECTION_REVIEW':
      return !isStrict && (perms.canReviewAndVerdict || user.role === 'SENIOR_INSPECTOR' || user.role === 'INSPECTOR');
    case 'INSPECTION_WARNINGS':
      return !isStrict && (perms.canSuperviseWarnings || user.role === 'SENIOR_INSPECTOR' || perms.canReviewAndVerdict);
    case 'ANALYTICS':
      return !isStrict && (perms.canViewAnalytics || user.role === 'SENIOR_INSPECTOR');
    case 'OFFICE_MANAGEMENT':
    case 'MANAGERS':
    case 'OFFICE_MAP':
    case 'OFFICE_TYPES':
    case 'SUSPENSIONS':
    case 'COMMITMENTS':
    case 'COMPLAINTS':
      return !isStrict && (perms.canManageOffices || user.role === 'SENIOR_INSPECTOR');
    case 'FORM_FIELDS':
      return !isStrict && (perms.canManageSystemConfig || perms.canManageOffices || user.role === 'SENIOR_INSPECTOR');
    case 'USERS_MANAGEMENT':
      return !isStrict && perms.canManageUsers;
    case 'NOTIFICATIONS':
      return !isStrict && perms.canManageNotifications;
    case 'ACCESS_LOGS':
      return !isStrict && (perms.canManageUsers || perms.canManageSystemConfig || user.role === 'SENIOR_INSPECTOR');
    default:
      return true;
  }
}

// Check if user is strictly an office-bound user without global admin rights
export function isStrictOfficeBoundUser(user?: AppUser | null): boolean {
  if (!user) return false;
  if (user.role === 'SYSTEM_ADMIN' || user.role === 'SENIOR_INSPECTOR' || user.role === 'INSPECTOR') return false;
  const perms = getUserPermissions(user);
  const hasElevatedPrivileges = 
    perms.canManageUsers ||
    perms.canManageOffices ||
    perms.canRunSampling ||
    perms.canReviewAndVerdict ||
    perms.canViewAllOffices ||
    !user.assignedOfficeCode;
  return user.role === 'OFFICE_USER' && !!user.assignedOfficeCode && !hasElevatedPrivileges;
}

// Helper: Check if user is Senior Inspector / Lead Auditor (Level 2)
export function isSeniorInspector(user?: AppUser | null): boolean {
  if (!user) return false;
  return user.role === 'SENIOR_INSPECTOR' || user.role === 'SYSTEM_ADMIN';
}

// Helper: Check if user is Specialist Inspector (Level 1)
export function isInspectorSpecialist(user?: AppUser | null): boolean {
  if (!user) return false;
  return user.role === 'INSPECTOR';
}

// Keep office user accounts synchronized with their office details, and ensure every office has a corresponding user account
export function syncOfficeUsers(offices: OfficeProfile[], currentUsers: AppUser[]): AppUser[] {
  const officeMap = new Map<string, OfficeProfile>();
  offices.forEach(o => {
    if (o.code) officeMap.set(String(o.code).trim(), o);
  });

  let changed = false;
  const processedOfficeCodes = new Set<string>();

  // 1. Update existing OFFICE_USER accounts to synchronize with their registered office
  const updatedUsers = currentUsers.map((user) => {
    if (user.role === 'OFFICE_USER' && user.assignedOfficeCode) {
      const code = String(user.assignedOfficeCode).trim();
      const office = officeMap.get(code);
      if (office) {
        processedOfficeCodes.add(code);
        const isOfficeActive = office.status !== 'REVOKED' && office.status !== 'INACTIVE';
        let itemChanged = false;
        const updated = { ...user };

        if (office.name && updated.assignedOfficeName !== office.name) {
          updated.assignedOfficeName = office.name;
          itemChanged = true;
        }
        if (updated.isActive !== isOfficeActive) {
          updated.isActive = isOfficeActive;
          itemChanged = true;
        }

        if (itemChanged) {
          changed = true;
          return updated;
        }
      }
    }
    return user;
  });

  // 2. Ensure every office has an office user account created matching office specs
  offices.forEach((office) => {
    const code = String(office.code).trim();
    if (!code || processedOfficeCodes.has(code)) return;

    const desiredUsername = `office${code}`;
    const desiredNid = `00${code.padStart(8, '0')}`.slice(-10);
    const mgrName = office.managerName?.trim() || 'مسئول دفتر';

    const newUser: AppUser = {
      id: `user-off-${code}`,
      username: desiredUsername,
      nationalId: desiredNid,
      passwordHash: desiredUsername,
      fullName: `${mgrName} (${office.name})`,
      role: 'OFFICE_USER',
      assignedOfficeCode: code,
      assignedOfficeName: office.name,
      mobilePhone: office.phone || '09120000000',
      email: office.email,
      isActive: office.status !== 'REVOKED' && office.status !== 'INACTIVE',
      isPasswordChanged: false,
      createdAt: office.createdAt || '1403/01/01',
      notes: `حساب کاربری دفتر ${office.name} (کد ${code})`,
    };

    processedOfficeCodes.add(code);
    updatedUsers.push(newUser);
    changed = true;
  });

  if (changed) {
    saveStoredUsers(updatedUsers);
    return updatedUsers;
  }
  return currentUsers;
}

// Helper to extract clean manager name without the office suffix in parentheses (e.g. "دکتر مسعود رضوی (دفتر ۳۲۴)" -> "دکتر مسعود رضوی")
export function getCleanManagerName(fullName: string): string {
  if (!fullName) return '';
  return fullName.replace(/\s*\([^)]*\)\s*$/, '').trim() || fullName.trim();
}

// Two-way synchronization: Keep OfficeProfiles and OfficeManagers synchronized whenever AppUsers are created, modified, or re-assigned
export function syncOfficesAndManagersFromUsers(
  currentOffices: OfficeProfile[],
  currentManagers: OfficeManager[],
  users: AppUser[]
): { updatedOffices: OfficeProfile[]; updatedManagers: OfficeManager[]; changed: boolean } {
  let changed = false;
  const officeMap = new Map<string, OfficeProfile>();
  currentOffices.forEach((o) => officeMap.set(String(o.code).trim(), { ...o }));

  const managerMap = new Map<string, OfficeManager>();
  currentManagers.forEach((m) => managerMap.set(String(m.assignedOfficeCode).trim(), { ...m }));

  // 1. Process AppUsers - strictly prioritize OFFICE_USER accounts for office manager profiles
  const officeUsers = users.filter((u) => u.role === 'OFFICE_USER' && u.assignedOfficeCode);
  
  officeUsers.forEach((u) => {
    const code = String(u.assignedOfficeCode).trim();
    let office = officeMap.get(code);
    const cleanName = getCleanManagerName(u.fullName);

    // If office is missing in officeMap, create it using the user's assigned office name
    if (!office) {
      office = {
        id: `off-${code}`,
        code: code,
        name: u.assignedOfficeName || `دفتر ثبت‌نام کد ${code}`,
        type: 'PRESHKHAN',
        province: 'تهران',
        city: 'تهران',
        address: 'نشانی در پرونده دفتر',
        phone: u.mobilePhone || '۰۲۱-۶۶۵۵۴۴۳۳',
        email: u.email,
        managerId: `MGR-${code}`,
        managerName: cleanName || u.fullName,
        status: u.isActive ? 'ACTIVE' : 'INACTIVE',
        createdAt: u.createdAt || '1403/01/01',
        notes: u.notes,
      };
      officeMap.set(code, office);
      changed = true;
    }

    if (office) {
      let officeChanged = false;
      if (cleanName && office.managerName !== cleanName) {
        office.managerName = cleanName;
        officeChanged = true;
      }

      if (officeChanged) {
        changed = true;
        officeMap.set(code, office);
      }
    }

    // Sync manager record
    const existingMgr = managerMap.get(code);
    if (existingMgr) {
      let mgrChanged = false;
      if (cleanName && existingMgr.fullName !== cleanName) {
        existingMgr.fullName = cleanName;
        mgrChanged = true;
      }
      if (u.nationalId && existingMgr.nationalId !== u.nationalId) {
        existingMgr.nationalId = u.nationalId;
        mgrChanged = true;
      }
      if (u.mobilePhone && existingMgr.mobilePhone !== u.mobilePhone) {
        existingMgr.mobilePhone = u.mobilePhone;
        mgrChanged = true;
      }
      if (u.email && existingMgr.email !== u.email) {
        existingMgr.email = u.email;
        mgrChanged = true;
      }
      if (u.username && existingMgr.username !== u.username) {
        existingMgr.username = u.username;
        mgrChanged = true;
      }
      if (mgrChanged) {
        changed = true;
        managerMap.set(code, existingMgr);
      }
    } else if (cleanName) {
      // Create manager entry if missing
      const initMgr = INITIAL_MANAGERS.find(im => String(im.assignedOfficeCode).trim() === code);
      const newMgr: OfficeManager = initMgr ? { ...initMgr } : {
        id: `MGR-${code}`,
        managerCode: `MGR-${code}`,
        username: u.username,
        nationalId: u.nationalId || '0000000000',
        fullName: cleanName,
        mobilePhone: u.mobilePhone || '',
        landlinePhone: office?.phone || '',
        email: u.email,
        assignedOfficeCode: code,
        assignedOfficeName: office?.name || `دفتر کد ${code}`,
        appointmentDate: '1403/01/01',
        status: u.isActive ? 'ACTIVE' : 'INACTIVE',
      };
      changed = true;
      managerMap.set(code, newMgr);
    }
  });

  // 2. Ensure every Manager in managerMap has a corresponding Office in officeMap
  managerMap.forEach((mgr, code) => {
    if (!officeMap.has(code)) {
      const initOffice = EXPANDED_INITIAL_OFFICES.find(io => String(io.code).trim() === code);
      const restoredOffice: OfficeProfile = initOffice ? { ...initOffice } : {
        id: `off-${code}`,
        code: code,
        name: mgr.assignedOfficeName || `دفتر پیشخوان / اسناد رسمی کد ${code}`,
        type: 'PRESHKHAN',
        province: 'تهران',
        city: 'تهران',
        address: 'نشانی در پرونده دفتر',
        phone: mgr.landlinePhone || mgr.mobilePhone || '۰۲۱-۶۶۵۵۴۴۳۳',
        email: mgr.email,
        managerId: mgr.managerCode || mgr.id,
        managerName: mgr.fullName,
        status: mgr.status || 'ACTIVE',
        createdAt: '1403/01/01',
      };
      officeMap.set(code, restoredOffice);
      changed = true;
    }
  });

  // 3. Ensure every Office in officeMap has a corresponding Manager in managerMap
  officeMap.forEach((off, code) => {
    if (!managerMap.has(code)) {
      const matchedUser = users.find(u => String(u.assignedOfficeCode).trim() === code);
      const initMgr = INITIAL_MANAGERS.find(im => String(im.assignedOfficeCode).trim() === code);
      const restoredMgr: OfficeManager = initMgr ? { ...initMgr } : {
        id: off.managerId || `MGR-${code}`,
        managerCode: off.managerId || `MGR-${code}`,
        username: matchedUser?.username || `office${code}`,
        nationalId: matchedUser?.nationalId || '0000000000',
        fullName: off.managerName || matchedUser?.fullName || 'مسئول دفتر',
        mobilePhone: matchedUser?.mobilePhone || '',
        landlinePhone: off.phone || '',
        email: matchedUser?.email || off.email,
        assignedOfficeCode: code,
        assignedOfficeName: off.name,
        appointmentDate: off.createdAt || '1403/01/01',
        status: (off.status === 'INACTIVE' || off.status === 'REVOKED') ? 'INACTIVE' : 'ACTIVE',
      };
      managerMap.set(code, restoredMgr);
      changed = true;
    }
  });

  // Deduplicate managers to ensure unique id and unique assignedOfficeCode
  const finalManagers: OfficeManager[] = [];
  const seenMgrIds = new Set<string>();
  const seenMgrOfficeCodes = new Set<string>();

  managerMap.forEach((mgr) => {
    const cleanId = String(mgr.id || mgr.managerCode || '').trim();
    const cleanCode = String(mgr.assignedOfficeCode || '').trim();
    if (cleanId && seenMgrIds.has(cleanId)) return;
    if (cleanCode && seenMgrOfficeCodes.has(cleanCode)) return;
    if (cleanId) seenMgrIds.add(cleanId);
    if (cleanCode) seenMgrOfficeCodes.add(cleanCode);
    finalManagers.push({
      ...mgr,
      id: cleanId || (cleanCode ? `MGR-${cleanCode}` : `MGR-${Date.now()}`),
      managerCode: mgr.managerCode || cleanId || (cleanCode ? `MGR-${cleanCode}` : `MGR-${Date.now()}`),
      assignedOfficeCode: cleanCode,
    });
  });

  return {
    updatedOffices: Array.from(officeMap.values()),
    updatedManagers: finalManagers,
    changed,
  };
}

// =========================================================================
// Server Database Persistence APIs
// =========================================================================

/**
 * دریافت جدیدترین لیست کاربران از دیتابیس متمرکز سرور
 */
export async function fetchUsersFromServer(): Promise<AppUser[] | null> {
  try {
    const res = await fetch('/api/v1/users');
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.users) && data.users.length > 0) {
        // ذخیره در حافظه محلی جهت استفاده آفلاین
        saveStoredUsers(data.users);
        return data.users;
      }
    }
  } catch (e) {
    console.warn('[authService] Could not fetch users from server:', e);
  }
  return null;
}

export function normalizeDigits(str?: string | null): string {
  if (!str) return '';
  return String(str)
    .replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1728))
    .replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1584))
    .trim();
}

/**
 * تغییر رمز عبور فقط در دیتابیس مرکزی انجام می‌شود. localStorage صرفاً
 * پس از دریافت پاسخ موفق سرور به‌عنوان cache به‌روزرسانی می‌شود.
 */
export async function syncUserPasswordToServer(
  userId: string,
  newPassword: string,
  currentPassword?: string,
  username?: string
): Promise<{ success: boolean; user?: AppUser; error?: string }> {
  const cleanNewPass = normalizeDigits(newPassword);
  const cleanCurPass = currentPassword ? normalizeDigits(currentPassword) : undefined;
  const cleanUserId = userId ? String(userId).trim() : '';
  const cleanUsername = username ? normalizeDigits(username).toLowerCase() : '';

  if (!cleanNewPass) {
    return { success: false, error: 'رمز عبور جدید نمی‌تواند خالی باشد.' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const res = await fetch('/api/v1/users/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        userId: cleanUserId,
        username: cleanUsername,
        currentPassword: cleanCurPass,
        newPassword: cleanNewPass
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data?.error || 'تغییر رمز عبور در سرور انجام نشد.'
      };
    }

    const updatedUser = data.user as AppUser | undefined;
    if (updatedUser) {
      const users = getStoredUsers();
      const idx = users.findIndex(u =>
        (cleanUserId && u.id === cleanUserId) ||
        (cleanUsername && normalizeUsername(u.username) === cleanUsername) ||
        (cleanUsername && normalizeDigits(u.nationalId) === cleanUsername) ||
        (cleanUsername && normalizeDigits(u.assignedOfficeCode) === cleanUsername)
      );
      if (idx >= 0) {
        users[idx] = { ...users[idx], ...updatedUser };
        saveStoredUsers(users);
      }

      const currentSession = getStoredSession();
      if (currentSession?.user && (
        (cleanUserId && currentSession.user.id === cleanUserId) ||
        (cleanUsername && normalizeUsername(currentSession.user.username) === cleanUsername)
      )) {
        setCurrentSessionUser({ ...currentSession.user, ...updatedUser });
      }
    }

    return { success: true, user: updatedUser };
  } catch (e) {
    console.warn('[authService] Central password update failed:', e);
    return {
      success: false,
      error: 'ارتباط با سرور برقرار نشد؛ رمز عبور تغییر نکرد. لطفاً دوباره تلاش کنید.'
    };
  }
}

/**
 * ذخیره یا ویرایش اطلاعات یک کاربر در دیتابیس سرور
 */
export async function saveUserToServer(user: AppUser): Promise<boolean> {
  try {
    const res = await fetch('/api/v1/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    const data = await res.json();
    return Boolean(data.success);
  } catch (e) {
    console.warn('[authService] Could not save user to server:', e);
    return false;
  }
}

/**
 * همگام‌سازی کل کاربران در سرور
 */
export async function syncAllUsersToServer(users: AppUser[]): Promise<boolean> {
  try {
    const res = await fetch('/api/v1/users/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ users }),
    });
    const data = await res.json();
    return Boolean(data.success);
  } catch (e) {
    console.warn('[authService] Could not sync all users to server:', e);
    return false;
  }
}

/**
 * دریافت دفاتر از دیتابیس سرور
 */
export async function fetchOfficesFromServer(): Promise<OfficeProfile[] | null> {
  try {
    const res = await fetch('/api/v1/offices');
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.offices) && data.offices.length > 0) {
        return data.offices;
      }
    }
  } catch (e) {
    console.warn('[authService] Could not fetch offices from server:', e);
  }
  return null;
}

/**
 * همگام‌سازی دفاتر در دیتابیس سرور
 */
export async function syncOfficesToServer(offices: OfficeProfile[]): Promise<boolean> {
  try {
    const res = await fetch('/api/v1/offices/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offices }),
    });
    const data = await res.json();
    return Boolean(data.success);
  } catch (e) {
    console.warn('[authService] Could not sync offices to server:', e);
    return false;
  }
}

/**
 * حذف کاربر از پایگاه داده متمرکز سرور
 */
export async function deleteUserFromServer(userId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/v1/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    return Boolean(data.success);
  } catch (e) {
    console.warn('[authService] Could not delete user from server:', e);
    return false;
  }
}


