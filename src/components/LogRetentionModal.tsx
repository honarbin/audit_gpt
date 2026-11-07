import React, { useState } from 'react';
import { 
  Trash2, 
  X, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldCheck, 
  FileSpreadsheet, 
  Sparkles,
  Database,
  RefreshCw
} from 'lucide-react';
import { UserAccessLog } from '../types/auth';
import { OfficeAuditEvent } from '../types';
import { getStoredAccessLogs } from '../services/authService';
import { 
  getAdminSystemSettings, 
  saveAdminSystemSettings, 
  pruneAccessLogsBeforeTimestamp,
  pruneAuditEventsBeforeTimestamp,
  parseDateToTimestamp,
  clearAllAccessLogs
} from '../services/systemSettingsService';

interface LogRetentionModalProps {
  isOpen: boolean;
  onClose: () => void;
  accessLogs?: UserAccessLog[];
  auditEvents?: OfficeAuditEvent[];
  onLogsUpdated?: (remainingLogs: UserAccessLog[]) => void;
  onAuditEventsUpdated?: (remainingEvents: OfficeAuditEvent[]) => void;
  onExportBackup?: () => void;
  onLogsPruned?: () => void;
}

export const LogRetentionModal: React.FC<LogRetentionModalProps> = ({
  isOpen,
  onClose,
  accessLogs,
  auditEvents,
  onLogsUpdated,
  onAuditEventsUpdated,
  onExportBackup,
  onLogsPruned,
}) => {
  const currentSettings = getAdminSystemSettings();
  const [retentionPolicy, setRetentionPolicy] = useState(currentSettings.logRetentionPolicy || 'NEVER');
  const [autoPruneEnabled, setAutoPruneEnabled] = useState(currentSettings.autoPruneLogsEnabled || false);

  // Manual Prune state
  const [selectedPreset, setSelectedPreset] = useState<'ALL' | '7_DAYS' | '30_DAYS' | '90_DAYS' | '180_DAYS' | '365_DAYS' | 'CUSTOM'>('30_DAYS');
  const [customDate, setCustomDate] = useState<string>('1404/01/01');
  const [pruneAccessLogs, setPruneAccessLogs] = useState<boolean>(true);
  const [pruneAuditTimelineEvents, setPruneAuditTimelineEvents] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Safe fallback to stored logs if not passed
  const storedLogs = getStoredAccessLogs() || [];
  const safeLogs = Array.isArray(accessLogs) ? accessLogs : storedLogs;
  const safeEvents = Array.isArray(auditEvents) ? auditEvents : [];

  // Approximate storage
  const totalLogsCount = safeLogs.length;
  const totalEventsCount = safeEvents.length;
  const estimatedBytes = JSON.stringify(safeLogs).length + JSON.stringify(safeEvents).length;
  const estimatedKb = Math.round(estimatedBytes / 1024);

  // Oldest & newest logs
  const oldestAccessLog = safeLogs.length > 0 ? (safeLogs[safeLogs.length - 1]?.timestamp || 'ثبت نشده') : 'ثبت نشده';
  const newestAccessLog = safeLogs.length > 0 ? (safeLogs[0]?.timestamp || 'ثبت نشده') : 'ثبت نشده';

  const handleSavePolicy = () => {
    saveAdminSystemSettings({
      logRetentionPolicy: retentionPolicy,
      autoPruneLogsEnabled: autoPruneEnabled,
    });
    setSuccessMessage('تنظیمات سیاست نگهداری خودکار لاگ‌ها با موفقیت ذخیره گردید.');
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  const handleExecuteManualPrune = () => {
    let cutoffMs: number | null = null;
    let desc = '';

    if (selectedPreset === 'ALL') {
      cutoffMs = Date.now() + 100000;
      desc = 'تمام لاگ‌های ثبت‌شده (حذف ۱۰۰٪ تاریخچه تردد)';
    } else if (selectedPreset === 'CUSTOM') {
      cutoffMs = parseDateToTimestamp(customDate);
      if (!cutoffMs) {
        alert('لطفاً یک تاریخ معتبر شمسی (مانند ۱۴۰۴/۰۱/۰۱) یا میلادی وارد فرمایید.');
        return;
      }
      desc = `قبل از تاریخ ${customDate}`;
    } else {
      const daysMap: Record<string, number> = {
        '7_DAYS': 7,
        '30_DAYS': 30,
        '90_DAYS': 90,
        '180_DAYS': 180,
        '365_DAYS': 365,
      };
      const days = daysMap[selectedPreset] || 30;
      cutoffMs = Date.now() - days * 86400000;
      desc = `قدیمی‌تر از ${days} روز پیش`;
    }

    const confirmMsg = `آیا از حذف دائم لاگ‌های مربوط به بازه «${desc}» برای سبک‌سازی پایگاه داده اطمینان دارید؟\nاین عملیات غیرقابل بازگشت است.`;
    if (!window.confirm(confirmMsg)) return;

    setIsProcessing(true);
    try {
      let removedAccess = 0;
      let removedEvents = 0;

      if (pruneAccessLogs) {
        if (selectedPreset === 'ALL') {
          const res = clearAllAccessLogs();
          removedAccess = res.removedCount;
        } else {
          const res = pruneAccessLogsBeforeTimestamp(cutoffMs);
          removedAccess = res.removedCount;
        }

        const freshLogs = getStoredAccessLogs();
        if (onLogsUpdated) {
          onLogsUpdated(freshLogs);
        }
        if (onLogsPruned) {
          onLogsPruned();
        }
      }

      if (pruneAuditTimelineEvents && onAuditEventsUpdated && safeEvents.length > 0) {
        const res = pruneAuditEventsBeforeTimestamp(safeEvents, cutoffMs);
        removedEvents = res.removedCount;
        onAuditEventsUpdated(res.updatedEvents);
      }

      const freshRemaining = getStoredAccessLogs().length;
      setSuccessMessage(
        `عملیات پاکسازی با موفقیت انجام شد: تعداد ${removedAccess} لاگ دسترسی و ${removedEvents} رویداد ممیزی حذف شد. (${freshRemaining} لاگ باقیمانده در پایگاه داده)`
      );
    } catch (e: any) {
      alert(`خطا در اجرای پاکسازی: ${e.message || e}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in zoom-in-95 my-4">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-l from-rose-50 via-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                مدیریت نگهداری و پاکسازی لاگ‌ها (سبک‌سازی پایگاه داده)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                حذف لاگ‌های قدیمی بر اساس تاریخ مشخص یا تعریف سیاست دوره‌ای پاکسازی خودکار
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

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {successMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900 flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* SECTION 1: Metrics & Storage Status */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl">
              <span className="text-slate-500 text-[11px] block">کل لاگ‌های دسترسی:</span>
              <span className="text-base font-black text-slate-900 font-mono mt-0.5 block">
                {totalLogsCount.toLocaleString('fa-IR')}
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl">
              <span className="text-slate-500 text-[11px] block">رویدادهای تایم‌لاین:</span>
              <span className="text-base font-black text-slate-900 font-mono mt-0.5 block">
                {totalEventsCount.toLocaleString('fa-IR')}
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl">
              <span className="text-slate-500 text-[11px] block">حجم تخمینی مصرفی:</span>
              <span className="text-base font-black text-teal-700 font-mono mt-0.5 block">
                {estimatedKb} کیلوبایت
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl">
              <span className="text-slate-500 text-[11px] block">قدیمی‌ترین لاگ ثبت‌شده:</span>
              <span className="text-[11px] font-bold text-slate-800 font-mono mt-1 block truncate">
                {oldestAccessLog}
              </span>
            </div>
          </div>

          {/* Backup Button before destructive operations */}
          {onExportBackup && (
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-teal-50 border border-teal-200 text-xs">
              <div className="flex items-center gap-2 text-teal-900 font-bold">
                <FileSpreadsheet className="w-4 h-4 text-teal-700" />
                <span>تهیه نسخه پشتیبان (اکسل) پیش از حذف لاگ‌ها:</span>
              </div>
              <button
                type="button"
                onClick={onExportBackup}
                className="bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition cursor-pointer"
              >
                دانلود اکسل لاگ‌ها
              </button>
            </div>
          )}

          {/* SECTION 2: Manual Prune Before Date */}
          <div className="border border-slate-200 rounded-2xl p-5 space-y-4 bg-white shadow-2xs">
            <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm border-b border-slate-100 pb-2">
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>۱. حذف دستی و سبک‌سازی بر اساس تاریخ یا بازه زمانی</span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              با انتخاب بازه زیر، تمام رکوردهای قدیمی‌تر به طور کامل از مرورگر و دیتابیس پاک شده و سرعت سامانه افزایش می‌یابد:
            </p>

            {/* Presets */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-bold">
              {[
                { id: 'ALL', title: 'پاکسازی ۱۰۰٪ (حذف تمام سوابق)' },
                { id: '7_DAYS', title: 'قدیمی‌تر از ۷ روز' },
                { id: '30_DAYS', title: 'قدیمی‌تر از ۱ ماه (۳۰ روز)' },
                { id: '90_DAYS', title: 'قدیمی‌تر از ۳ ماه (۹۰ روز)' },
                { id: '180_DAYS', title: 'قدیمی‌تر از ۶ ماه (۱۸۰ روز)' },
                { id: 'CUSTOM', title: 'انتخاب تاریخ دلخواه...' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPreset(p.id as any)}
                  className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                    selectedPreset === p.id
                      ? 'bg-rose-50 border-rose-400 text-rose-900 font-black shadow-2xs'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {p.title}
                </button>
              ))}
            </div>

            {/* Custom Date Input */}
            {selectedPreset === 'CUSTOM' && (
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2 animate-in fade-in">
                <label className="text-xs font-bold text-slate-700 block">
                  حذف کلیه لاگ‌های ثبت‌شده قبل از تاریخ زیر:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    placeholder="مثال: 1404/01/01 یا 2025-01-01"
                    className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                  />
                  <span className="text-[11px] text-slate-500">فرمت: سال/ماه/روز</span>
                </div>
              </div>
            )}

            {/* Scope checkboxes */}
            <div className="flex items-center gap-4 text-xs font-bold pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                <input
                  type="checkbox"
                  checked={pruneAccessLogs}
                  onChange={(e) => setPruneAccessLogs(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500"
                />
                <span>لاگ‌های تردد و دسترسی کاربران (UserAccessLogs)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                <input
                  type="checkbox"
                  checked={pruneAuditTimelineEvents}
                  onChange={(e) => setPruneAuditTimelineEvents(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500"
                />
                <span>رویدادهای تایم‌لاین نظارتی دفاتر (TimelineEvents)</span>
              </label>
            </div>

            {/* Execute Prune Button */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                disabled={isProcessing || (!pruneAccessLogs && !pruneAuditTimelineEvents)}
                onClick={handleExecuteManualPrune}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black text-white bg-rose-600 hover:bg-rose-700 active:scale-95 transition shadow-md shadow-rose-600/20 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isProcessing ? 'در حال سبک‌سازی و حذف...' : 'اجرای پاکسازی لاگ‌ها'}</span>
              </button>
            </div>
          </div>

          {/* SECTION 3: Automatic Retention Policy */}
          <div className="border border-slate-200 rounded-2xl p-5 space-y-4 bg-slate-50/50 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>۲. تنظیم سیاست پاکسازی دوره‌ای خودکار (Auto-Retention Policy)</span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                <span>فعال‌سازی پاکسازی خودکار:</span>
                <input
                  type="checkbox"
                  checked={autoPruneEnabled}
                  onChange={(e) => setAutoPruneEnabled(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
              </label>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              با فعال بودن این قابلیت، سامانه در هر بار ورود به صورت هوشمند لاگ‌های قدیمی‌تر از مهلت تعیین‌شده را بدون نیاز به دخالت دست حذف می‌نماید تا حجم دیتابیس همواره بهینه بماند.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  مدت زمان نگهداری لاگ‌ها در سامانه:
                </label>
                <select
                  disabled={!autoPruneEnabled}
                  value={retentionPolicy}
                  onChange={(e) => setRetentionPolicy(e.target.value as any)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden disabled:opacity-50 cursor-pointer"
                >
                  <option value="NEVER">نگهداری نامحدود (بدون حذف خودکار)</option>
                  <option value="7_DAYS">حداکثر ۷ روز (حذف خودکار پس از یک هفته)</option>
                  <option value="30_DAYS">حداکثر ۳۰ روز (حذف خودکار پس از یک ماه)</option>
                  <option value="90_DAYS">حداکثر ۹۰ روز (حذف خودکار پس از ۳ ماه)</option>
                  <option value="180_DAYS">حداکثر ۱۸۰ روز (حذف خودکار پس از ۶ ماه)</option>
                  <option value="365_DAYS">حداکثر ۳۶۵ روز (حذف خودکار پس از ۱ سال)</option>
                </select>
              </div>

              <div className="text-xs text-slate-500 space-y-1">
                <div>وضعیت پاکسازی خودکار: <strong className={autoPruneEnabled ? 'text-emerald-700' : 'text-slate-600'}>{autoPruneEnabled ? 'فعال' : 'غیرفعال'}</strong></div>
                <div>آخرین پاکسازی خودکار: <strong className="text-slate-800 font-mono">{currentSettings.lastPrunedAt || 'تاکنون اجرا نشده'}</strong></div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleSavePolicy}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>ذخیره سیاست نگهداری خودکار</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition cursor-pointer"
          >
            بستن پنجره
          </button>
        </div>
      </div>
    </div>
  );
};
