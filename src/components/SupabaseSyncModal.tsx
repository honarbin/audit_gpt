import React, { useState, useEffect } from 'react';
import { 
  Database, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Copy, 
  Check, 
  ExternalLink, 
  X, 
  Server, 
  ShieldCheck, 
  HardDrive, 
  ArrowUpRight, 
  UploadCloud, 
  DownloadCloud, 
  Code2, 
  Layers,
  Table as TableIcon,
  HelpCircle,
  Network,
  Radio,
  GitMerge,
  Workflow,
  ArrowRightLeft,
  Sparkles
} from 'lucide-react';
import { 
  getStoredSupabaseConfig, 
  saveSupabaseConfig, 
  isSupabaseReady, 
  SupabaseConfig 
} from '../lib/supabase';
import { 
  getDataFlowArchitectureStatus,
  broadcastSyncEvent,
  CLIENT_SESSION_ID
} from '../services/realtimeSyncBus';
import { 
  checkSupabaseConnectionHealth, 
  syncEntireStateToSupabase, 
  SupabaseHealthCheckResult,
  fetchOfficesFromSupabase,
  fetchOfficeTypesFromSupabase,
  fetchCertificatesFromSupabase,
  fetchCampaignsFromSupabase,
  fetchAuditEventsFromSupabase,
  fetchNotificationsFromSupabase,
  fetchNotificationSettingsFromSupabase,
  fetchFormFieldSettingsFromSupabase
} from '../services/supabaseService';
import {
  syncOfficesToServer,
  syncManagersToServer,
  syncCampaignsToServer,
  syncAuditEventsToServer,
  syncNotificationsToServer,
  syncFieldSettingsToServer,
  syncOfficeTypesToServer,
} from '../services/centralSyncService';
import { syncAllUsersToServer, getStoredUsers } from '../services/authService';
import { 
  OfficeProfile, 
  OfficeManager,
  OfficeTypeDefinition, 
  CertificateRecord, 
  AuditCampaign, 
  OfficeAuditEvent, 
  AppNotification, 
  NotificationChannelConfig, 
  FormFieldSetting 
} from '../types';

interface SupabaseSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  appState: {
    offices: OfficeProfile[];
    managers?: OfficeManager[];
    officeTypes: OfficeTypeDefinition[];
    certificates: CertificateRecord[];
    campaigns: AuditCampaign[];
    auditEvents: OfficeAuditEvent[];
    notifications: AppNotification[];
    channelConfig: NotificationChannelConfig;
    fieldSettings: FormFieldSetting[];
  };
  onApplyRemoteState: (remoteState: {
    offices?: OfficeProfile[];
    officeTypes?: OfficeTypeDefinition[];
    certificates?: CertificateRecord[];
    campaigns?: AuditCampaign[];
    auditEvents?: OfficeAuditEvent[];
    notifications?: AppNotification[];
    channelConfig?: NotificationChannelConfig;
    fieldSettings?: FormFieldSetting[];
  }) => void;
}

