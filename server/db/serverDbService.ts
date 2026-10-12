import fs from 'fs';
import path from 'path';

// Helper to clean and normalize Iranian/Arabic digits to English digits
export function normalizeDigits(str?: string | null): string {
  if (!str) return '';
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let res = String(str).trim();
  for (let i = 0; i < 10; i++) {
    res = res.replaceAll(persianDigits[i], String(i)).replaceAll(arabicDigits[i], String(i));
  }
  return res;
}

export interface ServerUser {
  id: string;
  username: string;
  nationalId: string;
  passwordHash: string;
  fullName: string;
  role: 'SYSTEM_ADMIN' | 'SENIOR_INSPECTOR' | 'INSPECTOR' | 'OFFICE_USER';
  mobilePhone?: string;
  email?: string;
  assignedOfficeCode?: string;
  assignedOfficeName?: string;
  isActive: boolean;
  isPasswordChanged?: boolean;
  lastLoginAt?: string;
  createdAt: string;
  notes?: string;
  customPermissions?: any;
}

export interface ServerOffice {
  id?: string;
  code: string;
  name: string;
  type: string;
  customTypeName?: string;
  province: string;
  city: string;
  address: string;
  phone: string;
  email?: string;
  latitude?: number;
  longitude?: number;
  managerId?: string;
  managerName: string;
  activeCampaignsCount?: number;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'REVOKED';
  createdAt?: string;
  notes?: string;
}

export interface ServerManager {
  id: string;
  managerCode: string;
  username?: string;
  nationalId: string;
  fullName: string;
  mobilePhone: string;
  landlinePhone: string;
  email?: string;
  assignedOfficeCode: string;
  assignedOfficeName?: string;
  appointmentDate?: string;
  status: 'ACTIVE' | 'INACTIVE';
  notes?: string;
}

const DEFAULT_SERVER_USERS: ServerUser[] = [
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
    passwordHash: 'lead_inspector',
    fullName: 'دکتر علیرضا محمدی (بازرس ارشد و سرپرست ممیزی)',
    role: 'SENIOR_INSPECTOR',
    mobilePhone: '09129998877',
    email: 'lead.inspector@gov.ir',
    isActive: true,
    isPasswordChanged: false,
    createdAt: '1403/01/05',
    notes: 'سرپرست ممیزی و مقام عالی نظارت (سطح ۲)',
  },
  {
    id: 'user-inspector-1',
    username: 'inspector1',
    nationalId: '0078901234',
    passwordHash: 'inspector1',
    fullName: 'مهندس کامران کریمی (کارشناس بازرسی - سطح ۱)',
    role: 'INSPECTOR',
    mobilePhone: '09123334455',
    email: 'karimi.inspector@gov.ir',
    isActive: true,
    isPasswordChanged: false,
    createdAt: '1403/01/10',
    notes: 'کارشناس ممیزی و بررسی مدارک',
  },
  {
    id: 'user-inspector-2',
    username: 'inspector2',
    nationalId: '0055443322',
    passwordHash: 'inspector2',
    fullName: 'سرکار خانم مهندس رضایی (کارشناس بازرسی - سطح ۱)',
    role: 'INSPECTOR',
    mobilePhone: '09128887766',
    email: 'rezaei.audit@gov.ir',
    isActive: true,
    isPasswordChanged: false,
    createdAt: '1403/02/01',
    notes: 'کارشناس تطبیق احراز هویت متقاضیان',
  },
  {
    id: 'user-off-1607',
    username: 'office1607',
    nationalId: '0071234567',
    passwordHash: 'office1607',
    fullName: 'مهندس احمد باقری (دفتر پیشخوان ۱۶۰۷)',
    role: 'OFFICE_USER',
    assignedOfficeCode: '1607',
    assignedOfficeName: 'دفتر پیشخوان خدمات دولت کد ۱۶۰۷',
    mobilePhone: '09121234567',
    email: 'bagheri.pishkhan1607@gmail.com',
    isActive: true,
    isPasswordChanged: false,
    createdAt: '1403/01/15',
    notes: 'مسئول دفتر صدور گواهی الکترونیکی کد ۱۶۰۷',
  },
  {
    id: 'user-off-324',
    username: 'office324',
    nationalId: '0941234567',
    passwordHash: 'office324',
    fullName: 'دکتر مسعود رضوی (دفتر اسناد رسمی ۳۲۴ مشهد)',
    role: 'OFFICE_USER',
    assignedOfficeCode: '324',
    assignedOfficeName: 'دفتر اسناد رسمی ۳۲۴ مشهد',
    mobilePhone: '09151113324',
    email: 'notary324.mashhad@ssaa.ir',
    isActive: true,
    isPasswordChanged: false,
    createdAt: '1402/05/10',
    notes: 'سردفتر و مسئول دفتر صدور گواهی الکترونیکی اسناد رسمی ۳۲۴ مشهد',
  },
];

