import { 
  CertificateRecord, 
  SamplingAlgorithmConfig, 
  DocumentType, 
  DependencyType, 
  CertificateStatus, 
  PriorityRuleType, 
  QualityChecklistResult,
  AuditInspectionRecord,
  UploadedDocument,
  CaseNoteEntry
} from '../types';

export interface SamplingResult {
  selectedRecords: CertificateRecord[];
  totalAvailable: number;
  sampleCount: number;
  targetCount: number;
  samplePercentage: number;
  checklist: QualityChecklistResult;
  algorithmSummary: {
    individualIndependentCount: number;
    legalNonGovCount: number;
    individualNonGovCount: number;
    legalGovCount: number;
    individualGovCount: number;
    revokedCount: number;
    incompleteInfoCount: number;
    multiCertCount: number;
    highRiskCount: number;
    averageRiskScore: number;
  };
}

export const ALL_DEPENDENCY_TYPES: DependencyType[] = [
  'INDIVIDUAL_INDEPENDENT',
  'LEGAL_NON_GOV',
  'INDIVIDUAL_NON_GOV',
  'LEGAL_GOV',
  'INDIVIDUAL_GOV'
];

export const DEFAULT_PRIORITY_ORDER: PriorityRuleType[] = [
  'REVOKED',
  'INCOMPLETE_INFO',
  'SHORT_VALIDITY',
  'MULTI_CERT_APPLICANTS',
  'OLDEST',
  'NEWEST',
  'ANOMALIES'
];

export function getDependencyTypeTitle(type: DependencyType): string {
  switch (type) {
    case 'INDIVIDUAL_INDEPENDENT':
      return 'شخص حقیقی-مستقل';
    case 'LEGAL_NON_GOV':
      return 'شخص حقوقی-وابسته به غیردولت';
    case 'INDIVIDUAL_NON_GOV':
      return 'شخص حقیقی-وابسته به غیردولت';
    case 'LEGAL_GOV':
      return 'شخص حقوقی-وابسته به دولت';
    case 'INDIVIDUAL_GOV':
      return 'شخص حقیقی-وابسته به دولت';
    default:
      return 'نامشخص';
  }
}

export function getCertificateStatusTitle(status: CertificateStatus): string {
  switch (status) {
    case 'VALID':
      return 'معتبر';
    case 'REVOKED':
      return 'ابطال';
    case 'NOT_ACCEPTED':
      return 'پذیرش نشده';
    case 'EXPIRED':
      return 'منقضی';
    case 'SUSPENDED':
      return 'معلق';
    default:
      return 'نامشخص';
  }
}

export function getPriorityRuleTitle(rule: PriorityRuleType): string {
  switch (rule) {
    case 'REVOKED':
      return '۱. گواهی‌های ابطال‌شده';
    case 'INCOMPLETE_INFO':
      return '۲. گواهی‌هایی با اطلاعات ناقص';
    case 'SHORT_VALIDITY':
      return '۳. گواهی‌های دارای اعتبار کوتاه یا ابطال در مدت کوتاه';
    case 'MULTI_CERT_APPLICANTS':
      return '۴. گواهی‌های اشخاص یا سازمان‌های دارای چند گواهی';
    case 'OLDEST':
      return '۵. قدیمی‌ترین گواهی صادرشده دفتر';
    case 'NEWEST':
      return '۶. جدیدترین گواهی صادرشده دفتر';
    case 'ANOMALIES':
      return '۷. سایر موارد غیرعادی (صدور در شب، ریسک بالا و...)';
    default:
      return rule;
  }
}

export interface PriorityRuleDetail {
  title: string;
  formula: string;
  calculationMethod: string;
  auditImportance: string;
  indicators: string[];
}

