import React, { useState, useRef, useEffect } from 'react';
import { 
  Inbox, 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Eye, 
  EyeOff,
  Trash2, 
  Send, 
  Paperclip, 
  Building2, 
  Check,
  FileCheck,
  User,
  ShieldAlert,
  ArrowLeft,
  X,
  Maximize2,
  HardDrive,
  ExternalLink,
  ShieldCheck,
  Edit3,
  SlidersHorizontal,
  Filter,
  List,
  LayoutGrid,
  Search,
  Info,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Save,
  FileUp,
  MoreVertical,
  ChevronRight,
  RefreshCw,
  FolderOpen
} from 'lucide-react';
import { 
  AuditCampaign, 
  AuditInspectionRecord, 
  UploadedDocument, 
  DocumentType, 
  OfficeProfile, 
  OfficeManager, 
  OfficeTypeDefinition, 
  FormFieldSetting, 
  CaseNoteEntry 
} from '../types';
import { getDocTypeTitle, getDependencyTypeTitle, getCertificateStatusTitle, deduplicateAuditRecords } from '../utils/samplingEngine';
import { formatDisplayDate, getCertificateTypeTitle, getCertificateDates, getDisplayDependencyTitle } from '../utils/dateFormatter';
import { DocumentViewerModal } from './DocumentViewerModal';
import { CertificateDetailsModal } from './CertificateDetailsModal';
import { uploadDocumentToGoogleDrive } from '../utils/googleDriveService';
import { OfficeKartableProfileModal } from './OfficeKartableProfileModal';
import { CaseNotesHistoryPanel } from './CaseNotesHistoryPanel';
import { DEFAULT_FORM_FIELD_SETTINGS } from '../utils/auditTimelineLogger';
import { AppUser } from '../types/auth';
import { logUserAccessAction, getUserPermissions, isPrivilegedUser, isStrictOfficeBoundUser, normalizeDigits } from '../services/authService';
import { getEffectiveInspectorNameForOffice } from '../services/systemSettingsService';

interface OfficeKartableProps {
  campaigns: AuditCampaign[];
  selectedOfficeCode: string;
  onSelectOfficeCode?: (code: string) => void;
  offices: OfficeProfile[];
  managers?: OfficeManager[];
  officeTypes?: OfficeTypeDefinition[];
  fieldSettings?: FormFieldSetting[];
  currentUser?: AppUser | null;
  onUpdateRecord: (updatedRecord: AuditInspectionRecord) => void;
  onUpdateOffice?: (updatedOffice: OfficeProfile) => void;
  onUpdateManager?: (updatedManager: OfficeManager) => void;
  onNavigateToInspectorReview: () => void;
}

