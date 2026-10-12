import { StorageProviderType, DocumentType } from '../../src/types';

/**
 * ورودی مورد نیاز برای بارگذاری فایل در Storage Provider
 */
export interface StorageUploadInput {
  fileBuffer: Buffer;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  checksum?: string;
  officeId?: string;
  inspectionId?: string;
  applicantId?: string;
  documentType: DocumentType | string;
  documentId?: string;
  version?: number;
}

/**
 * خروجی استاندارد و مشترک تمام Providerها پس از آپلود
 */
export interface StorageUploadOutput {
  fileId: string;
  storageProvider: StorageProviderType;
  storageKey: string;
  storageFileName: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  checksum?: string;
  driveFileId?: string; // اختیاری برای سازگاری با Google Drive
  viewUrl?: string;
  downloadUrl?: string;
  isDuplicate?: boolean;
  syncStatus: 'uploaded' | 'pending' | 'failed';
  errorMessage?: string;
}

/**
 * متادیتای فایل در Storage
 */
export interface StorageFileMetadata {
  fileId: string;
  storageProvider: StorageProviderType;
  storageKey: string;
  storageFileName: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  checksum?: string;
  createdAt: string;
  officeId?: string;
  applicantId?: string;
  inspectionId?: string;
  documentType?: string;
}

/**
 * اینترفیس واحد و استاندارد برای تمام ارائه‌دهندگان فضای ذخیره‌سازی (Storage Providers)
 */
export interface IStorageProvider {
  readonly providerType: StorageProviderType;

  /**
   * بررسی وضعیت و اتصال Provider
   */
  isConfigured(): boolean;

  /**
   * بارگذاری فایل در ساختار سلسله‌مراتبی
   */
  upload(input: StorageUploadInput): Promise<StorageUploadOutput>;

  /**
   * دریافت باینری فایل جهت دانلود یا نمایش در سامانه
   */
  download(fileId: string, storageKey?: string): Promise<{ buffer: Buffer; mimeType: string; fileName: string }>;

  /**
   * بررسی وجود فایل
   */
  exists(fileId: string, storageKey?: string): Promise<boolean>;

  /**
   * دریافت متادیتای فایل
   */
  getMetadata(fileId: string, storageKey?: string): Promise<StorageFileMetadata | null>;

  /**
   * دریافت لینک مشاهده امن
   */
  getViewUrl(fileId: string, storageKey?: string): Promise<string>;

  /**
   * حذف فایل (Logical یا Physical)
   */
  delete(fileId: string, storageKey?: string): Promise<boolean>;
}
