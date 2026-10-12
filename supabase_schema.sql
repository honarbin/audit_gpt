-- ====================================================================
-- اسکریپت ساخت جداول دیتابیس سامانه بازرسی دفاتر صدور گواهی الکترونیکی (RA Audit)
-- پایگاه داده: Supabase (PostgreSQL 15+)
-- ویژگی‌ها: ساختار تفکیک‌شده، نام‌گذاری شفاف، شاخص‌های جستجو و RLS
-- نکته: اطلاعات کلیه بخش‌ها به جز فایل‌های باینری مدارک در دیتابیس ذخیره می‌شود.
-- ====================================================================

-- ۱. فعال‌سازی اکستنشن‌های مورد نیاز
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ۲. جدول انواع و رده‌های دفاتر صدور (office_types)
CREATE TABLE IF NOT EXISTS office_types (
    code VARCHAR(50) PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    color VARCHAR(20) DEFAULT '#0284c7',
    icon_name VARCHAR(50) DEFAULT 'Building2',
    is_custom BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE office_types IS 'انواع دفاتر صدور گواهی الکترونیکی (پیشخوان دولت، اسناد رسمی و غیره)';

-- ۳. جدول اطلاعات دفاتر ثبت‌نام و صدور گواهی (offices)
-- فاقد فیلدهای کاربری؛ ارتباط با کاربران و مسئولین منحصراً از طریق کلید خارجی انجام می‌شود
CREATE TABLE IF NOT EXISTS offices (
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
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
    active_campaigns_count INT DEFAULT 0,
    status VARCHAR(30) DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE, SUSPENDED, REVOKED
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- پاکسازی فیلدهای کاربر از جدول دفاتر در صورت وجود قبلی
ALTER TABLE offices DROP COLUMN IF EXISTS username;
ALTER TABLE offices DROP COLUMN IF EXISTS manager_national_id;
ALTER TABLE offices DROP COLUMN IF EXISTS manager_mobile;
ALTER TABLE offices DROP COLUMN IF EXISTS manager_phone;
ALTER TABLE offices DROP COLUMN IF EXISTS manager_email;

CREATE INDEX IF NOT EXISTS idx_offices_province ON offices(province);
CREATE INDEX IF NOT EXISTS idx_offices_status ON offices(status);
CREATE INDEX IF NOT EXISTS idx_offices_type ON offices(type);
COMMENT ON TABLE offices IS 'پروفایل فیزیکی و هویتی دفاتر ثبت‌نام بدون فیلدهای کاربری و احراز هویت';

-- ۳.۱. جدول کاربران سامانه و کاربران دفاتر ثبت‌نام (app_users)
-- مرجع اصلی و واحد نام‌های کاربری، رمزهای عبور، نقش‌ها و کدهای ملی
CREATE TABLE IF NOT EXISTS app_users (
    id VARCHAR(100) PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    national_id VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    role VARCHAR(50) NOT NULL, -- SYSTEM_ADMIN, SENIOR_INSPECTOR, INSPECTOR, OFFICE_USER
    mobile_phone VARCHAR(30),
    email VARCHAR(150),
    assigned_office_code VARCHAR(50) REFERENCES offices(code) ON DELETE SET NULL,
    assigned_office_name VARCHAR(200),
    is_active BOOLEAN DEFAULT true,
    is_password_changed BOOLEAN DEFAULT false,
    custom_permissions JSONB DEFAULT '{}'::jsonb,
    last_login_at VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_users_username ON app_users(username);
CREATE INDEX IF NOT EXISTS idx_app_users_national_id ON app_users(national_id);
CREATE INDEX IF NOT EXISTS idx_app_users_assigned_office ON app_users(assigned_office_code);
CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users(role);
COMMENT ON TABLE app_users IS 'جدول کاربران کل سامانه و کاربران دفاتر ثبت‌نام متصل با کلید اختصاصی assigned_office_code';

-- ۳.۲. جدول اطلاعات تکمیلی مسئولین دفاتر (office_managers)
CREATE TABLE IF NOT EXISTS office_managers (
    id VARCHAR(100) PRIMARY KEY,
    manager_code VARCHAR(50) NOT NULL,
    national_id VARCHAR(20) NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    mobile_phone VARCHAR(30) NOT NULL,
    landline_phone VARCHAR(30),
    email VARCHAR(150),
    assigned_office_code VARCHAR(50) REFERENCES offices(code) ON DELETE CASCADE,
    assigned_office_name VARCHAR(200),
    appointment_date VARCHAR(30),
    status VARCHAR(30) DEFAULT 'ACTIVE',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_managers_assigned_office ON office_managers(assigned_office_code);
CREATE INDEX IF NOT EXISTS idx_managers_national_id ON office_managers(national_id);
COMMENT ON TABLE office_managers IS 'اطلاعات پرسنلی و حقوقی مسئولین دفاتر ثبت نام منسوب به دفتر با کلید اختصاصی';

-- ۴. جدول گواهی‌های الکترونیکی خام جهت نمونه‌گیری و ارزیابی (certificates)
CREATE TABLE IF NOT EXISTS certificates (
    id VARCHAR(100) PRIMARY KEY,
    tracking_code VARCHAR(100) NOT NULL,
    serial_number VARCHAR(150),
    applicant_name VARCHAR(200) NOT NULL,
    national_id VARCHAR(20) NOT NULL,
    mobile_number VARCHAR(30),
    office_code VARCHAR(50) REFERENCES offices(code) ON DELETE CASCADE,
    office_name VARCHAR(200),
    certificate_type VARCHAR(50) NOT NULL, -- NATURAL, LEGAL_REP, LEGAL_SEAL, GOV_STAFF, SERVER
    dependency_type VARCHAR(50) NOT NULL,  -- INDIVIDUAL_INDEPENDENT, LEGAL_NON_GOV, etc.
    status VARCHAR(30) DEFAULT 'VALID',    -- VALID, REVOKED, NOT_ACCEPTED, EXPIRED, SUSPENDED
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

CREATE INDEX IF NOT EXISTS idx_certificates_office_code ON certificates(office_code);
CREATE INDEX IF NOT EXISTS idx_certificates_tracking_code ON certificates(tracking_code);
CREATE INDEX IF NOT EXISTS idx_certificates_national_id ON certificates(national_id);
CREATE INDEX IF NOT EXISTS idx_certificates_status ON certificates(status);
CREATE INDEX IF NOT EXISTS idx_certificates_dependency_type ON certificates(dependency_type);
COMMENT ON TABLE certificates IS 'مخزن گواهی‌های الکترونیکی صادرشده دفاتر و سوابق جهت نمونه‌گیری';

-- ۵. جدول دوره‌ها و ماموریت‌های ممیزی و بازرسی (audit_campaigns)
CREATE TABLE IF NOT EXISTS audit_campaigns (
    id VARCHAR(100) PRIMARY KEY,
    title VARCHAR(250) NOT NULL,
    code VARCHAR(50) NOT NULL,
    inspection_type VARCHAR(50) NOT NULL, -- PERIODIC_MONTHLY, PERIODIC_SEASONAL, INCIDENTAL, HIGH_RISK_SPECIAL
    created_at VARCHAR(50) NOT NULL,
    deadline_date VARCHAR(50) NOT NULL,
    office_code VARCHAR(50) REFERENCES offices(code) ON DELETE CASCADE,
    office_name VARCHAR(200),
    total_certificates_in_excel INT DEFAULT 0,
    selected_sample_count INT DEFAULT 0,
    sampling_config JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(30) DEFAULT 'ACTIVE', -- ACTIVE, COMPLETED, OVERDUE
    inspector_name VARCHAR(150),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_office_code ON audit_campaigns(office_code);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON audit_campaigns(status);
COMMENT ON TABLE audit_campaigns IS 'دوره‌ها و ماموریت‌های بازرسی ادواری و موردی دفاتر';

-- ۶. جدول پرونده‌های نمونه‌گیری و نتایج تطبیق مدارک (inspection_records)
-- توجه: به درخواست سامانه، فقط متادیتا و لینک مدارک ذخیره می‌شود و باینری حجیم حذف می‌گردد
CREATE TABLE IF NOT EXISTS inspection_records (
    id VARCHAR(100) PRIMARY KEY,
    campaign_id VARCHAR(100) REFERENCES audit_campaigns(id) ON DELETE CASCADE,
    campaign_title VARCHAR(250),
    office_code VARCHAR(50) REFERENCES offices(code) ON DELETE CASCADE,
    office_name VARCHAR(200),
    certificate_id VARCHAR(100),
    certificate JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING_UPLOAD', -- PENDING_UPLOAD, UPLOADED, UNDER_REVIEW, APPROVED, DEFECT_MINOR, DEFECT_MAJOR, REJECTED
    required_documents JSONB DEFAULT '[]'::jsonb,
    document_request_reasons JSONB DEFAULT '{}'::jsonb,
    uploaded_documents_metadata JSONB DEFAULT '[]'::jsonb, -- متادیتای مدارک (عنوان، نوع، سایز، لینک و وضعیت انطباق بدون base64)
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

CREATE INDEX IF NOT EXISTS idx_inspection_records_campaign_id ON inspection_records(campaign_id);
CREATE INDEX IF NOT EXISTS idx_inspection_records_office_code ON inspection_records(office_code);
CREATE INDEX IF NOT EXISTS idx_inspection_records_status ON inspection_records(status);
COMMENT ON TABLE inspection_records IS 'پرونده‌های نمونه‌گیری شده، یادداشت‌ها و سوابق ارزیابی انطباق بازرس';

-- ۷. جدول وقایع زمانی و رویدادهای نظارتی دفاتر (audit_timeline_events)
CREATE TABLE IF NOT EXISTS audit_timeline_events (
    id VARCHAR(100) PRIMARY KEY,
    office_code VARCHAR(50) REFERENCES offices(code) ON DELETE CASCADE,
    office_name VARCHAR(200),
    event_type VARCHAR(50) NOT NULL, -- SUSPENSION, REINSTATEMENT, VIOLATION, COMMITMENT, INSPECTION, WARNING, REVOCATION
    title VARCHAR(250) NOT NULL,
    event_date VARCHAR(50) NOT NULL,
    end_date VARCHAR(50),
    reference_number VARCHAR(100),
    severity VARCHAR(30) DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH, CRITICAL
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

CREATE INDEX IF NOT EXISTS idx_timeline_office_code ON audit_timeline_events(office_code);
CREATE INDEX IF NOT EXISTS idx_timeline_event_type ON audit_timeline_events(event_type);
CREATE INDEX IF NOT EXISTS idx_timeline_is_resolved ON audit_timeline_events(is_resolved);
COMMENT ON TABLE audit_timeline_events IS 'رویدادهای پرونده نظارتی، احکام تعلیق، تعهدنامه‌ها و اخطارها';

-- ۸. جدول اعلان‌ها، هشدارها و پیام‌های ممیزی (notifications)
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(100) PRIMARY KEY,
    event_code VARCHAR(100) NOT NULL,
    title VARCHAR(250) NOT NULL,
    message TEXT NOT NULL,
    category VARCHAR(50) NOT NULL, -- INSPECTION_ACTION, DEFECT_ALERT, DEADLINE_WARNING, LIFECYCLE_EVENT, GENERAL_SYSTEM
    severity VARCHAR(30) NOT NULL, -- CRITICAL, WARNING, INFO, SUCCESS
    priority VARCHAR(30) DEFAULT 'NORMAL', -- URGENT, HIGH, NORMAL, LOW
    status VARCHAR(30) NOT NULL DEFAULT 'UNREAD', -- UNREAD, READ, ACTION_REQUIRED, RESPONDED, RESOLVED
    office_code VARCHAR(50),
    office_name VARCHAR(200),
    target_entity_id VARCHAR(100),
    target_entity_type VARCHAR(50), -- CAMPAIGN, INSPECTION_RECORD, OFFICE, AUDIT_EVENT
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

CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_office_code ON notifications(office_code);
CREATE INDEX IF NOT EXISTS idx_notifications_category ON notifications(category);
COMMENT ON TABLE notifications IS 'اعلان‌ها، هشدارهای ضرب‌الاجل و پیام‌های تبادل بازرسی';

-- ۹. جدول تنظیمات کانال‌های اطلاع‌رسانی و وب‌هوک (notification_settings)
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

COMMENT ON TABLE notification_settings IS 'پیکربندی ارتباطی و تنظیمات وب‌هوک سامانه‌های بالادستی';

-- ۱۰. جدول تنظیمات پویای فیلدهای فرم بازرسی (form_field_settings)
CREATE TABLE IF NOT EXISTS form_field_settings (
    key VARCHAR(120) PRIMARY KEY, -- کلید یکتا (مانند OFFICE_email یا MANAGER_email)
    target VARCHAR(50) NOT NULL, -- OFFICE, MANAGER
    label VARCHAR(150) NOT NULL,
    is_required BOOLEAN DEFAULT false,
    is_editable BOOLEAN DEFAULT true,
    help_text TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE form_field_settings IS 'تنظیمات پیکربندی پویای فیلدهای فرم‌های مشخصات دفاتر و مسئولین';

-- ۱۱. فعال‌سازی Row Level Security (RLS) جهت دسترسی امن و خواندن/نوشتن
ALTER TABLE office_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE office_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_field_settings ENABLE ROW LEVEL SECURITY;

-- سیاست‌های دسترسی عمومی (برای کلید Anon یا کاربران سیستم)
CREATE POLICY "Allow public read-write for office_types" ON office_types FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for offices" ON offices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for app_users" ON app_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for office_managers" ON office_managers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for certificates" ON certificates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for audit_campaigns" ON audit_campaigns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for inspection_records" ON inspection_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for audit_timeline_events" ON audit_timeline_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for notifications" ON notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for notification_settings" ON notification_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for form_field_settings" ON form_field_settings FOR ALL USING (true) WITH CHECK (true);
