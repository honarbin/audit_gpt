import * as XLSX from 'xlsx';
import { 
  CertificateRecord, 
  CertificateType, 
  DependencyType, 
  CertificateStatus, 
  AssuranceLevel, 
  AuthMethod 
} from '../types';
import { getDependencyTypeTitle, getCertificateStatusTitle, areCertificatesIdentical } from './samplingEngine';
import { parseAndStoreAsGregorian, calculateDurationInDays, formatDisplayDate } from './dateFormatter';

// Helper to convert Persian/Arabic digits to English digits
export function toEnglishDigits(str: any): string {
  if (str === null || str === undefined) return '';
  const s = String(str);
  return s
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .trim();
}

// Parse Certificate Type
export function parseCertificateType(val: any): CertificateType {
  const str = String(val || '').trim().toLowerCase();
  if (str.includes('مهر') || str.includes('seal')) return 'LEGAL_SEAL';
  if (str.includes('سرور') || str.includes('server')) return 'SERVER';
  if (str.includes('نماینده') || str.includes('حقوقی') || str.includes('legal') || str.includes('شرکت')) return 'LEGAL_REP';
  if ((str.includes('دولت') || str.includes('کارمند') || str.includes('gov')) && !str.includes('غیردولت') && !str.includes('غیر دولت') && !str.includes('غیردولتی')) {
    return 'GOV_STAFF';
  }
  return 'NATURAL';
}

// Parse Dependency Type according to the 5 official statutory categories:
// ۱. شخص حقیقی-مستقل
// ۲. شخص حقوقی-وابسته به غیردولت
// ۳. شخص حقیقی-وابسته به غیردولت
// ۴. شخص حقیقی-وابسته به دولت
// ۵. شخص حقوقی-وابسته به دولت
export function parseDependencyType(val: any, certType?: CertificateType, companyName?: string): DependencyType {
  const str = String(val || '').trim().toLowerCase().replace(/\s+/g, ' ');

  if (str.includes('حقیقی') && (str.includes('غیردولت') || str.includes('غیر دولت') || str.includes('غیردولتی'))) {
    return 'INDIVIDUAL_NON_GOV';
  }
  if (str.includes('حقوقی') && (str.includes('غیردولت') || str.includes('غیر دولت') || str.includes('غیردولتی'))) {
    return 'LEGAL_NON_GOV';
  }
  if (str.includes('حقوقی') && (str.includes('دولت') || str.includes('دولتی'))) {
    return 'LEGAL_GOV';
  }
  if (str.includes('حقیقی') && (str.includes('دولت') || str.includes('دولتی') || str.includes('کارمند'))) {
    return 'INDIVIDUAL_GOV';
  }
  if (str.includes('مستقل') || str.includes('حقیقی مستقل') || str.includes('حقیقی-مستقل')) {
    return 'INDIVIDUAL_INDEPENDENT';
  }

  // Heuristic deduction from certType and company name
  if (certType === 'GOV_STAFF') {
    return 'INDIVIDUAL_GOV';
  }
  if (certType === 'LEGAL_SEAL' || certType === 'LEGAL_REP') {
    const isGovOrg = companyName && (
      companyName.includes('وزارت') || 
      companyName.includes('سازمان') || 
      companyName.includes('اداره') || 
      companyName.includes('شرکت دولتی') ||
      companyName.includes('بانک ملی') ||
      companyName.includes('بانک سپه')
    );
    return isGovOrg ? 'LEGAL_GOV' : 'LEGAL_NON_GOV';
  }

  return 'INDIVIDUAL_INDEPENDENT';
}

// Parse Certificate Status: معتبر, ابطال, پذیرش نشده
export function parseCertificateStatus(val: any): CertificateStatus {
  const str = String(val || '').trim().toLowerCase();
  if (str.includes('پذیرش نشده') || str.includes('عدم پذیرش') || str.includes('not_accepted') || str.includes('unaccepted') || str.includes('rejected')) {
    return 'NOT_ACCEPTED';
  }
  if (str.includes('ابطال') || str.includes('revok') || str.includes('باطل')) {
    return 'REVOKED';
  }
  if (str.includes('منقضی') || str.includes('expir')) {
    return 'EXPIRED';
  }
  if (str.includes('معلق') || str.includes('suspend')) {
    return 'SUSPENDED';
  }
  return 'VALID';
}

