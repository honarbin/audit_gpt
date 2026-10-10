import React, { useState } from 'react';
import { 
  MessageSquare, 
  Send, 
  User, 
  Shield, 
  Cpu, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle,
  History,
  FileCheck,
  Tag,
  ShieldCheck,
  Award
} from 'lucide-react';
import { CaseNoteEntry, AuditInspectionRecord, InspectionStatus } from '../types';

interface CaseNotesHistoryPanelProps {
  record: AuditInspectionRecord;
  currentUserRole: 'OFFICE_USER' | 'INSPECTOR' | 'SENIOR_INSPECTOR' | 'SYSTEM_ADMIN';
  currentUserName: string;
  onAddNote: (newNote: CaseNoteEntry) => void;
  readOnly?: boolean;
}

export const CaseNotesHistoryPanel: React.FC<CaseNotesHistoryPanelProps> = ({
  record,
  currentUserRole,
  currentUserName,
  onAddNote,
  readOnly = false,
}) => {
  const [inputText, setInputText] = useState('');

  // Fallback initial entries if notesHistory is empty but officeNotes or inspectorNotes exist
  const historyEntries: CaseNoteEntry[] = record.notesHistory && record.notesHistory.length > 0
    ? record.notesHistory
    : [
        ...(record.officeNotes ? [{
          id: 'legacy-off-1',
          authorRole: 'OFFICE_USER' as const,
          authorName: 'کاربر دفتر ثبت‌نام',
          text: record.officeNotes,
          timestamp: record.submittedAt || '1405/05/20 10:00',
          statusAtTime: record.status,
          actionType: 'NOTE' as const,
        }] : []),
        ...(record.inspectorNotes ? [{
          id: 'legacy-insp-1',
          authorRole: 'INSPECTOR' as const,
          authorName: record.reviewerName || 'کارشناس بازرسی مرکز میانی',
          text: record.inspectorNotes,
          timestamp: record.reviewDate || '1405/05/22 14:30',
          statusAtTime: record.status,
          actionType: 'VERDICT' as const,
        }] : []),
      ];

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const now = new Date();
    const datePart = new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
    const timePart = new Intl.DateTimeFormat('fa-IR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);
    const timestampStr = `${datePart} ${timePart}`;

    const newEntry: CaseNoteEntry = {
      id: `note-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      authorRole: currentUserRole === 'SENIOR_INSPECTOR' || currentUserRole === 'SYSTEM_ADMIN'
        ? 'SENIOR_INSPECTOR'
        : currentUserRole === 'OFFICE_USER'
        ? 'OFFICE_USER'
        : 'INSPECTOR',
      authorName: currentUserName,
      text: inputText.trim(),
      timestamp: timestampStr,
      statusAtTime: record.status,
      actionType: 'NOTE',
      auditLevel: currentUserRole === 'SENIOR_INSPECTOR' || currentUserRole === 'SYSTEM_ADMIN' ? 'LEVEL_2_SENIOR' : 'LEVEL_1_SPECIALIST',
    };

    onAddNote(newEntry);
    setInputText('');
  };

  const getStatusLabel = (s?: InspectionStatus) => {
    switch (s) {
      case 'PENDING_UPLOAD': return { text: 'در انتظار مدارک', color: 'bg-slate-100 text-slate-700' };
      case 'UPLOADED': return { text: 'بارگذاری شده', color: 'bg-blue-100 text-blue-800' };
      case 'RETURNED_TO_OFFICE': return { text: 'برگشت به دفتر جهت رفع نقص', color: 'bg-amber-100 text-amber-900 border border-amber-300' };
      case 'REFERRED_TO_SENIOR': return { text: 'ارجاع به بازرس ارشد (سطح ۲)', color: 'bg-indigo-100 text-indigo-900 border border-indigo-300' };
      case 'APPROVED': return { text: 'تایید قطعی انطباق', color: 'bg-emerald-100 text-emerald-800' };
      case 'CONDITIONAL': return { text: 'تایید مشروط با تذکر', color: 'bg-teal-100 text-teal-800' };
      case 'DEFECT_MINOR': return { text: 'عدم انطباق جزئی', color: 'bg-amber-100 text-amber-800' };
      case 'DEFECT_MAJOR': return { text: 'عدم انطباق عمده / بحرانی', color: 'bg-rose-100 text-rose-800' };
      default: return { text: 'بررسی پرونده', color: 'bg-slate-100 text-slate-700' };
    }
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-3xl p-4 sm:p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-200">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-900">
              روند تغییرات، مکاتبات و یادداشت‌های پرونده
            </h4>
            <p className="text-[11px] text-slate-500">
              ثبت تاریخچه توضیحات دفتر و ارزیابی بازرس با برچسب زمان و وضعیت پرونده
            </p>
          </div>
        </div>
        <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-full">
          {historyEntries.length} یادداشت / تغییر
        </span>
      </div>

      {/* History Log Stream */}
      <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
        {historyEntries.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs bg-white rounded-2xl border border-dashed border-slate-200">
            تاکنون یادداشت یا تغییری برای این پرونده ثبت نشده است. اولین یادداشت را وارد کنید.
          </div>
        ) : (
          historyEntries.map((entry) => {
            const isOffice = entry.authorRole === 'OFFICE_USER';
            const isInspector = entry.authorRole === 'INSPECTOR';
            const isSenior = entry.authorRole === 'SENIOR_INSPECTOR';
            const isSystem = entry.authorRole === 'SYSTEM';
            const statusInfo = getStatusLabel(entry.statusAtTime);

            return (
              <div
                key={entry.id}
                className={`p-3.5 rounded-2xl border transition text-xs space-y-2 ${
                  isSenior
                    ? 'bg-purple-50/80 border-purple-300 text-purple-950 ml-2 shadow-2xs'
                    : isInspector
                    ? 'bg-blue-50/70 border-blue-200 text-blue-950 ml-2'
                    : isOffice
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950 mr-2'
                    : 'bg-slate-100/90 border-slate-300 text-slate-800'
                }`}
              >
                {/* Meta Header */}
                <div className="flex items-center justify-between text-[11px] flex-wrap gap-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    {isSenior && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-700 text-white rounded-lg text-[10px] font-black shadow-2xs">
                        <Award className="w-3 h-3 text-amber-300" />
                        بازرس ارشد (سطح ۲)
                      </span>
                    )}
                    {isInspector && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-600 text-white rounded-lg text-[10px]">
                        <Shield className="w-3 h-3" />
                        کارشناس بازرسی (سطح ۱)
                      </span>
                    )}
                    {isOffice && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-700 text-white rounded-lg text-[10px]">
                        <User className="w-3 h-3" />
                        کاربر دفتر
                      </span>
                    )}
                    {isSystem && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-700 text-white rounded-lg text-[10px]">
                        <Cpu className="w-3 h-3" />
                        سامانه هوشمند
                      </span>
                    )}
                    <span className="text-slate-800 font-extrabold">{entry.authorName}</span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-500 text-[10px]">
                    {entry.statusAtTime && (
                      <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${statusInfo.color}`}>
                        وضعیت: {statusInfo.text}
                      </span>
                    )}
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {entry.timestamp}
                    </span>
                  </div>
                </div>

                {/* Content Text */}
                <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-medium">
                  {entry.text}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* Input Form if not readonly */}
      {!readOnly && (
        <form onSubmit={handleSend} className="space-y-2 pt-2 border-t border-slate-200">
          <div className="flex items-center justify-between text-[11px] text-slate-600 font-bold">
            <span>
              ارسال یادداشت جدید به عنوان:{' '}
              <strong className={
                currentUserRole === 'SENIOR_INSPECTOR' || currentUserRole === 'SYSTEM_ADMIN'
                  ? 'text-purple-700'
                  : currentUserRole === 'INSPECTOR'
                  ? 'text-blue-700'
                  : 'text-emerald-700'
              }>
                {currentUserName} ({
                  currentUserRole === 'SENIOR_INSPECTOR' || currentUserRole === 'SYSTEM_ADMIN'
                    ? 'بازرس ارشد / مقام بالاتر'
                    : currentUserRole === 'INSPECTOR'
                    ? 'کارشناس بازرسی'
                    : 'کاربر دفتر'
                })
              </strong>
            </span>
          </div>

          <div className="flex gap-2">
            <textarea
              rows={2}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                currentUserRole === 'SENIOR_INSPECTOR' || currentUserRole === 'SYSTEM_ADMIN'
                  ? 'ثبت دستور نظارتی، تصمیم نهایی مقام بالاتر یا هدایت پرونده...'
                  : currentUserRole === 'INSPECTOR'
                  ? 'ثبت تذکر کارشناسی به دفتر، اعلام نقص یا توضیحات ارجاع به مقام بالاتر...'
                  : 'ثبت توضیحات کاربر دفتر، دلایل مغایرت یا توضیحات الحاقی مدارک...'
              }
              className="flex-1 bg-white border border-slate-300 rounded-2xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className={`self-end px-4 py-2.5 disabled:opacity-50 text-white rounded-2xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs ${
                currentUserRole === 'SENIOR_INSPECTOR' || currentUserRole === 'SYSTEM_ADMIN'
                  ? 'bg-purple-700 hover:bg-purple-800'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              <Send className="w-3.5 h-3.5 rotate-180" />
              <span>ثبت</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
