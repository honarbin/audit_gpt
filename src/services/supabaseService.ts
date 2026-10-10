import { getSupabaseClient, isSupabaseReady } from '../lib/supabase';
import { EXPANDED_INITIAL_OFFICES } from '../data/iranGeoData';
import { 
  OfficeProfile, 
  OfficeTypeDefinition, 
  AuditCampaign, 
  AuditInspectionRecord, 
  CertificateRecord, 
  OfficeAuditEvent, 
  FormFieldSetting,
  FormFieldTarget,
  UploadedDocument,
  AppNotification,
  NotificationChannelConfig
} from '../types';
import { AppUser } from '../types/auth';

/**
 * پاک‌سازی مدارک از رشته‌های باینری سنگین (Base64) قبل از ذخیره در دیتابیس
 * مطابق با معماری استاندارد: اصل فایلهای حجیم وارد دیتابیس نمیشوند و صرفاً شناسه و متادیتای درایو ذخیره میگردند.
 */
export function sanitizeUploadedDocsForDatabase(docs?: UploadedDocument[]): any[] {
  if (!docs || !Array.isArray(docs)) return [];
  return docs.map(doc => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { fileDataUrl, pages, previousVersions, ...metaWithoutBinary } = doc;
    
    // پاک‌سازی رشته باینری صفحات در صورت وجود
    const sanitizedPages = pages?.map(p => ({
      pageNumber: p.pageNumber,
      fileName: p.fileName,
      fileSize: p.fileSize,
    }));

    // پاک‌سازی رشته باینری نسخه‌های قبلی
    const sanitizedHistory = previousVersions?.map(v => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { fileDataUrl: hDataUrl, pages: hPages, ...vRest } = v;
      return vRest;
    });

    return {
      ...metaWithoutBinary,
      fileId: doc.fileId || doc.driveFileId || null,
      storageProvider: doc.storageProvider || (doc.driveFileId ? 'google_drive' : 'server'),
      storageKey: doc.storageKey || null,
      storageFileName: doc.storageFileName || null,
      originalFileName: doc.fileName,
      checksum: doc.checksum || null,
      driveFileId: doc.driveFileId || null,
      driveFolderId: doc.driveFolderId || null,
      driveWebViewLink: doc.driveWebViewLink || null,
      syncStatus: doc.syncStatus || (doc.driveSynced ? 'uploaded' : 'pending'),
      syncErrorMessage: doc.syncErrorMessage || null,
      driveSynced: Boolean(doc.driveSynced),
      driveSyncDate: doc.driveSyncDate || null,
      pages: sanitizedPages,
      previousVersions: sanitizedHistory,
    };
  });
}

// -------------------------------------------------------------
// ۱. جدول دفاتر صدور گواهی (offices)
// -------------------------------------------------------------
export async function fetchOfficesFromSupabase(): Promise<OfficeProfile[] | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('offices')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetch offices warning:', error.message || error);
      return null;
    }

    return (data || []).map((row: any) => ({
      id: row.code,
      code: row.code,
      name: row.name,
      type: row.type,
      customTypeName: row.custom_type_name,
      province: row.province,
      city: row.city,
      address: row.address,
      phone: row.phone,
      email: row.email,
      latitude: row.latitude ? Number(row.latitude) : undefined,
      longitude: row.longitude ? Number(row.longitude) : undefined,
      managerId: row.manager_id,
      managerName: row.manager_name,
      activeCampaignsCount: row.active_campaigns_count || 0,
      status: row.status || 'ACTIVE',
      notes: row.notes,
      createdAt: row.created_at,
    }));
  } catch (err: any) {
    console.warn('Error fetching offices from Supabase:', err?.message || err);
    return null;
  }
}

/**
 * اطمینان از وجود کلیه کدهای دفتر در جدول offices دیتابیس Supabase
 * جهت جلوگیری از خطای قید کلید خارجی (Foreign Key Constraint 23503: certificates_office_code_fkey)
 */
export async function ensureOfficesExistInSupabase(
  officeCodes: string[],
  officeMetadata?: Map<string, any> | Array<{ code: string; name?: string; province?: string; city?: string }>
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase || officeCodes.length === 0) return;

  const validCodes = Array.from(new Set(
    officeCodes
      .map(c => String(c || '').trim())
      .filter(Boolean)
  ));

  if (validCodes.length === 0) return;

  try {
    // 1. بررسی دفاتر موجود در Supabase
    const { data: existingOffices, error: fetchErr } = await supabase
      .from('offices')
      .select('code')
      .in('code', validCodes);

    if (fetchErr) {
      console.warn('Supabase check existing offices warning:', fetchErr);
    }

    const existingCodeSet = new Set((existingOffices || []).map((o: any) => String(o.code).trim()));
    const missingCodes = validCodes.filter(c => !existingCodeSet.has(c));

    if (missingCodes.length === 0) return;

    // 2. ساخت ردیف‌های پیش‌فرض برای دفاتر ناموجود
    const metaLookup = new Map<string, any>();
    if (officeMetadata instanceof Map) {
      officeMetadata.forEach((v, k) => metaLookup.set(String(k).trim(), v));
    } else if (Array.isArray(officeMetadata)) {
      officeMetadata.forEach(o => metaLookup.set(String(o.code).trim(), o));
    }

    const newOfficeRows = missingCodes.map(code => {
      const predefined = EXPANDED_INITIAL_OFFICES.find(o => String(o.code).trim() === code);
      const meta = metaLookup.get(code);

      const name = predefined?.name || meta?.name || meta?.officeName || `دفتر صدور گواهی ${code}`;
      const type = predefined?.type || 'PRESHKHAN';
      const province = predefined?.province || meta?.province || 'تهران';
      const city = predefined?.city || meta?.city || 'تهران';
      const managerName = predefined?.managerName || 'مسئول دفتر';

      return {
        code,
        name,
        username: `office${code}`,
        type,
        province,
        city,
        manager_name: managerName,
        status: 'ACTIVE',
        active_campaigns_count: 0,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
    });

    const { error: insertErr } = await supabase
      .from('offices')
      .upsert(newOfficeRows, { onConflict: 'code' });

    if (insertErr) {
      if (insertErr.code === 'PGRST204' || (typeof insertErr.message === 'string' && insertErr.message.includes('username'))) {
        const fallbackRows = newOfficeRows.map(({ username, ...rest }) => rest);
        const { error: fallbackErr } = await supabase
          .from('offices')
          .upsert(fallbackRows, { onConflict: 'code' });
        if (fallbackErr) {
          console.warn('Fallback office auto-creation warning:', fallbackErr);
        }
      } else {
        console.warn('Auto-create missing offices warning:', insertErr);
      }
    }
  } catch (err) {
    console.warn('ensureOfficesExistInSupabase exception:', err);
  }
}

