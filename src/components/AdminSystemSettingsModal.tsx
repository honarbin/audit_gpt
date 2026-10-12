import React, { useState } from 'react';
import { 
  Settings, 
  X, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  Building2, 
  Clock, 
  FileText,
  SlidersHorizontal,
  Info
} from 'lucide-react';
import { 
  AdminSystemSettings, 
  getAdminSystemSettings, 
  saveAdminSystemSettings 
} from '../services/systemSettingsService';

interface AdminSystemSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenLogRetention?: () => void;
  onSettingsSaved?: (newSettings: AdminSystemSettings) => void;
}

export const AdminSystemSettingsModal: React.FC<AdminSystemSettingsModalProps> = ({
  isOpen,
  onClose,
  onOpenLogRetention,
  onSettingsSaved,
}) => {
  const current = getAdminSystemSettings();
  const [isInspectorVisible, setIsInspectorVisible] = useState<boolean>(current.isInspectorVisibleToOffice);
  const [anonymousTitle, setAnonymousTitle] = useState<string>(
    current.anonymousInspectorTitle || 'واحد نظارت و ممیزی دفاتر صدور گواهی'
  );
  const [isSaved, setIsSaved] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = saveAdminSystemSettings({
      isInspectorVisibleToOffice: isInspectorVisible,
      anonymousInspectorTitle: anonymousTitle.trim() || 'واحد نظارت و ممیزی دفاتر صدور گواهی',
    });
    setIsSaved(true);
    if (onSettingsSaved) onSettingsSaved(updated);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden animate-in zoom-in-95 my-4">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-l from-indigo-50 via-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                تنظیمات مدیریتی و حاکمیتی سامانه
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                پیکربندی سطح دسترسی و نمایش اطلاعات برای دفاتر ثبت نام
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

        {/* Body Form */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* Setting 1: Inspector Visibility to Registration Offices */}
          <div className="border border-slate-200 rounded-2xl p-4.5 bg-slate-50/50 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-black text-slate-900">
                  {isInspectorVisible ? (
                    <Eye className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-amber-600" />
                  )}
                  <span>رویت‌پذیری مشخصات بازرس برای دفاتر ثبت نام</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  تعیین اینکه آیا دفاتر در کارتابل و نامه‌نگاری‌ها نام شخص بازرس را مشاهده کنند، یا هویت بازرس به صورت سازمانی و محرمانه باقی بماند.
                </p>
              </div>

              {/* Toggle switch */}
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                <input
                  type="checkbox"
                  checked={isInspectorVisible}
                  onChange={(e) => setIsInspectorVisible(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* Explanation box */}
            <div className={`p-3 rounded-xl border text-xs leading-relaxed transition ${
              isInspectorVisible 
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950' 
                : 'bg-amber-50/80 border-amber-200 text-amber-950'
            }`}>
              {isInspectorVisible ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>حالت شفاف:</strong> نام و مشخصات کارشناس بازرسی برای دفاتر نمایش داده می‌شود.
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>حالت محرمانه / سازمانی:</strong> دفاتر نام فرد را نمی‌بینند و کلیه تذکرات با عنوان سازمانی زیر صادر خواهد شد.
                  </span>
                </div>
              )}
            </div>

            {/* Custom Title when Anonymous */}
            {!isInspectorVisible && (
              <div className="space-y-1.5 pt-1 animate-in fade-in">
                <label className="text-xs font-bold text-slate-700 block">
                  عنوان جایگزین سازمانی برای نمایش به دفاتر:
                </label>
                <input
                  type="text"
                  value={anonymousTitle}
                  onChange={(e) => setAnonymousTitle(e.target.value)}
                  placeholder="مثال: واحد نظارت و ممیزی دفاتر صدور گواهی"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
            )}
          </div>

          {/* Setting 2: Log Retention Link */}
          {onOpenLogRetention && (
            <div className="border border-slate-200 rounded-2xl p-4 bg-white flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-black text-slate-900 block">
                  مدیریت سبک‌سازی و نگهداری لاگ‌ها
                </span>
                <span className="text-[11px] text-slate-500">
                  سیاست پاکسازی خودکار دوره‌ای و حذف لاگ‌های قبل از تاریخ معین
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenLogRetention();
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-3 py-2 rounded-xl transition cursor-pointer shrink-0"
              >
                پیکربندی لاگ‌ها
              </button>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSaved ? 'ذخیره گردید!' : 'ذخیره تنظیمات'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
