import React, { useState } from 'react';
import { 
  ShieldCheck, 
  User, 
  Lock, 
  LogIn, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  Building2, 
  CheckCircle2, 
  Sparkles,
  HelpCircle,
  KeyRound,
  FileCheck
} from 'lucide-react';
import { AppUser, UserRole } from '../types/auth';
import { OfficeProfile } from '../types';
import { serverLogin } from '../services/centralSyncService';
import { normalizeDigits } from '../services/authService';

interface LoginModalProps {
  isOpen: boolean;
  users: AppUser[];
  offices?: OfficeProfile[];
  onLoginSuccess: (user: AppUser) => void;
  onClose?: () => void;
  showQuickLoginPanel?: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  users,
  offices = [],
  onLoginSuccess,
  onClose,
  showQuickLoginPanel = false,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanUser = normalizeDigits(username).trim();
    const cleanPass = normalizeDigits(password).trim();

    if (!cleanUser) {
      setErrorMessage('لطفاً نام کاربری یا شناسه کاربری را وارد فرمایید.');
      return;
    }
    if (!cleanPass) {
      setErrorMessage('لطفاً رمز عبور را وارد فرمایید.');
      return;
    }

    setIsLoading(true);
    try {
      // Authentication is always central-server based. localStorage is never
      // trusted for credentials, including when the network is unavailable.
      const serverResult = await serverLogin(cleanUser, cleanPass);
      if (serverResult?.success && serverResult.user) {
        onLoginSuccess(serverResult.user);
        return;
      }

      setErrorMessage(
        serverResult?.isNetworkError
          ? 'ارتباط با سرور احراز هویت برقرار نشد. لطفاً اتصال شبکه را بررسی کنید و دوباره تلاش نمایید.'
          : (serverResult?.error || 'نام کاربری یا رمز عبور نادرست است.')
      );
    } catch (err) {
      console.error('[LoginModal] Central authentication failed:', err);
      setErrorMessage('ارتباط با سرور احراز هویت برقرار نشد. بدون تأیید سرور امکان ورود وجود ندارد.');
    } finally {
      setIsLoading(false);
    }
  };

  // Quick fill demo credentials helper
  const handleQuickFill = (user: AppUser) => {
    setUsername(user.username || user.nationalId);
    setPassword(user.passwordHash || user.username || '12345678');
    setErrorMessage(null);
  };

  const adminUsers = users.filter((u) => u.role === 'SYSTEM_ADMIN');
  const inspectorUsers = users.filter((u) => u.role === 'INSPECTOR');
  const officeUsers = users.filter((u) => u.role === 'OFFICE_USER');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className={`bg-white rounded-3xl border border-slate-200 shadow-2xl w-full ${showQuickLoginPanel ? 'max-w-2xl' : 'max-w-md'} overflow-hidden my-8 transition-all`}>
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-emerald-900 text-white p-6 sm:p-8 relative">
          <div className="flex items-center gap-3.5 mb-2">
            <div className="w-13 h-13 rounded-2xl overflow-hidden bg-slate-950 border border-emerald-400/40 flex items-center justify-center shadow-lg shrink-0">
              <img src="/audit.png" alt="نشان بازرسی و نظارت" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                ورود به سامانه نظارت و بازرسی دفاتر RA
              </h2>
              <p className="text-xs sm:text-sm text-emerald-200/80 mt-0.5">
                مرکز بازرسی و نظارت دفاتر ثبت نام مرکز میانی عام
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1 bg-white/10 px-2.5 py-1 rounded-lg border border-white/10">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              احراز هویت با نام کاربری و کلمه عبور
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8">
          {errorMessage && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 text-xs sm:text-sm">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">خطا در احراز هویت</p>
                <p className="mt-0.5 text-rose-700">{errorMessage}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                نام کاربری <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="نام کاربری"
                  dir="ltr"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                  required
                />
                <User className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">
                  رمز عبور <span className="text-rose-500">*</span>
                </label>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="رمز عبور"
                  dir="ltr"
                  className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                  required
                />
                <Lock className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 text-sm transition cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <span>در حال بررسی اعتبار...</span>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>ورود به سامانه</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Selector for fast testing & grading (Only shown if enabled in Management Panel) */}
          {showQuickLoginPanel && (
            <div className="mt-8 pt-6 border-t border-slate-100 animate-fade-in">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  انتخاب سریع کاربران و دفاتر (کلیک جهت تست فوری لاگین با کاربری و رمز):
                </h3>
              </div>

              {/* Role Filter Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* 1. Admin */}
                <div className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                      ۱. مدیر ارشد سیستم
                    </span>
                    <span className="text-[10px] text-slate-400">دسترسی تام</span>
                  </div>
                  <div className="space-y-1.5 mt-2">
                    {adminUsers.slice(0, 1).map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleQuickFill(u)}
                        className="w-full text-right p-2 bg-white hover:bg-purple-50 border border-slate-200 rounded-lg text-xs transition cursor-pointer"
                      >
                        <p className="font-bold text-slate-800 text-[11px] truncate">{u.fullName}</p>
                        <p className="text-[10px] text-purple-700 font-mono mt-0.5 font-bold">
                          کاربری: {u.username}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Inspector */}
                <div className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                      ۲. بازرس و ارزیاب
                    </span>
                    <span className="text-[10px] text-slate-400">کل دفاتر</span>
                  </div>
                  <div className="space-y-1.5 mt-2">
                    {inspectorUsers.slice(0, 1).map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleQuickFill(u)}
                        className="w-full text-right p-2 bg-white hover:bg-blue-50 border border-slate-200 rounded-lg text-xs transition cursor-pointer"
                      >
                        <p className="font-bold text-slate-800 text-[11px] truncate">{u.fullName}</p>
                        <p className="text-[10px] text-blue-700 font-mono mt-0.5 font-bold">
                          کاربری: {u.username}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Office Users (including 324 Mashhad and 1607) */}
                <div className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      ۳. دفاتر ثبت نام ({officeUsers.length})
                    </span>
                    <span className="text-[10px] text-slate-400">انحصاری دفتر</span>
                  </div>
                  <div className="space-y-1.5 mt-2 max-h-48 overflow-y-auto pr-0.5">
                    {officeUsers.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleQuickFill(u)}
                        className={`w-full text-right p-2 bg-white hover:bg-emerald-50 border rounded-lg text-xs transition cursor-pointer ${
                          u.assignedOfficeCode === '324' ? 'border-amber-300 ring-1 ring-amber-300/40 bg-amber-50/40' : 'border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-slate-800 text-[11px] truncate">{u.fullName}</p>
                          {u.assignedOfficeCode === '324' && (
                            <span className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded font-bold">
                              دفتر ۳۲۴ مشهد
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-emerald-700 font-mono mt-0.5 font-bold">
                          کاربری: {u.username}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
