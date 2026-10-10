import crypto from 'crypto';

/**
 * محاسبه هش یکتای محتوای فایل (SHA-256) جهت چکسام و جلوگیری از بارگذاری تکراری (Duplicate Detection)
 */
export function calculateChecksum(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * تولید شناسه استاندارد و یکتای جهانی برای فایل
 * الگو: FILE-1405-XXXXXX یا UUID کوتاه
 */
export function generateFileId(): string {
  const year = '1405';
  const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
  const timestamp = Date.now().toString().slice(-4);
  return `FILE-${year}-${timestamp}${randomHex}`;
}

/**
 * پاک‌سازی نام‌ها و جلوگیری از Path Traversal
 */
export function sanitizePathSegment(segment?: string, fallback = 'general'): string {
  if (!segment) return fallback;
  const cleaned = String(segment)
    .trim()
    .replace(/\.\./g, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_');
  return cleaned || fallback;
}

/**
 * استخراج پسوند فایل ایمن
 */
export function getSafeExtension(originalFileName: string, mimeType?: string): string {
  const parts = originalFileName.split('.');
  if (parts.length > 1) {
    const ext = parts[parts.length - 1].toLowerCase().replace(/[^a-z0-9]/g, '');
    if (ext.length > 0 && ext.length <= 8) {
      return `.${ext}`;
    }
  }

  // نگاشت بر اساس mimeType
  const mimeMap: Record<string, string> = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  };

  return mimeMap[mimeType || ''] || '.bin';
}

/**
 * ساخت Storage Key استاندارد و سلسله‌مراتبی
 * ساختار:
 * ra/{officeId}/inspection/{inspectionId}/applicant/{applicantId}/{documentType}/{year}/{fileId}.{ext}
 */
export function generateStorageKey(params: {
  officeId?: string;
  inspectionId?: string;
  applicantId?: string;
  documentType?: string;
  fileId: string;
  extension: string;
}): { storageKey: string; storageFileName: string } {
  const office = sanitizePathSegment(params.officeId, 'office_unknown');
  const inspection = sanitizePathSegment(params.inspectionId, 'ins_general');
  const applicant = sanitizePathSegment(params.applicantId, 'app_general');
  const docType = sanitizePathSegment(params.documentType, 'DOC');
  const year = new Date().getFullYear().toString();

  const storageFileName = `${params.fileId}${params.extension}`;
  const storageKey = `ra/${office}/inspection/${inspection}/applicant/${applicant}/${docType}/${year}/${storageFileName}`;

  return { storageKey, storageFileName };
}

/**
 * ساخت Idempotency Key جهت مقاومت در برابر دوباره‌ارسال شدن فایل
 */
export function generateIdempotencyKey(params: {
  inspectionId?: string;
  documentType?: string;
  checksum: string;
}): string {
  return `${params.inspectionId || 'global'}:${params.documentType || 'general'}:${params.checksum}`;
}
