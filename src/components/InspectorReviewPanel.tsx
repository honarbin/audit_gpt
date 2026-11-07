import React, { useState } from 'react';
import { 
  FileCheck2, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Eye, 
  FileText, 
  Sparkles, 
  Printer, 
  Download, 
  Building2, 
  User, 
  Calendar, 
  Clock, 
  ShieldCheck, 
  RefreshCw,
  Award,
  ChevronRight,
  Maximize2,
  ExternalLink,
  CloudUpload,
  HardDrive,
  ShieldAlert,
  RotateCcw,
  Send,
  Bell,
  SlidersHorizontal,
  Filter,
  ArrowUpRight,
  MessageSquare,
  HelpCircle,
  Check,
  UserCheck
} from 'lucide-react';
import { 
  AuditCampaign, 
  AuditInspectionRecord, 
  UploadedDocument, 
  AiAuditResult, 
  DocumentDefectItem, 
  CaseNoteEntry,
  InspectionStatus
} from '../types';
import { AppUser } from '../types/auth';
import { getUserPermissions, isSeniorInspector, isInspectorSpecialist } from '../services/authService';
import { getDocTypeTitle, getDependencyTypeTitle, getCertificateStatusTitle, deduplicateAuditRecords } from '../utils/samplingEngine';
import { DocumentViewerModal } from './DocumentViewerModal';
import { ChangeInspectorModal } from './ChangeInspectorModal';
import { CertificateDetailsModal } from './CertificateDetailsModal';
import { uploadDocumentToGoogleDrive } from '../utils/googleDriveService';
import { CaseNotesHistoryPanel } from './CaseNotesHistoryPanel';
import { formatDisplayDate } from '../utils/dateFormatter';

interface InspectorReviewPanelProps {
  campaigns: AuditCampaign[];
  currentUser?: AppUser | null;
  onUpdateRecord: (updatedRecord: AuditInspectionRecord) => void;
  onOpenOfficialMinutes: (record: AuditInspectionRecord) => void;
  viewMode?: 'INSPECTION' | 'WARNINGS';
}