export async function upsertOfficeToSupabase(office: OfficeProfile): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const safeCode = String(office.code || '').trim() || '1607';
  const baseRow: Record<string, any> = {
    code: safeCode,
    name: office.name || `دفتر ${safeCode}`,
    type: office.type || 'PRESHKHAN',
    custom_type_name: office.customTypeName || null,
    province: office.province || 'تهران',
    city: office.city || 'تهران',
    address: office.address || null,
    phone: office.phone || null,
    email: office.email || null,
    latitude: office.latitude || null,
    longitude: office.longitude || null,
    manager_id: office.managerId || null,
    manager_name: office.managerName || 'مسئول دفتر',
    active_campaigns_count: office.activeCampaignsCount || 0,
    status: office.status || 'ACTIVE',
    notes: office.notes || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('offices')
    .upsert(baseRow, { onConflict: 'code' });

  if (error) {
    console.error('Error upserting office to Supabase:', error);
    throw error;
  }
  return true;
}

// -------------------------------------------------------------
// ۱.۱ جدول کاربران سامانه و دفاتر (app_users)
// -------------------------------------------------------------
export async function fetchUsersFromSupabase(): Promise<AppUser[] | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('Supabase fetch app_users warning:', error.message || error);
      return null;
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      username: row.username,
      nationalId: row.national_id || '',
      passwordHash: row.password_hash || row.username,
      fullName: row.full_name,
      role: row.role,
      mobilePhone: row.mobile_phone,
      email: row.email,
      assignedOfficeCode: row.assigned_office_code,
      assignedOfficeName: row.assigned_office_name,
      isActive: row.is_active ?? true,
      isPasswordChanged: row.is_password_changed ?? false,
      notes: row.notes,
      createdAt: row.created_at,
    }));
  } catch (err: any) {
    console.warn('Error fetching app_users from Supabase:', err?.message || err);
    return null;
  }
}

export async function upsertUserToSupabase(user: AppUser): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const row = {
      id: user.id,
      username: user.username,
      national_id: user.nationalId || null,
      password_hash: user.passwordHash,
      full_name: user.fullName,
      role: user.role,
      mobile_phone: user.mobilePhone || null,
      email: user.email || null,
      assigned_office_code: user.assignedOfficeCode || null,
      assigned_office_name: user.assignedOfficeName || null,
      is_active: user.isActive ?? true,
      is_password_changed: user.isPasswordChanged ?? false,
      notes: user.notes || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('app_users')
      .upsert(row, { onConflict: 'id' });

    if (error) {
      console.warn('Supabase upsert app_user warning:', error.message || error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Error upserting app_user to Supabase:', err);
    return false;
  }
}

export async function upsertUsersToSupabase(users: AppUser[]): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase || !Array.isArray(users) || users.length === 0) return false;

  try {
    const rows = users.map(user => ({
      id: user.id,
      username: user.username,
      national_id: user.nationalId || null,
      password_hash: user.passwordHash,
      full_name: user.fullName,
      role: user.role,
      mobile_phone: user.mobilePhone || null,
      email: user.email || null,
      assigned_office_code: user.assignedOfficeCode || null,
      assigned_office_name: user.assignedOfficeName || null,
      is_active: user.isActive ?? true,
      is_password_changed: user.isPasswordChanged ?? false,
      notes: user.notes || null,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('app_users')
      .upsert(rows, { onConflict: 'id' });

    if (error) {
      console.warn('Supabase upsert app_users batch warning:', error.message || error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Error batch upserting app_users to Supabase:', err);
    return false;
  }
}

export async function deleteOfficeFromSupabase(code: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const cleanCode = String(code).trim();
  try {
    // Delete child records first to satisfy foreign key constraints
    await supabase.from('certificates').delete().eq('office_code', cleanCode);
    await supabase.from('audit_inspection_records').delete().eq('office_code', cleanCode);
    await supabase.from('audit_campaigns').delete().eq('office_code', cleanCode);
    await supabase.from('office_audit_events').delete().eq('office_code', cleanCode);

    const { error } = await supabase
      .from('offices')
      .delete()
      .eq('code', cleanCode);

    if (error) {
      console.error('Error deleting office from Supabase:', error);
      throw error;
    }
    return true;
  } catch (err: any) {
    console.error('Error deleting office and associated records from Supabase:', err);
    throw err;
  }
}

/**
 * پاکسازی کامل دفاتر، گواهی‌ها، پرونده‌ها و وقایع مرتبط از دیتابیس Supabase
 * جهت امکان بارگذاری مجدد و ارسال دوباره اطلاعات تازه
 */
export async function clearAllOfficesAndCertificatesFromSupabase(): Promise<{
  success: boolean;
  message: string;
}> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: true, message: 'دیتابیس ابری فعال نیست؛ پاکسازی در حافظه محلی انجام می‌شود.' };
  }

  try {
    // حذف فرزندان ابتدا به دلیل رعایت کلیدهای خارجی
    await supabase.from('certificates').delete().not('id', 'is', null);
    await supabase.from('audit_inspection_records').delete().not('id', 'is', null);
    await supabase.from('office_audit_events').delete().not('id', 'is', null);
    await supabase.from('audit_campaigns').delete().not('id', 'is', null);
    
    const { error: offErr } = await supabase.from('offices').delete().not('code', 'is', null);
    if (offErr) {
      console.warn('Error deleting offices from Supabase:', offErr);
      throw offErr;
    }

    return {
      success: true,
      message: 'کلیه دفاتر و گواهی‌ها با موفقیت از دیتابیس ابری Supabase پاکسازی شدند.'
    };
  } catch (err: any) {
    console.error('Error clearing offices and certificates from Supabase:', err);
    return {
      success: false,
      message: err.message || 'خطا در برقراری ارتباط با دیتابیس ابری Supabase'
    };
  }
}

// -------------------------------------------------------------
// ۲. جدول انواع دفاتر (office_types)
// -------------------------------------------------------------
export async function fetchOfficeTypesFromSupabase(): Promise<OfficeTypeDefinition[] | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('office_types')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('Supabase fetch office_types warning:', error.message || error);
      return null;
    }

    return (data || []).map((row: any) => ({
      code: row.code,
      title: row.title,
      description: row.description,
      color: row.color,
      iconName: row.icon_name,
      isCustom: row.is_custom,
    }));
  } catch (err: any) {
    console.warn('Error fetching office_types from Supabase:', err?.message || err);
    return null;
  }
}

