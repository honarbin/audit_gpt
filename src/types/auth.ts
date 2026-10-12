// User Roles and Permissions System
export type UserRole = 
  | 'SYSTEM_ADMIN'      // مدیر ارشد سیستم و مقام بالاتر مرکز بازرسی و نظارت دفاتر (دسترسی کامل)
  | 'SENIOR_INSPECTOR'  // بازرس ارشد و مقام عالی ممیزی (سطح ۲: دسترسی کامل نظارتی، صدور آرای قطعی، تصمیم‌گیری نهایی و پایش تذکرات)
  | 'INSPECTOR'         // کارشناس بازرسی رده پایین‌تر (سطح ۱: بررسی مدارک، ثبت نواقص، برگشت به دفتر یا ارسال به بازرس ارشد - بدون صدور رأی قطعی)
  | 'OFFICE_USER';      // نماینده / مسئول دفتر ثبت نام (دسترسی انحصاری به کارتابل دفتر خود، بارگذاری مدارک، پاسخ به نواقص)

export interface UserPermissionConfig {
  canManageUsers: boolean;             // مدیریت کاربران و رمزها
  canManageOffices: boolean;           // مدیریت دفاتر و مسئولین
  canRunSampling: boolean;             // بارگذاری اکسل و نمونه‌گیری
  canViewAllOffices: boolean;          // دسترسی به اطلاعات همه دفاتر
  canReviewAndVerdict: boolean;        // بررسی و ثبت نظر کارشناسی بازرسی
  canIssueFinalVerdict: boolean;       // صدور رأی قطعی نهایی و حکم انضباطی (مختص بازرس ارشد و مقام بالاتر)
  canSuperviseWarnings: boolean;       // رصد و نظارت زنده بر تذکرات و اخطارهای کارشناسان به دفاتر
  canModifySampleSelection: boolean;   // اختیار مدیریت و جایگزینی نمونه‌ها (مختص بازرس ارشد و مقام بالاتر)
  canUploadOfficeDocuments: boolean;   // بارگذاری مدارک و تعهدات دفتر
  canViewAnalytics: boolean;           // مشاهده گزارشات و نمودارها
  canManageNotifications: boolean;     // مدیریت کانال‌های وب‌هوک و پیامک
  canManageDatabaseSync: boolean;      // همگام‌سازی و تغییر پیکربندی دیتابیس
  canManageSystemConfig: boolean;      // تنظیمات مدیریتی سیستم و سیاست‌های حاکمیتی
  canEditOwnProfile: boolean;          // ویرایش رمز و اطلاعات کاربری خود
}

export interface UserAccessLog {
  id: string;
  userId: string;
  username: string;
  fullName: string;
  role: UserRole;
  officeCode?: string;
  officeName?: string;
  actionType: 'LOGIN' | 'LOGOUT' | 'PASSWORD_CHANGE' | 'VIEW_NOTIFICATIONS' | 'UPDATE_RECORD' | 'DELETE_USER' | 'DATA_SYNC' | 'DOCUMENT_VIEW' | 'DOCUMENT_DOWNLOAD' | 'DOCUMENT_UPLOAD' | 'DOCUMENT_DELETE';
  timestamp: string;          // ISO String or Persian Formatted
  ipAddress?: string;
  userAgent?: string;
  details?: string;
}

export interface AppUser {
  id: string;
  username: string;                    // نام کاربری
  nationalId: string;                  // کدملی
  passwordHash: string;                // رمز عبور (یا هش شبیه‌سازی شده)
  fullName: string;                    // نام و نام خانوادگی
  role: UserRole;                      // نقش کاربر
  mobilePhone?: string;                // شماره موبایل
  email?: string;                      // ایمیل
  assignedOfficeCode?: string;         // کد دفتر منتسب (فقط برای OFFICE_USER اجباری است)
  assignedOfficeName?: string;         // نام دفتر منتسب
  isActive: boolean;                   // وضعیت فعال/غیرفعال بودن حساب
  isPasswordChanged?: boolean;         // آیا رمز عبور اولیه تغییر یافته است؟ (برای اولین لاگین اجباری)
  lastSeenNotificationsAt?: string;    // تاریخ و ساعت آخرین مشاهده و بازدید اعلان‌ها
  customPermissions?: Partial<UserPermissionConfig>; // دسترسی‌های سفارشی
  lastLoginAt?: string;                // آخرین ورود
  createdAt: string;                   // تاریخ ایجاد کاربر
  notes?: string;                      // یادداشت‌ها
}

export interface AuthSession {
  user: AppUser;
  token: string;
  loginTime: string;
  expiresAt: string;
}

// Role Default Permissions Map
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, UserPermissionConfig> = {
  SYSTEM_ADMIN: {
    canManageUsers: true,
    canManageOffices: true,
    canRunSampling: true,
    canViewAllOffices: true,
    canReviewAndVerdict: true,
    canIssueFinalVerdict: true,
    canSuperviseWarnings: true,
    canModifySampleSelection: true,  // مقام بالاتر: دسترسی کامل مدیریتی و نظارتی
    canUploadOfficeDocuments: true,
    canViewAnalytics: true,
    canManageNotifications: true,
    canManageDatabaseSync: true,
    canManageSystemConfig: true,
    canEditOwnProfile: true,
  },
  SENIOR_INSPECTOR: {
    canManageUsers: true,            // بازرس ارشد و سرپرست ممیزی: دسترسی کامل
    canManageOffices: true,
    canRunSampling: true,
    canViewAllOffices: true,
    canReviewAndVerdict: true,
    canIssueFinalVerdict: true,      // سطح ۲ ممیزی: اختیار کامل صدور رأی قطعی و احکام نظارتی
    canSuperviseWarnings: true,      // رصد زنده تذکرات و اخطارهای کارشناس به دفاتر
    canModifySampleSelection: true,  // دسترسی کامل به فرآیند بازرسی و نمونه‌گیری
    canUploadOfficeDocuments: true,
    canViewAnalytics: true,
    canManageNotifications: true,
    canManageDatabaseSync: true,
    canManageSystemConfig: true,
    canEditOwnProfile: true,
  },
  INSPECTOR: {
    canManageUsers: false,           // کارشناس بازرسی رده پایین‌تر: دسترسی محدود
    canManageOffices: false,
    canRunSampling: false,
    canViewAllOffices: true,
    canReviewAndVerdict: true,       // سطح ۱ ممیزی: صرفاً بررسی مدارک و ثبت نواقص
    canIssueFinalVerdict: false,     // قفل: فقط می‌تواند به دفتر برگشت دهد یا به بازرس ارشد ارجاع دهد
    canSuperviseWarnings: false,     // قفل: فاقد دسترسی نظارت سرپرستی
    canModifySampleSelection: false, // قفل قطعی: عدم امکان دخل و تصرف یا جایگزینی در نمونه‌ها
    canUploadOfficeDocuments: false,
    canViewAnalytics: true,
    canManageNotifications: false,
    canManageDatabaseSync: false,
    canManageSystemConfig: false,
    canEditOwnProfile: true,
  },
  OFFICE_USER: {
    canManageUsers: false,
    canManageOffices: false,
    canRunSampling: false,
    canViewAllOffices: false,
    canReviewAndVerdict: false,
    canIssueFinalVerdict: false,
    canSuperviseWarnings: false,
    canModifySampleSelection: false,
    canUploadOfficeDocuments: true,
    canViewAnalytics: false,
    canManageNotifications: false,
    canManageDatabaseSync: false,
    canManageSystemConfig: false,
    canEditOwnProfile: true,
  },
};
