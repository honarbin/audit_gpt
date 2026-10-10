export type NotificationChannelType = 'IN_APP' | 'SMS' | 'EMAIL' | 'WEB_PUSH' | 'WEBHOOK';

export type NotificationCategory = 
  | 'INSPECTION_ACTION'   // درخواست بارگذاری مدارک و آغاز دوره بازرسی
  | 'DEFECT_ALERT'        // اعلام نقص مدارک، عدم انطباق و مهلت رفع نقص
  | 'OFFICE_RESPONSE'     // پاسخ دفتر و بارگذاری مدارک تکمیلی
  | 'INSPECTOR_VERDICT'   // صدور رأی و نتیجه ارزیابی بازرس
  | 'LIFECYCLE_EVENT'     // احکام نظارتی (تعلیق، رفع تعلیق، ابطال مجوز)
  | 'EXPIRATION_ALARM'    // هشدار فرارسیدن موعد انقضای تعهدنامه یا تعلیق
  | 'SYSTEM';             // پیام‌های سیستمی و تغییرات پیکربندی

export type NotificationSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';

export type NotificationPriority = 'NORMAL' | 'HIGH' | 'URGENT';

export type NotificationStatus = 
  | 'UNREAD'           // خوانده نشده
  | 'READ'             // خوانده شده
  | 'ACTION_REQUIRED'  // نیازمند اقدام / پاسخ فوری
  | 'RESPONDED'        // پاسخ داده شده و مدارک ارسال شده
  | 'RESOLVED'         // اقدام انجام شده و مختومه
  | 'ARCHIVED';        // بایگانی شده

export interface ChannelDeliveryStatus {
  channel: NotificationChannelType;
  status: 'PENDING' | 'DISPATCHED' | 'FAILED' | 'DISABLED';
  targetAddress?: string;       // شماره موبایل، ایمیل یا آدرس وب‌هوک
  dispatchedAt?: string;        // زمان ارسال شمسی/ایزو
  externalMessageId?: string;   // شناسه در سامانه پیامک، ایمیل یا سامانه مقصد
  responseCode?: number;        // کد پاسخ HTTP سامانه مقصد
  errorMessage?: string;        // متن خطا در صورت شکست
}

export interface NotificationResponseRecord {
  id: string;
  responderRole: 'OFFICE_USER' | 'INSPECTOR' | 'SUPERVISOR' | 'SYSTEM';
  responderName: string;
  responseText: string;
  responseDate: string;
  actionTaken?: string;         // نوع اقدام انجام شده (بارگذاری مدرک، رفع نقص، تایید)
  attachedDocNames?: string[];
  newStatus?: NotificationStatus;
}

export interface NotificationExportablePayload {
  version: string;
  eventId: string;
  eventCode: string;
  timestamp: string;
  environment: string;
  sourceSystem: string;
  targetSystem?: string;
  eventCategory: NotificationCategory;
  severity: NotificationSeverity;
  priority: NotificationPriority;
  recipient: {
    role: string;
    officeCode?: string;
    officeName?: string;
    contactMobile?: string;
    contactEmail?: string;
  };
  details: {
    title: string;
    summary: string;
    trackingCode?: string;
    certificateSerial?: string;
    applicantName?: string;
    nationalId?: string;
    campaignId?: string;
    campaignTitle?: string;
    defects?: string[];
    deadlineDate?: string;
    complianceScore?: number;
  };
  latestAction?: {
    status: NotificationStatus;
    respondedAt?: string;
    respondedBy?: string;
    responseNotes?: string;
  };
  dispatchInfo: {
    channels: string[];
    webhookCallbackUrl?: string;
    signatureHMAC?: string;
  };
}

export interface AppNotification {
  id: string;
  eventCode: string;                    // کد یکتای رویداد نظارتی (مثلا EVT-DOC-REQ-1042)
  title: string;
  message: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  priority: NotificationPriority;
  status: NotificationStatus;
  
  // ارجاعات و موجودیت مرتبط
  officeCode?: string;
  officeName?: string;
  targetEntityId?: string;              // شناسه پرونده، کمپین یا دفتر
  targetEntityType?: 'INSPECTION_RECORD' | 'CAMPAIGN' | 'OFFICE' | 'AUDIT_EVENT';
  
  // زمان‌بندی
  createdAt: string;                    // تاریخ و ساعت ایجاد
  updatedAt: string;                    // تاریخ و ساعت آخرین به‌روزرسانی یا ثبت پاسخ
  expiresAt?: string;                   // مهلت اقدام یا انقضا
  
  // وضعیت کانال‌های ارتباطی
  channels: ChannelDeliveryStatus[];
  
  // تاریخچه پاسخ‌ها و اقدامات متقابل
  responseHistory?: NotificationResponseRecord[];
  latestResponse?: NotificationResponseRecord;
  
  // داده‌های تکمیلی
  metadata?: {
    trackingCode?: string;
    applicantName?: string;
    nationalId?: string;
    campaignId?: string;
    campaignTitle?: string;
    defectsList?: string[];
    complianceScore?: number;
    deadlineDate?: string;
    guarantorName?: string;
    samplesCount?: number;
    actionUrl?: string;
    customData?: Record<string, any>;
    [key: string]: any;
  };
  
  // بسته داده قابل خواندن برای ارسال به سامانه‌های دیگر
  exportablePayload: NotificationExportablePayload;
}

export interface NotificationChannelConfig {
  inAppEnabled: boolean;
  
  smsEnabled: boolean;
  smsProvider: 'KAVENEGAR' | 'MAGFA' | 'FARAPARTO' | 'CUSTOM';
  smsApiKey?: string;
  smsSenderNumber?: string;
  smsDefaultRecipient?: string;
  
  emailEnabled: boolean;
  emailSmtpHost?: string;
  emailSmtpPort?: number;
  emailSenderAddress?: string;
  emailDefaultRecipient?: string;
  
  webPushEnabled: boolean;
  
  webhookEnabled: boolean;
  webhookUrl?: string;
  webhookAuthBearer?: string;
  webhookSecretHMAC?: string;
  webhookAutoDispatchOnCreate: boolean;
  webhookAutoDispatchOnResponse: boolean;
}

export type NotificationChannelsConfig = NotificationChannelConfig;

export interface TemplateVariable {
  key: string;
  label: string;
  example: string;
}

export interface NotificationMessageTemplate {
  id: string;
  category: NotificationCategory;
  name: string;
  description: string;
  iconName?: string;
  
  // SMS Configuration
  smsEnabled: boolean;
  smsPatternCode?: string; // کد الگوی پیامک (وب‌سرویس خدماتی / پترن کاوه‌نگار یا مگفا)
  smsTemplate: string;
  
  // Email Configuration
  emailEnabled: boolean;
  emailSubject: string;
  emailBodyHtml: string;
  
  // In-App & Push Notification
  inAppTitle: string;
  inAppMessage: string;
  
  // Available placeholders for this category
  variables: TemplateVariable[];
}