export function getPriorityRuleDetails(rule: PriorityRuleType): PriorityRuleDetail {
  switch (rule) {
    case 'REVOKED':
      return {
        title: 'گواهی‌های ابطال‌شده (Revoked Certificates)',
        formula: 'StatusCert = "REVOKED" | "ابطال" AND SortBy(RiskScore DESC)',
        calculationMethod: 'فیلتر گواهی‌هایی که وضعیت آنها ابطال‌شده است و مقایسه زمان صدور تا ابطال. در صورت وجود در دفتر، سهمیه الزامی به آنها اختصاص می‌یابد.',
        auditImportance: 'بررسی ضرورت و انطباق قانونی ابطال، احراز هویت درخواست‌دهنده ابطال، تغییر سمت سازمانی یا مفقودی توکن سخت‌افزاری.',
        indicators: ['فیلد RevokeDate', 'فیلد RevokeResion', 'فرم یا درخواست کتبی ابطال'],
      };
    case 'INCOMPLETE_INFO':
      return {
        title: 'اطلاعات ناقص و مغایرت‌های هویتی (Incomplete / Inconsistent Data)',
        formula: 'NationalId.length < 10 OR Mobile.length < 11 OR (IsLegal AND NOT CompanyNationalId)',
        calculationMethod: 'ارزیابی طول و صحت کد ملی متقاضی (حداقل ۱۰ رقم)، ثبت شماره موبایل معتبر جهت استعلام شاهکار (۱۱ رقم)، و بررسی درج شناسه ۱۱ رقمی اشخاص حقوقی در گواهی‌های حقوقی و مهر سازمانی.',
        auditImportance: 'کشف نقایص ثبت‌نامی و احراز هویت ناقص قبل از صدور گواهی امضای دیجیتال.',
        indicators: ['کد ملی ناقص', 'شماره موبایل ناقص', 'عدم ثبت شناسه شرکت در گواهی حقوقی'],
      };
    case 'SHORT_VALIDITY':
      return {
        title: 'اعتبار کوتاه یا ابطال زودهنگام (Short Validity / Quick Revocation)',
        formula: 'DateDiff(ValidTo, ValidFrom) <= 60 Days OR DateDiff(RevokeDate, ValidFrom) <= 60 Days',
        calculationMethod: 'محاسبه اختلاف روز بین تاریخ صدور و انقضا/ابطال. گواهی‌هایی با طول عمر کمتر از ۶۰ روز شناسایی و از کمترین به بیشترین مرتب می‌شوند.',
        auditImportance: 'بررسی صدورهای مقطعی مشکوک یا ابطال‌های فوری پس از انجام یک تراکنش مالی یا اداری خاص.',
        indicators: ['طول عمر گواهی کمتر از ۶۰ روز', 'ابطال بلافاصله پس از صدور'],
      };
    case 'MULTI_CERT_APPLICANTS':
      return {
        title: 'اشخاص یا سازمان‌های دارای چند گواهی (Multi-Certificate Concentration)',
        formula: 'Count(Certificates WHERE NationalId = current.NationalId OR CompanyId = current.CompanyId) > 1',
        calculationMethod: 'گروه‌بندی و شمارش کل گواهی‌های صادرشده برای هر کد ملی متقاضی یا هر شناسه ملی شرکت در خروجی دفتر، و انتخاب رکوردهایی با بیشترین فراوانی صدور.',
        auditImportance: 'بررسی تمرکز صدور غیرمتعارف برای یک فرد یا شرکت و جلوگیری از صدورهای تکراری یا موازی.',
        indicators: ['تعداد گواهی‌های متصل به متقاضی > ۱', 'صدور چندباره گواهی فعال برای یک سازمان'],
      };
    case 'OLDEST':
      return {
        title: 'قدیمی‌ترین گواهی دفتر (Oldest Issued Certificate)',
        formula: 'MIN(ValidFrom + " " + IssueTime) in Office Pool',
        calculationMethod: 'مرتب‌سازی صعودی زمانی کل گواهی‌های دفتر بر اساس تاریخ و ساعت صدور و استخراج اولین رکورد.',
        auditImportance: 'بررسی عملکرد اولیه دفتر در ابتدای دوره بازرسی و پایبندی به آرشیو فیزیکی و الکترونیکی اسناد قدیمی.',
        indicators: ['اولین رکورد صدور بر اساس گاه‌شمار دفتر'],
      };
    case 'NEWEST':
      return {
        title: 'جدیدترین گواهی دفتر (Newest Issued Certificate)',
        formula: 'MAX(ValidFrom + " " + IssueTime) in Office Pool',
        calculationMethod: 'مرتب‌سازی نزولی زمانی کل گواهی‌های دفتر و استخراج آخرین رکورد صادرشده.',
        auditImportance: 'بررسی روال‌های جاری و آخرین به‌روزرسانی‌های نرم‌افزاری و شیوه‌نامه‌های احراز هویت در روزهای اخیر دفتر.',
        indicators: ['آخرین رکورد ثبت‌شده در فایل اکسل دفتر'],
      };
    case 'ANOMALIES':
      return {
        title: 'سایر موارد غیرعادی و ساعات نامتعارف (Off-Hours / High Anomaly Risk)',
        formula: '(Hour(IssueTime) >= 21 OR Hour(IssueTime) < 7) OR RiskScore >= 70',
        calculationMethod: 'بررسی فیلد ساعت صدور گواهی (issueTime) و شناسایی رکوردهای صادرشده بین ۲۱:۰۰ شب تا ۰۷:۰۰ صبح، به علاوه گواهی‌های با امتیاز ریسک مرکب بالای ۷۰ (مهر سازمانی با اطمینان بالا + ابطال مشکوک).',
        auditImportance: 'کشف صدورهای خارج از ساعت کاری بدون حضور فیزیکی متقاضی و ممانعت از اقدامات غیرمجاز خارج از شیفت.',
        indicators: ['صدور در ساعات شبانه ۲۱ الی ۷', 'نمره ریسک ترکیبی بالای ۷۰'],
      };
    default:
      return {
        title: rule,
        formula: '-',
        calculationMethod: '-',
        auditImportance: '-',
        indicators: [],
      };
  }
}

