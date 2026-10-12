export type CertificateType = 
  | 'NATURAL'          // شخص حقیقی
  | 'LEGAL_REP'        // نماینده شخص حقوقی
  | 'LEGAL_SEAL'       // مهر سازمانی الکترونیکی
  | 'GOV_STAFF'        // شخص حقیقی وابسته به دولت
  | 'SERVER';          // سرور و نرم‌افزار

export type DependencyType = 
  | 'INDIVIDUAL_INDEPENDENT'   // شخص حقیقی-مستقل
  | 'LEGAL_NON_GOV'             // شخص حقوقی-وابسته به غیردولت
  | 'INDIVIDUAL_NON_GOV'        // شخص حقیقی-وابسته به غیردولت
  | 'LEGAL_GOV'                 // شخص حقوقی-وابسته به دولت
  | 'INDIVIDUAL_GOV';           // شخص حقیقی-وابسته به دولت

export type CertificateStatus = 
  | 'VALID'          // معتبر
  | 'REVOKED'        // ابطال
  | 'NOT_ACCEPTED'   // پذیرش نشده
  | 'EXPIRED'        // منقضی
  | 'SUSPENDED';     // معلق

export type PriorityRuleType = 
  | 'REVOKED'                 // ۱. گواهی‌های ابطال‌شده
  | 'INCOMPLETE_INFO'          // ۲. گواهی‌هایی با اطلاعات ناقص
  | 'SHORT_VALIDITY'          // ۳. گواهی‌های دارای اعتبار کوتاه یا ابطال در مدت کوتاه
  | 'MULTI_CERT_APPLICANTS'   // ۴. گواهی‌های اشخاص یا سازمان‌های چند گواهی
  | 'OLDEST'                  // ۵. قدیمی‌ترین گواهی صادرشده دفتر
  | 'NEWEST'                  // ۶. جدیدترین گواهی صادرشده دفتر
  | 'ANOMALIES';               // ۷. سایر موارد غیرعادی (ساعات نامتعارف، نمره ریسک بالا)

export type AssuranceLevel = 'BASIC' | 'MEDIUM' | 'HIGH';

export type AuthMethod = 'IN_PERSON' | 'BIOMETRIC_ONLINE' | 'SHAHKAR';

export type InspectionStatus = 
  | 'PENDING_UPLOAD'      // در انتظار بارگذاری مدارک توسط دفتر
  | 'UPLOADED'            // مدارک بارگذاری شده (آماده بررسی)
  | 'UNDER_REVIEW'        // در حال بررسی کارشناسی (سطح ۱)
  | 'RETURNED_TO_OFFICE'  // برگشت به کارتابل دفتر جهت رفع نقص (توسط کارشناس بازرسی)
  | 'REFERRED_TO_SENIOR'  // ارسال به کارتابل بازرس ارشد جهت تصمیم‌گیری مقام بالاتر (سطح ۲)
  | 'APPROVED'            // تایید قطعی مدارک و انطباق (توسط بازرس ارشد / سرپرست)
  | 'CONDITIONAL'         // تایید مشروط با تذکر
  | 'DEFECT_MINOR'        // عدم انطباق جزئی (حکم قطعی)
  | 'DEFECT_MAJOR'        // عدم انطباق عمده / بحرانی (حکم قطعی)
  | 'REJECTED';           // رد مدارک / درخواست اصلاح و ارسال مجدد

export type DocumentType = 
  | 'APPLICATION_FORM'       // فرم پذیرش
  | 'LEGAL_INTRO_LETTER'     // معرفینامه
  | 'ESTABLISHMENT_NOTICE'   // آگهی تاسیس
  | 'OFFICIAL_GAZETTE'       // آخرین روزنامه رسمی
  | 'REVOCATION_REQUEST';    // فرم یا درخواست کتبی ابطال