const DEFAULT_SERVER_OFFICES: ServerOffice[] = [
  {
    id: 'off-1607',
    code: '1607',
    name: 'دفتر پیشخوان خدمات دولت کد ۱۶۰۷',
    type: 'PRESHKHAN',
    province: 'تهران',
    city: 'تهران',
    address: 'تهران، خیابان آزادی، تقاطع نواب، مجتمع اداری تجاری شهاب، طبقه اول، واحد ۱۰۴',
    phone: '021-66554433',
    email: 'info@pishkhan1607.ir',
    latitude: 35.6997,
    longitude: 51.3780,
    managerId: 'MGR-1607',
    managerName: 'مهندس احمد باقری',
    activeCampaignsCount: 0,
    status: 'ACTIVE',
    createdAt: '1403/01/15',
    notes: 'دفتر ثبت‌نام صدور گواهی الکترونیکی کد ۱۶۰۷',
  },
  {
    id: 'off-324',
    code: '324',
    name: 'دفتر اسناد رسمی ۳۲۴ مشهد',
    type: 'NOTARY',
    province: 'خراسان رضوی',
    city: 'مشهد',
    address: 'مشهد، بلوار سجاد، تقاطع بزرگمهر جنوبی، ساختمان اداری نگین، طبقه دوم، واحد ۲۰۴',
    phone: '051-37654321',
    email: 'notary324.mashhad@ssaa.ir',
    latitude: 36.3155,
    longitude: 59.5670,
    managerId: 'MGR-324',
    managerName: 'دکتر مسعود رضوی',
    activeCampaignsCount: 0,
    status: 'ACTIVE',
    createdAt: '1402/05/10',
    notes: 'دفتر اسناد رسمی شماره ۳۲۴ مشهد - واحد ثبت‌نام و صدور گواهی امضای الکترونیکی',
  }
];

const DEFAULT_SERVER_MANAGERS: ServerManager[] = [
  {
    id: 'MGR-1607',
    managerCode: 'MGR-1607',
    username: 'office1607',
    nationalId: '0071234567',
    fullName: 'مهندس احمد باقری',
    mobilePhone: '09121234567',
    landlinePhone: '02166554433',
    email: 'bagheri.pishkhan1607@gmail.com',
    assignedOfficeCode: '1607',
    assignedOfficeName: 'دفتر پیشخوان خدمات دولت کد ۱۶۰۷',
    appointmentDate: '1403/01/15',
    status: 'ACTIVE',
    notes: 'مسئول ثبت‌نام و مدیر فنی صدور گواهی الکترونیکی دفتر ۱۶۰۷',
  },
  {
    id: 'MGR-324',
    managerCode: 'MGR-324',
    username: 'office324',
    nationalId: '0941234567',
    fullName: 'دکتر مسعود رضوی',
    mobilePhone: '09151113324',
    landlinePhone: '05137654321',
    email: 'notary324.mashhad@ssaa.ir',
    assignedOfficeCode: '324',
    assignedOfficeName: 'دفتر اسناد رسمی ۳۲۴ مشهد',
    appointmentDate: '1402/05/10',
    status: 'ACTIVE',
    notes: 'سردفتر و مسئول دفتر صدور گواهی الکترونیکی اسناد رسمی ۳۲۴ مشهد',
  }
];

export class ServerDbService {
  private static instance: ServerDbService;
  private vaultDir: string;
  private usersFile: string;
  private officesFile: string;
  private managersFile: string;
  private campaignsFile: string;
  private auditEventsFile: string;
  private notificationsFile: string;
  private fieldSettingsFile: string;
  private officeTypesFile: string;
  private accessLogsFile: string;

