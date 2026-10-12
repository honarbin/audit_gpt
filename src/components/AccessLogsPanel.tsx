import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, 
  History, 
  LogIn, 
  LogOut, 
  KeyRound, 
  Eye, 
  Building2, 
  Search, 
  Filter, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Download,
  Trash2,
  Sparkles,
  ShieldCheck,
  FileDown,
  SlidersHorizontal
} from 'lucide-react';
import { UserAccessLog, AppUser } from '../types/auth';
import { OfficeProfile } from '../types';
import { LogRetentionModal } from './LogRetentionModal';
import { clearAllAccessLogs } from '../services/systemSettingsService';

interface AccessLogsPanelProps {
  logs: UserAccessLog[];
  onClearLogs?: () => void;
  onLogsUpdated?: (remaining: UserAccessLog[]) => void;
  offices: OfficeProfile[];
}

export const AccessLogsPanel: React.FC<AccessLogsPanelProps> = ({
  logs,
  onClearLogs,
  onLogsUpdated,
  offices,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActionFilter, setSelectedActionFilter] = useState<string>('ALL');
  const [selectedOfficeFilter, setSelectedOfficeFilter] = useState<string>('ALL');
  const [isRetentionModalOpen, setIsRetentionModalOpen] = useState<boolean>(false);
  const [showConfirmClearModal, setShowConfirmClearModal] = useState<boolean>(false);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  const handleOpenClearModal = () => {
    if (logs.length === 0) {
      setFeedbackBanner('⚠️ در حال حاضر هیچ لاگی جهت پاکسازی در پایگاه داده وجود ندارد.');
      setTimeout(() => setFeedbackBanner(null), 4000);
      return;
    }
    setShowConfirmClearModal(true);
  };

  const handleExecuteClearLogs = () => {
    const res = clearAllAccessLogs();
    if (onLogsUpdated) {
      onLogsUpdated([]);
    }
    if (onClearLogs) {
      onClearLogs();
    }
    setShowConfirmClearModal(false);
    setFeedbackBanner(`✅ پاکسازی با موفقیت انجام شد: تعداد ${res.removedCount.toLocaleString('fa-IR')} لاگ با موفقیت حذف گردید و فضای پایگاه داده سبک شد.`);
    setTimeout(() => setFeedbackBanner(null), 7000);
  };

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchUser = log.username?.toLowerCase().includes(q) || log.fullName?.toLowerCase().includes(q);
        const matchOffice = log.officeCode?.includes(q) || log.officeName?.toLowerCase().includes(q);
        const matchDetails = log.details?.toLowerCase().includes(q);
        if (!matchUser && !matchOffice && !matchDetails) return false;
      }

      // Action Filter
      if (selectedActionFilter !== 'ALL' && log.actionType !== selectedActionFilter) {
        return false;
      }

      // Office Filter
      if (selectedOfficeFilter !== 'ALL' && log.officeCode !== selectedOfficeFilter) {
        return false;
      }

      return true;
    });
  }, [logs, searchQuery, selectedActionFilter, selectedOfficeFilter]);

  // Statistics
  const totalLogins = logs.filter((l) => l.actionType === 'LOGIN').length;
  const totalNotifViews = logs.filter((l) => l.actionType === 'VIEW_NOTIFICATIONS').length;
  const totalPassChanges = logs.filter((l) => l.actionType === 'PASSWORD_CHANGE').length;

  // Offices that have logged in at least once
  const officesWithAccess = useMemo(() => {
    interface OfficeAccessSummary {
      name: string;
      loginCount: number;
      notifViewCount: number;
      lastLogin?: string;
      lastNotifView?: string;
    }
    const map = new Map<string, OfficeAccessSummary>();
    
    logs.forEach((log) => {
      if (log.officeCode) {
        const current: OfficeAccessSummary = map.get(log.officeCode) || {
          name: log.officeName || `دفتر کد ${log.officeCode}`,
          loginCount: 0,
          notifViewCount: 0,
        };

        if (log.actionType === 'LOGIN') {
          current.loginCount += 1;
          if (!current.lastLogin) current.lastLogin = log.timestamp;
        } else if (log.actionType === 'VIEW_NOTIFICATIONS') {
          current.notifViewCount += 1;
          if (!current.lastNotifView) current.lastNotifView = log.timestamp;
        }

        map.set(log.officeCode, current);
      }
    });

    return map;
  }, [logs]);

  // Export Excel (.xlsx)
  const handleExportXLSX = () => {
    if (logs.length === 0) {
      alert('لاگی جهت خروجی اکسل موجود نیست.');
      return;
    }

    const exportData = filteredLogs.map((l, idx) => ({
      'ردیف': idx + 1,
      'شناسه لاگ': l.id,
      'نام کاربری': l.username,
      'نام و نام خانوادگی': l.fullName,
      'نقش': l.role === 'SYSTEM_ADMIN' ? 'مدیر ارشد' : l.role === 'INSPECTOR' ? 'بازرس / ممیز' : 'نماینده دفتر',
      'کد دفتر': l.officeCode || '-',
      'نام دفتر': l.officeName || '-',
      'نوع رویداد': l.actionType === 'LOGIN' ? 'ورود به سامانه' : l.actionType === 'LOGOUT' ? 'خروج از سامانه' : l.actionType === 'VIEW_NOTIFICATIONS' ? 'مشاهده اعلان‌ها و کارتابل' : 'تغییر رمز عبور',
      'تاریخ و ساعت ثبت': l.timestamp,
      'جزئیات و رخداد': l.details || '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!cols'] = [
      { wch: 8 },  // ردیف
      { wch: 22 }, // شناسه
      { wch: 18 }, // نام کاربری
      { wch: 26 }, // نام کاربر
      { wch: 16 }, // نقش
      { wch: 14 }, // کد دفتر
      { wch: 35 }, // نام دفتر
      { wch: 25 }, // نوع رویداد
      { wch: 22 }, // زمان
      { wch: 45 }, // جزئیات
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'گزارش لاگ‌های دسترسی و رویت');
    XLSX.writeFile(workbook, `لاگ_دسترسی_و_رویت_دفاتر_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Export CSV
  const handleExportCSV = () => {
    if (logs.length === 0) {
      alert('لاگی جهت خروجی موجود نیست.');
      return;
    }

    const headers = ['ردیف', 'شناسه', 'نام کاربری', 'نام و نام خانوادگی', 'نقش', 'کد دفتر', 'نام دفتر', 'نوع عملیات', 'تاریخ و ساعت', 'جزئیات'];
    const rows = filteredLogs.map((l, idx) => [
      idx + 1,
      l.id,
      l.username,
      l.fullName,
      l.role === 'SYSTEM_ADMIN' ? 'مدیر ارشد' : l.role === 'INSPECTOR' ? 'بازرس' : 'دفتر',
      l.officeCode || '',
      l.officeName || '',
      l.actionType === 'LOGIN' ? 'ورود به سامانه' : l.actionType === 'LOGOUT' ? 'خروج از سامانه' : l.actionType === 'VIEW_NOTIFICATIONS' ? 'مشاهده اعلان‌ها' : 'تغییر رمز عبور',
      l.timestamp,
      `"${(l.details || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `office_access_logs_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center">
            <History className="w-6 h-6 text-teal-700" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">
              ثبت و تحلیل لاگ‌های دسترسی و رویت اعلان‌ها (AccessLogsPanel)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              پیگیری دقیق و زمان‌بندی‌شده رویدادهای ورود، خروج، تغییر رمز و بازدید اعلان‌ها و کارتابل توسط دفاتر به همراه خروجی فایل اکسل (XLSX/CSV)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExportXLSX}
            className="flex items-center gap-2 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>خروجی اکسل (Excel XLSX)</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl shadow-xs transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>خروجی CSV</span>
          </button>

          <button
            onClick={() => setIsRetentionModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl shadow-xs transition cursor-pointer"
            title="سبک‌سازی پایگاه داده و تنظیمات نگهداری زمانی یا خودکار لاگ‌ها"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>سبک‌سازی و نگهداری لاگ‌ها</span>
          </button>

          <button
            onClick={handleOpenClearModal}
            title="پاکسازی تاریخچه لاگ‌های ورود و خروج"
            className="flex items-center gap-1.5 text-rose-700 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 hover:border-rose-600 text-xs px-3.5 py-2.5 rounded-xl font-bold transition shadow-xs cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>پاکسازی لاگ‌ها</span>
          </button>
        </div>
      </div>

      {/* Operation Feedback Result Banner */}
      {feedbackBanner && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 font-bold text-xs flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{feedbackBanner}</span>
          </div>
          <button
            onClick={() => setFeedbackBanner(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs cursor-pointer font-bold px-2 py-1 rounded-md"
          >
            بستن
          </button>
        </div>
      )}

      {/* Quick Office Access Status Grid */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-6 shadow-md border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-black text-white">
              وضعیت نظارتی ورود دفاتر ثبت نام و مشاهده اعلان‌ها
            </h3>
          </div>
          <span className="text-xs bg-white/10 text-amber-300 font-bold px-3 py-1 rounded-full border border-white/10">
            {officesWithAccess.size} از {offices.length} دفتر فعالیت داشته‌اند
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {offices.map((office) => {
            const accessInfo = officesWithAccess.get(office.code);
            const hasLoggedIn = Boolean(accessInfo && accessInfo.loginCount > 0);
            const hasSeenNotifs = Boolean(accessInfo && accessInfo.notifViewCount > 0);

            return (
              <div
                key={office.code}
                className={`p-3.5 rounded-2xl border transition ${
                  hasLoggedIn
                    ? 'bg-slate-800/80 border-emerald-500/40 text-slate-100'
                    : 'bg-slate-800/40 border-slate-700 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black px-2 py-0.5 rounded-md font-mono">
                      کد {office.code}
                    </span>
                    <span className="font-bold text-xs text-white truncate max-w-[150px]">
                      {office.name}
                    </span>
                  </div>
                  {hasLoggedIn ? (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      <CheckCircle2 className="w-3 h-3" />
                      وارد شده
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-amber-400/90 font-bold bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-500/30">
                      <AlertCircle className="w-3 h-3" />
                      عدم ورود
                    </span>
                  )}
                </div>

                <div className="space-y-1 text-[11px] text-slate-300 pt-2 border-t border-slate-700/60">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">آخرین ورود:</span>
                    <span className="font-mono text-emerald-300">
                      {accessInfo?.lastLogin || 'ثبت نشده'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">مشاهده اعلان‌ها:</span>
                    <span className={hasSeenNotifs ? 'text-teal-300 font-mono font-bold' : 'text-slate-500'}>
                      {hasSeenNotifs ? `${accessInfo?.lastNotifView || 'مشاهده شده'}` : 'هنوز ندیده است'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-teal-100 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
              <LogIn className="w-5 h-5 text-teal-700" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">مجموع لاگین‌ها به سیستم</p>
              <p className="text-lg font-black text-slate-900">{totalLogins} ورود</p>
            </div>
          </div>
          <span className="text-[10px] bg-teal-100 text-teal-800 font-bold px-2 py-0.5 rounded-md">
            ورود موفق
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-blue-100 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Eye className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">بازدید مرکز اعلان‌ها توسط دفاتر</p>
              <p className="text-lg font-black text-slate-900">{totalNotifViews} بار</p>
            </div>
          </div>
          <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-md">
            رویت اعلان
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-amber-100 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">تغییرات کلمه عبور</p>
              <p className="text-lg font-black text-slate-900">{totalPassChanges} تغییر</p>
            </div>
          </div>
          <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-md">
            ارتقای امنیت
          </span>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو در لاگ‌ها (نام کاربری، نام، کد دفتر، جزئیات)..."
            className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Action Filter */}
          <select
            value={selectedActionFilter}
            onChange={(e) => setSelectedActionFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-900 text-xs font-semibold px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
          >
            <option value="ALL">همه انواع رویدادها</option>
            <option value="LOGIN">ورود به سیستم (Login)</option>
            <option value="LOGOUT">خروج از سیستم (Logout)</option>
            <option value="VIEW_NOTIFICATIONS">مشاهده اعلان‌ها و کارتابل</option>
            <option value="PASSWORD_CHANGE">تغییر کلمه عبور</option>
          </select>

          {/* Office Filter */}
          <select
            value={selectedOfficeFilter}
            onChange={(e) => setSelectedOfficeFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-900 text-xs font-semibold px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
          >
            <option value="ALL">همه دفاتر ({offices.length})</option>
            {offices.map((o) => (
              <option key={o.code} value={o.code}>
                دفتر {o.name} (کد {o.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-600">
                <th className="py-3.5 px-4">نوع عملیات / رویداد</th>
                <th className="py-3.5 px-4">کاربر و نام کاربری</th>
                <th className="py-3.5 px-4">نقش سازمانی</th>
                <th className="py-3.5 px-4">دفتر ثبت نام</th>
                <th className="py-3.5 px-4">زمان ثبت دقیق</th>
                <th className="py-3.5 px-4">توضیحات و رخداد</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    هیچ لاگی با فیلترهای انتخابی یافت نشد.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition">
                      {/* Action Type */}
                      <td className="py-3.5 px-4">
                        {log.actionType === 'LOGIN' && (
                          <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold px-2.5 py-1 rounded-lg">
                            <LogIn className="w-3.5 h-3.5 text-emerald-600" />
                            ورود به سامانه
                          </span>
                        )}
                        {log.actionType === 'LOGOUT' && (
                          <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-bold px-2.5 py-1 rounded-lg">
                            <LogOut className="w-3.5 h-3.5 text-slate-600" />
                            خروج از حساب
                          </span>
                        )}
                        {log.actionType === 'VIEW_NOTIFICATIONS' && (
                          <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-800 border border-blue-200 text-[11px] font-bold px-2.5 py-1 rounded-lg">
                            <Eye className="w-3.5 h-3.5 text-blue-600" />
                            مشاهده اعلان‌ها
                          </span>
                        )}
                        {log.actionType === 'PASSWORD_CHANGE' && (
                          <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold px-2.5 py-1 rounded-lg">
                            <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                            تغییر رمز عبور
                          </span>
                        )}
                      </td>

                      {/* User & Username */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{log.fullName}</div>
                        <div className="text-[10px] text-teal-700 font-mono mt-0.5">
                          نام کاربری: {log.username}
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4">
                        <span className="text-[11px] font-semibold text-slate-700">
                          {log.role === 'SYSTEM_ADMIN' && 'مدیر ارشد'}
                          {log.role === 'INSPECTOR' && 'بازرس / ممیز'}
                          {log.role === 'OFFICE_USER' && 'نماینده دفتر'}
                        </span>
                      </td>

                      {/* Office */}
                      <td className="py-3.5 px-4">
                        {log.officeCode ? (
                          <div className="flex items-center gap-1 text-slate-800 font-medium">
                            <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-1.5 py-0.5 rounded font-mono">
                              کد {log.officeCode}
                            </span>
                            <span className="truncate max-w-[150px]">{log.officeName || ''}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">---</span>
                        )}
                      </td>

                      {/* Timestamp */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600" dir="ltr">
                        {log.timestamp}
                      </td>

                      {/* Details */}
                      <td className="py-3.5 px-4 text-slate-600 text-[11px]">
                        {log.details || '---'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal for Complete Logs Clearance */}
      {showConfirmClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border-2 border-rose-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 border border-rose-200 text-rose-700 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base font-black text-slate-900">
                تأیید پاکسازی کامل لاگ‌ها
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                آیا از پاکسازی کامل تمامی <span className="font-bold text-rose-700 font-mono">{logs.length.toLocaleString('fa-IR')}</span> سطر لاگ تردد، ورود و خروج و رویت اطمینان دارید؟
              </p>
              <div className="bg-amber-50 border border-amber-200 text-amber-900 text-[11px] p-2.5 rounded-xl text-right">
                ⚠️ هشدار: این عملیات غیرقابل بازگشت است. در صورت نیاز به نسخه پشتیبان، ابتدا از دکمه خروجی اکسل استفاده فرمایید.
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleExecuteClearLogs}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
              >
                بله، پاکسازی کامل انجام شود
              </button>
              <button
                onClick={() => setShowConfirmClearModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Retention & Auto Pruning Modal */}
      {isRetentionModalOpen && (
        <LogRetentionModal
          isOpen={isRetentionModalOpen}
          onClose={() => setIsRetentionModalOpen(false)}
          accessLogs={logs || []}
          onExportBackup={handleExportXLSX}
          onLogsPruned={() => {
            if (onClearLogs) {
              onClearLogs();
            }
          }}
          onLogsUpdated={(remaining) => {
            if (onLogsUpdated) {
              onLogsUpdated(remaining);
            }
            if (onClearLogs) {
              onClearLogs();
            }
            setFeedbackBanner(`✅ تغییرات نگهداری لاگ‌ها با موفقیت اعمال شد. تعداد ${remaining.length.toLocaleString('fa-IR')} لاگ در پایگاه داده باقی ماند.`);
          }}
        />
      )}
    </div>
  );
};