// Determine required documents strictly according to Root CA auditing rules:
// ۱. شخص حقیقی-مستقل: فرم پذیرش (بدون معرفینامه)
// ۲. کلیه انواع دیگر گواهی (حقیقی/حقوقی وابسته به غیردولت یا دولت): معرفینامه الزامی است (+ فرم پذیرش و اسناد ثبتی حسب مورد)
// ۳. برای تمام گواهی‌های ابطال شده (REVOKED): فرم یا درخواست کتبی ابطال نیز به مدارک اضافه می‌گردد
export function getRequiredDocumentsForCert(cert: CertificateRecord): DocumentType[] {
  let docs: DocumentType[] = [];

  // فرم پذیرش پایه
  docs.push('APPLICATION_FORM');

  // معرفینامه برای همه انواع گواهی اضافه می‌شود به جز شخص حقیقی مستقل
  if (cert.dependencyType !== 'INDIVIDUAL_INDEPENDENT') {
    if (!docs.includes('LEGAL_INTRO_LETTER')) {
      docs.push('LEGAL_INTRO_LETTER');
    }
  }

  // اسناد تکمیلی ثبتی برای اشخاص حقوقی و غیردولتی
  if (cert.dependencyType === 'LEGAL_NON_GOV' || cert.dependencyType === 'INDIVIDUAL_NON_GOV') {
    if (!docs.includes('ESTABLISHMENT_NOTICE')) {
      docs.push('ESTABLISHMENT_NOTICE');
    }
    if (!docs.includes('OFFICIAL_GAZETTE')) {
      docs.push('OFFICIAL_GAZETTE');
    }
  }

  // در صورت ابطال گواهی، فرم درخواست ابطال الزامی است
  if (cert.status === 'REVOKED' && !docs.includes('REVOCATION_REQUEST')) {
    docs.push('REVOCATION_REQUEST');
  }

  return docs;
}

export function getDocTypeTitle(type: DocumentType): string {
  switch (type) {
    case 'APPLICATION_FORM':
      return 'فرم پذیرش';
    case 'LEGAL_INTRO_LETTER':
      return 'معرفینامه';
    case 'ESTABLISHMENT_NOTICE':
      return 'آگهی تاسیس';
    case 'OFFICIAL_GAZETTE':
      return 'آخرین روزنامه رسمی';
    case 'REVOCATION_REQUEST':
      return 'فرم درخواست ابطال';
    default:
      return 'سند پیوست';
  }
}

/**
 * Pre-computes office-level analytical metadata for all certificates in the pool:
 * - Identifies oldest and newest certificates
 * - Counts certificates per applicant national ID or company
 * - Flags missing info
 * - Checks for short validity
 */
export function enrichCertificatesWithMetadata(records: CertificateRecord[]): CertificateRecord[] {
  if (!records || records.length === 0) return [];

  // 1. Group applicant/company counts
  const applicantCounts: Record<string, number> = {};
  const companyCounts: Record<string, number> = {};

  records.forEach(r => {
    if (r.nationalId) {
      applicantCounts[r.nationalId] = (applicantCounts[r.nationalId] || 0) + 1;
    }
    if (r.companyNationalId) {
      companyCounts[r.companyNationalId] = (companyCounts[r.companyNationalId] || 0) + 1;
    }
  });

  // 2. Find oldest and newest issuance dates/times
  const sortedByDate = [...records].sort((a, b) => {
    const dateA = `${a.issueDate || ''} ${a.issueTime || ''}`;
    const dateB = `${b.issueDate || ''} ${b.issueTime || ''}`;
    return dateA.localeCompare(dateB);
  });

  const oldestId = sortedByDate[0]?.id;
  const newestId = sortedByDate[sortedByDate.length - 1]?.id;

  return records.map(r => {
    const missing: string[] = [];
    if (!r.nationalId || r.nationalId.length < 10) missing.push('کد ملی ناقص یا نامعتبر');
    if (!r.mobileNumber || r.mobileNumber.length < 11) missing.push('عدم ثبت شماره موبایل معتبر');
    if (((r.dependencyType && r.dependencyType.startsWith('LEGAL')) || r.certificateType === 'LEGAL_REP' || r.certificateType === 'LEGAL_SEAL') && !r.companyNationalId) {
      missing.push('عدم درج شناسه ملی شرکت در گواهی حقوقی');
    }

    const hasIncompleteInfo = missing.length > 0;
    const isMultiCert = (r.nationalId && applicantCounts[r.nationalId] > 1) || (r.companyNationalId && companyCounts[r.companyNationalId] > 1);
    const applicantOrOrgCertCount = Math.max(
      r.nationalId ? (applicantCounts[r.nationalId] || 1) : 1,
      r.companyNationalId ? (companyCounts[r.companyNationalId] || 1) : 1
    );

    // Short validity heuristic: e.g. < 60 days
    const validityDurationDays = r.validityDurationDays !== undefined ? r.validityDurationDays : 365;

    // Check night hour
    let isAnomalyOrOffHours = false;
    if (r.issueTime) {
      const hour = parseInt(r.issueTime.split(':')[0], 10);
      if (!isNaN(hour) && (hour >= 21 || hour < 7)) {
        isAnomalyOrOffHours = true;
      }
    }
    if (r.riskScore >= 70) {
      isAnomalyOrOffHours = true;
    }

    return {
      ...r,
      hasIncompleteInfo,
      incompleteInfoDetails: missing,
      applicantOrOrgCertCount,
      isOldestInOffice: r.id === oldestId,
      isNewestInOffice: r.id === newestId,
      isAnomalyOrOffHours,
      validityDurationDays,
    };
  });
}

