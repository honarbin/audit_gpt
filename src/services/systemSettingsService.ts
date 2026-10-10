import { OfficeAuditEvent } from '../types';
import { UserAccessLog } from '../types/auth';
import { getStoredAccessLogs, saveStoredAccessLogs } from './authService';

export interface AdminSystemSettings {
  // آیا نام بازرس پرونده برای دفاتر ثبت‌نام قابل مشاهده باشد؟
  isInspectorVisibleToOffice: boolean;
  // عنوان سازمانی جایگزین در صورت مخفی بودن نام کارشناس
  anonymousInspectorTitle: string;

  // سیاست نگهداری و پاکسازی لاگ‌ها
  logRetentionPolicy: 'NEVER' | '7_DAYS' | '30_DAYS' | '90_DAYS' | '180_DAYS' | '365_DAYS';
  autoPruneLogsEnabled: boolean;
  lastPrunedAt?: string;
}

export const STORAGE_KEY_ADMIN_SYSTEM_SETTINGS = 'ra_admin_system_settings_v2';

export const DEFAULT_ADMIN_SYSTEM_SETTINGS: AdminSystemSettings = {
  isInspectorVisibleToOffice: false, // به صورت پیش‌فرض سازمانی و محرمانه
  anonymousInspectorTitle: 'واحد نظارت و ممیزی دفاتر صدور گواهی',
  logRetentionPolicy: 'NEVER',
  autoPruneLogsEnabled: false,
};

/**
 * دریافت تنظیمات مدیریتی سیستم
 */
export function getAdminSystemSettings(): AdminSystemSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ADMIN_SYSTEM_SETTINGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_ADMIN_SYSTEM_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.error('Error reading admin system settings:', e);
  }
  return DEFAULT_ADMIN_SYSTEM_SETTINGS;
}

/**
 * ذخیره تنظیمات مدیریتی سیستم
 */
export function saveAdminSystemSettings(settings: Partial<AdminSystemSettings>): AdminSystemSettings {
  const current = getAdminSystemSettings();
  const updated: AdminSystemSettings = {
    ...current,
    ...settings,
  };
  try {
    localStorage.setItem(STORAGE_KEY_ADMIN_SYSTEM_SETTINGS, JSON.stringify(updated));
  } catch (e) {
    console.error('Error saving admin system settings:', e);
  }
  return updated;
}

/**
 * بررسی اینکه آیا نام کارشناس بازرسی برای دفتر ثبت‌نام قابل رویت است یا خیر
 */
export function isInspectorVisibleToOffice(): boolean {
  return getAdminSystemSettings().isInspectorVisibleToOffice;
}

/**
 * برگرداندن نام مؤثر بازرس برای دفتر ثبت‌نام با توجه به تنظیمات حاکمیتی
 */
export function getEffectiveInspectorNameForOffice(realInspectorName?: string | null): string {
  const settings = getAdminSystemSettings();
  if (settings.isInspectorVisibleToOffice) {
    return (realInspectorName && realInspectorName.trim()) ? realInspectorName : 'کارشناس بازرسی';
  }
  return settings.anonymousInspectorTitle || 'واحد نظارت و بازرسی مرکز میانی';
}

/**
 * تبدیل ارقام فارسی و عربی به ارقام انگلیسی جهت پردازش ریاضی و تاریخ
 */
export function toEnglishDigits(str?: string | null): string {
  if (!str) return '';
  const fa = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const ar = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let res = String(str);
  for (let i = 0; i < 10; i++) {
    res = res.replaceAll(fa[i], i.toString()).replaceAll(ar[i], i.toString());
  }
  return res;
}

/**
 * تبدیل رشته تاریخ شمسی یا میلادی به تایم‌استمپ میلی‌ثانیه‌ای با پشتیبانی کامل از ارقام فارسی
 */