export interface CertificateRecord {
  id: string;
  trackingCode: string;            // کد رهگیری
  serialNumber: string;            // شماره سریال گواهی
  applicantName: string;           // نام متقاضی
  nationalId: string;              // کد ملی
  mobileNumber: string;            // شماره تلفن همراه
  officeCode: string;              // کد دفتر
  officeName: string;              // نام دفتر
  certificateType: CertificateType;// نوع گواهی
  dependencyType: DependencyType;  // نوع وابستگی ۵ گانه مصوب
  status: CertificateStatus;       // وضعیت گواهی (معتبر، ابطال‌شده، و...)
  assuranceLevel: AssuranceLevel;  // سطح اطمینان
  issueDate: string;               // تاریخ صدور (شمسی)
  issueTime: string;               // زمان صدور
  expireDate: string;              // تاریخ انقضا
  revocationDate?: string;         // تاریخ ابطال (در صورت ابطال)
  revocationReason?: string;       // علت ابطال
  validityDurationDays?: number;   // مدت اعتبار به روز
  authMethod: AuthMethod;          // روش احراز هویت
  companyName?: string;            // نام شرکت (در صورت حقوقی)
  companyNationalId?: string;      // شناسه ملی شرکت
  hasIncompleteInfo?: boolean;     // دارای اطلاعات ناقص
  incompleteInfoDetails?: string[];// جزئیات نواقص اطلاعاتی
  applicantOrOrgCertCount?: number;// تعداد کل گواهی‌های این شخص/سازمان در خروجی دفتر
  isOldestInOffice?: boolean;      // آیا قدیمی‌ترین گواهی دفتر است
  isNewestInOffice?: boolean;      // آیا جدیدترین گواهی دفتر است
  isAnomalyOrOffHours?: boolean;   // آیا دارای ناهنجاری صدور است
  selectedReasonBadge?: string;    // دلیل انتخاب در نمونه (مثلا: "پوشش وابستگی: حقوقی دولتی" یا "اولویت ۱: ابطال‌شده")
  riskScore: number;               // نمره ریسک (۰ تا ۱۰۰)
  riskFactors?: string[];          // دلایل ریسک (مثلا صدور در نیمه‌شب، حقوقی حساس)
  rawRowData?: Record<string, any>;// داده‌های خام اکسل
}

export interface QualityChecklistResult {
  exactCountMatch: boolean;           // شرط ۱: تعداد دقیقاً ۷ عدد (یا عدد تنظیم شده)
  targetCount: number;
  currentCount: number;
  dependencyCoverageSatisfied: boolean;// شرط ۲: پوشش تمام انواع وابستگی موجود
  availableDependencyTypes: DependencyType[];
  coveredDependencyTypes: DependencyType[];
  missingDependencyTypes: DependencyType[];
  revokedCoverageSatisfied: boolean;  // شرط ۳: پوشش ۲ ابطال (یا ۱ در صورت وجود یکی)
  revokedAvailableInOffice: number;
  revokedSelectedInSample: number;
  noDuplicatesSatisfied: boolean;     // شرط ۴: عدم تکرار هیچ گواهی
  allPassed: boolean;
  notes: string[];
}

export interface SamplingAlgorithmConfig {
  method: 'OFFICIAL_7_RULES' | 'CUSTOM_RULES' | 'RANDOM' | 'STRATIFIED' | 'RISK_BASED' | 'HYBRID';
  sampleSize: number;                 // تعداد هدف (پیش‌فرض ۷ گواهی)
  sampleSizeType: 'COUNT' | 'PERCENTAGE';
  enforceDependencyCoverage: boolean; // پوشش انواع وابستگی
  requiredDependencyTypes?: DependencyType[];
  enforceRevokedCoverage: boolean;    // پوشش گواهی‌های ابطال شده
  minRevokedCount: number;            // حداقل تعداد ابطال (پیش‌فرض ۲)
  priorityCriteriaOrder?: PriorityRuleType[]; // ترتیب اولویت‌های ۷ گانه
  minLegalPercent?: number;           // حداقل سهمیه حقوقی
  minSealPercent?: number;            // حداقل سهمیه مهر سازمانی
  filterDateStart?: string;           // شروع بازه تاریخ
  filterDateEnd?: string;             // پایان بازه تاریخ
  onlyHighAssurance?: boolean;        // فقط سطح اطمینان بالا
  prioritizeOffHours?: boolean;       // اولویت‌دهی به صدورهای ساعات غیراداری
  riskThreshold?: number;             // آستانه ریسک (مثلا بالای ۶۰)
  specificOfficeCode?: string;        // کد دفتر خاص
}

