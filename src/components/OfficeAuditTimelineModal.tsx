import React, { useState } from 'react';
import {
  History,
  AlertTriangle,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  Calendar,
  User,
  Shield,
  FileCheck,
  AlertOctagon,
  Bell,
  Download,
  Eye,
  Paperclip,
  Check,
  Ban,
  RefreshCw,
  Search,
  Filter,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Tag,
  Printer,
  Sparkles,
  Cpu,
  Building2,
  Award
} from 'lucide-react';
import { OfficeProfile, OfficeAuditEvent, OfficeAuditEventType, OfficeStatus } from '../types';

interface OfficeAuditTimelineModalProps {
  office: OfficeProfile | null;
  allEvents: OfficeAuditEvent[];
  onClose: () => void;
  onAddEvent: (newEvent: Omit<OfficeAuditEvent, 'id' | 'createdAt'>) => void;
  onResolveEvent?: (eventId: string) => void;
  onUpdateOfficeStatus?: (officeCode: string, newStatus: OfficeStatus) => void;
}

export const OfficeAuditTimelineModal: React.FC<OfficeAuditTimelineModalProps> = ({
  office,
  allEvents,
  onClose,
  onAddEvent,
  onResolveEvent,
  onUpdateOfficeStatus,
}) => {
  // Filters inside timeline
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [isReportView, setIsReportView] = useState<boolean>(false);

  // New Event Form State
  const [formEventType, setFormEventType] = useState<OfficeAuditEventType>('SUSPENSION');
  const [formTitle, setFormTitle] = useState<string>('');
  const [formEventDate, setFormEventDate] = useState<string>('1405/05/20');
  const [formEndDate, setFormEndDate] = useState<string>('1405/06/20');
  const [formRefNumber, setFormRefNumber] = useState<string>('');
  const [formSeverity, setFormSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formSuspensionReason, setFormSuspensionReason] = useState<string>('');
  const [formSuspensionDays, setFormSuspensionDays] = useState<number>(30);
  const [formViolationClauses, setFormViolationClauses] = useState<string>('بند ۳ ماده ۶ آیین‌نامه اجرایی RA');
  const [formRuling, setFormRuling] = useState<string>('');
  const [formInspectorName, setFormInspectorName] = useState<string>('بازرس اداره نظارت مرکز میانی عام');
  const [formFineAmount, setFormFineAmount] = useState<string>('');
  const [formCommitmentSubject, setFormCommitmentSubject] = useState<string>('');
  const [formCommitmentDeadline, setFormCommitmentDeadline] = useState<string>('');
  const [formGuarantorName, setFormGuarantorName] = useState<string>(office?.managerName || '');

  if (!office) return null;

  // Filter events for this specific office or allow switching
  const officeEvents = allEvents.filter(e => String(e.officeCode) === String(office.code));

  // Calculate active alarms
  const activeAlarms = officeEvents.filter(e => {
    if (e.eventType === 'SUSPENSION' && !e.isResolved && e.endDate) return true;
    if (e.eventType === 'COMMITMENT' && e.commitmentStatus === 'PENDING' && e.commitmentDeadline) return true;
    return e.isAlarmActive;
  });

  const filteredEvents = officeEvents.filter(e => {
    if (filterType !== 'ALL' && e.eventType !== filterType) return false;
    if (filterSeverity !== 'ALL' && e.severity !== filterSeverity) return false;
    return true;
  });

  // Calculate badge color and icon
  const getEventBadge = (type: OfficeAuditEventType) => {
    switch (type) {
      case 'SUSPENSION':
        return {
          label: 'تعلیق فعالیت',
          bg: 'bg-amber-100 text-amber-900 border-amber-300',
          dotBg: 'bg-amber-500 ring-amber-200',
          icon: AlertTriangle,
        };
      case 'VIOLATION':
        return {
          label: 'پرونده تخلف',
          bg: 'bg-rose-100 text-rose-900 border-rose-300',
          dotBg: 'bg-rose-600 ring-rose-200',
          icon: AlertOctagon,
        };
      case 'COMMITMENT':
        return {
          label: 'تعهدنامه رسمی',
          bg: 'bg-indigo-100 text-indigo-900 border-indigo-300',
          dotBg: 'bg-indigo-600 ring-indigo-200',
          icon: FileCheck,
        };
      case 'INSPECTION':
        return {
          label: 'بازرسی دوره‌ای',
          bg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
          dotBg: 'bg-emerald-600 ring-emerald-200',
          icon: Shield,
        };
      case 'WARNING':
        return {
          label: 'تذکر و اخطار',
          bg: 'bg-orange-100 text-orange-900 border-orange-300',
          dotBg: 'bg-orange-500 ring-orange-200',
          icon: Bell,
        };
      case 'REVOCATION':
        return {
          label: 'ابطال دائم مجوز',
          bg: 'bg-red-200 text-red-950 border-red-400',
          dotBg: 'bg-red-700 ring-red-300',
          icon: Ban,
        };
      default:
        return {
          label: 'سایر رویدادها',
          bg: 'bg-slate-100 text-slate-800 border-slate-300',
          dotBg: 'bg-slate-500 ring-slate-200',
          icon: Clock,
        };
    }
  };

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    const clausesArray = formViolationClauses
      ? formViolationClauses.split(/[\n,]+/).map(s => s.trim()).filter(Boolean)
      : undefined;

    onAddEvent({
      officeCode: office.code,
      officeName: office.name,
      eventType: formEventType,
      title: formTitle.trim(),
      eventDate: formEventDate || '1405/05/20',
      endDate: formEndDate || undefined,
      referenceNumber: formRefNumber.trim() || undefined,
      severity: formSeverity,
      description: formDescription.trim(),
      suspensionReason: formEventType === 'SUSPENSION' ? formSuspensionReason.trim() : undefined,
      suspensionDays: formEventType === 'SUSPENSION' ? Number(formSuspensionDays) : undefined,
      isResolved: false,
      isAlarmActive: formEventType === 'SUSPENSION' || formEventType === 'COMMITMENT',
      violationClauses: clausesArray,
      ruling: formRuling.trim() || undefined,
      inspectorName: formInspectorName.trim() || undefined,
      fineAmount: formFineAmount.trim() || undefined,
      commitmentType: formEventType === 'COMMITMENT' ? 'DEFECT_REMOVAL' : undefined,
      commitmentSubject: formEventType === 'COMMITMENT' ? formCommitmentSubject.trim() : undefined,
      commitmentDeadline: formEventType === 'COMMITMENT' ? formCommitmentDeadline.trim() : undefined,
      commitmentStatus: formEventType === 'COMMITMENT' ? 'PENDING' : undefined,
      guarantorName: formEventType === 'COMMITMENT' ? formGuarantorName.trim() : undefined,
      attachedDocumentsCount: 1,
      attachedDocNames: ['سند_ثبت_رویداد_نظارتی.pdf'],
      registeredBy: 'کارشناس نظارت و ممیزی ریشه',
    });

    // If new event is suspension, optionally update office status
    if (formEventType === 'SUSPENSION' && onUpdateOfficeStatus) {
      onUpdateOfficeStatus(office.code, 'SUSPENDED');
    } else if (formEventType === 'REVOCATION' && onUpdateOfficeStatus) {
      onUpdateOfficeStatus(office.code, 'REVOKED');
    }

    // Reset form
    setFormTitle('');
    setFormDescription('');
    setFormRuling('');
    setFormRefNumber('');
    setShowAddForm(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-4xl w-full my-auto overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Top Header */}
        <div className="bg-gradient-to-l from-slate-900 via-slate-800 to-slate-900 text-white p-5 sm:p-6 flex items-start justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="bg-blue-500/20 text-blue-300 font-mono text-xs font-bold px-2.5 py-0.5 rounded-full border border-blue-400/30">
                کد دفتر: {office.code}
              </span>
              {office.status === 'SUSPENDED' && (
                <span className="bg-amber-500/20 text-amber-300 text-xs font-bold px-2.5 py-0.5 rounded-full border border-amber-400/30 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>وضعیت: تعلیق شده</span>
                </span>
              )}
              {office.status === 'REVOKED' && (
                <span className="bg-rose-500/20 text-rose-300 text-xs font-bold px-2.5 py-0.5 rounded-full border border-rose-400/30 flex items-center gap-1">
                  <Ban className="w-3.5 h-3.5" />
                  <span>وضعیت: ابطال شده</span>
                </span>
              )}
              {office.status === 'ACTIVE' && (
                <span className="bg-emerald-500/20 text-emerald-300 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-400/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>وضعیت: فعال</span>
                </span>
              )}
            </div>

            <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
              <History className="w-5 h-5 text-blue-400" />
              <span>تایم‌لاین پرونده‌های نظارتی، تعلیق و تعهدات: {office.name}</span>
            </h2>
            <p className="text-xs text-slate-300">
              گزارش جامع سوابق بازرسی دوره‌ای، پرونده‌های تخلف، تعهدنامه‌ها و آلارم هوشمند تاریخ پایان تعلیق / سررسید تعهد
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-2xl transition"
            title="بستن"
          >
            ✕
          </button>
        </div>

        {/* Smart Alarm Banner (If office has active suspension or upcoming commitment deadline) */}
        {activeAlarms.length > 0 && (
          <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-amber-500/15 border-b border-amber-300/60 p-4 sm:px-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md animate-pulse">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-amber-950 flex items-center gap-1.5">
                    <span>هشدار سررسید تعلیق / تعهدنامه (آلارم فعال مرکز نظارت)</span>
                    <span className="text-[10px] bg-amber-200 text-amber-900 font-black px-2 py-0.5 rounded-full">
                      {activeAlarms.length} مورد فعال
                    </span>
                  </h4>
                  <div className="text-xs text-amber-900 mt-1 space-y-0.5">
                    {activeAlarms.map(alarm => (
                      <div key={alarm.id} className="flex items-center gap-2">
                        <span>•</span>
                        <strong>{alarm.title}</strong>
                        {alarm.endDate && (
                          <span className="bg-amber-100/90 text-amber-900 px-2 py-0.2 rounded font-mono text-[11px]">
                            تاریخ پایان: {alarm.endDate}
                          </span>
                        )}
                        {alarm.commitmentDeadline && (
                          <span className="bg-indigo-100/90 text-indigo-900 px-2 py-0.2 rounded font-mono text-[11px]">
                            مهلت تعهد: {alarm.commitmentDeadline}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons on Alarm */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {office.status === 'SUSPENDED' && onUpdateOfficeStatus && (
                  <button
                    onClick={() => onUpdateOfficeStatus(office.code, 'ACTIVE')}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>رفع تعلیق و فعال‌سازی مجدد دفتر</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Controls and Filter Bar */}
        <div className="p-4 sm:px-6 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-slate-700 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>فیلتر نوع رویداد:</span>
            </span>

            <button
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1 rounded-xl font-bold transition ${
                filterType === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              همه ({officeEvents.length})
            </button>

            <button
              onClick={() => setFilterType('SUSPENSION')}
              className={`px-3 py-1 rounded-xl font-bold transition flex items-center gap-1 ${
                filterType === 'SUSPENSION'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-amber-800 border border-amber-200 hover:bg-amber-50'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>تعلیق‌ها</span>
            </button>

            <button
              onClick={() => setFilterType('VIOLATION')}
              className={`px-3 py-1 rounded-xl font-bold transition flex items-center gap-1 ${
                filterType === 'VIOLATION'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white text-rose-800 border border-rose-200 hover:bg-rose-50'
              }`}
            >
              <AlertOctagon className="w-3 h-3" />
              <span>پرونده تخلفات</span>
            </button>

            <button
              onClick={() => setFilterType('COMMITMENT')}
              className={`px-3 py-1 rounded-xl font-bold transition flex items-center gap-1 ${
                filterType === 'COMMITMENT'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-indigo-800 border border-indigo-200 hover:bg-indigo-50'
              }`}
            >
              <FileCheck className="w-3 h-3" />
              <span>تعهدنامه‌ها</span>
            </button>

            <button
              onClick={() => setFilterType('INSPECTION')}
              className={`px-3 py-1 rounded-xl font-bold transition flex items-center gap-1 ${
                filterType === 'INSPECTION'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-50'
              }`}
            >
              <Shield className="w-3 h-3" />
              <span>بازرسی‌های دوره‌ای</span>
            </button>
          </div>

          {/* Report and Form Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsReportView(!isReportView)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer ${
                isReportView
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-indigo-900 border border-indigo-200 hover:bg-indigo-50'
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isReportView ? 'مشاهده تایم‌لاین' : 'چاپ گزارش جامع رویدادها'}</span>
            </button>

            {/* Add New Audit Event Toggle Button */}
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer ${
                showAddForm
                  ? 'bg-rose-100 text-rose-700 border border-rose-300'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {showAddForm ? (
                <>
                  <XCircle className="w-3.5 h-3.5" />
                  <span>انصراف از ثبت</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>ثبت پرونده / رویداد بازرسی جدید</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Automated Printable Comprehensive Report View */}
          {isReportView ? (
            <div className="bg-white border-2 border-slate-300 rounded-3xl p-6 sm:p-8 space-y-6 shadow-md printable-area">
              {/* Report Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b-2 border-slate-900 pb-4 gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-slate-900 text-white rounded-2xl">
                    <Shield className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-slate-900">
                      گزارش جامع سوابق، وقایع نظارتی و تایم‌لاین دفتر ثبت‌نام
                    </h2>
                    <p className="text-xs text-slate-600 font-bold mt-0.5">
                      مرکز بازرسی و نظارت دفاتر ثبت نام مرکز میانی عام - سامانه ممیزی خودکار
                    </p>
                  </div>
                </div>

                <div className="text-left font-mono text-xs text-slate-600 space-y-1">
                  <div>تاریخ گزارش: <strong className="text-slate-900">۱۴۰۵/۰۵/۲۵</strong></div>
                  <div>کد رهگیری: <strong className="text-slate-900">REP-{office.code}-AUT</strong></div>
                  <button
                    onClick={() => window.print()}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition cursor-pointer print:hidden"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>چاپ یا خروجی PDF</span>
                  </button>
                </div>
              </div>

              {/* Office & Manager Profile Box */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 font-medium">کد و نام دفتر:</span>
                  <div className="font-black text-slate-900 mt-0.5">{office.code} - {office.name}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">استان و شهرستان:</span>
                  <div className="font-bold text-slate-800 mt-0.5">{office.province} / {office.city}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">مسئول دفتر:</span>
                  <div className="font-bold text-slate-800 mt-0.5">{office.managerName || 'ثبت نشده'}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">وضعیت پروانه فعالیت:</span>
                  <div className="font-black mt-0.5">
                    {office.status === 'ACTIVE' && <span className="text-emerald-700">فعال و دارای مجوز</span>}
                    {office.status === 'SUSPENDED' && <span className="text-amber-700">تعلیق موقت فعالیت</span>}
                    {office.status === 'REVOKED' && <span className="text-rose-700">ابطال قطعی پروانه</span>}
                    {office.status === 'INACTIVE' && <span className="text-slate-700">غیرفعال</span>}
                  </div>
                </div>
              </div>

              {/* Statistical Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                <div className="p-3 bg-slate-100 rounded-2xl border border-slate-200">
                  <div className="text-lg font-black text-slate-900">{officeEvents.length}</div>
                  <div className="text-[11px] font-bold text-slate-600">کل وقایع ثبت‌شده</div>
                </div>
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
                  <div className="text-lg font-black text-emerald-800">
                    {officeEvents.filter(e => e.eventType === 'INSPECTION').length}
                  </div>
                  <div className="text-[11px] font-bold text-emerald-700">بازرسی‌های دوره‌ای</div>
                </div>
                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200">
                  <div className="text-lg font-black text-amber-800">
                    {officeEvents.filter(e => e.eventType === 'SUSPENSION').length}
                  </div>
                  <div className="text-[11px] font-bold text-amber-700">احکام تعلیق</div>
                </div>
                <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200">
                  <div className="text-lg font-black text-rose-800">
                    {officeEvents.filter(e => e.eventType === 'VIOLATION').length}
                  </div>
                  <div className="text-[11px] font-bold text-rose-700">پرونده‌های تخلف</div>
                </div>
                <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-200">
                  <div className="text-lg font-black text-indigo-800">
                    {officeEvents.filter(e => e.eventType === 'COMMITMENT').length}
                  </div>
                  <div className="text-[11px] font-bold text-indigo-700">تعهدنامه‌های رسمی</div>
                </div>
              </div>

              {/* Event Table */}
              <div className="border border-slate-300 rounded-2xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-900 text-white font-bold">
                    <tr>
                      <th className="py-2.5 px-3">ردیف</th>
                      <th className="py-2.5 px-3">تاریخ</th>
                      <th className="py-2.5 px-3">نوع رویداد</th>
                      <th className="py-2.5 px-3">عنوان و شرح خلاصه</th>
                      <th className="py-2.5 px-3">شماره عطف / نامه</th>
                      <th className="py-2.5 px-3">بازرس / متعهد</th>
                      <th className="py-2.5 px-3 text-center">وضعیت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {officeEvents.map((evt, idx) => {
                      const badge = getEventBadge(evt.eventType);
                      return (
                        <tr key={evt.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="py-2 px-3 font-mono font-bold text-slate-700">{idx + 1}</td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-900">{evt.eventDate}</td>
                          <td className="py-2 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.bg}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="py-2 px-3 max-w-xs">
                            <div className="font-black text-slate-900">{evt.title}</div>
                            <div className="text-[11px] text-slate-600 line-clamp-1">{evt.description}</div>
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-700 text-[11px]">
                            {evt.referenceNumber || '—'}
                          </td>
                          <td className="py-2 px-3 text-slate-800">
                            {evt.inspectorName || evt.guarantorName || evt.registeredBy || 'سیستم هوشمند'}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {evt.isResolved ? (
                              <span className="text-emerald-700 font-bold text-[10px]">مختومه</span>
                            ) : evt.isAlarmActive ? (
                              <span className="text-amber-700 font-bold text-[10px]">درحال اقدام</span>
                            ) : (
                              <span className="text-slate-600 text-[10px]">ثبت نهایی</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Official Signatures Block */}
              <div className="grid grid-cols-2 gap-8 pt-8 border-t-2 border-slate-900 text-xs">
                <div className="text-center space-y-6">
                  <div className="font-bold text-slate-800">بازرس مسئول پرونده و تدوین‌کننده گزارش:</div>
                  <div className="text-slate-400 font-serif italic text-sm">محل امضا و مهر کارشناسی بازرس</div>
                  <div className="text-slate-700 font-bold">مهندس سید امیر حسینیان</div>
                </div>
                <div className="text-center space-y-6">
                  <div className="font-bold text-slate-800">رئیس اداره نظارت و ممیزی دفاتر ثبت‌نام ریشه:</div>
                  <div className="text-slate-400 font-serif italic text-sm">مهر و امضای تاییدیه نهایی اداره کل</div>
                  <div className="text-slate-700 font-bold">دکتر علیرضا کریمی طهرانی</div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Add New Event Form Dropdown */}
              {showAddForm && (
                <form onSubmit={handleCreateEvent} className="bg-slate-50 border-2 border-blue-200 rounded-2xl p-4 sm:p-5 space-y-4 shadow-md animate-in fade-in">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h4 className="text-xs font-black text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>ثبت رویداد جدید برای دفتر کد {office.code}</span>
                </h4>
                <span className="text-[11px] text-slate-500">تمامی فیلدها روی تایم‌لاین درج می‌گردد</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">نوع رویداد بازرسی *</label>
                  <select
                    value={formEventType}
                    onChange={(e) => setFormEventType(e.target.value as OfficeAuditEventType)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="SUSPENSION">⚠️ دستور تعلیق موقت فعالیت</option>
                    <option value="VIOLATION">🚨 پرونده تخلف و صورتجلسه بازرسی</option>
                    <option value="COMMITMENT">📜 تعهدنامه رسمی و رفع نقص</option>
                    <option value="INSPECTION">🛡️ بازرسی دوره‌ای و ممیزی جامع</option>
                    <option value="WARNING">🔔 تذکر کتبی یا اخطار درجه یک</option>
                    <option value="REVOCATION">✕ حکم ابطال دائم مجوز RA</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">عنوان کامل رویداد *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: دستور تعلیق موقت ۳۰ روزه به دلیل عدم رویت اصل مدارک"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">شماره نامه / پرونده نظارتی</label>
                  <input
                    type="text"
                    placeholder="مثال: نامه تعلیق ۹۸/۴۰۳-ت"
                    value={formRefNumber}
                    onChange={(e) => setFormRefNumber(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">تاریخ وقوع / ابلاغ *</label>
                  <input
                    type="text"
                    required
                    placeholder="1405/05/20"
                    value={formEventDate}
                    onChange={(e) => setFormEventDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {formEventType === 'SUSPENSION' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">مدت تعلیق (روز)</label>
                      <input
                        type="number"
                        value={formSuspensionDays}
                        onChange={(e) => setFormSuspensionDays(Number(e.target.value))}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">تاریخ پایان تعلیق (جهت آلارم)</label>
                      <input
                        type="text"
                        placeholder="1405/06/20"
                        value={formEndDate}
                        onChange={(e) => setFormEndDate(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}

                {formEventType === 'COMMITMENT' && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">مهلت تعهدنامه (جهت آلارم)</label>
                    <input
                      type="text"
                      placeholder="1405/06/05"
                      value={formCommitmentDeadline}
                      onChange={(e) => setFormCommitmentDeadline(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">نام بازرس / کارشناس ممیزی</label>
                  <input
                    type="text"
                    value={formInspectorName}
                    onChange={(e) => setFormInspectorName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {formEventType === 'VIOLATION' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">بندها و قوانین نقض شده (جدا شده با ویرگول)</label>
                  <input
                    type="text"
                    value={formViolationClauses}
                    onChange={(e) => setFormViolationClauses(e.target.value)}
                    placeholder="بند ۳ ماده ۶ آیین‌نامه اجرایی RA، بند ۱۱ احراز هویت متقاضیان"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">شرح دقیق تخلف / گزارش ممیزی / موضوع تعهدنامه *</label>
                <textarea
                  rows={2}
                  required
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="شرح کامل جزئیات پرونده و نتایج بررسی کارشناسی..."
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">رای صادره / تصمیم نهایی هیات نظارت</label>
                <input
                  type="text"
                  value={formRuling}
                  onChange={(e) => setFormRuling(e.target.value)}
                  placeholder="توقف دسترسی به سامانه، اخطار کتبی درجه ۲ و درج در پرونده"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-xs flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>ثبت نهایی در تایم‌لاین</span>
                </button>
              </div>
            </form>
          )}

          {/* Timeline Visual Feed */}
          {filteredEvents.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-3xl border border-slate-200">
              <FileCheck className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-800">هیچ رویداد یا سابقه بازرسی در این دسته‌بندی یافت نشد</h4>
              <p className="text-xs text-slate-500 mt-1">
                برای ثبت تعلیق جدید، صورتجلسه تخلف یا تعهدنامه از دکمه «ثبت رویداد جدید» در بالا استفاده نمایید.
              </p>
            </div>
          ) : (
            <div className="relative border-r-2 border-slate-200 mr-4 sm:mr-6 pr-6 sm:pr-8 space-y-6">
              {filteredEvents.map((evt, idx) => {
                const badge = getEventBadge(evt.eventType);
                const BadgeIcon = badge.icon;
                const isExpanded = expandedEventId === evt.id;

                return (
                  <div key={evt.id} className="relative group">
                    {/* Timeline Node Icon Circle */}
                    <div
                      className={`absolute -right-[35px] sm:-right-[43px] top-1 w-8 h-8 rounded-full ${badge.dotBg} ring-4 flex items-center justify-center text-white shadow-md z-10`}
                    >
                      <BadgeIcon className="w-4 h-4" />
                    </div>

                    {/* Timeline Card */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition space-y-3">
                      {/* Event Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${badge.bg}`}>
                              {badge.label}
                            </span>
                            {evt.referenceNumber && (
                              <span className="text-[11px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                                {evt.referenceNumber}
                              </span>
                            )}
                            {evt.isAlarmActive && !evt.isResolved && (
                              <span className="text-[10px] bg-amber-500 text-white font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                                <Bell className="w-3 h-3" />
                                <span>آلارم فعال سررسید</span>
                              </span>
                            )}
                            {evt.isResolved && (
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                <span>مختومه و رفع اثر شده</span>
                              </span>
                            )}
                            {evt.autoLogged && (
                              <span className="text-[10px] bg-indigo-50 text-indigo-800 font-bold px-2 py-0.5 rounded-full border border-indigo-200 flex items-center gap-1">
                                <Cpu className="w-3 h-3 text-indigo-600" />
                                <span>ثبت هوشمند خودکار</span>
                              </span>
                            )}
                          </div>
                          <h3 className="text-sm font-black text-slate-900 mt-1">{evt.title}</h3>
                        </div>

                        {/* Event Dates */}
                        <div className="text-left sm:text-right shrink-0 flex flex-col sm:items-end">
                          <div className="flex items-center gap-1 text-xs text-slate-600 font-bold">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>تاریخ رویداد:</span>
                            <span className="font-mono text-slate-900">{evt.eventDate}</span>
                          </div>
                          {evt.endDate && (
                            <div className="flex items-center gap-1 text-[11px] text-amber-800 font-bold mt-0.5">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>تاریخ خاتمه:</span>
                              <span className="font-mono bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                {evt.endDate} ({evt.suspensionDays ? `${evt.suspensionDays} روزه` : ''})
                              </span>
                            </div>
                          )}
                          {evt.commitmentDeadline && (
                            <div className="flex items-center gap-1 text-[11px] text-indigo-800 font-bold mt-0.5">
                              <Clock className="w-3 h-3 text-indigo-600" />
                              <span>مهلت تعهد:</span>
                              <span className="font-mono bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                                {evt.commitmentDeadline}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-slate-700 leading-relaxed">{evt.description}</p>

                      {/* Violated Clauses List */}
                      {evt.violationClauses && evt.violationClauses.length > 0 && (
                        <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3 space-y-1.5">
                          <div className="text-[11px] font-bold text-rose-900 flex items-center gap-1.5">
                            <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />
                            <span>بندها و مقررات نقض شده در پرونده:</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {evt.violationClauses.map((clause, cIdx) => (
                              <span
                                key={cIdx}
                                className="text-[11px] bg-white text-rose-800 border border-rose-300 font-bold px-2 py-0.5 rounded-lg shadow-2xs"
                              >
                                ⚖️ {clause}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Ruling & Inspector */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                        {evt.ruling && (
                          <div>
                            <span className="text-slate-500 font-medium">تصمیم و رای نظارتی:</span>
                            <p className="font-bold text-slate-900 mt-0.5">{evt.ruling}</p>
                          </div>
                        )}
                        {evt.inspectorName && (
                          <div>
                            <span className="text-slate-500 font-medium">بازرس ممیز:</span>
                            <p className="font-bold text-slate-900 mt-0.5 flex items-center gap-1">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              <span>{evt.inspectorName}</span>
                            </p>
                          </div>
                        )}
                        {evt.commitmentSubject && (
                          <div className="sm:col-span-2">
                            <span className="text-slate-500 font-medium">موضوع و تعهدات تقبل شده:</span>
                            <p className="font-bold text-indigo-950 mt-0.5">{evt.commitmentSubject}</p>
                          </div>
                        )}
                        {evt.guarantorName && (
                          <div>
                            <span className="text-slate-500 font-medium">متعهد / امضاکننده:</span>
                            <p className="font-bold text-slate-900 mt-0.5">{evt.guarantorName}</p>
                          </div>
                        )}
                      </div>

                      {/* Attachments and Action Footer */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 flex items-center gap-1 font-medium">
                            <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                            <span>اسناد پیوست:</span>
                          </span>
                          {evt.attachedDocNames && evt.attachedDocNames.length > 0 ? (
                            evt.attachedDocNames.map((doc, dIdx) => (
                              <button
                                key={dIdx}
                                type="button"
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded text-[11px] border border-slate-200 flex items-center gap-1"
                              >
                                <Download className="w-3 h-3 text-slate-500" />
                                <span>{doc}</span>
                              </button>
                            ))
                          ) : (
                            <span className="text-slate-400 text-[11px]">ندارد</span>
                          )}
                        </div>

                        {/* Resolve / Dismiss Alarm Button */}
                        {evt.isAlarmActive && !evt.isResolved && onResolveEvent && (
                          <button
                            onClick={() => onResolveEvent(evt.id)}
                            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-xl transition flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>ثبت رفع نقص و مختومه کردن پرونده</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="p-4 sm:px-6 bg-slate-100 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-600 font-medium">
            تعداد کل پرونده‌ها و سوابق ثبت شده: <strong className="text-slate-900">{officeEvents.length} مورد</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-xs transition"
            >
              بستن پنجره
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