export async function upsertOfficeTypeToSupabase(typeDef: OfficeTypeDefinition): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const row = {
    code: typeDef.code,
    title: typeDef.title,
    description: typeDef.description || null,
    color: typeDef.color || '#0284c7',
    icon_name: typeDef.iconName || 'Building2',
    is_custom: Boolean(typeDef.isCustom),
  };

  const { error } = await supabase
    .from('office_types')
    .upsert(row, { onConflict: 'code' });

  if (error) {
    console.error('Error upserting office_type to Supabase:', error);
    throw error;
  }
  return true;
}

// -------------------------------------------------------------
// ۳. جدول گواهی‌های الکترونیکی خام (certificates)
// -------------------------------------------------------------
export async function fetchCertificatesFromSupabase(officeCode?: string): Promise<CertificateRecord[] | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    let query = supabase.from('certificates').select('*');
    if (officeCode) {
      query = query.eq('office_code', officeCode);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Supabase fetch certificates warning:', error.message || error);
      return null;
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      trackingCode: row.tracking_code,
      serialNumber: row.serial_number || '',
      applicantName: row.applicant_name,
      nationalId: row.national_id,
      mobileNumber: row.mobile_number || '',
      officeCode: row.office_code,
      officeName: row.office_name || '',
      certificateType: row.certificate_type,
      dependencyType: row.dependency_type,
      status: row.status,
      assuranceLevel: row.assurance_level,
      issueDate: row.issue_date,
      issueTime: row.issue_time || '',
      expireDate: row.expire_date || '',
      revocationDate: row.revocation_date,
      revocationReason: row.revocation_reason,
      validityDurationDays: row.validity_duration_days,
      authMethod: row.auth_method,
      companyName: row.company_name,
      companyNationalId: row.company_national_id,
      riskScore: row.risk_score || 0,
      riskFactors: row.risk_factors || [],
    }));
  } catch (err: any) {
    console.warn('Error fetching certificates from Supabase:', err?.message || err);
    return null;
  }
}

export async function upsertCertificatesToSupabase(certs: CertificateRecord[]): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase || certs.length === 0) return false;

  // Deduplicate by ID before batch upsert to prevent Postgres Error 21000
  const uniqueCertsMap = new Map<string, CertificateRecord>();
  certs.forEach((c) => {
    if (c.id) {
      uniqueCertsMap.set(c.id, c);
    }
  });

  const certList = Array.from(uniqueCertsMap.values());
  if (certList.length === 0) return false;

  // 1. استخراج تمام کدهای دفتر موجود در لیست گواهی‌ها و ایجاد خودکار آن‌ها در جدول offices
  // جهت جلوگیری از خطای قید کلید خارجی (Foreign key constraint: certificates_office_code_fkey)
  const officeCodes = Array.from(new Set(
    certList
      .map(c => (c.officeCode ? String(c.officeCode).trim() : ''))
      .filter(Boolean)
  ));

  const officeMetaMap = new Map<string, any>();
  certList.forEach(c => {
    const code = c.officeCode ? String(c.officeCode).trim() : '';
    if (code && !officeMetaMap.has(code)) {
      officeMetaMap.set(code, {
        code,
        name: c.officeName || `دفتر صدور گواهی ${code}`,
      });
    }
  });

  if (officeCodes.length > 0) {
    await ensureOfficesExistInSupabase(officeCodes, officeMetaMap);
  }

  const rows = certList.map(c => {
    const safeOfficeCode = c.officeCode && String(c.officeCode).trim() !== '' ? String(c.officeCode).trim() : null;
    return {
      id: c.id,
      tracking_code: c.trackingCode,
      serial_number: c.serialNumber || null,
      applicant_name: c.applicantName,
      national_id: c.nationalId,
      mobile_number: c.mobileNumber || null,
      office_code: safeOfficeCode,
      office_name: c.officeName || null,
      certificate_type: c.certificateType,
      dependency_type: c.dependencyType,
      status: c.status || 'VALID',
      assurance_level: c.assuranceLevel || 'MEDIUM',
      issue_date: c.issueDate,
      issue_time: c.issueTime || null,
      expire_date: c.expireDate || null,
      revocation_date: c.revocationDate || null,
      revocation_reason: c.revocationReason || null,
      validity_duration_days: c.validityDurationDays || null,
      auth_method: c.authMethod || 'IN_PERSON',
      company_name: c.companyName || null,
      company_national_id: c.companyNationalId || null,
      risk_score: c.riskScore || 0,
      risk_factors: c.riskFactors || [],
    };
  });

  // ارسال داده‌ها در دسته‌های ۵۰۰تایی جهت عملکرد بهینه و عدم مسدود شدن
  const CHUNK_SIZE = 500;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase
      .from('certificates')
      .upsert(chunk, { onConflict: 'id' });

    if (error) {
      console.error('Error upserting certificates to Supabase:', error);
      throw error;
    }
  }

  return true;
}

