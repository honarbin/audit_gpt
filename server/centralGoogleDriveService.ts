/**
 * سرویس مدیریت ارتباط امن سرور با Google Drive API مرکزی (Centralized Google Drive Service)
 * 
 * ویژگی‌های امنیتی و معماری:
 * ۱. Credentialها فقط در Environment Variables سرور (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN) نگهداری می‌شوند.
 * ۲. هیچ کلاینتی دسترسی مستقیم به گوگل درایو ندارد.
 * ۳. توکن دسترسی (access_token) به صورت خودکار با refresh_token تجدید می‌شود و در حافظه موقت (Memory) سرور کش می‌گردد.
 * ۴. ساختار پوشه‌بندی منطقی به ازای دفاتر RA و پرونده‌ها در Google Drive مرکزی ایجاد و کش می‌شود:
 *    [Root Folder / RA Audit Central]
 *       └── Office-[OfficeCode]
 *            └── Case-[ApplicantId or TrackingCode]
 * 5. فایلهای ذخیره‌شده خصوصی (Private) هستند و هرگز Public نمی‌شوند.
 * 6. دانلود/مشاهده مدرک توسط بازرس از طریق کنترل دسترسی سامانه و پراکسی سرور (Proxy Stream) صورت می‌پذیرد.
 */

interface GoogleTokenCache {
  accessToken: string;
  expiresAt: number; // Unix timestamp in ms
}

let tokenCache: GoogleTokenCache | null = null;
const folderCache = new Map<string, string>(); // Path key -> Google Drive Folder ID

/**
 * بررسی اینکه آیا متغیرهای محیطی گوگل درایو در سرور تنظیم شده‌اند یا خیر
 */
export function isGoogleDriveConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
  );
}

/**
 * دریافت Access Token معتبر برای حساب مرکزی گوگل درایو
 */
export async function getCentralDriveAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('GOOGLE_DRIVE_NOT_CONFIGURED: متغیرهای محیطی GOOGLE_CLIENT_ID، GOOGLE_CLIENT_SECRET و GOOGLE_REFRESH_TOKEN در سرور تنظیم نشده‌اند.');
  }

  // بررسی کش در حافظه (اگر ۵ دقیقه تا انقضا مانده باشد، تجدید می‌شود)
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 300000) {
    return tokenCache.accessToken;
  }

  const tokenUrl = 'https://oauth2.googleapis.com/token';
  const bodyParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: bodyParams.toString(),
  });

  if (!response.ok) {
    const errData = await response.text();
    console.error('Google OAuth Token Refresh Failed:', errData);
    throw new Error(`GOOGLE_AUTH_FAILED: خطا در دریافت توکن دسترسی گوگل: ${response.status} ${errData}`);
  }

  const data = await response.json();
  const expiresInMs = (data.expires_in || 3600) * 1000;

  tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + expiresInMs,
  };

  return data.access_token;
}

/**
 * جستجو یا ایجاد یک پوشه در Google Drive مرکزی
 */
