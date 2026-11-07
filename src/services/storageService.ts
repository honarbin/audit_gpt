import { UploadedDocument, DocumentType, StorageProviderType } from '../types';

export interface StorageUploadOptions {
  officeId?: string;
  applicantId?: string;
  inspectionId?: string;
  documentType?: DocumentType | string;
  checksum?: string;
}

export interface StorageUploadResponse {
  fileId: string;
  storageProvider: StorageProviderType;
  storageKey: string;
  storageFileName?: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  checksum?: string;
  driveFileId?: string;
  viewUrl?: string;
  downloadUrl?: string;
  driveWebViewLink?: string;
  syncStatus: 'pending' | 'uploading' | 'uploaded' | 'failed' | 'retrying' | 'deleted' | 'migrating';
  errorMessage?: string;
  isDuplicate?: boolean;
}

/**
 * سرویس یکپارچه Frontend Storage Service
 * کامپوننت‌های UI صرفاً این متد را فراخوانی می‌کنند و هیچ اطلاعی از Provider فعال ندارند.
 */
export class FrontendStorageService {
  /**
   * آپلود یک سند از طریق API استاندارد بک‌اند
   */
  public static async upload(
    doc: UploadedDocument,
    options?: StorageUploadOptions
  ): Promise<StorageUploadResponse> {
    if (!doc.fileDataUrl) {
      return {
        fileId: doc.fileId || doc.id,
        storageProvider: 'google_drive',
        storageKey: doc.storageKey || '',
        originalFileName: doc.fileName,
        mimeType: doc.fileType,
        fileSize: doc.fileSize,
        syncStatus: 'pending',
        errorMessage: 'محتوای فایل خالی است',
      };
    }

    try {
      const payload = {
        documentId: doc.id,
        file: doc.fileDataUrl,
        originalFileName: doc.fileName,
        mimeType: doc.fileType,
        fileSize: doc.fileSize,
        checksum: doc.checksum,
        officeId: options?.officeId,
        applicantId: options?.applicantId,
        inspectionId: options?.inspectionId,
        documentType: options?.documentType || doc.docType,
      };

      const res = await fetch('/api/v1/files/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        return {
          fileId: data.fileId,
          storageProvider: data.storageProvider || 'google_drive',
          storageKey: data.storageKey,
          storageFileName: data.storageFileName,
          originalFileName: data.originalFileName || doc.fileName,
          mimeType: data.mimeType || doc.fileType,
          fileSize: data.fileSize || doc.fileSize,
          checksum: data.checksum,
          driveFileId: data.driveFileId || data.fileId,
          viewUrl: data.viewUrl || `/api/v1/files/${data.fileId}/view`,
          downloadUrl: data.downloadUrl || `/api/v1/files/${data.fileId}/download`,
          driveWebViewLink: data.viewUrl || (data.driveFileId ? `/api/drive/file/${data.driveFileId}` : undefined),
          syncStatus: data.syncStatus === 'uploaded' ? 'uploaded' : 'pending',
          isDuplicate: data.isDuplicate,
        };
      } else {
        return {
          fileId: doc.fileId || doc.id,
          storageProvider: 'google_drive',
          storageKey: doc.storageKey || '',
          originalFileName: doc.fileName,
          mimeType: doc.fileType,
          fileSize: doc.fileSize,
          syncStatus: 'failed',
          errorMessage: data.error || 'خطا در بارگذاری مدرک در لایه ذخیره‌سازی',
        };
      }
    } catch (err: any) {
      console.error('[FrontendStorageService Upload Error]:', err);
      return {
        fileId: doc.fileId || doc.id,
        storageProvider: 'google_drive',
        storageKey: doc.storageKey || '',
        originalFileName: doc.fileName,
        mimeType: doc.fileType,
        fileSize: doc.fileSize,
        syncStatus: 'failed',
        errorMessage: err.message || 'عدم دسترسی به سرویس ذخیره‌سازی سرور',
      };
    }
  }

  /**
   * دریافت URL نمایش امن درون‌برنامه‌ای سند
   */
  public static getViewUrl(doc: UploadedDocument): string {
    if (doc.fileDataUrl) return doc.fileDataUrl;
    if (doc.fileId) return `/api/v1/files/${doc.fileId}/view`;
    if (doc.driveFileId && !doc.driveFileId.startsWith('pending-')) {
      return `/api/v1/files/${doc.driveFileId}/view`;
    }
    return '';
  }

  /**
   * دریافت URL دانلود مستقیم سند
   */
  public static getDownloadUrl(doc: UploadedDocument): string {
    if (doc.fileId) return `/api/v1/files/${doc.fileId}/download`;
    if (doc.driveFileId && !doc.driveFileId.startsWith('pending-')) {
      return `/api/v1/files/${doc.driveFileId}/download`;
    }
    return '';
  }

  /**
   * بررسی وضعیت Provider فعال در بک‌اند
   */
  public static async getStorageStatus(): Promise<{
    activeProvider: StorageProviderType;
    isConfigured: boolean;
    serverUploadUrl: string;
    message: string;
  }> {
    try {
      const res = await fetch('/api/v1/storage/status');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Could not fetch storage status:', e);
    }
    return {
      activeProvider: 'google_drive',
      isConfigured: false,
      serverUploadUrl: '',
      message: 'عدم ارتباط با سرور',
    };
  }

  /**
   * سوییچ فوری پرووایدر در زمان اجرا
   */
  public static async switchProvider(provider: StorageProviderType): Promise<boolean> {
    try {
      const res = await fetch('/api/v1/storage/provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
