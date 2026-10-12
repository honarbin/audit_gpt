import { StorageProviderType } from '../../src/types';
import {
  IStorageProvider,
  StorageUploadInput,
  StorageUploadOutput,
  StorageFileMetadata,
} from './IStorageProvider';
import { GoogleDriveProvider } from './GoogleDriveProvider';
import { ServerStorageProvider } from './ServerStorageProvider';

export class StorageService {
  private static instance: StorageService;
  private providers: Map<StorageProviderType, IStorageProvider> = new Map();
  private activeProviderType: StorageProviderType;

  private constructor() {
    // رجیستر کردن پرووایدرهای پیش‌فرض
    const gdrive = new GoogleDriveProvider();
    const server = new ServerStorageProvider();

    this.providers.set('google_drive', gdrive);
    this.providers.set('server', server);

    // تشخیص پرووایدر فعال از Environment Variables (پیش‌فرض: مخزن ایمن داخلی سرور بدون نیاز به کلیدهای خارجی)
    const configuredProvider = (process.env.STORAGE_PROVIDER || 'server').toLowerCase() as StorageProviderType;

    if (configuredProvider === ('auto' as any)) {
      if (gdrive.isConfigured()) {
        this.activeProviderType = 'google_drive';
      } else {
        this.activeProviderType = 'server'; // Fallback خودکار به مخزن سرور
      }
    } else if (configuredProvider === 'google_drive' && !gdrive.isConfigured()) {
      console.warn('[StorageService] تنظیمات Google Drive موجود نیست. مخزن ایمن داخلی سرور (Server Storage Vault) فعال شد.');
      this.activeProviderType = 'server';
    } else {
      this.activeProviderType = this.providers.has(configuredProvider) ? configuredProvider : 'server';
    }

    console.log(`[StorageService] Initialized. Active Storage Provider: [${this.activeProviderType}]`);
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  public getActiveProviderType(): StorageProviderType {
    return this.activeProviderType;
  }

  public setActiveProviderType(type: StorageProviderType): void {
    if (this.providers.has(type)) {
      this.activeProviderType = type;
      console.log(`[StorageService] Switched active provider to: [${type}]`);
    } else {
      throw new Error(`Provider [${type}] is not registered in StorageService.`);
    }
  }

  public getProvider(type?: StorageProviderType): IStorageProvider {
    const targetType = type || this.activeProviderType;
    const provider = this.providers.get(targetType);
    if (!provider) {
      throw new Error(`Storage Provider [${targetType}] not found.`);
    }
    return provider;
  }

  /**
   * آپلود از طریق پرووایدر فعال سیستم
   */
  public async upload(input: StorageUploadInput): Promise<StorageUploadOutput> {
    const provider = this.getProvider();
    return provider.upload(input);
  }

  /**
   * دانلود فایل با پشتیبانی از Provider اختصاصی هر سند
   */
  public async download(
    fileId: string,
    storageKey?: string,
    providerType?: StorageProviderType
  ): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
    // اگر فایل متعلق به گوگل درایو باشد یا با gdrive شروع شود، مستقیماً از google_drive گرفته می‌شود
    let target = providerType;
    if (!target) {
      if (fileId.length > 20 && !fileId.startsWith('FILE-')) {
        target = 'google_drive';
      } else {
        target = this.activeProviderType;
      }
    }
    const provider = this.getProvider(target);
    return provider.download(fileId, storageKey);
  }

  public async getMetadata(
    fileId: string,
    storageKey?: string,
    providerType?: StorageProviderType
  ): Promise<StorageFileMetadata | null> {
    const provider = this.getProvider(providerType);
    return provider.getMetadata(fileId, storageKey);
  }

  public async getViewUrl(
    fileId: string,
    storageKey?: string,
    providerType?: StorageProviderType
  ): Promise<string> {
    const provider = this.getProvider(providerType);
    return provider.getViewUrl(fileId, storageKey);
  }

  public async delete(
    fileId: string,
    storageKey?: string,
    providerType?: StorageProviderType
  ): Promise<boolean> {
    const provider = this.getProvider(providerType);
    return provider.delete(fileId, storageKey);
  }

  /**
   * مایگریشن یک مدرک از پرووایدر مبدا (مثلاً Google Drive) به مقصد (مثلاً Server Storage)
   */
  public async migrateFile(params: {
    fileId: string;
    sourceProvider: StorageProviderType;
    targetProvider: StorageProviderType;
    storageKey?: string;
    officeId?: string;
    inspectionId?: string;
    applicantId?: string;
    documentType?: string;
  }): Promise<StorageUploadOutput> {
    const { fileId, sourceProvider, targetProvider, storageKey, officeId, inspectionId, applicantId, documentType } = params;
    const src = this.getProvider(sourceProvider);
    const dest = this.getProvider(targetProvider);

    // ۱. دانلود فایل از پرووایدر مبدا
    const fileData = await src.download(fileId, storageKey);

    // ۲. آپلود به پرووایدر مقصد با حفظ متادیتا
    const uploadRes = await dest.upload({
      fileBuffer: fileData.buffer,
      originalFileName: fileData.fileName,
      mimeType: fileData.mimeType,
      fileSize: fileData.buffer.length,
      officeId,
      inspectionId,
      applicantId,
      documentType: documentType || 'DOCUMENTS',
    });

    console.log(`[StorageService] Successfully migrated file ${fileId} from ${sourceProvider} to ${targetProvider}`);
    return uploadRes;
  }
}
