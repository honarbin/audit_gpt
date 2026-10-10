import * as XLSX from 'xlsx';
import { OfficeProfile, OfficeManager, OfficeBatchImportSummary, OfficeStatus } from '../types';
import { IRAN_PROVINCES } from '../data/iranGeoData';

// Standard headers for Office & Manager Import / Export
export const OFFICE_EXCEL_COLUMNS = [
  { key: 'officeCode', label: 'کد دفتر ثبت نام (یکتا)', required: true },
  { key: 'officeName', label: 'نام دفتر ثبت نام', required: true },
  { key: 'username', label: 'نام کاربری ورود (Username)', required: false },
  { key: 'officeType', label: 'نوع دفتر ثبت نام', required: true },
  { key: 'province', label: 'استان', required: true },
  { key: 'city', label: 'شهرستان', required: true },
  { key: 'address', label: 'آدرس پستی دقیق', required: true },
  { key: 'officePhone', label: 'تلفن ثابت دفتر', required: true },
  { key: 'officeEmail', label: 'آدرس ایمیل', required: false },
  { key: 'latitude', label: 'عرض جغرافیایی (Latitude)', required: false },
  { key: 'longitude', label: 'طول جغرافیایی (Longitude)', required: false },
  { key: 'managerCode', label: 'کد یکتای مسئول', required: false },
  { key: 'managerNationalId', label: 'کد ملی مسئول', required: true },
  { key: 'managerName', label: 'نام و نام خانوادگی مسئول', required: true },
  { key: 'managerMobile', label: 'شماره موبایل مسئول', required: true },
  { key: 'managerPhone', label: 'تلفن ثابت مسئول', required: true },
  { key: 'managerEmail', label: 'ایمیل مسئول', required: false },
  { key: 'status', label: 'وضعیت فعالیت (فعال/تعلیق/ابطال شده/غیرفعال)', required: false },
];

/**
 * Downloads standard Excel template for registering offices and managers in bulk (up to 1000+ records)
 */
