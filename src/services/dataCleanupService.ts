import { OfficeProfile, CertificateRecord, AuditCampaign, OfficeAuditEvent, OfficeManager } from '../types';
import { AppUser } from '../types/auth';
import { getSupabaseClient } from '../lib/supabase';

export interface CleanupResult {
  removedCertificatesCount: number;
  removedCampaignsCount: number;
  removedRecordsCount: number;
  removedEventsCount: number;
  removedManagersCount: number;
  unlinkedUsersCount: number;
  unlistedOfficeCodes: string[];
}

/**
 * بررسی و پاکسازی تمام داده‌هایی که به کدهای دفاتری ارجاع داده شده‌اند
 * که در لیست رسمی دفاتر (offices) وجود ندارند.
 */
export function purgeOrphanedOfficeData(
  currentOffices: OfficeProfile[],
  certificates: CertificateRecord[],
  campaigns: AuditCampaign[],
  auditEvents: OfficeAuditEvent[],
  managers: OfficeManager[],
  users: AppUser[]
): {
  cleanedCertificates: CertificateRecord[];
  cleanedCampaigns: AuditCampaign[];
  cleanedAuditEvents: OfficeAuditEvent[];
  cleanedManagers: OfficeManager[];
  cleanedUsers: AppUser[];
  result: CleanupResult;
} {
  const validOfficeCodes = new Set(
    currentOffices
      .map(o => String(o.code || '').trim())
      .filter(Boolean)
  );

  const unlistedCodesSet = new Set<string>();

  // 1. پاکسازی گواهی‌های بدون دفتر
  const cleanedCertificates = certificates.filter(c => {
    const code = c.officeCode ? String(c.officeCode).trim() : '';
    if (!code || validOfficeCodes.has(code)) {
      return true;
    }
    unlistedCodesSet.add(code);
    return false;
  });

  // 2. پاکسازی کمپین‌ها و رکوردهای بازرسی بدون دفتر
  let removedRecordsCount = 0;
  const cleanedCampaigns = campaigns
    .filter(camp => {
      const code = camp.officeCode ? String(camp.officeCode).trim() : '';
      if (!code || validOfficeCodes.has(code)) {
        return true;
      }
      unlistedCodesSet.add(code);
      if (camp.records) {
        removedRecordsCount += camp.records.length;
      }
      return false;
    })
    .map(camp => {
      if (!camp.records) return camp;
      const initialCount = camp.records.length;
      const validRecords = camp.records.filter(r => {
        const code = r.officeCode ? String(r.officeCode).trim() : '';
        return !code || validOfficeCodes.has(code);
      });
      removedRecordsCount += (initialCount - validRecords.length);
      return {
        ...camp,
        records: validRecords,
        selectedSampleCount: validRecords.length,
      };
    });

  // 3. پاکسازی وقایع ممیزی دفاتر بدون دفتر
  const cleanedAuditEvents = auditEvents.filter(e => {
    const code = e.officeCode ? String(e.officeCode).trim() : '';
    if (!code || validOfficeCodes.has(code)) {
      return true;
    }
    unlistedCodesSet.add(code);
    return false;
  });

  // 4. پاکسازی مسئولین بدون دفتر
  const cleanedManagers = managers.filter(m => {
    const code = m.assignedOfficeCode ? String(m.assignedOfficeCode).trim() : '';
    if (!code || validOfficeCodes.has(code)) {
      return true;
    }
    unlistedCodesSet.add(code);
    return false;
  });

  // 5. پاکسازی یا لغو انتساب کاربران دارای کد دفتر نامعتبر
  let unlinkedUsersCount = 0;
  const cleanedUsers = users.map(u => {
    if (u.role === 'OFFICE_USER') {
      const code = u.assignedOfficeCode ? String(u.assignedOfficeCode).trim() : '';
      if (code && !validOfficeCodes.has(code)) {
        unlinkedUsersCount++;
        unlistedCodesSet.add(code);
        return {
          ...u,
          assignedOfficeCode: undefined,
          assignedOfficeName: undefined,
          notes: `${u.notes || ''} [دفتر قبلی (${code}) از سیستم حذف شد]`.trim(),
        };
      }
    }
    return u;
  });

  const result: CleanupResult = {
    removedCertificatesCount: certificates.length - cleanedCertificates.length,
    removedCampaignsCount: campaigns.length - cleanedCampaigns.length,
    removedRecordsCount,
    removedEventsCount: auditEvents.length - cleanedAuditEvents.length,
    removedManagersCount: managers.length - cleanedManagers.length,
    unlinkedUsersCount,
    unlistedOfficeCodes: Array.from(unlistedCodesSet),
  };

  return {
    cleanedCertificates,
    cleanedCampaigns,
    cleanedAuditEvents,
    cleanedManagers,
    cleanedUsers,
    result,
  };
}

/**
 * پاکسازی مستقیم داده‌های سرگردان از Supabase
 */
export async function purgeOrphanedDataFromSupabase(validOfficeCodes: string[]): Promise<{ success: boolean; message: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, message: 'اتصال به Supabase برقرار نیست.' };
  }

  try {
    const codes = validOfficeCodes.map(c => String(c).trim()).filter(Boolean);
    
    // دریافت دفاتر موجود در دیتابیس
    const { data: dbOffices, error: offErr } = await supabase.from('offices').select('code');
    if (offErr) throw offErr;

    const dbCodes = (dbOffices || []).map((o: any) => String(o.code).trim());
    const codesToDeleteFromDb = dbCodes.filter(c => !codes.includes(c));

    if (codesToDeleteFromDb.length > 0) {
      // 1. حذف گواهی‌های دفاتر ناموجود
      await supabase.from('certificates').delete().in('office_code', codesToDeleteFromDb);
      
      // 2. حذف رکوردهای بازرسی
      await supabase.from('audit_inspection_records').delete().in('office_code', codesToDeleteFromDb);

      // 3. حذف کمپین‌های بازرسی
      await supabase.from('audit_campaigns').delete().in('office_code', codesToDeleteFromDb);

      // 4. حذف وقایع ممیزی
      await supabase.from('office_audit_events').delete().in('office_code', codesToDeleteFromDb);

      // 5. حذف دفاتر ناموجود از جدول offices
      await supabase.from('offices').delete().in('code', codesToDeleteFromDb);
    }

    return { 
      success: true, 
      message: `تعداد ${codesToDeleteFromDb.length} کد دفتر نامعتبر و داده‌های وابسته آن‌ها در دیتابیس Supabase با موفقیت پاکسازی شدند.` 
    };
  } catch (err: any) {
    console.error('Error purging orphaned data from Supabase:', err);
    return { success: false, message: err.message || 'خطا در پاکسازی دیتابیس ابری' };
  }
}
