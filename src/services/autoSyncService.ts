import { isSupabaseReady } from '../lib/supabase';
import {
  upsertOfficeToSupabase,
  deleteOfficeFromSupabase,
  upsertCampaignToSupabase,
  upsertInspectionRecordToSupabase,
  upsertAuditEventToSupabase,
} from './supabaseService';
import {
  syncSingleOfficeToServer,
  deleteOfficeFromServer,
  syncSingleCampaignToServer,
  syncCampaignRecordToServer,
  syncSingleAuditEventToServer,
} from './centralSyncService';
import { OfficeProfile, AuditCampaign, AuditInspectionRecord, OfficeAuditEvent } from '../types';

export type SyncStatus = 'IDLE' | 'SYNCING' | 'SUCCESS' | 'ERROR' | 'OFFLINE';

const STORAGE_KEY_AUTO_SYNC = 'ra_audit_auto_sync_enabled';

let currentStatus: SyncStatus = 'IDLE';
let lastStatusMessage = 'سامانه به سرور مرکزی متصل است';
const listeners = new Set<(status: SyncStatus, message: string) => void>();

function notify(status: SyncStatus, message = '') {
  currentStatus = status;
  lastStatusMessage = message;
  listeners.forEach((fn) => fn(status, message));
}

export function isAutoSyncEnabled(): boolean {
  const stored = localStorage.getItem(STORAGE_KEY_AUTO_SYNC);
  return stored !== 'false'; // Default to true
}

export function setAutoSyncEnabled(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY_AUTO_SYNC, enabled ? 'true' : 'false');
  if (!enabled) {
    notify('IDLE', 'همگام‌سازی بلادرنگ غیرفعال شد');
  } else {
    notify('IDLE', 'همگام‌سازی بلادرنگ با سرور مرکزی فعال است');
  }
}

export function getSyncStatus(): { status: SyncStatus; message: string } {
  return { status: currentStatus, message: lastStatusMessage };
}

export function subscribeToSyncStatus(listener: (status: SyncStatus, message: string) => void): () => void {
  listeners.add(listener);
  listener(currentStatus, lastStatusMessage);
  return () => {
    listeners.delete(listener);
  };
}

let syncTimeout: any = null;

function triggerSuccessWithReset(msg = 'تغییرات در سرور پایگاه داده ثبت شد') {
  notify('SUCCESS', msg);
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    notify('IDLE', 'سامانه با سرور مرکزی همگام است');
  }, 3000);
}

/**
 * ذخیره و همگام‌سازی آنی دفتر ثبت‌نام در دیتابیس متمرکز و Supabase
 */
export async function autoSyncOffice(office: OfficeProfile): Promise<boolean> {
  if (!isAutoSyncEnabled()) return false;
  try {
    notify('SYNCING', `در حال ثبت خودکار دفتر «${office.name}» در پایگاه داده...`);
    // 1. ذخیره در سرور مرکزی متمرکز
    const serverOk = await syncSingleOfficeToServer(office);
    // 2. همگام‌سازی با Supabase در صورت فعال بودن
    if (isSupabaseReady()) {
      await upsertOfficeToSupabase(office).catch((e) => console.warn('Supabase office sync skipped:', e));
    }
    if (serverOk) {
      triggerSuccessWithReset(`دفتر «${office.name}» در پایگاه داده ذخیره شد`);
      return true;
    }
    return false;
  } catch (err: any) {
    console.warn('AutoSync office error:', err);
    notify('ERROR', 'خطا در ثبت خودکار دفتر در پایگاه داده');
    return false;
  }
}

/**
 * حذف آنی دفتر از دیتابیس متمرکز و Supabase
 */
export async function autoDeleteOffice(code: string): Promise<boolean> {
  if (!isAutoSyncEnabled()) return false;
  try {
    notify('SYNCING', `در حال حذف دفتر کد «${code}» از پایگاه داده...`);
    const serverOk = await deleteOfficeFromServer(code);
    if (isSupabaseReady()) {
      await deleteOfficeFromSupabase(code).catch((e) => console.warn('Supabase office delete skipped:', e));
    }
    if (serverOk) {
      triggerSuccessWithReset(`دفتر کد «${code}» از دیتابیس حذف گردید`);
      return true;
    }
    return false;
  } catch (err: any) {
    console.warn('AutoDelete office error:', err);
    notify('ERROR', 'خطا در حذف دفتر از دیتابیس');
    return false;
  }
}

/**
 * ذخیره آنی کمپین بازرسی در دیتابیس متمرکز و Supabase
 */
export async function autoSyncCampaign(campaign: AuditCampaign): Promise<boolean> {
  if (!isAutoSyncEnabled()) return false;
  try {
    notify('SYNCING', `در حال همگام‌سازی دوره بازرسی «${campaign.title}» با سرور...`);
    const serverOk = await syncSingleCampaignToServer(campaign);
    if (isSupabaseReady()) {
      await upsertCampaignToSupabase(campaign).catch((e) => console.warn('Supabase campaign sync skipped:', e));
    }
    if (serverOk) {
      triggerSuccessWithReset(`دوره بازرسی در پایگاه داده متمرکز ثبت گردید`);
      return true;
    }
    return false;
  } catch (err: any) {
    console.warn('AutoSync campaign error:', err);
    notify('ERROR', 'خطا در ثبت دوره بازرسی در دیتابیس');
    return false;
  }
}

/**
 * ذخیره آنی ردیف بازرسی یا مدرک جدید در دیتابیس متمرکز و Supabase
 */
export async function autoSyncInspectionRecord(record: AuditInspectionRecord): Promise<boolean> {
  if (!isAutoSyncEnabled()) return false;
  try {
    notify('SYNCING', `در حال ارسال وضعیت بازرسی پرونده...`);
    const campaignId = record.campaignId;
    let serverOk = true;
    if (campaignId) {
      serverOk = await syncCampaignRecordToServer(campaignId, record);
    }
    if (isSupabaseReady()) {
      await upsertInspectionRecordToSupabase(record).catch((e) => console.warn('Supabase record sync skipped:', e));
    }
    if (serverOk) {
      triggerSuccessWithReset(`پرونده بازرسی در سرور پایگاه داده ذخیره شد`);
      return true;
    }
    return false;
  } catch (err: any) {
    console.warn('AutoSync record error:', err);
    notify('ERROR', 'خطا در ارسال رکورد به پایگاه داده');
    return false;
  }
}

/**
 * ذخیره آنی رویداد ممیزی (اخطار، تعهدنامه، تعلیق و ...) در دیتابیس متمرکز و Supabase
 */
export async function autoSyncAuditEvent(event: OfficeAuditEvent): Promise<boolean> {
  if (!isAutoSyncEnabled()) return false;
  try {
    notify('SYNCING', `در حال ذخیره رویداد «${event.title}» در پایگاه داده...`);
    const serverOk = await syncSingleAuditEventToServer(event);
    if (isSupabaseReady()) {
      await upsertAuditEventToSupabase(event).catch((e) => console.warn('Supabase audit event sync skipped:', e));
    }
    if (serverOk) {
      triggerSuccessWithReset(`رویداد ممیزی در پایگاه داده ثبت شد`);
      return true;
    }
    return false;
  } catch (err: any) {
    console.warn('AutoSync audit event error:', err);
    notify('ERROR', 'خطا در ذخیره رویداد ممیزی در دیتابیس');
    return false;
  }
}