// -------------------------------------------------------------
// ۴. جدول ماموریت‌ها و دوره‌های بازرسی (audit_campaigns)
// -------------------------------------------------------------
export async function fetchCampaignsFromSupabase(): Promise<AuditCampaign[] | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    // First fetch campaigns
    const { data: campaignRows, error: cErr } = await supabase
      .from('audit_campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (cErr) {
      console.warn('Supabase fetch campaigns warning:', cErr.message || cErr);
      return null;
    }

    // Then fetch inspection records
    const { data: recordRows, error: rErr } = await supabase
      .from('inspection_records')
      .select('*');

    if (rErr) {
      console.warn('Supabase fetch inspection_records warning:', rErr.message || rErr);
    }

    const recordsByCampaign = new Map<string, AuditInspectionRecord[]>();
    (recordRows || []).forEach((row: any) => {
      const rec: AuditInspectionRecord = {
        id: row.id,
        campaignId: row.campaign_id,
        campaignTitle: row.campaign_title || '',
        officeCode: row.office_code,
        officeName: row.office_name || '',
        certificateId: row.certificate_id || row.certificate?.id,
        certificate: row.certificate,
        status: row.status,
        requiredDocuments: row.required_documents || [],
        documentRequestReasons: row.document_request_reasons || {},
        uploadedDocuments: row.uploaded_documents_metadata || [],
        officeNotes: row.office_notes,
        notesHistory: row.notes_history || [],
        submittedAt: row.submitted_at,
        inspectorNotes: row.inspector_notes,
        checklistResults: row.checklist_results || {},
        complianceScore: row.compliance_score,
        defectCategory: row.defect_category,
        reviewDate: row.review_date,
        reviewerName: row.reviewer_name,
        aiAuditResult: row.ai_audit_result,
      };

      if (!recordsByCampaign.has(row.campaign_id)) {
        recordsByCampaign.set(row.campaign_id, []);
      }
      recordsByCampaign.get(row.campaign_id)!.push(rec);
    });

    return (campaignRows || []).map((row: any) => ({
      id: row.id,
      title: row.title,
      code: row.code,
      inspectionType: row.inspection_type,
      createdAt: row.created_at,
      deadlineDate: row.deadline_date,
      officeCode: row.office_code,
      officeName: row.office_name || '',
      totalCertificatesInExcel: row.total_certificates_in_excel || 0,
      selectedSampleCount: row.selected_sample_count || 0,
      samplingConfig: row.sampling_config || {},
      status: row.status || 'ACTIVE',
      inspectorName: row.inspector_name || 'کارشناس بازرسی مرکز میانی عام',
      records: recordsByCampaign.get(row.id) || [],
    }));
  } catch (err: any) {
    console.warn('Error fetching campaigns from Supabase:', err?.message || err);
    return null;
  }
}

export async function upsertCampaignToSupabase(campaign: AuditCampaign): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const safeOfficeCode = campaign.officeCode && String(campaign.officeCode).trim() !== '' ? String(campaign.officeCode).trim() : null;

  // اطمینان از ثبت دفتر در پایگاه داده جهت جلوگیری از خطای کلید خارجی
  if (safeOfficeCode) {
    await ensureOfficesExistInSupabase([safeOfficeCode], [{ code: safeOfficeCode, name: campaign.officeName }]);
  }

  const campaignRow = {
    id: campaign.id,
    title: campaign.title,
    code: campaign.code,
    inspection_type: campaign.inspectionType,
    created_at: campaign.createdAt,
    deadline_date: campaign.deadlineDate,
    office_code: safeOfficeCode,
    office_name: campaign.officeName,
    total_certificates_in_excel: campaign.totalCertificatesInExcel || 0,
    selected_sample_count: campaign.selectedSampleCount || 0,
    sampling_config: campaign.samplingConfig || {},
    status: campaign.status || 'ACTIVE',
    inspector_name: campaign.inspectorName || null,
    updated_at: new Date().toISOString(),
  };

  const { error: cErr } = await supabase
    .from('audit_campaigns')
    .upsert(campaignRow, { onConflict: 'id' });

  if (cErr) {
    if (cErr.code === '22007' || (typeof cErr.message === 'string' && cErr.message.includes('timestamp'))) {
      const fallbackCampaignRow = {
        ...campaignRow,
        created_at: toSafeIsoTimestamp(campaign.createdAt),
      };
      const { error: fErr } = await supabase
        .from('audit_campaigns')
        .upsert(fallbackCampaignRow, { onConflict: 'id' });
      if (fErr) {
        console.error('Error upserting campaign after timestamp sanitize:', fErr);
        throw fErr;
      }
    } else {
      console.error('Error upserting campaign to Supabase:', cErr);
      throw cErr;
    }
  }

  // Also upsert its inspection records (without binary files)
  if (campaign.records && campaign.records.length > 0) {
    // Deduplicate records by ID to prevent Postgres Error 21000
    const uniqueRecsMap = new Map<string, AuditInspectionRecord>();
    campaign.records.forEach(r => {
      if (r.id) uniqueRecsMap.set(r.id, r);
    });

    const recList = Array.from(uniqueRecsMap.values());
    const recOfficeCodes = Array.from(new Set(
      recList
        .map(r => (r.officeCode ? String(r.officeCode).trim() : ''))
        .filter(Boolean)
    ));
    if (recOfficeCodes.length > 0) {
      await ensureOfficesExistInSupabase(recOfficeCodes);
    }

    const recordRows = recList.map(rec => ({
      id: rec.id,
      campaign_id: campaign.id,
      campaign_title: campaign.title,
      office_code: rec.officeCode && String(rec.officeCode).trim() !== '' ? String(rec.officeCode).trim() : safeOfficeCode,
      office_name: rec.officeName,
      certificate_id: rec.certificateId || rec.certificate?.id,
      certificate: rec.certificate,
      status: rec.status,
      required_documents: rec.requiredDocuments || [],
      document_request_reasons: rec.documentRequestReasons || {},
      uploaded_documents_metadata: sanitizeUploadedDocsForDatabase(rec.uploadedDocuments),
      office_notes: rec.officeNotes || null,
      notes_history: rec.notesHistory || [],
      submitted_at: rec.submittedAt || null,
      inspector_notes: rec.inspectorNotes || null,
      checklist_results: rec.checklistResults || {},
      compliance_score: rec.complianceScore ?? null,
      defect_category: rec.defectCategory || null,
      review_date: rec.reviewDate || null,
      reviewer_name: rec.reviewerName || null,
      ai_audit_result: rec.aiAuditResult || null,
      updated_at: new Date().toISOString(),
    }));

    const { error: rErr } = await supabase
      .from('inspection_records')
      .upsert(recordRows, { onConflict: 'id' });

    if (rErr) {
      console.error('Error upserting inspection records to Supabase:', rErr);
      throw rErr;
    }
  }

  return true;
}

/**
 * اطمینان از وجود کلیه شناسه‌های دوره بازرسی (campaignId) در جدول audit_campaigns دیتابیس Supabase
 * جهت جلوگیری از خطای قید کلید خارجی (Foreign Key Constraint 23503: inspection_records_campaign_id_fkey)
 */
