import fs from 'fs';
import path from 'path';
import {
  IStorageProvider,
  StorageUploadInput,
  StorageUploadOutput,
  StorageFileMetadata,
} from './IStorageProvider';
import {
  calculateChecksum,
  generateFileId,
  getSafeExtension,
  generateStorageKey,
} from './storageUtils';

export class ServerStorageProvider implements IStorageProvider {
  public readonly providerType = 'server' as const;
  private readonly localStorageDir: string;

  constructor() {
    // مسیر ذخیره فیزیکی روی سرور - خارج از Web Root به صورت امن
    const customDir = process.env.SERVER_STORAGE_LOCAL_DIR;
    this.localStorageDir = customDir
      ? path.resolve(customDir)
      : path.resolve(process.cwd(), 'storage_vault');

    if (!process.env.SERVER_STORAGE_API_URL) {
      // اگر روی دیسک لوکال سرور کار کند، دیرکتوری پایه ساخته می‌شود
      if (!fs.existsSync(this.localStorageDir)) {
        try {
          fs.mkdirSync(this.localStorageDir, { recursive: true });
        } catch (e) {
          console.warn('[ServerStorageProvider] Could not create storage vault dir:', e);
        }
      }
    }
  }

  public isConfigured(): boolean {
    // یا به یک سرور اختصاصی ریموت متصل است، یا از Local Disk Vault سرور استفاده می‌کند
    return Boolean(process.env.SERVER_STORAGE_API_URL || fs.existsSync(this.localStorageDir));
  }