export interface DocumentDefectItem {
  id: string;
  code: string;
  title: string;
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR';
  notes?: string;
}

export interface CaseNoteEntry {
  id: string;
  authorRole: 'OFFICE_USER' | 'INSPECTOR' | 'SENIOR_INSPECTOR' | 'SYSTEM';
  authorName: string;
  text: string;
  timestamp: string;               // تاریخ و ساعت شمسی
  statusAtTime?: InspectionStatus;  // وضعیت پرونده در زمان ثبت یادداشت
  actionType?: 'NOTE' | 'STATUS_CHANGE' | 'DOC_UPLOAD' | 'DEFECT_ASSIGNED' | 'VERDICT' | 'RETURN_TO_OFFICE' | 'REFER_TO_SENIOR' | 'SENIOR_DECISION' | 'DEFECT_NOTICE';
  auditLevel?: 'LEVEL_1_SPECIALIST' | 'LEVEL_2_SENIOR';
}

export type FormFieldTarget = 'OFFICE' | 'MANAGER';

export interface FormFieldSetting {
  key: string;                     // کلید فیلد
  target: FormFieldTarget;         // 'OFFICE' | 'MANAGER'
  label: string;                   // برچسب فارسی فیلد
  isRequired: boolean;             // اجباری / اختیاری
  isEditable: boolean;             // فعال برای ویرایش / غیرفعال (فقط خواندنی)
  helpText?: string;
}

export interface DocumentPageItem {
  pageNumber: number;
  dataUrl: string;
  fileName: string;
  fileSize: number;
}

export interface DocumentAnnotation {
  id: string;
  type: 'STAMP_APPROVED' | 'STAMP_DEFECTIVE' | 'STAMP_SIGNATURE_MISMATCH' | 'STAMP_ILLEGIBLE' | 'TEXT_NOTE';
  label: string;
  authorName: string;
  authorRole?: string;
  timestamp: string;
  x?: number; // 0-100 percentage
  y?: number; // 0-100 percentage
  comment?: string;
}

export interface DocumentVersion {
  version: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileDataUrl?: string;
  uploadDate: string;
  uploadedBy: string;
  notes?: string;
  complianceStatus?: 'COMPLIANT' | 'DEFECTIVE' | 'PENDING';
  defects?: DocumentDefectItem[];
  inspectorNotes?: string;
  pages?: DocumentPageItem[];
}

export type StorageProviderType = 'google_drive' | 'server' | 's3' | 'supabase';