export async function ensureCampaignsExistInSupabase(
  campaignIds: string[],
  campaignMetaLookup?: Array<{ id: string; title?: string; officeCode?: string; officeName?: string; inspectorName?: string }>
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase || campaignIds.length === 0) return false;

  const validIds = Array.from(new Set(
    campaignIds
      .map(id => String(id || '').trim())
      .filter(Boolean)
  ));

  if (validIds.length === 0) return true;

  try {
    const { data: existingCampaigns, error: fetchErr } = await supabase
      .from('audit_campaigns')
      .select('id')
      .in('id', validIds);

    if (fetchErr) {
      console.warn('Supabase check existing campaigns warning:', fetchErr);
    }

    const existingIdSet = new Set((existingCampaigns || []).map((c: any) => String(c.id).trim()));
    const missingIds = validIds.filter(id => !existingIdSet.has(id));

    if (missingIds.length === 0) return true;

    // ساخت ردیف‌های پیش‌فرض برای دوره‌های ناموجود
    const metaMap = new Map<string, { title?: string; officeCode?: string; officeName?: string; inspectorName?: string }>();
    if (campaignMetaLookup) {
      campaignMetaLookup.forEach(m => metaMap.set(String(m.id).trim(), m));
    }

    // پیش از درج در audit_campaigns، باید اطمینان حاصل شود که دفتر مربوطه در offices موجود است
    const requiredOfficeCodes = Array.from(new Set(
      missingIds.map(id => metaMap.get(id)?.officeCode).filter(Boolean) as string[]
    ));
    if (requiredOfficeCodes.length > 0) {
      await ensureOfficesExistInSupabase(requiredOfficeCodes);
    }

    const newCampaignRows = missingIds.map(id => {
      const meta = metaMap.get(id);
      const safeOfficeCode = meta?.officeCode ? String(meta.officeCode).trim() : null;
      return {
        id,
        title: meta?.title || `دوره بازرسی ${id}`,
        code: id,
        inspection_type: 'PERIODIC_MONTHLY',
        office_code: safeOfficeCode,
        office_name: meta?.officeName || 'دفتر صدور گواهی',
        total_certificates: 0,
        selected_sample_count: 1,
        sampling_config: {},
        status: 'ACTIVE',
        inspector_name: meta?.inspectorName || 'کارشناس بازرسی',
        created_at: new Date().toISOString(),
        deadline_date: new Date(Date.now() + 14 * 86400000).toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    const { error: insertErr } = await supabase
      .from('audit_campaigns')
      .upsert(newCampaignRows, { onConflict: 'id', ignoreDuplicates: true });

    if (insertErr) {
      console.warn('ensureCampaignsExistInSupabase insert warning:', insertErr);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('ensureCampaignsExistInSupabase exception:', err);
    return false;
  }
}

export async function upsertInspectionRecordToSupabase(record: AuditInspectionRecord): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const safeOfficeCode = record.officeCode && String(record.officeCode).trim() !== '' ? String(record.officeCode).trim() : null;
  if (safeOfficeCode) {
    await ensureOfficesExistInSupabase([safeOfficeCode], [{ code: safeOfficeCode, name: record.officeName }]);
  }

  // تضمین وجود دوره ممیزی والد در جدول audit_campaigns برای جلوگیری از خطای قید کلید خارجی (23503)
  if (record.campaignId) {
    await ensureCampaignsExistInSupabase([record.campaignId], [{
      id: record.campaignId,
      title: record.campaignTitle,
      officeCode: safeOfficeCode || undefined,
      officeName: record.officeName,
      inspectorName: record.reviewerName || record.level1InspectorName || 'کارشناس بازرسی'
    }]);
  }

  const row = {
    id: record.id,
    campaign_id: record.campaignId,
    campaign_title: record.campaignTitle,
    office_code: safeOfficeCode,
    office_name: record.officeName,
    certificate_id: record.certificateId || record.certificate?.id,
    certificate: record.certificate,
    status: record.status,
    required_documents: record.requiredDocuments || [],
    document_request_reasons: record.documentRequestReasons || {},
    uploaded_documents_metadata: sanitizeUploadedDocsForDatabase(record.uploadedDocuments),
    office_notes: record.officeNotes || null,
    notes_history: record.notesHistory || [],
    submitted_at: record.submittedAt || null,
    inspector_notes: record.inspectorNotes || null,
    checklist_results: record.checklistResults || {},
    compliance_score: record.complianceScore ?? null,
    defect_category: record.defectCategory || null,
    review_date: record.reviewDate || null,
    reviewer_name: record.reviewerName || null,
    ai_audit_result: record.aiAuditResult || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('inspection_records')
    .upsert(row, { onConflict: 'id' });

  if (error) {
    console.error('Error upserting inspection record to Supabase:', error);
    throw error;
  }
  return true;
}

// -------------------------------------------------------------
// ۵. جدول وقایع و رویدادهای ممیزی (audit_timeline_events)
// -------------------------------------------------------------
export async function fetchAuditEventsFromSupabase(): Promise<OfficeAuditEvent[] | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('audit_timeline_events')
      .select('*')
      .order('event_date', { ascending: false });

    if (error) {
      console.warn('Supabase fetch audit_timeline_events warning:', error.message || error);
      return null;
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      officeCode: row.office_code,
      officeName: row.office_name,
      eventType: row.event_type,
      title: row.title,
      eventDate: row.event_date,
      endDate: row.end_date,
      referenceNumber: row.reference_number,
      severity: row.severity,
      description: row.description,
      violationClauses: row.violation_clauses || [],
      ruling: row.ruling,
      fineAmount: row.fine_amount,
      inspectorName: row.inspector_name,
      commitmentType: row.commitment_type,
      commitmentSubject: row.commitment_subject,
      commitmentDeadline: row.commitment_deadline,
      commitmentStatus: row.commitment_status,
      guarantorName: row.guarantor_name,
      suspensionReason: row.suspension_reason,
      suspensionDays: row.suspension_days,
      isResolved: Boolean(row.is_resolved),
      isAlarmActive: Boolean(row.is_alarm_active),
      resolvedDate: row.resolved_date,
      attachedDocumentsCount: row.attached_documents_count || 0,
      attachedDocNames: row.attached_doc_names || [],
      registeredBy: row.registered_by,
      autoLogged: Boolean(row.auto_logged),
      createdAt: row.created_at,
    }));
  } catch (err: any) {
    console.warn('Error fetching audit_timeline_events from Supabase:', err?.message || err);
    return null;
  }
}