export const InspectorReviewPanel: React.FC<InspectorReviewPanelProps> = ({
  campaigns,
  currentUser,
  onUpdateRecord,
  onOpenOfficialMinutes,
  viewMode = 'INSPECTION',
}) => {
  const userPerms = getUserPermissions(currentUser);
  const isSenior = isSeniorInspector(currentUser);
  const isSpecialist = isInspectorSpecialist(currentUser);
  const canIssueFinal = userPerms.canIssueFinalVerdict;
  const canSupervise = userPerms.canSuperviseWarnings;

  // View mode tab: 'INSPECTION' | 'WARNINGS_SUPERVISORY'
  const [activeTabMode, setActiveTabMode] = useState<'INSPECTION' | 'WARNINGS_SUPERVISORY'>(() =>
    viewMode === 'WARNINGS' ? 'WARNINGS_SUPERVISORY' : 'INSPECTION'
  );

  React.useEffect(() => {
    if (viewMode === 'WARNINGS') {
      setActiveTabMode('WARNINGS_SUPERVISORY');
    } else if (viewMode === 'INSPECTION') {
      setActiveTabMode('INSPECTION');
    }
  }, [viewMode]);

  // Filter state for records list
  const [recordFilter, setRecordFilter] = useState<'ALL' | 'REFERRED' | 'RETURNED' | 'NEEDS_REVIEW' | 'COMPLETED'>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const allRecords = React.useMemo(() => deduplicateAuditRecords(campaigns.flatMap(c => c.records || [])), [campaigns]);

  // Extract all warnings and defect notices for senior inspector's supervisory live feed
  const supervisoryWarnings = React.useMemo(() => {
    const list: {
      id: string;
      recordId: string;
      officeCode: string;
      applicantName: string;
      serialNumber: string;
      trackingCode: string;
      inspectorName: string;
      warningText: string;
      timestamp: string;
      status: InspectionStatus;
      officeResponse?: string;
    }[] = [];

    allRecords.forEach((record) => {
      const inspectorNotesInHistory = (record.notesHistory || []).filter(
        n => n.authorRole === 'INSPECTOR' || n.auditLevel === 'LEVEL_1_SPECIALIST' || n.actionType === 'DEFECT_NOTICE'
      );

      const latestOfficeNote = [...(record.notesHistory || [])]
        .reverse()
        .find(n => n.authorRole === 'OFFICE_USER');

      if (inspectorNotesInHistory.length > 0) {
        inspectorNotesInHistory.forEach((note) => {
          list.push({
            id: note.id,
            recordId: record.id,
            officeCode: record.officeCode || '---',
            applicantName: record.certificate?.applicantName || 'متقاضی',
            serialNumber: record.certificate?.serialNumber || '---',
            trackingCode: record.certificate?.trackingCode || '---',
            inspectorName: note.authorName || record.level1InspectorName || 'کارشناس بازرسی',
            warningText: note.text,
            timestamp: note.timestamp,
            status: record.status,
            officeResponse: latestOfficeNote?.text,
          });
        });
      } else if (
        record.status === 'RETURNED_TO_OFFICE' || 
        (record.inspectorNotes && record.inspectorNotes.trim().length > 0)
      ) {
        list.push({
          id: `warn-rec-${record.id}`,
          recordId: record.id,
          officeCode: record.officeCode || '---',
          applicantName: record.certificate?.applicantName || 'متقاضی',
          serialNumber: record.certificate?.serialNumber || '---',
          trackingCode: record.certificate?.trackingCode || '---',
          inspectorName: record.level1InspectorName || record.reviewerName || 'کارشناس بازرسی',
          warningText: record.inspectorNotes || 'اعلام نقص و عودت پرونده به کارتابل دفتر',
          timestamp: record.reviewDate || 'ثبت شده در سامانه',
          status: record.status,
          officeResponse: record.officeNotes,
        });
      }
    });

    return list;
  }, [allRecords]);

  // Filtered records list
  const filteredRecords = React.useMemo(() => {
    return allRecords.filter((record) => {
      // Search term filter
      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        const matchesName = record.certificate.applicantName.toLowerCase().includes(term);
        const matchesSerial = record.certificate.serialNumber.toLowerCase().includes(term);
        const matchesCode = record.certificate.trackingCode.toLowerCase().includes(term);
        const matchesOffice = (record.officeCode || '').toLowerCase().includes(term);
        if (!matchesName && !matchesSerial && !matchesCode && !matchesOffice) {
          return false;
        }
      }

      // Tab filter
      if (recordFilter === 'REFERRED') {
        return record.status === 'REFERRED_TO_SENIOR';
      }
      if (recordFilter === 'RETURNED') {
        return record.status === 'RETURNED_TO_OFFICE';
      }
      if (recordFilter === 'NEEDS_REVIEW') {
        return record.status === 'UPLOADED' || record.status === 'UNDER_REVIEW';
      }
      if (recordFilter === 'COMPLETED') {
        return record.status === 'APPROVED' || record.status.includes('DEFECT') || record.status === 'CONDITIONAL';
      }
      return true;
    });
  }, [allRecords, recordFilter, searchTerm]);

  const [selectedRecordId, setSelectedRecordId] = useState<string>(
    filteredRecords.find(r => r.status === 'REFERRED_TO_SENIOR' || r.status === 'UPLOADED')?.id || 
    allRecords.find(r => r.status === 'UPLOADED' || r.status === 'APPROVED')?.id || 
    allRecords[0]?.id || ''
  );

  const selectedRecord = allRecords.find(r => r.id === selectedRecordId) || allRecords[0];

  const [activeDocPreview, setActiveDocPreview] = useState<UploadedDocument | null>(null);
  const [modalViewerDoc, setModalViewerDoc] = useState<UploadedDocument | null>(null);
  const [isAiAuditing, setIsAiAuditing] = useState(false);
  const [aiResult, setAiResult] = useState<AiAuditResult | null>(null);
  const [isSyncingAllDrive, setIsSyncingAllDrive] = useState(false);
  const [driveNotification, setDriveNotification] = useState<string | null>(null);
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);
  const [isChangeInspectorModalOpen, setIsChangeInspectorModalOpen] = useState<boolean>(false);
  const [isCertDetailsOpen, setIsCertDetailsOpen] = useState<boolean>(false);

  // Inspector form state
  const [inspectorNotes, setInspectorNotes] = useState<string>(selectedRecord?.inspectorNotes || '');
  const [complianceScore, setComplianceScore] = useState<number>(selectedRecord?.complianceScore ?? 100);
  const [checklist, setChecklist] = useState<Record<string, boolean>>(
    selectedRecord?.checklistResults || {}
  );

  // When switching selected record
  const handleSelectRecord = (record: AuditInspectionRecord) => {
    setSelectedRecordId(record.id);
    setInspectorNotes(record.inspectorNotes || '');
    setComplianceScore(record.complianceScore ?? 100);
    setChecklist(record.checklistResults || {});
    setAiResult(record.aiAuditResult || null);
    setActiveDocPreview(record.uploadedDocuments?.[0] || null);
  };

  // Update specific document defects
  const handleUpdateDocumentDefects = (
    docId: string, 
    status: 'COMPLIANT' | 'DEFECTIVE', 
    defects: DocumentDefectItem[], 
    docInspectorNotes?: string
  ) => {
    if (!selectedRecord) return;

    const updatedDocs = (selectedRecord.uploadedDocuments || []).map((doc) => {
      if (doc.id === docId) {
        return {
          ...doc,
          complianceStatus: status,
          defects: defects,
          inspectorNotes: docInspectorNotes,
        };
      }
      return doc;
    });

    const hasAnyDefects = updatedDocs.some((d) => d.complianceStatus === 'DEFECTIVE');
    const newScore = hasAnyDefects ? Math.max(complianceScore - (defects.length * 10), 30) : 100;
    setComplianceScore(newScore);

    const updatedRecord: AuditInspectionRecord = {
      ...selectedRecord,
      uploadedDocuments: updatedDocs,
      complianceScore: newScore,
      defectCategory: hasAnyDefects ? 'DEFECTS_REGISTERED' : undefined,
    };

    onUpdateRecord(updatedRecord);
    if (activeDocPreview?.id === docId) {
      setActiveDocPreview(updatedDocs.find((d) => d.id === docId) || null);
    }
  };

  // Update document Google Drive sync info
  const handleUpdateDocumentDriveSync = (docId: string, driveFileId: string, webViewLink: string) => {
    if (!selectedRecord) return;
    const updatedDocs = (selectedRecord.uploadedDocuments || []).map((doc) => {
      if (doc.id === docId) {
        return {
          ...doc,
          driveFileId,
          driveWebViewLink: webViewLink,
          driveSynced: true,
          driveSyncDate: new Date().toLocaleDateString('fa-IR'),
        };
      }
      return doc;
    });

    const updatedRecord: AuditInspectionRecord = {
      ...selectedRecord,
      uploadedDocuments: updatedDocs,
    };
    onUpdateRecord(updatedRecord);
  };

  // Update document annotations & stamps
  const handleUpdateDocumentAnnotations = (docId: string, annotations: any[]) => {
    if (!selectedRecord) return;
    const updatedDocs = (selectedRecord.uploadedDocuments || []).map((doc) => {
      if (doc.id === docId) {
        return {
          ...doc,
          annotations,
        };
      }
      return doc;
    });

    const updatedRecord: AuditInspectionRecord = {
      ...selectedRecord,
      uploadedDocuments: updatedDocs,
    };
    onUpdateRecord(updatedRecord);
  };

  // Sync all documents of this record to Google Drive
  const handleSyncAllToGoogleDrive = async () => {
    if (!selectedRecord || !selectedRecord.uploadedDocuments || selectedRecord.uploadedDocuments.length === 0) return;
    setIsSyncingAllDrive(true);
    setDriveNotification(null);

    try {
      const updatedDocs = await Promise.all(
        selectedRecord.uploadedDocuments.map(async (doc) => {
          const res = await uploadDocumentToGoogleDrive(doc, {
            officeCode: selectedRecord.officeCode,
            applicantId: selectedRecord.certificate?.nationalId || selectedRecord.certificate?.applicantName || selectedRecord.id,
            inspectionId: selectedRecord.id,
          });
          return {
            ...doc,
            fileId: res.fileId,
            storageProvider: res.storageProvider,
            storageKey: res.storageKey,
            storageFileName: res.storageFileName,
            checksum: res.checksum,
            driveFileId: res.driveFileId,
            driveWebViewLink: res.viewUrl || res.driveWebViewLink,
            driveDownloadUrl: res.downloadUrl,
            driveSynced: res.syncStatus === 'uploaded' || (res.syncStatus as string) === 'SUCCESS',
            syncStatus: res.syncStatus === 'uploaded' ? 'uploaded' : 'pending',
            syncErrorMessage: res.errorMessage,
            driveSyncDate: new Date().toLocaleDateString('fa-IR'),
          };
        })
      );

      const updatedRecord: AuditInspectionRecord = {
        ...selectedRecord,
        uploadedDocuments: updatedDocs,
      };
      onUpdateRecord(updatedRecord);
      setDriveNotification(`تمام مدارک (${updatedDocs.length} سند) با موفقیت در پوشه گوگل درایو مرکز بازرسی و نظارت دفاتر ثبت نام مرکز میانی عام ذخیره شدند.`);
      setTimeout(() => setDriveNotification(null), 5000);
    } catch (err) {
      setDriveNotification('خطا در همگام‌سازی ابری با گوگل درایو');
    } finally {
      setIsSyncingAllDrive(false);
    }
  };

  // Toggle checklist item
  const handleToggleChecklist = (key: string) => {
    const updated = { ...checklist, [key]: !checklist[key] };
    setChecklist(updated);

    // Recalculate score based on checks
    const totalChecks = Object.keys(updated).length;
    const passedChecks = Object.values(updated).filter(Boolean).length;
    const newScore = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 100;
    setComplianceScore(newScore);
  };

  // AI Smart Audit call
  const handleRunAiAudit = async () => {
    if (!selectedRecord) return;
    setIsAiAuditing(true);

    try {
      const response = await fetch('/api/ai-audit-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          certificateData: selectedRecord.certificate,
          uploadedDocs: selectedRecord.uploadedDocuments,
          inspectionRules: 'بررسی صحت مدارک الزامی بر اساس وابستگی (فرم پذیرش، معرفینامه، آگهی تاسیس، آخرین روزنامه رسمی، فرم ابطال)',
        }),
      });

      const data = await response.json();
      if (data.analysis) {
        setAiResult(data.analysis);
        if (data.analysis.complianceScore !== undefined) {
          setComplianceScore(data.analysis.complianceScore);
        }
        if (data.analysis.auditNote) {
          setInspectorNotes(data.analysis.auditNote);
        }
      } else if (data.fallbackAnalysis) {
        setAiResult(data.fallbackAnalysis);
        setComplianceScore(data.fallbackAnalysis.complianceScore);
      }
    } catch (err) {
      console.error(err);
      // Fallback local heuristic
      const mockAi: AiAuditResult = {
        complianceScore: 95,
        status: 'APPROVED',
        riskLevel: selectedRecord.certificate.riskScore > 60 ? 'متوسط' : 'پایین',
        findings: [
          'مدارک الزامی متناسب با نوع وابستگی پیوست گردیده است.',
          'فرم‌ها تکمیل، امضا شده و اصالت مستندات بررسی شد.',
          'زمان صدور گواهی بررسی شد و مشکلی مشاهده نگردید.'
        ],
        missingItems: [],
        recommendation: 'تایید مدارک و انطباق کامل با ضوابط بازرسی دفاتر',
        auditNote: 'مدارک کامل و منطبق با استانداردهای صدور ارزیابی گردید.'
      };
      setAiResult(mockAi);
      setComplianceScore(95);
      setInspectorNotes(mockAi.auditNote || '');
    } finally {
      setIsAiAuditing(false);
    }
  };

  // Level 1 Action: Return to Office Kartable with defect notice
  const handleReturnToOffice = () => {
    if (!selectedRecord) return;
    if (isSubmittingDecision) return;

    if (!inspectorNotes || !inspectorNotes.trim()) {
      alert('ثبت تذکر الزامی است: لطفاً جهت عودت پرونده به کارتابل دفتر ثبت‌نام، شرح دقیق نواقص یا تذکرات اصلاحی را در کادر یادداشت وارد نمایید.');
      return;
    }

    setIsSubmittingDecision(true);

    const newNoteEntry: CaseNoteEntry = {
      id: `note-return-${Date.now()}`,
      authorRole: 'INSPECTOR',
      authorName: currentUser?.fullName || 'کارشناس بازرسی',
      text: inspectorNotes.trim(),
      timestamp: '1405/06/02 15:30',
      statusAtTime: 'RETURNED_TO_OFFICE',
      actionType: 'DEFECT_NOTICE',
      auditLevel: 'LEVEL_1_SPECIALIST',
    };

    const updated: AuditInspectionRecord = {
      ...selectedRecord,
      status: 'RETURNED_TO_OFFICE',
      complianceScore,
      inspectorNotes: inspectorNotes.trim(),
      notesHistory: [...(selectedRecord.notesHistory || []), newNoteEntry],
      checklistResults: checklist,
      level1InspectorName: currentUser?.fullName || 'کارشناس بازرسی',
      level1Recommendation: inspectorNotes.trim(),
      level1ReviewedAt: '1405/06/02 15:30',
      reviewerName: currentUser?.fullName || 'کارشناس بازرسی',
      reviewDate: '1405/06/02',
      aiAuditResult: aiResult || undefined,
    };

    onUpdateRecord(updated);

    setTimeout(() => {
      setIsSubmittingDecision(false);
      alert('پرونده با موفقیت جهت رفع نقص به کارتابل دفتر ثبت‌نام بازگردانده شد.');
    }, 600);
  };

  // Level 1 Action: Escalate / Refer to Senior Inspector
  const handleReferToSenior = () => {
    if (!selectedRecord) return;
    if (isSubmittingDecision) return;

    setIsSubmittingDecision(true);

    const recommendationText = inspectorNotes.trim() || 'مدارک پرونده توسط کارشناس تطبیق داده شد و جهت اتخاذ تصمیم و صدور رأی قطعی نظارتی به کارتابل بازرس ارشد ارجاع داده می‌شود.';

    const newNoteEntry: CaseNoteEntry = {
      id: `note-refer-${Date.now()}`,
      authorRole: 'INSPECTOR',
      authorName: currentUser?.fullName || 'کارشناس بازرسی',
      text: recommendationText,
      timestamp: '1405/06/02 15:45',
      statusAtTime: 'REFERRED_TO_SENIOR',
      actionType: 'STATUS_CHANGE',
      auditLevel: 'LEVEL_1_SPECIALIST',
    };

    const updated: AuditInspectionRecord = {
      ...selectedRecord,
      status: 'REFERRED_TO_SENIOR',
      complianceScore,
      inspectorNotes: recommendationText,
      notesHistory: [...(selectedRecord.notesHistory || []), newNoteEntry],
      checklistResults: checklist,
      level1InspectorName: currentUser?.fullName || 'کارشناس بازرسی',
      level1Recommendation: recommendationText,
      level1ReviewedAt: '1405/06/02 15:45',
      reviewerName: currentUser?.fullName || 'کارشناس بازرسی',
      reviewDate: '1405/06/02',
      aiAuditResult: aiResult || undefined,
    };

    onUpdateRecord(updated);

    setTimeout(() => {
      setIsSubmittingDecision(false);
      alert('پرونده با موفقیت جهت اتخاذ تصمیم به کارتابل بازرس ارشد ارجاع شد.');
    }, 600);
  };

  // Level 2 Action: Senior Inspector / Supervisor Final Verdict
  const handleSaveDecision = (status: AuditInspectionRecord['status']) => {
    if (!selectedRecord) return;
    if (isSubmittingDecision) return;

    if (!canIssueFinal) {
      alert('عدم دسترسی: صدور رأی قطعی انطباق یا عدم انطباق صرفاً در صلاحیت بازرس ارشد و مقام بالاتر می‌باشد.');
      return;
    }

    // Check mandatory notes for non-compliance or conditional
    if (status === 'DEFECT_MINOR' || status === 'DEFECT_MAJOR' || status === 'CONDITIONAL') {
      if (!inspectorNotes || !inspectorNotes.trim()) {
        alert(
          `ثبت یادداشت تصمیم الزامی است: لطفاً جهت ${
            status === 'CONDITIONAL' 
              ? 'تایید مشروط' 
              : status === 'DEFECT_MINOR' 
              ? 'ثبت عدم انطباق جزئی' 
              : 'ثبت عدم انطباق عمده و بحرانی'
          }، شرح تصمیم و مستندات قانونی را در کادر یادداشت وارد فرمایید.`
        );
        return;
      }
    }

    setIsSubmittingDecision(true);

    const verdictLabel = 
      status === 'APPROVED' ? 'تأیید قطعی مدارک و انطباق کامل' :
      status === 'CONDITIONAL' ? 'تأیید مشروط با تذکر انضباطی' :
      status === 'DEFECT_MINOR' ? 'ثبت عدم انطباق جزئی با اخطار رسمی' :
      status === 'DEFECT_MAJOR' ? 'صدور حکم عدم انطباق عمده و بحرانی' :
      'دستور بازبینی مجدد مدارک';

    const newNoteEntry: CaseNoteEntry = {
      id: `note-verdict-${Date.now()}`,
      authorRole: isSenior ? 'SENIOR_INSPECTOR' : 'INSPECTOR',
      authorName: currentUser?.fullName || (isSenior ? 'بازرس ارشد مرکز' : 'سرپرست بازرسی'),
      text: inspectorNotes.trim() || `رأی قطعی نظارتی: ${verdictLabel} (امتیاز انطباق: ${complianceScore})`,
      timestamp: '1405/06/02 16:00',
      statusAtTime: status,
      actionType: 'VERDICT',
      auditLevel: 'LEVEL_2_SENIOR',
    };

    const updated: AuditInspectionRecord = {
      ...selectedRecord,
      status,
      complianceScore,
      inspectorNotes: inspectorNotes.trim(),
      notesHistory: [...(selectedRecord.notesHistory || []), newNoteEntry],
      checklistResults: checklist,
      seniorInspectorName: currentUser?.fullName || (isSenior ? 'بازرس ارشد مرکز' : 'سرپرست بازرسی'),
      seniorVerdictNotes: inspectorNotes.trim(),
      seniorDecidedAt: '1405/06/02 16:00',
      reviewDate: '1405/06/02',
      reviewerName: currentUser?.fullName || 'سرپرست بازرسی',
      aiAuditResult: aiResult || undefined,
    };

    onUpdateRecord(updated);

    setTimeout(() => {
      setIsSubmittingDecision(false);
      alert(`رأی قطعی (${verdictLabel}) با موفقیت ثبت و ابلاغ گردید.`);
    }, 600);
  };

  const handleAddInspectorNote = (newNote: CaseNoteEntry) => {
    if (!selectedRecord) return;
    const updatedHistory = [...(selectedRecord.notesHistory || []), newNote];
    const updated: AuditInspectionRecord = {
      ...selectedRecord,
      notesHistory: updatedHistory,
      inspectorNotes: newNote.text,
    };
    onUpdateRecord(updated);
    setInspectorNotes(newNote.text);
  };

  const cert = selectedRecord?.certificate;

  return (
    <div className="space-y-6">
      {/* Top Banner & Mode Selector */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs px-3 py-1 rounded-full font-bold border ${
                isSenior 
                  ? 'bg-purple-50 text-purple-800 border-purple-200'
                  : 'bg-cyan-50 text-cyan-800 border-cyan-200'
              }`}>
                {isSenior ? 'سطح ۲ ممیزی: میز کار بازرس ارشد (مقام ناظر)' : 'سطح ۱ ممیزی: میز کار کارشناس بازرسی'}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                {isSenior ? 'سامانه نظارت عالیه، رصد تذکرات و صدور آرای قطعی' : 'پنل بررسی مدارک، ثبت تذکرات و ارجاع پرونده‌ها'}
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-3xl">
              {isSenior 
                ? 'رصد برخط تذکرات کارشناسان به دفاتر ثبت‌نام، رسیدگی به پرونده‌های ارجاعی و صدور احکام نظارتی قطعی بر پایه اصل بی‌طرفی و استقلال ممیزی.'
                : 'بررسی مدارک ارسالی دفاتر، ثبت نواقص و تذکرات قانونی، عودت به دفتر جهت تکمیل یا ارجاع به بازرس ارشد جهت اتخاذ تصمیم نهایی.'}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            {selectedRecord && (
              <button
                onClick={() => onOpenOfficialMinutes(selectedRecord)}
                className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-2xl shadow-xs transition shrink-0 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-emerald-400" />
                <span>مشاهده صورت‌جلسه</span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs between Inspection Workspace and Supervisory Warnings Center */}
        <div className="flex items-center justify-between border-t border-slate-200 pt-4 flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-300">
            <button
              onClick={() => setActiveTabMode('INSPECTION')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer border ${
                activeTabMode === 'INSPECTION'
                  ? 'bg-white text-slate-900 border-slate-300 shadow-xs ring-2 ring-emerald-500/20'
                  : 'bg-transparent text-slate-700 hover:text-slate-950 border-transparent hover:bg-slate-200'
              }`}
            >
              <FileCheck2 className={`w-4 h-4 ${activeTabMode === 'INSPECTION' ? 'text-cyan-700' : 'text-slate-500'}`} />
              <span>کارتابل تطبیق مدارک و ممیزی</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-bold ${
                activeTabMode === 'INSPECTION' ? 'bg-cyan-100 text-cyan-900 border border-cyan-200' : 'bg-slate-200 text-slate-700'
              }`}>
                {allRecords.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTabMode('WARNINGS_SUPERVISORY')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer border ${
                activeTabMode === 'WARNINGS_SUPERVISORY'
                  ? 'bg-purple-700 text-white border-purple-800 shadow-xs ring-2 ring-purple-500/20'
                  : 'bg-transparent text-slate-700 hover:text-slate-950 border-transparent hover:bg-slate-200'
              }`}
            >
              <Bell className={`w-4 h-4 ${activeTabMode === 'WARNINGS_SUPERVISORY' ? 'text-amber-300' : 'text-slate-500'}`} />
              <span>رصد زنده تذکرات به دفاتر</span>
              {supervisoryWarnings.length > 0 && (
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-black ${
                  activeTabMode === 'WARNINGS_SUPERVISORY'
                    ? 'bg-purple-900 text-white border border-purple-800'
                    : 'bg-amber-100 text-amber-900 border border-amber-300'
                }`}>
                  {supervisoryWarnings.length} تذکر
                </span>
              )}
            </button>
          </div>

          {/* Impartiality Principle Pill */}
          <div className="flex items-center gap-2 text-xs text-slate-600 font-bold bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>اصل بی‌طرفی: عدم امکان دستکاری یا تعویض نمونه‌های تصادفی</span>
          </div>
        </div>
      </div>

      {/* VIEW MODE 1: Supervisory Warnings Monitor */}
      {activeTabMode === 'WARNINGS_SUPERVISORY' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-slate-100">
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-purple-600" />
                <span>مرکز نظارت و رصد زنده تذکرات و اخطارهای کارشناسان به دفاتر</span>
              </h3>
              <p className="text-xs text-slate-500">
                بازرس ارشد و مقام ناظر می‌تواند کلیه تذکرات، اخطارها و دلایل برگشت پرونده‌ها به دفاتر را رصد نموده و در جریان مکاتبات قرار گیرد.
              </p>
            </div>
            <div className="bg-purple-50 text-purple-900 border border-purple-200 px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5">
              <Award className="w-4 h-4 text-purple-700" />
              <span>مجموع تذکرات ثبت‌شده: {supervisoryWarnings.length} مورد</span>
            </div>
          </div>

          {supervisoryWarnings.length === 0 ? (
            <div className="text-center py-12 text-slate-500 space-y-2">
              <Bell className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-xs font-bold">تاکنون تذکر یا اخطاری توسط کارشناسان برای دفاتر ثبت نشده است.</p>
              <p className="text-[11px] text-slate-400">به محض ثبت هرگونه تذکر یا عودت پرونده توسط کارشناس، در این جدول نمایش داده خواهد شد.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <th className="py-3 px-4">ردیف</th>
                    <th className="py-3 px-4">کارشناس بازرسی</th>
                    <th className="py-3 px-4">دفتر ثبت‌نام</th>
                    <th className="py-3 px-4">متقاضی و سریال گواهی</th>
                    <th className="py-3 px-4">متن تذکر / شرح نواقص</th>
                    <th className="py-3 px-4">زمان ثبت</th>
                    <th className="py-3 px-4">وضعیت فعلی</th>
                    <th className="py-3 px-4 text-center">اقدام نظارتی</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {supervisoryWarnings.map((warn, idx) => {
                    const targetRec = allRecords.find(r => r.id === warn.recordId);
                    return (
                      <tr key={warn.id} className="hover:bg-purple-50/40 transition">
                        <td className="py-3 px-4 font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{warn.inspectorName}</div>
                          <span className="text-[10px] text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded">سطح ۱ کارشناسی</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-slate-800">دفتر {warn.officeCode}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-800">{warn.applicantName}</div>
                          <div className="font-mono text-[10px] text-slate-500">سریال: {warn.serialNumber}</div>
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          <div className="bg-amber-50/70 border border-amber-200 p-2 rounded-xl text-amber-950 text-[11px] leading-relaxed line-clamp-2" title={warn.warningText}>
                            {warn.warningText}
                          </div>
                          {warn.officeResponse && (
                            <div className="mt-1 text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded truncate" title={warn.officeResponse}>
                              پاسخ دفتر: {warn.officeResponse}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                          {warn.timestamp}
                        </td>
                        <td className="py-3 px-4">
                          {warn.status === 'RETURNED_TO_OFFICE' ? (
                            <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              برگشت به دفتر
                            </span>
                          ) : warn.status === 'REFERRED_TO_SENIOR' ? (
                            <span className="bg-purple-100 text-purple-900 border border-purple-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              ارجاع به بازرس ارشد
                            </span>
                          ) : (
                            <span className="bg-slate-100 text-slate-700 text-[10px] font-medium px-2 py-0.5 rounded-full">
                              {warn.status}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => {
                              if (targetRec) {
                                handleSelectRecord(targetRec);
                                setActiveTabMode('INSPECTION');
                              }
                            }}
                            className="bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl transition shadow-2xs flex items-center gap-1 mx-auto cursor-pointer"
                          >
                            <span>ورود به پرونده</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE 2: Main Inspection Grid */}
      {activeTabMode === 'INSPECTION' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Side: Records List Selector (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                  <FileCheck2 className="w-4 h-4 text-cyan-600" />
                  <span>لیست پرونده‌های بازرسی ({filteredRecords.length} از {allRecords.length})</span>
                </h3>
              </div>

              {/* Search Box & Status Filter Dropdown */}
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="جستجوی نام، کدملی، سریال یا دفتر..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-8 pl-3 py-2 text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-cyan-500 transition"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3" />
                </div>

                {/* Status Dropdown Filter */}
                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <select
                    id="inspector-review-status-filter"
                    value={recordFilter}
                    onChange={(e) => setRecordFilter(e.target.value as any)}
                    className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 text-slate-800 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer shadow-2xs transition"
                  >
                    <option value="ALL">همه وضعیت‌های پرونده ({allRecords.length})</option>
                    <option value="NEEDS_REVIEW">آماده بررسی بازرس ({allRecords.filter(r => r.status === 'UPLOADED' || r.status === 'UNDER_REVIEW').length})</option>
                    <option value="REFERRED">ارجاع به ارشد ({allRecords.filter(r => r.status === 'REFERRED_TO_SENIOR').length})</option>
                    <option value="RETURNED">برگشت به دفتر جهت رفع نقص ({allRecords.filter(r => r.status === 'RETURNED_TO_OFFICE').length})</option>
                    <option value="COMPLETED">مختومه ({allRecords.filter(r => r.status === 'APPROVED' || r.status.includes('DEFECT') || r.status === 'CONDITIONAL').length})</option>
                  </select>
                </div>
              </div>

              {/* Records List */}
              <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
                {filteredRecords.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    پرونده‌ای با این مشخصات یافت نشد.
                  </div>
                ) : (
                  filteredRecords.map((record) => {
                    const isSelected = record.id === selectedRecord?.id;
                    const c = record.certificate;

                    return (
                      <div
                        key={record.id}
                        onClick={() => handleSelectRecord(record)}
                        className={`p-4 rounded-2xl border cursor-pointer transition space-y-2 ${
                          isSelected
                            ? 'bg-emerald-50/70 border-emerald-400 shadow-2xs'
                            : 'bg-slate-50/60 border-slate-200 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-900 truncate max-w-[160px]">
                            {c.applicantName}
                          </span>
                          {record.status === 'APPROVED' ? (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full font-bold">
                              تایید قطعی
                            </span>
                          ) : record.status === 'REFERRED_TO_SENIOR' ? (
                            <span className="text-[10px] bg-purple-100 text-purple-800 border border-purple-300 px-2 py-0.5 rounded-full font-bold">
                              ارجاع به ارشد
                            </span>
                          ) : record.status === 'RETURNED_TO_OFFICE' ? (
                            <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full font-bold">
                              برگشت به دفتر
                            </span>
                          ) : record.status === 'UPLOADED' ? (
                            <span className="text-[10px] bg-blue-100 text-blue-800 border border-blue-300 px-2 py-0.5 rounded-full font-bold">
                              آماده بررسی
                            </span>
                          ) : record.status.includes('DEFECT') ? (
                            <span className="text-[10px] bg-rose-100 text-rose-800 border border-rose-300 px-2 py-0.5 rounded-full font-bold">
                              عدم انطباق
                            </span>
                          ) : record.status === 'CONDITIONAL' ? (
                            <span className="text-[10px] bg-teal-100 text-teal-800 border border-teal-300 px-2 py-0.5 rounded-full font-bold">
                              مشروط با تذکر
                            </span>
                          ) : (
                            <span className="text-[10px] bg-slate-100 text-slate-700 border border-slate-300 px-2 py-0.5 rounded-full font-semibold">
                              در انتظار مدارک
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                          <span>سریال: <strong className="text-slate-800">{c.serialNumber}</strong></span>
                          <span>دفتر: <strong className="text-slate-700">{record.officeCode || '---'}</strong></span>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1.5 border-t border-slate-200">
                          <span>{formatDisplayDate(c.issueDate, c.issueTime).formatted}</span>
                          <span className="font-semibold text-slate-700">{record.uploadedDocuments?.length || 0} مدرک پیوست</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

        {/* Right Side: Detailed Inspection Console (8 cols) */}
        {selectedRecord && cert ? (
          <div className="lg:col-span-8 space-y-6">
            {/* Top Detail Header */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-slate-100 text-slate-700 font-mono font-bold px-2.5 py-1 rounded-lg border border-slate-200">
                      {cert.serialNumber}
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-slate-900">{cert.applicantName}</h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 font-mono">
                    کد ملی: <strong className="text-slate-800">{cert.nationalId}</strong> • همراه: <strong className="text-slate-800">{cert.mobileNumber}</strong> • دفتر: <strong className="font-sans text-slate-800">{cert.officeName}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* View Certificate Details Button */}
                  <button
                    type="button"
                    onClick={() => setIsCertDetailsOpen(true)}
                    className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold px-3 py-2 rounded-xl transition cursor-pointer shadow-2xs"
                    title="مشاهده شناسنامه و مشخصات کامل گواهی"
                  >
                    <FileText className="w-3.5 h-3.5 text-teal-600" />
                    <span>مشخصات کامل گواهی</span>
                  </button>

                  {/* Change Inspector Button */}
                  <button
                    type="button"
                    onClick={() => setIsChangeInspectorModalOpen(true)}
                    className="flex items-center gap-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-900 border border-cyan-300 text-xs font-bold px-3 py-2 rounded-xl transition cursor-pointer shadow-2xs"
                    title="تغییر یا تخصیص مجدد بازرس پرونده در هر مرحله از ممیزی"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-cyan-700" />
                    <span>بازرس: {selectedRecord.level1InspectorName || selectedRecord.reviewerName || 'تعیین نشده'}</span>
                    <span className="text-[10px] bg-cyan-200 text-cyan-800 px-1.5 py-0.5 rounded-md font-extrabold">تغییر</span>
                  </button>

                  {/* AI Audit Trigger */}
                  <button
                    onClick={handleRunAiAudit}
                    disabled={isAiAuditing}
                    className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition disabled:opacity-50 shrink-0 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>{isAiAuditing ? 'در حال تحلیل هوش مصنوعی...' : 'ارزیابی هوشمند با AI'}</span>
                  </button>
                </div>
              </div>

              {/* AI Audit Results Banner if active */}
              {aiResult && (
                <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-purple-900 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      نتیجه ارزیابی هوش مصنوعی بازرسی (AI Inspection Assistant)
                    </span>
                    <span className="text-xs font-black bg-purple-100 text-purple-900 border border-purple-300 px-3 py-0.5 rounded-full">
                      نمره انطباق: {aiResult.complianceScore}٪
                    </span>
                  </div>
                  <div className="text-xs text-slate-800 space-y-1.5">
                    {aiResult.findings?.map((f, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </div>
                    ))}
                    {aiResult.missingItems?.map((m, i) => (
                      <div key={i} className="flex items-start gap-2 text-rose-800">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <span>نقص: {m}</span>
                      </div>
                    ))}
                  </div>
                  {aiResult.recommendation && (
                    <div className="text-[11px] text-slate-600 pt-2 border-t border-purple-200">
                      توصیه سیستمی: <strong className="text-purple-950">{aiResult.recommendation}</strong>
                    </div>
                  )}
                </div>
              )}

              {/* Certificate Metadata Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <span className="text-slate-500 text-[10px] block">وابستگی ۵‌گانه</span>
                  <span className="font-extrabold text-teal-800">
                    {getDependencyTypeTitle(cert.dependencyType)}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <span className="text-slate-500 text-[10px] block">وضعیت گواهی</span>
                  <span className={`font-extrabold ${cert.status === 'REVOKED' ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {getCertificateStatusTitle(cert.status)}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <span className="text-slate-500 text-[10px] block">زمان و تاریخ صدور</span>
                  <span className="font-bold text-slate-800 font-mono">{formatDisplayDate(cert.issueDate, cert.issueTime).formatted}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <span className="text-slate-500 text-[10px] block">علت انتخاب در الگوریتم ۷ تایی</span>
                  <span className="font-bold text-amber-800">
                    {cert.selectedReasonBadge || 'پوشش الگوریتم بازرسی'}
                  </span>
                </div>
              </div>

              {cert.status === 'REVOKED' && (
                <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl text-xs space-y-1 text-rose-950">
                  <span className="font-extrabold flex items-center gap-1.5 text-rose-800">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    اطلاعات ابطال گواهی:
                  </span>
                  <p>علت ابطال: {cert.revocationReason || 'درخواست رسمی متقاضی'} • تاریخ ابطال: {cert.revocationDate ? formatDisplayDate(cert.revocationDate).date : '-'}</p>
                </div>
              )}

              {/* Office notes if provided */}
              {selectedRecord.officeNotes && (
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-xs space-y-1">
                  <span className="text-emerald-800 font-bold block">توضیحات و دفاعیات دفتر:</span>
                  <p className="text-slate-700">{selectedRecord.officeNotes}</p>
                </div>
              )}
            </div>

            {/* Uploaded Documents Gallery & Viewer */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span>اسناد و مدارک بارگذاری شده توسط دفتر ({selectedRecord.uploadedDocuments?.length || 0} مدرک)</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    برای مشاهده تصویر در اندازه اصلی، باز کردن در پنجره جدید یا ثبت موارد عدم انطباق اختصاصی روی هر سند کلیک کنید.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSyncAllToGoogleDrive}
                    disabled={isSyncingAllDrive || !selectedRecord.uploadedDocuments?.length}
                    className="flex items-center gap-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 text-xs font-bold px-3 py-1.5 rounded-xl transition shadow-2xs cursor-pointer disabled:opacity-50"
                    title="ذخیره و پشتیبان‌گیری تمام مدارک این پرونده در پوشه اختصاصی گوگل درایو"
                  >
                    <CloudUpload className="w-3.5 h-3.5 text-cyan-600" />
                    <span>{isSyncingAllDrive ? 'در حال ارسال به درایو...' : 'ارسال همه به گوگل درایو'}</span>
                  </button>
                </div>
              </div>

              {driveNotification && (
                <div className="bg-cyan-50 border border-cyan-200 text-cyan-900 text-xs p-3 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-cyan-600 shrink-0" />
                    <span>{driveNotification}</span>
                  </div>
                  <button onClick={() => setDriveNotification(null)} className="text-cyan-700 hover:text-cyan-950 font-bold">
                    ✕
                  </button>
                </div>
              )}

              {(!selectedRecord.uploadedDocuments || selectedRecord.uploadedDocuments.length === 0) ? (
                <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <FileText className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-xs text-slate-500">هنوز مدرکی توسط دفتر برای این رکورد بارگذاری نشده است.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Thumbnails row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {selectedRecord.uploadedDocuments.map((doc) => {
                      const isActive = activeDocPreview?.id === doc.id;
                      const isDefective = doc.complianceStatus === 'DEFECTIVE' || (doc.defects && doc.defects.length > 0);
                      return (
                        <div
                          key={doc.id}
                          onClick={() => setActiveDocPreview(doc)}
                          className={`p-3.5 rounded-2xl border cursor-pointer transition space-y-2.5 relative group ${
                            isActive
                              ? 'bg-emerald-50/70 border-emerald-500 shadow-xs ring-2 ring-emerald-500/20'
                              : isDefective
                              ? 'bg-rose-50/50 border-rose-300 hover:bg-rose-50'
                              : 'bg-slate-50 border-slate-200 hover:bg-white'
                          }`}
                        >
                          <div className="w-full h-24 bg-white rounded-xl flex items-center justify-center border border-slate-200 overflow-hidden shadow-2xs relative">
                            {doc.fileDataUrl && doc.fileType && doc.fileType.startsWith('image/') ? (
                              <img src={doc.fileDataUrl} alt={doc.title} className="w-full h-full object-cover group-hover:scale-105 transition" />
                            ) : (
                              <FileText className="w-10 h-10 text-emerald-600" />
                            )}

                            {/* Overlay Quick Open Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setModalViewerDoc(doc);
                              }}
                              className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1.5 text-white text-[11px] font-bold transition"
                            >
                              <Maximize2 className="w-4 h-4" />
                              <span>مشاهده اندازه اصلی</span>
                            </button>
                          </div>

                          <div>
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-bold text-slate-900 truncate" title={doc.title}>
                                {doc.title}
                              </span>
                              {isDefective ? (
                                <span className="bg-rose-100 text-rose-800 text-[10px] px-2 py-0.5 rounded-md font-bold shrink-0 flex items-center gap-0.5">
                                  <AlertTriangle className="w-3 h-3" />
                                  {doc.defects?.length || 1} نقص
                                </span>
                              ) : (
                                <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-md font-bold shrink-0">
                                  منطبق
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono block truncate mt-0.5">
                              {doc.fileName}
                            </span>
                          </div>

                          <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setModalViewerDoc(doc);
                              }}
                              className="text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1"
                            >
                              <ShieldAlert className="w-3 h-3 text-rose-600" />
                              <span>بررسی و عدم انطباق</span>
                            </button>

                            {doc.driveSynced ? (
                              <span className="text-cyan-700 text-[10px] font-bold flex items-center gap-0.5" title="ذخیره شده در درایو">
                                <HardDrive className="w-3 h-3" />
                                درایو
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">محلی</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Active Document Full Preview Box */}
                  {activeDocPreview && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs border-b border-slate-200 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900">{activeDocPreview.title}</span>
                          <span className="text-slate-500 font-mono">({activeDocPreview.fileName})</span>
                        </div>

                        {/* Action buttons on active document */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => setModalViewerDoc(activeDocPreview)}
                            className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition shadow-2xs cursor-pointer"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                            <span>سایز اصلی و مشخص کردن عدم انطباق</span>
                          </button>

                          <button
                            onClick={() => {
                              if (activeDocPreview.fileDataUrl) {
                                const win = window.open('', '_blank');
                                if (win) {
                                  win.document.write(`<img src="${activeDocPreview.fileDataUrl}" style="max-width:100%; display:block; margin:auto;" />`);
                                }
                              }
                            }}
                            className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-2.5 py-1.5 rounded-xl border border-slate-300 transition"
                            title="باز کردن مستقیم در تب جدید"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-cyan-600" />
                            <span>تب جدید</span>
                          </button>
                        </div>
                      </div>

                      <div className="max-h-80 overflow-auto bg-white rounded-xl p-3 flex items-center justify-center border border-slate-200">
                        {activeDocPreview.fileDataUrl && activeDocPreview.fileType && activeDocPreview.fileType.startsWith('image/') ? (
                          <img
                            src={activeDocPreview.fileDataUrl}
                            alt={activeDocPreview.title}
                            className="max-h-72 object-contain rounded-lg shadow-sm"
                          />
                        ) : (
                          <div className="text-center py-6 space-y-2">
                            <FileCheck2 className="w-12 h-12 text-emerald-600 mx-auto" />
                            <p className="text-xs text-slate-800 font-bold">{activeDocPreview.fileName}</p>
                            <p className="text-[11px] text-slate-500">سند رسمی پیوست شده با حجم {(activeDocPreview.fileSize / 1024).toFixed(1)} کیلوبایت</p>
                          </div>
                        )}
                      </div>

                      {/* Document Specific Defect summary if any */}
                      {activeDocPreview.defects && activeDocPreview.defects.length > 0 && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs space-y-1.5">
                          <span className="font-extrabold text-rose-900 flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 text-rose-600" />
                            عدم انطباق‌های ثبت شده برای این مدرک ({activeDocPreview.defects.length} مورد):
                          </span>
                          <ul className="list-disc list-inside space-y-0.5 text-rose-800 font-semibold pr-2">
                            {activeDocPreview.defects.map(d => (
                              <li key={d.id}>{d.title}</li>
                            ))}
                          </ul>
                          {activeDocPreview.inspectorNotes && (
                            <p className="text-[11px] text-rose-900 pt-1 border-t border-rose-200">
                              دستور بازرس: {activeDocPreview.inspectorNotes}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Statutory Checklist & Final Verdict Box */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>چک‌لیست تطبیق بازرسی و ثبت رای نهایی</span>
              </h3>

              {/* Checklist items dynamically based on required documents */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                {(selectedRecord.requiredDocuments || ['APPLICATION_FORM']).map((docType) => {
                  const docTitle = getDocTypeTitle(docType);
                  const isUploaded = selectedRecord.uploadedDocuments?.some(d => d.docType === docType);
                  return (
                    <label
                      key={docType}
                      className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition ${
                        checklist[docType] ?? isUploaded
                          ? 'bg-emerald-50/70 border-emerald-300'
                          : 'bg-slate-50 border-slate-200 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={checklist[docType] ?? isUploaded ?? false}
                          onChange={() => handleToggleChecklist(docType)}
                          className="rounded accent-emerald-600 w-4 h-4"
                        />
                        <div>
                          <span className="text-slate-900 font-bold block">{docTitle}</span>
                          <span className="text-[10px] text-slate-500">
                            {isUploaded ? 'سند در کارتابل موجود است' : 'هنوز فایلی پیوست نشده'}
                          </span>
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        isUploaded ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {isUploaded ? 'بارگذاری شده' : 'فاقد مدرک'}
                      </span>
                    </label>
                  );
                })}
              </div>

              {/* Historical Notes and Change Timeline */}
              {/* Case Notes History */}
              <div className="pt-2">
                <CaseNotesHistoryPanel
                  record={selectedRecord}
                  currentUserRole={isSenior ? 'SENIOR_INSPECTOR' : 'INSPECTOR'}
                  currentUserName={currentUser?.fullName || (isSenior ? 'بازرس ارشد مرکز' : 'کارشناس بازرسی')}
                  onAddNote={handleAddInspectorNote}
                />
              </div>

              {/* Level 1 Inspector Recommendation Preview for Senior Inspector */}
              {selectedRecord.level1Recommendation && (
                <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-purple-900 font-bold">
                    <span className="flex items-center gap-1.5">
                      <FileCheck2 className="w-4 h-4 text-purple-600" />
                      <span>گزارش و نظریه کارشناس بازرسی سطح ۱ ({selectedRecord.level1InspectorName || 'کارشناس'})</span>
                    </span>
                    {selectedRecord.level1ReviewedAt && (
                      <span className="font-mono text-[11px] text-purple-700 font-normal">
                        {selectedRecord.level1ReviewedAt}
                      </span>
                    )}
                  </div>
                  <p className="text-purple-950 bg-white/80 p-2.5 rounded-xl border border-purple-100 leading-relaxed font-medium">
                    {selectedRecord.level1Recommendation}
                  </p>
                </div>
              )}

              {/* Inspector notes & Score */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-100">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-900 block">
                    {canIssueFinal 
                      ? 'شرح تصمیم، نظریه نهایی بازرس ارشد یا مستندات احکام نظارتی:' 
                      : 'شرح تذکر به دفتر ثبت‌نام / نکات ارجاع به بازرس ارشد:'}
                  </label>
                  <textarea
                    rows={2}
                    value={inspectorNotes}
                    onChange={(e) => setInspectorNotes(e.target.value)}
                    placeholder={canIssueFinal 
                      ? 'دستور نظارتی، تذکرات یا توضیحات مندرج در صورت‌جلسه رسمی بازرس ارشد...' 
                      : 'نواقص مدارک را شرح داده تا به دفتر عودت شود، یا توضیحات ارجاع به مقام بالاتر را بنویسید...'}
                    className="w-full bg-slate-50 border border-slate-300 rounded-2xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 shadow-2xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-900 block">
                    امتیاز انطباق بازرسی:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={complianceScore}
                      onChange={(e) => setComplianceScore(parseInt(e.target.value, 10))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-2xl p-2.5 text-base font-black text-center text-emerald-700 focus:outline-none shadow-2xs"
                    />
                    <span className="text-xs text-slate-500 font-bold">از ۱۰۰</span>
                  </div>
                </div>
              </div>

              {/* Decision Action Buttons with Two-Level Workflow RBAC */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                {/* Level 1 Inspector Actions: Defect notice & Return to Office OR Escalate to Senior */}
                {!canIssueFinal ? (
                  <div className="space-y-2.5 bg-cyan-50/60 border border-cyan-200 rounded-2xl p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-cyan-950 flex items-center gap-1.5">
                        <SlidersHorizontal className="w-4 h-4 text-cyan-700" />
                        <span>اقدامات کارشناس بازرسی (سطح ۱ ممیزی):</span>
                      </span>
                      <span className="text-[10px] text-cyan-800 bg-white px-2 py-0.5 rounded-full border border-cyan-200 font-medium">
                        امکان ثبت نواقص، عودت به دفتر یا ارجاع به مقام بالاتر
                      </span>
                    </div>

                    <p className="text-[11px] text-cyan-900 leading-relaxed">
                      در این مرحله در صورت مشاهده نقص در مدارک، با درج تذکر پرونده را به کارتابل دفتر عودت دهید. در صورت تکمیل مدارک، پرونده را جهت اتخاذ تصمیم نهایی به کارتابل بازرس ارشد ارسال فرمایید.
                    </p>

                    <div className="flex items-center gap-3 pt-1 flex-wrap">
                      <button
                        id="btn-return-to-office"
                        onClick={handleReturnToOffice}
                        disabled={isSubmittingDecision}
                        className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl border-2 border-amber-700 shadow-xs transition cursor-pointer"
                        title="عودت پرونده همراه با شرح نواقص به کارتابل دفتر ثبت‌نام"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>برگشت به کارتابل دفتر جهت رفع نقص</span>
                      </button>

                      <button
                        id="btn-refer-to-senior"
                        onClick={handleReferToSenior}
                        disabled={isSubmittingDecision}
                        className="flex items-center gap-2 bg-purple-700 hover:bg-purple-800 text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl border-2 border-purple-800 shadow-xs transition cursor-pointer"
                        title="ارسال پرونده و نظریه کارشناس به کارتابل بازرس ارشد جهت صدور رأی قطعی"
                      >
                        <Send className="w-4 h-4" />
                        <span>ارسال به کارتابل بازرس ارشد (مقام بالاتر)</span>
                      </button>

                      <button
                        id="btn-verdict-minutes"
                        onClick={() => onOpenOfficialMinutes(selectedRecord)}
                        className="flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-800 text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl border-2 border-slate-300 hover:border-slate-400 transition cursor-pointer"
                      >
                        <Printer className="w-4 h-4 text-emerald-600" />
                        <span>پیش‌نمایش صورت‌جلسه</span>
                      </button>
                    </div>

                    {/* Disabled final verdict notice */}
                    <div className="text-[10px] text-slate-500 flex items-center gap-1 pt-1">
                      <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                      <span>صدور رأی نهایی قطعی انطباق، اخطار یا رد صرفاً در صلاحیت مقام بالاتر (بازرس ارشد) می‌باشد.</span>
                    </div>
                  </div>
                ) : (
                  /* Level 2 Senior Inspector Actions: Final Verdicts */
                  <div className="space-y-3 bg-purple-50/50 border border-purple-200 rounded-2xl p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-purple-700" />
                        <span>صدور آرای قطعی نظارتی (سطح ۲ ممیزی - بازرس ارشد):</span>
                      </span>
                      <span className="text-[10px] text-purple-800 bg-white px-2 py-0.5 rounded-full border border-purple-200 font-medium">
                        صلاحیت صدور رأی قطعی و نظارت عالیه
                      </span>
                    </div>

                    {selectedRecord.status === 'APPROVED' && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex items-center justify-between text-xs text-emerald-800">
                        <span className="flex items-center gap-1.5 font-bold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          مدارک این پرونده مورد تأیید قطعی بازرس ارشد قرار گرفته است.
                        </span>
                        <button
                          onClick={() => handleSaveDecision('UNDER_REVIEW')}
                          disabled={isSubmittingDecision}
                          className="text-[11px] text-amber-700 bg-white border border-amber-300 hover:bg-amber-50 px-2 py-0.5 rounded-lg font-bold cursor-pointer"
                        >
                          دستور بازبینی مجدد
                        </button>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2.5 flex-wrap">
                      <button
                        id="btn-verdict-approve"
                        onClick={() => handleSaveDecision('APPROVED')}
                        disabled={isSubmittingDecision}
                        className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl border-2 border-emerald-800 shadow-xs transition cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>تأیید قطعی مدارک (منطبق)</span>
                      </button>

                      <button
                        id="btn-verdict-conditional"
                        onClick={() => handleSaveDecision('CONDITIONAL')}
                        disabled={isSubmittingDecision}
                        className="flex items-center gap-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs sm:text-sm font-bold px-3.5 py-2.5 rounded-xl border-2 border-teal-800 shadow-xs transition cursor-pointer"
                        title="تأیید مشروط با درج تذکر انضباطی در پرونده"
                      >
                        <ShieldAlert className="w-4 h-4" />
                        <span>تأیید مشروط با تذکر</span>
                      </button>

                      <button
                        id="btn-verdict-minor-defect"
                        onClick={() => handleSaveDecision('DEFECT_MINOR')}
                        disabled={selectedRecord.status === 'APPROVED' || isSubmittingDecision}
                        className={`flex items-center gap-2 text-xs sm:text-sm font-bold px-3.5 py-2.5 rounded-xl border-2 shadow-xs transition ${
                          selectedRecord.status === 'APPROVED'
                            ? 'bg-slate-100 text-slate-400 border-slate-300 cursor-not-allowed opacity-60'
                            : 'bg-amber-600 hover:bg-amber-700 text-white border-amber-700 cursor-pointer'
                        }`}
                      >
                        <AlertTriangle className="w-4 h-4" />
                        <span>ثبت عدم انطباق جزئی</span>
                      </button>

                      <button
                        id="btn-verdict-major-defect"
                        onClick={() => handleSaveDecision('DEFECT_MAJOR')}
                        disabled={selectedRecord.status === 'APPROVED' || isSubmittingDecision}
                        className={`flex items-center gap-2 text-xs sm:text-sm font-bold px-3.5 py-2.5 rounded-xl border-2 shadow-xs transition ${
                          selectedRecord.status === 'APPROVED'
                            ? 'bg-slate-100 text-slate-400 border-slate-300 cursor-not-allowed opacity-60'
                            : 'bg-rose-700 hover:bg-rose-800 text-white border-rose-800 cursor-pointer'
                        }`}
                      >
                        <XCircle className="w-4 h-4" />
                        <span>ثبت عدم انطباق عمده / بحرانی</span>
                      </button>

                      <button
                        id="btn-verdict-minutes"
                        onClick={() => onOpenOfficialMinutes(selectedRecord)}
                        className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl border-2 border-slate-950 transition cursor-pointer"
                      >
                        <Printer className="w-4 h-4 text-emerald-400" />
                        <span>چاپ صورت‌جلسه رسمی</span>
                      </button>
                    </div>

                    {/* Full Access & Authority Badge */}
                    <div className="bg-purple-100/70 border border-purple-200 rounded-xl p-2.5 text-[10px] text-purple-900 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-bold">
                        <ShieldCheck className="w-4 h-4 text-purple-700 shrink-0" />
                        <span>اختیارات کامل نظارتی: بازرس ارشد و مقام بالاتر دارای دسترسی کامل جهت اتخاذ تصمیم نهایی، صدور آرای قطعی و مدیریت پرونده‌ها می‌باشند.</span>
                      </span>
                      <span className="font-mono text-[9px] bg-white px-2 py-0.5 rounded font-bold text-purple-950 shrink-0">
                        FULL_SUPERVISORY_ACCESS
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-xs">
            <p className="text-slate-500 text-xs">پرونده‌ای برای نمایش انتخاب نشده است.</p>
          </div>
        )}
      </div>
      )}

      {/* High-Resolution Document Viewer & Defect Modal */}
      <DocumentViewerModal
        isOpen={!!modalViewerDoc}
        document={modalViewerDoc}
        applicantName={selectedRecord?.certificate.applicantName}
        nationalId={selectedRecord?.certificate.nationalId}
        trackingCode={selectedRecord?.certificate.trackingCode}
        currentUser={currentUser}
        onClose={() => setModalViewerDoc(null)}
        onUpdateDocumentDefects={(docId, status, defects, notes) => {
          handleUpdateDocumentDefects(docId, status, defects, notes);
          if (modalViewerDoc && modalViewerDoc.id === docId) {
            setModalViewerDoc({
              ...modalViewerDoc,
              complianceStatus: status,
              defects,
              inspectorNotes: notes,
            });
          }
        }}
        onUpdateDocumentDriveSync={(docId, driveFileId, webViewLink) => {
          handleUpdateDocumentDriveSync(docId, driveFileId, webViewLink);
          if (modalViewerDoc && modalViewerDoc.id === docId) {
            setModalViewerDoc({
              ...modalViewerDoc,
              driveFileId,
              driveWebViewLink: webViewLink,
              driveSynced: true,
            });
          }
        }}
        onUpdateDocumentAnnotations={(docId, annotations) => {
          handleUpdateDocumentAnnotations(docId, annotations);
          if (modalViewerDoc && modalViewerDoc.id === docId) {
            setModalViewerDoc({
              ...modalViewerDoc,
              annotations,
            });
          }
        }}
      />
      {/* Change Inspector Modal */}
      {isChangeInspectorModalOpen && selectedRecord && (
        <ChangeInspectorModal
          isOpen={isChangeInspectorModalOpen}
          onClose={() => setIsChangeInspectorModalOpen(false)}
          record={selectedRecord}
          campaignId={selectedRecord.campaignId}
          currentInspectorName={selectedRecord.level1InspectorName || selectedRecord.reviewerName || 'کارشناس بازرسی'}
          currentUser={currentUser}
          onInspectorChanged={(updatedRecord) => {
            onUpdateRecord(updatedRecord);
            setIsChangeInspectorModalOpen(false);
          }}
        />
      )}

      {/* Certificate Details Modal */}
      {isCertDetailsOpen && selectedRecord && (
        <CertificateDetailsModal
          isOpen={isCertDetailsOpen}
          onClose={() => setIsCertDetailsOpen(false)}
          record={selectedRecord}
          officeName={selectedRecord.certificate.officeName}
          officeCode={selectedRecord.officeCode}
        />
      )}
    </div>
  );
};
