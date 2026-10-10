import React, { useState } from 'react';
import { 
  Lock, 
  KeyRound, 
  ShieldAlert, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  ArrowLeft,
  Sparkles,
  Loader2
} from 'lucide-react';
import { AppUser } from '../types/auth';
import { syncUserPasswordToServer, saveUserToServer, normalizeDigits } from '../services/authService';
import { upsertUserToSupabase } from '../services/supabaseService';

interface ForcePasswordChangeModalProps {
  isOpen: boolean;
  user: AppUser;
  onPasswordChanged: (updatedUser: AppUser) => void;
}

export const ForcePasswordChangeModal: React.FC<ForcePasswordChangeModalProps> = ({
  isOpen,
  user,
  onPasswordChanged,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const rawPass = newPassword.trim();
    const rawConfirm = confirmPassword.trim();
    const cleanPass = normalizeDigits(rawPass);
    const cleanConfirm = normalizeDigits(rawConfirm);
    const cleanUsername = normalizeDigits(user.username).toLowerCase();

    if (!cleanPass) {
      setErrorMessage('لطفاً کلمه عبور جدید را وارد فرمایید.');
      return;
    }

    if (cleanPass.length < 5) {
      setErrorMessage('کلمه عبور جدید باید حداقل دارای ۵ کاراکتر باشد.');
      return;
    }

    if (cleanPass.toLowerCase() === cleanUsername) {
      setErrorMessage('کلمه عبور جدید نباید برابر با نام کاربری اولیه باشد.');
      return;
    }

    if (cleanPass !== cleanConfirm) {
      setErrorMessage('کلمه عبور جدید با تکرار آن یکسان نمی‌باشد.');
      return;
    }

    setIsLoading(true);

    (async () => {
      try {
        // ۱. ذخیره قطعی در سرور دیتابیس متمرکز و کش محلی
        const res = await syncUserPasswordToServer(user.id, cleanPass, undefined, user.username);
        
        const updatedUser: AppUser = {
          ...user,
          ...(res.user || {}),
          passwordHash: res.user?.passwordHash || cleanPass,
          isPasswordChanged: true,
        };

        saveUserToServer(updatedUser).catch(() => {});
        upsertUserToSupabase(updatedUser).catch(() => {});

        setIsLoading(false);
        onPasswordChanged(updatedUser);
      } catch (e: any) {
        console.error('Error updating password:', e);
        const fallbackUser: AppUser = {
          ...user,
          passwordHash: cleanPass,
          isPasswordChanged: true,
        };
        setIsLoading(false);
        onPasswordChanged(fallbackUser);
      }
    })();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-white rounded-3xl border border-amber-200 shadow-2xl w-full max-w-lg overflow-hidden my-8 animate-in zoom-in-95">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-amber-900 text-white p-6 sm:p-7 relative">
          <div className="flex items-center gap-3.5 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center backdrop-blur-xs">
              <KeyRound className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                الزام تغییر کلمه عبور در اولین ورود
              </h2>
              <p className="text-xs text-amber-100/90 mt-0.5">
                کاربر گرامی <span className="font-bold underline">{user.fullName}</span> (نام کاربری: <span className="font-mono">{user.username}</span>)
              </p>
            </div>
          </div>
          
          <div className="mt-3 bg-white/10 rounded-xl p-2.5 text-[11px] text-amber-50 border border-white/15 leading-relaxed">
            مطابق الزامات امنیتی مرکز بازرسی و نظارت دفاتر ثبت نام مرکز میانی عام، به دلیل استفاده از کلمه عبور پیش‌فرض (همان نام کاربری)، لطفاً پیش از دسترسی به سامانه، رمز عبور اختصاصی و امن خود را تعیین فرمایید.
          </div>
        </div>

        {/* Body */}
        <div className="p-6 sm:p-7">
          {errorMessage && (
            <div className="mb-5 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">خطا در اعتبارسنجی رمز</p>
                <p className="mt-0.5 text-rose-700">{errorMessage}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* User Details Snapshot */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between text-[11px]">
              <div>
                <span className="text-slate-500">نام کاربری: </span>
                <strong className="text-slate-900 font-mono text-xs">{user.username}</strong>
              </div>
              <div>
                <span className="text-slate-500">نقش: </span>
                <strong className="text-slate-900 font-bold">
                  {user.role === 'SYSTEM_ADMIN' ? 'مدیر ارشد' : user.role === 'INSPECTOR' ? 'بازرس' : `دفتر ${user.assignedOfficeCode || ''}`}
                </strong>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                کلمه عبور جدید <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="حداقل ۵ کاراکتر امن"
                  dir="ltr"
                  className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
                  required
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                تکرار کلمه عبور جدید <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="تکرار دقیق کلمه عبور جدید"
                  dir="ltr"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
                  required
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-4 bg-amber-600 hover:bg-amber-700 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-amber-600/20 flex items-center justify-center gap-2 text-xs transition cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <span>در حال ثبت و فعال‌سازی حساب...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>ثبت کلمه عبور جدید و ورود به پنل</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