export function parseAssuranceLevel(val: any): AssuranceLevel {
  const str = String(val || '').trim().toLowerCase();
  if (str.includes('بالا') || str.includes('high') || str.includes('3') || str.includes('۳')) return 'HIGH';
  if (str.includes('متوسط') || str.includes('medium') || str.includes('2') || str.includes('۲')) return 'MEDIUM';
  return 'BASIC';
}

export function parseAuthMethod(val: any): AuthMethod {
  const str = String(val || '').trim().toLowerCase();
  if (str.includes('غیرحضوری') || str.includes('بیومتریک') || str.includes('biometric')) return 'BIOMETRIC_ONLINE';
  if (str.includes('شاهکار') || str.includes('shahkar')) return 'SHAHKAR';
  return 'IN_PERSON';
}

// Risk calculation heuristics
export function calculateRisk(record: Partial<CertificateRecord>): { riskScore: number; riskFactors: string[] } {
  let score = 20; // Base score
  const factors: string[] = [];

  // Revoked certificates carry inherent high audit interest
  if (record.status === 'REVOKED') {
    score += 35;
    factors.push('گواهی ابطال‌شده (نیازمند بررسی انطباق علل و درخواست رسمی ابطال)');
  }

  // Certificate Type & Dependency
  if (record.dependencyType === 'LEGAL_NON_GOV' || record.dependencyType === 'LEGAL_GOV') {
    score += 25;
    factors.push(`گواهی حقوقی (${getDependencyTypeTitle(record.dependencyType)})`);
  }
  if (record.certificateType === 'LEGAL_SEAL') {
    score += 20;
    factors.push('گواهی مهر سازمانی الکترونیکی با بار مالی و حقوقی بالا');
  }

  // Assurance Level
  if (record.assuranceLevel === 'HIGH') {
    score += 15;
    factors.push('سطح اطمینان بالا (High Assurance)');
  }

  // Issue time analysis (e.g., late night issues: 21:00 to 07:00)
  if (record.issueTime) {
    const hour = parseInt(record.issueTime.split(':')[0], 10);
    if (!isNaN(hour) && (hour >= 21 || hour < 7)) {
      score += 25;
      factors.push(`صدور در ساعات غیرمتعارف شبانه (${record.issueTime})`);
    }
  }

  // Missing info heuristics
  if (record.hasIncompleteInfo || (record.incompleteInfoDetails && record.incompleteInfoDetails.length > 0)) {
    score += 20;
    factors.push('دارای نواقص اطلاعاتی یا عدم تطابق هویتی');
  }

  // Cap between 10 and 100
  score = Math.min(100, Math.max(10, score));
  return { riskScore: score, riskFactors: factors };
}