/**
 * Evaluates the 4 mandatory Quality Control checks on a selected sample against an office pool
 */
export function evaluateQualityChecklist(
  pool: CertificateRecord[],
  sample: CertificateRecord[],
  targetCount: number = 7,
  enforceDependency: boolean = true,
  enforceRevoked: boolean = true,
  minRevokedRequired: number = 2
): QualityChecklistResult {
  const notes: string[] = [];

  // Check 1: Exact sample count
  const exactCountMatch = sample.length === targetCount;
  if (!exactCountMatch) {
    notes.push(`تعداد نمونه‌ها (${sample.length}) با حد نصاب تعیین‌شده (${targetCount}) مغایرت دارد.`);
  }

  // Check 2: Coverage of available dependency types
  const availableDependencyTypes = Array.from(new Set(pool.map(r => r.dependencyType)));
  const coveredDependencyTypes = Array.from(new Set(sample.map(r => r.dependencyType)));
  const missingDependencyTypes = availableDependencyTypes.filter(type => !coveredDependencyTypes.includes(type));
  
  const dependencyCoverageSatisfied = !enforceDependency || missingDependencyTypes.length === 0;
  if (!dependencyCoverageSatisfied) {
    const missingTitles = missingDependencyTypes.map(getDependencyTypeTitle).join('، ');
    notes.push(`انواع وابستگی زیر در خروجی دفتر موجود بوده اما در نمونه پوشش داده نشده‌اند: ${missingTitles}`);
  }

  // Check 3: Revoked coverage
  const revokedInPool = pool.filter(r => r.status === 'REVOKED').length;
  const revokedInSample = sample.filter(r => r.status === 'REVOKED').length;
  
  let revokedCoverageSatisfied = true;
  if (enforceRevoked && revokedInPool > 0) {
    const expectedRevoked = Math.min(minRevokedRequired, revokedInPool);
    if (revokedInSample < expectedRevoked) {
      revokedCoverageSatisfied = false;
      notes.push(`حداقل ${expectedRevoked} گواهی ابطال‌شده باید انتخاب شود (تعداد در نمونه: ${revokedInSample} از ${revokedInPool} مورد موجود در دفتر).`);
    }
  }

  // Check 4: No duplicate certificates (verified by canonical serial number, tracking code, national ID, and ID)
  let hasDuplicatesInSample = false;
  for (let i = 0; i < sample.length; i++) {
    for (let j = i + 1; j < sample.length; j++) {
      if (areCertificatesIdentical(sample[i], sample[j])) {
        hasDuplicatesInSample = true;
        break;
      }
    }
    if (hasDuplicatesInSample) break;
  }
  const noDuplicatesSatisfied = !hasDuplicatesInSample;
  if (!noDuplicatesSatisfied) {
    notes.push('گواهی‌های تکراری در نمونه انتخابی وجود دارد.');
  }

  const allPassed = exactCountMatch && dependencyCoverageSatisfied && revokedCoverageSatisfied && noDuplicatesSatisfied;

  return {
    exactCountMatch,
    targetCount,
    currentCount: sample.length,
    dependencyCoverageSatisfied,
    availableDependencyTypes,
    coveredDependencyTypes,
    missingDependencyTypes,
    revokedCoverageSatisfied,
    revokedAvailableInOffice: revokedInPool,
    revokedSelectedInSample: revokedInSample,
    noDuplicatesSatisfied,
    allPassed,
    notes,
  };
}

/**
 * Core Official 7-Certificate Sampling Algorithm
 * 1. Exactly 7 samples per RA office (or customizable target count).
 * 2. Mandatory Coverage of 5 Dependency Types (if present in office pool).
 * 3. Mandatory Coverage of Revoked Certificates (at least 2 if available, or 1 if only 1 exists).
 * 4. Completion of remaining quota via 7 strict prioritized risk criteria.
 * 5. Quality Control validation verification.
 */