/**
 * Helper to safely format or sanitize timestamp strings for PostgreSQL TIMESTAMPTZ columns
 */
function toSafeIsoTimestamp(val?: string | null): string {
  if (!val) return new Date().toISOString();
  const parsed = Date.parse(val);
  if (!isNaN(parsed) && !/[\u0600-\u06FF]/.test(val)) {
    return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

export async function upsertAuditEventToSupabase(evt: OfficeAuditEvent): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const safeOfficeCode = evt.officeCode && String(evt.officeCode).trim() !== '' ? String(evt.officeCode).trim() : '1607';
  await ensureOfficesExistInSupabase([safeOfficeCode], [{ code: safeOfficeCode, name: evt.officeName }]);

  const isoNow = new Date().toISOString();
  const baseRow = {
    id: evt.id,
    office_code: safeOfficeCode,
    office_name: evt.officeName || null,
    event_type: evt.eventType,
    title: evt.title,
    event_date: evt.eventDate,
    end_date: evt.endDate || null,
    reference_number: evt.referenceNumber || null,
    severity: evt.severity || 'MEDIUM',
    description: evt.description || '',
    violation_clauses: evt.violationClauses || [],
    ruling: evt.ruling || null,
    fine_amount: evt.fineAmount || null,
    inspector_name: evt.inspectorName || null,
    commitment_type: evt.commitmentType || null,
    commitment_subject: evt.commitmentSubject || null,
    commitment_deadline: evt.commitmentDeadline || null,
    commitment_status: evt.commitmentStatus || null,
    guarantor_name: evt.guarantorName || null,
    suspension_reason: evt.suspensionReason || null,
    suspension_days: evt.suspensionDays || null,
    is_resolved: Boolean(evt.isResolved),
    is_alarm_active: Boolean(evt.isAlarmActive),
    resolved_date: evt.resolvedDate || null,
    attached_documents_count: evt.attachedDocumentsCount || 0,
    attached_doc_names: evt.attachedDocNames || [],
    registered_by: evt.registeredBy || null,
    auto_logged: Boolean(evt.autoLogged),
    created_at: evt.createdAt || isoNow,
  };

  const { error } = await supabase
    .from('audit_timeline_events')
    .upsert(baseRow, { onConflict: 'id' });

  if (error) {
    if (error.code === '22007' || (typeof error.message === 'string' && error.message.includes('timestamp'))) {
      const fallbackRow = {
        ...baseRow,
        created_at: toSafeIsoTimestamp(evt.createdAt),
      };
      const { error: fallbackErr } = await supabase
        .from('audit_timeline_events')
        .upsert(fallbackRow, { onConflict: 'id' });
      if (fallbackErr) {
        console.error('Error upserting audit event to Supabase after fallback:', fallbackErr);
        throw fallbackErr;
      }
      return true;
    }

    console.error('Error upserting audit event to Supabase:', error);
    throw error;
  }
  return true;
}

// -------------------------------------------------------------
// ۶. جدول اعلان‌ها و پیام‌های ممیزی (notifications)
// -------------------------------------------------------------
export async function fetchNotificationsFromSupabase(): Promise<AppNotification[] | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetch notifications warning:', error.message || error);
      return null;
    }

    return (data || []).map((row: any) => {
      const createdAt = row.metadata?.persianCreatedAt || row.created_at;
      const updatedAt = row.metadata?.persianUpdatedAt || row.updated_at || createdAt;
      return {
        id: row.id,
        eventCode: row.event_code,
        title: row.title,
        message: row.message,
        category: row.category,
        severity: row.severity,
        priority: row.priority || 'NORMAL',
        status: row.status || 'UNREAD',
        officeCode: row.office_code,
        officeName: row.office_name,
        targetEntityId: row.target_entity_id,
        targetEntityType: row.target_entity_type,
        createdAt: createdAt,
        updatedAt: updatedAt,
        expiresAt: row.expires_at,
        channels: row.channels || [],
        metadata: row.metadata || {},
        exportablePayload: row.payload || {
          version: '1.0',
          eventId: row.id,
          eventCode: row.event_code,
          timestamp: row.created_at,
          environment: 'PRODUCTION',
          sourceSystem: 'ROOT_CA_AUDIT',
          eventCategory: row.category,
          severity: row.severity,
          priority: row.priority || 'NORMAL',
          recipient: { role: 'OFFICE_USER', officeCode: row.office_code, officeName: row.office_name },
          details: { title: row.title, summary: row.message },
          dispatchInfo: { channels: ['IN_APP'] }
        },
        responseHistory: row.response_history || [],
        latestResponse: row.latest_response,
      };
    });
  } catch (err: any) {
    console.warn('Error fetching notifications from Supabase:', err?.message || err);
    return null;
  }
}

export async function upsertNotificationToSupabase(notif: AppNotification): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const isoNow = new Date().toISOString();

  const row = {
    id: notif.id,
    event_code: notif.eventCode,
    title: notif.title,
    message: notif.message,
    category: notif.category,
    severity: notif.severity,
    priority: notif.priority || 'NORMAL',
    status: notif.status || 'UNREAD',
    office_code: notif.officeCode || null,
    office_name: notif.officeName || null,
    target_entity_id: notif.targetEntityId || null,
    target_entity_type: notif.targetEntityType || null,
    created_at: notif.createdAt || isoNow,
    expires_at: notif.expiresAt || null,
    channels: notif.channels || [],
    metadata: {
      ...(notif.metadata || {}),
      persianCreatedAt: notif.createdAt,
      persianUpdatedAt: notif.updatedAt,
    },
    payload: notif.exportablePayload || {},
    response_history: notif.responseHistory || [],
    latest_response: notif.latestResponse || null,
    updated_at: isoNow, // Always valid ISO timestamp for PostgreSQL TIMESTAMPTZ column
  };

  const { error } = await supabase
    .from('notifications')
    .upsert(row, { onConflict: 'id' });

  if (error) {
    // If PostgreSQL column for created_at or expires_at is TIMESTAMPTZ (code 22007)
    if (error.code === '22007' || (typeof error.message === 'string' && error.message.includes('timestamp'))) {
      console.warn('Postgres timestamp format mismatch on notifications, retrying with ISO timestamps...');
      const fallbackRow = {
        ...row,
        created_at: toSafeIsoTimestamp(notif.createdAt),
        expires_at: null, // Keep original deadline in metadata/payload
        updated_at: isoNow,
      };
      const { error: fallbackError } = await supabase
        .from('notifications')
        .upsert(fallbackRow, { onConflict: 'id' });

      if (fallbackError) {
        console.error('Error upserting notification to Supabase after timestamp sanitize:', fallbackError);
        throw fallbackError;
      }
      return true;
    }

    console.error('Error upserting notification to Supabase:', error);
    throw error;
  }
  return true;
}