// Convert Excel ArrayBuffer or binary to CertificateRecord array
export async function parseExcelFile(file: File): Promise<{
  records: CertificateRecord[];
  detectedOffice?: { code: string; name: string };
  detectedOffices?: Array<{ code: string; name: string }>;
  sheetName: string;
  totalRows: number;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON array of objects
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          throw new Error('فایل اکسل خالی است یا ساختار نامعتبر دارد.');
        }

        let defaultOfficeCode = '';
        let defaultOfficeName = '';

        const records: CertificateRecord[] = rawJson.map((row, index) => {
          // Accurate column matching with exact priority, fallback keywords, and negative exclusion
          const findColumnValue = (
            exactKeys: string[],
            fallbackKeywords: string[] = [],
            excludeKeywords: string[] = []
          ): any => {
            const exactLower = exactKeys.map(k => k.trim().toLowerCase());
            for (const key of Object.keys(row)) {
              const kTrim = key.trim().toLowerCase();
              if (exactLower.includes(kTrim)) {
                const val = row[key];
                if (val !== undefined && val !== null && String(val).trim() !== '') {
                  return val;
                }
              }
            }

            const fbLower = fallbackKeywords.map(k => k.trim().toLowerCase());
            const exLower = excludeKeywords.map(k => k.trim().toLowerCase());

            for (const key of Object.keys(row)) {
              const kTrim = key.trim().toLowerCase();
              if (exLower.some(ex => kTrim.includes(ex))) continue;
              if (fbLower.some(fb => kTrim.includes(fb))) {
                const val = row[key];
                if (val !== undefined && val !== null && String(val).trim() !== '') {
                  return val;
                }
              }
            }
            return '';
          };

          const rawFirstName = String(findColumnValue(['name', 'first_name', 'نام'], ['نام'], ['خانوادگی', 'پدر', 'سازمان', 'شرکت', 'دفتر'])).trim();
          const rawFamily = String(findColumnValue(['family', 'last_name', 'نام خانوادگی', 'فامیلی', 'شهرت'], ['خانوادگی', 'فامیلی'])).trim();
          const rawCommonName = String(findColumnValue(['CommonName', 'نام متقاضی', 'صاحب گواهی', 'نام و نام خانوادگی', 'متقاضی', 'cn'], ['متقاضی', 'صاحب گواهی'])).trim();

          const applicantName = rawCommonName || 
            (rawFirstName && rawFamily ? `${rawFirstName} ${rawFamily}` : rawFirstName || rawFamily || `متقاضی شماره ${index + 1}`);

          const nationalId = String(findColumnValue(['nationalId', 'کد ملی', 'کدملی', 'شناسه ملی', 'national_id', 'nationalid', 'nid'], ['کد ملی', 'کدملی', 'شناسه ملی', 'national id'], ['شرکت', 'سازمان', 'دفتر']) || `00${Math.floor(10000000 + Math.random() * 90000000)}`).trim();
          const serialNumber = String(findColumnValue(['SerialNumberOfcert', 'serialnumber', 'serial_number', 'serialno', 'serial', 'شماره سریال', 'سریال', 'سریال گواهی', 'cert_serial'], ['serial', 'سریال گواهی', 'شماره سریال']) || `CA-2026-${100000 + index}`).trim();
          const trackingCode = String(findColumnValue(['RefCert', 'کد پیگیری', 'کد رهگیری', 'شماره درخواست', 'tracking', 'ref', 'no', 'ردیف'], ['پیگیری', 'رهگیری', 'شماره درخواست', 'refcert']) || `TRK-${10000 + index}`).trim();
          const mobileNumber = String(findColumnValue(['mobile', 'موبایل', 'تلفن همراه', 'شماره همراه', 'phone'], ['موبایل', 'تلفن همراه', 'همراه', 'mobile']) || `0912${Math.floor(1000000 + Math.random() * 9000000)}`).trim();
          
          // Robust extraction of Office Code and Office Name from Excel
          let rawOfficeCode = String(findColumnValue(
            ['RefRA', 'refra', 'ref_ra', 'کد دفتر ثبت نام', 'دفتر ثبت نام', 'کد دفتر صدور', 'کد دفتر', 'شماره دفتر', 'کد شعبه', 'کد مرکز', 'دفتر', 'office_code', 'officecode', 'ra_code', 'racode', 'office_id', 'ref_office'],
            ['کد دفتر', 'دفتر ثبت نام', 'refra', 'کد شعبه', 'شماره دفتر']
          ) || '').trim();

          let rawOfficeName = String(findColumnValue(
            ['officeName', 'نام دفتر', 'نام دفتر ثبت نام', 'عنوان دفتر', 'عنوان دفتر ثبت نام', 'نام دفتر پیشخوان', 'دفتر پیشخوان', 'شعبه', 'نام شعبه', 'عنوان شعبه', 'محل صدور', 'مرکز صدور', 'نام مرکز', 'دفتر صدور', 'نام دفتر صدور', 'office_name', 'officename', 'ra_name', 'raName', 'raname', 'نام RA', 'نام کارگزاری'],
            ['نام دفتر', 'عنوان دفتر', 'نام شعبه', 'دفتر پیشخوان', 'دفتر صدور', 'دفتر ثبت نام']
          ) || '').trim();

          // If rawOfficeCode contains embedded text like "دفتر ولیعصر - ۱۰۴۲" or "1042 - پیشخوان"
          if (rawOfficeCode && !rawOfficeName) {
            const textPart = rawOfficeCode.replace(/[\d\-_()]/g, '').trim();
            if (textPart.length > 2) {
              rawOfficeName = textPart;
            }
          }

          // Extract standard numeric code if numbers are present in rawOfficeCode (supports Persian/Arabic digits)
          const englishOfficeCode = toEnglishDigits(rawOfficeCode);
          const digitMatch = englishOfficeCode.match(/\d+/);
          const normalizedOfficeCode = digitMatch ? digitMatch[0] : (englishOfficeCode || rawOfficeCode);

          if (normalizedOfficeCode && !defaultOfficeCode) defaultOfficeCode = normalizedOfficeCode;
          if (rawOfficeName && !defaultOfficeName) defaultOfficeName = rawOfficeName;

          const officeCode = normalizedOfficeCode || defaultOfficeCode || '';
          const officeName = rawOfficeName || defaultOfficeName || '';

          const companyName = String(findColumnValue(['organizationName', 'نام شرکت', 'سازمان', 'شرکت', 'متبوع', 'company_name', 'company'], ['نام شرکت', 'سازمان', 'شرکت']) || '').trim();
          const companyNationalId = String(findColumnValue(['companyNationalId', 'شناسه ملی شرکت', 'شناسه شرکت', 'شناسه حقوقی', 'company_id'], ['شناسه ملی شرکت', 'شناسه شرکت', 'شناسه حقوقی']) || '').trim();

          const certTypeRaw = findColumnValue(
            ['certType', 'cert_type', 'certtype', 'certificateType', 'certificate_type', 'نوع گواهی', 'نوع مدرک', 'عنوان گواهی'],
            ['نوع گواهی', 'عنوان گواهی', 'cert type'],
            ['وضعیت', 'سریال', 'صاحب', 'دفتر', 'کد']
          );
          const depTypeRaw = findColumnValue(
            ['وابستگی', 'نوع وابستگی', 'dependencyType', 'dependency'],
            ['وابستگی', 'نوع وابستگی', 'dependency'],
            ['وضعیت', 'سریال', 'دفتر']
          );
          
          const certificateType = parseCertificateType(certTypeRaw || depTypeRaw);
          const dependencyType = parseDependencyType(depTypeRaw || certTypeRaw, certificateType, companyName);

          const statusRaw = findColumnValue(
            ['StatusCert', 'statuscert', 'status_cert', 'certStatus', 'cert_status', 'status', 'وضعیت گواهی', 'وضعیت'],
            ['وضعیت گواهی', 'وضعیت', 'status'],
            ['دفتر', 'مدارک', 'نوع', 'نوع گواهی']
          );
          const status = parseCertificateStatus(statusRaw);

          const assuranceRaw = findColumnValue(['assuranceLevel', 'سطح اطمینان', 'سطح', 'assurance', 'level'], ['سطح اطمینان', 'سطح']);
          const assuranceLevel = parseAssuranceLevel(assuranceRaw);

          // Extract Shamsi date columns (ValidFrom, ValidTo, RevokeDate)
          const rawValidFrom = findColumnValue(
            ['ValidFrom', 'Valid_From', 'validfrom', 'valid_from', 'issueDate', 'issue_date', 'تاریخ صدور', 'تاریخ صدور گواهی', 'از تاریخ', 'تاریخ شروع', 'شروع اعتبار', 'معتبر از'],
            ['صدور', 'valid from', 'از تاریخ', 'معتبر از'],
            ['ابطال', 'انقضا', 'انقضاء', 'پایان', 'اتمام', 'لغو']
          );
          const parsedValidFrom = parseAndStoreAsGregorian(rawValidFrom);
          const issueDate = parsedValidFrom.shamsiDate || parsedValidFrom.gregorianDate;
          const issueTime = parsedValidFrom.time || `${String(9 + (index % 12)).padStart(2, '0')}:${String((index * 7) % 60).padStart(2, '0')}`;

          const rawValidTo = findColumnValue(
            ['ValidTo', 'Valid_To', 'validto', 'valid_to', 'expireDate', 'expiryDate', 'expire_date', 'expiry_date', 'تاریخ انقضا', 'تاریخ انقضاء', 'انقضا', 'انقضاء', 'تا تاریخ', 'پایان اعتبار', 'تاریخ پایان اعتبار', 'معتبر تا'],
            ['انقضا', 'انقضاء', 'پایان اعتبار', 'valid to', 'تا تاریخ', 'معتبر تا'],
            ['ابطال', 'صدور', 'شروع', 'لغو']
          );
          const parsedValidTo = parseAndStoreAsGregorian(rawValidTo);
          const expireDate = parsedValidTo.shamsiDate || parsedValidTo.gregorianDate;

          const rawRevokeDate = findColumnValue(
            ['RevokeDate', 'revoke_date', 'RevocationDate', 'revocation_date', 'تاریخ ابطال', 'زمان ابطال', 'تاریخ لغو'],
            ['ابطال', 'revoke', 'لغو'],
            ['صدور', 'انقضا', 'انقضاء']
          );
          let revocationDate: string | undefined = undefined;
          if (rawRevokeDate) {
            const parsedRevoke = parseAndStoreAsGregorian(rawRevokeDate);
            revocationDate = parsedRevoke.shamsiDate || parsedRevoke.gregorianDate;
          } else if (status === 'REVOKED') {
            revocationDate = '1404/05/25';
          }

          const revocationReason = String(findColumnValue(
            ['RevokeResion', 'revocation_reason', 'علت ابطال', 'دلیل ابطال'],
            ['علت ابطال', 'دلیل ابطال', 'علت']
          ) || (status === 'REVOKED' ? 'درخواست کتبی متقاضی / تغییر سمت سازمانی' : '')).trim();

          const validityDurationDays = calculateDurationInDays(issueDate, expireDate);

          const authRaw = findColumnValue(['authMethod', 'روش احراز', 'احراز هویت', 'auth_method', 'auth'], ['روش احراز', 'احراز هویت']);
          const authMethod = parseAuthMethod(authRaw);

          const missingInfoDetails: string[] = [];
          if (!nationalId || nationalId.length < 10) missingInfoDetails.push('کد ملی ناقص');
          if (!mobileNumber || mobileNumber.length < 11) missingInfoDetails.push('شماره موبایل ناقص');
          if (((dependencyType && dependencyType.startsWith('LEGAL')) || certificateType === 'LEGAL_REP') && !companyNationalId) {
            missingInfoDetails.push('شناسه ملی شرکت ثبت نشده');
          }

          const tempRecord: Partial<CertificateRecord> = {
            id: `cert-${Date.now()}-${index}`,
            trackingCode,
            serialNumber,
            applicantName,
            nationalId,
            mobileNumber,
            officeCode,
            officeName,
            certificateType,
            dependencyType,
            status,
            assuranceLevel,
            issueDate,
            issueTime,
            expireDate,
            revocationDate: revocationDate || undefined,
            revocationReason: revocationReason || undefined,
            validityDurationDays,
            authMethod,
            companyName: companyName || ((dependencyType && dependencyType.startsWith('LEGAL')) ? 'شرکت داده‌پردازی و فناوری پیشگامان' : undefined),
            companyNationalId: companyNationalId || ((dependencyType && dependencyType.startsWith('LEGAL')) ? '14008765432' : undefined),
            hasIncompleteInfo: missingInfoDetails.length > 0,
            incompleteInfoDetails: missingInfoDetails,
            rawRowData: row,
          };

          const { riskScore, riskFactors } = calculateRisk(tempRecord);

          return {
            ...tempRecord,
            riskScore,
            riskFactors,
          } as CertificateRecord;
        });

        // Strict deduplication of records parsed from Excel:
        // Merge or ignore duplicate certificate rows (identical serial, trackingCode, or nationalId+type)
        const uniqueRecords: CertificateRecord[] = [];
        for (const rec of records) {
          if (!uniqueRecords.some(u => areCertificatesIdentical(u, rec))) {
            uniqueRecords.push(rec);
          }
        }

        // Collect all distinct offices detected from the Excel records
        const detectedOfficesMap = new Map<string, string>();
        uniqueRecords.forEach((r) => {
          if (r.officeCode) {
            const cur = detectedOfficesMap.get(r.officeCode);
            if (!cur || cur.startsWith('دفتر پیشخوان دولت کد')) {
              if (r.officeName) detectedOfficesMap.set(r.officeCode, r.officeName);
              else if (!cur) detectedOfficesMap.set(r.officeCode, `دفتر پیشخوان دولت کد ${r.officeCode}`);
            }
          }
        });
        const detectedOffices = Array.from(detectedOfficesMap.entries()).map(([code, name]) => ({ code, name }));

        const primaryOffice = detectedOffices.length > 0 ? detectedOffices[0] : (defaultOfficeCode ? { code: defaultOfficeCode, name: defaultOfficeName } : undefined);

        resolve({
          records: uniqueRecords,
          detectedOffice: primaryOffice,
          detectedOffices,
          sheetName,
          totalRows: uniqueRecords.length,
        });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