export function executeSampling(
  allRecords: CertificateRecord[],
  config: SamplingAlgorithmConfig
): SamplingResult {
  if (!allRecords || allRecords.length === 0) {
    return {
      selectedRecords: [],
      totalAvailable: 0,
      sampleCount: 0,
      targetCount: config.sampleSize || 7,
      samplePercentage: 0,
      checklist: {
        exactCountMatch: false,
        targetCount: config.sampleSize || 7,
        currentCount: 0,
        dependencyCoverageSatisfied: true,
        availableDependencyTypes: [],
        coveredDependencyTypes: [],
        missingDependencyTypes: [],
        revokedCoverageSatisfied: true,
        revokedAvailableInOffice: 0,
        revokedSelectedInSample: 0,
        noDuplicatesSatisfied: true,
        allPassed: false,
        notes: ['داده‌ای برای نمونه‌گیری وجود ندارد.'],
      },
      algorithmSummary: {
        individualIndependentCount: 0,
        legalNonGovCount: 0,
        individualNonGovCount: 0,
        legalGovCount: 0,
        individualGovCount: 0,
        revokedCount: 0,
        incompleteInfoCount: 0,
        multiCertCount: 0,
        highRiskCount: 0,
        averageRiskScore: 0,
      }
    };
  }

  // Enrich pool with metadata
  let pool = enrichCertificatesWithMetadata([...allRecords]);

  // Optional Office / Date filters
  if (config.specificOfficeCode) {
    pool = pool.filter(r => r.officeCode === config.specificOfficeCode);
  }
  if (config.filterDateStart) {
    pool = pool.filter(r => r.issueDate >= (config.filterDateStart || ''));
  }
  if (config.filterDateEnd) {
    pool = pool.filter(r => r.issueDate <= (config.filterDateEnd || ''));
  }
  if (config.onlyHighAssurance) {
    pool = pool.filter(r => r.assuranceLevel === 'HIGH');
  }

  if (pool.length === 0) {
    pool = enrichCertificatesWithMetadata([...allRecords]);
  }

  // Deduplicate pool to ensure all candidate records in pool are strictly unique certificates
  const uniquePool: CertificateRecord[] = [];
  for (const p of pool) {
    if (!uniquePool.some(u => areCertificatesIdentical(u, p))) {
      uniquePool.push(p);
    }
  }
  pool = uniquePool;

  // Determine target sample size (default 7)
  let targetCount = config.sampleSize || 7;
  if (config.sampleSizeType === 'PERCENTAGE') {
    targetCount = Math.max(1, Math.round((pool.length * (config.sampleSize || 7)) / 100));
  }
  targetCount = Math.min(targetCount, pool.length);

  const selected: CertificateRecord[] = [];
  const selectedIds = new Set<string>();

  const isSelectedOrIdentical = (cert: CertificateRecord): boolean => {
    if (selectedIds.has(cert.id)) return true;
    if (cert.serialNumber && selectedIds.has(cert.serialNumber)) return true;
    if (cert.trackingCode && selectedIds.has(cert.trackingCode)) return true;
    return selected.some(s => areCertificatesIdentical(s, cert));
  };

  const addToSelection = (cert: CertificateRecord, reasonBadge: string) => {
    // Strictly verify certificate uniqueness across serial number, tracking code, national ID, and ID
    if (!isSelectedOrIdentical(cert)) {
      selected.push({
        ...cert,
        selectedReasonBadge: reasonBadge,
      });
      selectedIds.add(cert.id);
      if (cert.serialNumber) selectedIds.add(cert.serialNumber);
      if (cert.trackingCode) selectedIds.add(cert.trackingCode);
      return true;
    }
    return false;
  };

  // -------------------------------------------------------------
  // RULE 1: Coverage of 5 Dependency Types (پوشش انواع وابستگی)
  // If present in office pool, select at least 1 of each type
  // -------------------------------------------------------------
  if (config.enforceDependencyCoverage !== false && selected.length < targetCount) {
    const typesToEnforce = config.requiredDependencyTypes && config.requiredDependencyTypes.length > 0
      ? config.requiredDependencyTypes
      : ALL_DEPENDENCY_TYPES;

    for (const depType of typesToEnforce) {
      if (selected.length >= targetCount) break;

      const candidates = pool.filter(r => r.dependencyType === depType && !isSelectedOrIdentical(r));
      if (candidates.length > 0) {
        // Prioritize candidate with higher risk or revoked status
        const sortedCandidates = [...candidates].sort((a, b) => {
          if (a.status === 'REVOKED' && b.status !== 'REVOKED') return -1;
          if (b.status === 'REVOKED' && a.status !== 'REVOKED') return 1;
          if (a.hasIncompleteInfo && !b.hasIncompleteInfo) return -1;
          if (b.hasIncompleteInfo && !a.hasIncompleteInfo) return 1;
          return b.riskScore - a.riskScore;
        });

        addToSelection(sortedCandidates[0], `پوشش وابستگی: ${getDependencyTypeTitle(depType)}`);
      }
    }
  }

  // -------------------------------------------------------------
  // RULE 2: Coverage of Certificate Status (پوشش وضعیت گواهی / ابطال)
  // If revoked certificates exist in office: pick at least 2 (or 1 if only 1 exists)
  // -------------------------------------------------------------
  if (config.enforceRevokedCoverage !== false && selected.length < targetCount) {
    const minRevoked = config.minRevokedCount !== undefined ? config.minRevokedCount : 2;
    const currentRevokedCount = selected.filter(r => r.status === 'REVOKED').length;
    const neededRevoked = Math.max(0, minRevoked - currentRevokedCount);

    if (neededRevoked > 0) {
      const revokedCandidates = pool
        .filter(r => r.status === 'REVOKED' && !isSelectedOrIdentical(r))
        .sort((a, b) => b.riskScore - a.riskScore);

      for (let i = 0; i < Math.min(neededRevoked, revokedCandidates.length); i++) {
        if (selected.length >= targetCount) break;
        addToSelection(revokedCandidates[i], 'پوشش وضعیت: گواهی ابطال‌شده');
      }
    }
  }

  // -------------------------------------------------------------
  // RULE 3: Completion of Sample Count using Risk & Priority Criteria
  // -------------------------------------------------------------
  const priorityOrder = config.priorityCriteriaOrder || DEFAULT_PRIORITY_ORDER;

  if (selected.length < targetCount) {
    for (const rule of priorityOrder) {
      if (selected.length >= targetCount) break;

      switch (rule) {
        case 'REVOKED': {
          // Additional revoked certificates
          const candidates = pool
            .filter(r => r.status === 'REVOKED' && !isSelectedOrIdentical(r))
            .sort((a, b) => b.riskScore - a.riskScore);
          for (const c of candidates) {
            if (selected.length >= targetCount) break;
            addToSelection(c, 'اولویت ۱: گواهی ابطال‌شده تکمیلی');
          }
          break;
        }

        case 'INCOMPLETE_INFO': {
          // Certificates with incomplete/missing info
          const candidates = pool
            .filter(r => r.hasIncompleteInfo && !isSelectedOrIdentical(r))
            .sort((a, b) => (b.incompleteInfoDetails?.length || 0) - (a.incompleteInfoDetails?.length || 0));
          for (const c of candidates) {
            if (selected.length >= targetCount) break;
            addToSelection(c, 'اولویت ۲: اطلاعات ناقص و مغایرت');
          }
          break;
        }

        case 'SHORT_VALIDITY': {
          // Short validity duration or early revocation
          const candidates = pool
            .filter(r => (r.validityDurationDays || 365) <= 60 && !isSelectedOrIdentical(r))
            .sort((a, b) => (a.validityDurationDays || 365) - (b.validityDurationDays || 365));
          for (const c of candidates) {
            if (selected.length >= targetCount) break;
            addToSelection(c, 'اولویت ۳: مدت اعتبار کوتاه یا ابطال سریع');
          }
          break;
        }

        case 'MULTI_CERT_APPLICANTS': {
          // Applicants/companies with multiple certificates
          const candidates = pool
            .filter(r => (r.applicantOrOrgCertCount || 1) > 1 && !isSelectedOrIdentical(r))
            .sort((a, b) => (b.applicantOrOrgCertCount || 0) - (a.applicantOrOrgCertCount || 0));
          for (const c of candidates) {
            if (selected.length >= targetCount) break;
            addToSelection(c, `اولویت ۴: چند گواهی (${c.applicantOrOrgCertCount} گواهی)`);
          }
          break;
        }

        case 'OLDEST': {
          // Oldest issued certificate in office
          const candidate = pool.find(r => r.isOldestInOffice && !isSelectedOrIdentical(r));
          if (candidate) {
            addToSelection(candidate, 'اولویت ۵: قدیمی‌ترین گواهی دفتر');
          }
          break;
        }

        case 'NEWEST': {
          // Newest issued certificate in office
          const candidate = pool.find(r => r.isNewestInOffice && !isSelectedOrIdentical(r));
          if (candidate) {
            addToSelection(candidate, 'اولویت ۶: جدیدترین گواهی دفتر');
          }
          break;
        }

        case 'ANOMALIES': {
          // Anomalies: Night hours, high risk score
          const candidates = pool
            .filter(r => r.isAnomalyOrOffHours && !isSelectedOrIdentical(r))
            .sort((a, b) => b.riskScore - a.riskScore);
          for (const c of candidates) {
            if (selected.length >= targetCount) break;
            addToSelection(c, 'اولویت ۷: ناهنجاری صدور / ساعات غیراداری');
          }
          break;
        }
      }
    }
  }

  // Fallback: If still under target count, fill from remaining by highest risk score
  if (selected.length < targetCount) {
    const remaining = pool
      .filter(r => !isSelectedOrIdentical(r))
      .sort((a, b) => b.riskScore - a.riskScore);

    for (const c of remaining) {
      if (selected.length >= targetCount) break;
      addToSelection(c, 'تکمیل سهمیه: نمره ریسک بالا');
    }
  }

  // -------------------------------------------------------------
  // RULE 4: Final Quality Checklist Control
  // -------------------------------------------------------------
  const checklist = evaluateQualityChecklist(
    pool,
    selected,
    targetCount,
    config.enforceDependencyCoverage !== false,
    config.enforceRevokedCoverage !== false,
    config.minRevokedCount !== undefined ? config.minRevokedCount : 2
  );

  // Summary counts
  const individualIndependentCount = selected.filter(r => r.dependencyType === 'INDIVIDUAL_INDEPENDENT').length;
  const legalNonGovCount = selected.filter(r => r.dependencyType === 'LEGAL_NON_GOV').length;
  const individualNonGovCount = selected.filter(r => r.dependencyType === 'INDIVIDUAL_NON_GOV').length;
  const legalGovCount = selected.filter(r => r.dependencyType === 'LEGAL_GOV').length;
  const individualGovCount = selected.filter(r => r.dependencyType === 'INDIVIDUAL_GOV').length;
  const revokedCount = selected.filter(r => r.status === 'REVOKED').length;
  const incompleteInfoCount = selected.filter(r => r.hasIncompleteInfo).length;
  const multiCertCount = selected.filter(r => (r.applicantOrOrgCertCount || 1) > 1).length;
  const highRiskCount = selected.filter(r => r.riskScore >= 60).length;
  const averageRiskScore = selected.length > 0
    ? Math.round(selected.reduce((acc, curr) => acc + curr.riskScore, 0) / selected.length)
    : 0;

  return {
    selectedRecords: selected,
    totalAvailable: pool.length,
    sampleCount: selected.length,
    targetCount,
    samplePercentage: pool.length > 0 ? Math.round((selected.length / pool.length) * 100) : 0,
    checklist,
    algorithmSummary: {
      individualIndependentCount,
      legalNonGovCount,
      individualNonGovCount,
      legalGovCount,
      individualGovCount,
      revokedCount,
      incompleteInfoCount,
      multiCertCount,
      highRiskCount,
      averageRiskScore,
    }
  };
}