  private constructor() {
    const localRoot = process.env.VERCEL ? '/tmp/ra-audit-vault' : (process.env.SERVER_STORAGE_LOCAL_DIR || './storage_vault');
    this.vaultDir = path.resolve(localRoot);
    if (!fs.existsSync(this.vaultDir)) {
      fs.mkdirSync(this.vaultDir, { recursive: true });
    }
    this.usersFile = path.join(this.vaultDir, 'db_users.json');
    this.officesFile = path.join(this.vaultDir, 'db_offices.json');
    this.managersFile = path.join(this.vaultDir, 'db_managers.json');
    this.campaignsFile = path.join(this.vaultDir, 'db_campaigns.json');
    this.auditEventsFile = path.join(this.vaultDir, 'db_audit_events.json');
    this.notificationsFile = path.join(this.vaultDir, 'db_notifications.json');
    this.fieldSettingsFile = path.join(this.vaultDir, 'db_field_settings.json');
    this.officeTypesFile = path.join(this.vaultDir, 'db_office_types.json');
    this.accessLogsFile = path.join(this.vaultDir, 'db_access_logs.json');

    this.ensureInitialized();
  }

  public static getInstance(): ServerDbService {
    if (!ServerDbService.instance) {
      ServerDbService.instance = new ServerDbService();
    }
    return ServerDbService.instance;
  }