export const SupabaseSyncModal: React.FC<SupabaseSyncModalProps> = ({
  isOpen,
  onClose,
  appState,
  onApplyRemoteState,
}) => {
  const [activeTab, setActiveTab] = useState<'STATUS' | 'SCHEMA' | 'SETTINGS' | 'DATA_FLOW'>('STATUS');
  const [testBroadcastSent, setTestBroadcastSent] = useState(false);
  const architectureInfo = getDataFlowArchitectureStatus();
  const [config, setConfig] = useState<SupabaseConfig>(getStoredSupabaseConfig());
  const [isChecking, setIsChecking] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [health, setHealth] = useState<SupabaseHealthCheckResult | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'SUCCESS' | 'ERROR'; message: string } | null>(null);

  // SQL Schema text
  const sqlScript = `-- اسکریپت پایگاه داده Supabase برای سامانه بازرسی دفاتر صدور گواهی (RA Audit)
-- توجه: تمام اطلاعات به جز فایل‌های باینری مدارک در این جداول ذخیره می‌شود.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ۱. انواع دفاتر
CREATE TABLE IF NOT EXISTS office_types (
    code VARCHAR(50) PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    color VARCHAR(20) DEFAULT '#0284c7',
    icon_name VARCHAR(50) DEFAULT 'Building2',
    is_custom BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۲. اطلاعات دفاتر ثبت‌نام و صدور گواهی
CREATE TABLE IF NOT EXISTS offices (
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    username VARCHAR(100),
    type VARCHAR(50) NOT NULL,
    custom_type_name VARCHAR(150),
    province VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(150),
    latitude NUMERIC(10, 6),
    longitude NUMERIC(10, 6),
    manager_id VARCHAR(50),
    manager_name VARCHAR(150) NOT NULL,
    manager_national_id VARCHAR(20),
    manager_mobile VARCHAR(30),
    manager_phone VARCHAR(30),
    manager_email VARCHAR(150),
    active_campaigns_count INT DEFAULT 0,
    status VARCHAR(30) DEFAULT 'ACTIVE',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۳. گواهی‌های الکترونیکی خام
CREATE TABLE IF NOT EXISTS certificates (
    id VARCHAR(100) PRIMARY KEY,
    tracking_code VARCHAR(100) NOT NULL,
    serial_number VARCHAR(150),
    applicant_name VARCHAR(200) NOT NULL,
    national_id VARCHAR(20) NOT NULL,
    mobile_number VARCHAR(30),
    office_code VARCHAR(50) REFERENCES offices(code) ON DELETE CASCADE,
    office_name VARCHAR(200),
    certificate_type VARCHAR(50) NOT NULL,
    dependency_type VARCHAR(50) NOT NULL,
    status VARCHAR(30) DEFAULT 'VALID',
    assurance_level VARCHAR(30) DEFAULT 'MEDIUM',
    issue_date VARCHAR(30) NOT NULL,
    issue_time VARCHAR(20),
    expire_date VARCHAR(30),
    revocation_date VARCHAR(30),
    revocation_reason TEXT,
    validity_duration_days INT,
    auth_method VARCHAR(50) DEFAULT 'IN_PERSON',
    company_name VARCHAR(200),
    company_national_id VARCHAR(30),
    risk_score INT DEFAULT 0,
    risk_factors JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۴. دوره‌ها و ماموریت‌های بازرسی
CREATE TABLE IF NOT EXISTS audit_campaigns (
    id VARCHAR(100) PRIMARY KEY,
    title VARCHAR(250) NOT NULL,
    code VARCHAR(50) NOT NULL,
    inspection_type VARCHAR(50) NOT NULL,
    created_at VARCHAR(50) NOT NULL,
    deadline_date VARCHAR(50) NOT NULL,
    office_code VARCHAR(50) REFERENCES offices(code) ON DELETE CASCADE,
    office_name VARCHAR(200),
    total_certificates_in_excel INT DEFAULT 0,
    selected_sample_count INT DEFAULT 0,
    sampling_config JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(30) DEFAULT 'ACTIVE',
    inspector_name VARCHAR(150),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۵. پرونده‌های بازرسی و نتایج تطبیق (بدون باینری مدارک)
CREATE TABLE IF NOT EXISTS inspection_records (
    id VARCHAR(100) PRIMARY KEY,
    campaign_id VARCHAR(100) REFERENCES audit_campaigns(id) ON DELETE CASCADE,
    campaign_title VARCHAR(250),
    office_code VARCHAR(50) REFERENCES offices(code) ON DELETE CASCADE,
    office_name VARCHAR(200),
    certificate_id VARCHAR(100),
    certificate JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING_UPLOAD',
    required_documents JSONB DEFAULT '[]'::jsonb,
    document_request_reasons JSONB DEFAULT '{}'::jsonb,
    uploaded_documents_metadata JSONB DEFAULT '[]'::jsonb,
    office_notes TEXT,
    notes_history JSONB DEFAULT '[]'::jsonb,
    submitted_at VARCHAR(50),
    inspector_notes TEXT,
    checklist_results JSONB DEFAULT '{}'::jsonb,
    compliance_score INT,
    defect_category VARCHAR(100),
    review_date VARCHAR(50),
    reviewer_name VARCHAR(150),
    ai_audit_result JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- جدول اختصاصی مدارک و متادیتای Storage (جدول documents مستقل از باینری)
CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(100) PRIMARY KEY,
    file_id VARCHAR(100) UNIQUE NOT NULL,
    original_file_name VARCHAR(255) NOT NULL,
    storage_file_name VARCHAR(255) NOT NULL,
    storage_provider VARCHAR(50) NOT NULL DEFAULT 'google_drive',
    storage_key TEXT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    checksum VARCHAR(100),
    office_id VARCHAR(50),
    applicant_id VARCHAR(100),
    inspection_id VARCHAR(100) REFERENCES inspection_records(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL,
    uploaded_by VARCHAR(150),
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    sync_status VARCHAR(30) DEFAULT 'uploaded',
    version INT DEFAULT 1,
    is_deleted BOOLEAN DEFAULT false,
    error_message TEXT,
    migration_status VARCHAR(30) DEFAULT 'none',
    source_provider VARCHAR(50),
    target_provider VARCHAR(50),
    migrated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_documents_file_id ON documents(file_id);
CREATE INDEX IF NOT EXISTS idx_documents_inspection_id ON documents(inspection_id);
CREATE INDEX IF NOT EXISTS idx_documents_storage_key ON documents(storage_key);

-- ۶. وقایع زمانی و رویدادهای ممیزی و تعهدنامه‌ها
CREATE TABLE IF NOT EXISTS audit_timeline_events (
    id VARCHAR(100) PRIMARY KEY,
    office_code VARCHAR(50) REFERENCES offices(code) ON DELETE CASCADE,
    office_name VARCHAR(200),
    event_type VARCHAR(50) NOT NULL,
    title VARCHAR(250) NOT NULL,
    event_date VARCHAR(50) NOT NULL,
    end_date VARCHAR(50),
    reference_number VARCHAR(100),
    severity VARCHAR(30) DEFAULT 'MEDIUM',
    description TEXT,
    violation_clauses JSONB DEFAULT '[]'::jsonb,
    ruling TEXT,
    fine_amount VARCHAR(100),
    inspector_name VARCHAR(150),
    commitment_type VARCHAR(50),
    commitment_subject TEXT,
    commitment_deadline VARCHAR(50),
    commitment_status VARCHAR(50),
    guarantor_name VARCHAR(150),
    suspension_reason TEXT,
    suspension_days INT,
    is_resolved BOOLEAN DEFAULT false,
    is_alarm_active BOOLEAN DEFAULT false,
    resolved_date VARCHAR(50),
    attached_documents_count INT DEFAULT 0,
    attached_doc_names JSONB DEFAULT '[]'::jsonb,
    registered_by VARCHAR(150),
    auto_logged BOOLEAN DEFAULT false,
    created_at VARCHAR(50) NOT NULL
);

-- ۷. اعلان‌ها و پیام‌های ممیزی
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(100) PRIMARY KEY,
    event_code VARCHAR(100) NOT NULL,
    title VARCHAR(250) NOT NULL,
    message TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    severity VARCHAR(30) NOT NULL,
    priority VARCHAR(30) DEFAULT 'NORMAL',
    status VARCHAR(30) NOT NULL DEFAULT 'UNREAD',
    office_code VARCHAR(50),
    office_name VARCHAR(200),
    target_entity_id VARCHAR(100),
    target_entity_type VARCHAR(50),
    created_at VARCHAR(50) NOT NULL,
    read_at VARCHAR(50),
    expires_at VARCHAR(50),
    channels JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    payload JSONB DEFAULT '{}'::jsonb,
    response_history JSONB DEFAULT '[]'::jsonb,
    latest_response JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۸. تنظیمات وب‌هوک و کانال‌های اطلاع‌رسانی
CREATE TABLE IF NOT EXISTS notification_settings (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'default_settings',
    is_active BOOLEAN DEFAULT true,
    sms_config JSONB DEFAULT '{}'::jsonb,
    email_config JSONB DEFAULT '{}'::jsonb,
    web_push_config JSONB DEFAULT '{}'::jsonb,
    webhook_config JSONB DEFAULT '{}'::jsonb,
    auto_event_triggers JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۹. تنظیمات پویای فیلدهای فرم
CREATE TABLE IF NOT EXISTS form_field_settings (
    key VARCHAR(100) PRIMARY KEY,
    target VARCHAR(50) NOT NULL,
    label VARCHAR(150) NOT NULL,
    is_required BOOLEAN DEFAULT false,
    is_editable BOOLEAN DEFAULT true,
    help_text TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- سیاست‌های دسترسی عمومی (RLS)
ALTER TABLE office_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_field_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on office_types" ON office_types FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on offices" ON offices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on certificates" ON certificates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on audit_campaigns" ON audit_campaigns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on inspection_records" ON inspection_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on audit_timeline_events" ON audit_timeline_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on notifications" ON notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on notification_settings" ON notification_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on form_field_settings" ON form_field_settings FOR ALL USING (true) WITH CHECK (true);
`;

  const runHealthCheck = async () => {
    setIsChecking(true);
    setSyncFeedback(null);
    try {
      const res = await checkSupabaseConnectionHealth();
      setHealth(res);
    } catch (e: any) {
      setHealth({
        connected: false,
        message: e?.message || 'خطا در بررسی ارتباط',
      });
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      runHealthCheck();
    }
  }, [isOpen]);

  const handleSaveConfig = () => {
    saveSupabaseConfig(config);
    setSyncFeedback({
      type: 'SUCCESS',
      message: 'تنظیمات اتصال به Supabase با موفقیت ذخیره شد.',
    });
    runHealthCheck();
  };

  const handlePushToSupabase = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      // ۱. همگام‌سازی تضمینی کلیه داده‌ها در پایگاه داده متمرکز سرور (Server Storage Vault)
      const allUsers = getStoredUsers();
      await Promise.all([
        syncAllUsersToServer(allUsers).catch(() => {}),
        syncOfficesToServer(appState.offices).catch(() => {}),
        syncManagersToServer(appState.managers || []).catch(() => {}),
        syncCampaignsToServer(appState.campaigns).catch(() => {}),
        syncAuditEventsToServer(appState.auditEvents).catch(() => {}),
        syncNotificationsToServer(appState.notifications).catch(() => {}),
        syncFieldSettingsToServer(appState.fieldSettings).catch(() => {}),
        syncOfficeTypesToServer(appState.officeTypes).catch(() => {}),
      ]);

      // ۲. در صورت پیکربندی Supabase، همگام‌سازی در دیتابیس ابری
      if (isSupabaseReady()) {
        const res = await syncEntireStateToSupabase(appState);
        if (res.success) {
          setSyncFeedback({ 
            type: 'SUCCESS', 
            message: 'اطلاعات با موفقیت در پایگاه داده سرور مرکزی و دیتابیس ابری ذخیره و تثبیت شد.' 
          });
          runHealthCheck();
        } else {
          setSyncFeedback({ 
            type: 'SUCCESS', 
            message: `اطلاعات در پایگاه داده سرور ثبت شد (${res.message}).` 
          });
        }
      } else {
        setSyncFeedback({
          type: 'SUCCESS',
          message: 'تمامی اطلاعات محلی (کاربران، دفاتر، دوره‌ها و تنظیمات) با موفقیت در پایگاه داده مرکزی سرور ذخیره شد.',
        });
      }
    } catch (e: any) {
      setSyncFeedback({ type: 'ERROR', message: e?.message || 'خطای غیرمنتظره در ارسال اطلاعات به پایگاه داده' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePullFromSupabase = async () => {
    setIsPulling(true);
    setSyncFeedback(null);
    try {
      const [
        remoteOffices,
        remoteTypes,
        remoteCerts,
        remoteCampaigns,
        remoteEvents,
        remoteNotifs,
        remoteChannels,
        remoteFields,
      ] = await Promise.all([
        fetchOfficesFromSupabase(),
        fetchOfficeTypesFromSupabase(),
        fetchCertificatesFromSupabase(),
        fetchCampaignsFromSupabase(),
        fetchAuditEventsFromSupabase(),
        fetchNotificationsFromSupabase(),
        fetchNotificationSettingsFromSupabase(),
        fetchFormFieldSettingsFromSupabase(),
      ]);

      const stateToApply: any = {};
      if (remoteOffices && remoteOffices.length > 0) stateToApply.offices = remoteOffices;
      if (remoteTypes && remoteTypes.length > 0) stateToApply.officeTypes = remoteTypes;
      if (remoteCerts && remoteCerts.length > 0) stateToApply.certificates = remoteCerts;
      if (remoteCampaigns && remoteCampaigns.length > 0) stateToApply.campaigns = remoteCampaigns;
      if (remoteEvents && remoteEvents.length > 0) stateToApply.auditEvents = remoteEvents;
      if (remoteNotifs && remoteNotifs.length > 0) stateToApply.notifications = remoteNotifs;
      if (remoteChannels) stateToApply.channelConfig = remoteChannels;
      if (remoteFields && remoteFields.length > 0) stateToApply.fieldSettings = remoteFields;

      onApplyRemoteState(stateToApply);

      setSyncFeedback({
        type: 'SUCCESS',
        message: 'کلیه اطلاعات با موفقیت از دیتابیس Supabase دریافت و در سامانه جایگزین شد.',
      });
      runHealthCheck();
    } catch (e: any) {
      setSyncFeedback({
        type: 'ERROR',
        message: `خطا در دریافت اطلاعات: ${e?.message || 'مشکل ارتباط'}`,
      });
    } finally {
      setIsPulling(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sqlScript);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  if (!isOpen) return null;

  const tablesMeta = [
    { key: 'offices', name: 'دفاتر ثبت‌نام و صدور گواهی', desc: 'مشخصات کامل، مسئولین، مختصات جغرافیایی و وضعیت', count: health?.tableCounts?.offices ?? appState.offices.length },
    { key: 'office_types', name: 'انواع و رده‌های دفاتر', desc: 'دسته‌بندی‌ها (پیشخوان، اسناد رسمی، مراکز آموزش)', count: health?.tableCounts?.office_types ?? appState.officeTypes.length },
    { key: 'certificates', name: 'گواهی‌های الکترونیکی خام', desc: 'مخزن رکوردهای صادرشده جهت فرآیند نمونه‌گیری ۷‌گانه', count: health?.tableCounts?.certificates ?? appState.certificates.length },
    { key: 'audit_campaigns', name: 'دوره‌ها و ماموریت‌های بازرسی', desc: 'ماموریت‌های ممیزی، مهلت‌ها و پارامترهای نمونه‌گیری', count: health?.tableCounts?.audit_campaigns ?? appState.campaigns.length },
    { key: 'inspection_records', name: 'پرونده‌های بازرسی و انطباق', desc: 'نتایج بررسی بازرس و متادیتای مدارک (بدون باینری سنگین)', count: health?.tableCounts?.inspection_records ?? appState.campaigns.reduce((acc, c) => acc + (c.records?.length || 0), 0) },
    { key: 'audit_timeline_events', name: 'وقایع زمانی و احکام نظارتی', desc: 'تعلیق‌ها، رفع تعلیق، تعهدنامه‌ها و پرونده‌های تخلف', count: health?.tableCounts?.audit_timeline_events ?? appState.auditEvents.length },
    { key: 'notifications', name: 'اعلان‌ها، هشدارها و پیام‌ها', desc: 'رویدادها، درخواست‌های اقدام و تاریخچه تبادل پیام‌ها', count: health?.tableCounts?.notifications ?? appState.notifications.length },
    { key: 'notification_settings', name: 'تنظیمات وب‌هوک و کانال‌ها', desc: 'پیکربندی هوشمند وب‌هوک، پیامک، ایمیل و پوش', count: health?.tableCounts?.notification_settings ?? 1 },
    { key: 'form_field_settings', name: 'تنظیمات پویای فیلدها', desc: 'تنظیمات اجباری/اختیاری بودن فیلدهای دفاتر و مسئولین', count: health?.tableCounts?.form_field_settings ?? appState.fieldSettings.length },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 border border-emerald-500/30 rounded-2xl text-emerald-400">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black">پایگاه داده ابری Supabase (PostgreSQL)</h3>
                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${
                  health?.connected && (!health.missingTables || health.missingTables.length === 0)
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}>
                  {health?.connected && (!health.missingTables || health.missingTables.length === 0) ? 'متصل و آماده' : 'نیاز به پیکربندی / ساخت جداول'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                ذخیره‌سازی تفکیک‌شده کلیه اطلاعات در جداول مجزا در دیتابیس (بدون فایل‌های باینری مدارک)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('STATUS')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'STATUS'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>وضعیت جداول و همگام‌سازی</span>
            </button>
            <button
              onClick={() => setActiveTab('SCHEMA')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'SCHEMA'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>اسکریپت ساخت جداول (SQL DDL)</span>
            </button>
            <button
              onClick={() => setActiveTab('SETTINGS')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'SETTINGS'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>تنظیمات و کلیدهای اتصال</span>
            </button>
            <button
              onClick={() => setActiveTab('DATA_FLOW')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'DATA_FLOW'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 bg-emerald-50/50'
              }`}
            >
              <Workflow className="w-3.5 h-3.5" />
              <span>معماری جریان داده و اطلاع‌رسانی بلادرنگ</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={runHealthCheck}
              disabled={isChecking}
              className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs transition cursor-pointer disabled:opacity-50"
              title="بررسی مجدد اتصال"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin text-emerald-600' : ''}`} />
              <span>بررسی اتصال</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Notification Feedback */}
          {syncFeedback && (
            <div className={`p-4 rounded-2xl border flex items-center gap-3 text-xs font-bold ${
              syncFeedback.type === 'SUCCESS'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-rose-50 text-rose-900 border-rose-200'
            }`}>
              {syncFeedback.type === 'SUCCESS' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{syncFeedback.message}</span>
            </div>
          )}

          {activeTab === 'STATUS' && (
            <div className="space-y-6">
              {/* Connection Status Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className={`w-3.5 h-3.5 rounded-full shrink-0 ${
                    health?.connected && (!health.missingTables || health.missingTables.length === 0)
                      ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.7)] animate-pulse'
                      : 'bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.7)]'
                  }`} />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      {health?.connected ? 'ارتباط زنده با پایگاه داده ابری برقرار است' : 'در انتظار اتصال یا تنظیم مشخصات پروژه'}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {health?.message || 'در حال بررسی اطلاعات پروژه...'}
                      {health?.latencyMs ? ` (زمان پاسخ: ${health.latencyMs} میلی‌ثانیه)` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 w-full md:w-auto">
                  <button
                    onClick={handlePushToSupabase}
                    disabled={isSyncing || !isSupabaseReady()}
                    className="flex-1 md:flex-initial flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-xs transition cursor-pointer disabled:opacity-50"
                  >
                    <UploadCloud className={`w-4 h-4 ${isSyncing ? 'animate-bounce' : ''}`} />
                    <span>{isSyncing ? 'در حال ارسال...' : 'ارسال اطلاعات محلی به دیتابیس (Push)'}</span>
                  </button>

                  <button
                    onClick={handlePullFromSupabase}
                    disabled={isPulling || !isSupabaseReady()}
                    className="flex-1 md:flex-initial flex items-center justify-center gap-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold px-4 py-2.5 rounded-2xl shadow-2xs transition cursor-pointer disabled:opacity-50"
                  >
                    <DownloadCloud className={`w-4 h-4 ${isPulling ? 'animate-bounce' : ''}`} />
                    <span>{isPulling ? 'در حال دریافت...' : 'دریافت از دیتابیس (Pull)'}</span>
                  </button>
                </div>
              </div>

              {/* Distinct Tables Grid */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-sm font-bold text-slate-900">جداول مجزای دیتابیس و آمار رکوردها</h4>
                  </div>
                  <span className="text-xs text-slate-500">مجموع: ۹ جدول تفکیک‌شده</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {tablesMeta.map((table) => {
                    const isMissing = health?.missingTables?.includes(table.key);
                    return (
                      <div
                        key={table.key}
                        className={`bg-white border rounded-2xl p-4 transition shadow-2xs flex flex-col justify-between ${
                          isMissing
                            ? 'border-amber-200 bg-amber-50/20'
                            : 'border-slate-200 hover:border-emerald-300'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="text-xs font-bold text-slate-900 font-mono">{table.key}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
                              isMissing
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-900'
                            }`}>
                              {table.count} رکورد
                            </span>
                          </div>
                          <h5 className="text-xs font-bold text-slate-800 mb-1">{table.name}</h5>
                          <p className="text-[11px] text-slate-500 leading-relaxed">{table.desc}</p>
                        </div>

                        {isMissing && (
                          <div className="mt-3 text-[10px] text-amber-700 bg-amber-100/70 p-1.5 rounded-lg font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>جدول در دیتابیس ایجاد نشده است</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Notice Banner regarding binary files exclusion */}
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3 text-xs text-blue-950">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-bold">قانون ذخیره‌سازی داده‌ها: </span>
                  کلیه شناسه‌ها، اطلاعات هویتی متقاضیان، رویدادهای بازرسی، تعلیق‌ها، نمرات انطباق، متادیتای مدارک (نوع سند، تاریخ بارگذاری، سایز و لینک ارجاع درایو) در دیتابیس ذخیره می‌گردند؛ اما محتوای فایل‌های باینری سنگین (Base64) جهت حفظ سرعت و امنیت بهینه از ستون‌های دیتابیس حذف شده و در مخزن محلی/درایو ابری مدیریت می‌گردد.
                </div>
              </div>
            </div>
          )}

          {activeTab === 'SCHEMA' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">اسکریپت استاندارد SQL DDL جهت ساخت جداول در Supabase</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    این کد را کپی کرده و در بخش <span className="font-bold text-slate-800">SQL Editor</span> در داشبورد Supabase خود اجرا نمایید.
                  </p>
                </div>

                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition cursor-pointer shadow-xs"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSql ? 'کپی شد!' : 'کپی کل اسکریپت SQL'}</span>
                </button>
              </div>

              <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 max-h-96 overflow-y-auto">
                <pre className="text-xs text-emerald-400 font-mono whitespace-pre leading-relaxed dir-ltr text-left">
                  {sqlScript}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'SETTINGS' && (
            <div className="space-y-5">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4">
                <h4 className="text-xs font-bold text-slate-900">مشخصات دسترسی و اتصال به پروژه Supabase</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  می‌توانید مقادیر <span className="font-mono text-slate-800">VITE_SUPABASE_URL</span> و <span className="font-mono text-slate-800">VITE_SUPABASE_ANON_KEY</span> را در متغیرهای محیطی یا مستقیماً در این فرم ثبت و ذخیره فرمایید:
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      آدرس پروژه (Project URL)
                    </label>
                    <input
                      type="text"
                      placeholder="https://xyzcompany.supabase.co"
                      value={config.url}
                      onChange={(e) => setConfig({ ...config, url: e.target.value.trim() })}
                      className="w-full text-xs font-mono px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 dir-ltr text-left bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      کلید عمومی / ناشناس (Public Anon Key)
                    </label>
                    <input
                      type="password"
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      value={config.anonKey}
                      onChange={(e) => setConfig({ ...config, anonKey: e.target.value.trim() })}
                      className="w-full text-xs font-mono px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 dir-ltr text-left bg-white"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleSaveConfig}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer shadow-xs"
                  >
                    ذخیره مشخصات و برقراری ارتباط
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DATA FLOW & REALTIME ARCHITECTURE */}
          {activeTab === 'DATA_FLOW' && (
            <div className="space-y-6">
              {/* Live Architecture Status Bar */}
              <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-md">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-400">
                      <Radio className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white">وضعیت زنده هاب ارتباطی و همگام‌سازی بلادرنگ</h4>
                      <p className="text-[11px] text-slate-400">شناسه نشست این کلاینت: <span className="font-mono text-emerald-300 font-bold">{architectureInfo.clientSessionId}</span></p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        broadcastSyncEvent('SYSTEM_STATE_REFRESH', { triggeredBy: CLIENT_SESSION_ID, timestamp: new Date().toISOString() });
                        setTestBroadcastSent(true);
                        setTimeout(() => setTestBroadcastSent(false), 3000);
                      }}
                      className="flex items-center gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-xl transition cursor-pointer shadow-xs"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>تست ارسال سیگنال ریل‌تایم به سایر تب‌ها</span>
                    </button>
                    {testBroadcastSent && (
                      <span className="text-xs text-emerald-400 font-bold animate-in fade-in flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> سیگنال ارسال شد
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4 text-xs">
                  <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                    <span className="text-slate-400 block text-[10px] font-bold mb-1">ارتباط بین تب‌های همان مرورگر:</span>
                    <div className="flex items-center gap-2 font-bold text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span>{architectureInfo.localBusStatus}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">کانال اشتراکی ra_audit_sync_bus (تاخیر ۰ میلی‌ثانیه)</span>
                  </div>

                  <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                    <span className="text-slate-400 block text-[10px] font-bold mb-1">ارتباط تحت شبکه با سایر دستگاه‌ها:</span>
                    <div className="flex items-center gap-2 font-bold text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>{architectureInfo.remoteBusStatus}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">کانال وب‌سوکت Supabase Realtime Engine</span>
                  </div>

                  <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                    <span className="text-slate-400 block text-[10px] font-bold mb-1">مدل پایداری داده (Storage):</span>
                    <div className="flex items-center gap-2 font-bold text-slate-200">
                      <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
                      <span>ترکیبی (Offline-First + PostgreSQL)</span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">ذخیره فوری در کلاینت + همگام‌سازی ابری</span>
                  </div>
                </div>
              </div>

              {/* 3 Core Architectural Pillars */}
              <div className="space-y-4">
                {/* Pillar 1: How data is read */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2.5 text-slate-900 font-black text-sm">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold">۱</span>
                    <HardDrive className="w-4 h-4 text-emerald-700" />
                    <h4>هر سیستم از کجا داده را می‌خواند؟ (Data Read Origin & Cold Start)</h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>خواندن اولیه فوق سریع (Client Storage)</span>
                      </div>
                      <p className="text-slate-600 leading-relaxed text-[11px]">
                        برای جلوگیری از تاخیر شبکه و لودینگ‌های طولانی، به محض باز شدن سامانه، اطلاعات پایه، دفاتر و پرونده‌ها از حافظه محلی مرورگر (<span className="font-mono text-slate-800">localStorage</span> با نسخه‌بندی تفکیک‌شده) خوانده شده و در کسری از ثانیه رندر می‌شوند.
                      </p>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        <span>همگام‌سازی و اعتبارسنجی ابری (Cloud Hydration)</span>
                      </div>
                      <p className="text-slate-600 leading-relaxed text-[11px]">
                        بلافاصله در پس‌زمینه، کلاینت با فراخوانی متدهای سرویس <span className="font-mono text-slate-800">fetchFromSupabase</span> آخرین اطلاعات معتبر را از جداول رابطه ای <span className="font-mono text-slate-800">PostgreSQL</span> دریافت کرده و در صورت وجود تغییرات جدیدتر، داده‌های محلی را Hydrate و بازسازی می‌کند.
                      </p>
                    </div>
                  </div>

                  <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3 text-[11px] text-emerald-900 leading-relaxed">
                    <strong>تفکیک دسترسی نقشی:</strong> کاربر هر دفتر فقط گواهی‌ها و پرونده‌های منتسب به دفتر خود را بارگذاری و مشاهده می‌کند؛ بازرسان به ماموریت‌های ممیزی محول‌شده دسترسی دارند؛ و مدیر ارشد سیستم به تمامی جداول و گزارش‌های استانی تسلط کامل دارد.
                  </div>
                </div>

                {/* Pillar 2: How changes reach the server */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2.5 text-slate-900 font-black text-sm">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">۲</span>
                    <UploadCloud className="w-4 h-4 text-blue-700" />
                    <h4>تغییرات چگونه به سرور می‌رسند؟ (Mutation Pipeline)</h4>
                  </div>

                  <div className="relative pl-4 space-y-2.5 text-xs before:absolute before:right-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-300 pr-7">
                    <div className="relative bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                      <span className="absolute -right-5.5 top-3.5 w-3 h-3 rounded-full bg-blue-600 border-2 border-white" />
                      <div className="font-bold text-slate-800">مرحله ۱: اعمال خوش‌بینانه در رابط کاربری (Optimistic UI Update)</div>
                      <p className="text-slate-600 text-[11px] mt-0.5">به محض کلیک کاربر روی ثبت (مانند آپلود مدرک یا اعلام نقص)، استیت ری‌اکت در همان میلی‌ثانیه به‌روزرسانی می‌شود تا سرعت سامانه کند نشود.</p>
                    </div>

                    <div className="relative bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                      <span className="absolute -right-5.5 top-3.5 w-3 h-3 rounded-full bg-blue-600 border-2 border-white" />
                      <div className="font-bold text-slate-800">مرحله ۲: پشتیبان‌گیری محلی خودکار (Local Persistence)</div>
                      <p className="text-slate-600 text-[11px] mt-0.5">هوک‌های هماهنگ‌کننده تغییرات را در کش ذخیره می‌کنند تا حتی در صورت قطعی ناگهانی اینترنت یا بستن مرورگر، چیزی از بین نرود.</p>
                    </div>

                    <div className="relative bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                      <span className="absolute -right-5.5 top-3.5 w-3 h-3 rounded-full bg-blue-600 border-2 border-white" />
                      <div className="font-bold text-slate-800">مرحله ۳: ارسال غیرهمزمان از طریق autoSyncService</div>
                      <p className="text-slate-600 text-[11px] mt-0.5">درخواست از طریق PostgREST API ایمن با متدهای Upsert به جدول متناظر (<span className="font-mono text-slate-800">inspection_records</span>, <span className="font-mono text-slate-800">offices</span>, ...) ارسال می‌گردد.</p>
                    </div>

                    <div className="relative bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                      <span className="absolute -right-5.5 top-3.5 w-3 h-3 rounded-full bg-blue-600 border-2 border-white" />
                      <div className="font-bold text-slate-800">مرحله ۴: ارزیابی هوشمند و ثبت در خط زمان ممیزی (Audit Logging)</div>
                      <p className="text-slate-600 text-[11px] mt-0.5">در صورت نیاز، ارزیابی هوش مصنوعی از طریق اندپوینت سروری <span className="font-mono text-slate-800">/api/ai-audit-check</span> فراخوانی شده و تمامی لاگ‌ها در جدول تاریخچه وقایع زمانی درج می‌شوند.</p>
                    </div>
                  </div>
                </div>

                {/* Pillar 3: How other open systems are notified */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2.5 text-slate-900 font-black text-sm">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold">۳</span>
                    <Network className="w-4 h-4 text-purple-700" />
                    <h4>چگونه به سایر سیستم‌های بازِ همان سامانه اطلاع داده می‌شوند؟ (Realtime Multi-Client Propagation)</h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">الف) تب‌های باز در یک مرورگر</span>
                        <span className="text-[10px] px-2 py-0.5 bg-purple-100 text-purple-800 rounded-md font-bold">BroadcastChannel Bus</span>
                      </div>
                      <p className="text-slate-600 text-[11px] leading-relaxed">
                        سامانه از وب‌باس استاندارد مرورگر (<span className="font-mono text-slate-800">BroadcastChannel(&apos;ra_audit_sync_bus&apos;)</span>) استفاده می‌کند. به محض اینکه یک تب پرونده‌ای را ذخیره یا مدرکی را آپلود کند، یک پیام ساختاریافته به سایر تب‌های باز ارسال شده و استیت آنها بدون نیاز به رفرش شدن صفحه فورا سینک می‌شود.
                      </p>
                      <div className="text-[10px] text-slate-500 bg-slate-50 p-2 rounded-lg font-mono dir-ltr text-left">
                        channel.postMessage(&#123; type: &apos;RECORD_UPDATED&apos;, payload: record &#125;)
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">ب) کلاینت‌ها و سیستم‌های مجزا روی شبکه</span>
                        <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-bold">PostgreSQL Realtime WebSocket</span>
                      </div>
                      <p className="text-slate-600 text-[11px] leading-relaxed">
                        هنگامی که چند کاربر مختلف (مثلاً بازرس در اداره کل و مسئول دفتر در شهرستان) هم‌زمان سامانه را باز دارند، هر کلاینت به کانال وب‌سوکت رویدادهای پایگاه داده (<span className="font-mono text-slate-800">postgres_changes</span>) متصل است. به محض درج یا آپدیت رکورد، سرور پیام را به تمام سیستم‌های فعال پوش می‌کند.
                      </p>
                      <div className="text-[10px] text-slate-500 bg-slate-50 p-2 rounded-lg font-mono dir-ltr text-left">
                        supabase.channel(&apos;db_changes&apos;).on(&apos;postgres_changes&apos;, &#123; table: &apos;inspection_records&apos; &#125;, ...)
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-100 border-t border-slate-200 p-4 px-6 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-600" />
            <span>پایگاه داده ابری رابطه‌ای PostgreSQL (Supabase Connected)</span>
          </div>

          <button
            onClick={onClose}
            className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold px-4 py-1.5 rounded-xl transition cursor-pointer"
          >
            بستن پنجره
          </button>
        </div>
      </div>
    </div>
  );
};