export interface DocumentRecord {
  id: string;
  fileId: string;
  originalFileName: string;
  storageFileName: string;
  storageProvider: StorageProviderType;
  storageKey: string;
  mimeType: string;
  fileSize: number;
  checksum?: string;
  officeId?: string;
  applicantId?: string;
  inspectionId?: string;
  documentType: DocumentType;
  uploadedBy: string;
  uploadedAt: string;
  syncStatus: 'pending' | 'uploading' | 'uploaded' | 'failed' | 'retrying' | 'deleted' | 'migrating';
  version: number;
  isDeleted?: boolean;
  errorMessage?: string;
  migrationStatus?: 'none' | 'pending' | 'completed' | 'failed';
  sourceProvider?: StorageProviderType;
  targetProvider?: StorageProviderType;
  migratedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UploadedDocument {
  id: string;
  fileId?: string;                 // شناسه یکتای جهانی فایل در لایه Storage (مانند FILE-1405-...)
  docType: DocumentType;
  title: string;
  fileName: string;                // نام اصلی فایل (originalFileName)
  fileType: string;
  fileSize: number;
  checksum?: string;               // چکسام SHA-256 محتوا
  storageProvider?: StorageProviderType; // پرووایدر فعال در زمان ذخیره
  storageKey?: string;             // مسیر فیزیکی/منطقی در استوریج
  storageFileName?: string;        // نام امن تولیدشده توسط سیستم
  fileDataUrl?: string;            // پیش‌نمایش تصویر یا دیتا در کلاینت
  uploadDate: string;
  uploadedBy: string;
  notes?: string;
  driveFileId?: string;            // شناسه فایل در گوگل درایو (یا FileId استوریج)
  driveWebViewLink?: string;       // لینک مشاهده در گوگل درایو
  driveDownloadUrl?: string;       // لینک دانلود مستقیم
  driveSynced?: boolean;           // وضعیت ذخیره
  driveSyncDate?: string;          // زمان همگام‌سازی
  driveFolderId?: string;          // شناسه پوشه والد
  syncStatus?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'pending' | 'uploading' | 'uploaded' | 'failed' | 'retrying' | 'deleted' | 'migrating'; // وضعیت انتقال
  syncErrorMessage?: string;       // پیام خطای انتقال در صورت بروز اشکال
  complianceStatus?: 'COMPLIANT' | 'DEFECTIVE' | 'PENDING'; // وضعیت انطباق مدرک
  defects?: DocumentDefectItem[];  // لیست نقایص و عدم انطباق‌های مشخص شده برای این سند
  inspectorNotes?: string;         // توضیحات بازرس برای این مدرک خاص
  version?: number;                // شماره نسخه فعلی (پیش‌فرض ۱)
  previousVersions?: DocumentVersion[]; // تاریخچه نسخه‌های قبلی همین مدرک
  pages?: DocumentPageItem[];      // صفحات چندگانه (برای مدارک چندصفحه‌ای)
  annotations?: DocumentAnnotation[]; // یادداشت‌ها و علامت‌گذاری‌ها/مهرهای بازرس روی مدرک
}

export interface AiAuditResult {
  complianceScore: number;
  status: 'APPROVED' | 'WARNING' | 'REJECTED';
  riskLevel: 'پایین' | 'متوسط' | 'بالا' | 'بحرانی';
  findings: string[];
  missingItems: string[];
  recommendation: string;
  auditNote?: string;
}

export interface AuditInspectionRecord {
  id: string;
  campaignId: string;
  campaignTitle: string;
  officeCode: string;
  officeName: string;
  certificateId: string;
  certificate: CertificateRecord;
  status: InspectionStatus;
  requiredDocuments: DocumentType[];
  documentRequestReasons?: Partial<Record<DocumentType, string>>; // توضیح علت درخواست هر مدرک توسط بازرس
  uploadedDocuments: UploadedDocument[];
  officeNotes?: string;
  notesHistory?: CaseNoteEntry[]; // تاریخچه کامل یادداشت‌ها، مذاکرات و تغییرات وضعیت با ثبت زمان و نقش
  submittedAt?: string;
  inspectorNotes?: string;
  checklistResults?: Record<string, boolean>;
  complianceScore?: number;
  defectCategory?: string;
  reviewDate?: string;
  reviewerName?: string;
  aiAuditResult?: AiAuditResult;