export const OfficeKartable: React.FC<OfficeKartableProps> = ({
  campaigns,
  selectedOfficeCode,
  onSelectOfficeCode,
  offices,
  managers = [],
  officeTypes = [],
  fieldSettings = DEFAULT_FORM_FIELD_SETTINGS,
  currentUser,
  onUpdateRecord,
  onUpdateOffice,
  onUpdateManager,
  onNavigateToInspectorReview,
}) => {
  const normCode = (c?: string | number | null) => normalizeDigits(String(c || '')).trim().toLowerCase();
  const currentOffice = offices.find(o => 
    normCode(o.code) === normCode(selectedOfficeCode) || 
    normCode(o.id) === normCode(selectedOfficeCode)
  ) || offices[0];

  const currentManager = managers.find(m => 
    normCode(m.assignedOfficeCode || (m as any).officeCode) === normCode(currentOffice?.code) || 
    normCode(m.managerCode || m.id) === normCode(currentOffice?.managerId)
  ) || null;
  
  const perms = getUserPermissions(currentUser);
  const isStrictOffice = isStrictOfficeBoundUser(currentUser);
  const isPrivileged = isPrivilegedUser(currentUser);
  // امکان جابجایی و انتخاب دفاتر فعال جهت بازرسی و مدیریت
  const canSwitchOffices = true;

  // Selected office code normalized
  const targetCode = String(currentOffice?.code || selectedOfficeCode || '').trim();

  // Extract all records across campaigns strictly filtered by this office code
  const rawRecords = React.useMemo(() => {
    const matched: AuditInspectionRecord[] = [];
    campaigns.forEach(c => {
      const campOfficeCode = String(c.officeCode || c.officeId || '').trim();
      (c.records || []).forEach(r => {
        const recordOfficeCode = String(r.officeCode || r.certificate?.officeCode || campOfficeCode).trim();
        // If this record belongs to the target office code
        if (recordOfficeCode === targetCode || (!recordOfficeCode && campOfficeCode === targetCode)) {
          matched.push({
            ...r,
            campaignId: r.campaignId || c.id,
            campaignTitle: r.campaignTitle || c.title,
            officeCode: recordOfficeCode || targetCode,
            officeName: r.officeName || r.certificate?.officeName || c.officeName || currentOffice?.name,
            certificate: {
              ...r.certificate,
              officeCode: recordOfficeCode || targetCode,
              officeName: r.certificate?.officeName || r.officeName || c.officeName || currentOffice?.name,
            }
          });
        }
      });
    });
    return matched;
  }, [campaigns, targetCode, currentOffice?.name]);

  // Deduplicate records for this office
  const allRecords = React.useMemo(() => {
    return deduplicateAuditRecords(rawRecords);
  }, [rawRecords]);

  // Office Name: strictly use the official registered office profile name
  const displayOfficeName = currentOffice?.name || `دفتر پیشخوان خدمات دولت کد ${targetCode}`;

  const [selectedRecord, setSelectedRecord] = useState<AuditInspectionRecord | null>(null);
  const [certDetailsRecord, setCertDetailsRecord] = useState<AuditInspectionRecord | null>(null);
  const [modalViewerDoc, setModalViewerDoc] = useState<UploadedDocument | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'ROWS' | 'GRID'>('ROWS');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [openRowActionMenuId, setOpenRowActionMenuId] = useState<string | null>(null);

  // Office Switcher Modal state
  const [isOfficeSwitchModalOpen, setIsOfficeSwitchModalOpen] = useState<boolean>(false);
  const [officeSearchQuery, setOfficeSearchQuery] = useState<string>('');

  // Profile modal state
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);

  // Collapsible guide state - collapsed by default for clean enterprise feel
  const [isProcessGuideOpen, setIsProcessGuideOpen] = useState<boolean>(false);

  // Track office user entering kartable
  React.useEffect(() => {
    if (currentUser) {
      logUserAccessAction(currentUser, 'VIEW_NOTIFICATIONS', `ورود به کارتابل دفتر و مشاهده پرونده‌ها (کد دفتر: ${selectedOfficeCode})`);
    }
  }, [selectedOfficeCode]);

  // Close row action dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenRowActionMenuId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // Draft upload state for the modal
  const [officeNotesDraft, setOfficeNotesDraft] = useState('');
  const [activeUploadDocType, setActiveUploadDocType] = useState<DocumentType>('APPLICATION_FORM');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccessMessage, setSubmitSuccessMessage] = useState(false);

  // Toast notifications
  const [draftSavedToast, setDraftSavedToast] = useState<string | null>(null);
  const [lastUploadedDocNotice, setLastUploadedDocNotice] = useState<string | null>(null);

  // Incomplete confirmation dialog inside/outside upload modal
  const [showIncompleteConfirmModal, setShowIncompleteConfirmModal] = useState<boolean>(false);
  const [recordForIncompleteSubmit, setRecordForIncompleteSubmit] = useState<AuditInspectionRecord | null>(null);

  // Bulk submit modal
  const [isBulkSubmitModalOpen, setIsBulkSubmitModalOpen] = useState<boolean>(false);
  const [isBulkSubmitting, setIsBulkSubmitting] = useState<boolean>(false);

  // Record inspector resolver with admin visibility toggle applied
  const getRecordInspectorName = (record?: AuditInspectionRecord | null): string => {
    let rawName = 'مهندس حسینی (سرپرست بازرسی مرکز میانی عام)';
    if (record?.level1InspectorName) {
      rawName = record.level1InspectorName;
    } else if (record?.campaignId) {
      const camp = campaigns.find(c => c.id === record.campaignId);
      if (camp?.inspectorName) rawName = camp.inspectorName;
    }
    return getEffectiveInspectorNameForOffice(rawName);
  };

  const officeAssignedInspector = React.useMemo(() => {
    const camp = campaigns.find(c => String(c.officeCode || '').trim() === targetCode && c.inspectorName);
    const raw = camp?.inspectorName || 'مهندس حسینی (سرپرست بازرسی مرکز میانی عام)';
    return getEffectiveInspectorNameForOffice(raw);
  }, [campaigns, targetCode]);

  // Staged / Draft records (records with uploaded documents but not yet submitted to inspector)
  const draftRecords = React.useMemo(() => {
    return allRecords.filter(
      r => r.status === 'PENDING_UPLOAD' && (r.uploadedDocuments?.length || 0) > 0
    );
  }, [allRecords]);

  // Open modal for a specific record
  const handleOpenUploadModal = (record: AuditInspectionRecord) => {
    setSelectedRecord(record);
    setOfficeNotesDraft(record.officeNotes || '');
    setSubmitSuccessMessage(false);
  };

  // Handle adding new note to record
  const handleAddNoteToRecord = (newNote: CaseNoteEntry) => {
    if (!selectedRecord) return;
    const updatedHistory = [...(selectedRecord.notesHistory || []), newNote];
    const updatedRecord: AuditInspectionRecord = {
      ...selectedRecord,
      notesHistory: updatedHistory,
      officeNotes: newNote.text,
    };
    setSelectedRecord(updatedRecord);
    setOfficeNotesDraft(newNote.text);
    onUpdateRecord(updatedRecord);
  };

  // Save profile and manager updates from modal
  const handleSaveProfile = (updatedOffice: OfficeProfile, updatedManager: OfficeManager | null) => {
    if (onUpdateOffice) onUpdateOffice(updatedOffice);
    if (onUpdateManager && updatedManager) onUpdateManager(updatedManager);
  };

  // Handle local file upload with Google Drive sync
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, docType: DocumentType) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedRecord) return;

    const file = files[0];
    const reader = new FileReader();

    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      const nowTimestamp = new Date().toLocaleDateString('fa-IR') + ' ' + new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

      let newDoc: UploadedDocument = {
        id: `doc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        docType,
        title: getDocTypeTitle(docType),
        fileName: file.name,
        fileType: file.type || 'application/octet-stream',
        fileSize: file.size,
        fileDataUrl: dataUrl,
        uploadDate: nowTimestamp,
        uploadedBy: `مسئول دفتر: ${currentOffice.managerName || 'دفتر ثبت‌نام'}`,
      };

      try {
        const driveRes = await uploadDocumentToGoogleDrive(newDoc, {
          officeCode: selectedRecord.officeCode || currentOffice.code,
          applicantId: selectedRecord.certificate?.nationalId || selectedRecord.certificate?.applicantName || selectedRecord.id,
          inspectionId: selectedRecord.id,
        });
        newDoc.fileId = driveRes.fileId;
        newDoc.storageProvider = driveRes.storageProvider;
        newDoc.storageKey = driveRes.storageKey;
        newDoc.storageFileName = driveRes.storageFileName;
        newDoc.checksum = driveRes.checksum;
        newDoc.driveFileId = driveRes.driveFileId;
        newDoc.driveWebViewLink = driveRes.viewUrl || driveRes.driveWebViewLink;
        newDoc.driveDownloadUrl = driveRes.downloadUrl;
        newDoc.driveSynced = driveRes.syncStatus === 'uploaded' || (driveRes.syncStatus as string) === 'SUCCESS';
        newDoc.syncStatus = driveRes.syncStatus === 'uploaded' ? 'uploaded' : 'pending';
        newDoc.syncErrorMessage = driveRes.errorMessage;
        newDoc.driveSyncDate = new Date().toLocaleDateString('fa-IR');
      } catch (err: any) {
        console.warn('Storage upload fallback in kartable', err);
        newDoc.syncStatus = 'failed';
        newDoc.syncErrorMessage = err.message || 'خطا در ارتباط با سرویس ذخیره‌سازی';
      }

      const updatedDocs = [
        ...(selectedRecord.uploadedDocuments || []).filter(d => d.docType !== docType),
        newDoc
      ];

      const updatedRecord: AuditInspectionRecord = {
        ...selectedRecord,
        uploadedDocuments: updatedDocs,
        status: selectedRecord.status === 'APPROVED' ? selectedRecord.status : 'PENDING_UPLOAD',
      };

      setSelectedRecord(updatedRecord);
      onUpdateRecord(updatedRecord);

      setLastUploadedDocNotice(`مدرک «${getDocTypeTitle(docType)}» با موفقیت ذخیره شد.`);
      setTimeout(() => {
        setLastUploadedDocNotice(null);
      }, 4000);
    };

    reader.readAsDataURL(file);
  };

  // Remove a document
  const handleRemoveDoc = (docId: string) => {
    if (!selectedRecord) return;
    const updatedDocs = (selectedRecord.uploadedDocuments || []).filter(d => d.id !== docId);
    const updatedRecord: AuditInspectionRecord = {
      ...selectedRecord,
      uploadedDocuments: updatedDocs,
    };
    setSelectedRecord(updatedRecord);
    onUpdateRecord(updatedRecord);
  };

  // Core execution of submission to inspector
  const executeSubmitRecord = (recordToSubmit: AuditInspectionRecord, customNotes?: string) => {
    setIsSubmitting(true);
    const targetInspector = getRecordInspectorName(recordToSubmit);
    const nowTimestamp = new Date().toLocaleDateString('fa-IR') + ' ' + new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

    const submissionNote: CaseNoteEntry = {
      id: `note-sub-${Date.now()}`,
      authorRole: 'OFFICE_USER',
      authorName: currentOffice.managerName ? `مسئول دفتر: ${currentOffice.managerName}` : 'دفتر ثبت‌نام',
      text: customNotes || officeNotesDraft || `ارسال مدارک هویتی متقاضی (${recordToSubmit.uploadedDocuments?.length || 0} مدرک) به کارشناس بازرسی (${targetInspector})`,
      timestamp: nowTimestamp,
      statusAtTime: 'UPLOADED',
      actionType: 'DOC_UPLOAD',
    };

    const updatedHistory = [...(recordToSubmit.notesHistory || []), submissionNote];

    const updatedRecord: AuditInspectionRecord = {
      ...recordToSubmit,
      status: 'UPLOADED',
      submittedAt: nowTimestamp,
      officeNotes: customNotes || officeNotesDraft,
      notesHistory: updatedHistory,
      level1InspectorName: recordToSubmit.level1InspectorName || targetInspector,
    };

    onUpdateRecord(updatedRecord);
    if (selectedRecord && selectedRecord.id === recordToSubmit.id) {
      setSelectedRecord(updatedRecord);
    }
    setIsSubmitting(false);
    setSubmitSuccessMessage(true);

    setTimeout(() => {
      setSelectedRecord(null);
      setSubmitSuccessMessage(false);
      setShowIncompleteConfirmModal(false);
      setRecordForIncompleteSubmit(null);
    }, 1200);
  };

  // Submit to Inspector from modal
  const handleSubmitToInspector = () => {
    if (!selectedRecord) return;
    const reqCount = selectedRecord.requiredDocuments.length;
    const upCount = selectedRecord.uploadedDocuments?.length || 0;

    if (upCount === 0) return;

    if (upCount < reqCount) {
      setRecordForIncompleteSubmit(selectedRecord);
      setShowIncompleteConfirmModal(true);
      return;
    }

    executeSubmitRecord(selectedRecord);
  };

  // Quick submit from table row or card
  const handleQuickSubmit = (record: AuditInspectionRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const reqCount = record.requiredDocuments.length;
    const upCount = record.uploadedDocuments?.length || 0;

    if (upCount === 0) {
      handleOpenUploadModal(record);
      return;
    }

    if (upCount < reqCount) {
      setRecordForIncompleteSubmit(record);
      setShowIncompleteConfirmModal(true);
      return;
    }

    executeSubmitRecord(record);
  };

  // Bulk submit all staged/draft records
  const handleConfirmBulkSubmit = () => {
    setIsBulkSubmitting(true);
    const nowTimestamp = new Date().toLocaleDateString('fa-IR') + ' ' + new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

    draftRecords.forEach(rec => {
      const targetInspector = getRecordInspectorName(rec);
      const submissionNote: CaseNoteEntry = {
        id: `note-bulk-${Date.now()}-${rec.id}`,
        authorRole: 'OFFICE_USER',
        authorName: currentOffice.managerName ? `مسئول دفتر: ${currentOffice.managerName}` : 'دفتر ثبت‌نام',
        text: `ارسال دسته‌جمعی پرونده به کارشناس بازرسی (${targetInspector}) با ${rec.uploadedDocuments?.length || 0} مدرک پیوست`,
        timestamp: nowTimestamp,
        statusAtTime: 'UPLOADED',
        actionType: 'DOC_UPLOAD',
      };

      const updatedRecord: AuditInspectionRecord = {
        ...rec,
        status: 'UPLOADED',
        submittedAt: nowTimestamp,
        notesHistory: [...(rec.notesHistory || []), submissionNote],
        level1InspectorName: rec.level1InspectorName || targetInspector,
      };

      onUpdateRecord(updatedRecord);
    });

    setIsBulkSubmitting(false);
    setIsBulkSubmitModalOpen(false);
    setDraftSavedToast(`تعداد ${draftRecords.length} پرونده با موفقیت به کارشناس بازرسی ارسال گردید.`);
    setTimeout(() => {
      setDraftSavedToast(null);
    }, 4000);
  };

  // Filter records
  const filteredRecords = allRecords.filter(r => {
    if (filterStatus === 'DRAFTS' && !(r.status === 'PENDING_UPLOAD' && (r.uploadedDocuments?.length || 0) > 0)) return false;
    if (filterStatus === 'PENDING' && r.status !== 'PENDING_UPLOAD') return false;
    if (filterStatus === 'RETURNED' && r.status !== 'RETURNED_TO_OFFICE') return false;
    if (filterStatus === 'UPLOADED' && !(r.status === 'UPLOADED' || r.status === 'REFERRED_TO_SENIOR')) return false;
    if (filterStatus === 'APPROVED' && r.status !== 'APPROVED') return false;
    if (filterStatus === 'DEFECT' && !(r.status === 'DEFECT_MINOR' || r.status === 'DEFECT_MAJOR' || r.status === 'REJECTED')) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const name = (r.certificate?.applicantName || '').toLowerCase();
      const nationalId = (r.certificate?.nationalId || '').toLowerCase();
      const serial = (r.certificate?.serialNumber || '').toLowerCase();
      const tracking = (r.certificate?.trackingCode || '').toLowerCase();
      const company = (r.certificate?.companyName || '').toLowerCase();
      if (!name.includes(q) && !nationalId.includes(q) && !serial.includes(q) && !tracking.includes(q) && !company.includes(q)) {
        return false;
      }
    }

    return true;
  });

  const pendingUploadCount = allRecords.filter(r => r.status === 'PENDING_UPLOAD').length;
  const returnedToOfficeCount = allRecords.filter(r => r.status === 'RETURNED_TO_OFFICE').length;
  const uploadedCount = allRecords.filter(r => r.status === 'UPLOADED' || r.status === 'REFERRED_TO_SENIOR').length;
  const approvedCount = allRecords.filter(r => r.status === 'APPROVED').length;
  const defectCount = allRecords.filter(r => r.status === 'DEFECT_MINOR' || r.status === 'DEFECT_MAJOR' || r.status === 'REJECTED').length;

  // Filtered offices for office switcher
  const filteredOfficesForModal = offices.filter(o => {
    if (!officeSearchQuery.trim()) return true;
    const q = officeSearchQuery.trim().toLowerCase();
    return (o.name || '').toLowerCase().includes(q) || (o.code || '').toLowerCase().includes(q) || (o.city || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      {/* Global Toast */}
      {draftSavedToast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-xl px-4 py-3 shadow-sm flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-xs font-semibold">{draftSavedToast}</span>
          </div>
          <button
            onClick={() => setDraftSavedToast(null)}
            className="text-emerald-700 hover:text-emerald-950 p-1 rounded-md transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* SECTION 1: Clean, Single-Level Enterprise Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
              <span>میز کار و کارتابل‌ها</span>
              <ChevronRight className="w-3 h-3 text-slate-300" />
              <span className="text-slate-600">کارتابل دفتر ثبت‌نام</span>
            </div>
            
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              کارتابل بارگذاری اسناد دفتر
            </h1>

            <p className="text-xs text-slate-500">
              مدیریت و تکمیل مدارک پرونده‌های دفتر پیش از ارسال به بازرسی
            </p>

            {/* Selected Office Badge Row */}
            <div className="inline-flex items-center gap-2 pt-1 text-xs">
              <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-800 font-semibold px-2.5 py-1 rounded-md border border-slate-200">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                <span>{displayOfficeName}</span>
              </span>
              <span className="bg-slate-50 text-slate-600 font-mono text-[11px] px-2 py-1 rounded-md border border-slate-200">
                کد دفتر: {targetCode}
              </span>
              {currentOffice?.managerName && (
                <span className="text-slate-500 text-[11px] hidden sm:inline">
                  (مسئول: {currentOffice.managerName})
                </span>
              )}
            </div>
          </div>

          {/* Primary Operations on Opposite Side */}
          <div className="flex items-center gap-2 self-start md:self-center shrink-0 flex-wrap">
            {canSwitchOffices && onSelectOfficeCode && (
              <button
                type="button"
                onClick={() => setIsOfficeSwitchModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-300 rounded-lg text-xs font-semibold transition shadow-2xs cursor-pointer"
                title="تغییر دفتر فعال جهت مشاهده و مدیریت پرونده‌ها"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                <span>تغییر دفتر</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-300 rounded-lg text-xs font-semibold transition shadow-2xs cursor-pointer"
              title="مشاهده اطلاعات ثبتی و مشخصات مسئول دفتر"
            >
              <Edit3 className="w-3.5 h-3.5 text-slate-500" />
              <span>مشاهده مشخصات دفتر</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 2: Low-Profile Status Summary Bar (4 Balanced Blocks) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Total */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 sm:px-4 sm:py-3 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 block">کل پرونده‌ها</span>
            <span className="text-base sm:text-lg font-bold text-slate-800 font-mono mt-0.5 block">
              {allRecords.length}
            </span>
          </div>
          <span className="text-slate-400 text-xs">مورد</span>
        </div>

        {/* Needs Completion (Warning/Amber Tint) */}
        <div className={`border rounded-xl p-3 sm:px-4 sm:py-3 shadow-2xs flex items-center justify-between ${
          pendingUploadCount > 0 ? 'bg-amber-50/40 border-amber-200 text-amber-950' : 'bg-white border-slate-200 text-slate-800'
        }`}>
          <div>
            <span className="text-[11px] font-medium text-amber-800 block">نیازمند تکمیل مدارک</span>
            <span className="text-base sm:text-lg font-bold text-amber-900 font-mono mt-0.5 block">
              {pendingUploadCount}
            </span>
          </div>
          {pendingUploadCount > 0 ? (
            <span className="text-[10px] font-semibold text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded">اقدام</span>
          ) : (
            <span className="text-slate-400 text-xs">تکمیل</span>
          )}
        </div>

        {/* Submitted to Inspector */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 sm:px-4 sm:py-3 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 block">ارسال‌شده به بازرسی</span>
            <span className="text-base sm:text-lg font-bold text-slate-800 font-mono mt-0.5 block">
              {uploadedCount}
            </span>
          </div>
          <span className="text-slate-400 text-xs">در جریان</span>
        </div>

        {/* Approved (Gentle Emerald Tint) */}
        <div className={`border rounded-xl p-3 sm:px-4 sm:py-3 shadow-2xs flex items-center justify-between ${
          approvedCount > 0 ? 'bg-emerald-50/40 border-emerald-200 text-emerald-950' : 'bg-white border-slate-200 text-slate-800'
        }`}>
          <div>
            <span className="text-[11px] font-medium text-emerald-800 block">تأییدشده</span>
            <span className="text-base sm:text-lg font-bold text-emerald-900 font-mono mt-0.5 block">
              {approvedCount}
            </span>
          </div>
          <span className="text-slate-400 text-xs">نهایی</span>
        </div>
      </div>

      {/* SECTION 3: Collapsible Process Guide */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
        <button
          type="button"
          onClick={() => setIsProcessGuideOpen(!isProcessGuideOpen)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-right text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-700">راهنمای بارگذاری مدارک و فرآیند بازرسی</span>
            <span className="text-[11px] text-slate-400 hidden sm:inline">• کلیک جهت مشاهده مراحل</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
              کارشناس بازرسی شما: <strong className="text-slate-800">{officeAssignedInspector}</strong>
            </span>
            {isProcessGuideOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
          </div>
        </button>

        {isProcessGuideOpen && (
          <div className="px-4 pb-3.5 pt-2 border-t border-slate-100 text-xs text-slate-600 space-y-2 animate-in fade-in duration-150">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] leading-relaxed">
              <div className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                <span>گواهی‌های استخراج‌شده بر اساس الگوریتم ۷‌گانه بازرسی در این بخش قرار دارند.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                <span>مدارک هر پرونده را می‌توان مرحله‌به‌مرحله بارگذاری کرد و نیازی به ارسال فوری نیست.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                <span>فایل‌ها بلافاصله در پیش‌نویس موقت ذخیره شده و پس از تکمیل، پرونده برای کارشناس بازرسی ارسال می‌شود.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                <span>در صورت عودت جهت رفع نقص، تذکرات کارشناس در ردیف پرونده درج گردیده و قابل اصلاح است.</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Table Toolbar (Search, Status Dropdown Filter, View Mode, Actions) */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-2xs">
        {/* Right side: Search + Status Dropdown Filter */}
        <div className="flex items-center gap-2.5 flex-1 max-w-2xl flex-wrap sm:flex-nowrap">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="جستجو در نام، کدملی، سریال گواهی..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg pr-9 pl-7 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Dropdown Filter */}
          <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <select
              id="office-kartable-status-select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 text-slate-800 text-xs font-semibold rounded-lg px-3 py-2 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300 cursor-pointer transition shadow-2xs w-full sm:w-auto"
            >
              <option value="ALL">همه وضعیت‌ها ({allRecords.length})</option>
              <option value="PENDING">نیازمند تکمیل مدارک ({pendingUploadCount})</option>
              <option value="DRAFTS">پیش‌نویس مدارک ({draftRecords.length})</option>
              <option value="RETURNED">برگشت جهت رفع نقص ({returnedToOfficeCount})</option>
              <option value="UPLOADED">ارسال‌شده به بازرسی ({uploadedCount})</option>
              <option value="APPROVED">تأییدشده ({approvedCount})</option>
              <option value="DEFECT">عدم انطباق و تخلف ({defectCount})</option>
            </select>

            {filterStatus !== 'ALL' && (
              <button
                onClick={() => setFilterStatus('ALL')}
                className="text-[11px] text-teal-700 hover:text-teal-900 font-bold px-1.5 py-1 rounded-md hover:bg-teal-50 transition cursor-pointer shrink-0"
              >
                حذف فیلتر
              </button>
            )}
          </div>
        </div>

        {/* Left side: Actions & View Switcher */}
        <div className="flex items-center justify-between md:justify-end gap-2.5 shrink-0 flex-wrap">
          {draftRecords.length > 0 && (
            <button
              onClick={() => setIsBulkSubmitModalOpen(true)}
              className="flex items-center gap-1.5 text-xs text-white font-medium bg-emerald-700 hover:bg-emerald-800 px-3 py-1.5 rounded-lg shadow-2xs transition cursor-pointer"
              title="ارسال دسته‌جمعی پرونده‌های دارای مدرک به بازرسی"
            >
              <Send className="w-3.5 h-3.5" />
              <span>ارسال دسته‌جمعی ({draftRecords.length})</span>
            </button>
          )}

          {uploadedCount > 0 && (
            <button
              onClick={onNavigateToInspectorReview}
              className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
              title="مشاهده پرونده‌ها در پنل بازرسی"
            >
              <span>مشاهده ارزیابی بازرس</span>
              <ArrowLeft className="w-3 h-3 text-slate-400" />
            </button>
          )}

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
            نمایش: <strong className="text-slate-800 font-mono">{filteredRecords.length}</strong> پرونده
          </span>

          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
            <button
              onClick={() => setViewMode('ROWS')}
              className={`p-1.5 rounded-md transition cursor-pointer ${
                viewMode === 'ROWS'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="نمای ردیفی جدول"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('GRID')}
              className={`p-1.5 rounded-md transition cursor-pointer ${
                viewMode === 'GRID'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="نمای کارتی"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 6: Main Table (The Primary Focal Point) */}
      {filteredRecords.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2 shadow-2xs">
          <Inbox className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700">هیچ پرونده‌ای در این وضعیت یافت نشد</h3>
          <p className="text-xs text-slate-400">
            {searchQuery ? 'با عبارت جستجو شده پرونده‌ای تطابق ندارد.' : 'پرونده‌های این دفتر پس از استخراج نمونه‌گیری در اینجا نمایش داده می‌شوند.'}
          </p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="mt-1 text-xs text-slate-600 hover:text-slate-900 underline cursor-pointer"
            >
              پاک کردن فیلتر جستجو
            </button>
          )}
        </div>
      ) : viewMode === 'ROWS' ? (
        <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold select-none text-[11px]">
                  <th className="py-2.5 px-3 text-center w-12 font-mono">ردیف</th>
                  <th className="py-2.5 px-3">نوع گواهی / دارنده گواهی</th>
                  <th className="py-2.5 px-3 font-mono">سریال گواهی</th>
                  <th className="py-2.5 px-2.5 text-center">اعتبار</th>
                  <th className="py-2.5 px-3">تاریخ صدور</th>
                  <th className="py-2.5 px-3">وضعیت پرونده</th>
                  <th className="py-2.5 px-3">مدارک</th>
                  <th className="py-2.5 px-3 text-left">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((record, index) => {
                  const cert = record.certificate;
                  const certDates = getCertificateDates(cert);
                  const requiredCount = record.requiredDocuments.length;
                  const uploadedCount = record.uploadedDocuments?.length || 0;
                  const isComplete = uploadedCount >= requiredCount;
                  const isReturned = record.status === 'RETURNED_TO_OFFICE';
                  const isApproved = record.status === 'APPROVED';
                  const isUploaded = record.status === 'UPLOADED' || record.status === 'REFERRED_TO_SENIOR';
                  const isActionMenuOpen = openRowActionMenuId === record.id;

                  return (
                    <tr
                      key={record.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isReturned ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      {/* 1. Row Index */}
                      <td className="py-2.5 px-3 text-center font-mono text-slate-400 align-middle">
                        {index + 1}
                      </td>

                      {/* 2. Certificate Type & Applicant Name */}
                      <td className="py-2.5 px-3 align-middle">
                        <div className="space-y-0.5 max-w-xs sm:max-w-sm">
                          <div className="font-semibold text-slate-900 text-xs">
                            {cert.applicantName}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                            <span>{getDisplayDependencyTitle(cert)}</span>
                            {cert.companyName && (
                              <>
                                <span className="text-slate-300">•</span>
                                <span className="truncate max-w-[180px]" title={cert.companyName}>{cert.companyName}</span>
                              </>
                            )}
                          </div>
                          {isReturned && record.inspectorNotes && (
                            <div className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded mt-0.5 truncate max-w-[280px]" title={record.inspectorNotes}>
                              <strong>علت نقص:</strong> {record.inspectorNotes}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 3. Serial Number (LTR, readable font) */}
                      <td className="py-2.5 px-3 align-middle whitespace-nowrap">
                        <span className="font-mono text-xs text-slate-700 tracking-tight" dir="ltr">
                          {cert.serialNumber}
                        </span>
                      </td>

                      {/* 4. Validity Status */}
                      <td className="py-2.5 px-2.5 text-center align-middle whitespace-nowrap">
                        {cert.status === 'VALID' ? (
                          <span className="inline-block text-[11px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                            معتبر
                          </span>
                        ) : cert.status === 'REVOKED' ? (
                          <span className="inline-block text-[11px] font-medium text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md" title={cert.revocationReason || 'ابطال شده'}>
                            ابطال‌شده
                          </span>
                        ) : cert.status === 'EXPIRED' ? (
                          <span className="inline-block text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                            منقضی
                          </span>
                        ) : (
                          <span className="inline-block text-[11px] font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                            {getCertificateStatusTitle(cert.status)}
                          </span>
                        )}
                      </td>

                      {/* 5. Issue Date */}
                      <td className="py-2.5 px-3 align-middle whitespace-nowrap">
                        <span className="font-mono text-xs text-slate-600">
                          {certDates.issue.formatted}
                        </span>
                      </td>

                      {/* 6. Case Status */}
                      <td className="py-2.5 px-3 align-middle whitespace-nowrap">
                        {isApproved ? (
                          <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                            تأییدشده
                          </span>
                        ) : isReturned ? (
                          <span className="text-[11px] font-medium text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md">
                            برگشت جهت رفع نقص
                          </span>
                        ) : isUploaded ? (
                          <span className="text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                            ارسال‌شده به بازرس
                          </span>
                        ) : record.status.includes('DEFECT') ? (
                          <span className="text-[11px] font-medium text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                            عدم انطباق
                          </span>
                        ) : uploadedCount > 0 ? (
                          <span className="text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                            پیش‌نویس موقت
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                            در انتظار مدارک
                          </span>
                        )}
                      </td>

                      {/* 7. Documents Progress */}
                      <td className="py-2.5 px-3 align-middle whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-14 bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200">
                            <div
                              className={`h-full ${isComplete ? 'bg-emerald-600' : uploadedCount > 0 ? 'bg-amber-500' : 'bg-transparent'}`}
                              style={{ width: `${Math.min(100, (uploadedCount / Math.max(1, requiredCount)) * 100)}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] text-slate-600 font-medium">
                            {uploadedCount}/{requiredCount}
                          </span>
                        </div>
                      </td>

                      {/* 8. Operations Column */}
                      <td className="py-2.5 px-3 align-middle text-left whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5 relative">
                          {/* Secondary Action: View Specs */}
                          <button
                            type="button"
                            onClick={() => setCertDetailsRecord(record)}
                            className="px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-md text-xs font-medium transition cursor-pointer"
                            title="مشاهده مشخصات شناسنامه‌ای گواهی"
                          >
                            مشاهده مشخصات
                          </button>

                          {/* Primary Clear CTA: Upload / Manage Documents */}
                          <button
                            type="button"
                            onClick={() => handleOpenUploadModal(record)}
                            className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                              isReturned
                                ? 'bg-amber-700 hover:bg-amber-800 text-white'
                                : uploadedCount > 0
                                ? 'bg-slate-800 hover:bg-slate-900 text-white'
                                : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                            }`}
                          >
                            <UploadCloud className="w-3.5 h-3.5" />
                            <span>
                              {isReturned
                                ? 'رفع نقص'
                                : uploadedCount > 0
                                ? 'مدیریت مدارک'
                                : 'بارگذاری مدارک'}
                            </span>
                          </button>

                          {/* Three-Dots Menu for Tertiary Actions */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenRowActionMenuId(isActionMenuOpen ? null : record.id);
                              }}
                              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition cursor-pointer"
                              title="عملیات بیشتر"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>

                            {/* Dropdown Menu */}
                            {isActionMenuOpen && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute left-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-30 text-xs text-slate-700 animate-in fade-in zoom-in-95"
                              >
                                {uploadedCount > 0 && record.status === 'PENDING_UPLOAD' && (
                                  <button
                                    onClick={(e) => {
                                      setOpenRowActionMenuId(null);
                                      handleQuickSubmit(record, e);
                                    }}
                                    className="w-full text-right px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-emerald-700 font-medium"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                    <span>ارسال به بازرس</span>
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setOpenRowActionMenuId(null);
                                    handleOpenUploadModal(record);
                                  }}
                                  className="w-full text-right px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2"
                                >
                                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                                  <span>تاریخچه یادداشت‌ها</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setOpenRowActionMenuId(null);
                                    setCertDetailsRecord(record);
                                  }}
                                  className="w-full text-right px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2"
                                >
                                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                                  <span>شناسنامه گواهی</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Alternative Grid View (Clean, Low-Noise Cards) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredRecords.map((record) => {
            const cert = record.certificate;
            const certDates = getCertificateDates(cert);
            const requiredCount = record.requiredDocuments.length;
            const uploadedCount = record.uploadedDocuments?.length || 0;
            const isComplete = uploadedCount >= requiredCount;
            const isReturned = record.status === 'RETURNED_TO_OFFICE';

            return (
              <div
                key={record.id}
                className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs hover:border-slate-300 transition space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-slate-500 font-semibold" dir="ltr">
                      {cert.serialNumber}
                    </span>
                    {record.status === 'APPROVED' ? (
                      <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                        تأییدشده
                      </span>
                    ) : isReturned ? (
                      <span className="text-[10px] font-medium text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded">
                        رفع نقص
                      </span>
                    ) : record.status === 'UPLOADED' ? (
                      <span className="text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                        ارسال‌شده
                      </span>
                    ) : uploadedCount > 0 ? (
                      <span className="text-[10px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                        پیش‌نویس
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        در انتظار
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 truncate">
                      {cert.applicantName}
                    </h3>
                    <p className="text-xs text-slate-500 truncate">
                      {getDisplayDependencyTitle(cert)}
                      {cert.companyName ? ` • ${cert.companyName}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                    <span>تاریخ صدور: <span className="font-mono text-slate-700 font-medium">{certDates.issue.formatted}</span></span>
                    <span>مدارک: <span className="font-mono font-medium text-slate-700">{uploadedCount}/{requiredCount}</span></span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setCertDetailsRecord(record)}
                    className="flex-1 py-1.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg font-medium transition text-center"
                  >
                    مشخصات
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenUploadModal(record)}
                    className="flex-1 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition text-center"
                  >
                    {isReturned ? 'رفع نقص' : uploadedCount > 0 ? 'مدیریت مدارک' : 'بارگذاری'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: Office Switcher Modal (Clean search dialog) */}
      {isOfficeSwitchModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-5 shadow-xl space-y-4 animate-in fade-in zoom-in-95 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-600" />
                <h3 className="text-sm font-bold text-slate-900">تغییر دفتر فعال</h3>
              </div>
              <button
                onClick={() => setIsOfficeSwitchModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="جستجو در نام یا کد دفتر..."
                value={officeSearchQuery}
                onChange={(e) => setOfficeSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pr-9 pl-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400 focus:bg-white transition"
              />
            </div>

            <div className="overflow-y-auto space-y-1 flex-1 divide-y divide-slate-50 max-h-72">
              {filteredOfficesForModal.map(o => {
                const isSelected = String(o.code || '').trim() === targetCode;
                return (
                  <button
                    key={o.code}
                    type="button"
                    onClick={() => {
                      if (onSelectOfficeCode) onSelectOfficeCode(o.code);
                      setIsOfficeSwitchModalOpen(false);
                    }}
                    className={`w-full text-right p-2.5 rounded-lg text-xs transition flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white font-medium'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{o.name}</div>
                      <div className={`text-[11px] ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                        کد: {o.code} {o.city ? `• ${o.city}` : ''}
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-white" />}
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-100 text-left">
              <button
                type="button"
                onClick={() => setIsOfficeSwitchModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Document Upload & Management Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 max-h-[92vh] flex flex-col overflow-hidden">
            {submitSuccessMessage ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900">مدارک با موفقیت به کارشناس بازرسی ارسال شد</h3>
                <p className="text-xs text-slate-500">
                  وضعیت پرونده به «ارسال‌شده به بازرس» تغییر یافت.
                </p>
              </div>
            ) : (
              <>
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
                  <div className="space-y-0.5">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">
                      بارگذاری مدارک: {selectedRecord.certificate.applicantName}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono" dir="ltr">
                      سریال: {selectedRecord.certificate.serialNumber}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCertDetailsRecord(selectedRecord)}
                      className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md border border-slate-200 transition"
                      title="شناسنامه گواهی"
                    >
                      شناسنامه
                    </button>
                    <button
                      onClick={() => setSelectedRecord(null)}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Sub-header meta bar */}
                <div className="flex items-center justify-between text-xs bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 shrink-0">
                  <div>
                    <span>نوع گواهی: </span>
                    <strong className="text-slate-800">{getDisplayDependencyTitle(selectedRecord.certificate)}</strong>
                  </div>
                  <div>
                    <span>کارشناس بازرسی: </span>
                    <strong className="text-slate-800">{getRecordInspectorName(selectedRecord)}</strong>
                  </div>
                </div>

                {/* Defect notice banner if returned */}
                {selectedRecord.status === 'RETURNED_TO_OFFICE' && selectedRecord.inspectorNotes && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1 shrink-0">
                    <strong className="block text-amber-950 font-bold">تذکر کارشناس بازرسی جهت رفع نقص:</strong>
                    <p>{selectedRecord.inspectorNotes}</p>
                  </div>
                )}

                {/* Upload Slots - Scrollable area */}
                <div className="overflow-y-auto space-y-3 flex-1 pr-1">
                  <div className="text-xs font-semibold text-slate-800">
                    اسناد و مدارک الزامی:
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedRecord.requiredDocuments.map((docType) => {
                      const uploadedDoc = selectedRecord.uploadedDocuments?.find(d => d.docType === docType);
                      const isUploaded = !!uploadedDoc;

                      return (
                        <div
                          key={docType}
                          className={`p-3 rounded-lg border text-xs space-y-2.5 ${
                            isUploaded ? 'bg-emerald-50/40 border-emerald-200' : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-semibold text-slate-800 block">
                              {getDocTypeTitle(docType)}
                            </span>
                            {isUploaded ? (
                              <span className="text-emerald-700 bg-emerald-100 p-0.5 rounded">
                                <Check className="w-3.5 h-3.5" />
                              </span>
                            ) : (
                              <span className="text-slate-400">
                                <Paperclip className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </div>

                          {isUploaded ? (
                            <div className="bg-white p-2 rounded-md border border-slate-200 flex items-center justify-between text-[11px]">
                              <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                                <button
                                  type="button"
                                  onClick={() => setModalViewerDoc(uploadedDoc)}
                                  className="truncate text-right font-mono text-slate-700 hover:text-slate-900"
                                  title="مشاهده سند"
                                >
                                  {uploadedDoc.fileName}
                                </button>
                                {uploadedDoc.syncStatus === 'SUCCESS' || uploadedDoc.syncStatus === 'uploaded' || uploadedDoc.driveSynced ? (
                                  <span className="shrink-0 text-[9px] font-bold text-emerald-700 bg-emerald-100/80 px-1 py-0.5 rounded flex items-center gap-0.5" title={`ذخیره پایدار در مخزن: ${uploadedDoc.storageProvider || 'Storage'}`}>
                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                    <span>{uploadedDoc.storageProvider === 'server' ? 'سرور' : 'مرکزی'}</span>
                                  </span>
                                ) : uploadedDoc.syncStatus === 'FAILED' || uploadedDoc.syncStatus === 'failed' ? (
                                  <span className="shrink-0 text-[9px] font-bold text-rose-700 bg-rose-100 px-1 py-0.5 rounded flex items-center gap-0.5" title={uploadedDoc.syncErrorMessage || 'خطا در انتقال به مخزن'}>
                                    <AlertCircle className="w-2.5 h-2.5" />
                                    <span>در صف</span>
                                  </span>
                                ) : (
                                  <span className="shrink-0 text-[9px] font-bold text-amber-700 bg-amber-100 px-1 py-0.5 rounded" title="در حال ذخیره‌سازی در مخزن">
                                    در انتظار
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setModalViewerDoc(uploadedDoc)}
                                  className="p-1 text-slate-400 hover:text-slate-700"
                                  title="مشاهده"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveDoc(uploadedDoc.id)}
                                  className="p-1 text-rose-500 hover:text-rose-700"
                                  title="حذف"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <label className="border border-dashed border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 rounded-md p-2 flex items-center justify-center gap-1.5 cursor-pointer transition text-[11px] font-medium text-slate-600">
                              <input
                                type="file"
                                accept="image/*,.pdf,.doc,.docx"
                                onChange={(e) => handleFileUpload(e, docType)}
                                className="hidden"
                              />
                              <UploadCloud className="w-3.5 h-3.5 text-slate-500" />
                              <span>انتخاب و بارگذاری فایل</span>
                            </label>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Case Notes History */}
                  <div className="pt-2">
                    <CaseNotesHistoryPanel
                      record={selectedRecord}
                      currentUserRole="OFFICE_USER"
                      currentUserName={currentOffice.managerName ? `مسئول دفتر: ${currentOffice.managerName}` : 'کاربر دفتر ثبت‌نام'}
                      onAddNote={handleAddNoteToRecord}
                    />
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 shrink-0 flex-wrap gap-2">
                  <div className="text-xs text-slate-500 font-mono">
                    {selectedRecord.uploadedDocuments?.length || 0} از {selectedRecord.requiredDocuments.length} مدرک بارگذاری شده
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDraftSavedToast(`مدارک پرونده در پیش‌نویس ذخیره ماند.`);
                        setSelectedRecord(null);
                        setTimeout(() => setDraftSavedToast(null), 4000);
                      }}
                      className="px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 rounded-lg font-medium border border-slate-200 transition cursor-pointer"
                    >
                      ذخیره موقت و بستن
                    </button>

                    <button
                      type="button"
                      onClick={handleSubmitToInspector}
                      disabled={isSubmitting || (selectedRecord.uploadedDocuments?.length || 0) === 0}
                      className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-2xs transition cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSubmitting ? 'در حال ارسال...' : 'ارسال به کارشناس بازرس'}</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL 3: Incomplete Confirmation Dialog */}
      {showIncompleteConfirmModal && recordForIncompleteSubmit && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-5 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-2.5">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">مدارک پرونده هنوز کامل نیست</h3>
                <p className="text-xs text-slate-500">
                  {recordForIncompleteSubmit.uploadedDocuments?.length || 0} از {recordForIncompleteSubmit.requiredDocuments.length} مدرک بارگذاری شده است.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              ارسال فوری اجباری نیست! می‌توانید این مدارک را در <strong>پیش‌نویس</strong> نگه‌دارید و پس از تکمیل، پرونده را ارسال نمایید. آیا مایلید همین مدارک ناقص ارسال شود؟
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  setShowIncompleteConfirmModal(false);
                  setRecordForIncompleteSubmit(null);
                }}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
              >
                بازگشت
              </button>
              <button
                onClick={() => {
                  setShowIncompleteConfirmModal(false);
                  setRecordForIncompleteSubmit(null);
                  setSelectedRecord(null);
                  setDraftSavedToast(`مدارک در پیش‌نویس ذخیره ماندند.`);
                  setTimeout(() => setDraftSavedToast(null), 4000);
                }}
                className="px-3 py-1.5 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium"
              >
                ذخیره در پیش‌نویس
              </button>
              <button
                onClick={() => {
                  const target = recordForIncompleteSubmit;
                  setShowIncompleteConfirmModal(false);
                  setRecordForIncompleteSubmit(null);
                  executeSubmitRecord(target);
                }}
                className="px-3 py-1.5 text-xs text-white bg-slate-900 hover:bg-slate-800 rounded-lg font-semibold"
              >
                ارسال همین مدارک
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Bulk Submit Modal */}
      {isBulkSubmitModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-5 shadow-xl space-y-4 animate-in fade-in zoom-in-95 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900">ارسال دسته‌جمعی به بازرس</h3>
              </div>
              <button
                onClick={() => setIsBulkSubmitModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              تعداد <strong className="text-slate-900 font-mono">{draftRecords.length}</strong> پرونده دارای مدارک پیش‌نویس برای کارشناس بازرسی ({officeAssignedInspector}) ارسال خواهند شد.
            </p>

            <div className="overflow-y-auto space-y-1.5 flex-1 pr-1 max-h-60 divide-y divide-slate-100">
              {draftRecords.map(r => (
                <div key={r.id} className="pt-1.5 first:pt-0 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-slate-800">{r.certificate.applicantName}</div>
                    <div className="text-[11px] text-slate-400 font-mono" dir="ltr">{r.certificate.serialNumber}</div>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {r.uploadedDocuments?.length || 0}/{r.requiredDocuments.length} مدرک
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsBulkSubmitModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
              >
                انصراف
              </button>
              <button
                onClick={handleConfirmBulkSubmit}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-2xs"
              >
                تأیید و ارسال همه
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      <OfficeKartableProfileModal
        key={`profile-modal-${currentOffice?.code || 'default'}-${isProfileModalOpen ? '1' : '0'}`}
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        office={currentOffice}
        manager={currentManager}
        offices={offices}
        onSelectOffice={(newCode) => {
          if (onSelectOfficeCode) onSelectOfficeCode(newCode);
        }}
        officeTypes={officeTypes}
        fieldSettings={fieldSettings}
        onSave={handleSaveProfile}
      />

      {/* Certificate Details Modal */}
      <CertificateDetailsModal
        isOpen={!!certDetailsRecord}
        onClose={() => setCertDetailsRecord(null)}
        record={certDetailsRecord}
        officeName={displayOfficeName}
        officeCode={targetCode}
      />

      {/* Document Viewer Modal */}
      <DocumentViewerModal
        isOpen={!!modalViewerDoc}
        document={modalViewerDoc}
        applicantName={selectedRecord?.certificate.applicantName}
        nationalId={selectedRecord?.certificate.nationalId}
        trackingCode={selectedRecord?.certificate.trackingCode}
        onClose={() => setModalViewerDoc(null)}
      />
    </div>
  );
};