// -------------------------------------------------------------
// ۷. جدول تنظیمات وب‌هوک و کانال‌ها (notification_settings)
// -------------------------------------------------------------
export async function fetchNotificationSettingsFromSupabase(): Promise<NotificationChannelConfig | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('notification_settings')
    .select('*')
    .eq('id', 'default_settings')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found yet
    }
    console.error('Error fetching notification_settings from Supabase:', error);
    return null;
  }

  if (!data) return null;

  if (data.webhook_config && typeof data.webhook_config.inAppEnabled !== 'undefined') {
    return data.webhook_config as NotificationChannelConfig;
  }

  return {
    inAppEnabled: true,
    smsEnabled: Boolean(data.sms_config?.enabled),
    smsProvider: data.sms_config?.provider || 'KAVENEGAR',
    smsApiKey: data.sms_config?.apiKey,
    smsSenderNumber: data.sms_config?.senderNumber,
    smsDefaultRecipient: data.sms_config?.defaultRecipient,
    emailEnabled: Boolean(data.email_config?.enabled),
    emailSmtpHost: data.email_config?.smtpHost,
    emailSmtpPort: data.email_config?.port,
    emailSenderAddress: data.email_config?.sender,
    emailDefaultRecipient: data.email_config?.defaultRecipient,
    webPushEnabled: Boolean(data.web_push_config?.enabled),
    webhookEnabled: Boolean(data.webhook_config?.enabled),
    webhookUrl: data.webhook_config?.url,
    webhookAuthBearer: data.webhook_config?.bearer,
    webhookSecretHMAC: data.webhook_config?.secret,
    webhookAutoDispatchOnCreate: Boolean(data.auto_event_triggers?.autoDispatchCreate),
    webhookAutoDispatchOnResponse: Boolean(data.auto_event_triggers?.autoDispatchResponse),
  };
}

export async function upsertNotificationSettingsToSupabase(config: NotificationChannelConfig): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const row = {
    id: 'default_settings',
    is_active: true,
    sms_config: {
      enabled: config.smsEnabled,
      provider: config.smsProvider,
      apiKey: config.smsApiKey,
      senderNumber: config.smsSenderNumber,
      defaultRecipient: config.smsDefaultRecipient,
    },
    email_config: {
      enabled: config.emailEnabled,
      smtpHost: config.emailSmtpHost,
      port: config.emailSmtpPort,
      sender: config.emailSenderAddress,
      defaultRecipient: config.emailDefaultRecipient,
    },
    web_push_config: {
      enabled: config.webPushEnabled,
    },
    webhook_config: {
      ...config,
      enabled: config.webhookEnabled,
      url: config.webhookUrl,
      bearer: config.webhookAuthBearer,
      secret: config.webhookSecretHMAC,
    },
    auto_event_triggers: {
      autoDispatchCreate: config.webhookAutoDispatchOnCreate,
      autoDispatchResponse: config.webhookAutoDispatchOnResponse,
    },
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('notification_settings')
    .upsert(row, { onConflict: 'id' });

  if (error) {
    console.error('Error upserting notification_settings to Supabase:', error);
    throw error;
  }
  return true;
}

// -------------------------------------------------------------
// ۸. جدول تنظیمات فیلدهای فرم (form_field_settings)
// -------------------------------------------------------------
export async function fetchFormFieldSettingsFromSupabase(): Promise<FormFieldSetting[] | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('form_field_settings')
    .select('*');

  if (error) {
    console.error('Error fetching form_field_settings from Supabase:', error);
    return null;
  }

  return (data || []).map((row: any) => {
    const rawKey = String(row.key || '');
    const cleanKey = rawKey.replace(/^(OFFICE|MANAGER)_/i, '');
    const target = (row.target || (rawKey.startsWith('MANAGER_') ? 'MANAGER' : 'OFFICE')) as FormFieldTarget;
    return {
      key: cleanKey,
      target: target,
      label: row.label,
      isRequired: Boolean(row.is_required),
      isEditable: Boolean(row.is_editable),
      helpText: row.help_text,
    };
  });
}

export async function upsertFormFieldSettingsToSupabase(settings: FormFieldSetting[]): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase || settings.length === 0) return false;

  // Deduplicate and ensure each row in the batch has a unique primary key
  // Supports both composite keys (OFFICE_email, MANAGER_email) and standard targets
  const rowsMap = new Map<string, any>();

  for (const s of settings) {
    // Unique key per target and field to prevent "ON CONFLICT DO UPDATE command cannot affect row a second time"
    const uniqueKey = `${s.target}_${s.key}`;
    rowsMap.set(uniqueKey, {
      key: uniqueKey,
      target: s.target,
      label: s.label,
      is_required: Boolean(s.isRequired),
      is_editable: Boolean(s.isEditable),
      help_text: s.helpText || null,
      updated_at: new Date().toISOString(),
    });
  }

  const rows = Array.from(rowsMap.values());

  const { error } = await supabase
    .from('form_field_settings')
    .upsert(rows, { onConflict: 'key' });

  if (error) {
    // Fallback: If table enforces plain keys without prefix or composite constraint
    console.warn('Upserting with composite keys had an issue, trying individual deduplicated upserts:', error.message || error);
    
    // Deduplicate by target and key, and upsert each individually to prevent single-batch conflict
    let hasError = false;
    for (const r of rows) {
      const { error: singleErr } = await supabase
        .from('form_field_settings')
        .upsert(r, { onConflict: 'key' });
      if (singleErr) {
        // Also try with plain key if composite was rejected
        const plainRow = { ...r, key: r.key.replace(/^(OFFICE|MANAGER)_/i, '') };
        const { error: plainErr } = await supabase
          .from('form_field_settings')
          .upsert(plainRow);
        if (plainErr) {
          console.error('Error upserting single form_field_setting row:', plainErr);
          hasError = true;
        }
      }
    }
    if (hasError) {
      throw error;
    }
  }
  return true;
}

