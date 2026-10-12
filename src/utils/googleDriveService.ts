import { UploadedDocument, DocumentType } from '../types';
import { FrontendStorageService, StorageUploadResponse } from '../services/storageService';

export const STANDARD_DEFECT_CATALOG: Record<DocumentType, { code: string; title: string; severity: 'CRITICAL' | 'MAJOR' | 'MINOR' }[]> = {
  APPLICATION_FORM: [
    { code: 'NO_SIGNATURE', title: 'عدم وجود امضا یا اثر انگشت متقاضی', severity: 'CRITICAL' },
    { code: 'INCOMPLETE_DATA', title: 'نقص در تکمیل فیلدهای اجباری فرم پذیرش', severity: 'MAJOR' },
    { code: 'DATE_MISMATCH', title: 'مغایرت تاریخ درخواست با تاریخ صدور گواهی', severity: 'MAJOR' },
    { code: 'ILLEGIBLE_SCAN', title: 'ناخوانا بودن تصویر یا مخدوش بودن متن فرم', severity: 'MINOR' },
    { code: 'WRONG_CERT_TYPE', title: 'مغایرت نوع گواهی درخواستی با گواهی صادر شده', severity: 'MAJOR' },
  ],
  LEGAL_INTRO_LETTER: [
    { code: 'NO_SEAL', title: 'فقدان مهر رسمی شرکت یا سازمان در معرفی‌نامه', severity: 'CRITICAL' },
    { code: 'NO_AUTH_SIGN', title: 'عدم امضای دارندگان حق امضای مجاز', severity: 'CRITICAL' },
    { code: 'EXPIRED_TERM', title: 'انقضای مهلت تصدی هیئت مدیره صادرکننده معرفی‌نامه', severity: 'MAJOR' },
    { code: 'NAME_MISMATCH', title: 'مغایرت مشخصات سجلی نماینده با متقاضی گواهی', severity: 'CRITICAL' },
    { code: 'NO_LETTERHEAD', title: 'عدم صدور معرفی‌نامه بر روی سربرگ رسمی', severity: 'MINOR' },
  ],
  ESTABLISHMENT_NOTICE: [
    { code: 'NO_REG_NUMBER', title: 'فقدان شماره ثبت یا شناسه ملی در آگهی تاسیس', severity: 'CRITICAL' },
    { code: 'COMPANY_NAME_DIFF', title: 'مغایرت نام شخص حقوقی با اطلاعات ثبت شده', severity: 'CRITICAL' },
    { code: 'PAGES_MISSING', title: 'ناقص بودن صفحات آگهی تاسیس', severity: 'MAJOR' },
    { code: 'LOW_RESOLUTION', title: 'وضوح پایین و عدم امکان احراز اصالت', severity: 'MINOR' },
  ],
  OFFICIAL_GAZETTE: [
    { code: 'EXPIRED_DIRECTORS', title: 'انقضای مدت ماموریت مدیران در آخرین روزنامه رسمی', severity: 'CRITICAL' },
    { code: 'NO_SIGNATORY_RIGHT', title: 'عدم درج حق امضای منفرد/مشترک نماینده', severity: 'CRITICAL' },
    { code: 'OLD_GAZETTE', title: 'ارائه روزنامه رسمی قدیمی و عدم ارسال آخرین تغییرات', severity: 'MAJOR' },
    { code: 'NO_WATERMARK', title: 'عدم وجود بارکد یا شناسه یکتای پیگیری روزنامه', severity: 'MINOR' },
  ],
  REVOCATION_REQUEST: [
    { code: 'NO_REVOKE_REASON', title: 'عدم قید علت و مستندات قانونی ابطال', severity: 'MAJOR' },
    { code: 'UNAUTHORIZED_APPLICANT', title: 'ارائه درخواست ابطال توسط شخص غیرمجاز', severity: 'CRITICAL' },
    { code: 'REVOKE_DATE_MISSING', title: 'عدم درج تاریخ دقیق درخواست ابطال', severity: 'MAJOR' },
    { code: 'NO_SIGNATURE_REVOKE', title: 'فقدان امضا و اثر انگشت در فرم ابطال', severity: 'CRITICAL' },
  ],
};

export type DriveUploadResponse = StorageUploadResponse;

/**
 * آداپتر حفظ سازگاری:
 * متد uploadDocumentToGoogleDrive اکنون یک Adapter ساده روی FrontendStorageService.upload است.
 * بنابراین هیچ کدی در UI نیازمند تغییرات پرریسک نیست.
 */
export async function uploadDocumentToGoogleDrive(
  doc: UploadedDocument,
  context?: { officeCode?: string; applicantId?: string; inspectionId?: string }
): Promise<DriveUploadResponse> {
  return FrontendStorageService.upload(doc, {
    officeId: context?.officeCode,
    applicantId: context?.applicantId,
    inspectionId: context?.inspectionId,
    documentType: doc.docType,
    checksum: doc.checksum,
  });
}

export function checkDrivePermission(): boolean {
  return true;
}

export function getDocumentSecureStreamUrl(fileIdOrDriveId: string): string {
  return `/api/v1/files/${fileIdOrDriveId}/view`;
}