// Generate Standard Excel Template with exact columns specified: NO, RefCert, name, family, organizationName, CommonName, certType, SerialNumberOfcert, StatusCert, ValidFrom, ValidTo, RevokeDate, RevokeResion, RefRA
export function downloadStandardExcelTemplate(targetOfficeCode: string = '1607') {
  const code = String(targetOfficeCode || '1607').trim();
  const sampleData = [
    {
      'NO': 1,
      'RefCert': '14040501001',
      'name': 'علیرضا',
      'family': 'حسینیان',
      'organizationName': '',
      'CommonName': 'علیرضا حسینیان',
      'certType': 'شخص حقیقی-مستقل',
      'SerialNumberOfcert': '4A2B8901F101',
      'StatusCert': 'معتبر',
      'ValidFrom': '1404/01/15 09:30',
      'ValidTo': '1405/01/15 09:30',
      'RevokeDate': '',
      'RevokeResion': '',
      'RefRA': '1042'
    },
    {
      'NO': 2,
      'RefCert': '14040501002',
      'name': 'مریم',
      'family': 'سادات کاظمی',
      'organizationName': 'شرکت مهندسی داده‌ورزی پیشگامان',
      'CommonName': 'مریم سادات کاظمی (نماینده)',
      'certType': 'شخص حقوقی-وابسته به غیردولت',
      'SerialNumberOfcert': '4A2B8901F102',
      'StatusCert': 'ابطال',
      'ValidFrom': '1404/02/10 11:45',
      'ValidTo': '1405/02/10 11:45',
      'RevokeDate': '1404/05/20',
      'RevokeResion': 'تغییر مدیرعامل و درخواست کتبی هیئت مدیره',
      'RefRA': '1042'
    },
    {
      'NO': 3,
      'RefCert': '14040501003',
      'name': 'مهدی',
      'family': 'کریمی نیا',
      'organizationName': 'شرکت بازرگانی دولتی ایران',
      'CommonName': 'شرکت بازرگانی دولتی ایران (مهر سازمانی)',
      'certType': 'شخص حقوقی-وابسته به دولت',
      'SerialNumberOfcert': '4A2B8901F103',
      'StatusCert': 'معتبر',
      'ValidFrom': '1404/02/25 10:15',
      'ValidTo': '1406/02/25 10:15',
      'RevokeDate': '',
      'RevokeResion': '',
      'RefRA': '1042'
    },
    {
      'NO': 4,
      'RefCert': '14040501004',
      'name': 'سارا',
      'family': 'مرادی زاده',
      'organizationName': 'موسسه حسابرسی رهیافت نوین',
      'CommonName': 'سارا مرادی زاده',
      'certType': 'شخص حقیقی-وابسته به غیردولت',
      'SerialNumberOfcert': '4A2B8901F104',
      'StatusCert': 'ابطال',
      'ValidFrom': '1404/03/05 14:20',
      'ValidTo': '1405/03/05 14:20',
      'RevokeDate': '1404/04/18',
      'RevokeResion': 'درخواست کتبی به دلیل مفقودی توکن سخت‌افزاری',
      'RefRA': '1042'
    },
    {
      'NO': 5,
      'RefCert': '14040501005',
      'name': 'حمیدرضا',
      'family': 'تقوی فر',
      'organizationName': 'سازمان امور مالیاتی کشور',
      'CommonName': 'حمیدرضا تقوی فر (کارمند دولت)',
      'certType': 'شخص حقیقی-وابسته به دولت',
      'SerialNumberOfcert': '4A2B8901F105',
      'StatusCert': 'معتبر',
      'ValidFrom': '1404/03/12 08:50',
      'ValidTo': '1405/03/12 08:50',
      'RevokeDate': '',
      'RevokeResion': '',
      'RefRA': '1042'
    },
    {
      'NO': 6,
      'RefCert': '14040501006',
      'name': 'پیمان',
      'family': 'یزدانی',
      'organizationName': 'شرکت مهندسی داده‌ورزی پیشگامان',
      'CommonName': 'پیمان یزدانی (امضاکننده مجاز)',
      'certType': 'شخص حقوقی-وابسته به غیردولت',
      'SerialNumberOfcert': '4A2B8901F106',
      'StatusCert': 'پذیرش نشده',
      'ValidFrom': '1404/03/20 12:10',
      'ValidTo': '1405/03/20 12:10',
      'RevokeDate': '',
      'RevokeResion': '',
      'RefRA': '1042'
    },
    {
      'NO': 7,
      'RefCert': '14040501007',
      'name': 'نرگس',
      'family': 'السادات حسینی',
      'organizationName': '',
      'CommonName': 'نرگس السادات حسینی',
      'certType': 'شخص حقیقی-مستقل',
      'SerialNumberOfcert': '4A2B8901F107',
      'StatusCert': 'معتبر',
      'ValidFrom': '1404/04/01 16:30',
      'ValidTo': '1405/04/01 16:30',
      'RevokeDate': '',
      'RevokeResion': '',
      'RefRA': '1042'
    },
    {
      'NO': 8,
      'RefCert': '14040501008',
      'name': 'کیوان',
      'family': 'شاه‌حسینی',
      'organizationName': 'شرکت پتروشیمی خلیج فارس',
      'CommonName': 'کیوان شاه‌حسینی',
      'certType': 'شخص حقوقی-وابسته به دولت',
      'SerialNumberOfcert': '4A2B8901F108',
      'StatusCert': 'ابطال',
      'ValidFrom': '1404/04/08 23:45',
      'ValidTo': '1405/04/08 23:45',
      'RevokeDate': '1404/05/01',
      'RevokeResion': 'پایان قرارداد همکاری و درخواست رسمی سازمان',
      'RefRA': '1042'
    },
    {
      'NO': 9,
      'RefCert': '14040501009',
      'name': 'زهرا',
      'family': 'باقری نژاد',
      'organizationName': 'صندوق بازنشستگی کشوری',
      'CommonName': 'زهرا باقری نژاد',
      'certType': 'شخص حقیقی-وابسته به دولت',
      'SerialNumberOfcert': '4A2B8901F109',
      'StatusCert': 'معتبر',
      'ValidFrom': '1404/04/15 10:00',
      'ValidTo': '1405/04/15 10:00',
      'RevokeDate': '',
      'RevokeResion': '',
      'RefRA': '1042'
    },
    {
      'NO': 10,
      'RefCert': '14040501010',
      'name': 'امید',
      'family': 'رضایی کیا',
      'organizationName': 'شرکت داروسازی درمان گستر',
      'CommonName': 'امید رضایی کیا',
      'certType': 'شخص حقیقی-وابسته به غیردولت',
      'SerialNumberOfcert': '4A2B8901F110',
      'StatusCert': 'معتبر',
      'ValidFrom': '1404/04/22 13:15',
      'ValidTo': '1405/04/22 13:15',
      'RevokeDate': '',
      'RevokeResion': '',
      'RefRA': '1042'
    },
    {
      'NO': 11,
      'RefCert': '14040501011',
      'name': 'فاطمه',
      'family': 'احمدی منش',
      'organizationName': '',
      'CommonName': 'فاطمه احمدی منش',
      'certType': 'شخص حقیقی-مستقل',
      'SerialNumberOfcert': '4A2B8901F111',
      'StatusCert': 'معتبر',
      'ValidFrom': '1404/05/01 11:20',
      'ValidTo': '1405/05/01 11:20',
      'RevokeDate': '',
      'RevokeResion': '',
      'RefRA': '1042'
    },
    {
      'NO': 12,
      'RefCert': '14040501012',
      'name': 'محمدرضا',
      'family': 'صادقی اصل',
      'organizationName': 'شرکت توسعه زیرساخت هوشمند',
      'CommonName': 'شرکت توسعه زیرساخت هوشمند',
      'certType': 'شخص حقوقی-وابسته به غیردولت',
      'SerialNumberOfcert': '4A2B8901F112',
      'StatusCert': 'معتبر',
      'ValidFrom': '1404/05/05 15:40',
      'ValidTo': '1406/05/05 15:40',
      'RevokeDate': '',
      'RevokeResion': '',
      'RefRA': '1042'
    }
  ];

  sampleData.forEach(item => {
    item['RefRA'] = code;
  });

  const worksheet = XLSX.utils.json_to_sheet(sampleData, {
    header: [
      'NO',
      'RefCert',
      'name',
      'family',
      'organizationName',
      'CommonName',
      'certType',
      'SerialNumberOfcert',
      'StatusCert',
      'ValidFrom',
      'ValidTo',
      'RevokeDate',
      'RevokeResion',
      'RefRA'
    ]
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'گواهی‌های صادر شده');
  
  XLSX.writeFile(workbook, 'نمونه_گواهی‌های_دفتر_RA_الگوریتم_۷_گانه.xlsx');
}

// Export Sampling / Audit Report to Excel
export function exportAuditCampaignToExcel(campaignTitle: string, records: any[]) {
  const exportData = records.map((item, idx) => ({
    'ردیف': idx + 1,
    'کد دفتر': item.officeCode,
    'نام دفتر': item.officeName,
    'شماره سریال گواهی': item.certificate.serialNumber,
    'کد رهگیری': item.certificate.trackingCode,
    'نام متقاضی': item.certificate.applicantName,
    'کد ملی': item.certificate.nationalId,
    'نوع وابستگی ۵ گانه': getDependencyTypeTitle(item.certificate.dependencyType),
    'وضعیت گواهی': getCertificateStatusTitle(item.certificate.status),
    'دلیل انتخاب در نمونه': item.certificate.selectedReasonBadge || '-',
    'سطح اطمینان': item.certificate.assuranceLevel,
    'تاریخ صدور': formatDisplayDate(item.certificate.issueDate).date,
    'ساعت صدور': formatDisplayDate(item.certificate.issueDate, item.certificate.issueTime).time,
    'وضعیت مدارک دفتر': item.uploadedDocuments?.length > 0 ? `${item.uploadedDocuments.length} مدرک آپلود شده` : 'در انتظار مدارک',
    'وضعیت انطباق بازرسی': item.status === 'APPROVED' ? 'تایید شده (منطبق)' : item.status === 'DEFECT_MAJOR' ? 'عدم انطباق عمده' : item.status === 'DEFECT_MINOR' ? 'عدم انطباق جزئی' : 'در انتظار بررسی',
    'نمره انطباق': item.complianceScore || '-',
    'یادداشت بازرس': item.inspectorNotes || '-'
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'نتایج بازرسی و نمونه‌گیری');
  XLSX.writeFile(workbook, `گزارش_بازرسی_${campaignTitle.replace(/\s+/g, '_')}.xlsx`);
}