// -------------------------------------------------------------
// ۹. تست اتصال و وضعیت جدول‌های دیتابیس Supabase
// -------------------------------------------------------------
export interface SupabaseHealthCheckResult {
  connected: boolean;
  message: string;
  tableCounts?: {
    offices?: number;
    office_types?: number;
    certificates?: number;
    audit_campaigns?: number;
    inspection_records?: number;
    audit_timeline_events?: number;
    notifications?: number;
    notification_settings?: number;
    form_field_settings?: number;
  };
  missingTables?: string[];
  latencyMs?: number;
}

export async function checkSupabaseConnectionHealth(): Promise<SupabaseHealthCheckResult> {
  if (!isSupabaseReady()) {
    return {
      connected: false,
      message: 'تنظیمات آدرس یا کلید اتصال به Supabase مقداردهی نشده است.',
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      connected: false,
      message: 'کلاینت Supabase قابل ایجاد نبود.',
    };
  }

  const startTime = Date.now();
  const tablesToCheck = [
    'offices',
    'office_types',
    'certificates',
    'audit_campaigns',
    'inspection_records',
    'audit_timeline_events',
    'notifications',
    'notification_settings',
    'form_field_settings',
  ];

  const tableCounts: Record<string, number> = {};
  const missingTables: string[] = [];

  for (const tableName of tablesToCheck) {
    try {
      const { count, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (error) {
        missingTables.push(tableName);
      } else {
        tableCounts[tableName] = count ?? 0;
      }
    } catch (e) {
      missingTables.push(tableName);
    }
  }

  const latencyMs = Date.now() - startTime;

  if (missingTables.length > 0) {
    return {
      connected: true,
      message: `اتصال به پروژه برقرار است اما برخی جداول (${missingTables.join(', ')}) هنوز ساخته نشده‌اند. لطفاً اسکریپت SQL را در SQL Editor اجرا کنید.`,
      tableCounts,
      missingTables,
      latencyMs,
    };
  }

  return {
    connected: true,
    message: 'اتصال کامل و تمامی جداول مجزا در دیتابیس Supabase آماده و در دسترس هستند.',
    tableCounts,
    latencyMs,
  };
}

/**
 * همگام‌سازی کلیه اطلاعات محلی به دیتابیس Supabase با ۱ کلیک
 */
export async function syncEntireStateToSupabase(state: {
  offices: OfficeProfile[];
  officeTypes: OfficeTypeDefinition[];
  certificates: CertificateRecord[];
  campaigns: AuditCampaign[];
  auditEvents: OfficeAuditEvent[];
  notifications: AppNotification[];
  channelConfig: NotificationChannelConfig;
  fieldSettings: FormFieldSetting[];
}): Promise<{ success: boolean; message: string }> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { success: false, message: 'کلاینت دیتابیس Supabase مقداردهی نشده است.' };
    }

    // 1. Office types
    for (const t of state.officeTypes) {
      await upsertOfficeTypeToSupabase(t);
    }

    // 2. Offices (from state.offices)
    for (const o of state.offices) {
      await upsertOfficeToSupabase(o);
    }

    // 2.5 Ensure all office codes referenced anywhere (certificates, campaigns, events) exist in Supabase
    // to prevent any potential foreign key constraint violations (Postgres 23503)
    const allReferencedOfficeCodes = new Set<string>();
    const officeMetaLookup = new Map<string, any>();

    state.offices.forEach(o => {
      const code = String(o.code || '').trim();
      if (code) {
        allReferencedOfficeCodes.add(code);
        officeMetaLookup.set(code, o);
      }
    });

    state.certificates.forEach(c => {
      const code = String(c.officeCode || '').trim();
      if (code) {
        allReferencedOfficeCodes.add(code);
        if (!officeMetaLookup.has(code)) {
          officeMetaLookup.set(code, { code, name: c.officeName });
        }
      }
    });

    state.campaigns.forEach(c => {
      const code = String(c.officeCode || '').trim();
      if (code) {
        allReferencedOfficeCodes.add(code);
        if (!officeMetaLookup.has(code)) {
          officeMetaLookup.set(code, { code, name: c.officeName });
        }
      }
      if (c.records) {
        c.records.forEach(r => {
          const recCode = String(r.officeCode || '').trim();
          if (recCode) {
            allReferencedOfficeCodes.add(recCode);
            if (!officeMetaLookup.has(recCode)) {
              officeMetaLookup.set(recCode, { code: recCode, name: r.officeName });
            }
          }
        });
      }
    });

    state.auditEvents.forEach(e => {
      const code = String(e.officeCode || '').trim();
      if (code) {
        allReferencedOfficeCodes.add(code);
        if (!officeMetaLookup.has(code)) {
          officeMetaLookup.set(code, { code, name: e.officeName });
        }
      }
    });

    if (allReferencedOfficeCodes.size > 0) {
      await ensureOfficesExistInSupabase(Array.from(allReferencedOfficeCodes), officeMetaLookup);
    }

    // 3. Certificates
    if (state.certificates.length > 0) {
      await upsertCertificatesToSupabase(state.certificates);
    }

    // 4. Campaigns & Records
    for (const c of state.campaigns) {
      await upsertCampaignToSupabase(c);
    }

    // 5. Audit Events
    for (const e of state.auditEvents) {
      await upsertAuditEventToSupabase(e);
    }

    // 6. Notifications
    for (const n of state.notifications) {
      await upsertNotificationToSupabase(n);
    }

    // 7. Notification settings
    await upsertNotificationSettingsToSupabase(state.channelConfig);

    // 8. Field settings
    await upsertFormFieldSettingsToSupabase(state.fieldSettings);

    return { 
      success: true, 
      message: 'کلیه اطلاعات سیستم با موفقیت در جداول مجزای دیتابیس Supabase همگام‌سازی و ذخیره شد.' 
    };
  } catch (err: any) {
    console.error('Full sync failed:', err);
    return {
      success: false,
      message: `خطا در همگام‌سازی: ${err?.message || 'مشکل در برقراری ارتباط با پایگاه داده'}`,
    };
  }
}
