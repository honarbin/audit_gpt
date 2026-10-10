import { AuditCampaign, AuditInspectionRecord, OfficeAuditEvent, OfficeManager, OfficeProfile, AppNotification, UserAccessLog } from '../types';
import { AppUser } from '../types/auth';
import { normalizeDigits } from './authService';

export interface BootstrapResponse {
  success: boolean;
  users: AppUser[];
  offices: OfficeProfile[];
  managers: OfficeManager[];
  campaigns: AuditCampaign[];
  auditEvents: OfficeAuditEvent[];
  notifications: AppNotification[];
  fieldSettings: any;
  officeTypes: any[];
  accessLogs: UserAccessLog[];
}

/**
 * دریافت کامل آخرین وضعیت پایگاه داده متمرکز سرور در آغاز به کار برنامه
 */
export async function fetchSystemBootstrap(): Promise<BootstrapResponse | null> {
  try {
    const res = await fetch('/api/v1/system/bootstrap');
    if (res.ok) {
      const data = await res.json();
      if (data && data.success) {
        return data as BootstrapResponse;
      }
    }
  } catch (err) {
    console.warn('[centralSyncService] Bootstrap fetch failed or offline:', err);
  }
  return null;
}

/**
 * احراز هویت متمرکز کاربر با سرور اصلی با لایه تاب‌آوری بالا و تلاش مجدد
 */
export async function serverLogin(
  usernameOrNid: string,
  password: string
): Promise<{ success: boolean; user?: AppUser; error?: string; isNetworkError?: boolean }> {
  const cleanUser = normalizeDigits(usernameOrNid).trim();
  const cleanPass = normalizeDigits(password).trim();

  // Helper for single attempt with 15s timeout
  const doAttempt = async (): Promise<{ success: boolean; user?: AppUser; error?: string; isNetworkError?: boolean }> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ username: cleanUser, password: cleanPass }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await res.json().catch(() => null);
      if (data && typeof data === 'object') {
        return data;
      }
      return { success: false, error: 'پاسخ نامعتبر از سرور پایگاه داده دریافت گردید.' };
    } catch (err: any) {
      clearTimeout(timeoutId);
      throw err;
    }
  };

  try {
    return await doAttempt();
  } catch (firstErr: any) {
    console.warn('[centralSyncService] First login attempt failed, retrying after 350ms...', firstErr);
    // یک‌بار تلاش مجدد سریع در صورت تاخیر یا قطعی لحظه‌ای
    await new Promise((resolve) => setTimeout(resolve, 350));
    try {
      return await doAttempt();
    } catch (retryErr: any) {
      console.warn('[centralSyncService] Retry login attempt failed:', retryErr);
      return { 
        success: false, 
        isNetworkError: true, 
        error: 'عدم برقراری ارتباط با سرور پایگاه داده' 
      };
    }
  }
}

/**
 * همگام‌سازی تمامی دوره‌های بازرسی با سرور (ذخیره فوری و بدون تاخیر)
 */
export async function syncCampaignsToServer(campaigns: AuditCampaign[]): Promise<boolean> {
  try {
    const res = await fetch('/api/v1/campaigns/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaigns }),
    });
    return res.ok;
  } catch (err) {
    console.warn('[centralSyncService] Failed to sync campaigns to server:', err);
    return false;
  }
}

/**
 * ثبت یا به‌روزرسانی آنی یک دوره بازرسی
 */
export async function syncSingleCampaignToServer(campaign: AuditCampaign): Promise<boolean> {
  try {
    const res = await fetch('/api/v1/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campaign),
    });
    return res.ok;
  } catch (err) {
    console.warn('[centralSyncService] Failed to save campaign:', err);
    return false;
  }
}

/**
 * ثبت فوری وضعیت یک رکورد/پرونده بازرسی (آپلود مدرک، تصمیم بازرسی، نقص)
 */
export async function syncCampaignRecordToServer(
  campaignId: string,
  record: AuditInspectionRecord
): Promise<boolean> {
  try {
    const res = await fetch('/api/v1/campaigns/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId, record }),
    });
    return res.ok;
  } catch (err) {
    console.warn('[centralSyncService] Failed to save record:', err);
    return false;
  }
}

