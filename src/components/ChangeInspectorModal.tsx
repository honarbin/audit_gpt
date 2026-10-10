import React, { useState } from 'react';
import { 
  UserCheck, 
  X, 
  ShieldAlert, 
  CheckCircle2, 
  User, 
  FileText, 
  Layers, 
  Sparkles,
  ArrowRightLeft
} from 'lucide-react';
import { AppUser } from '../types/auth';
import { AuditInspectionRecord } from '../types';
import { getStoredUsers } from '../services/authService';

interface ChangeInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  record?: AuditInspectionRecord | null;
  campaignTitle?: string;
  currentInspectorName?: string;
  users?: AppUser[];
  currentUser?: AppUser | null;
  campaignId?: string;
  onSave?: (
    newInspectorName: string, 
    reason: string, 
    applyToAllInCampaign: boolean
  ) => void;
  onInspectorChanged?: (updatedRecord: AuditInspectionRecord) => void;
}

export const ChangeInspectorModal: React.FC<ChangeInspectorModalProps> = ({
  isOpen,
  onClose,
  record,
  campaignTitle,
  currentInspectorName,
  users,
  currentUser,
  campaignId,
  onSave,
  onInspectorChanged,
}) => {
  // Safe list of users with fallback to localStorage
  const allUsers = (users && Array.isArray(users) && users.length > 0) ? users : getStoredUsers();

  // Available registered inspectors and admins
  const availableInspectors = allUsers.filter(
    u => u.role === 'INSPECTOR' || u.role === 'SENIOR_INSPECTOR' || u.role === 'SYSTEM_ADMIN'
  );

  const effectiveCurrentInspector = currentInspectorName || record?.level1InspectorName || record?.reviewerName || 'تعیین نشده';

  const [selectedInspectorName, setSelectedInspectorName] = useState<string>(() => {
    return (effectiveCurrentInspector !== 'تعیین نشده' ? effectiveCurrentInspector : '') || availableInspectors[0]?.fullName || 'کارشناس بازرسی ۱';
  });
  const [customInspectorMode, setCustomInspectorMode] = useState<boolean>(false);
  const [customInspectorName, setCustomInspectorName] = useState<string>('');
  const [reassignReason, setReassignReason] = useState<string>('');
  const [applyToAllCampaign, setApplyToAllCampaign] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = customInspectorMode 
      ? customInspectorName.trim() 
      : selectedInspectorName.trim();

    if (!finalName) {
      alert('لطفاً نام بازرس جدید را مشخص فرمایید.');
      return;
    }

    setIsSubmitting(true);
    try {
      const reason = reassignReason.trim() || 'تغییر و بازتخصیص کارشناس بازرسی پرونده';

      if (onSave) {
        onSave(finalName, reason, applyToAllCampaign);
      }

      if (onInspectorChanged && record) {
        const timestamp = new Date().toLocaleDateString('fa-IR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });

        const newNoteEntry = {
          id: `note-${Date.now()}`,
          authorName: currentUser?.fullName || 'مدیر سیستم / سرپرست بازرسی',
          authorRole: (currentUser?.role || 'SYSTEM_ADMIN') as any,
          note: `[تغییر و بازتخصیص بازرس]: بازرس پرونده به «${finalName}» تغییر یافت. علت: ${reason}`,
          timestamp,
          stage: record.status || 'IN_PROGRESS'
        };

        const updatedRecord: AuditInspectionRecord = {
          ...record,
          level1InspectorName: finalName,
          reviewerName: finalName,
          notesHistory: [...(record.notesHistory || []), newNoteEntry],
          lastModifiedAt: new Date().toISOString(),
        };

        onInspectorChanged(updatedRecord);
      }

      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden animate-in zoom-in-95 my-4">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-l from-indigo-50 to-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                تغییر و انتصاب مجدد کارشناس بازرسی
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                امکان جابجایی و تخصیص مجدد بازرس در هر یک از مراحل فرآیند ممیزی
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Target Info Badge */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-2">
            <div className="flex items-center justify-between text-slate-600">
              <span>پرونده متقاضی / دوره:</span>
              <span className="font-extrabold text-slate-900 font-mono">
                {record?.certificate?.applicantName 
                  ? `${record.certificate.applicantName} (دفتر ${record.officeCode})` 
                  : (campaignTitle || 'کلیه پرونده‌های دوره')}
              </span>
            </div>
            {record?.status && (
              <div className="flex items-center justify-between text-slate-600">
                <span>مرحله فعلی پرونده:</span>
                <span className="bg-blue-100 text-blue-900 px-2 py-0.5 rounded-full font-bold text-[11px]">
                  {record.status}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between text-slate-600 pt-1 border-t border-slate-200">
              <span>کارشناس بازرسی فعلی:</span>
              <span className="font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                {currentInspectorName || 'ثبت نشده'}
              </span>
            </div>
          </div>

          {/* Mode Switch: Pick from registered users vs Custom name */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-800 block">
              انتخاب کارشناس بازرسی جدید <span className="text-rose-500">*</span>:
            </label>

            <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setCustomInspectorMode(false)}
                className={`flex-1 py-2 rounded-xl transition cursor-pointer ${
                  !customInspectorMode 
                    ? 'bg-white text-indigo-900 shadow-2xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                انتخاب از لیست بازرسان سامانه
              </button>
              <button
                type="button"
                onClick={() => setCustomInspectorMode(true)}
                className={`flex-1 py-2 rounded-xl transition cursor-pointer ${
                  customInspectorMode 
                    ? 'bg-white text-indigo-900 shadow-2xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                نام کارشناس سفارشی
              </button>
            </div>

            {!customInspectorMode ? (
              <div className="space-y-2 pt-1">
                <select
                  value={selectedInspectorName}
                  onChange={(e) => setSelectedInspectorName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden cursor-pointer"
                >
                  {availableInspectors.map((inspector) => (
                    <option key={inspector.id} value={inspector.fullName}>
                      {inspector.fullName} ({inspector.role === 'SYSTEM_ADMIN' ? 'مدیر سیستم' : 'بازرس'}) - نام کاربری: {inspector.username}
                    </option>
                  ))}
                  {/* Fallback default options */}
                  {availableInspectors.length === 0 && (
                    <>
                      <option value="کارشناس بازرسی ۱">کارشناس بازرسی ۱ (مهندس رضایی)</option>
                      <option value="کارشناس بازرسی ۲">کارشناس بازرسی ۲ (مهندس صادقی)</option>
                      <option value="سرپرست ممیزی دفاتر">سرپرست ممیزی دفاتر</option>
                    </>
                  )}
                </select>
                <p className="text-[11px] text-slate-500">
                  کلیه اختیارات بررسی، اعلام نقص و تایید پرونده به این کارشناس منتقل می‌شود.
                </p>
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <input
                  type="text"
                  value={customInspectorName}
                  onChange={(e) => setCustomInspectorName(e.target.value)}
                  placeholder="مثال: سرکار خانم دکتر فراهانی (کارشناس ارشد نظارت)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
            )}
          </div>

          {/* Reason / Justification */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              علت یا دستور تغییر بازرس (اختیاری):
            </label>
            <textarea
              rows={2}
              value={reassignReason}
              onChange={(e) => setReassignReason(e.target.value)}
              placeholder="مثال: ارجاع به دلیل تراکم کارتابل کارشناس قبلی / تقسیم عادلانه پرونده‌ها..."
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          {/* Checkbox: Apply to all records in campaign */}
          {record && (
            <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-indigo-50/50 border border-indigo-200 cursor-pointer">
              <input
                type="checkbox"
                checked={applyToAllCampaign}
                onChange={(e) => setApplyToAllCampaign(e.target.checked)}
                className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 mt-0.5"
              />
              <div className="text-xs text-indigo-950">
                <span className="font-black block">اعمال تغییر برای تمامی پرونده‌های این دوره بازرسی</span>
                <span className="text-[11px] text-indigo-800">
                  علاوه بر این پرونده، نام بازرس کل دوره و سایر پرونده‌های نمونه نیز به نام جدید بروزرسانی خواهد شد.
                </span>
              </div>
            </label>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-2xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'در حال ثبت...' : 'ثبت و انتصاب بازرس'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