  // فیلدهای ممیزی دو سطحی (کارشناس بازرسی و بازرس ارشد)
  auditLevel?: 'LEVEL_1_INSPECTOR' | 'LEVEL_2_SENIOR' | 'FINALIZED';
  level1InspectorName?: string;           // نام کارشناس بازرسی (سطح ۱)
  level1ReviewDate?: string;              // تاریخ بررسی اولیه و ثبت نقص
  level1Notes?: string;                   // تذکرات و توضیحات کارشناس بازرسی
  level1Recommendation?: 'RETURN_TO_OFFICE' | 'REFER_TO_SENIOR'; // اقدام انجام شده در سطح ۱
  isReferredToSenior?: boolean;           // آیا به کارتابل بازرس ارشد ارسال شده است؟
  seniorReviewerName?: string;            // نام بازرس ارشد / سرپرست ممیزی
  seniorReviewDate?: string;              // تاریخ تصمیم‌گیری مقام بالاتر
  seniorVerdictNotes?: string;            // دستور و رأی نهایی بازرس ارشد
}

export interface AuditCampaign {
  id: string;
  title: string;
  code: string;
  inspectionType: 'PERIODIC_MONTHLY' | 'PERIODIC_SEASONAL' | 'INCIDENTAL' | 'HIGH_RISK_SPECIAL';
  createdAt: string;
  deadlineDate: string;
  officeCode: string;
  officeName: string;
  totalCertificatesInExcel: number;
  selectedSampleCount: number;
  samplingConfig: SamplingAlgorithmConfig;
  status: 'ACTIVE' | 'COMPLETED' | 'OVERDUE';
  records: AuditInspectionRecord[];
  inspectorName: string;
}

export type OfficeStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'REVOKED';

export type OfficeAuditEventType = 
  | 'SUSPENSION'     // تعلیق فعالیت دفتر
  | 'REINSTATEMENT'  // رفع تعلیق و فعال‌سازی مجدد
  | 'VIOLATION'      // پرونده تخلف و صورتجلسه رسیدگی
  | 'COMMITMENT'     // تعهدنامه رسمی (رفع نقص، حسن انجام کار و...)
  | 'INSPECTION'     // بازرسی دوره‌ای / ممیزی میدانی
  | 'WARNING'        // اخطاریه و تذکر کتبی
  | 'REVOCATION';    // ابطال قطعی مجوز فعالیت

export interface OfficeAuditEvent {
  id: string;
  officeCode: string;
  officeName?: string;
  eventType: OfficeAuditEventType;
  title: string;
  eventDate: string;              // تاریخ وقوع رویداد (مثلاً ۱۴۰۵/۰۴/۱۵)
  endDate?: string;               // تاریخ پایان مهلت (برای تعلیق یا مهلت تعهدنامه، مثلاً ۱۴۰۵/۰۵/۱۵)
  referenceNumber?: string;      // شماره نامه / شماره پرونده / شماره صورتجلسه
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  
  // جزئیات پرونده تخلف
  violationClauses?: string[];   // بندهای تخلف آیین‌نامه
  ruling?: string;               // رأی صادره یا دستور مافوق
  fineAmount?: string;           // جریمه یا اقدام انضباطی
  inspectorName?: string;        // نام بازرس یا کارشناس رسیدگی‌کننده
  
  // جزئیات تعهدنامه رسمی
  commitmentType?: 'DEFECT_REMOVAL' | 'GOOD_FAITH' | 'ROOT_CA_COMPLIANCE' | 'STAFF_TRAINING' | 'OTHER';
  commitmentSubject?: string;     // موضوع تعهدنامه
  commitmentDeadline?: string;   // مهلت اجرای تعهد
  commitmentStatus?: 'PENDING' | 'FULFILLED' | 'BREACHED'; // وضعیت اجرای تعهد
  guarantorName?: string;        // متعهد (نام مسئول امضاکننده تعهدنامه)
  
  // جزئیات دوره تعلیق و آلارم هوشمند
  suspensionReason?: string;     // دلیل تعلیق
  suspensionDays?: number;       // مدت تعلیق به روز
  isResolved?: boolean;          // آیا تعلیق رفع شده یا منقضی شده است
  isAlarmActive?: boolean;       // آیا آلارم هوشمند نزدیک به پایان مهلت فعال است
  resolvedDate?: string;         // تاریخ رفع تعلیق
  