  /**
   * آپلود فایل در سرور:
   * الف) اگر SERVER_STORAGE_API_URL تنظیم شده باشد: با API استاندارد به آن سرور فوروارد می‌شود.
   * ب) اگر نباشد: در ساختار پوشه‌ای امن روی دیسک سرور ذخیره می‌گردد.
   */
  public async upload(input: StorageUploadInput): Promise<StorageUploadOutput> {
    const checksum = input.checksum || calculateChecksum(input.fileBuffer);
    const fileId = generateFileId();
    const ext = getSafeExtension(input.originalFileName, input.mimeType);
    const { storageKey, storageFileName } = generateStorageKey({
      officeId: input.officeId,
      inspectionId: input.inspectionId,
      applicantId: input.applicantId,
      documentType: String(input.documentType),
      fileId,
      extension: ext,
    });

    const remoteApiUrl = process.env.SERVER_STORAGE_API_URL;
    const remoteApiKey = process.env.SERVER_STORAGE_API_KEY;

    // ۱. حالت سرور ریموت اختصاصی Upload API
    if (remoteApiUrl) {
      const endpoint = `${remoteApiUrl.replace(/\/$/, '')}/v1/files/upload`;
      const formData = new FormData();
      const fileBlob = new Blob([input.fileBuffer], { type: input.mimeType });
      formData.append('file', fileBlob, storageFileName);
      formData.append('fileId', fileId);
      formData.append('officeId', input.officeId || '');
      formData.append('inspectionId', input.inspectionId || '');
      formData.append('applicantId', input.applicantId || '');
      formData.append('documentType', String(input.documentType || ''));
      formData.append('originalFileName', input.originalFileName);
      formData.append('mimeType', input.mimeType);
      formData.append('size', String(input.fileSize));
      formData.append('checksum', checksum);
      formData.append('storageKey', storageKey);

      const headers: Record<string, string> = {};
      if (remoteApiKey) {
        headers['Authorization'] = `Bearer ${remoteApiKey}`;
        headers['X-API-Key'] = remoteApiKey;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Remote Upload API Failed: ${res.status} ${errText}`);
      }

      const resData = await res.json();
      return {
        fileId: resData.fileId || fileId,
        storageProvider: 'server',
        storageKey: resData.storageKey || storageKey,
        storageFileName,
        originalFileName: input.originalFileName,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        checksum,
        viewUrl: `/api/v1/files/${fileId}/view`,
        downloadUrl: `/api/v1/files/${fileId}/download`,
        syncStatus: 'uploaded',
      };
    }

    // ۲. حالت Local Disk Vault (ذخیره فیزیکی روی دیسک سرور با ساختار پوشه‌ای کامل)
    const targetFilePath = path.join(this.localStorageDir, ...storageKey.split('/'));
    const targetDirPath = path.dirname(targetFilePath);

    if (!fs.existsSync(targetDirPath)) {
      fs.mkdirSync(targetDirPath, { recursive: true });
    }

    // بررسی Idempotency: اگر فایلی با همین نام موجود بود
    let isDuplicate = false;
    if (fs.existsSync(targetFilePath)) {
      isDuplicate = true;
    }

    // نوشتن فایل به صورت Safe و بدون اجازه دسترسی مستقیم وب
    fs.writeFileSync(targetFilePath, input.fileBuffer);

    // ذخیره متادیتای جانبی در کنار فایل (Sidecar Metadata)
    const metaFilePath = `${targetFilePath}.meta.json`;
    const metaData: StorageFileMetadata = {
      fileId,
      storageProvider: 'server',
      storageKey,
      storageFileName,
      originalFileName: input.originalFileName,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      checksum,
      createdAt: new Date().toISOString(),
      officeId: input.officeId,
      applicantId: input.applicantId,
      inspectionId: input.inspectionId,
      documentType: String(input.documentType),
    };
    fs.writeFileSync(metaFilePath, JSON.stringify(metaData, null, 2), 'utf-8');

    return {
      fileId,
      storageProvider: 'server',
      storageKey,
      storageFileName,
      originalFileName: input.originalFileName,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      checksum,
      viewUrl: `/api/v1/files/${fileId}/view`,
      downloadUrl: `/api/v1/files/${fileId}/download`,
      isDuplicate,
      syncStatus: 'uploaded',
    };
  }

  public async download(fileId: string, storageKey?: string): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
    const filePath = this.resolvePath(fileId, storageKey);
    if (!fs.existsSync(filePath)) {
      throw new Error(`FILE_NOT_FOUND: فایل با شناسه ${fileId} روی سرور یافت نشد.`);
    }

    const buffer = fs.readFileSync(filePath);
    let mimeType = 'application/octet-stream';
    let fileName = path.basename(filePath);

    const metaPath = `${filePath}.meta.json`;
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        mimeType = meta.mimeType || mimeType;
        fileName = meta.originalFileName || fileName;
      } catch {}
    }

    return { buffer, mimeType, fileName };
  }

  public async exists(fileId: string, storageKey?: string): Promise<boolean> {
    const filePath = this.resolvePath(fileId, storageKey);
    return fs.existsSync(filePath);
  }

  public async getMetadata(fileId: string, storageKey?: string): Promise<StorageFileMetadata | null> {
    const filePath = this.resolvePath(fileId, storageKey);
    const metaPath = `${filePath}.meta.json`;
    if (fs.existsSync(metaPath)) {
      try {
        return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      } catch {
        return null;
      }
    }
    return null;
  }

  public async getViewUrl(fileId: string): Promise<string> {
    return `/api/v1/files/${fileId}/view`;
  }

  public async delete(fileId: string, storageKey?: string): Promise<boolean> {
    const filePath = this.resolvePath(fileId, storageKey);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      const metaPath = `${filePath}.meta.json`;
      if (fs.existsSync(metaPath)) {
        fs.unlinkSync(metaPath);
      }
      return true;
    }
    return false;
  }

  private fileIndexCache: Map<string, string> = new Map();

  private resolvePath(fileId: string, storageKey?: string): string {
    if (storageKey) {
      const p = path.join(this.localStorageDir, ...storageKey.split('/'));
      this.fileIndexCache.set(fileId, p);
      return p;
    }

    if (this.fileIndexCache.has(fileId)) {
      const cached = this.fileIndexCache.get(fileId)!;
      if (fs.existsSync(cached)) return cached;
    }

    // جستجوی مستقیم در دایرکتوری پایه
    const directPath = path.join(this.localStorageDir, fileId);
    if (fs.existsSync(directPath)) return directPath;

    // جستجوی بازگشتی در کل ساختار پوشه‌های مخزن برای یافتن fileId
    const found = this.findFileRecursively(this.localStorageDir, fileId);
    if (found) {
      this.fileIndexCache.set(fileId, found);
      return found;
    }

    return directPath;
  }

  private findFileRecursively(dir: string, fileId: string): string | null {
    if (!fs.existsSync(dir)) return null;
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const res = this.findFileRecursively(fullPath, fileId);
        if (res) return res;
      } else if (entry.isFile()) {
        // نام فایل بدون پسوند یا با پسوند بررسی می‌شود (صرف نظر از فایلهای .meta.json)
        if (!entry.name.endsWith('.meta.json') && entry.name.includes(fileId)) {
          return fullPath;
        }
      }
    }
    return null;
  }
}