export function parseDateToTimestamp(dateStr?: string | null, fallbackId?: string | null): number | null {
  if (!dateStr && !fallbackId) return null;

  // ۱. بررسی ارقام انگلیسی پس از نرمال‌سازی
  const normalized = toEnglishDigits(dateStr || '').trim();

  if (normalized) {
    // اگر تاریخ استاندارد ISO یا عددی بود
    const parsed = Date.parse(normalized);
    if (!isNaN(parsed)) return parsed;

    // استخراج تمامی اعداد تاریخ (سال، ماه، روز، ساعت، دقیقه، ثانیه)
    const numbers = normalized.match(/\d+/g)?.map(n => parseInt(n, 10)) || [];
    if (numbers.length >= 3 && numbers[0] > 1300 && numbers[0] < 1500) {
      const [jy, jm, jd] = numbers;
      const hour = numbers[3] || 0;
      const minute = numbers[4] || 0;
      const second = numbers[5] || 0;

      // الگوریتم دقیق تبدیل تقویم جلالی (هجری شمسی) به گرگوری (میلادی)
      const jyAdj = jy + 1595;
      let days = -355668 + (365 * jyAdj) + Math.floor(jyAdj / 33) * 8 + Math.floor(((jyAdj % 33) + 3) / 4) + jd + (jm < 7 ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
      let gy = 400 * Math.floor(days / 146097);
      days %= 146097;
      if (days > 36524) {
        days--;
        gy += 100 * Math.floor(days / 36524);
        days %= 36524;
        if (days >= 365) days++;
      }
      gy += 4 * Math.floor(days / 1461);
      days %= 1461;
      if (days > 365) {
        days--;
        gy += Math.floor(days / 365);
        days %= 365;
      }
      let gd = days + 1;
      const salA = [0, 31, (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      let gm = 0;
      for (gm = 0; gm < 13; gm++) {
        const v = salA[gm];
        if (gd <= v) break;
        gd -= v;
      }

      const d = new Date(Date.UTC(gy, gm - 1, gd, hour, minute, second));
      return d.getTime();
    }
  }

  // ۲. در صورتی که تاریخ قابل تبدیل نبود، تلاش برای استخراج تایم‌استمپ از شناسه لاگ (log-171...)
  if (fallbackId) {
    const match = fallbackId.match(/log-(\d{10,13})/);
    if (match && match[1]) {
      const ts = parseInt(match[1], 10);
      if (!isNaN(ts) && ts > 1000000000000) return ts;
    }
  }

  return null;
}

/**
 * پاکسازی کامل تمامی لاگ‌های تردد
 */
export function clearAllAccessLogs(): { removedCount: number } {
  const allLogs = getStoredAccessLogs();
  const count = allLogs.length;
  saveStoredAccessLogs([]);
  return { removedCount: count };
}

/**
 * پاکسازی لاگ‌های دسترسی (UserAccessLogs) قدیمی‌تر از یک زمان مشخص
 */
export function pruneAccessLogsBeforeTimestamp(cutoffMs: number): { removedCount: number; remainingCount: number } {
  const allLogs = getStoredAccessLogs();

  // اگر زمان نامحدود یا بالاتر از اکنون باشد، کلیه لاگ‌ها حذف می‌شوند
  if (cutoffMs >= Date.now()) {
    saveStoredAccessLogs([]);
    return { removedCount: allLogs.length, remainingCount: 0 };
  }

  const remaining = allLogs.filter(log => {
    const ts = parseDateToTimestamp(log.timestamp, log.id);
    if (ts === null) {
      // در صورت عدم تشخیص تاریخ با توجه به ساختار log-${timestamp}
      return false; // برای سبک‌سازی واقعی لاگ‌های ناشناخته/نامعتبر قدیمی نگهداری نشوند
    }
    return ts >= cutoffMs;
  });

  const removedCount = allLogs.length - remaining.length;
  saveStoredAccessLogs(remaining);
  return { removedCount, remainingCount: remaining.length };
}

/**
 * پاکسازی رویدادهای ممیزی و تایم‌لاین (OfficeAuditEvents) قدیمی‌تر از یک زمان مشخص
 */
export function pruneAuditEventsBeforeTimestamp(
  events: OfficeAuditEvent[],
  cutoffMs: number
): { updatedEvents: OfficeAuditEvent[]; removedCount: number } {
  if (cutoffMs >= Date.now()) {
    return { updatedEvents: [], removedCount: events.length };
  }

  const remaining = events.filter(e => {
    const ts = parseDateToTimestamp(e.eventDate, e.id);
    if (ts === null) return true;
    return ts >= cutoffMs;
  });

  const removedCount = events.length - remaining.length;
  return { updatedEvents: remaining, removedCount };
}

/**
 * بررسی و اجرای خودکار پاکسازی لاگ‌ها بر اساس خط‌مشی نگهداری (Log Retention Policy)
 */
export function checkAndRunAutoPruning(
  auditEvents?: OfficeAuditEvent[],
  onEventsUpdated?: (newEvents: OfficeAuditEvent[]) => void
): { pruned: boolean; message?: string } {
  const settings = getAdminSystemSettings();
  if (!settings.autoPruneLogsEnabled || settings.logRetentionPolicy === 'NEVER') {
    return { pruned: false };
  }

  const daysMap: Record<string, number> = {
    '7_DAYS': 7,
    '30_DAYS': 30,
    '90_DAYS': 90,
    '180_DAYS': 180,
    '365_DAYS': 365,
  };

  const days = daysMap[settings.logRetentionPolicy];
  if (!days) return { pruned: false };

  // زمان آستانه
  const cutoffMs = Date.now() - days * 86400000;

  // پاکسازی لاگ‌های دسترسی
  const accessResult = pruneAccessLogsBeforeTimestamp(cutoffMs);

  // پاکسازی رویدادهای تایم‌لاین اگر پاس داده شده باشد
  let eventRemoved = 0;
  if (auditEvents && onEventsUpdated) {
    const evtResult = pruneAuditEventsBeforeTimestamp(auditEvents, cutoffMs);
    eventRemoved = evtResult.removedCount;
    if (eventRemoved > 0) {
      onEventsUpdated(evtResult.updatedEvents);
    }
  }

  // ثبت تاریخ آخرین پاکسازی خودکار
  saveAdminSystemSettings({
    lastPrunedAt: new Date().toLocaleDateString('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }),
  });

  if (accessResult.removedCount > 0 || eventRemoved > 0) {
    return {
      pruned: true,
      message: `پاکسازی خودکار دوره‌ای لاگ‌ها (${days} روز گذشته) انجام شد: ${accessResult.removedCount} لاگ دسترسی و ${eventRemoved} رویداد ممیزی قدیمی حذف شدند.`
    };
  }

  return { pruned: false };
}
