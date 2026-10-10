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
import {
  isGoogleDriveConfigured,
  getCentralDriveAccessToken,
  resolveTargetFolder,
  downloadFileFromCentralDrive,
  getOrCreateFolder,
} from '../centralGoogleDriveService';

export class GoogleDriveProvider implements IStorageProvider {
  public readonly providerType = 'google_drive' as const;

  public isConfigured(): boolean {
    return isGoogleDriveConfigured();
  }

  /**
   * بارگذاری فایل در پوشه‌بندی سلسله‌مراتبی Google Drive:
   * RA_Audit_Central / Office-{code} / Inspection-{id} / Applicant-{id} / {documentType}
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

    if (!this.isConfigured()) {
      // حالت آماده به خدمت و فال‌بک وقتی کلیدها تنظیم نشده باشند
      return {
        fileId,
        storageProvider: 'google_drive',
        storageKey,
        storageFileName,
        originalFileName: input.originalFileName,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        checksum,
        driveFileId: `gdrive-pending-${fileId}`,
        syncStatus: 'pending',
        errorMessage: 'سرویس گوگل درایو در انتظار تنظیم متغیرهای سرور است.',
      };
    }

    const token = await getCentralDriveAccessToken();

    // ۱. ساخت یا پیدا کردن پوشه سلسله‌مراتبی دقیق
    // ریشه و دفتر
    const officeFolderId = await resolveTargetFolder(input.officeId, undefined);
    
    // پوشه بازرسی (Inspection)
    const inspName = `Inspection-${input.inspectionId || 'General'}`;
    const inspFolderId = await getOrCreateFolder(inspName, officeFolderId);

    // پوشه متقاضی (Applicant)
    const appName = `Applicant-${input.applicantId || 'General'}`;
    const appFolderId = await getOrCreateFolder(appName, inspFolderId);

    // پوشه نوع مدرک (DocumentType)
    const docFolderId = await getOrCreateFolder(String(input.documentType || 'DOCUMENTS'), appFolderId);

    // ۲. بررسی Idempotency بر اساس checksum یا نام فایل
    const searchQuery = `'${docFolderId}' in parents and trashed = false and (properties has { key='checksum' and value='${checksum}' } or name = '${storageFileName}')`;
    try {
      const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(searchQuery)}&fields=files(id,name,size,webViewLink)&spaces=drive`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (searchRes.ok) {
        const sData = await searchRes.json();
        if (sData.files && sData.files.length > 0) {
          const existing = sData.files[0];
          console.log(`[GoogleDriveProvider] Idempotent match found. File ${existing.id} already exists.`);
          return {
            fileId,
            storageProvider: 'google_drive',
            storageKey,
            storageFileName: existing.name,
            originalFileName: input.originalFileName,
            mimeType: input.mimeType,
            fileSize: Number(existing.size) || input.fileSize,
            checksum,
            driveFileId: existing.id,
            viewUrl: `/api/v1/files/${existing.id}/view`,
            downloadUrl: `/api/v1/files/${existing.id}/download`,
            isDuplicate: true,
            syncStatus: 'uploaded',
          };
        }
      }
    } catch (e) {
      console.warn('[GoogleDriveProvider] Duplicate check warning:', e);
    }

    // ۳. آپلود به عنوان Multipart با متادیتا کامل
    const metadata = {
      name: storageFileName,
      mimeType: input.mimeType || 'application/octet-stream',
      parents: [docFolderId],
      description: `RA Audit Document: ${input.originalFileName} | StorageKey: ${storageKey}`,
      properties: {
        fileId,
        storageKey,
        originalFileName: input.originalFileName,
        checksum,
        officeId: input.officeId || '',
        inspectionId: input.inspectionId || '',
        applicantId: input.applicantId || '',
        documentType: String(input.documentType || ''),
        documentId: input.documentId || '',
        system: 'RA_AUDIT_SYSTEM',
      },
    };

    const boundary = '-------ra_boundary_' + Date.now();
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metaHeader = `Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`;
    const mediaHeader = `Content-Type: ${input.mimeType || 'application/octet-stream'}\r\n\r\n`;

    const multipartBody = Buffer.concat([
      Buffer.from(delimiter + metaHeader + delimiter + mediaHeader),
      input.fileBuffer,
      Buffer.from(closeDelimiter),
    ]);

    const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink';
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': String(multipartBody.length),
      },
      body: multipartBody,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`GoogleDriveProvider Upload Failed: ${uploadRes.status} ${errText}`);
    }

    const uploadData = await uploadRes.json();
    return {
      fileId,
      storageProvider: 'google_drive',
      storageKey,
      storageFileName: uploadData.name || storageFileName,
      originalFileName: input.originalFileName,
      mimeType: uploadData.mimeType || input.mimeType,
      fileSize: Number(uploadData.size) || input.fileSize,
      checksum,
      driveFileId: uploadData.id,
      viewUrl: `/api/v1/files/${uploadData.id}/view`,
      downloadUrl: `/api/v1/files/${uploadData.id}/download`,
      isDuplicate: false,
      syncStatus: 'uploaded',
    };
  }

  public async download(fileId: string): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
    return downloadFileFromCentralDrive(fileId);
  }

  public async exists(fileId: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const token = await getCentralDriveAccessToken();
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,trashed`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return false;
      const data = await res.json();
      return !data.trashed;
    } catch {
      return false;
    }
  }

  public async getMetadata(fileId: string): Promise<StorageFileMetadata | null> {
    if (!this.isConfigured()) return null;
    try {
      const token = await getCentralDriveAccessToken();
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size,createdTime,properties`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return {
        fileId: data.properties?.fileId || fileId,
        storageProvider: 'google_drive',
        storageKey: data.properties?.storageKey || '',
        storageFileName: data.name,
        originalFileName: data.properties?.originalFileName || data.name,
        mimeType: data.mimeType,
        fileSize: Number(data.size) || 0,
        checksum: data.properties?.checksum,
        createdAt: data.createdTime,
        officeId: data.properties?.officeId,
        applicantId: data.properties?.applicantId,
        inspectionId: data.properties?.inspectionId,
        documentType: data.properties?.documentType,
      };
    } catch {
      return null;
    }
  }

  public async getViewUrl(fileId: string): Promise<string> {
    return `/api/v1/files/${fileId}/view`;
  }

  public async delete(fileId: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const token = await getCentralDriveAccessToken();
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
