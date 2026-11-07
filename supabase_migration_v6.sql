-- ====================================================================
-- مهاجرت v6: ذخیره همه داده‌ها مستقیم در دیتابیس
-- قابل اجرای مجدد (idempotent). قبل از دیپلوی نسخه ۶ در Supabase SQL Editor اجرا شود.
-- ====================================================================

-- ۱. جدول اسناد عمومی (پرونده‌ها/کمپین‌ها، رویدادها، اعلان‌ها، انواع دفتر، لاگ‌ها، تنظیمات)
CREATE TABLE IF NOT EXISTS app_documents (
    collection VARCHAR(50)  NOT NULL,
    id         VARCHAR(200) NOT NULL,
    data       JSONB,
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    PRIMARY KEY (collection, id)
);
CREATE INDEX IF NOT EXISTS idx_app_documents_collection_updated ON app_documents(collection, updated_at DESC);

-- فقط سرور (service role) به این جدول دسترسی دارد؛ بدون policy برای مرورگر
ALTER TABLE app_documents ENABLE ROW LEVEL SECURITY;

-- ۲. هویت مسئول دفتر فقط در app_users (مهاجرت نسخه ۴)
ALTER TABLE office_managers ADD COLUMN IF NOT EXISTS user_id VARCHAR(100) REFERENCES app_users(id) ON DELETE SET NULL;
ALTER TABLE office_managers ADD COLUMN IF NOT EXISTS username VARCHAR(100);
ALTER TABLE office_managers ADD COLUMN IF NOT EXISTS national_id VARCHAR(20);
ALTER TABLE office_managers ADD COLUMN IF NOT EXISTS full_name VARCHAR(200);
ALTER TABLE office_managers ADD COLUMN IF NOT EXISTS mobile_phone VARCHAR(30);
ALTER TABLE office_managers ADD COLUMN IF NOT EXISTS email VARCHAR(150);
ALTER TABLE office_managers ALTER COLUMN national_id DROP NOT NULL;
ALTER TABLE office_managers ALTER COLUMN full_name DROP NOT NULL;
ALTER TABLE office_managers ALTER COLUMN mobile_phone DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_managers_user ON office_managers(user_id);

UPDATE office_managers m
SET user_id = u.id
FROM app_users u
WHERE m.user_id IS NULL
  AND u.role = 'OFFICE_USER'
  AND u.assigned_office_code = m.assigned_office_code;

UPDATE app_users u
SET national_id  = COALESCE(NULLIF(u.national_id, ''),  NULLIF(m.national_id, '')),
    mobile_phone = COALESCE(NULLIF(u.mobile_phone, ''), NULLIF(m.mobile_phone, '')),
    email        = COALESCE(NULLIF(u.email, ''),        NULLIF(m.email, ''))
FROM office_managers m
WHERE m.user_id = u.id;

UPDATE office_managers
SET username = NULL, national_id = NULL, full_name = NULL, mobile_phone = NULL, email = NULL
WHERE user_id IS NOT NULL;

ALTER TABLE offices DROP COLUMN IF EXISTS manager_name;

-- ۳. مسئولینی که هنوز به کاربر وصل نشده‌اند (بررسی دستی)
SELECT id, assigned_office_code, full_name FROM office_managers WHERE user_id IS NULL;

NOTIFY pgrst, 'reload schema';
