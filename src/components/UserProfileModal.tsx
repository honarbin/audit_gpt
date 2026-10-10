import React, { useState, useEffect } from 'react';
import { 
  User, 
  KeyRound, 
  ShieldCheck, 
  CheckCircle2, 
  X, 
  AlertCircle, 
  Lock, 
  Mail, 
  Phone, 
  Building2,
  Check,
  Eye,
  EyeOff,
  Loader2
} from 'lucide-react';
import { AppUser } from '../types/auth';
import { syncUserPasswordToServer, saveUserToServer, normalizeDigits } from '../services/authService';
import { upsertUserToSupabase } from '../services/supabaseService';

interface UserProfileModalProps {
  isOpen: boolean;
  user?: AppUser | null;
  currentUser?: AppUser | null;
  onClose: () => void;
  onUpdateUser: (updated: AppUser) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  user,
  currentUser,
  onClose,
  onUpdateUser,
}) => {
  const activeUser = user || currentUser;

  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const [fullName, setFullName] = useState(activeUser?.fullName || '');
  const [mobilePhone, setMobilePhone] = useState(activeUser?.mobilePhone || '');
  const [email, setEmail] = useState(activeUser?.email || '');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (activeUser && isOpen) {
      setFullName(activeUser.fullName || '');
      setMobilePhone(activeUser.mobilePhone || '');
      setEmail(activeUser.email || '');
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
      setErrorMessage(null);
      setSuccessMessage(null);
      setIsSubmitting(false);
    }
  }, [activeUser, isOpen]);

  if (!isOpen || !activeUser) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // If changing password, validate
    let updatedPass = activeUser.passwordHash;
    const isChangingPassword = Boolean(newPass.trim());
    if (isChangingPassword) {
      const cleanCur = normalizeDigits(currentPass.trim());
      const cleanNew = normalizeDigits(newPass.trim());
      const cleanConfirm = normalizeDigits(confirmPass.trim());

      if (!cleanCur) {
        setErrorMessage('جهت تغییر کلمه عبور، وارد کردن رمز عبور فعلی الزامی است.');
        return;
      }

      const userHashNorm = normalizeDigits(activeUser.passwordHash);
      const uNameNorm = normalizeDigits(activeUser.username).toLowerCase();
      const uOfficeNorm = normalizeDigits(activeUser.assignedOfficeCode || '');
      const uNidNorm = normalizeDigits(activeUser.nationalId || '');

      const isExactCurMatch =
        cleanCur === userHashNorm ||
        currentPass.trim() === activeUser.passwordHash;
      
      let isCurValid = isExactCurMatch;

      // کلمات عبور پیش‌فرض فقط برای حسابی که هنوز تغییر کلمه عبور نداده معتبر است
      if (!isCurValid && !activeUser.isPasswordChanged) {
        if (activeUser.username === 'admin' && (cleanCur === '12345678' || cleanCur === '12345')) {
          isCurValid = true;
        } else if (
          cleanCur === uNameNorm ||
          (uOfficeNorm && cleanCur === uOfficeNorm) ||
          (uOfficeNorm && cleanCur === `office${uOfficeNorm}`.toLowerCase()) ||
          cleanCur === uNidNorm
        ) {
          isCurValid = true;
        }
      }

      if (!isCurValid) {
        setErrorMessage('رمز عبور فعلی نادرست می‌باشد.');
        return;
      }
      if (cleanNew.length < 4) {
        setErrorMessage('رمز عبور جدید باید حداقل ۴ کاراکتر باشد.');
        return;
      }
      if (cleanNew !== cleanConfirm) {
        setErrorMessage('رمز عبور جدید با تکرار آن همخوانی ندارد.');
        return;
      }
      updatedPass = cleanNew;
    }

    setIsSubmitting(true);

    try {
      const updatedUser: AppUser = {
        ...activeUser,
        fullName: fullName.trim() || activeUser.fullName,
        mobilePhone: mobilePhone.trim(),
        email: email.trim(),
        passwordHash: updatedPass,
        isPasswordChanged: isChangingPassword ? true : activeUser.isPasswordChanged,
      };

      // 1. ذخیره قطعی رمز عبور در دیتابیس متمرکز سرور
      if (isChangingPassword) {
        const passResult = await syncUserPasswordToServer(
          activeUser.id,
          updatedPass,
          currentPass.trim(),
          activeUser.username
        );
        if (!passResult.success) {
          setErrorMessage(passResult.error || 'خطا در تغییر رمز عبور در دیتابیس سرور');
          setIsSubmitting(false);
          return;
        }
        if (passResult.user) {
          updatedUser.passwordHash = passResult.user.passwordHash;
          updatedUser.isPasswordChanged = true;
        }
      }

      // 2. ذخیره مشخصات کاربر در دیتابیس سرور
      await saveUserToServer(updatedUser);

      // 3. همگام‌سازی با Supabase در صورت اتصال
      upsertUserToSupabase(updatedUser).catch((e) => {
        console.warn('Supabase user upsert background sync warning:', e);
      });

      // 4. به‌روزرسانی وضعیت در برنامه کلاینت
      onUpdateUser(updatedUser);
      setSuccessMessage('اطلاعات کاربری و کلمه عبور با موفقیت در دیتابیس مرکزی ذخیره شد.');
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');

      setTimeout(() => {
        setSuccessMessage(null);
      }, 3500);
    } catch (err: any) {
      console.error('Error updating user profile:', err);
      setErrorMessage(err.message || 'خطا در ذخیره‌سازی اطلاعات در دیتابیس');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden my-8">
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
              <User className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">پروفایل کاربری و تغییر رمز عبور</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                نام کاربری: <span className="font-mono text-emerald-400 font-bold">{activeUser.username || activeUser.nationalId}</span> | کد ملی: <span className="font-mono text-slate-300">{activeUser.nationalId}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSaveProfile} className="p-6 space-y-5">
          {successMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-emerald-800 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-800 text-xs font-bold">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* User Role Badge & Office Info */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-500 font-medium">نقش سازمانی:</span>
              <p className="text-xs font-black text-slate-900 mt-0.5">
                {activeUser.role === 'SYSTEM_ADMIN' && 'مدیر ارشد مرکز بازرسی و نظارت مرکز میانی عام (Super Admin)'}
                {activeUser.role === 'INSPECTOR' && 'بازرس و ممیز نظارتی (Auditor)'}
                {activeUser.role === 'OFFICE_USER' && 'نماینده / متصدی دفتر ثبت نام (Office Representative)'}
              </p>
            </div>
            {activeUser.assignedOfficeName && (
              <div className="text-left">
                <span className="text-[11px] text-slate-500 font-medium">دفتر منتسب:</span>
                <p className="text-xs font-bold text-emerald-700 mt-0.5 truncate max-w-[200px]">
                  {activeUser.assignedOfficeName} (کد {activeUser.assignedOfficeCode})
                </p>
              </div>
            )}
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                نام و نام خانوادگی
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                شماره تلفن همراه
              </label>
              <input
                type="text"
                value={mobilePhone}
                onChange={(e) => setMobilePhone(e.target.value)}
                dir="ltr"
                placeholder="0912..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              آدرس پست الکترونیکی (ایمیل)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              dir="ltr"
              placeholder="user@domain.com"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Password Change Box */}
          <div className="pt-4 border-t border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <KeyRound className="w-4 h-4 text-emerald-600" />
              <h4 className="text-xs font-black text-slate-800">
                تغییر کلمه عبور (در صورت تمایل تکمیل نمایید):
              </h4>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  رمز عبور فعلی
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    value={currentPass}
                    onChange={(e) => setCurrentPass(e.target.value)}
                    dir="ltr"
                    placeholder="رمز عبور فعلی خود را وارد کنید"
                    className="w-full px-3.5 py-2.5 pl-10 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    رمز عبور جدید
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                      dir="ltr"
                      placeholder="حداقل ۴ کاراکتر"
                      className="w-full px-3.5 py-2.5 pl-10 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    تکرار رمز عبور جدید
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPass ? 'text' : 'password'}
                      value={confirmPass}
                      onChange={(e) => setConfirmPass(e.target.value)}
                      dir="ltr"
                      placeholder="تکرار رمز عبور جدید"
                      className="w-full px-3.5 py-2.5 pl-10 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPass(!showConfirmPass)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-2 transition cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>در حال ذخیره در دیتابیس...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>ذخیره تغییرات</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
