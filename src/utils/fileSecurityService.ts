import { UploadedDocument, DocumentVersion, DocumentDefectItem, DocumentAnnotation, DocumentPageItem } from '../types';
import { AppUser } from '../types/auth';
import { logUserAccessAction } from '../services/authService';

export interface FileValidationResult {
  isValid: boolean;
  errorMessage?: string;
  fileDataUrl?: string;
  isPasswordProtected?: boolean;
  isCorrupted?: boolean;
  fileType?: string;
}

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 Megabytes
const MIN_FILE_SIZE_BYTES = 2 * 1024;        // 2 Kilobytes (prevents 0-byte or empty files)

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/pjpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

/**
 * بررسی فرمت، حجم، عدم خرابی و عدم رمزدار بودن فایل مدرک
 */
export async function validateUploadedFile(file: File): Promise<FileValidationResult> {
  // 1. بررسی حجم فایل
  if (file.size < MIN_FILE_SIZE_BYTES) {
    return {
      isValid: false,
      errorMessage: `حجم فایل انتخاب شده (${(file.size / 1024).toFixed(1)} KB) کمتر از حد مجاز (حداقل ۲ کیلوبایت) است. لطفاً فایل کامل و بدون خرابی را انتخاب فرمایید.`,
      isCorrupted: true,
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      isValid: false,
      errorMessage: `حجم فایل انتخاب شده (${(file.size / (1024 * 1024)).toFixed(1)} MB) بیش از سقف مجاز (۱۵ مگابایت) می‌باشد. لطفاً حجم تصویر یا پی‌دی‌اف را کاهش دهید.`,
    };
  }

  // 2. بررسی پسوند و نوع فایل
  const fileNameLower = file.name.toLowerCase();
  const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => fileNameLower.endsWith(ext));
  const hasValidMime = ALLOWED_MIME_TYPES.includes(file.type.toLowerCase()) || file.type === '';

  if (!hasValidExt && !hasValidMime) {
    return {
      isValid: false,
      errorMessage: 'فرمت فایل انتخابی مجاز نمی‌باشد. صرفاً فرمت‌های تصویر (JPG، PNG، WEBP) و اسناد PDF پشتیبانی می‌شوند.',
    };
  }

  // 3. خواندن باینری فایل برای بررسی سلامت و رمزنگاری
  return new Promise<FileValidationResult>((resolve) => {
    const reader = new FileReader();

    reader.onerror = () => {
      resolve({
        isValid: false,
        errorMessage: 'خطا در خواندن فایل از روی حافظه دستگاه. فایل آسیب‌دیده یا غیرقابل دسترس است.',
        isCorrupted: true,
      });
    };

    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;

      // اگر پی‌دی‌اف است، بررسی هدر استاندارد و بررسی رمزدار بودن
      if (fileNameLower.endsWith('.pdf') || file.type === 'application/pdf') {
        try {
          const sliceBuffer = await file.slice(0, 50000).arrayBuffer();
          const headerText = new TextDecoder('latin1').decode(sliceBuffer);

          if (!headerText.includes('%PDF-')) {
            resolve({
              isValid: false,
              errorMessage: 'ساختار فایل PDF انتخابی نامعتبر یا خراب است (فاقد مشخصه استاندارد %PDF-).',
              isCorrupted: true,
            });
            return;
          }

          // بررسی وجود کلیدواژه رمزنگاری PDF
          if (headerText.includes('/Encrypt')) {
            resolve({
              isValid: false,
              errorMessage: 'فایل PDF انتخابی رمزدار (Password-Protected) است. لطفاً نسخه بدون رمز و قفل را بارگذاری فرمایید.',
              isPasswordProtected: true,
            });
            return;
          }
        } catch (e) {
          console.warn('PDF header check error:', e);
        }

        resolve({
          isValid: true,
          fileDataUrl: dataUrl,
          fileType: 'application/pdf',
        });
        return;
      }

      // اگر تصویر است، بررسی قابلیت Decode و رندر بدون نقص
      if (file.type.startsWith('image/') || hasValidExt) {
        const img = new Image();
        img.onload = () => {
          if (img.naturalWidth === 0 || img.naturalHeight === 0) {
            resolve({
              isValid: false,
              errorMessage: 'تصویر انتخاب‌شده دارای ابعاد صفر یا ساختار باینری مخدوش است.',
              isCorrupted: true,
            });
          } else {
            resolve({
              isValid: true,
              fileDataUrl: dataUrl,
              fileType: file.type || 'image/jpeg',
            });
          }
        };

        img.onerror = () => {
          resolve({
            isValid: false,
            errorMessage: 'فایل تصویر مخدوش یا خراب (Corrupted) است و باز نمی‌شود.',
            isCorrupted: true,
          });
        };

        img.src = dataUrl;
        return;
      }

      resolve({
        isValid: true,
        fileDataUrl: dataUrl,
        fileType: file.type || 'application/octet-stream',
      });
    };

    reader.readAsDataURL(file);
  });
}

/**
 * ایجاد نسخه جدید مدرک و ذخیره نسخه قبلی در تاریخچه (Document Versioning)
 */
export function createNewDocumentVersion(
  existingDoc: UploadedDocument | undefined,
  newDocData: Omit<UploadedDocument, 'version' | 'previousVersions'>
): UploadedDocument {
  if (!existingDoc) {
    return {
      ...newDocData,
      version: 1,
      previousVersions: [],
    };
  }

  // ایجاد رکورد نسخه قبلی
  const previousSnapshot: DocumentVersion = {
    version: existingDoc.version || 1,
    fileName: existingDoc.fileName,
    fileType: existingDoc.fileType,
    fileSize: existingDoc.fileSize,
    fileDataUrl: existingDoc.fileDataUrl,
    uploadDate: existingDoc.uploadDate,
    uploadedBy: existingDoc.uploadedBy,
    notes: existingDoc.notes,
    complianceStatus: existingDoc.complianceStatus,
    defects: existingDoc.defects ? [...existingDoc.defects] : [],
    inspectorNotes: existingDoc.inspectorNotes,
    pages: existingDoc.pages ? [...existingDoc.pages] : undefined,
  };

  const updatedHistory = [
    previousSnapshot,
    ...(existingDoc.previousVersions || []),
  ];

  return {
    ...newDocData,
    id: existingDoc.id, // حفظ همان شناسه منطقی مدرک
    version: (existingDoc.version || 1) + 1,
    previousVersions: updatedHistory,
    annotations: existingDoc.annotations || [],
  };
}

/**
 * ثبت لاگ رسمی دسترسی، دانلود، رویت، بارگذاری یا حذف مدرک در سامانه
 */
export function logDocumentAuditAction(
  user: AppUser | null,
  actionType: 'DOCUMENT_VIEW' | 'DOCUMENT_DOWNLOAD' | 'DOCUMENT_UPLOAD' | 'DOCUMENT_DELETE',
  docTitle: string,
  recordApplicant?: string,
  extraDetails?: string
) {
  const fallbackUser: AppUser = user || {
    id: 'system',
    username: 'کاربر سیستم',
    fullName: 'کاربر احراز هویت شده',
    nationalId: '0000000000',
    passwordHash: '',
    role: 'OFFICE_USER',
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  const details = [
    `عنوان مدرک: ${docTitle}`,
    recordApplicant ? `متقاضی: ${recordApplicant}` : null,
    extraDetails,
  ]
    .filter(Boolean)
    .join(' | ');

  return logUserAccessAction(fallbackUser, actionType, details);
}
