import React, { useState, useEffect } from 'react';
import { 
  X, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Maximize2, 
  ExternalLink, 
  Download, 
  CloudUpload, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert, 
  FileText, 
  Trash2, 
  Plus, 
  Sparkles,
  HardDrive,
  Eye,
  Check,
  History,
  Layers,
  Stamp,
  MessageSquare,
  FileCheck2,
  FileX2,
  Calendar,
  UserCheck
} from 'lucide-react';
import { UploadedDocument, DocumentDefectItem, DocumentType, DocumentVersion, DocumentAnnotation, DocumentPageItem } from '../types';
import { AppUser } from '../types/auth';
import { getDocTypeTitle } from '../utils/samplingEngine';
import { 
  STANDARD_DEFECT_CATALOG, 
  uploadDocumentToGoogleDrive 
} from '../utils/googleDriveService';
import { logDocumentAuditAction } from '../utils/fileSecurityService';

interface DocumentViewerModalProps {
  document: UploadedDocument | null;
  applicantName?: string;
  nationalId?: string;
  trackingCode?: string;
  currentUser?: AppUser | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateDocumentDefects?: (docId: string, status: 'COMPLIANT' | 'DEFECTIVE', defects: DocumentDefectItem[], inspectorNotes?: string) => void;
  onUpdateDocumentDriveSync?: (docId: string, driveFileId: string, webViewLink: string) => void;
  onUpdateDocumentAnnotations?: (docId: string, annotations: DocumentAnnotation[]) => void;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  document,
  applicantName,
  nationalId,
  trackingCode,
  currentUser,
  isOpen,
  onClose,
  onUpdateDocumentDefects,
  onUpdateDocumentDriveSync,
  onUpdateDocumentAnnotations,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'VIEWER' | 'DEFECTS'>('VIEWER');
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [driveSuccessMsg, setDriveSuccessMsg] = useState<string | null>(null);

  // Versioning state (defaults to latest document.version || 1)
  const [selectedVersionNum, setSelectedVersionNum] = useState<number>(document?.version || 1);

  // Multi-page state
  const [activePageIndex, setActivePageIndex] = useState<number>(0);

