import React, { useState } from 'react';
import { 
  Sliders, 
  Check, 
  X, 
  RotateCcw, 
  ShieldCheck, 
  Building2, 
  User, 
  Lock, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  Eye,
  Edit3
} from 'lucide-react';
import { FormFieldSetting, FormFieldTarget } from '../types';
import { DEFAULT_FORM_FIELD_SETTINGS } from '../utils/auditTimelineLogger';

interface FormFieldSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  fieldSettings?: FormFieldSetting[];
  settings?: FormFieldSetting[];
  onSave?: (newSettings: FormFieldSetting[]) => void;
  onSaveSettings?: (newSettings: FormFieldSetting[]) => void;
}

export const FormFieldSettingsModal: React.FC<FormFieldSettingsModalProps> = ({
  isOpen,
  onClose,
  fieldSettings,
  settings,
  onSave,
  onSaveSettings,
}) => {
  const activeSettings = fieldSettings || settings || DEFAULT_FORM_FIELD_SETTINGS;
  const [localSettings, setLocalSettings] = useState<FormFieldSetting[]>(() => 
    JSON.parse(JSON.stringify(activeSettings))
  );
  const [activeTab, setActiveTab] = useState<FormFieldTarget>('OFFICE');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Sync with prop when opened or prop updates
  React.useEffect(() => {
    if (isOpen) {
      setLocalSettings(JSON.parse(JSON.stringify(activeSettings)));
      setSavedSuccess(false);
    }
  }, [isOpen, fieldSettings, settings]);

  if (!isOpen) return null;

  const handleToggleRequired = (key: string, target: FormFieldTarget) => {
    setLocalSettings(prev => prev.map(s => {
      if (s.key === key && s.target === target) {
        return { ...s, isRequired: !s.isRequired };
      }
      return s;
    }));
  };

  const handleToggleEditable = (key: string, target: FormFieldTarget) => {
    setLocalSettings(prev => prev.map(s => {
      if (s.key === key && s.target === target) {
        return { ...s, isEditable: !s.isEditable };
      }
      return s;
    }));
  };

  const handleResetDefaults = () => {
    setLocalSettings(JSON.parse(JSON.stringify(DEFAULT_FORM_FIELD_SETTINGS)));
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleSave = () => {
    if (onSave) {
      onSave(localSettings);
    }
    if (onSaveSettings) {
      onSaveSettings(localSettings);
    }
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  const currentFields = localSettings.filter(s => s.target === activeTab);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-200">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                مدیریت و پیکربندی فیلدهای دفتر و مسئول ثبت‌نام
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                تعیین اجباری/اختیاری بودن و فعال/غیرفعال بودن ویرایش فیلدها در کارتابل دفاتر و فرم‌های ثبت
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center justify-between gap-3 flex-wrap bg-slate-50 p-2 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('OFFICE')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                activeTab === 'OFFICE'
                  ? 'bg-white text-emerald-800 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-4 h-4 text-emerald-600" />
              <span>فیلدهای شناسنامه دفتر ثبت‌نام ({localSettings.filter(s => s.target === 'OFFICE').length})</span>
            </button>

            <button
              onClick={() => setActiveTab('MANAGER')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                activeTab === 'MANAGER'
                  ? 'bg-white text-emerald-800 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-4 h-4 text-teal-600" />
              <span>فیلدهای پرونده مسئول دفتر ({localSettings.filter(s => s.target === 'MANAGER').length})</span>
            </button>
          </div>

          <button
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-bold px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 transition cursor-pointer"
            title="بازنشانی به تنظیمات پیش‌فرض کارخانه"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>تنظیمات پیش‌فرض</span>
          </button>
        </div>

        {/* Info Banner */}
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold">راهنمای اعمال تنظیمات:</span>
            <p className="text-[11px] leading-relaxed">
              فیلدهای علامت‌خورده به عنوان <strong>«اجباری»</strong> در کارتابل و هنگام ثبت، با نشان ستاره قرمز مشخص شده و کاربر ملزم به ورود آن است. فیلدهای <strong>«غیرفعال برای ویرایش»</strong> به صورت قفل و فقط خواندنی نمایش داده می‌شوند.
            </p>
          </div>
        </div>

        {/* Fields Table */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100 text-slate-800 font-black border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">عنوان و شرح فیلد</th>
                <th className="py-3 px-4 text-center">اجباری / اختیاری</th>
                <th className="py-3 px-4 text-center">وضعیت ویرایش</th>
                <th className="py-3 px-4 text-center">پیش‌نمایش دسترسی</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentFields.map((field) => {
                return (
                  <tr key={`${field.target}-${field.key}`} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4">
                      <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                        <span>{field.label}</span>
                        {field.isRequired && <span className="text-rose-500 font-bold">*</span>}
                      </div>
                      {field.helpText && (
                        <div className="text-[11px] text-slate-500 mt-0.5">{field.helpText}</div>
                      )}
                    </td>

                    {/* Required Toggle */}
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleRequired(field.key, field.target)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                          field.isRequired
                            ? 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
                            : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {field.isRequired ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-rose-600" />
                            <span>اجباری (الزامی)</span>
                          </>
                        ) : (
                          <>
                            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                            <span>اختیاری</span>
                          </>
                        )}
                      </button>
                    </td>

                    {/* Editable Toggle */}
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleEditable(field.key, field.target)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                          field.isEditable
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                        }`}
                      >
                        {field.isEditable ? (
                          <>
                            <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>فعال برای ویرایش</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5 text-amber-700" />
                            <span>قفل / غیرفعال</span>
                          </>
                        )}
                      </button>
                    </td>

                    {/* Access Preview badge */}
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                        field.isEditable
                          ? field.isRequired
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            : 'bg-blue-50 text-blue-800 border border-blue-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-300'
                      }`}>
                        {field.isEditable 
                          ? (field.isRequired ? 'ویرایش اجباری' : 'ویرایش اختیاری') 
                          : 'فقط نمایش (قفل)'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <div className="text-xs text-slate-500">
            تعداد فیلدهای پیکربندی‌شده: {localSettings.length} مورد
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-100 rounded-xl font-bold transition cursor-pointer"
            >
              انصراف
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs transition cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{savedSuccess ? 'ذخیره شد!' : 'ذخیره و اعمال دسترسی‌ها'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const FormFieldSettingsPanel: React.FC<{
  fieldSettings?: FormFieldSetting[];
  settings?: FormFieldSetting[];
  onSave?: (newSettings: FormFieldSetting[]) => void;
  onSaveSettings?: (newSettings: FormFieldSetting[]) => void;
}> = ({ fieldSettings, settings, onSave, onSaveSettings }) => {
  const activeSettings = fieldSettings || settings || DEFAULT_FORM_FIELD_SETTINGS;
  const [localSettings, setLocalSettings] = useState<FormFieldSetting[]>(() => 
    JSON.parse(JSON.stringify(activeSettings))
  );
  const [activeTab, setActiveTab] = useState<FormFieldTarget>('OFFICE');
  const [savedSuccess, setSavedSuccess] = useState(false);

  React.useEffect(() => {
    setLocalSettings(JSON.parse(JSON.stringify(activeSettings)));
  }, [fieldSettings, settings]);

  const handleToggleRequired = (key: string, target: FormFieldTarget) => {
    setLocalSettings(prev => prev.map(s => {
      if (s.key === key && s.target === target) {
        return { ...s, isRequired: !s.isRequired };
      }
      return s;
    }));
  };

  const handleToggleEditable = (key: string, target: FormFieldTarget) => {
    setLocalSettings(prev => prev.map(s => {
      if (s.key === key && s.target === target) {
        return { ...s, isEditable: !s.isEditable };
      }
      return s;
    }));
  };

  const handleResetDefaults = () => {
    const reset = JSON.parse(JSON.stringify(DEFAULT_FORM_FIELD_SETTINGS));
    setLocalSettings(reset);
    if (onSave) onSave(reset);
    if (onSaveSettings) onSaveSettings(reset);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleSave = () => {
    if (onSave) onSave(localSettings);
    if (onSaveSettings) onSaveSettings(localSettings);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const currentFields = localSettings.filter(s => s.target === activeTab);

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-50 text-amber-700 rounded-2xl border border-amber-200 shadow-2xs">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900">
              پیکربندی و تنظیمات فیلدهای دفتر ثبت نام و مسئولین
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              تعیین فیلدهای اجباری/اختیاری و وضعیت فعال بودن ویرایش در کارتابل و فرم‌های ثبت اطلاعات
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-bold px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>تنظیمات پیش‌فرض</span>
          </button>

          <button
            onClick={handleSave}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2 rounded-xl shadow-xs transition cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{savedSuccess ? 'ذخیره گردید!' : 'ذخیره تنظیمات فیلدها'}</span>
          </button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
        <button
          onClick={() => setActiveTab('OFFICE')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
            activeTab === 'OFFICE'
              ? 'bg-white text-emerald-800 shadow-xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4 text-emerald-600" />
          <span>فیلدهای شناسنامه دفتر ثبت‌نام ({localSettings.filter(s => s.target === 'OFFICE').length})</span>
        </button>

        <button
          onClick={() => setActiveTab('MANAGER')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
            activeTab === 'MANAGER'
              ? 'bg-white text-emerald-800 shadow-xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <User className="w-4 h-4 text-teal-600" />
          <span>فیلدهای پرونده مسئول دفتر ({localSettings.filter(s => s.target === 'MANAGER').length})</span>
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 text-xs text-amber-900 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold">راهنمای اعمال تغییرات:</span>
          <p className="text-[11px] leading-relaxed">
            فیلدهای علامت‌خورده به عنوان <strong>«اجباری»</strong> در کارتابل و هنگام ثبت، با نشان ستاره قرمز مشخص شده و کاربر ملزم به ورود آن است. فیلدهای <strong>«غیرفعال برای ویرایش»</strong> به صورت قفل و فقط خواندنی نمایش داده می‌شوند.
          </p>
        </div>
      </div>

      {/* Fields Table */}
      <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
        <table className="w-full text-right text-xs">
          <thead className="bg-slate-100 text-slate-800 font-black border-b border-slate-200">
            <tr>
              <th className="py-3.5 px-4">عنوان و شرح فیلد</th>
              <th className="py-3.5 px-4 text-center">اجباری / اختیاری</th>
              <th className="py-3.5 px-4 text-center">وضعیت ویرایش</th>
              <th className="py-3.5 px-4 text-center">پیش‌نمایش دسترسی</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {currentFields.map((field) => {
              return (
                <tr key={`${field.target}-${field.key}`} className="hover:bg-slate-50/80 transition">
                  <td className="py-3.5 px-4">
                    <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                      <span>{field.label}</span>
                      {field.isRequired && <span className="text-rose-500 font-bold">*</span>}
                    </div>
                    {field.helpText && (
                      <div className="text-[11px] text-slate-500 mt-0.5">{field.helpText}</div>
                    )}
                  </td>

                  {/* Required Toggle */}
                  <td className="py-3.5 px-4 text-center">
                    <button
                      type="button"
                      onClick={() => handleToggleRequired(field.key, field.target)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                        field.isRequired
                          ? 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
                          : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {field.isRequired ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>اجباری (الزامی)</span>
                        </>
                      ) : (
                        <>
                          <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                          <span>اختیاری</span>
                        </>
                      )}
                    </button>
                  </td>

                  {/* Editable Toggle */}
                  <td className="py-3.5 px-4 text-center">
                    <button
                      type="button"
                      onClick={() => handleToggleEditable(field.key, field.target)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                        field.isEditable
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                          : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                      }`}
                    >
                      {field.isEditable ? (
                        <>
                          <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>فعال برای ویرایش</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5 text-amber-700" />
                          <span>قفل / غیرفعال</span>
                        </>
                      )}
                    </button>
                  </td>

                  {/* Access Preview badge */}
                  <td className="py-3.5 px-4 text-center">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                      field.isEditable
                        ? field.isRequired
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-blue-50 text-blue-800 border border-blue-200'
                        : 'bg-slate-100 text-slate-700 border border-slate-300'
                    }`}>
                      {field.isEditable 
                        ? (field.isRequired ? 'ویرایش اجباری' : 'ویرایش اختیاری') 
                        : 'فقط نمایش (قفل)'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
