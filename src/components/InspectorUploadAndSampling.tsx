import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Upload, 
  Sparkles, 
  Layers, 
  AlertTriangle, 
  CheckCircle2, 
  Send, 
  Download, 
  Building, 
  Sliders, 
  Check, 
  RefreshCw, 
  Shuffle, 
  PlusCircle, 
  Trash2, 
  ArrowUpDown, 
  ArrowUp,
  ArrowDown,
  HelpCircle,
  XCircle,
  Clock,
  ShieldCheck,
  Search,
  Tag,
  Settings,
  SlidersHorizontal,
  X,
  Info,
  ChevronDown,
  ChevronUp,
  FileText,
  CheckSquare,
  Square,
  BookOpen,
  FileCheck,
  Eye
} from 'lucide-react';
import { 
  CertificateRecord, 
  SamplingAlgorithmConfig, 
  OfficeProfile, 
  AuditCampaign, 
  DependencyType, 
  PriorityRuleType,
  DocumentType
} from '../types';
import { AppUser } from '../types/auth';
import { getUserPermissions } from '../services/authService';
import { parseExcelFile, downloadStandardExcelTemplate, toEnglishDigits } from '../utils/excelParser';
import { formatDisplayDate } from '../utils/dateFormatter';
import { 
  executeSampling, 
  SamplingResult, 
  getRequiredDocumentsForCert,
  getDocTypeTitle,
  getDependencyTypeTitle,
  getCertificateStatusTitle,
  getPriorityRuleTitle,
  getPriorityRuleDetails,
  ALL_DEPENDENCY_TYPES,
  DEFAULT_PRIORITY_ORDER,
  evaluateQualityChecklist,
  areCertificatesIdentical,
  areAuditRecordsIdentical
} from '../utils/samplingEngine';

const ALL_SYSTEM_DOCUMENT_TYPES: { type: DocumentType; label: string; desc: string }[] = [
  { type: 'APPLICATION_FORM', label: 'فرم پذیرش', desc: 'فرم پذیرش و درخواست صدور گواهی با امضای متقاضی (پیش‌فرض الزامی)' },
  { type: 'LEGAL_INTRO_LETTER', label: 'معرفینامه رسمی', desc: 'معرفینامه کتبی معتبر با امضای صاحبان امضا و مهر سازمانی' },
  { type: 'ESTABLISHMENT_NOTICE', label: 'آگهی تاسیس', desc: 'آگهی تاسیس شرکت / سازمان در روزنامه رسمی' },
  { type: 'OFFICIAL_GAZETTE', label: 'آخرین روزنامه رسمی', desc: 'آخرین تغییرات هیئت مدیره و صاحبان امضای مجاز' },
  { type: 'REVOCATION_REQUEST', label: 'درخواست کتبی ابطال', desc: 'فرم یا نامه رسمی متقاضی جهت ابطال گواهی' },
];

interface InspectorUploadAndSamplingProps {
  offices: OfficeProfile[];
  onUpdateOffices?: (updatedOffices: OfficeProfile[]) => void;
  selectedOfficeCode: string;
  setSelectedOfficeCode: (code: string) => void;
  availableCertificates: CertificateRecord[];
  setAvailableCertificates: (certs: CertificateRecord[]) => void;
  campaigns?: AuditCampaign[];
  currentUser?: AppUser | null;
  onCreateCampaign: (campaign: AuditCampaign) => void;
  onNavigateToOfficeKartable: () => void;
  viewMode?: 'SAMPLING' | 'POOL';
}