export async function getOrCreateFolder(
  folderName: string,
  parentFolderId?: string
): Promise<string> {
  const cacheKey = `${parentFolderId || 'root'}:${folderName}`;
  if (folderCache.has(cacheKey)) {
    return folderCache.get(cacheKey)!;
  }

  const token = await getCentralDriveAccessToken();

  // ۱. بررسی اینکه آیا پوشه از قبل وجود دارد تا از پوشه تکراری جلوگیری شود
  let query = `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName.replace(/'/g, "\\'")}' and trashed = false`;
  if (parentFolderId) {
    query += ` and '${parentFolderId}' in parents`;
  }

  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive`;
  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      const existingId = searchData.files[0].id;
      folderCache.set(cacheKey, existingId);
      return existingId;
    }
  }

  // ۲. ایجاد پوشه جدید در صورت عدم وجود
  const createUrl = 'https://www.googleapis.com/drive/v3/files?fields=id,name';
  const meta: any = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentFolderId) {
    meta.parents = [parentFolderId];
  }

  const createRes = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(meta),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`CREATE_FOLDER_FAILED: ایجاد پوشه ${folderName} در گوگل درایو ناموفق بود: ${errText}`);
  }

  const createdData = await createRes.json();
  folderCache.set(cacheKey, createdData.id);
  return createdData.id;
}

/**
 * دریافت شناسه پوشه هدف بر اساس ساختار استاندارد:
 * Google Drive مرکزی 
 *   └── [GOOGLE_DRIVE_ROOT_FOLDER_NAME یا RA_Audit_Central]
 *        └── Office-[officeCode]
 *             └── Case-[applicantId]
 */
export async function resolveTargetFolder(officeCode?: string, applicantId?: string): Promise<string> {
  const rootFolderName = process.env.GOOGLE_DRIVE_ROOT_FOLDER_NAME || 'RA_Audit_Central';
  const rootParentId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID; // اختیاری (اگر پوشه ریشه از قبل شناسه دارد)

  const centralRootFolderId = await getOrCreateFolder(rootFolderName, rootParentId);

  if (!officeCode) {
    return centralRootFolderId;
  }

  // پوشه اختصاصی دفتر RA
  const cleanOfficeCode = String(officeCode).trim().replace(/[^a-zA-Z0-9_\u0600-\u06FF-]/g, '_');
  const officeFolderName = `Office-${cleanOfficeCode}`;
  const officeFolderId = await getOrCreateFolder(officeFolderName, centralRootFolderId);

  if (!applicantId) {
    return officeFolderId;
  }

  // پوشه اختصاصی پرونده متقاضی
  const cleanApplicant = String(applicantId).trim().replace(/[^a-zA-Z0-9_\u0600-\u06FF-]/g, '_');
  const caseFolderName = `Case-${cleanApplicant}`;
  const caseFolderId = await getOrCreateFolder(caseFolderName, officeFolderId);

  return caseFolderId;
}

export interface CentralUploadResult {
  driveFileId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  driveWebViewLink?: string;
  driveFolderId?: string;
  isDuplicate?: boolean;
}

/**
 * آپلود فایل به Google Drive مرکزی با متادیتا و جلوگیری از فایلهای تکراری (Idempotency)
 */
export async function uploadBufferToCentralDrive(params: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  officeCode?: string;
  applicantId?: string;
  docType?: string;
  documentId?: string;
}): Promise<CentralUploadResult> {
  const { buffer, fileName, mimeType, officeCode, applicantId, docType, documentId } = params;
  const token = await getCentralDriveAccessToken();
  const folderId = await resolveTargetFolder(officeCode, applicantId);

  // ۱. بررسی Idempotency و جلوگیری از Duplicate:
  // اگر فایلی با همین نام یا همین documentId در همین پوشه باشد، فایل تکراری نساز و فایل قبلی را بروزرسانی کن
  const sanitizedDocId = documentId ? documentId.replace(/'/g, "\\'") : '';
  let searchQuery = `'${folderId}' in parents and trashed = false`;
  if (sanitizedDocId) {
    searchQuery += ` and properties has { key='documentId' and value='${sanitizedDocId}' }`;
  } else {
    searchQuery += ` and name = '${fileName.replace(/'/g, "\\'")}'`;
  }

  const checkUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(searchQuery)}&fields=files(id,name,mimeType,size,webViewLink)&spaces=drive`;
  try {
    const checkRes = await fetch(checkUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (checkRes.ok) {
      const checkData = await checkRes.json();
      if (checkData.files && checkData.files.length > 0) {
        const existing = checkData.files[0];
        console.log(`[CentralDrive] Found existing file for documentId ${documentId} (ID: ${existing.id}). Updating content to avoid duplicate.`);
        
        // آپلود محتوای جدید روی فایل قبلی (Update content)
        const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media`;
        const updateRes = await fetch(updateUrl, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': mimeType || 'application/octet-stream',
          },
          body: buffer,
        });

        if (updateRes.ok) {
          return {
            driveFileId: existing.id,
            fileName: existing.name,
            mimeType: existing.mimeType || mimeType,
            fileSize: buffer.length,
            driveWebViewLink: existing.webViewLink,
            driveFolderId: folderId,
            isDuplicate: true,
          };
        }
      }
    }
  } catch (err) {
    console.warn('[CentralDrive] Duplicate check warning:', err);
  }

  // ۲. آپلود فایل جدید به صورت Multipart
  const metadata = {
    name: fileName,
    mimeType: mimeType || 'application/octet-stream',
    parents: [folderId],
    description: `مدرک بارگذاری‌شده پرونده بازرسی دفاتر ثبت نام - نوع: ${docType || 'سند'}`,
    properties: {
      documentId: documentId || '',
      officeCode: officeCode || '',
      applicantId: applicantId || '',
      docType: docType || '',
      uploadedAt: new Date().toISOString(),
      system: 'RA_AUDIT_CENTRAL',
    },
  };

  const boundary = '-------ra_audit_boundary_' + Date.now();
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metaHeader = `Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`;
  const mediaHeader = `Content-Type: ${mimeType || 'application/octet-stream'}\r\n\r\n`;

  const multipartBody = Buffer.concat([
    Buffer.from(delimiter + metaHeader + delimiter + mediaHeader),
    buffer,
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
    throw new Error(`UPLOAD_FAILED: خطا در آپلود به Google Drive مرکزی: ${uploadRes.status} ${errText}`);
  }

  const uploadData = await uploadRes.json();
  return {
    driveFileId: uploadData.id,
    fileName: uploadData.name || fileName,
    mimeType: uploadData.mimeType || mimeType,
    fileSize: Number(uploadData.size) || buffer.length,
    driveWebViewLink: uploadData.webViewLink,
    driveFolderId: folderId,
    isDuplicate: false,
  };
}

/**
 * دریافت محتوای باینری فایل از Google Drive مرکزی جهت نمایش امن در سامانه
 * (بدون دسترسی مستقیم کلاینت به گوگل درایو)
 */
export async function downloadFileFromCentralDrive(driveFileId: string): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
  const token = await getCentralDriveAccessToken();

  // ۱. دریافت مشخصات متادیتای فایل
  const metaUrl = `https://www.googleapis.com/drive/v3/files/${driveFileId}?fields=id,name,mimeType`;
  const metaRes = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  let mimeType = 'application/octet-stream';
  let fileName = 'document';
  if (metaRes.ok) {
    const metaData = await metaRes.json();
    mimeType = metaData.mimeType || mimeType;
    fileName = metaData.name || fileName;
  }

  // ۲. دریافت استریم یا باینری فایل
  const getUrl = `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`;
  const fileRes = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!fileRes.ok) {
    const errText = await fileRes.text();
    throw new Error(`DOWNLOAD_FAILED: دریافت فایل از Google Drive ناموفق بود: ${fileRes.status} ${errText}`);
  }

  const arrayBuffer = await fileRes.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType,
    fileName,
  };
}