  attachedDocumentsCount?: number;// تعداد مستندات پیوست
  attachedDocNames?: string[];   // عناوین مدارک پیوست (عکس، صورتجلسه، تعهدنامه اسکن شده)
  registeredBy?: string;         // کاربر ثبت‌کننده
  autoLogged?: boolean;          // آیا به صورت خودکار توسط سیستم ثبت شده است
  createdAt: string;             // تاریخ ثبت سیستمی
}

export interface OfficeManager {
  id: string;                    // کد یکتای سیستمی مسئول (مثلا MGR-1042)
  managerCode: string;           // کد پرسنلی / شناسه یکتای اختصاصی مسئول
  username?: string;             // نام کاربری ورود به سامانه
  nationalId: string;            // کد ملی ۱۰ رقمی مسئول
  fullName: string;              // نام و نام خانوادگی مسئول
  mobilePhone: string;           // شماره تلفن همراه مسئول (موبایل)
  landlinePhone: string;         // شماره تلفن ثابت مسئول
  email?: string;                // آدرس ایمیل مسئول
  assignedOfficeCode: string;    // کد یکتای دفتر ثبت نام منتسب (ارتباط کلیدی)
  assignedOfficeName?: string;   // نام دفتر ثبت نام منتسب
  appointmentDate?: string;      // تاریخ انتصاب
  status: 'ACTIVE' | 'INACTIVE'; // وضعیت مسئول
  notes?: string;                // توضیحات تکمیلی
}

export type OfficeTypeCode = 
  | 'PRESHKHAN'    // دفتر پیشخوان دولت
  | 'NOTARY'       // دفتر اسناد رسمی
  | 'EDUCATION'    // مرکز آموزش
  | 'ORGANIZATION' // سازمان/شرکت
  | 'OTHER';       // سایر (قابل تعریف)

export interface OfficeTypeDefinition {
  code: string;
  title: string;
  description?: string;
  color: string;
  iconName?: string;
  isCustom?: boolean;
}

export interface OfficeProfile {
  id?: string;                   // شناسه یکتا
  code: string;                  // کد یکتای دفتر ثبت نام (کلید اصلی ارتباط با کاربران و مسئولین)
  name: string;                  // نام دفتر ثبت نام
  type: string;                  // نوع دفتر ثبت نام (کد نوع)
  customTypeName?: string;       // در صورت انتخاب نوع سفارشی / سایر
  province: string;              // استان
  city: string;                  // شهرستان / شهر
  address: string;               // آدرس دقیق پستی
  phone: string;                 // شماره تلفن ثابت دفتر
  email?: string;                // آدرس ایمیل رسمی دفتر
  latitude?: number;             // عرض جغرافیایی روی نقشه
  longitude?: number;            // طول جغرافیایی روی نقشه
  managerId?: string;            // شناسه مسئول منتسب (ارتباط کلیدی با جدول office_managers)
  managerName: string;           // نام و نام خانوادگی مسئول جهت نمایش سریع
  activeCampaignsCount?: number; // تعداد پرونده‌های بازرسی فعال
  status?: OfficeStatus;         // وضعیت فعالیت دفتر: فعال، غیرفعال، تعلیق، ابطال شده
  createdAt?: string;            // تاریخ ثبت
  notes?: string;                // توضیحات
}

export interface ProvinceGeoData {
  name: string;
  centerLat: number;
  centerLng: number;
  zoom: number;
  counties: string[];
}

export interface OfficeBatchImportSummary {
  totalRows: number;
  successCount: number;
  updatedCount: number;
  errorCount: number;
  errors: { row: number; officeCode?: string; field?: string; message: string }[];
  importedOffices: OfficeProfile[];
  importedManagers: OfficeManager[];
}

export * from './types/notifications';
export * from './types/auth';