/**
 * حذف یک دوره بازرسی از سرور
 */
export async function deleteCampaignFromServer(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/v1/campaigns/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (err) {
    console.warn('[centralSyncService] Failed to delete campaign:', err);
    return false;
  }
}

/**
 * همگام‌سازی فوری رویدادهای ممیزی (تذکرات، تعهدات، تعلیق‌ها) در دیتابیس سرور
 */
export async function syncAuditEventsToServer(auditEvents: OfficeAuditEvent[]): Promise<boolean> {
  try {
    const res = await fetch('/api/v1/audit-events/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auditEvents }),
    });
    return res.ok;
  } catch (err) {
    console.warn('[centralSyncService] Failed to sync audit events:', err);
    return false;
  }
}

/**
 * ثبت فوری یک رویداد نظارتی در سرور
 */
export async function syncSingleAuditEventToServer(event: OfficeAuditEvent): Promise<boolean> {
  try {
    const res = await fetch('/api/v1/audit-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    return res.ok;
  } catch (err) {
    console.warn('[centralSyncService] Failed to save audit event:', err);
    return false;
  }
}

/**
 * همگام‌سازی فوری دفاتر ثبت‌نام با سرور
 */
export async function syncOfficesToServer(offices: OfficeProfile[]): Promise<boolean> {
  try {
    const res = await fetch('/api/v1/offices/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offices }),
    });
    return res.ok;
  } catch (err) {
    console.warn('[centralSyncService] Failed to sync offices:', err);
    return false;
  }
}

/**
 * ثبت یا به‌روزرسانی فوری یک دفتر در سرور
 */
export async function syncSingleOfficeToServer(office: OfficeProfile): Promise<boolean> {
  try {
    const res = await fetch('/api/v1/offices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(office),
    });
    return res.ok;
  } catch (err) {
    console.warn('[centralSyncService] Failed to save office:', err);
    return false;
  }
}

/**
 * حذف یک دفتر از سرور
 */
export async function deleteOfficeFromServer(code: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/v1/offices/${encodeURIComponent(code)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (err) {
    console.warn('[centralSyncService] Failed to delete office:', err);
    return false;
  }
}

/**
 * همگام‌سازی فوری مسئولین دفاتر با سرور
 */
export async function syncManagersToServer(managers: OfficeManager[]): Promise<boolean> {
  try {
    const res = await fetch('/api/v1/managers/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ managers }),
    });
    return res.ok;
  } catch (err) {
    console.warn('[centralSyncService] Failed to sync managers:', err);
    return false;
  }
}

/**
 * همگام‌سازی فوری اعلانات با سرور
 */
export async function syncNotificationsToServer(notifications: AppNotification[]): Promise<boolean> {
  try {
    const res = await fetch('/api/v1/notifications/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notifications }),
    });
    return res.ok;
  } catch (err) {
    console.warn('[centralSyncService] Failed to sync notifications:', err);
    return false;
  }
}

/**
 * همگام‌سازی تنظیمات فیلدهای فرم
 */
export async function syncFieldSettingsToServer(fieldSettings: any): Promise<boolean> {
  try {
    const res = await fetch('/api/v1/field-settings/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fieldSettings }),
    });
    return res.ok;
  } catch (err) {
    console.warn('[centralSyncService] Failed to sync field settings:', err);
    return false;
  }
}

/**
 * همگام‌سازی انواع دفاتر
 */
export async function syncOfficeTypesToServer(officeTypes: any[]): Promise<boolean> {
  try {
    const res = await fetch('/api/v1/office-types/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ officeTypes }),
    });
    return res.ok;
  } catch (err) {
    console.warn('[centralSyncService] Failed to sync office types:', err);
    return false;
  }
}

/**
 * ثبت لاگ تردد در سرور
 */
export async function syncAccessLogToServer(log: UserAccessLog): Promise<boolean> {
  try {
    const res = await fetch('/api/v1/access-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log),
    });
    return res.ok;
  } catch (err) {
    console.warn('[centralSyncService] Failed to save access log:', err);
    return false;
  }
}