/**
 * Checks if two certificate records represent the exact same certificate or applicant case.
 * Compares:
 * 1. Certificate Serial Number (canonical PKI unique identifier)
 * 2. Certificate Tracking Code / RefCert (portal reference code)
 * 3. National ID + Certificate Type + Issue Date (applicant's specific certificate)
 * 4. Record ID match
 */
export function areCertificatesIdentical(
  a: Partial<CertificateRecord> | undefined | null,
  b: Partial<CertificateRecord> | undefined | null
): boolean {
  if (!a || !b) return false;
  if (a.id && b.id && a.id === b.id) return true;

  const serialA = String(a.serialNumber || '').trim().toUpperCase();
  const serialB = String(b.serialNumber || '').trim().toUpperCase();
  if (serialA && serialB && serialA === serialB) return true;

  const trackA = String(a.trackingCode || '').trim().toUpperCase();
  const trackB = String(b.trackingCode || '').trim().toUpperCase();
  if (trackA && trackB && trackA === trackB) return true;

  const nidA = String(a.nationalId || '').trim();
  const nidB = String(b.nationalId || '').trim();
  if (nidA && nidB && nidA === nidB && a.certificateType && b.certificateType && a.certificateType === b.certificateType) {
    if (!a.issueDate || !b.issueDate || a.issueDate === b.issueDate) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if two audit inspection records refer to the exact same certificate or case.
 */
export function areAuditRecordsIdentical(
  a: AuditInspectionRecord | undefined | null,
  b: AuditInspectionRecord | undefined | null
): boolean {
  if (!a || !b) return false;
  if (a.id && b.id && a.id === b.id) return true;
  if (a.certificateId && b.certificateId && a.certificateId === b.certificateId) return true;
  if (a.certificate?.id && b.certificate?.id && a.certificate.id === b.certificate.id) return true;

  const certA = a.certificate;
  const certB = b.certificate;

  if (certA && certB) {
    if (areCertificatesIdentical(certA, certB)) return true;
  }

  const serialA = String(certA?.serialNumber || '').trim().toUpperCase();
  const serialB = String(certB?.serialNumber || '').trim().toUpperCase();
  if (serialA && serialB && serialA === serialB) return true;

  const trackA = String(certA?.trackingCode || '').trim().toUpperCase();
  const trackB = String(certB?.trackingCode || '').trim().toUpperCase();
  if (trackA && trackB && trackA === trackB) return true;

  const nidA = String(certA?.nationalId || '').trim();
  const nidB = String(certB?.nationalId || '').trim();
  if (nidA && nidB && nidA === nidB && certA?.certificateType && certB?.certificateType && certA.certificateType === certB.certificateType) {
    if (!certA.issueDate || !certB.issueDate || certA.issueDate === certB.issueDate) {
      return true;
    }
  }

  return false;
}

/**
 * Generates a unique deduplication key for an audit inspection record / certificate.
 * Prioritizes serialNumber (PKI canonical), trackingCode, nationalId + certType, or IDs.
 */
export function getRecordDeduplicationKey(record: AuditInspectionRecord): string {
  if (!record) return '';
  const cert = record.certificate;
  const serial = String(cert?.serialNumber || '').trim().toUpperCase();
  if (serial) {
    return `SERIAL_${serial}`;
  }
  const track = String(cert?.trackingCode || '').trim().toUpperCase();
  if (track) {
    return `TRACK_${track}`;
  }
  const nat = String(cert?.nationalId || '').trim();
  if (nat) {
    return `NAT_${nat}_${cert?.certificateType || 'NATURAL'}_${cert?.issueDate || ''}`;
  }
  if (record.certificateId && String(record.certificateId).trim()) {
    return `CERT_${String(record.certificateId).trim()}`;
  }
  if (cert?.id && String(cert.id).trim()) {
    return `CERTID_${String(cert.id).trim()}`;
  }
  return `REC_${record.id || 'unknown'}`;
}

function getRecordInspectionStatusWeight(rec: AuditInspectionRecord): number {
  let score = 0;
  if (rec.uploadedDocuments && rec.uploadedDocuments.length > 0) {
    score += 20 + rec.uploadedDocuments.length * 10;
  }
  if (rec.notesHistory && rec.notesHistory.length > 0) {
    score += rec.notesHistory.length * 2;
  }
  if (rec.complianceScore !== undefined) {
    score += 5;
  }
  switch (rec.status) {
    case 'APPROVED': score += 100; break;
    case 'CONDITIONAL': score += 90; break;
    case 'DEFECT_MAJOR': score += 80; break;
    case 'DEFECT_MINOR': score += 70; break;
    case 'REJECTED': score += 60; break;
    case 'UNDER_REVIEW': score += 50; break;
    case 'UPLOADED': score += 40; break;
    case 'PENDING_UPLOAD': score += 10; break;
    default: score += 0;
  }
  return score;
}

/**
 * Deduplicates an array of AuditInspectionRecord items so each certificate/case appears strictly once.
 * Intelligently merges documents, notes history, and preserves the highest inspection status.
 */
export function deduplicateAuditRecords(records: AuditInspectionRecord[]): AuditInspectionRecord[] {
  if (!Array.isArray(records) || records.length <= 1) return records || [];

  const dedupedList: AuditInspectionRecord[] = [];

  for (const rec of records) {
    if (!rec) continue;
    
    // Find if rec matches an existing record in dedupedList using areAuditRecordsIdentical
    const existingIdx = dedupedList.findIndex(existing => areAuditRecordsIdentical(existing, rec));

    if (existingIdx === -1) {
      dedupedList.push({ ...rec });
    } else {
      const existing = dedupedList[existingIdx];
      const existingScore = getRecordInspectionStatusWeight(existing);
      const incomingScore = getRecordInspectionStatusWeight(rec);

      const preferred = incomingScore > existingScore ? rec : existing;
      const secondary = incomingScore > existingScore ? existing : rec;

      // Merge uploaded documents without duplicate doc ids/types/fileNames
      const docMap = new Map<string, UploadedDocument>();
      (secondary.uploadedDocuments || []).forEach(d => {
        const dKey = d.id || `${d.docType}_${d.fileName}`;
        docMap.set(dKey, d);
      });
      (preferred.uploadedDocuments || []).forEach(d => {
        const dKey = d.id || `${d.docType}_${d.fileName}`;
        docMap.set(dKey, d);
      });
      const mergedDocs = Array.from(docMap.values());

      // Merge notes history
      const existingHistory = existing.notesHistory || [];
      const incomingHistory = rec.notesHistory || [];
      const historyIds = new Set<string>();
      const mergedHistory: CaseNoteEntry[] = [];
      [...existingHistory, ...incomingHistory].forEach(n => {
        if (!historyIds.has(n.id)) {
          historyIds.add(n.id);
          mergedHistory.push(n);
        }
      });

      const mergedRecord: AuditInspectionRecord = {
        ...preferred,
        uploadedDocuments: mergedDocs,
        notesHistory: mergedHistory.length > 0 ? mergedHistory : preferred.notesHistory,
        officeNotes: preferred.officeNotes || secondary.officeNotes,
        inspectorNotes: preferred.inspectorNotes || secondary.inspectorNotes,
        aiAuditResult: preferred.aiAuditResult || secondary.aiAuditResult,
        submittedAt: preferred.submittedAt || secondary.submittedAt,
        reviewDate: preferred.reviewDate || secondary.reviewDate,
      };

      dedupedList[existingIdx] = mergedRecord;
    }
  }

  return dedupedList;
}