  // Annotations & Stamps state
  const [annotations, setAnnotations] = useState<DocumentAnnotation[]>(document?.annotations || []);
  const [showStampMenu, setShowStampMenu] = useState(false);
  const [customNoteInput, setCustomNoteInput] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);

  // Local defect state
  const [complianceStatus, setComplianceStatus] = useState<'COMPLIANT' | 'DEFECTIVE'>(
    document?.complianceStatus === 'DEFECTIVE' ? 'DEFECTIVE' : 'COMPLIANT'
  );
  const [selectedDefects, setSelectedDefects] = useState<DocumentDefectItem[]>(
    document?.defects || []
  );
  const [customDefectText, setCustomDefectText] = useState('');
  const [inspectorNotes, setInspectorNotes] = useState(document?.inspectorNotes || '');
  const [isSaved, setIsSaved] = useState(false);

  // Audit log when modal opens
  useEffect(() => {
    if (isOpen && document) {
      logDocumentAuditAction(
        currentUser || null,
        'DOCUMENT_VIEW',
        document.title,
        applicantName,
        `مشاهده سند (نسخه ${document.version || 1})`
      );
    }
  }, [isOpen, document?.id]);

  // Reset when document changes
  useEffect(() => {
    if (document) {
      setZoomLevel(100);
      setRotation(0);
      setSelectedVersionNum(document.version || 1);
      setActivePageIndex(0);
      setAnnotations(document.annotations || []);
      setComplianceStatus(document.complianceStatus === 'DEFECTIVE' ? 'DEFECTIVE' : 'COMPLIANT');
      setSelectedDefects(document.defects || []);
      setInspectorNotes(document.inspectorNotes || '');
      setCustomDefectText('');
      setDriveSuccessMsg(null);
      setIsSaved(false);
      setShowStampMenu(false);
      setShowNoteInput(false);
    }
  }, [document]);

  if (!isOpen || !document) return null;

  // Determine active version content
  const currentVersionNumber = document.version || 1;
  const isViewingHistoricalVersion = selectedVersionNum !== currentVersionNumber;
  const historicalVersion: DocumentVersion | undefined = isViewingHistoricalVersion
    ? (document.previousVersions || []).find((v) => v.version === selectedVersionNum)
    : undefined;

  // Resolved file properties
  const resolvedFileName = isViewingHistoricalVersion && historicalVersion
    ? historicalVersion.fileName
    : document.fileName;

  const resolvedFileType = isViewingHistoricalVersion && historicalVersion
    ? historicalVersion.fileType
    : document.fileType;

  const resolvedFileSize = isViewingHistoricalVersion && historicalVersion
    ? historicalVersion.fileSize
    : document.fileSize;

  // Multi-page handling
  const availablePages: DocumentPageItem[] = (!isViewingHistoricalVersion && document.pages) 
    ? document.pages 
    : (historicalVersion?.pages || []);

  const hasMultiplePages = availablePages.length > 0;

  // اگر تصویر محلی وجود نداشته باشد، استریم امن سرور را از طریق StorageService فراخوانی کن
  const rawFileSource = (activePageIndex > 0 && availablePages[activePageIndex - 1])
    ? availablePages[activePageIndex - 1].dataUrl
    : (isViewingHistoricalVersion && historicalVersion ? historicalVersion.fileDataUrl : document.fileDataUrl);

  const fileIdentifier = document.fileId || document.driveFileId;
  const resolvedFileDataUrl = rawFileSource || (
    fileIdentifier && !fileIdentifier.startsWith('pending-') && !fileIdentifier.startsWith('central-pending-') && !fileIdentifier.startsWith('gdrive-pending-')
      ? `/api/v1/files/${fileIdentifier}/view`
      : undefined
  );

  const catalog = STANDARD_DEFECT_CATALOG[document.docType] || [];

  // Zoom controls
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 25, 300));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 25, 50));
  const handleResetZoom = () => {
    setZoomLevel(100);
    setRotation(0);
  };
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  // Add Stamp / Annotation
  const handleAddStamp = (type: DocumentAnnotation['type'], label: string) => {
    const newAnnotation: DocumentAnnotation = {
      id: `stamp-${Date.now()}`,
      type,
      label,
      authorName: currentUser?.fullName || 'کارشناس بازرسی',
      authorRole: currentUser?.role || 'INSPECTOR',
      timestamp: new Date().toLocaleDateString('fa-IR') + ' ' + new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
    };

    const updated = [...annotations, newAnnotation];
    setAnnotations(updated);
    if (onUpdateDocumentAnnotations) {
      onUpdateDocumentAnnotations(document.id, updated);
    }
    setShowStampMenu(false);
  };

  const handleAddTextNote = () => {
    if (!customNoteInput.trim()) return;
    const newAnnotation: DocumentAnnotation = {
      id: `note-${Date.now()}`,
      type: 'TEXT_NOTE',
      label: 'یادداشت بازرس',
      comment: customNoteInput.trim(),
      authorName: currentUser?.fullName || 'کارشناس بازرسی',
      authorRole: currentUser?.role || 'INSPECTOR',
      timestamp: new Date().toLocaleDateString('fa-IR') + ' ' + new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
    };

    const updated = [...annotations, newAnnotation];
    setAnnotations(updated);
    if (onUpdateDocumentAnnotations) {
      onUpdateDocumentAnnotations(document.id, updated);
    }
    setCustomNoteInput('');
    setShowNoteInput(false);
  };

  const handleRemoveAnnotation = (id: string) => {
    const updated = annotations.filter((a) => a.id !== id);
    setAnnotations(updated);
    if (onUpdateDocumentAnnotations) {
      onUpdateDocumentAnnotations(document.id, updated);
    }
  };

  // Open in real new window / tab with full original size
  const handleOpenInNewTab = () => {
    if (resolvedFileDataUrl) {
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(`
          <!DOCTYPE html>
          <html dir="rtl" lang="fa">
            <head>
              <meta charset="utf-8" />
              <title>${document.title} - ${resolvedFileName}</title>
              <style>
                body {
                  margin: 0;
                  padding: 20px;
                  background-color: #0f172a;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  min-height: 100vh;
                  font-family: system-ui, -apple-system, sans-serif;
                  color: white;
                }
                .header {
                  width: 100%;
                  max-width: 1000px;
                  margin-bottom: 16px;
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  border-bottom: 1px solid #334155;
                  padding-bottom: 12px;
                }
                .img-container {
                  max-width: 95vw;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                }
                img {
                  max-width: 100%;
                  height: auto;
                  border-radius: 8px;
                  box-shadow: 0 10px 25px rgba(0,0,0,0.5);
                }
              </style>
            </head>
            <body>
              <div class="header">
                <div>
                  <h2 style="margin: 0; font-size: 18px;">${document.title} (نسخه ${selectedVersionNum})</h2>
                  <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8;">${resolvedFileName} (${(resolvedFileSize / 1024).toFixed(1)} KB)</p>
                </div>
                <button onclick="window.print()" style="background:#059669; color:white; border:none; padding:8px 16px; border-radius:6px; font-weight:bold; cursor:pointer;">
                  چاپ سند
                </button>
              </div>
              <div class="img-container">
                <img src="${resolvedFileDataUrl}" alt="${document.title}" />
              </div>
            </body>
          </html>
        `);
        newWindow.document.close();
      }
    } else if (document.driveWebViewLink) {
      window.open(document.driveWebViewLink, '_blank');
    }
  };

  // Direct download with audit logging
  const handleDownload = () => {
    if (resolvedFileDataUrl) {
      logDocumentAuditAction(
        currentUser || null,
        'DOCUMENT_DOWNLOAD',
        document.title,
        applicantName,
        `دانلود نسخه ${selectedVersionNum} - فایل ${resolvedFileName}`
      );

      const link = window.document.createElement('a');
      link.href = resolvedFileDataUrl;
      link.download = resolvedFileName || `document_${document.docType}.png`;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
    }
  };

  // Google Drive Sync
  const handleSyncToGoogleDrive = async () => {
    setIsSyncingDrive(true);
    try {
      const driveRes = await uploadDocumentToGoogleDrive(document, {
        applicantId: nationalId || applicantName,
      });
      if (driveRes.syncStatus === 'uploaded' || (driveRes.syncStatus as any) === 'SUCCESS') {
        setDriveSuccessMsg('مدرک با موفقیت در مخزن متمرکز ذخیره و شناسه ثبت گردید.');
      } else {
        setDriveSuccessMsg(driveRes.errorMessage || 'درخواست در صف ارسال به مخزن قرار گرفت.');
      }
      if (onUpdateDocumentDriveSync) {
        onUpdateDocumentDriveSync(document.id, driveRes.driveFileId, driveRes.driveWebViewLink || '');
      }
    } catch (err: any) {
      setDriveSuccessMsg('خطا در اتصال به سرویس Google Drive مرکزی: ' + (err.message || ''));
    } finally {
      setIsSyncingDrive(false);
    }
  };

  // Toggle standard defect catalog item
  const handleToggleDefectCatalog = (item: { code: string; title: string; severity: 'CRITICAL' | 'MAJOR' | 'MINOR' }) => {
    const exists = selectedDefects.some((d) => d.code === item.code);
    if (exists) {
      setSelectedDefects((prev) => prev.filter((d) => d.code !== item.code));
    } else {
      setSelectedDefects((prev) => [
        ...prev,
        {
          id: `defect-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          code: item.code,
          title: item.title,
          severity: item.severity,
        },
      ]);
      setComplianceStatus('DEFECTIVE');
    }
    setIsSaved(false);
  };

  // Add custom defect
  const handleAddCustomDefect = () => {
    if (!customDefectText.trim()) return;
    const newDefect: DocumentDefectItem = {
      id: `custom-${Date.now()}`,
      code: 'CUSTOM_DEFECT',
      title: customDefectText.trim(),
      severity: 'MAJOR',
    };
    setSelectedDefects((prev) => [...prev, newDefect]);
    setCustomDefectText('');
    setComplianceStatus('DEFECTIVE');
    setIsSaved(false);
  };

  // Remove defect
  const handleRemoveDefect = (id: string) => {
    setSelectedDefects((prev) => prev.filter((d) => d.id !== id));
    setIsSaved(false);
  };

  // Save defects
  const [isSavingDefect, setIsSavingDefect] = useState(false);

  const handleSaveDefects = () => {
    if (isSavingDefect) return;

    if (complianceStatus === 'DEFECTIVE' && selectedDefects.length === 0 && !inspectorNotes.trim()) {
      alert('لطفاً حداقل یک بند عدم انطباق را انتخاب نموده یا شرح نقص را در یادداشت وارد فرمایید.');
      return;
    }

    setIsSavingDefect(true);
    if (onUpdateDocumentDefects) {
      onUpdateDocumentDefects(
        document.id,
        complianceStatus,
        complianceStatus === 'COMPLIANT' ? [] : selectedDefects,
        inspectorNotes
      );
    }
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      setIsSavingDefect(false);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header Bar */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900">{document.title}</h2>
                <span className="bg-slate-100 text-slate-700 text-[11px] px-2.5 py-0.5 rounded-full font-bold border border-slate-200">
                  {getDocTypeTitle(document.docType)}
                </span>
                {document.driveSynced && (
                  <span className="bg-cyan-50 text-cyan-800 text-[10px] px-2 py-0.5 rounded-full font-bold border border-cyan-200 flex items-center gap-1">
                    <HardDrive className="w-3 h-3 text-cyan-600" />
                    ذخیره در گوگل درایو
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                متقاضی: <strong className="text-slate-700">{applicantName || 'ثبت نشده'}</strong>
                {nationalId && ` | کدملی: ${nationalId}`}
                {trackingCode && ` | رهگیری: ${trackingCode}`}
              </p>
            </div>
          </div>

          {/* Action Tabs & Close */}
          <div className="flex items-center gap-2.5">
            <div className="bg-slate-100 p-1 rounded-2xl flex items-center gap-1 border border-slate-200">
              <button
                onClick={() => setActiveTab('VIEWER')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === 'VIEWER'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>نمایشگر سند اصلی</span>
              </button>

              <button
                onClick={() => setActiveTab('DEFECTS')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === 'DEFECTS'
                    ? 'bg-white text-rose-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                <span>بررسی عدم انطباق این مدرک</span>
                {selectedDefects.length > 0 && (
                  <span className="bg-rose-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                    {selectedDefects.length}
                  </span>
                )}
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-2xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
              title="بستن پنجره"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row bg-slate-50">
          
          {/* TAB 1: High-Res Document Viewer with Zoom & Rotate */}
          {activeTab === 'VIEWER' ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              
              {/* Toolbar */}
              <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex items-center justify-between flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleZoomIn}
                    className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold flex items-center gap-1 shadow-2xs transition cursor-pointer"
                    title="بزرگ‌نمایی (+)"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>

                  <button
                    onClick={handleZoomOut}
                    className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold flex items-center gap-1 shadow-2xs transition cursor-pointer"
                    title="کوچک‌نمایی (-)"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>

                  <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 text-[11px]">
                    {zoomLevel}%
                  </span>

                  <button
                    onClick={handleResetZoom}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-[11px] shadow-2xs transition cursor-pointer"
                    title="بازنشانی اندازه به ۱۰۰٪"
                  >
                    اندازه اصلی
                  </button>

                  <button
                    onClick={handleRotate}
                    className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold flex items-center gap-1 shadow-2xs transition cursor-pointer"
                    title="چرخش ۹۰ درجه"
                  >
                    <RotateCw className="w-4 h-4" />
                    <span>چرخش</span>
                  </button>

                  <div className="h-4 w-px bg-slate-200 mx-1" />

                  {/* Inspector Markup & Stamp Tools */}
                  <div className="relative">
                    <button
                      onClick={() => setShowStampMenu(!showStampMenu)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold transition shadow-2xs cursor-pointer"
                      title="ثبت مهر و علامت‌گذاری بازرس روی تصویر سند"
                    >
                      <Stamp className="w-3.5 h-3.5 text-indigo-600" />
                      <span>مهرهای بازرسی</span>
                      {annotations.length > 0 && (
                        <span className="bg-indigo-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                          {annotations.length}
                        </span>
                      )}
                    </button>

                    {showStampMenu && (
                      <div className="absolute top-full right-0 mt-1.5 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 space-y-1.5 animate-in fade-in">
                        <div className="px-2 py-1 text-[11px] font-extrabold text-slate-500 border-b border-slate-100">
                          افزودن مهر یا علامت بازرسی:
                        </div>
                        <button
                          onClick={() => handleAddStamp('STAMP_APPROVED', 'تأیید اصالت و انطباق مدرک')}
                          className="w-full text-right px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-800 hover:bg-emerald-50 flex items-center gap-2 transition"
                        >
                          <FileCheck2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>مهر تأیید اصالت مدرک</span>
                        </button>
                        <button
                          onClick={() => handleAddStamp('STAMP_DEFECTIVE', 'نقص مدرک: مغایرت اطلاعات')}
                          className="w-full text-right px-3 py-1.5 rounded-xl text-xs font-bold text-rose-800 hover:bg-rose-50 flex items-center gap-2 transition"
                        >
                          <FileX2 className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>مهر نقص - مغایرت اطلاعات</span>
                        </button>
                        <button
                          onClick={() => handleAddStamp('STAMP_ILLEGIBLE', 'نقص مدرک: تصویر ناخوانا/تار')}
                          className="w-full text-right px-3 py-1.5 rounded-xl text-xs font-bold text-amber-800 hover:bg-amber-50 flex items-center gap-2 transition"
                        >
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>مهر نقص - تصویر تار و ناخوانا</span>
                        </button>
                        <button
                          onClick={() => handleAddStamp('STAMP_SIGNATURE_MISMATCH', 'مغایرت امضا و اثر انگشت')}
                          className="w-full text-right px-3 py-1.5 rounded-xl text-xs font-bold text-purple-800 hover:bg-purple-50 flex items-center gap-2 transition"
                        >
                          <Stamp className="w-4 h-4 text-purple-600 shrink-0" />
                          <span>مهر مغایرت امضا / اثرانگشت</span>
                        </button>
                        <div className="pt-1 border-t border-slate-100">
                          <button
                            onClick={() => {
                              setShowStampMenu(false);
                              setShowNoteInput(true);
                            }}
                            className="w-full text-right px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-2 transition"
                          >
                            <MessageSquare className="w-4 h-4 text-slate-600 shrink-0" />
                            <span>ثبت یادداشت و دستور بازرس</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Open in real new window full size */}
                  <button
                    onClick={handleOpenInNewTab}
                    className="flex items-center gap-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 px-3 py-1.5 rounded-xl font-bold shadow-2xs transition cursor-pointer"
                    title="باز کردن در تب/پنجره جدید با ابعاد ۱۰۰٪ کامل"
                  >
                    <ExternalLink className="w-4 h-4 text-cyan-600" />
                    <span>باز کردن در پنجره جدید (سایز ۱۰۰٪)</span>
                  </button>

                  {/* Google Drive upload & sync */}
                  <button
                    onClick={handleSyncToGoogleDrive}
                    disabled={isSyncingDrive}
                    className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-xl font-bold shadow-2xs transition cursor-pointer disabled:opacity-50"
                  >
                    <CloudUpload className="w-4 h-4 text-emerald-600" />
                    <span>{isSyncingDrive ? 'در حال ارسال...' : 'ارسال به گوگل درایو'}</span>
                  </button>

                  {/* Download */}
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 px-3 py-1.5 rounded-xl font-bold shadow-2xs transition cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>دانلود فایل</span>
                  </button>
                </div>
              </div>

              {/* Version History Selector Banner */}
              {document.previousVersions && document.previousVersions.length > 0 && (
                <div className="bg-amber-50/90 border-b border-amber-200 px-6 py-2 flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-amber-700" />
                    <span className="font-extrabold text-amber-950 text-xs">تاریخچه و نسخه‌های این مدرک:</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setSelectedVersionNum(document.version || 1)}
                        className={`px-3 py-1 rounded-xl font-extrabold text-xs transition cursor-pointer ${
                          selectedVersionNum === (document.version || 1)
                            ? 'bg-amber-700 text-white shadow-xs'
                            : 'bg-white text-amber-950 hover:bg-amber-100 border border-amber-300'
                        }`}
                      >
                        نسخه جاری (نسخه {document.version || 1})
                      </button>
                      {document.previousVersions.map((ver) => (
                        <button
                          key={ver.version}
                          onClick={() => setSelectedVersionNum(ver.version)}
                          className={`px-3 py-1 rounded-xl font-extrabold text-xs transition cursor-pointer ${
                            selectedVersionNum === ver.version
                              ? 'bg-amber-700 text-white shadow-xs'
                              : 'bg-white text-amber-950 hover:bg-amber-100 border border-amber-300'
                          }`}
                        >
                          نسخه {ver.version} ({ver.uploadDate})
                        </button>
                      ))}
                    </div>
                  </div>
                  {isViewingHistoricalVersion && (
                    <span className="bg-amber-200 text-amber-950 font-black px-2.5 py-0.5 rounded-lg text-[11px] border border-amber-300">
                      در حال مشاهده نسخه بایگانی‌شده قبلی (آرشیو ممیزی)
                    </span>
                  )}
                </div>
              )}

              {/* Multi-page Selector Banner */}
              {hasMultiplePages && (
                <div className="bg-slate-100/90 border-b border-slate-200 px-6 py-2 flex items-center gap-2 text-xs">
                  <Layers className="w-4 h-4 text-slate-700" />
                  <span className="font-extrabold text-slate-800">برگه‌های مدرک چندصفحه‌ای:</span>
                  <button
                    onClick={() => setActivePageIndex(0)}
                    className={`px-3 py-1 rounded-xl font-bold text-xs transition cursor-pointer ${
                      activePageIndex === 0 
                        ? 'bg-slate-800 text-white shadow-xs' 
                        : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    برگه اصلی (صفحه ۱)
                  </button>
                  {availablePages.map((page, idx) => (
                    <button
                      key={page.pageNumber}
                      onClick={() => setActivePageIndex(idx + 1)}
                      className={`px-3 py-1 rounded-xl font-bold text-xs transition cursor-pointer ${
                        activePageIndex === idx + 1 
                          ? 'bg-slate-800 text-white shadow-xs' 
                          : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      صفحه {page.pageNumber}
                    </button>
                  ))}
                </div>
              )}

              {/* Custom Note Input Dialog Bar */}
              {showNoteInput && (
                <div className="bg-indigo-50 border-b border-indigo-200 px-6 py-2.5 flex items-center gap-3 text-xs">
                  <MessageSquare className="w-4 h-4 text-indigo-700 shrink-0" />
                  <span className="font-bold text-indigo-950 shrink-0">ثبت یادداشت بازرس:</span>
                  <input
                    type="text"
                    value={customNoteInput}
                    onChange={(e) => setCustomNoteInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddTextNote(); }}
                    placeholder="متن یادداشت یا تذکر کارشناس بازرسی روی این سند..."
                    className="flex-1 bg-white border border-indigo-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    onClick={handleAddTextNote}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-1.5 rounded-xl transition"
                  >
                    ثبت یادداشت
                  </button>
                  <button
                    onClick={() => setShowNoteInput(false)}
                    className="text-slate-500 hover:text-slate-800 px-2 py-1.5 font-bold"
                  >
                    انصراف
                  </button>
                </div>
              )}

              {/* Success alert */}
              {driveSuccessMsg && (
                <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2 text-xs text-emerald-800 font-semibold flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{driveSuccessMsg}</span>
                  </div>
                  <button onClick={() => setDriveSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-900">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Viewport Canvas */}
              <div className="flex-1 overflow-auto p-6 flex items-center justify-center bg-slate-900/90 relative">
                {resolvedFileDataUrl && (resolvedFileType?.startsWith('image/') || resolvedFileName?.match(/\.(jpg|jpeg|png|webp)$/i)) ? (
                  <div 
                    className="transition-transform duration-150 origin-center relative inline-block"
                    style={{
                      transform: `scale(${zoomLevel / 100}) rotate(${rotation}deg)`,
                    }}
                  >
                    <img
                      src={resolvedFileDataUrl}
                      alt={document.title}
                      className="max-w-none rounded-xl shadow-2xl border-4 border-slate-800 bg-white"
                    />

                    {/* Render Overlaid Stamps & Annotations on Image */}
                    {annotations.length > 0 && (
                      <div className="absolute inset-0 pointer-events-none p-4 flex flex-col items-start gap-2 justify-start">
                        {annotations.map((ann) => (
                          <div
                            key={ann.id}
                            className={`pointer-events-auto rounded-2xl p-2.5 shadow-xl border-2 backdrop-blur-md text-right max-w-xs transition flex items-start justify-between gap-2 ${
                              ann.type === 'STAMP_APPROVED'
                                ? 'bg-emerald-600/90 border-emerald-300 text-white'
                                : ann.type === 'STAMP_DEFECTIVE'
                                ? 'bg-rose-600/90 border-rose-300 text-white'
                                : ann.type === 'STAMP_ILLEGIBLE'
                                ? 'bg-amber-600/90 border-amber-300 text-white'
                                : ann.type === 'STAMP_SIGNATURE_MISMATCH'
                                ? 'bg-purple-600/90 border-purple-300 text-white'
                                : 'bg-slate-900/90 border-slate-400 text-white'
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-1.5">
                                <Stamp className="w-3.5 h-3.5 shrink-0" />
                                <span className="font-black text-xs">{ann.label}</span>
                              </div>
                              {ann.comment && (
                                <p className="text-[11px] mt-1 text-slate-100 font-medium leading-relaxed bg-black/20 p-1.5 rounded-lg">
                                  {ann.comment}
                                </p>
                              )}
                              <div className="text-[10px] text-white/80 mt-1 flex items-center gap-1">
                                <span>{ann.authorName}</span>
                                <span>•</span>
                                <span>{ann.timestamp}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleRemoveAnnotation(ann.id)}
                              className="text-white/80 hover:text-white p-1 hover:bg-white/20 rounded-lg transition"
                              title="حذف این مهر/علامت"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white rounded-3xl p-10 max-w-lg text-center space-y-4 shadow-xl border border-slate-200">
                    <FileText className="w-16 h-16 text-emerald-600 mx-auto" />
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">{resolvedFileName}</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        سند پیوست با حجم {(resolvedFileSize / 1024).toFixed(1)} کیلوبایت (نسخه {selectedVersionNum})
                      </p>
                    </div>

                    {/* Render Annotations on Non-Image Documents */}
                    {annotations.length > 0 && (
                      <div className="space-y-1.5 pt-2 text-right">
                        <span className="text-xs font-bold text-slate-700 block">مهرهای کارشناسی ثبت‌شده:</span>
                        {annotations.map((ann) => (
                          <div
                            key={ann.id}
                            className="bg-slate-50 border border-slate-200 rounded-xl p-2 flex items-center justify-between text-xs"
                          >
                            <span className="font-bold text-slate-800">{ann.label}</span>
                            <button
                              onClick={() => handleRemoveAnnotation(ann.id)}
                              className="text-rose-600 hover:text-rose-800"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="pt-2 flex justify-center gap-3">
                      <button
                        onClick={handleOpenInNewTab}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer"
                      >
                        مشاهده در پنجره جدید
                      </button>
                      <button
                        onClick={handleDownload}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-4 py-2 rounded-xl border border-slate-300 transition cursor-pointer"
                      >
                        دانلود مستقیم
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* TAB 2: Per-Document Non-Compliance Definition Panel */
            <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full space-y-6">
              
              {/* Status Selector */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-emerald-600" />
                  <span>تعیین وضعیت انطباق مدرک «{document.title}»</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      setComplianceStatus('COMPLIANT');
                      setSelectedDefects([]);
                      setIsSaved(false);
                    }}
                    className={`p-4 rounded-2xl border text-right transition cursor-pointer flex items-start gap-3 ${
                      complianceStatus === 'COMPLIANT'
                        ? 'bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-500/20'
                        : 'bg-slate-50 border-slate-200 hover:bg-white'
                    }`}
                  >
                    <CheckCircle2 className={`w-5 h-5 mt-0.5 shrink-0 ${complianceStatus === 'COMPLIANT' ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">سند منطبق و تایید شده</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">سند فاقد نقص بوده و تمامی شرایط قانونی و اصالت را دارا می‌باشد.</p>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setComplianceStatus('DEFECTIVE');
                      setIsSaved(false);
                    }}
                    className={`p-4 rounded-2xl border text-right transition cursor-pointer flex items-start gap-3 ${
                      complianceStatus === 'DEFECTIVE'
                        ? 'bg-rose-50/80 border-rose-400 ring-2 ring-rose-500/20'
                        : 'bg-slate-50 border-slate-200 hover:bg-white'
                    }`}
                  >
                    <AlertTriangle className={`w-5 h-5 mt-0.5 shrink-0 ${complianceStatus === 'DEFECTIVE' ? 'text-rose-600' : 'text-slate-400'}`} />
                    <div>
                      <h4 className="text-xs font-bold text-rose-900">دارای عدم انطباق / نقص قانونی</h4>
                      <p className="text-[11px] text-rose-700/80 mt-0.5">سند دارای نقص بوده و نیازمند ثبت جزئیات عدم انطباق و اصلاح است.</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Defect Items Catalog */}
              {complianceStatus === 'DEFECTIVE' && (
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      <span>موارد استاندارد عدم انطباق برای {getDocTypeTitle(document.docType)}:</span>
                    </h3>
                    <span className="text-xs text-rose-700 font-bold bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                      {selectedDefects.length} مورد ثبت شده
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {catalog.map((item) => {
                      const isSelected = selectedDefects.some((d) => d.code === item.code);
                      return (
                        <button
                          key={item.code}
                          onClick={() => handleToggleDefectCatalog(item)}
                          className={`p-3 rounded-2xl border text-right transition cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'bg-rose-50 border-rose-300 text-rose-900 font-bold'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded-md flex items-center justify-center border ${
                              isSelected ? 'bg-rose-600 border-rose-600 text-white' : 'border-slate-300 bg-white'
                            }`}>
                              {isSelected && <Check className="w-3 h-3" />}
                            </div>
                            <span className="text-xs">{item.title}</span>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                            item.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-800' :
                            item.severity === 'MAJOR' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'
                          }`}>
                            {item.severity === 'CRITICAL' ? 'بحرانی' : item.severity === 'MAJOR' ? 'عمده' : 'جزئی'}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Add Custom Defect */}
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <label className="text-xs font-bold text-slate-900 block">
                      ثبت عنوان عدم انطباق سفارشی یا موردی:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={customDefectText}
                        onChange={(e) => setCustomDefectText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddCustomDefect(); }}
                        placeholder="شرح عدم انطباق جدید را بنویسید..."
                        className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-500 shadow-2xs"
                      />
                      <button
                        onClick={handleAddCustomDefect}
                        className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 transition"
                      >
                        <Plus className="w-4 h-4" />
                        <span>افزودن</span>
                      </button>
                    </div>
                  </div>

                  {/* Selected Defect List Display */}
                  {selectedDefects.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <h4 className="text-xs font-extrabold text-slate-800">لیست نواقص ثبت شده برای این مدرک:</h4>
                      <div className="space-y-1.5">
                        {selectedDefects.map((defect) => (
                          <div
                            key={defect.id}
                            className="bg-rose-50/70 border border-rose-200 rounded-xl p-2.5 flex items-center justify-between text-xs"
                          >
                            <span className="font-semibold text-rose-900">{defect.title}</span>
                            <button
                              onClick={() => handleRemoveDefect(defect.id)}
                              className="text-rose-400 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-100 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Inspector Specific Notes on this document */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-2">
                <label className="text-xs font-extrabold text-slate-900 block">
                  توضیحات و دستور اقدام بازرس برای این مدرک:
                </label>
                <textarea
                  rows={3}
                  value={inspectorNotes}
                  onChange={(e) => {
                    setInspectorNotes(e.target.value);
                    setIsSaved(false);
                  }}
                  placeholder="دستور اصلاح، توضیحات تکمیلی یا تذکر به دفتر در مورد این مدرک..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-2xl p-3 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 shadow-2xs"
                />
              </div>

              {/* Save Button */}
              <div className="flex items-center justify-between gap-4 pt-2">
                <div className="text-xs text-slate-500">
                  {isSaved && (
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      نتایج بررسی با موفقیت ثبت و ذخیره شد.
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveTab('VIEWER')}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition"
                  >
                    بازگشت به نمایشگر
                  </button>

                  <button
                    onClick={handleSaveDefects}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-xs transition flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>ثبت و اعمال بررسی این مدرک</span>
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