  private atomicWriteJson(filePath: string, data: any): void {
    const tempPath = `${filePath}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempPath, filePath);
  }

  private readJson<T>(filePath: string, fallback: T): T {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(raw) as T;
      }
    } catch (err) {
      console.error(`[ServerDbService] Failed to read ${filePath}:`, err);
    }
    return fallback;
  }

  public ensureInitialized(): void {
    if (!fs.existsSync(this.vaultDir)) {
      fs.mkdirSync(this.vaultDir, { recursive: true });
    }
    if (!fs.existsSync(this.usersFile)) {
      this.atomicWriteJson(this.usersFile, DEFAULT_SERVER_USERS);
      console.log('[ServerDbService] Initialized default server users in', this.usersFile);
    }
    if (!fs.existsSync(this.officesFile)) {
      this.atomicWriteJson(this.officesFile, DEFAULT_SERVER_OFFICES);
      console.log('[ServerDbService] Initialized default server offices in', this.officesFile);
    }
    if (!fs.existsSync(this.managersFile)) {
      this.atomicWriteJson(this.managersFile, DEFAULT_SERVER_MANAGERS);
      console.log('[ServerDbService] Initialized default server managers in', this.managersFile);
    }
    if (!fs.existsSync(this.campaignsFile)) {
      this.atomicWriteJson(this.campaignsFile, []);
    }
    if (!fs.existsSync(this.auditEventsFile)) {
      this.atomicWriteJson(this.auditEventsFile, []);
    }
    if (!fs.existsSync(this.notificationsFile)) {
      this.atomicWriteJson(this.notificationsFile, []);
    }
  }

  // ================= USERS API =================

  public getUsers(): ServerUser[] {
    if (!fs.existsSync(this.usersFile)) {
      this.ensureInitialized();
    }
    const raw = this.readJson<ServerUser[]>(this.usersFile, DEFAULT_SERVER_USERS);
    // Deduplicate by username (case-insensitive) prioritizing changed passwords & populated fields
    const userMap = new Map<string, ServerUser>();
    for (const u of raw) {
      const key = String(u.username || u.nationalId || u.id).trim().toLowerCase();
      if (!userMap.has(key)) {
        userMap.set(key, u);
      } else {
        const existing = userMap.get(key)!;
        if (u.isPasswordChanged && !existing.isPasswordChanged) {
          userMap.set(key, u);
        } else if (u.fullName && (!existing.fullName || existing.fullName.includes('حسینی'))) {
          userMap.set(key, { ...existing, ...u });
        }
      }
    }
    return Array.from(userMap.values());
  }

  public saveAllUsers(users: ServerUser[]): void {
    if (!Array.isArray(users)) return;
    this.atomicWriteJson(this.usersFile, users);
  }

  /**
   * همگام‌سازی امن کاربران با حفاظت کامل از کلمات عبور و متادیتای ورود در سرور
   */
  public syncUsers(incomingUsers: ServerUser[]): ServerUser[] {
    if (!Array.isArray(incomingUsers)) return this.getUsers();
    const existing = this.getUsers();
    const existingMap = new Map<string, ServerUser>();
    for (const u of existing) {
      const key = String(u.username || u.nationalId || u.id).trim().toLowerCase();
      existingMap.set(key, u);
    }

    const merged: ServerUser[] = [];
    const seen = new Set<string>();

    for (const inc of incomingUsers) {
      const key = String(inc.username || inc.nationalId || inc.id).trim().toLowerCase();
      if (!key) continue;
      seen.add(key);

      if (existingMap.has(key)) {
        const current = existingMap.get(key)!;
        // Existing credentials are owned by the central database. A bulk sync
        // must never allow a stale browser cache to overwrite a password.
        // Password changes go through updateUserPassword() only.
        merged.push({
          ...current,
          ...inc,
          passwordHash: current.passwordHash,
          isPasswordChanged: current.isPasswordChanged,
          lastLoginAt: current.lastLoginAt || inc.lastLoginAt,
        });
      } else {
        merged.push(inc);
      }
    }

    // حفظ کاربرانی که قبلاً در سرور بوده‌اند
    for (const [key, cur] of existingMap.entries()) {
      if (!seen.has(key)) {
        merged.push(cur);
      }
    }

    this.atomicWriteJson(this.usersFile, merged);
    return merged;
  }

  public saveUser(user: ServerUser): ServerUser {
    const users = this.getUsers();
    const cleanUsername = String(user.username || '').trim().toLowerCase();
    const existingIndex = users.findIndex(u => 
      u.id === user.id || 
      (cleanUsername && String(u.username || '').trim().toLowerCase() === cleanUsername)
    );

    if (existingIndex >= 0) {
      const existing = users[existingIndex];
      // Profile saves must not overwrite an existing credential. The dedicated
      // change-password endpoint is the only path allowed to change passwords.
      const passwordHash = existing.passwordHash;
      const isPasswordChanged = existing.isPasswordChanged;
      const lastLoginAt = user.lastLoginAt || existing.lastLoginAt;

      users[existingIndex] = {
        ...existing,
        ...user,
        passwordHash,
        isPasswordChanged,
        lastLoginAt,
      };
    } else {
      users.push(user);
    }

    this.atomicWriteJson(this.usersFile, users);
    return users[existingIndex >= 0 ? existingIndex : users.length - 1];
  }

  public authenticateUser(usernameOrId: string, password: string): { success: boolean; user?: ServerUser; error?: string } {
    const rawInput = String(usernameOrId || '').trim();
    const cleanInput = normalizeDigits(rawInput).toLowerCase();
    const rawPass = String(password || '').trim();
    const cleanPass = normalizeDigits(rawPass);

    if (!cleanInput || !cleanPass) {
      return { success: false, error: 'نام کاربری و رمز عبور الزامی است.' };
    }

    const users = this.getUsers();
    let foundUser = users.find(u => {
      const uName = normalizeDigits(String(u.username || '')).toLowerCase();
      const uOffice = normalizeDigits(String(u.assignedOfficeCode || ''));
      const uNid = normalizeDigits(String(u.nationalId || ''));
      return (
        uName === cleanInput ||
        (uOffice && (uOffice === cleanInput || `office${uOffice}`.toLowerCase() === cleanInput)) ||
        (uNid && uNid === cleanInput)
      );
    });

    if (!foundUser) {
      // بررسی کن آیا این شناسه مربوط به یکی از دفاتر سامانه است؟
      const offices = this.getOffices();
      const matchedOffice = offices.find(o => {
        const oCode = normalizeDigits(String(o.code || ''));
        return oCode === cleanInput || `office${oCode}`.toLowerCase() === cleanInput;
      });

      if (matchedOffice) {
        // ایجاد بلادرنگ کاربر دفتر در دیتابیس سرور
        const officeCodeStr = String(matchedOffice.code);
        const autoOfficeUser: ServerUser = {
          id: `user-off-${officeCodeStr}`,
          username: `office${officeCodeStr}`,
          nationalId: `000000${officeCodeStr}`.slice(-10),
          passwordHash: `office${officeCodeStr}`,
          fullName: `${matchedOffice.managerName || 'مسئول دفتر'} (${matchedOffice.name})`,
          role: 'OFFICE_USER',
          assignedOfficeCode: officeCodeStr,
          assignedOfficeName: matchedOffice.name,
          isActive: true,
          isPasswordChanged: false,
          createdAt: '1403/01/01',
          lastLoginAt: new Date().toISOString()
        };
        this.saveUser(autoOfficeUser);
        foundUser = autoOfficeUser;
      } else {
        return { success: false, error: `کاربری با شناسه «${usernameOrId}» در پایگاه داده سرور یافت نشد.` };
      }
    }

    if (!foundUser.isActive) {
      return { success: false, error: 'حساب کاربری شما غیرفعال یا تعلیق شده است. با راهبر تماس بگیرید.' };
    }

    const normalizedHash = normalizeDigits(foundUser.passwordHash);

    // بررسی کلمه عبور با در نظر گرفتن سناریوهای پیش‌فرض و تغییر یافته
    const uNameNorm = normalizeDigits(foundUser.username).toLowerCase();
    const uOfficeNorm = normalizeDigits(foundUser.assignedOfficeCode || '');
    const uNidNorm = normalizeDigits(foundUser.nationalId || '');

    // ۱. انطباق دقیق هش با ورودی (چه نرمالایز و چه اصلی)
    const isExactHashMatch = (normalizedHash === cleanPass || foundUser.passwordHash === rawPass);

    let isPasswordValid = isExactHashMatch;

    // ۲. رمزهای پیش‌فرض تنها و تنها در صورتی معتبر هستند که کاربر هنوز رمز عبور خود را تغییر نداده باشد (!foundUser.isPasswordChanged)
    if (!isPasswordValid && !foundUser.isPasswordChanged) {
      if (foundUser.username === 'admin' && (cleanPass === '12345678' || cleanPass === '12345' || cleanPass === 'admin')) {
        isPasswordValid = true;
      } else if (
        cleanPass === uNameNorm ||
        (uOfficeNorm && cleanPass === uOfficeNorm) ||
        (uOfficeNorm && cleanPass === `office${uOfficeNorm}`.toLowerCase()) ||
        cleanPass === uNidNorm
      ) {
        isPasswordValid = true;
      }
    }

    if (!isPasswordValid) {
      return { success: false, error: 'رمز عبور وارد شده نادرست می‌باشد.' };
    }

    // ثبت قطعی زمان آخرین ورود در دیتابیس
    foundUser.lastLoginAt = new Date().toISOString();
    this.saveUser(foundUser);

    console.log(`[ServerDbService] User ${foundUser.username} (${foundUser.fullName}) authenticated successfully.`);
    return { success: true, user: foundUser };
  }

  public updateUserPassword(params: {
    userId?: string;
    username?: string;
    currentPassword?: string;
    newPassword: string;
  }): { success: boolean; error?: string; user?: ServerUser } {
    const { userId, username, currentPassword, newPassword } = params;
    const rawNewPass = String(newPassword || '').trim();
    const cleanNewPass = normalizeDigits(rawNewPass);

    if (!cleanNewPass) {
      return { success: false, error: 'رمز عبور جدید نمی‌تواند خالی باشد.' };
    }

    const users = this.getUsers();
    const cleanUsername = username ? normalizeDigits(String(username)).toLowerCase() : '';
    const cleanUserId = userId ? String(userId).trim() : '';
    
    const userIndex = users.findIndex(u => 
      (cleanUserId && u.id === cleanUserId) ||
      (cleanUsername && normalizeDigits(String(u.username || '')).toLowerCase() === cleanUsername) ||
      (cleanUsername && normalizeDigits(String(u.nationalId || '')) === cleanUsername) ||
      (cleanUsername && u.assignedOfficeCode && normalizeDigits(String(u.assignedOfficeCode)) === cleanUsername)
    );

    let user: ServerUser;
    if (userIndex === -1) {
      user = {
        id: cleanUserId || `user-${Date.now()}`,
        username: cleanUsername || `user_${Date.now()}`,
        nationalId: cleanUsername || '',
        passwordHash: cleanNewPass,
        fullName: cleanUsername || 'کاربر سیستم',
        role: 'OFFICE_USER',
        isActive: true,
        isPasswordChanged: true,
        createdAt: '1403/01/01',
      };
      users.push(user);
      this.saveAllUsers(users);
      console.log(`[ServerDbService] Auto-registered and updated password for user ${user.username} in database.`);
      return { success: true, user };
    } else {
      user = users[userIndex];
    }

    // اعتبارسنجی رمز عبور فعلی در صورت ارسال
    if (currentPassword && currentPassword.trim()) {
      const rawCur = currentPassword.trim();
      const cleanCur = normalizeDigits(rawCur);
      const userHashNorm = normalizeDigits(user.passwordHash);

      const uNameNorm = normalizeDigits(user.username).toLowerCase();
      const uOfficeNorm = normalizeDigits(user.assignedOfficeCode || '');
      const uNidNorm = normalizeDigits(user.nationalId || '');

      const isCurValid = 
        (userHashNorm === cleanCur || user.passwordHash === rawCur) ||
        (user.username === 'admin' && (cleanCur === '12345678' || cleanCur === '12345')) ||
        cleanCur === uNameNorm ||
        (uOfficeNorm && cleanCur === uOfficeNorm) ||
        (uOfficeNorm && cleanCur === `office${uOfficeNorm}`.toLowerCase()) ||
        cleanCur === uNidNorm;

      if (!isCurValid) {
        return { success: false, error: 'رمز عبور فعلی وارد شده نادرست است.' };
      }
    }

    // ذخیره رمز عبور جدید به صورت پایدار در دیتابیس
    user.passwordHash = cleanNewPass;
    user.isPasswordChanged = true;

    users[userIndex] = user;
    this.saveAllUsers(users);

    console.log(`[ServerDbService] Successfully updated password for user ${user.username} (${user.id}) in database.`);
    return { success: true, user };
  }

  public deleteUser(userId: string): boolean {
    const users = this.getUsers();
    const filtered = users.filter(u => u.id !== userId);
    if (filtered.length !== users.length) {
      this.saveAllUsers(filtered);
      return true;
    }
    return false;
  }

  // ================= OFFICES API =================

  public getOffices(): ServerOffice[] {
    return this.readJson<ServerOffice[]>(this.officesFile, DEFAULT_SERVER_OFFICES);
  }

  public saveOffices(offices: ServerOffice[]): void {
    if (!Array.isArray(offices)) return;
    this.atomicWriteJson(this.officesFile, offices);
  }

  public saveOffice(office: ServerOffice): ServerOffice {
    const offices = this.getOffices();
    const cleanCode = String(office.code || '').trim();
    const index = offices.findIndex(o => String(o.code).trim() === cleanCode);

    if (index >= 0) {
      offices[index] = { ...offices[index], ...office };
    } else {
      offices.push(office);
    }

    this.saveOffices(offices);
    return offices[index >= 0 ? index : offices.length - 1];
  }

  public deleteOffice(code: string): boolean {
    const offices = this.getOffices();
    const cleanCode = String(code || '').trim();
    const filtered = offices.filter(o => String(o.code).trim() !== cleanCode);
    if (filtered.length !== offices.length) {
      this.saveOffices(filtered);
      return true;
    }
    return false;
  }

  // ================= MANAGERS API =================

  public getManagers(): ServerManager[] {
    return this.readJson<ServerManager[]>(this.managersFile, DEFAULT_SERVER_MANAGERS);
  }

  public saveManagers(managers: ServerManager[]): void {
    if (!Array.isArray(managers)) return;
    this.atomicWriteJson(this.managersFile, managers);
  }

  public saveManager(manager: ServerManager): ServerManager {
    const managers = this.getManagers();
    const cleanCode = String(manager.assignedOfficeCode || '').trim();
    const index = managers.findIndex(m => 
      m.id === manager.id || (cleanCode && String(m.assignedOfficeCode).trim() === cleanCode)
    );

    if (index >= 0) {
      managers[index] = { ...managers[index], ...manager };
    } else {
      managers.push(manager);
    }

    this.saveManagers(managers);
    return managers[index >= 0 ? index : managers.length - 1];
  }

  // ================= CAMPAIGNS & INSPECTION RECORDS API =================

  public getCampaigns(): any[] {
    return this.readJson<any[]>(this.campaignsFile, []);
  }

  public saveAllCampaigns(campaigns: any[]): void {
    if (!Array.isArray(campaigns)) return;
    this.atomicWriteJson(this.campaignsFile, campaigns);
  }

  public saveCampaign(campaign: any): any {
    const campaigns = this.getCampaigns();
    const index = campaigns.findIndex(c => c.id === campaign.id);
    if (index >= 0) {
      campaigns[index] = { ...campaigns[index], ...campaign };
    } else {
      campaigns.unshift(campaign);
    }
    this.saveAllCampaigns(campaigns);
    return campaigns[index >= 0 ? index : 0];
  }

  public saveCampaignRecord(campaignId: string, record: any): boolean {
    const campaigns = this.getCampaigns();
    const campIndex = campaigns.findIndex(c => c.id === campaignId);
    if (campIndex === -1) return false;

    const campaign = campaigns[campIndex];
    const records: any[] = campaign.records || [];
    const recIndex = records.findIndex(r => r.id === record.id);

    if (recIndex >= 0) {
      records[recIndex] = { ...records[recIndex], ...record };
    } else {
      records.push(record);
    }

    campaign.records = records;
    campaigns[campIndex] = campaign;
    this.saveAllCampaigns(campaigns);
    return true;
  }

  public deleteCampaign(id: string): boolean {
    const campaigns = this.getCampaigns();
    const filtered = campaigns.filter(c => c.id !== id);
    if (filtered.length !== campaigns.length) {
      this.saveAllCampaigns(filtered);
      return true;
    }
    return false;
  }

  // ================= AUDIT EVENTS API =================

  public getAuditEvents(): any[] {
    return this.readJson<any[]>(this.auditEventsFile, []);
  }

  public saveAllAuditEvents(events: any[]): void {
    if (!Array.isArray(events)) return;
    this.atomicWriteJson(this.auditEventsFile, events);
  }

  public saveAuditEvent(event: any): any {
    const events = this.getAuditEvents();
    const index = events.findIndex(e => e.id === event.id);
    if (index >= 0) {
      events[index] = { ...events[index], ...event };
    } else {
      events.unshift(event);
    }
    this.saveAllAuditEvents(events);
    return events[index >= 0 ? index : 0];
  }

  // ================= NOTIFICATIONS API =================

  public getNotifications(): any[] {
    return this.readJson<any[]>(this.notificationsFile, []);
  }

  public saveAllNotifications(notifications: any[]): void {
    if (!Array.isArray(notifications)) return;
    this.atomicWriteJson(this.notificationsFile, notifications);
  }

  // ================= FIELD SETTINGS API =================

  public getFieldSettings(): any {
    return this.readJson<any>(this.fieldSettingsFile, null);
  }

  public saveFieldSettings(settings: any): void {
    this.atomicWriteJson(this.fieldSettingsFile, settings);
  }

  // ================= OFFICE TYPES API =================

  public getOfficeTypes(): any[] {
    return this.readJson<any[]>(this.officeTypesFile, []);
  }

  public saveOfficeTypes(types: any[]): void {
    if (!Array.isArray(types)) return;
    this.atomicWriteJson(this.officeTypesFile, types);
  }

  // ================= ACCESS LOGS API =================

  public getAccessLogs(): any[] {
    return this.readJson<any[]>(this.accessLogsFile, []);
  }

  public saveAccessLog(log: any): void {
    const logs = this.getAccessLogs();
    logs.unshift(log);
    // Keep max 1000 logs
    const trimmed = logs.slice(0, 1000);
    this.atomicWriteJson(this.accessLogsFile, trimmed);
  }

  // ================= FULL SYSTEM BOOTSTRAP API =================

  public getBootstrapData(): {
    users: ServerUser[];
    offices: ServerOffice[];
    managers: ServerManager[];
    campaigns: any[];
    auditEvents: any[];
    notifications: any[];
    fieldSettings: any;
    officeTypes: any[];
    accessLogs: any[];
  } {
    return {
      users: this.getUsers(),
      offices: this.getOffices(),
      managers: this.getManagers(),
      campaigns: this.getCampaigns(),
      auditEvents: this.getAuditEvents(),
      notifications: this.getNotifications(),
      fieldSettings: this.getFieldSettings(),
      officeTypes: this.getOfficeTypes(),
      accessLogs: this.getAccessLogs().slice(0, 100),
    };
  }
}
