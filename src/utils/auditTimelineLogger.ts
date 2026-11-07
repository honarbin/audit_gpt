import { FormFieldSetting, OfficeAuditEvent, OfficeAuditEventType } from '../types';

export const DEFAULT_FORM_FIELD_SETTINGS: FormFieldSetting[] = [
  // --- فیلدهای دفتر ثبت نام ---
  {
    key: 'code',
    target: 'OFFICE',
    label: 'کد یکتای شناسه دفتر (عددی)',
    isRequired: true,
    isEditable: false, // شناسه اصلی سامانه
    helpText: 'شناسه یکتای اختصاصی دفتر ثبت نام در شبکه ممیزی',
  },
  {
    key: 'name',
    target: 'OFFICE',
    label: 'نام کامل دفتر ثبت نام',
    isRequired: true,
    isEditable: true,
    helpText: 'عنوان رسمی تابلوی دفتر یا واحد ثبت نام',
  },
  {
    key: 'type',
    target: 'OFFICE',
    label: 'نوع دفتر ثبت نام (پیشخوان، اسناد رسمی، و...)',
    isRequired: true,
    isEditable: true,
    helpText: 'دسته‌بندی ساختاری دفتر ثبت نام',
  },
  {
    key: 'province',
    target: 'OFFICE',
    label: 'استان استقرار دفتر',
    isRequired: true,
    isEditable: true,
    helpText: 'استان محل فعالیت و ممیزی',
  },
  {
    key: 'city',
    target: 'OFFICE',
    label: 'شهرستان / شهر استقرار',
    isRequired: true,
    isEditable: true,
    helpText: 'شهرستان یا منطقه شهری',
  },
  {
    key: 'address',
    target: 'OFFICE',
    label: 'نشانی دقیق پستی دفتر',
    isRequired: true,
    isEditable: true,
    helpText: 'آدرس پستی جهت بازرسی‌های حضوری و میدانی',
  },
  {
    key: 'phone',
    target: 'OFFICE',
    label: 'شماره تلفن ثابت دفتر',
    isRequired: true,
    isEditable: true,
    helpText: 'شماره تلفن خط ثابت با پیش‌شماره شهر',
  },
  {
    key: 'email',
    target: 'OFFICE',
    label: 'آدرس ایمیل رسمی دفتر',
    isRequired: false,
    isEditable: true,
    helpText: 'پست الکترونیکی رسمی مکاتبات',
  },
  {
    key: 'coordinates',
    target: 'OFFICE',
    label: 'موقعیت و مختصات جغرافیایی (نقشه)',
    isRequired: false,
    isEditable: true,
    helpText: 'مختصات طول و عرض جغرافیایی روی نقشه ایران',
  },
  {
    key: 'notes',
    target: 'OFFICE',
    label: 'یادداشت و توضیحات دفتر',
    isRequired: false,
    isEditable: true,
    helpText: 'شرح وضعیت و نکات پرونده‌ای',
  },

  // --- فیلدهای مسئول دفتر ---
  {
    key: 'managerCode',
    target: 'MANAGER',
    label: 'شناسه / کد یکتای مسئول',
    isRequired: true,
    isEditable: false,
    helpText: 'شناسه سیستمی پرونده پرسنلی مسئول',
  },
  {
    key: 'nationalId',
    target: 'MANAGER',
    label: 'کد ملی ۱۰ رقمی مسئول',
    isRequired: true,
    isEditable: true,
    helpText: 'کد ملی معتبر مسئول طبق استعلام ثبت احوال',
  },
  {
    key: 'fullName',
    target: 'MANAGER',
    label: 'نام و نام خانوادگی کامل مسئول',
    isRequired: true,
    isEditable: true,
    helpText: 'نام مندرج در شناسنامه و حکم انتصاب',
  },
  {
    key: 'mobilePhone',
    target: 'MANAGER',
    label: 'شماره تلفن همراه مسئول (موبایل)',
    isRequired: true,
    isEditable: true,
    helpText: 'شماره همراه فعال جهت دریافت پیامک‌های امنیتی و بازرسی',
  },
  {
    key: 'landlinePhone',
    target: 'MANAGER',
    label: 'شماره تلفن ثابت مسئول',
    isRequired: false,
    isEditable: true,
    helpText: 'تلفن مستقیم یا داخلی محل کار مسئول',
  },
  {
    key: 'email',
    target: 'MANAGER',
    label: 'آدرس ایمیل اختصاصی مسئول',
    isRequired: false,
    isEditable: true,
    helpText: 'ایمیل مستقیم جهت ارسال ابلاغیه‌های اداری',
  },
  {
    key: 'appointmentDate',
    target: 'MANAGER',
    label: 'تاریخ صدور حکم انتصاب مسئول',
    isRequired: false,
    isEditable: true,
    helpText: 'تاریخ رسمی انتصاب یا تمدید پروانه',
  },
  {
    key: 'notes',
    target: 'MANAGER',
    label: 'توضیحات و سوابق پرسنلی مسئول',
    isRequired: false,
    isEditable: true,
    helpText: 'سوابق آموزشی، گواهینامه‌ها و توضیحات تکمیلی',
  },
];

/**
 * Creates an automated system audit event for an office lifecycle action
 */
export function createAutoAuditEvent(
  officeCode: string,
  eventType: OfficeAuditEventType,
  title: string,
  description: string,
  extra?: Partial<OfficeAuditEvent>
): OfficeAuditEvent {
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat('fa-IR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

  return {
    id: `auto-evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    officeCode,
    eventType,
    title,
    eventDate: dateStr,
    referenceNumber: extra?.referenceNumber || `سیستمی-${Math.floor(1000 + Math.random() * 9000)}`,
    severity: extra?.severity || 'LOW',
    description,
    registeredBy: extra?.registeredBy || 'سیستم هوشمند ممیزی خودکار RA',
    autoLogged: true,
    createdAt: dateStr,
    ...extra,
  };
}