export function downloadOfficeManagersExcelTemplate() {
  const sampleRows = [
    {
      'کد دفتر ثبت نام (یکتا)': '1042',
      'نام دفتر ثبت نام': 'دفتر پیشخوان دولت کد ۱۰۴۲ (تهران - میرداماد)',
      'نام کاربری ورود (Username)': 'office1042',
      'نوع دفتر ثبت نام': 'دفتر پیشخوان دولت',
      'استان': 'تهران',
      'شهرستان': 'تهران',
      'آدرس پستی دقیق': 'تهران، بلوار میرداماد، جنب پمپ بنزین، ساختمان برج آرین، طبقه اول، واحد ۳',
      'تلفن ثابت دفتر': '021-88765432',
      'آدرس ایمیل': 'info@pishkhan1042.ir',
      'عرض جغرافیایی (Latitude)': 35.7593,
      'طول جغرافیایی (Longitude)': 51.4285,
      'کد یکتای مسئول': 'MGR-1042',
      'کد ملی مسئول': '0078451234',
      'نام و نام خانوادگی مسئول': 'مهندس محمدرضا ابراهیمی',
      'شماره موبایل مسئول': '09121112233',
      'تلفن ثابت مسئول': '021-88765432',
      'ایمیل مسئول': 'm.ebrahimi@pishkhan1042.ir',
      'وضعیت فعالیت (فعال/تعلیق/ابطال شده/غیرفعال)': 'فعال',
    },
    {
      'کد دفتر ثبت نام (یکتا)': '45',
      'نام دفتر ثبت نام': 'دفتر اسناد رسمی شماره ۴۵ (اصفهان - چهارباغ)',
      'نام کاربری ورود (Username)': 'notary45_isf',
      'نوع دفتر ثبت نام': 'دفتر اسناد رسمی',
      'استان': 'اصفهان',
      'شهرستان': 'اصفهان',
      'آدرس پستی دقیق': 'اصفهان، خیابان چهارباغ عباسی، نرسیده به میدان انقلاب، پلاک ۲۱۴',
      'تلفن ثابت دفتر': '031-32233445',
      'آدرس ایمیل': 'notary45.isf@gmail.com',
      'عرض جغرافیایی (Latitude)': 32.6575,
      'طول جغرافیایی (Longitude)': 51.6702,
      'کد یکتای مسئول': 'MGR-45',
      'کد ملی مسئول': '1284567890',
      'نام و نام خانوادگی مسئول': 'دکتر علیرضا سلطانی',
      'شماره موبایل مسئول': '09132223344',
      'تلفن ثابت مسئول': '031-32233445',
      'ایمیل مسئول': 'soltani.notary45@gmail.com',
      'وضعیت فعالیت (فعال/تعلیق/ابطال شده/غیرفعال)': 'فعال',
    },
    {
      'کد دفتر ثبت نام (یکتا)': '512',
      'نام دفتر ثبت نام': 'مرکز آموزش دانشگاه شیراز کد ۵۱۲',
      'نام کاربری ورود (Username)': 'shirazu_ra',
      'نوع دفتر ثبت نام': 'مرکز آموزش',
      'استان': 'فارس',
      'شهرستان': 'شیراز',
      'آدرس پستی دقیق': 'شیراز، میدان ارم، پردیس دانشگاه شیراز، ساختمان فناوری اطلاعات',
      'تلفن ثابت دفتر': '071-36284455',
      'آدرس ایمیل': 'ra-center@shirazu.ac.ir',
      'عرض جغرافیایی (Latitude)': 29.6385,
      'طول جغرافیایی (Longitude)': 52.5180,
      'کد یکتای مسئول': 'MGR-512',
      'کد ملی مسئول': '2298765432',
      'نام و نام خانوادگی مسئول': 'مهندس سعید میرزایی',
      'شماره موبایل مسئول': '09175556677',
      'تلفن ثابت مسئول': '071-36284455',
      'ایمیل مسئول': 's.mirzaei@shirazu.ac.ir',
      'وضعیت فعالیت (فعال/تعلیق/ابطال شده/غیرفعال)': 'فعال',
    },
    {
      'کد دفتر ثبت نام (یکتا)': '208',
      'نام دفتر ثبت نام': 'سازمان ثبت اسناد و املاک کد ۲۰۸ (مشهد)',
      'نام کاربری ورود (Username)': 'adliran208',
      'نوع دفتر ثبت نام': 'سازمان/شرکت',
      'استان': 'خراسان رضوی',
      'شهرستان': 'مشهد',
      'آدرس پستی دقیق': 'مشهد، بلوار احمدآباد، نبش خیابان پاستور، مجتمع اداری ثامن',
      'تلفن ثابت دفتر': '051-38451120',
      'آدرس ایمیل': 'ghazaei208.mashhad@adliran.ir',
      'عرض جغرافیایی (Latitude)': 36.2985,
      'طول جغرافیایی (Longitude)': 59.5750,
      'کد یکتای مسئول': 'MGR-208',
      'کد ملی مسئول': '0935678123',
      'نام و نام خانوادگی مسئول': 'حاج احمد رضایی',
      'شماره موبایل مسئول': '09153334455',
      'تلفن ثابت مسئول': '051-38451120',
      'ایمیل مسئول': 'rezaei.adlieh208@gmail.com',
      'وضعیت فعالیت (فعال/تعلیق/ابطال شده/غیرفعال)': 'تعلیق',
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleRows);
  
  // Set column widths
  worksheet['!cols'] = [
    { wch: 16 }, // کد دفتر
    { wch: 38 }, // نام دفتر
    { wch: 22 }, // نام کاربری ورود
    { wch: 22 }, // نوع دفتر
    { wch: 14 }, // استان
    { wch: 14 }, // شهرستان
    { wch: 45 }, // آدرس
    { wch: 16 }, // تلفن دفتر
    { wch: 24 }, // ایمیل دفتر
    { wch: 16 }, // عرض
    { wch: 16 }, // طول
    { wch: 16 }, // کد یکتای مسئول
    { wch: 14 }, // کد ملی
    { wch: 26 }, // نام مسئول
    { wch: 16 }, // موبایل
    { wch: 16 }, // تلفن ثابت مسئول
    { wch: 24 }, // ایمیل مسئول
    { wch: 16 }, // وضعیت
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'قالب دفاتر و مسئولین');

  // Also append a Reference Guide Sheet
  const guideRows = [
    { 'نام راهنما': 'نام کاربری ورود (Username)', 'مقادیر پیشنهادی': 'نام کاربری ورود به سامانه جهت دفتر و مسئول (اختیاری؛ در صورت خالی بودن، به صورت خودکار office{کددفتر} تخصیص می‌یابد).' },
    { 'نام راهنما': 'انواع مجاز دفاتر', 'مقادیر پیشنهادی': 'دفتر پیشخوان دولت، دفتر اسناد رسمی، مرکز آموزش، سازمان/شرکت، سایر (قابل تعریف)' },
    { 'نام راهنما': 'وضعیت‌های مجاز دفتر', 'مقادیر پیشنهادی': 'فعال، تعلیق، ابطال شده، غیرفعال' },
    { 'نام راهنما': 'استان‌ها', 'مقادیر پیشنهادی': IRAN_PROVINCES.map(p => p.name).join('، ') },
    { 'نام راهنما': 'کد یکتا', 'مقادیر پیشنهادی': 'کد دفتر و کد مسئول باید در سامانه یکتا و غیرتکراری باشند. در صورت خالی بودن کد مسئول، سیستم به طور خودکار MGR-{کددفتر} تخصیص می‌دهد.' },
    { 'نام راهنما': 'شماره تماس', 'مقادیر پیشنهادی': 'حتما پیش‌شماره استان برای شماره‌های ثابت و فرمت معتبر ۱۱ رقمی برای موبایل درج گردد.' }
  ];
  const guideSheet = XLSX.utils.json_to_sheet(guideRows);
  guideSheet['!cols'] = [{ wch: 24 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(workbook, guideSheet, 'راهنمای فیلدها');

  XLSX.writeFile(workbook, 'قالب_استاندارد_ثبت_دفاتر_و_مسئولین_RA.xlsx');
}

/**
 * Normalizes office type string to standard code
 */
export function normalizeOfficeTypeCode(rawType?: string): string {
  if (!rawType) return 'PRESHKHAN';
  const clean = rawType.trim();
  if (clean.includes('پیشخوان')) return 'PRESHKHAN';
  if (clean.includes('اسناد') || clean.includes('سردفتر')) return 'NOTARY';
  if (clean.includes('آموزش') || clean.includes('دانشگاه') || clean.includes('پژوهش') || clean.includes('مدرسه')) return 'EDUCATION';
  if (clean.includes('سازمان') || clean.includes('شرکت') || clean.includes('بانک') || clean.includes('قضایی') || clean.includes('پلیس')) return 'ORGANIZATION';
  return 'OTHER';
}

/**
 * Normalizes office status string to standard code
 */
export function normalizeOfficeStatus(rawStatus?: string): OfficeStatus {
  if (!rawStatus) return 'ACTIVE';
  const clean = rawStatus.trim().toLowerCase();
  if (clean.includes('ابطال') || clean.includes('لغو') || clean.includes('revoked')) return 'REVOKED';
  if (clean.includes('تعلیق') || clean.includes('معلق') || clean.includes('suspended')) return 'SUSPENDED';
  if (clean.includes('غیرفعال') || clean.includes('inactive')) return 'INACTIVE';
  return 'ACTIVE';
}

/**
 * Parses an uploaded Excel file containing offices and managers
 */
export async function parseOfficesAndManagersFromExcel(
  file: File,
  existingOffices: OfficeProfile[] = []
): Promise<OfficeBatchImportSummary> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet);

        if (!rawJson || rawJson.length === 0) {
          throw new Error('فایل اکسل انتخاب شده فاقد داده یا ردیف معتبر می‌باشد.');
        }

        const existingOfficeCodes = new Set(existingOffices.map(o => String(o.code).trim()));
        const parsedOffices: OfficeProfile[] = [];
        const parsedManagers: OfficeManager[] = [];
        const errors: { row: number; officeCode?: string; field?: string; message: string }[] = [];
        let updatedCount = 0;
        let successCount = 0;

        rawJson.forEach((row, index) => {
          const rowNum = index + 2; // Excel row (1-indexed + header)

          // Helper to find value by various Persian/English header variations
          const getVal = (...keys: string[]): string => {
            for (const k of keys) {
              for (const rowKey of Object.keys(row)) {
                if (rowKey.trim().toLowerCase() === k.trim().toLowerCase() ||
                    rowKey.trim().replace(/\s+/g, '').includes(k.replace(/\s+/g, ''))) {
                  const val = row[rowKey];
                  return val !== undefined && val !== null ? String(val).trim() : '';
                }
              }
            }
            return '';
          };

          const rawCode = getVal('کد دفتر ثبت نام (یکتا)', 'کد دفتر', 'officeCode', 'کد', 'شناسه دفتر');
          const name = getVal('نام دفتر ثبت نام', 'نام دفتر', 'officeName', 'عنوان دفتر', 'نام');
          const rawUsername = getVal('نام کاربری ورود (Username)', 'نام کاربری', 'نام کاربری ورود', 'username', 'شناسه کاربری', 'نام کاربری دفتر');
          const typeStr = getVal('نوع دفتر ثبت نام', 'نوع دفتر', 'officeType', 'نوع');
          const province = getVal('استان', 'province');
          const city = getVal('شهرستان', 'شهر', 'city', 'county');
          const address = getVal('آدرس پستی دقیق', 'آدرس', 'نشانی', 'address');
          const officePhone = getVal('تلفن ثابت دفتر', 'تلفن دفتر', 'شماره تلفن دفتر', 'officePhone', 'تلفن ثابت');
          const officeEmail = getVal('آدرس ایمیل', 'ایمیل دفتر', 'ایمیل', 'officeEmail', 'email');

          const rawLat = getVal('عرض جغرافیایی (Latitude)', 'عرض جغرافیایی', 'latitude', 'lat');
          const rawLng = getVal('طول جغرافیایی (Longitude)', 'طول جغرافیایی', 'longitude', 'lng', 'lon');

          const rawManagerCode = getVal('کد یکتای مسئول', 'کد مسئول', 'شناسه مسئول', 'managerCode', 'managerId');
          const managerNationalId = getVal('کد ملی مسئول', 'کد ملی', 'nationalId', 'کدملی');
          const managerName = getVal('نام و نام خانوادگی مسئول', 'نام مسئول', 'مدیر دفتر', 'مسئول دفتر', 'managerName');
          const managerMobile = getVal('شماره موبایل مسئول', 'موبایل مسئول', 'تلفن همراه مسئول', 'managerMobile', 'موبایل');
          const managerPhone = getVal('تلفن ثابت مسئول', 'تلفن مسئول', 'شماره ثابت مسئول', 'managerPhone');
          const managerEmail = getVal('ایمیل مسئول', 'آدرس ایمیل مسئول', 'managerEmail');
          const statusStr = getVal('وضعیت فعالیت (فعال/تعلیق/ابطال شده/غیرفعال)', 'وضعیت فعالیت', 'وضعیت', 'status');

          // Validation
          if (!rawCode) {
            errors.push({ row: rowNum, field: 'کد دفتر', message: 'کد یکتای دفتر ثبت نام وارد نشده است.' });
            return;
          }
          if (!name) {
            errors.push({ row: rowNum, officeCode: rawCode, field: 'نام دفتر', message: 'نام دفتر ثبت نام وارد نشده است.' });
            return;
          }
          if (!province) {
            errors.push({ row: rowNum, officeCode: rawCode, field: 'استان', message: 'استان دفتر مشخص نشده است.' });
            return;
          }

          const officeCode = rawCode.trim();
          const managerCode = rawManagerCode || `MGR-${officeCode}`;
          const managerId = `MGR-${officeCode}`;
          const officeId = `off-${officeCode}`;
          const assignedUsername = rawUsername ? rawUsername.trim() : `office${officeCode}`;

          // Resolve Coordinates if not provided or valid
          let lat = rawLat ? parseFloat(rawLat) : undefined;
          let lng = rawLng ? parseFloat(rawLng) : undefined;

          if (!lat || isNaN(lat) || !lng || isNaN(lng)) {
            // Find default province center
            const matchedProv = IRAN_PROVINCES.find(p => p.name === province || province.includes(p.name));
            if (matchedProv) {
              lat = matchedProv.centerLat + (Math.random() - 0.5) * 0.05;
              lng = matchedProv.centerLng + (Math.random() - 0.5) * 0.05;
            } else {
              lat = 35.6892;
              lng = 51.3890;
            }
          }

          const officeType = normalizeOfficeTypeCode(typeStr);
          const officeStatus = normalizeOfficeStatus(statusStr);
          const isManagerActive = officeStatus === 'ACTIVE' || officeStatus === 'SUSPENDED';

          // Construct Manager Object
          const manager: OfficeManager = {
            id: managerId,
            managerCode: managerCode,
            username: assignedUsername,
            nationalId: managerNationalId || '0000000000',
            fullName: managerName || 'مسئول مشخص نشده',
            mobilePhone: managerMobile || '09120000000',
            landlinePhone: managerPhone || officePhone || '02100000000',
            email: managerEmail || officeEmail,
            assignedOfficeCode: officeCode,
            assignedOfficeName: name,
            appointmentDate: '1403/01/01',
            status: isManagerActive ? 'ACTIVE' : 'INACTIVE',
            notes: `ثبت شده از طریق فایل اکسل دسته‌جمعی در سطر ${rowNum}`
          };

          // Construct Office Object
          const office: OfficeProfile = {
            id: officeId,
            code: officeCode,
            name: name,
            type: officeType,
            customTypeName: officeType === 'OTHER' ? (typeStr || 'سایر') : undefined,
            province: province,
            city: city || province,
            address: address || `${province}، ${city || province}، نشانی در پرونده موجود است`,
            phone: officePhone || '۰۲۱-۰۰۰۰۰۰۰۰',
            email: officeEmail || undefined,
            latitude: lat,
            longitude: lng,
            managerId: managerId,
            managerName: manager.fullName,
            activeCampaignsCount: 0,
            status: officeStatus,
            createdAt: '1403/01/01',
            notes: `بارگذاری شده از فایل اکسل دسته‌جمعی (ردیف ${rowNum})`
          };

          if (existingOfficeCodes.has(officeCode)) {
            updatedCount++;
          } else {
            successCount++;
          }

          parsedOffices.push(office);
          parsedManagers.push(manager);
        });

        resolve({
          totalRows: rawJson.length,
          successCount,
          updatedCount,
          errorCount: errors.length,
          errors,
          importedOffices: parsedOffices,
          importedManagers: parsedManagers,
        });
      } catch (err: any) {
        reject(new Error(`خطا در پردازش فایل اکسل: ${err.message || 'فرمت فایل نامعتبر است'}`));
      }
    };

    reader.onerror = () => reject(new Error('خطا در خواندن فایل اکسل'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Exports all offices & managers to a comprehensive Excel workbook
 */
export function exportOfficesAndManagersToExcel(
  offices: OfficeProfile[],
  managers: OfficeManager[]
) {
  const managerMap = new Map<string, OfficeManager>();
  managers.forEach(m => {
    managerMap.set(m.assignedOfficeCode, m);
    if (m.id) managerMap.set(m.id, m);
  });

  const exportRows = offices.map((office, idx) => {
    const mgr = managerMap.get(office.code) || (office.managerId ? managerMap.get(office.managerId) : undefined);

    let statusText = 'فعال';
    if (office.status === 'SUSPENDED') statusText = 'تعلیق';
    else if (office.status === 'REVOKED') statusText = 'ابطال شده';
    else if (office.status === 'INACTIVE') statusText = 'غیرفعال';

    return {
      'ردیف': idx + 1,
      'کد دفتر ثبت نام': office.code,
      'نام دفتر ثبت نام': office.name,
      'نام کاربری ورود': mgr?.username || `office${office.code}`,
      'نوع دفتر': office.type === 'PRESHKHAN' ? 'پیشخوان دولت' :
                  office.type === 'NOTARY' ? 'اسناد رسمی' :
                  office.type === 'EDUCATION' ? 'مرکز آموزش' :
                  office.type === 'ORGANIZATION' ? 'سازمان/شرکت' :
                  (office.customTypeName || 'سایر'),
      'استان': office.province,
      'شهرستان': office.city,
      'آدرس پستی': office.address,
      'تلفن ثابت دفتر': office.phone,
      'آدرس ایمیل': office.email || '-',
      'عرض جغرافیایی (Lat)': office.latitude || '-',
      'طول جغرافیایی (Lng)': office.longitude || '-',
      'کد یکتای مسئول': mgr?.managerCode || office.managerId || '-',
      'کد ملی مسئول': mgr?.nationalId || '-',
      'نام و نام خانوادگی مسئول': mgr?.fullName || office.managerName || '-',
      'شماره همراه مسئول': mgr?.mobilePhone || '-',
      'تلفن ثابت مسئول': mgr?.landlinePhone || office.phone || '-',
      'ایمیل مسئول': mgr?.email || office.email || '-',
      'وضعیت فعالیت': statusText
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  worksheet['!cols'] = [
    { wch: 8 },  // ردیف
    { wch: 16 }, // کد دفتر
    { wch: 40 }, // نام دفتر
    { wch: 22 }, // نام کاربری
    { wch: 22 }, // نوع
    { wch: 14 }, // استان
    { wch: 14 }, // شهر
    { wch: 45 }, // آدرس
    { wch: 16 }, // تلفن دفتر
    { wch: 24 }, // ایمیل دفتر
    { wch: 16 }, // lat
    { wch: 16 }, // lng
    { wch: 16 }, // کد مسئول
    { wch: 16 }, // کدملی
    { wch: 26 }, // نام مسئول
    { wch: 16 }, // موبایل
    { wch: 16 }, // تلفن مسئول
    { wch: 24 }, // ایمیل مسئول
    { wch: 16 }, // وضعیت
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'دفاتر و مسئولین صدور گواهی');

  XLSX.writeFile(workbook, `گزارش_جامع_دفاتر_و_مسئولین_RA_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