export const InspectorUploadAndSampling: React.FC<InspectorUploadAndSamplingProps> = ({
  offices,
  onUpdateOffices,
  selectedOfficeCode,
  setSelectedOfficeCode,
  availableCertificates,
  setAvailableCertificates,
  campaigns = [],
  currentUser,
  onCreateCampaign,
  onNavigateToOfficeKartable,
  viewMode = 'SAMPLING',
}) => {
  const userPerms = getUserPermissions(currentUser);
  const canModifySamples = userPerms.canModifySampleSelection;
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [hasDispatchedCurrentBatch, setHasDispatchedCurrentBatch] = useState(false);

  // Active View Tab: 'SAMPLE' | 'FULL_POOL'
  const [activeTab, setActiveTab] = useState<'SAMPLE' | 'FULL_POOL'>(() =>
    viewMode === 'POOL' ? 'FULL_POOL' : 'SAMPLE'
  );

  useEffect(() => {
    if (viewMode === 'POOL') {
      setActiveTab('FULL_POOL');
    } else if (viewMode === 'SAMPLING') {
      setActiveTab('SAMPLE');
    }
  }, [viewMode]);

  // Search & Filters for Full Pool
  const [poolSearchQuery, setPoolSearchQuery] = useState('');
  const [filterDepType, setFilterDepType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Accordion state for priority rule calculation explanations
  const [expandedRuleKeys, setExpandedRuleKeys] = useState<Record<string, boolean>>({});

  const toggleRuleExpand = (rule: string) => {
    setExpandedRuleKeys(prev => ({
      ...prev,
      [rule]: !prev[rule]
    }));
  };

  // Algorithm Configuration State
  const [samplingConfig, setSamplingConfig] = useState<SamplingAlgorithmConfig>({
    method: 'OFFICIAL_7_RULES',
    sampleSize: 7,
    sampleSizeType: 'COUNT',
    enforceDependencyCoverage: true,
    requiredDependencyTypes: [...ALL_DEPENDENCY_TYPES],
    enforceRevokedCoverage: true,
    minRevokedCount: 2,
    priorityCriteriaOrder: [...DEFAULT_PRIORITY_ORDER],
    prioritizeOffHours: true,
    onlyHighAssurance: false,
  });

  // Algorithm Customization Modal State
  const [showCustomAlgorithmModal, setShowCustomAlgorithmModal] = useState(false);
  const [modalTempConfig, setModalTempConfig] = useState<SamplingAlgorithmConfig>({
    ...samplingConfig
  });

  // Sampling Result State
  const [samplingResult, setSamplingResult] = useState<SamplingResult>(() => {
    return executeSampling(availableCertificates, {
      method: 'OFFICIAL_7_RULES',
      sampleSize: 7,
      sampleSizeType: 'COUNT',
      enforceDependencyCoverage: true,
      enforceRevokedCoverage: true,
      minRevokedCount: 2,
      priorityCriteriaOrder: [...DEFAULT_PRIORITY_ORDER],
    });
  });

  // Modal for manual swapping
  const [swapModalTargetCert, setSwapModalTargetCert] = useState<CertificateRecord | null>(null);

  // Modal for Campaign creation & dispatch
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchActiveTab, setDispatchActiveTab] = useState<'GENERAL' | 'DOCUMENTS'>('DOCUMENTS');
  const [campaignTitle, setCampaignTitle] = useState('دوره بازرسی ادواری - الگوریتم مصوب ۷ گواهی');
  const [deadlineDays, setDeadlineDays] = useState(10);
  const [inspectorName, setInspectorName] = useState('مهندس حسینی (سرپرست بازرسی مرکز میانی عام)');
  const [isDispatchedSuccess, setIsDispatchedSuccess] = useState(false);

  // Per-certificate document requirements and explanation reasons configured before dispatch
  const [certDocConfigs, setCertDocConfigs] = useState<Record<string, {
    requiredDocs: DocumentType[];
    docReasons: Partial<Record<DocumentType, string>>;
  }>>({});

  // Sync certDocConfigs whenever sampled records change
  useEffect(() => {
    if (samplingResult?.selectedRecords) {
      setCertDocConfigs(prev => {
        const next = { ...prev };
        samplingResult.selectedRecords.forEach(cert => {
          if (!next[cert.id]) {
            const standardDocs = getRequiredDocumentsForCert(cert);
            // Ensure APPLICATION_FORM is always checked by default
            if (!standardDocs.includes('APPLICATION_FORM')) {
              standardDocs.unshift('APPLICATION_FORM');
            }
            next[cert.id] = {
              requiredDocs: standardDocs,
              docReasons: {},
            };
          }
        });
        return next;
      });
    }
  }, [samplingResult?.selectedRecords]);

  // Helper to toggle a required document for a specific certificate
  const handleToggleDocForCert = (certId: string, docType: DocumentType) => {
    setCertDocConfigs(prev => {
      const current = prev[certId] || { requiredDocs: ['APPLICATION_FORM'], docReasons: {} };
      const exists = current.requiredDocs.includes(docType);
      let updatedDocs: DocumentType[];
      if (exists) {
        // Remove document
        updatedDocs = current.requiredDocs.filter(d => d !== docType);
      } else {
        // Add document
        updatedDocs = [...current.requiredDocs, docType];
      }
      return {
        ...prev,
        [certId]: {
          ...current,
          requiredDocs: updatedDocs,
        }
      };
    });
  };

  // Helper to update explanation note for a requested document
  const handleUpdateDocReason = (certId: string, docType: DocumentType, reason: string) => {
    setCertDocConfigs(prev => {
      const current = prev[certId] || { requiredDocs: ['APPLICATION_FORM'], docReasons: {} };
      return {
        ...prev,
        [certId]: {
          ...current,
          docReasons: {
            ...current.docReasons,
            [docType]: reason,
          }
        }
      };
    });
  };

  // Helper to reset a cert's docs to default dependency rules
  const handleResetCertDocsToDefault = (cert: CertificateRecord) => {
    const defaultDocs = getRequiredDocumentsForCert(cert);
    if (!defaultDocs.includes('APPLICATION_FORM')) {
      defaultDocs.unshift('APPLICATION_FORM');
    }
    setCertDocConfigs(prev => ({
      ...prev,
      [cert.id]: {
        requiredDocs: defaultDocs,
        docReasons: prev[cert.id]?.docReasons || {}
      }
    }));
  };

  // Handle Excel file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const parsed = await parseExcelFile(file);

      if (!parsed.records || parsed.records.length === 0) {
        throw new Error('فایل اکسل انتخاب‌شده فاقد اطلاعات یا ردیف‌های معتبر گواهی است.');
      }

      // Office lookup helper: maps code and name to registered OfficeProfile
      const officeByCode = new Map<string, OfficeProfile>();
      const officeByName = new Map<string, OfficeProfile>();
      offices.forEach((o) => {
        const normCode = toEnglishDigits(o.code).trim();
        if (normCode) officeByCode.set(normCode, o);
        const normName = o.name.trim();
        if (normName) officeByName.set(normName, o);
      });

      // 1. Identify distinct office codes present in the Excel records
      const rawExcelOfficeCodes = Array.from(
        new Set(
          parsed.records
            .map((r) => toEnglishDigits(r.officeCode || '').trim())
            .filter((code) => code.length > 0)
        )
      );

      // 2. Determine target office
      let targetRegisteredOffice: OfficeProfile | undefined;

      if (rawExcelOfficeCodes.length > 0) {
        const matchedOffice = officeByCode.get(rawExcelOfficeCodes[0]);
        if (matchedOffice) {
          targetRegisteredOffice = matchedOffice;
        } else {
          // Check if there is an office matching by name in the records
          const recordOfficeName = parsed.records[0]?.officeName?.trim();
          if (recordOfficeName && officeByName.has(recordOfficeName)) {
            targetRegisteredOffice = officeByName.get(recordOfficeName);
          } else {
            // Check if current selected office matches
            const currentSelected = offices.find(o => o.code === selectedOfficeCode);
            if (currentSelected) {
              targetRegisteredOffice = currentSelected;
            } else {
              throw new Error(
                `خطای اعتبارسنجی: دفتر با کد «${rawExcelOfficeCodes.join('، ')}» در لیست دفاتر ثبت‌نام سامانه یافت نشد. لطفاً ابتدا این دفتر را در بخش «مدیریت دفاتر و شعب» تعریف نمایید یا در منوی بالای صفحه دفتر مربوطه را انتخاب فرمایید.`
              );
            }
          }
        }
      } else {
        // No office code explicitly specified in Excel rows: assign all to the currently selected office in the system
        targetRegisteredOffice = offices.find(o => o.code === selectedOfficeCode) || offices[0];
      }

      if (!targetRegisteredOffice) {
        targetRegisteredOffice = offices[0];
      }

      if (targetRegisteredOffice && targetRegisteredOffice.code !== selectedOfficeCode) {
        setSelectedOfficeCode(targetRegisteredOffice.code);
      }

      // 3. Map records strictly to the official registered office
      const finalizedRecords = parsed.records.map((r) => {
        const rawCode = toEnglishDigits(r.officeCode || '').trim();
        const rawName = (r.officeName || '').trim();
        const matchedOffice = (rawCode && officeByCode.get(rawCode)) || (rawName && officeByName.get(rawName)) || targetRegisteredOffice;
        const official = matchedOffice || targetRegisteredOffice;

        return {
          ...r,
          officeCode: official.code,
          officeName: official.name,
        };
      });

      setFileName(file.name);
      setAvailableCertificates(finalizedRecords);
      setHasDispatchedCurrentBatch(false);

      // Re-run sampling with current config
      const result = executeSampling(finalizedRecords, samplingConfig);
      setSamplingResult(result);
    } catch (err: any) {
      setFileName(null);
      setAvailableCertificates([]);
      setSamplingResult(null);
      setUploadError(err.message || 'خطا در بارگذاری یا پردازش فایل اکسل');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  // Re-run sampling when algorithm parameters change
  const handleApplySampling = (newConfig: SamplingAlgorithmConfig) => {
    setSamplingConfig(newConfig);
    setHasDispatchedCurrentBatch(false);
    const result = executeSampling(availableCertificates, newConfig);
    setSamplingResult(result);
  };

  // Open Customization Modal
  const handleOpenCustomizationModal = () => {
    setModalTempConfig({
      ...samplingConfig,
      requiredDependencyTypes: [...(samplingConfig.requiredDependencyTypes || ALL_DEPENDENCY_TYPES)],
      priorityCriteriaOrder: [...(samplingConfig.priorityCriteriaOrder || DEFAULT_PRIORITY_ORDER)]
    });
    setShowCustomAlgorithmModal(true);
  };

  // Apply from Customization Modal
  const handleSaveModalCustomization = () => {
    handleApplySampling(modalTempConfig);
    setShowCustomAlgorithmModal(false);
  };

  // Move priority rule up/down in modal
  const handleMovePriorityInModal = (index: number, direction: 'up' | 'down') => {
    const currentOrder = [...modalTempConfig.priorityCriteriaOrder];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentOrder.length) return;

    const temp = currentOrder[index];
    currentOrder[index] = currentOrder[targetIndex];
    currentOrder[targetIndex] = temp;

    setModalTempConfig({
      ...modalTempConfig,
      priorityCriteriaOrder: currentOrder
    });
  };

  // Move priority rule up/down in sidebar
  const handleMovePriorityInSidebar = (index: number, direction: 'up' | 'down') => {
    const currentOrder = [...samplingConfig.priorityCriteriaOrder];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentOrder.length) return;

    const temp = currentOrder[index];
    currentOrder[index] = currentOrder[targetIndex];
    currentOrder[targetIndex] = temp;

    handleApplySampling({
      ...samplingConfig,
      priorityCriteriaOrder: currentOrder
    });
  };

  // Manual removal of a sample certificate
  const handleRemoveSample = (certId: string) => {
    const updatedSelected = samplingResult.selectedRecords.filter(r => r.id !== certId);
    const updatedChecklist = evaluateQualityChecklist(
      availableCertificates,
      updatedSelected,
      samplingConfig.sampleSize || 7,
      samplingConfig.enforceDependencyCoverage,
      samplingConfig.enforceRevokedCoverage,
      samplingConfig.minRevokedCount || 2
    );

    setSamplingResult({
      ...samplingResult,
      selectedRecords: updatedSelected,
      sampleCount: updatedSelected.length,
      checklist: updatedChecklist,
    });
  };

  // Manual addition of a cert from the pool to the sample
  const handleAddCertToSample = (cert: CertificateRecord) => {
    if (samplingResult.selectedRecords.some(r => r.id === cert.id)) return;

    const updatedSelected = [
      ...samplingResult.selectedRecords,
      { ...cert, selectedReasonBadge: 'انتخاب دستی توسط بازرس' }
    ];

    const updatedChecklist = evaluateQualityChecklist(
      availableCertificates,
      updatedSelected,
      samplingConfig.sampleSize || 7,
      samplingConfig.enforceDependencyCoverage,
      samplingConfig.enforceRevokedCoverage,
      samplingConfig.minRevokedCount || 2
    );

    setSamplingResult({
      ...samplingResult,
      selectedRecords: updatedSelected,
      sampleCount: updatedSelected.length,
      checklist: updatedChecklist,
    });
  };

  // Swap target certificate with a new certificate from pool
  const handlePerformSwap = (targetCertId: string, newCert: CertificateRecord) => {
    const updatedSelected = samplingResult.selectedRecords.map(r => {
      if (r.id === targetCertId) {
        return {
          ...newCert,
          selectedReasonBadge: `جایگزینی دستی (به جای ${r.applicantName})`
        };
      }
      return r;
    });

    const updatedChecklist = evaluateQualityChecklist(
      availableCertificates,
      updatedSelected,
      samplingConfig.sampleSize || 7,
      samplingConfig.enforceDependencyCoverage,
      samplingConfig.enforceRevokedCoverage,
      samplingConfig.minRevokedCount || 2
    );

    setSamplingResult({
      ...samplingResult,
      selectedRecords: updatedSelected,
      sampleCount: updatedSelected.length,
      checklist: updatedChecklist,
    });

    setSwapModalTargetCert(null);
  };

  // Dispatch campaign to office kartable
  const handleConfirmDispatch = () => {
    if (!samplingResult || samplingResult.selectedRecords.length === 0) return;

    if (isAlreadyDispatched) {
      alert('این دوره نمونه‌گیری قبلاً به کارتابل دفتر ابلاغ گردیده است و امکان ارسال تکراری وجود ندارد.');
      return;
    }

    const firstCert = samplingResult.selectedRecords[0];
    const targetOfficeCode = String(firstCert?.officeCode || selectedOfficeCode).trim();
    const targetOfficeName = firstCert?.officeName || offices.find(o => String(o.code).trim() === targetOfficeCode)?.name || `دفتر پیشخوان دولت کد ${targetOfficeCode}`;

    // 1. Strictly deduplicate within selectedRecords itself
    const uniqueSelected: CertificateRecord[] = [];
    for (const cert of samplingResult.selectedRecords) {
      if (!uniqueSelected.some(u => areCertificatesIdentical(u, cert))) {
        uniqueSelected.push(cert);
      }
    }

    // 2. Filter out any certificate that is ALREADY dispatched to this office
    const targetOfficeExistingRecords = (campaigns || [])
      .filter(c => String(c.officeCode || '').trim() === targetOfficeCode)
      .flatMap(c => c.records || []);

    const nonDuplicateSelected = uniqueSelected.filter(cert => {
      const alreadyInOffice = targetOfficeExistingRecords.some(r =>
        areAuditRecordsIdentical(r, { id: cert.id, certificateId: cert.id, certificate: cert } as any)
      );
      return !alreadyInOffice;
    });

    if (nonDuplicateSelected.length === 0) {
      alert('تمامی گواهی‌های این نمونه قبلاً به کارتابل این دفتر ابلاغ گردیده‌اند و جهت حفظ یکپارچگی داده‌ها، ارسال رکورد تکراری مجاز نمی‌باشد.');
      return;
    }

    const campaignId = `camp-${Date.now()}`;
    const code = `INSP-1405-${targetOfficeCode}-${Math.floor(100 + Math.random() * 900)}`;

    const todayJalali = '1405/05/24';
    const deadlineJalali = '1405/06/05';

    const newRecords = nonDuplicateSelected.map((cert, idx) => {
      const config = certDocConfigs[cert.id];
      // Default to APPLICATION_FORM if nothing selected
      const requiredDocuments: DocumentType[] = (config?.requiredDocs && config.requiredDocs.length > 0)
        ? config.requiredDocs
        : ['APPLICATION_FORM'];
      const documentRequestReasons = config?.docReasons || {};

      const recordOfficeCode = String(cert.officeCode || targetOfficeCode).trim();
      const recordOfficeName = cert.officeName || targetOfficeName;

      return {
        id: `rec-${campaignId}-${idx + 1}`,
        campaignId,
        campaignTitle,
        officeCode: recordOfficeCode,
        officeName: recordOfficeName,
        certificateId: cert.id,
        certificate: {
          ...cert,
          officeCode: recordOfficeCode,
          officeName: recordOfficeName,
        },
        status: 'PENDING_UPLOAD' as const,
        requiredDocuments,
        documentRequestReasons,
        uploadedDocuments: [],
      };
    });

    const newCampaign: AuditCampaign = {
      id: campaignId,
      title: campaignTitle,
      code,
      inspectionType: 'PERIODIC_MONTHLY',
      createdAt: todayJalali,
      deadlineDate: deadlineJalali,
      officeCode: targetOfficeCode,
      officeName: targetOfficeName,
      totalCertificatesInExcel: availableCertificates.length,
      selectedSampleCount: nonDuplicateSelected.length,
      samplingConfig,
      status: 'ACTIVE',
      records: newRecords,
      inspectorName,
    };

    setSelectedOfficeCode(targetOfficeCode);
    onCreateCampaign(newCampaign);
    setHasDispatchedCurrentBatch(true);
    setIsDispatchedSuccess(true);

    setTimeout(() => {
      setShowDispatchModal(false);
      setIsDispatchedSuccess(false);
      onNavigateToOfficeKartable();
    }, 1200);
  };

  const currentOffice = offices.find(o => o.code === selectedOfficeCode) || offices[0];

  // Check if current sampling is already dispatched to avoid duplicate dispatches
  const officeMatchingCampaigns = (campaigns || []).filter(
    c => String(c.officeCode || '').trim() === String(selectedOfficeCode || '').trim()
  );
  const existingOfficeRecords = officeMatchingCampaigns.flatMap(c => c.records || []);

  // Records in current sample that already exist in this office's kartable
  const duplicateSamplesInOffice = (samplingResult?.selectedRecords || []).filter(cert =>
    existingOfficeRecords.some(r => areAuditRecordsIdentical(r, { id: cert.id, certificateId: cert.id, certificate: cert } as any))
  );

  const areAllSamplesInExistingCampaign = 
    (samplingResult?.selectedRecords?.length ?? 0) > 0 && 
    duplicateSamplesInOffice.length === samplingResult.selectedRecords.length;

  const isAlreadyDispatched = hasDispatchedCurrentBatch || areAllSamplesInExistingCampaign;

  // Filter full pool records
  const filteredPool = availableCertificates.filter(r => {
    if (poolSearchQuery) {
      const q = poolSearchQuery.toLowerCase();
      const matchName = (r.applicantName || '').toLowerCase().includes(q);
      const matchId = (r.nationalId || '').includes(q);
      const matchSerial = (r.serialNumber || '').toLowerCase().includes(q);
      const matchComp = (r.companyName || '').toLowerCase().includes(q);
      if (!matchName && !matchId && !matchSerial && !matchComp) return false;
    }
    if (filterDepType !== 'ALL' && r.dependencyType !== filterDepType) return false;
    if (filterStatus !== 'ALL' && r.status !== filterStatus) return false;
    return true;
  });

  const isSelected = (certId: string) => samplingResult.selectedRecords.some(s => s.id === certId);

  return (
    <div className="space-y-6">
      {/* Top Banner with Algorithm Highlight - Light Theme */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-xs relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-emerald-50 text-emerald-800 text-xs px-3 py-1 rounded-full font-bold border border-emerald-200 flex items-center gap-1.5 shadow-2xs">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                {viewMode === 'POOL' ? 'بانک گواهی‌ها و پرونده‌های ثبتی' : 'الگوریتم مصوب بازرسی ادواری (انتخاب ۷ گواهی)'}
              </span>
              <span className="bg-slate-100 text-slate-700 text-xs px-3 py-1 rounded-full border border-slate-200 font-semibold">
                دفتر فعال: {currentOffice.name} (کد {currentOffice.code})
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {viewMode === 'POOL'
                ? 'بانک جامع گواهی‌های صادرشده و بارگذاری فایل اکسل'
                : 'نمونه‌گیری هوشمند آماری و ابلاغ دوره بازرسی'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {viewMode === 'POOL'
                ? 'مشاهده و پایش کلیه گواهی‌های صادرشده، جستجو و فیلتر پیشرفته بر اساس نام متقاضی، کدملی، نوع وابستگی و بارگذاری فایل اکسل جدید برای دفتر صدور.'
                : 'این سیستم بر اساس ضوابط بازرسی دقیقاً ۷ گواهی را با پوشش انواع ۵‌گانه وابستگی و گواهی‌های ابطال‌شده استخراج کرده و به صورت سیستمی به کارتابل دفتر جهت بارگذاری مستندات ارسال می‌کند.'}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap shrink-0">
            <button
              onClick={() => downloadStandardExcelTemplate(selectedOfficeCode || currentOffice.code || '1607')}
              className="flex items-center gap-2 bg-white hover:bg-slate-100 border-2 border-slate-300 hover:border-slate-400 text-slate-800 font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-2xs transition cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>دانلود قالب استاندارد (۱۴ ستون)</span>
            </button>

            <button
              id="btn-customize-algorithm-header"
              onClick={handleOpenCustomizationModal}
              className="flex items-center gap-2 bg-cyan-50 hover:bg-cyan-100 text-cyan-950 border-2 border-cyan-400 hover:border-cyan-500 font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-2xs transition cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4 text-cyan-700" />
              <span>سفارشی‌سازی الگوریتم</span>
            </button>

            <button
              onClick={() => handleApplySampling({ ...samplingConfig, method: 'OFFICIAL_7_RULES', sampleSize: 7 })}
              className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl border-2 border-emerald-800 shadow-sm transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>اجرای مجدد الگوریتم</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Upload & Controls on Left, Results & Checklist on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: 4 Cols */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* File Upload Box */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>بارگذاری فایل اکسل دفتر</span>
              </h3>
              <span className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold">
                {availableCertificates.length} گواهی در فایل
              </span>
            </div>

            <label className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer bg-slate-50/70 hover:bg-emerald-50/40 transition text-center group">
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isUploading}
              />
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 group-hover:bg-emerald-200 flex items-center justify-center transition shadow-2xs">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800 group-hover:text-emerald-800 transition">
                  {fileName ? fileName : 'برای بارگذاری فایل اکسل اینجا کلیک کنید'}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  پشتیبانی از فرمت‌های .xlsx و .xls با ۱۴ ستون استاندارد
                </p>
              </div>
            </label>

            {uploadError && (
              <div className="flex items-start gap-3 text-xs text-rose-900 bg-rose-50 border-2 border-rose-300 p-3.5 rounded-2xl shadow-xs">
                <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <p className="font-extrabold text-sm text-rose-950">خطا در اعتبارسنجی فایل اکسل</p>
                  <p className="leading-relaxed text-rose-800">{uploadError}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setUploadError(null)}
                  className="text-rose-600 hover:text-rose-900 px-2 py-0.5 text-xs font-bold rounded-lg hover:bg-rose-100 cursor-pointer"
                  title="بستن پیام"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Current Pool Distribution */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 text-xs">
              <div className="text-slate-800 font-bold flex items-center justify-between pb-2 border-b border-slate-200">
                <span>توزیع انواع وابستگی در فایل:</span>
                <span className="text-[11px] text-slate-500 font-semibold">{availableCertificates.length} گواهی کل</span>
              </div>
              
              <div className="space-y-2 text-[11px]">
                {ALL_DEPENDENCY_TYPES.map((type) => {
                  const countInPool = availableCertificates.filter(c => c.dependencyType === type).length;
                  const countInSample = samplingResult.selectedRecords.filter(c => c.dependencyType === type).length;
                  return (
                    <div key={type} className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200 shadow-2xs">
                      <span className="text-slate-700 font-medium truncate">{getDependencyTypeTitle(type)}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-slate-500 font-mono font-semibold">{countInPool} در فایل</span>
                        <span className={`px-2 py-0.5 rounded-md font-bold ${
                          countInSample > 0 ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {countInSample} در نمونه
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Revoked Status in Pool */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 mt-2">
                  <span className="font-bold">گواهی‌های ابطال‌شده دفتر:</span>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-rose-700 font-semibold">{availableCertificates.filter(c => c.status === 'REVOKED').length} در فایل</span>
                    <span className="bg-rose-200 text-rose-950 px-2 py-0.5 rounded-md font-bold">
                      {samplingResult.selectedRecords.filter(c => c.status === 'REVOKED').length} در نمونه
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Algorithm Rules & Parameters Box */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-600" />
                <span>پارامترهای قابل تغییر الگوریتم</span>
              </h3>
              <button
                id="btn-customize-algorithm-sidebar"
                onClick={handleOpenCustomizationModal}
                className="text-xs text-cyan-800 bg-cyan-50 hover:bg-cyan-100 border border-cyan-300 px-3 py-1 rounded-full font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
              >
                <SlidersHorizontal className="w-3 h-3 text-cyan-700" />
                <span>سفارشی‌سازی</span>
              </button>
            </div>

            {/* Target Sample Size */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-slate-800">حجم نمونه هدف (تعداد گواهی):</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="1"
                    max={Math.max(1, availableCertificates.length)}
                    value={samplingConfig.sampleSize}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 7;
                      handleApplySampling({ ...samplingConfig, sampleSize: val });
                    }}
                    className="w-16 bg-white border border-slate-300 rounded-lg px-2 py-1 text-center font-black text-emerald-700 text-sm focus:outline-none focus:border-emerald-500 shadow-2xs"
                  />
                  <span className="text-slate-600 text-xs font-semibold">عدد</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 leading-normal">
                بر اساس دستورالعمل رسمی، سهمیه دقیقاً ۷ گواهی برای هر دفتر تعیین گردیده است.
              </p>
            </div>

            {/* Dependency Types Enforce Toggle */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs font-bold text-slate-800">پوشش الزامی ۵ نوع وابستگی:</span>
                <input
                  type="checkbox"
                  checked={samplingConfig.enforceDependencyCoverage}
                  onChange={(e) => handleApplySampling({ ...samplingConfig, enforceDependencyCoverage: e.target.checked })}
                  className="rounded accent-emerald-600 w-4 h-4 cursor-pointer"
                />
              </label>
              <p className="text-[11px] text-slate-500 leading-normal">
                انتخاب حداقل ۱ نمونه از هر یک از انواع ۵‌گانه در صورت وجود در خروجی دفتر.
              </p>
            </div>

            {/* Revoked Status Enforce Toggle */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={samplingConfig.enforceRevokedCoverage}
                    onChange={(e) => handleApplySampling({ ...samplingConfig, enforceRevokedCoverage: e.target.checked })}
                    className="rounded accent-emerald-600 w-4 h-4 cursor-pointer"
                  />
                  <span>پوشش گواهی‌های ابطال‌شده:</span>
                </label>
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-slate-600 font-semibold text-[11px]">حداقل:</span>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={samplingConfig.minRevokedCount}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 2;
                      handleApplySampling({ ...samplingConfig, minRevokedCount: val });
                    }}
                    className="w-14 bg-white border border-slate-300 rounded-lg px-2 py-0.5 text-center font-bold text-rose-700 text-xs shadow-2xs"
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 leading-normal">
                در صورت وجود گواهی ابطال در دفتر، حداقل ۲ نمونه (یا حداکثر موجودی) انتخاب می‌گردد.
              </p>
            </div>

            {/* Priorities Order Info & Quick Reorder */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">ترتیب اولویت‌های ۷‌گانه تکمیل سهمیه:</span>
                <button
                  onClick={handleOpenCustomizationModal}
                  className="text-[11px] text-emerald-700 hover:text-emerald-800 font-bold underline cursor-pointer"
                >
                  ویرایش اولویت‌ها
                </button>
              </div>
              
              <div className="space-y-2 text-[11px] text-slate-700">
                {samplingConfig.priorityCriteriaOrder.map((rule, idx) => {
                  const isExpanded = !!expandedRuleKeys[`sidebar-${rule}`];
                  const detail = getPriorityRuleDetails(rule);

                  return (
                    <div key={rule} className="rounded-xl bg-white border border-slate-200 shadow-2xs overflow-hidden transition">
                      <div className="flex items-center justify-between p-2.5">
                        <div 
                          onClick={() => toggleRuleExpand(`sidebar-${rule}`)}
                          className="flex items-center gap-2 truncate cursor-pointer hover:text-emerald-800 flex-1"
                          title="برای مشاهده نحوه محاسبه و فرمول کلیک کنید"
                        >
                          <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center font-mono font-black text-[10px] shrink-0">
                            {idx + 1}
                          </span>
                          <span className="truncate font-semibold">{getPriorityRuleTitle(rule).replace(/^[۰-۹0-9]\.\s*/, '')}</span>
                          <Info className={`w-3.5 h-3.5 shrink-0 transition ${isExpanded ? 'text-emerald-600' : 'text-slate-400'}`} />
                        </div>
                        <div className="flex items-center gap-1 shrink-0 mr-1">
                          <button
                            onClick={() => handleMovePriorityInSidebar(idx, 'up')}
                            disabled={idx === 0}
                            title="افزایش اولویت"
                            className="p-1 text-slate-500 hover:text-emerald-700 disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleMovePriorityInSidebar(idx, 'down')}
                            disabled={idx === samplingConfig.priorityCriteriaOrder.length - 1}
                            title="کاهش اولویت"
                            className="p-1 text-slate-500 hover:text-emerald-700 disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Expandable Explanation Details */}
                      {isExpanded && (
                        <div className="p-3 bg-slate-50 border-t border-slate-100 text-[10px] space-y-2 leading-relaxed animate-in fade-in duration-150">
                          <div>
                            <span className="font-bold text-slate-800 block">روش استخراج و نحوه محاسبه:</span>
                            <p className="text-slate-600 mt-0.5">{detail.calculationMethod}</p>
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 block">فرمول / منطق فیلتر:</span>
                            <code className="text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] font-mono border border-emerald-200 block mt-0.5 dir-ltr text-right">
                              {detail.formula}
                            </code>
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 block">اهمیت در بازرسی:</span>
                            <p className="text-slate-600 mt-0.5">{detail.auditImportance}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: 8 Cols (Checklist + Tabs + Results) */}
        <div className="lg:col-span-8 space-y-6">

          {/* 4-PART QUALITY CONTROL CARD (کنترل نهایی قبل از ابلاغ) */}
          <div className={`bg-white border rounded-3xl p-6 sm:p-7 shadow-xs transition ${
            samplingResult.checklist.allPassed 
              ? 'border-emerald-300' 
              : 'border-amber-300'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                  samplingResult.checklist.allPassed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {samplingResult.checklist.allPassed ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-base font-extrabold text-slate-900">
                      کنترل نهایی انطباق با ضوابط نمونه‌گیری (چک‌لیست ۴ گانه)
                    </h3>
                    <span className={`text-[11px] px-3 py-0.5 rounded-full font-bold border ${
                      samplingResult.checklist.allPassed
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-amber-50 text-amber-800 border-amber-300'
                    }`}>
                      {samplingResult.checklist.allPassed ? '✓ کلیه ضوابط محقق گردید' : 'نیازمند بازبینی / توجه'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    ارزیابی تطبیق سهمیه ۷ تایی، پوشش انواع وابستگی، گواهی‌های ابطال و عدم تکرار
                  </p>
                </div>
              </div>

              {isAlreadyDispatched ? (
                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    disabled
                    className="flex items-center justify-center gap-2 bg-emerald-50 text-emerald-950 border-2 border-emerald-400 text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl cursor-not-allowed shadow-2xs"
                    title="این دوره قبلاً به کارتابل دفتر ابلاغ گردیده و جهت جلوگیری از دوباره‌کاری امکان ارسال تکراری غیرفعال است."
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>ابلاغ شده به کارتابل (ارسال مجدد غیرفعال)</span>
                  </button>

                  <button
                    onClick={onNavigateToOfficeKartable}
                    className="flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl border-2 border-emerald-800 shadow-xs transition cursor-pointer"
                  >
                    <Eye className="w-4 h-4" />
                    <span>مشاهده در کارتابل دفتر</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowDispatchModal(true)}
                  disabled={samplingResult.selectedRecords.length === 0}
                  className="flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold px-5 py-2.5 rounded-xl border-2 border-emerald-800 shadow-sm transition shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                  <span>ابلاغ به کارتابل دفتر</span>
                </button>
              )}
            </div>

            {/* 4 Check Items Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-4">
              
              {/* Check 1: Exact count */}
              <div className={`p-3.5 rounded-2xl border text-xs flex items-start gap-3 ${
                samplingResult.checklist.exactCountMatch
                  ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50/60 border-rose-200 text-rose-900'
              }`}>
                {samplingResult.checklist.exactCountMatch ? (
                  <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold flex items-center gap-1.5 text-slate-900">
                    <span>۱. تعداد نمونه‌ها ({samplingResult.checklist.currentCount} از {samplingResult.checklist.targetCount})</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    {samplingResult.checklist.exactCountMatch
                      ? 'تعداد دقیقاً مطابق با سهمیه مصوب است.'
                      : `مغایرت در تعداد (${samplingResult.checklist.currentCount} به جای ${samplingResult.checklist.targetCount})`}
                  </p>
                </div>
              </div>

              {/* Check 2: Dependency types coverage */}
              <div className={`p-3.5 rounded-2xl border text-xs flex items-start gap-3 ${
                samplingResult.checklist.dependencyCoverageSatisfied
                  ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50/60 border-amber-200 text-amber-900'
              }`}>
                {samplingResult.checklist.dependencyCoverageSatisfied ? (
                  <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold flex items-center gap-1.5 text-slate-900">
                    <span>۲. پوشش انواع وابستگی موجود</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    {samplingResult.checklist.dependencyCoverageSatisfied
                      ? `تمامی ${samplingResult.checklist.availableDependencyTypes.length} نوع وابستگی موجود در فایل پوشش داده شد.`
                      : `عدم پوشش: ${samplingResult.checklist.missingDependencyTypes.map(getDependencyTypeTitle).join('، ')}`}
                  </p>
                </div>
              </div>

              {/* Check 3: Revoked certs coverage */}
              <div className={`p-3.5 rounded-2xl border text-xs flex items-start gap-3 ${
                samplingResult.checklist.revokedCoverageSatisfied
                  ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50/60 border-amber-200 text-amber-900'
              }`}>
                {samplingResult.checklist.revokedCoverageSatisfied ? (
                  <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold flex items-center gap-1.5 text-slate-900">
                    <span>۳. پوشش گواهی‌های ابطال‌شده</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    {samplingResult.checklist.revokedAvailableInOffice === 0
                      ? 'دفتر فاقد گواهی ابطال‌شده است (عدم الزام).'
                      : `${samplingResult.checklist.revokedSelectedInSample} مورد ابطال از کل ${samplingResult.checklist.revokedAvailableInOffice} مورد انتخاب شد.`}
                  </p>
                </div>
              </div>

              {/* Check 4: No duplicates */}
              <div className={`p-3.5 rounded-2xl border text-xs flex items-start gap-3 ${
                samplingResult.checklist.noDuplicatesSatisfied
                  ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50/60 border-rose-200 text-rose-900'
              }`}>
                {samplingResult.checklist.noDuplicatesSatisfied ? (
                  <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold flex items-center gap-1.5 text-slate-900">
                    <span>۴. عدم تکرار در نمونه</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    {samplingResult.checklist.noDuplicatesSatisfied
                      ? 'هیچ گواهی بیش از یک بار انتخاب نشده است.'
                      : 'گواهی تکراری در نمونه وجود دارد.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Warning if some samples already exist in the office kartable */}
            {duplicateSamplesInOffice.length > 0 && !isAlreadyDispatched && (
              <div className="mt-4 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-2.5 text-xs text-amber-950 shadow-2xs">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <p className="leading-relaxed">
                  <strong>توجه:</strong> تعداد {duplicateSamplesInOffice.length} گواهی از نمونه‌های منتخب، قبلاً در کارتابل این دفتر ابلاغ گردیده‌اند. سیستم به صورت خودکار مانع ارسال مجدد رکوردهای تکراری خواهد شد.
                </p>
              </div>
            )}

            {/* Already Dispatched Warning & Unlock Action */}
            {isAlreadyDispatched && (
              <div className="mt-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-950 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                  <p className="leading-relaxed">
                    <strong>ابلاغ شده:</strong> این دوره بازرسی قبلاً به کارتابل دفتر صدور «{currentOffice.name}» ابلاغ گردیده و در جریان بارگذاری اسناد است. جهت جلوگیری از دوباره‌کاری، ارسال مجدد غیرفعال است.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setHasDispatchedCurrentBatch(false)}
                  className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 underline shrink-0 cursor-pointer text-left"
                  title="در صورت نیاز به ارسال مجدد یا تغییر دستی"
                >
                  آزادسازی قفل ابلاغیه
                </button>
              </div>
            )}
          </div>

          {/* Tab Navigation Header */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setActiveTab('SAMPLE')}
                className={`flex items-center gap-2 text-xs font-extrabold px-4 py-2.5 rounded-xl transition cursor-pointer ${
                  activeTab === 'SAMPLE'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>گواهی‌های نمونه انتخابی ({samplingResult.selectedRecords.length} گواهی)</span>
              </button>

              <button
                onClick={() => setActiveTab('FULL_POOL')}
                className={`flex items-center gap-2 text-xs font-extrabold px-4 py-2.5 rounded-xl transition cursor-pointer ${
                  activeTab === 'FULL_POOL'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>بانک کل گواهی‌های اکسل ({availableCertificates.length})</span>
              </button>
            </div>

            <div className="text-xs text-slate-500 font-medium hidden sm:block">
              {activeTab === 'SAMPLE' 
                ? (canModifySamples ? 'اختیار کامل مدیریت و جایگزینی نمونه‌ها (مقام بالاتر و بازرس ارشد)' : 'کارشناس بازرسی رده پایین‌تر فاقد اختیار تغییر نمونه‌هاست') 
                : 'امکان جستجو و افزودن مستقیم به نمونه'}
            </div>
          </div>

          {/* TAB 1: Selected Samples View */}
          {activeTab === 'SAMPLE' && (
            <div className="space-y-4">
              {!canModifySamples && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs text-amber-950 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0" />
                    <span>
                      <strong>محدودیت دسترسی کارشناس بازرسی:</strong> دخل و تصرف، حذف یا جایگزینی دستی در نمونه‌های ممیزی صرفاً در صلاحیت <strong>بازرس ارشد و مقام بالاتر</strong> بوده و کارشناس بازرسی رده پایین‌تر امکان تغییر نمونه‌ها را ندارد.
                    </span>
                  </div>
                  <span className="text-[10px] bg-amber-200/80 text-amber-950 font-bold px-2.5 py-1 rounded-lg shrink-0">
                    مختص مقام بالاتر و بازرس ارشد
                  </span>
                </div>
              )}

              {samplingResult.selectedRecords.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center text-slate-600 space-y-3 shadow-xs">
                  <AlertTriangle className="w-10 h-10 mx-auto text-amber-500" />
                  <p className="font-semibold text-sm">هیچ نمونه‌ای انتخاب نشده است. لطفاً فایل اکسل را بارگذاری کنید یا دکمه اجرای مجدد الگوریتم را بزنید.</p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {samplingResult.selectedRecords.map((cert, index) => {
                    const requiredDocs = getRequiredDocumentsForCert(cert);
                    const isRevoked = cert.status === 'REVOKED';

                    return (
                      <div
                        key={cert.id}
                        className={`bg-white border rounded-2xl p-5 transition shadow-xs hover:shadow-sm ${
                          isRevoked ? 'border-rose-200 bg-rose-50/20' : 'border-slate-200'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          {/* Row Index & Applicant Info */}
                          <div className="flex items-start gap-3.5">
                            <span className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-mono font-bold text-slate-800 shrink-0 mt-0.5 shadow-2xs">
                              {index + 1}
                            </span>

                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-sm font-extrabold text-slate-900">{cert.applicantName}</h4>
                                
                                {/* Status Badge */}
                                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${
                                  isRevoked 
                                    ? 'bg-rose-50 text-rose-700 border-rose-200' 
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}>
                                  {getCertificateStatusTitle(cert.status)}
                                </span>

                                {/* Dependency Type Badge */}
                                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-cyan-50 text-cyan-800 border border-cyan-200 font-bold">
                                  {getDependencyTypeTitle(cert.dependencyType)}
                                </span>

                                {/* Reason Badge */}
                                {cert.selectedReasonBadge && (
                                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-semibold flex items-center gap-1">
                                    <Tag className="w-3 h-3" />
                                    <span>{cert.selectedReasonBadge}</span>
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap font-mono">
                                <span>سریال گواهی: <strong className="text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{cert.serialNumber}</strong></span>
                                <span>کدملی: <strong className="text-slate-700">{cert.nationalId}</strong></span>
                                <span>صدور: {formatDisplayDate(cert.issueDate, cert.issueTime).formatted}</span>
                                {cert.companyName && (
                                  <span className="text-teal-700 font-sans font-semibold truncate max-w-xs" title={cert.companyName}>
                                    سازمان: {cert.companyName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Actions: Swap or Remove */}
                          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                            {canModifySamples ? (
                              <>
                                <button
                                  onClick={() => setSwapModalTargetCert(cert)}
                                  className="flex items-center gap-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-semibold px-3 py-1.5 rounded-xl transition shadow-2xs cursor-pointer"
                                  title="جایگزینی این رکورد با گواهی دیگری از فایل اکسل"
                                >
                                  <Shuffle className="w-3.5 h-3.5 text-cyan-700" />
                                  <span>جایگزینی</span>
                                </button>

                                <button
                                  onClick={() => handleRemoveSample(cert.id)}
                                  className="text-slate-400 hover:text-rose-600 p-2 rounded-xl hover:bg-rose-50 transition cursor-pointer"
                                  title="حذف از نمونه بازرسی"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 text-[11px] bg-slate-100 border border-slate-200 text-slate-500 px-2.5 py-1.5 rounded-xl font-medium cursor-not-allowed"
                                title="مطابق اصل بی‌طرفی ممیزی، بازرس ارشد مجاز به جایگزینی یا حذف نمونه‌های تصادفی نیست"
                              >
                                <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                                <span>قفل بی‌طرفی ارشد</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Sub-info: Required Docs & Risk */}
                        <div className="mt-3.5 pt-3.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-slate-500 font-semibold text-[11px]">مدارک الزامی مطالبه‌شده:</span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {requiredDocs.map(doc => (
                                <span key={doc} className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md text-[10px] font-semibold">
                                  {getDocTypeTitle(doc)}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-slate-500 text-[11px] font-semibold">شاخص ریسک:</span>
                            <span className={`px-2.5 py-0.5 rounded-full font-black font-mono text-[11px] border ${
                              cert.riskScore >= 70 ? 'bg-rose-50 text-rose-700 border-rose-300' :
                              cert.riskScore >= 40 ? 'bg-amber-50 text-amber-700 border-amber-300' :
                              'bg-emerald-50 text-emerald-700 border-emerald-300'
                            }`}>
                              {cert.riskScore} از ۱۰۰
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Full Pool Explorer View */}
          {activeTab === 'FULL_POOL' && (
            <div className="space-y-4">
              {/* Pool Filters */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-3 shadow-xs">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                  <input
                    type="text"
                    value={poolSearchQuery}
                    onChange={(e) => setPoolSearchQuery(e.target.value)}
                    placeholder="جستجو در نام متقاضی، کدملی، سریال یا شرکت..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pr-10 pl-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 shadow-2xs"
                  />
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <select
                    value={filterDepType}
                    onChange={(e) => setFilterDepType(e.target.value)}
                    className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none shadow-2xs"
                  >
                    <option value="ALL">همه انواع وابستگی</option>
                    {ALL_DEPENDENCY_TYPES.map(t => (
                      <option key={t} value={t}>{getDependencyTypeTitle(t)}</option>
                    ))}
                  </select>

                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none shadow-2xs"
                  >
                    <option value="ALL">همه وضعیت‌ها</option>
                    <option value="VALID">معتبر</option>
                    <option value="REVOKED">ابطال</option>
                    <option value="NOT_ACCEPTED">پذیرش نشده</option>
                    <option value="EXPIRED">منقضی</option>
                  </select>
                </div>
              </div>

              {/* Table of Pool */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                <div className="overflow-x-auto max-h-[520px]">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="p-3.5">ردیف</th>
                        <th className="p-3.5">متقاضی / شرکت</th>
                        <th className="p-3.5">نوع وابستگی ۵‌گانه</th>
                        <th className="p-3.5">وضعیت</th>
                        <th className="p-3.5">تاریخ صدور</th>
                        <th className="p-3.5">ریسک</th>
                        <th className="p-3.5">وضعیت در نمونه</th>
                        <th className="p-3.5 text-center">عملیات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {filteredPool.map((record, index) => {
                        const inSample = isSelected(record.id);

                        return (
                          <tr key={record.id} className={`hover:bg-slate-50 transition ${inSample ? 'bg-emerald-50/50' : ''}`}>
                            <td className="p-3.5 font-mono text-slate-500 font-bold">{index + 1}</td>
                            <td className="p-3.5">
                              <div className="font-bold text-slate-900">{record.applicantName}</div>
                              <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                                <span>کدملی: {record.nationalId}</span>
                                {record.companyName && (
                                  <span className="text-teal-700 truncate max-w-[130px]" title={record.companyName}>
                                    • {record.companyName}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-3.5">
                              <span className="text-slate-700 text-[11px] font-semibold">
                                {getDependencyTypeTitle(record.dependencyType)}
                              </span>
                            </td>
                            <td className="p-3.5">
                              <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${
                                record.status === 'REVOKED' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}>
                                {getCertificateStatusTitle(record.status)}
                              </span>
                            </td>
                            <td className="p-3.5 font-mono">
                              <div className="font-semibold text-slate-900">{formatDisplayDate(record.issueDate, record.issueTime).date}</div>
                              <div className="text-[10px] text-slate-500">{formatDisplayDate(record.issueDate, record.issueTime).time}</div>
                            </td>
                            <td className="p-3.5 font-bold font-mono">
                              <span className={record.riskScore >= 70 ? 'text-rose-600' : 'text-slate-700'}>
                                {record.riskScore}
                              </span>
                            </td>
                            <td className="p-3.5">
                              {inSample ? (
                                <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                                  ✓ در نمونه انتخابی
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[10px] font-semibold">
                                  انتخاب نشده
                                </span>
                              )}
                            </td>
                            <td className="p-3.5 text-center">
                              {inSample ? (
                                <button
                                  onClick={() => handleRemoveSample(record.id)}
                                  className="text-rose-600 hover:text-rose-800 text-xs font-bold hover:underline cursor-pointer"
                                >
                                  حذف از نمونه
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleAddCertToSample(record)}
                                  className="flex items-center gap-1 text-emerald-700 hover:text-emerald-900 text-xs font-bold bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-3 py-1.5 rounded-xl transition mx-auto shadow-2xs cursor-pointer"
                                >
                                  <PlusCircle className="w-3.5 h-3.5" />
                                  <span>افزودن به نمونه</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ALGORITHM CUSTOMIZATION MODAL (پنجره سفارشی‌سازی پیشرفته الگوریتم) */}
      {showCustomAlgorithmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-100 text-cyan-700 flex items-center justify-center">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    تنظیم و سفارشی‌سازی پارامترهای الگوریتم نمونه‌گیری
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    تغییر حجم نمونه، شروط ۵‌گانه وابستگی، گواهی‌های ابطال و اولویت‌بندی قوانین
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCustomAlgorithmModal(false)}
                className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Scrollable */}
            <div className="overflow-y-auto flex-1 space-y-5 pr-1 pl-1">
              
              {/* Presets Row */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800 block">انتخاب الگوی سریع (Presets):</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setModalTempConfig({
                        method: 'OFFICIAL_7_RULES',
                        sampleSize: 7,
                        sampleSizeType: 'COUNT',
                        enforceDependencyCoverage: true,
                        requiredDependencyTypes: [...ALL_DEPENDENCY_TYPES],
                        enforceRevokedCoverage: true,
                        minRevokedCount: 2,
                        priorityCriteriaOrder: [...DEFAULT_PRIORITY_ORDER],
                        prioritizeOffHours: true,
                        onlyHighAssurance: false
                      });
                    }}
                    className="p-3 text-right rounded-2xl border border-emerald-300 bg-emerald-50/70 hover:bg-emerald-100/70 transition cursor-pointer"
                  >
                    <div className="text-xs font-extrabold text-emerald-900">الگوریتم مصوب ۷ گواهی</div>
                    <div className="text-[11px] text-emerald-700 mt-0.5">استاندارد بازرسی مرکز میانی عام</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setModalTempConfig({
                        ...modalTempConfig,
                        sampleSize: 10,
                        enforceDependencyCoverage: true,
                        enforceRevokedCoverage: true,
                        minRevokedCount: 3,
                        priorityCriteriaOrder: [
                          'REVOKED',
                          'INCOMPLETE_INFO',
                          'ANOMALIES',
                          'SHORT_VALIDITY',
                          'MULTI_CERT_APPLICANTS',
                          'OLDEST',
                          'NEWEST'
                        ]
                      });
                    }}
                    className="p-3 text-right rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition cursor-pointer"
                  >
                    <div className="text-xs font-extrabold text-slate-900">حالت بازرسی پرریسک</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">۱۰ گواهی + تمرکز بر ابطال و ریسک</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setModalTempConfig({
                        ...modalTempConfig,
                        sampleSize: 5,
                        enforceDependencyCoverage: false,
                        enforceRevokedCoverage: false,
                        minRevokedCount: 1,
                      });
                    }}
                    className="p-3 text-right rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition cursor-pointer"
                  >
                    <div className="text-xs font-extrabold text-slate-900">حالت سریع (۵ گواهی)</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">بدون الزام سخت‌گیرانه وابستگی</div>
                  </button>
                </div>
              </div>

              {/* 1. Target Sample Size */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">حجم نمونه انتخابی (سهمیه کل):</span>
                    <span className="text-[11px] text-slate-500">تعداد گواهی‌هایی که نهایتاً استخراج و به کارتابل دفتر فرستاده می‌شود.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max={Math.max(1, availableCertificates.length)}
                      value={modalTempConfig.sampleSize}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 7;
                        setModalTempConfig({ ...modalTempConfig, sampleSize: val });
                      }}
                      className="w-20 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-center font-black text-emerald-700 text-sm shadow-2xs"
                    />
                    <span className="text-xs text-slate-700 font-bold">گواهی</span>
                  </div>
                </div>
              </div>

              {/* 2. Dependency Types Coverage */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">الزام پوشش انواع ۵‌گانه وابستگی:</span>
                    <span className="text-[11px] text-slate-500">در صورت وجود در فایل، از هر نوع مشخص‌شده حداقل ۱ نمونه انتخاب شود.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={modalTempConfig.enforceDependencyCoverage}
                    onChange={(e) => setModalTempConfig({ ...modalTempConfig, enforceDependencyCoverage: e.target.checked })}
                    className="rounded accent-emerald-600 w-5 h-5 cursor-pointer"
                  />
                </label>
              </div>

              {/* 3. Revoked Coverage */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-900">
                    <input
                      type="checkbox"
                      checked={modalTempConfig.enforceRevokedCoverage}
                      onChange={(e) => setModalTempConfig({ ...modalTempConfig, enforceRevokedCoverage: e.target.checked })}
                      className="rounded accent-emerald-600 w-5 h-5 cursor-pointer"
                    />
                    <span>الزام پوشش گواهی‌های ابطال‌شده:</span>
                  </label>

                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-600 font-semibold text-[11px]">حداقل تعداد:</span>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={modalTempConfig.minRevokedCount}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 2;
                        setModalTempConfig({ ...modalTempConfig, minRevokedCount: val });
                      }}
                      className="w-16 bg-white border border-slate-300 rounded-xl px-2 py-1 text-center font-bold text-rose-700 text-xs shadow-2xs"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  اگر دفتر دارای گواهی ابطال باشد، اولویت انتخاب با نمونه‌های ابطال‌شده خواهد بود.
                </p>
              </div>

              {/* 4. Priority Criteria Order with Reordering */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">ترتیب اولویت‌های قوانین ۷‌گانه:</span>
                  <span className="text-[11px] text-slate-500">با دکمه‌های فلش ترتیب اولویت را تغییر دهید</span>
                </div>

                <div className="space-y-2.5">
                  {modalTempConfig.priorityCriteriaOrder.map((rule, idx) => {
                    const isExpanded = !!expandedRuleKeys[`modal-${rule}`];
                    const detail = getPriorityRuleDetails(rule);

                    return (
                      <div key={rule} className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden transition">
                        <div className="flex items-center justify-between p-3">
                          <div 
                            onClick={() => toggleRuleExpand(`modal-${rule}`)}
                            className="flex items-center gap-3 truncate flex-1 cursor-pointer hover:text-emerald-800"
                            title="مشاهده تشریح کامل نحوه محاسبه و فرمول"
                          >
                            <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-800 border border-slate-300 flex items-center justify-center font-mono font-black text-xs shrink-0">
                              {idx + 1}
                            </span>
                            <span className="text-xs text-slate-800 font-bold truncate">
                              {getPriorityRuleTitle(rule)}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shrink-0 ${
                              isExpanded ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                            }`}>
                              <BookOpen className="w-3 h-3" />
                              <span>{isExpanded ? 'بستن فرمول' : 'نحوه محاسبه'}</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0 mr-2">
                            <button
                              type="button"
                              onClick={() => handleMovePriorityInModal(idx, 'up')}
                              disabled={idx === 0}
                              className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded-lg disabled:opacity-30 transition cursor-pointer"
                              title="انتقال به اولویت بالاتر"
                            >
                              <ArrowUp className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMovePriorityInModal(idx, 'down')}
                              disabled={idx === modalTempConfig.priorityCriteriaOrder.length - 1}
                              className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded-lg disabled:opacity-30 transition cursor-pointer"
                              title="انتقال به اولویت پایین‌تر"
                            >
                              <ArrowDown className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Expandable Explanation Body in Modal */}
                        {isExpanded && (
                          <div className="p-4 bg-slate-50/80 border-t border-slate-200 text-xs space-y-3 leading-relaxed animate-in fade-in duration-200">
                            <div>
                              <span className="font-extrabold text-slate-900 block mb-1">روش استخراج و نحوه محاسبه در اکسل:</span>
                              <p className="text-slate-700 text-[11px]">{detail.calculationMethod}</p>
                            </div>

                            <div>
                              <span className="font-extrabold text-slate-900 block mb-1">فرمول / منطق فیلتر شرطی:</span>
                              <code className="text-emerald-900 bg-emerald-50 px-2.5 py-1 rounded-lg text-xs font-mono border border-emerald-200 block dir-ltr text-right">
                                {detail.formula}
                              </code>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                                <span className="font-bold text-slate-900 block text-[11px] mb-0.5">اهمیت در ممیزی و بازرسی:</span>
                                <p className="text-slate-600 text-[10px]">{detail.auditImportance}</p>
                              </div>
                              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                                <span className="font-bold text-slate-900 block text-[11px] mb-0.5">شاخص‌ها و فیلدهای اکسل:</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {detail.indicators.map((ind, i) => (
                                    <span key={i} className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-semibold border border-slate-200">
                                      {ind}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setModalTempConfig({
                    method: 'OFFICIAL_7_RULES',
                    sampleSize: 7,
                    sampleSizeType: 'COUNT',
                    enforceDependencyCoverage: true,
                    requiredDependencyTypes: [...ALL_DEPENDENCY_TYPES],
                    enforceRevokedCoverage: true,
                    minRevokedCount: 2,
                    priorityCriteriaOrder: [...DEFAULT_PRIORITY_ORDER],
                    prioritizeOffHours: true,
                    onlyHighAssurance: false
                  });
                }}
                className="text-xs text-slate-600 hover:text-slate-900 font-bold underline cursor-pointer"
              >
                بازنشانی به پیش‌فرض رسمی
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCustomAlgorithmModal(false)}
                  className="px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-100 rounded-xl font-bold transition cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleSaveModalCustomization}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm transition cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>اعمال تنظیمات و بازتولید نمونه</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* SWAP MODAL */}
      {swapModalTargetCert && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Shuffle className="w-4 h-4 text-cyan-600" />
                  <span>جایگزینی گواهی در نمونه بازرسی</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  گواهی فعلی: <strong className="text-slate-900">{swapModalTargetCert.applicantName}</strong> ({getDependencyTypeTitle(swapModalTargetCert.dependencyType)})
                </p>
              </div>
              <button
                onClick={() => setSwapModalTargetCert(null)}
                className="text-slate-400 hover:text-slate-700 text-xs font-bold p-1 rounded-lg cursor-pointer"
              >
                انصراف و بستن
              </button>
            </div>

            <div className="text-xs text-slate-700 font-semibold">
              یک گواهی جایگزین از بانک گواهی‌های اکسل انتخاب نمایید:
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-slate-100 border border-slate-200 rounded-2xl bg-slate-50/50">
              {availableCertificates
                .filter(c => !isSelected(c.id))
                .map((cert) => (
                  <div
                    key={cert.id}
                    onClick={() => handlePerformSwap(swapModalTargetCert.id, cert)}
                    className="p-3.5 hover:bg-white cursor-pointer transition flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{cert.applicantName}</div>
                      <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                        <span>کدملی: {cert.nationalId}</span>
                        <span>{getDependencyTypeTitle(cert.dependencyType)}</span>
                        <span className={cert.status === 'REVOKED' ? 'text-rose-700 font-bold' : 'text-emerald-700 font-semibold'}>
                          {getCertificateStatusTitle(cert.status)}
                        </span>
                      </div>
                    </div>

                    <button
                      className="bg-cyan-700 hover:bg-cyan-800 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 shadow-2xs cursor-pointer"
                    >
                      انتخاب برای جایگزینی
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* DISPATCH CONFIRMATION MODAL WITH PER-CERTIFICATE DOCUMENT SELECTION */}
      {showDispatchModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-4xl w-full p-6 sm:p-7 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            {isDispatchedSuccess ? (
              <div className="text-center py-10 space-y-3">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-sm">
                  <Check className="w-9 h-9" />
                </div>
                <h3 className="text-lg font-black text-slate-900">دوره بازرسی با مدارک سفارشی با موفقیت به کارتابل دفتر ابلاغ گردید</h3>
                <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
                  تعداد {samplingResult?.sampleCount} گواهی به همراه فهرست اسناد الزامی و توضیحات بازرس به دفتر {currentOffice.name} ارسال شد. در حال انتقال به کارتابل دفتر...
                </p>
              </div>
            ) : (
              <>
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                      <FileCheck className="w-5 h-5 text-emerald-700" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900">
                        تعیین مدارک الزامی و ابلاغ بازرسی به دفتر
                      </h3>
                      <p className="text-xs text-slate-500">
                        دفتر مخاطب: <strong className="text-slate-800 font-sans">{currentOffice.name} ({currentOffice.code})</strong>
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowDispatchModal(false)}
                    className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Sub Tabs: Documents vs Campaign Details */}
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <button
                    type="button"
                    onClick={() => setDispatchActiveTab('DOCUMENTS')}
                    className={`flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer ${
                      dispatchActiveTab === 'DOCUMENTS'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    <span>۱. تعیین مدارک الزامی هر گواهی ({samplingResult?.selectedRecords?.length || 0} پرونده)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDispatchActiveTab('GENERAL')}
                    className={`flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer ${
                      dispatchActiveTab === 'GENERAL'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    <span>۲. مشخصات ابلاغ و مهلت پاسخ</span>
                  </button>
                </div>

                {/* Modal Body: Scrollable */}
                <div className="overflow-y-auto flex-1 space-y-4 pr-1 pl-1">
                  {dispatchActiveTab === 'DOCUMENTS' && (
                    <div className="space-y-4">
                      {/* Notice Banner */}
                      <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-950 space-y-1.5">
                        <div className="flex items-center gap-2 font-black text-emerald-900">
                          <Sparkles className="w-4 h-4 text-amber-500" />
                          <span>راهنمای تعیین اسناد قبل از ارسال به کارتابل:</span>
                        </div>
                        <p className="leading-relaxed text-[11px] text-slate-700">
                          • <strong>فرم پذیرش</strong> برای کلیه گواهی‌ها به صورت پیش‌فرض انتخاب شده است.<br />
                          • برای سایر مدارک (مانند معرفینامه، آگهی تاسیس، روزنامه رسمی یا درخواست ابطال)، می‌توانید چک‌باکس مربوطه را فعال کرده و <strong>علت یا ضرورت درخواست مدرک</strong> را جهت نمایش در کارتابل دفتر ثبت نمایید.
                        </p>
                      </div>

                      {/* List of Certificates in Sample */}
                      <div className="space-y-4">
                        {samplingResult.selectedRecords.map((cert, idx) => {
                          const config = certDocConfigs[cert.id] || { requiredDocs: ['APPLICATION_FORM'], docReasons: {} };
                          const currentRequiredDocs = config.requiredDocs;

                          return (
                            <div
                              key={cert.id}
                              className="border border-slate-200 rounded-2xl p-4 bg-white shadow-xs space-y-3.5 hover:border-slate-300 transition"
                            >
                              {/* Certificate Header Bar */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                                <div className="flex items-center gap-2.5">
                                  <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-800 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                                    {idx + 1}
                                  </span>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-extrabold text-sm text-slate-900">{cert.applicantName}</span>
                                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                                        cert.status === 'REVOKED' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      }`}>
                                        {getCertificateStatusTitle(cert.status)}
                                      </span>
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-800 border border-cyan-200 font-bold">
                                        {getDependencyTypeTitle(cert.dependencyType)}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-slate-500 font-mono flex items-center gap-3 mt-0.5">
                                      <span>سریال گواهی: <strong className="text-slate-800">{cert.serialNumber}</strong></span>
                                      <span>کدملی: <strong className="text-slate-700">{cert.nationalId}</strong></span>
                                      {cert.companyName && <span>شرکت: <strong className="text-slate-700 font-sans">{cert.companyName}</strong></span>}
                                    </div>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleResetCertDocsToDefault(cert)}
                                  className="text-[11px] text-slate-500 hover:text-emerald-700 underline font-medium self-end sm:self-center cursor-pointer"
                                >
                                  تطبیق پیش‌فرض وابستگی
                                </button>
                              </div>

                              {/* Documents Selection Checklist */}
                              <div className="space-y-2.5">
                                <span className="text-[11px] font-bold text-slate-800 block">
                                  مدارک مورد نیاز جهت مطالبه از دفتر:
                                </span>

                                <div className="grid grid-cols-1 gap-2.5">
                                  {ALL_SYSTEM_DOCUMENT_TYPES.map(docMeta => {
                                    const isChecked = currentRequiredDocs.includes(docMeta.type);
                                    const isAppForm = docMeta.type === 'APPLICATION_FORM';
                                    const reason = config.docReasons?.[docMeta.type] || '';

                                    return (
                                      <div
                                        key={docMeta.type}
                                        className={`rounded-xl border p-3 transition ${
                                          isChecked
                                            ? 'bg-slate-50 border-slate-300'
                                            : 'bg-white border-slate-200 opacity-80'
                                        }`}
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <label className="flex items-start gap-2.5 cursor-pointer flex-1">
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={() => handleToggleDocForCert(cert.id, docMeta.type)}
                                              className="mt-0.5 rounded accent-emerald-600 w-4 h-4 cursor-pointer"
                                            />
                                            <div>
                                              <div className="flex items-center gap-2">
                                                <span className="text-xs font-extrabold text-slate-900">
                                                  {docMeta.label}
                                                </span>
                                                {isAppForm && (
                                                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.2 rounded-full">
                                                    پیش‌فرض الزامی
                                                  </span>
                                                )}
                                              </div>
                                              <p className="text-[11px] text-slate-500 mt-0.5">{docMeta.desc}</p>
                                            </div>
                                          </label>
                                        </div>

                                        {/* Reason Input Box when document is checked */}
                                        {isChecked && (
                                          <div className="mt-2.5 pt-2 border-t border-slate-200/70">
                                            <label className="text-[10px] font-bold text-slate-700 block mb-1">
                                              علت / ضرورت درخواست مدرک توسط بازرس (اختیاری):
                                            </label>
                                            <input
                                              type="text"
                                              value={reason}
                                              onChange={(e) => handleUpdateDocReason(cert.id, docMeta.type, e.target.value)}
                                              placeholder={
                                                isAppForm 
                                                  ? 'فرم درخواست و پذیرش امضا شده متقاضی...' 
                                                  : docMeta.type === 'LEGAL_INTRO_LETTER'
                                                  ? 'علت مطالبه معرفینامه (مثلاً: نماینده حقوقی سازمان)...'
                                                  : docMeta.type === 'REVOCATION_REQUEST'
                                                  ? 'بررسی علت و درخواست کتبی ابطال گواهی...'
                                                  : 'توضیح علت درخواست این مدرک را یادداشت فرمایید...'
                                              }
                                              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 shadow-2xs"
                                            />
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {dispatchActiveTab === 'GENERAL' && (
                    <div className="space-y-4 text-xs">
                      <div>
                        <label className="text-slate-800 font-bold block mb-1.5">عنوان دوره بازرسی:</label>
                        <input
                          type="text"
                          value={campaignTitle}
                          onChange={(e) => setCampaignTitle(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-semibold focus:outline-none focus:border-emerald-500 shadow-2xs"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-slate-800 font-bold block mb-1.5">دفتر مخاطب:</label>
                          <input
                            type="text"
                            disabled
                            value={currentOffice.name}
                            className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 text-slate-600 font-bold truncate"
                          />
                        </div>
                        <div>
                          <label className="text-slate-800 font-bold block mb-1.5">مهلت ارسال مدارک (روز):</label>
                          <input
                            type="number"
                            value={deadlineDays}
                            onChange={(e) => setDeadlineDays(parseInt(e.target.value, 10))}
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-semibold shadow-2xs"
                            placeholder="تعداد روز"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-slate-800 font-bold block mb-1.5">نام بازرس / سرپرست هیئت:</label>
                        <input
                          type="text"
                          value={inspectorName}
                          onChange={(e) => setInspectorName(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-semibold shadow-2xs"
                        />
                      </div>

                      <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 text-emerald-950 space-y-1.5">
                        <p className="font-extrabold text-emerald-900">خلاصه ابلاغیه بازرسی بر اساس الگوریتم:</p>
                        <p>• تعداد {samplingResult?.sampleCount} گواهی صادر شده با پوشش کامل انواع وابستگی و وضعیت‌ها انتخاب شد.</p>
                        <p>• دفتر موظف است حداکثر ظرف {deadlineDays} روز مدارک هویتی مشخص‌شده را در کارتابل دفتر بارگذاری نماید.</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <div className="text-xs text-slate-500 font-medium">
                    {dispatchActiveTab === 'DOCUMENTS' ? (
                      <button
                        type="button"
                        onClick={() => setDispatchActiveTab('GENERAL')}
                        className="text-emerald-700 hover:text-emerald-800 font-bold underline cursor-pointer"
                      >
                        گام بعدی: تنظیم عنوان و مهلت بازرسی ←
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDispatchActiveTab('DOCUMENTS')}
                        className="text-slate-600 hover:text-slate-900 font-bold underline cursor-pointer"
                      >
                        ← بازگشت به تنظیم مدارک
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setShowDispatchModal(false)}
                      className="px-4 py-2 text-xs text-slate-600 hover:text-slate-900 font-bold transition cursor-pointer"
                    >
                      انصراف
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmDispatch}
                      disabled={isAlreadyDispatched}
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-4 h-4" />
                      <span>{isAlreadyDispatched ? 'قبلاً ابلاغ گردیده است' : 'تایید و ارسال نهایی به کارتابل دفتر'}</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
