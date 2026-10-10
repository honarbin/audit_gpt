import React, { useState, useMemo } from 'react';
import { 
  Users, 
  UserCheck, 
  UserPlus, 
  ShieldCheck, 
  ShieldAlert, 
  Edit3, 
  Trash2, 
  KeyRound, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Building2, 
  Sparkles,
  Sliders,
  Check,
  X,
  Lock,
  Eye,
  EyeOff,
  Copy,
  UserX,
  RefreshCw,
  Layers,
  Database,
  Unlink,
  CheckCheck,
  AlertTriangle,
  ArrowRightLeft
} from 'lucide-react';
import { AppUser, UserRole, UserPermissionConfig, DEFAULT_ROLE_PERMISSIONS } from '../types/auth';
import { OfficeProfile, CertificateRecord, AuditCampaign, OfficeAuditEvent, OfficeManager } from '../types';
import { 
  isTestUser, 
  resetUsersToDefault, 
  getCleanManagerName, 
  saveStoredUsers, 
  sanitizeAndReconcileUsers, 
  getStoredShowQuickLogin, 
  saveStoredShowQuickLogin, 
  normalizeNationalId, 
  normalizeUsername,
  saveUserToServer,
  syncUserPasswordToServer,
  syncAllUsersToServer
} from '../services/authService';
import { upsertUserToSupabase } from '../services/supabaseService';
import { purgeOrphanedOfficeData, purgeOrphanedDataFromSupabase, CleanupResult } from '../services/dataCleanupService';

interface UsersManagementPanelProps {
  currentUser: AppUser;
  users: AppUser[];
  setUsers: React.Dispatch<React.SetStateAction<AppUser[]>>;
  offices: OfficeProfile[];
  setOffices?: React.Dispatch<React.SetStateAction<OfficeProfile[]>>;
  certificates?: CertificateRecord[];
  setCertificates?: React.Dispatch<React.SetStateAction<CertificateRecord[]>>;
  campaigns?: AuditCampaign[];
  setCampaigns?: React.Dispatch<React.SetStateAction<AuditCampaign[]>>;
  auditEvents?: OfficeAuditEvent[];
  setAuditEvents?: React.Dispatch<React.SetStateAction<OfficeAuditEvent[]>>;
  managers?: OfficeManager[];
  setManagers?: React.Dispatch<React.SetStateAction<OfficeManager[]>>;
  showQuickLoginPanel?: boolean;
  setShowQuickLoginPanel?: (show: boolean) => void;
}

export const UsersManagementPanel: React.FC<UsersManagementPanelProps> = ({
  currentUser,
  users,
  setUsers,
  offices,
  setOffices,
  certificates = [],
  setCertificates,
  campaigns = [],
  setCampaigns,
  auditEvents = [],
  setAuditEvents,
  managers = [],
  setManagers,
  showQuickLoginPanel,
  setShowQuickLoginPanel,
}) => {
  const [internalShowQuickLogin, setInternalShowQuickLogin] = useState<boolean>(() => getStoredShowQuickLogin());
  const isQuickLoginActive = showQuickLoginPanel !== undefined ? showQuickLoginPanel : internalShowQuickLogin;

  const handleToggleQuickLogin = () => {
    const next = !isQuickLoginActive;
    if (setShowQuickLoginPanel) {
      setShowQuickLoginPanel(next);
    }
    setInternalShowQuickLogin(next);
    saveStoredShowQuickLogin(next);
    showToast(
      next
        ? 'پنل انتخاب سریع کاربران در پنجره ورود فعال شد.'
        : 'پنل انتخاب سریع کاربران در پنجره ورود غیرفعال و مخفی شد.',
      'success'
    );
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole | 'TEST_USERS'>('ALL');
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [selectedUserForPermissions, setSelectedUserForPermissions] = useState<AppUser | null>(null);
  const [userForPasswordReset, setUserForPasswordReset] = useState<AppUser | null>(null);
  const [userForOfficeAssign, setUserForOfficeAssign] = useState<AppUser | null>(null);
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);
  const [isBatchDeleteModalOpen, setIsBatchDeleteModalOpen] = useState(false);
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'warning' | 'error' } | null>(null);
  const [copiedUsername, setCopiedUsername] = useState<string | null>(null);

  const showToast = (text: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Check orphaned data stats
  const validOfficeCodes = useMemo(() => new Set(offices.map(o => String(o.code).trim()).filter(Boolean)), [offices]);
  
  const orphanedStats = useMemo(() => {
    const orphanCerts = certificates.filter(c => c.officeCode && !validOfficeCodes.has(String(c.officeCode).trim())).length;
    const orphanCamps = campaigns.filter(c => c.officeCode && !validOfficeCodes.has(String(c.officeCode).trim())).length;
    const orphanEvents = auditEvents.filter(e => e.officeCode && !validOfficeCodes.has(String(e.officeCode).trim())).length;
    const orphanUsers = users.filter(u => u.role === 'OFFICE_USER' && u.assignedOfficeCode && !validOfficeCodes.has(String(u.assignedOfficeCode).trim())).length;
    const totalOrphanCount = orphanCerts + orphanCamps + orphanEvents + orphanUsers;
    return { orphanCerts, orphanCamps, orphanEvents, orphanUsers, totalOrphanCount };
  }, [certificates, campaigns, auditEvents, users, validOfficeCodes]);

  // Test users statistics
  const testUsersCount = useMemo(() => users.filter(isTestUser).length, [users]);

  // Filtered list
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = 
        !q ||
        (u.fullName && u.fullName.toLowerCase().includes(q)) ||
        (u.username && u.username.toLowerCase().includes(q)) ||
        (u.nationalId && u.nationalId.includes(q)) ||
        (u.assignedOfficeCode && u.assignedOfficeCode.includes(q)) ||
        (u.assignedOfficeName && u.assignedOfficeName.toLowerCase().includes(q)) ||
        (u.mobilePhone && u.mobilePhone.includes(q));

      let matchesRole = true;
      if (roleFilter === 'TEST_USERS') {
        matchesRole = isTestUser(u);
      } else if (roleFilter !== 'ALL') {
        matchesRole = u.role === roleFilter;
      }

      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, roleFilter]);

  // Toggle user active status
  const handleToggleUserStatus = (userId: string) => {
    if (userId === currentUser.id) {
      showToast('شما نمی‌توانید وضعیت حساب کاربری فعلی خودتان را غیرفعال کنید.', 'warning');
      return;
    }
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return;
    const nextStatus = !targetUser.isActive;
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          return { ...u, isActive: nextStatus };
        }
        return u;
      })
    );
    showToast(`وضعیت کاربر "${targetUser.fullName}" به ${nextStatus ? 'فعال' : 'غیرفعال'} تغییر یافت.`);
  };

  // Delete user (including any test user)
  const handleDeleteUser = (user: AppUser) => {
    if (user.id === currentUser.id) {
      showToast('شما نمی‌توانید حساب کاربری جاری خودتان را حذف فرمایید.', 'warning');
      return;
    }
    setUserToDelete(user);
  };

  // Confirm delete user
  const handleConfirmDeleteUser = () => {
    if (!userToDelete) return;
    const target = userToDelete;
    setUsers((prev) => prev.filter((u) => u.id !== target.id));
    showToast(`حساب کاربری "${target.fullName}" (${target.username}) با موفقیت حذف گردید.`);
    setUserToDelete(null);
  };

  // Batch delete all test users
  const handleBatchDeleteTestUsers = () => {
    const testUsers = users.filter(u => isTestUser(u) && u.id !== currentUser.id);
    if (testUsers.length === 0) {
      showToast('هیچ کاربر تستی برای حذف یافت نشد.', 'warning');
      return;
    }
    setIsBatchDeleteModalOpen(true);
  };

  // Confirm batch delete test users
  const handleConfirmBatchDeleteTestUsers = () => {
    const testUsersToDelete = users.filter(u => isTestUser(u) && u.id !== currentUser.id);
    const count = testUsersToDelete.length;
    setUsers((prev) => prev.filter((u) => !isTestUser(u) || u.id === currentUser.id));
    showToast(`تعداد ${count} کاربر تستی با موفقیت حذف و از سامانه پاکسازی شدند.`);
    setIsBatchDeleteModalOpen(false);
  };

  // Quick Copy Username
  const handleCopyUsername = (uname: string) => {
    navigator.clipboard.writeText(uname);
    setCopiedUsername(uname);
    setTimeout(() => setCopiedUsername(null), 2000);
  };

  // Quick office access change
  const handleSaveOfficeAssignment = (userId: string, officeCode?: string) => {
    const targetUser = users.find(u => u.id === userId);
    const targetOffice = officeCode ? offices.find(o => o.code === officeCode) : undefined;

    let updatedTargetUser: AppUser | undefined;

    setUsers(prev => {
      const next = prev.map(u => {
        if (u.id === userId) {
          updatedTargetUser = {
            ...u,
            assignedOfficeCode: officeCode || undefined,
            assignedOfficeName: officeCode ? (targetOffice?.name || `دفتر کد ${officeCode}`) : undefined,
          };
          return updatedTargetUser;
        }
        return u;
      });
      saveStoredUsers(next);
      return next;
    });

    if (updatedTargetUser) {
      saveUserToServer(updatedTargetUser).catch(() => {});
      upsertUserToSupabase(updatedTargetUser).catch(() => {});
    }

    if (officeCode && targetUser) {
      const cleanOfficeCode = String(officeCode).trim();
      const cleanName = getCleanManagerName(targetUser.fullName);

      if (setOffices) {
        setOffices(prev => prev.map(off => {
          if (String(off.code).trim() === cleanOfficeCode) {
            return {
              ...off,
              managerName: cleanName || off.managerName,
            };
          }
          return off;
        }));
      }

      if (setManagers) {
        setManagers(prev => {
          const mgrCode = `MGR-${cleanOfficeCode}`;
          const cleanPrev = prev.filter(m => String(m.assignedOfficeCode).trim() !== cleanOfficeCode && m.id !== mgrCode);
          const existing = prev.find(m => String(m.assignedOfficeCode).trim() === cleanOfficeCode || m.id === mgrCode);
          const updated: OfficeManager = {
            id: mgrCode,
            managerCode: mgrCode,
            nationalId: targetUser.nationalId || existing?.nationalId || '0000000000',
            fullName: cleanName || targetUser.fullName,
            mobilePhone: targetUser.mobilePhone || existing?.mobilePhone || '',
            landlinePhone: targetOffice?.phone || existing?.landlinePhone || '',
            email: targetUser.email || existing?.email,
            assignedOfficeCode: cleanOfficeCode,
            assignedOfficeName: targetOffice?.name || existing?.assignedOfficeName || `دفتر کد ${cleanOfficeCode}`,
            appointmentDate: existing?.appointmentDate || '1403/01/01',
            status: targetUser.isActive ? 'ACTIVE' : 'INACTIVE',
          };
          return [...cleanPrev, updated];
        });
      }
    }

    if (!officeCode) {
      showToast(`دسترسی دفتر کاربر "${targetUser?.fullName || 'انتخاب شده'}" لغو شد (سراسری / بدون دفتر).`);
    } else {
      showToast(`دسترسی دفتر کاربر "${targetUser?.fullName || 'انتخاب شده'}" به دفتر کد ${officeCode} (${targetOffice?.name || ''}) تخصیص یافت.`);
    }
    setUserForOfficeAssign(null);
  };

  // Execute purge of unlisted office data
  const handleExecutePurge = async () => {
    const {
      cleanedCertificates,
      cleanedCampaigns,
      cleanedAuditEvents,
      cleanedManagers,
      cleanedUsers,
      result
    } = purgeOrphanedOfficeData(
      offices,
      certificates,
      campaigns,
      auditEvents,
      managers,
      users
    );

    if (setCertificates) setCertificates(cleanedCertificates);
    if (setCampaigns) setCampaigns(cleanedCampaigns);
    if (setAuditEvents) setAuditEvents(cleanedAuditEvents);
    if (setManagers) setManagers(cleanedManagers);
    setUsers(cleanedUsers);

    // Also sync purge to Supabase
    const validCodes = offices.map(o => o.code);
    await purgeOrphanedDataFromSupabase(validCodes);

    setIsPurgeModalOpen(false);
    showToast(
      `پاکسازی با موفقیت انجام شد: ${result.removedCertificatesCount} گواهی، ${result.removedCampaignsCount} کمپین و ${result.unlinkedUsersCount} حساب اصلاح گردیدند.`
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-6 left-6 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold transition transform animate-in slide-in-from-bottom-4 ${
          toastMessage.type === 'success' ? 'bg-emerald-950 text-emerald-100 border-emerald-700' :
          toastMessage.type === 'warning' ? 'bg-amber-950 text-amber-100 border-amber-700' :
          'bg-rose-950 text-rose-100 border-rose-700'
        }`}>
          {toastMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> :
           toastMessage.type === 'warning' ? <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" /> :
           <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6 text-purple-700" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-black text-slate-900">
                مدیریت کاربران، حساب‌های دفاتر ثبت‌نام و سطوح دسترسی (RBAC)
              </h2>
              <span className="bg-purple-100 text-purple-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
                {users.length} کاربر ثبت شده
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              تعریف، ویرایش و حذف نام‌های کاربری و کلمه‌های عبور، تخصیص یا لغو دسترسی دفاتر ثبت‌نام، و کنترل یکپارچگی داده‌ها
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Purge Orphaned Data Button */}
          <button
            onClick={() => setIsPurgeModalOpen(true)}
            title="پاکسازی داده‌های دفاتری که در لیست دفاتر وجود ندارند"
            className={`flex items-center gap-2 font-bold text-xs px-3.5 py-2.5 rounded-xl border transition cursor-pointer ${
              orphanedStats.totalOrphanCount > 0
                ? 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100 shadow-xs animate-pulse'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Database className="w-4 h-4 text-rose-600" />
            <span>پاکسازی داده‌های دفاتر ناموجود</span>
            {orphanedStats.totalOrphanCount > 0 && (
              <span className="bg-rose-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                {orphanedStats.totalOrphanCount} مورد
              </span>
            )}
          </button>

          {/* Batch Delete Test Users */}
          {testUsersCount > 0 && (
            <button
              onClick={handleBatchDeleteTestUsers}
              title="حذف کلیه نام‌های کاربری تستی پیش‌فرض"
              className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs px-3.5 py-2.5 rounded-xl transition cursor-pointer"
            >
              <UserX className="w-4 h-4 text-amber-700" />
              <span>حذف کاربران تستی ({testUsersCount})</span>
            </button>
          )}

          {/* Sync & Reconcile Users Button */}
          <button
            onClick={() => {
              const reconciled = sanitizeAndReconcileUsers(users, offices, managers);
              setUsers(reconciled);
              saveStoredUsers(reconciled);
              showToast(`یکپارچه‌سازی و رفع مغایرت کاربران با موفقیت انجام شد (${reconciled.length} کاربر معتبر و یکتا).`, 'success');
            }}
            title="همگام‌سازی و رفع خودکار مغایرت‌های نام کاربری و دسترسی‌ها"
            className="flex items-center gap-1.5 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 font-bold text-xs px-3.5 py-2.5 rounded-xl transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-purple-700" />
            <span>رفع مغایرت و یکپارچه‌سازی کاربران</span>
          </button>

          {/* Create User Button */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md shadow-purple-700/20 transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>تعریف کاربر جدید</span>
          </button>
        </div>
      </div>

      {/* Orphan Data Alert Banner (if any orphan detected) */}
      {orphanedStats.totalOrphanCount > 0 && (
        <div className="bg-gradient-to-r from-rose-50 to-amber-50 border border-rose-200 rounded-3xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-rose-700" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-black text-rose-900">
                تشخیص داده‌های متعلق به دفاتری که در لیست دفاتر وجود ندارند
              </h4>
              <p className="text-xs text-rose-700 mt-0.5">
                تعداد {orphanedStats.orphanCerts} گواهی، {orphanedStats.orphanCamps} پرونده بازرسی، و {orphanedStats.orphanUsers} حساب کاربری به کدهای دفاتری متصل هستند که از لیست حذف شده‌اند.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsPurgeModalOpen(true)}
            className="bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs transition cursor-pointer"
          >
            مشاهده و اجرای پاکسازی
          </button>
        </div>
      )}

      {/* Login Screen Settings Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
            isQuickLoginActive ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-300/50' : 'bg-slate-100 text-slate-500'
          }`}>
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs sm:text-sm font-black text-slate-900">
                تنظیمات صفحه ورود (پنجره لاگین)
              </h4>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                isQuickLoginActive 
                  ? 'bg-amber-50 text-amber-800 border-amber-300' 
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
                {isQuickLoginActive ? 'پنل انتخاب سریع فعال است (نمایش)' : 'پنل انتخاب سریع غیرفعال است (مخفی)'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-2xl">
              کنترل وضعیت نمایش پنل کاربران نمونه در پایین پنجره لاگین سامانه. در حالت غیرفعال، پنجره لاگین کاملاً ساده، ایمن و بدون توضیحات و بدون گزینه‌های ورود سریع نمایش داده می‌شود.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-700">
            {isQuickLoginActive ? 'حالت نمایش: فعال' : 'حالت نمایش: غیرفعال'}
          </span>
          <button
            type="button"
            onClick={handleToggleQuickLogin}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              isQuickLoginActive ? 'bg-emerald-600' : 'bg-slate-300'
            }`}
            role="switch"
            aria-checked={isQuickLoginActive}
            title={isQuickLoginActive ? 'کلیک جهت غیرفعال‌سازی و مخفی کردن پنل انتخاب سریع' : 'کلیک جهت فعال‌سازی و نمایش پنل انتخاب سریع'}
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                isQuickLoginActive ? '-translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Role Summary Badges & Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Super Admins */}
        <div 
          onClick={() => setRoleFilter(roleFilter === 'SYSTEM_ADMIN' ? 'ALL' : 'SYSTEM_ADMIN')}
          className={`bg-white rounded-2xl p-4 border transition cursor-pointer shadow-2xs flex items-center justify-between ${
            roleFilter === 'SYSTEM_ADMIN' ? 'border-purple-500 ring-2 ring-purple-500/20 bg-purple-50/20' : 'border-slate-200 hover:border-purple-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-purple-700" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">مدیران ارشد سیستم</p>
              <p className="text-lg font-black text-slate-900">
                {users.filter((u) => u.role === 'SYSTEM_ADMIN').length} کاربر
              </p>
            </div>
          </div>
          <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-md">
            دسترسی تام
          </span>
        </div>

        {/* Senior Inspector (Level 2) */}
        <div 
          onClick={() => setRoleFilter(roleFilter === 'SENIOR_INSPECTOR' ? 'ALL' : 'SENIOR_INSPECTOR')}
          className={`bg-white rounded-2xl p-4 border transition cursor-pointer shadow-2xs flex items-center justify-between ${
            roleFilter === 'SENIOR_INSPECTOR' ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20' : 'border-slate-200 hover:border-indigo-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-indigo-700" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">بازرس ارشد (سطح ۲)</p>
              <p className="text-lg font-black text-slate-900">
                {users.filter((u) => u.role === 'SENIOR_INSPECTOR').length} سرپرست
              </p>
            </div>
          </div>
          <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-md">
            تصمیم نهایی
          </span>
        </div>

        {/* Inspectors (Level 1) */}
        <div 
          onClick={() => setRoleFilter(roleFilter === 'INSPECTOR' ? 'ALL' : 'INSPECTOR')}
          className={`bg-white rounded-2xl p-4 border transition cursor-pointer shadow-2xs flex items-center justify-between ${
            roleFilter === 'INSPECTOR' ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20' : 'border-slate-200 hover:border-blue-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">کارشناسان بازرسی (سطح ۱)</p>
              <p className="text-lg font-black text-slate-900">
                {users.filter((u) => u.role === 'INSPECTOR').length} کارشناس
              </p>
            </div>
          </div>
          <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-md">
            کشف نقص
          </span>
        </div>

        {/* Office Users */}
        <div 
          onClick={() => setRoleFilter(roleFilter === 'OFFICE_USER' ? 'ALL' : 'OFFICE_USER')}
          className={`bg-white rounded-2xl p-4 border transition cursor-pointer shadow-2xs flex items-center justify-between ${
            roleFilter === 'OFFICE_USER' ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20' : 'border-slate-200 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">مسئولین دفاتر ثبت‌نام</p>
              <p className="text-lg font-black text-slate-900">
                {users.filter((u) => u.role === 'OFFICE_USER').length} حساب دفتر
              </p>
            </div>
          </div>
          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
            کارتابل اختصاصی
          </span>
        </div>

        {/* Test Accounts */}
        <div 
          onClick={() => setRoleFilter(roleFilter === 'TEST_USERS' ? 'ALL' : 'TEST_USERS')}
          className={`bg-white rounded-2xl p-4 border transition cursor-pointer shadow-2xs flex items-center justify-between ${
            roleFilter === 'TEST_USERS' ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/20' : 'border-slate-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">نام‌های کاربری تستی</p>
              <p className="text-lg font-black text-slate-900">
                {testUsersCount} کاربر
              </p>
            </div>
          </div>
          <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-md">
            قابل حذف/ویرایش
          </span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو بر اساس نام کاربر، نام کاربری، کد ملی، شماره موبایل، کد یا نام دفتر..."
            className="w-full pl-3 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500 font-medium">فیلتر نمایش:</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 text-slate-900 text-xs font-semibold px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
          >
            <option value="ALL">همه کاربران ({users.length})</option>
            <option value="SYSTEM_ADMIN">مدیر ارشد مرکز میانی عام</option>
            <option value="SENIOR_INSPECTOR">بازرس ارشد و سرپرست ممیزی (سطح ۲)</option>
            <option value="INSPECTOR">کارشناس بازرسی (سطح ۱)</option>
            <option value="OFFICE_USER">مسئول دفتر ثبت نام</option>
            <option value="TEST_USERS">فقط کاربران تستی و پیش‌فرض ({testUsersCount})</option>
          </select>

          {roleFilter !== 'ALL' && (
            <button
              onClick={() => setRoleFilter('ALL')}
              className="text-xs text-purple-700 hover:text-purple-900 font-bold px-2 py-1 rounded-lg hover:bg-purple-50 cursor-pointer"
            >
              نمایش همه
            </button>
          )}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-600">
                <th className="py-3 px-3">کاربر و نام خانوادگی</th>
                <th className="py-3 px-3">نام کاربری / کد ملی</th>
                <th className="py-3 px-3">نقش سازمانی</th>
                <th className="py-3 px-3">دفتر ثبت‌نام و حوزه</th>
                <th className="py-3 px-3">اطلاعات تماس</th>
                <th className="py-3 px-2 text-center">وضعیت</th>
                <th className="py-3 px-3 text-center">عملیات و مدیریت دسترسی</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    کاربری با مشخصات جستجو شده یافت نشد.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrent = u.id === currentUser.id;
                  const isTest = isTestUser(u);
                  const assignedOffice = offices.find(o => o.code === u.assignedOfficeCode);
                  const isOrphanOffice = u.role === 'OFFICE_USER' && u.assignedOfficeCode && !validOfficeCodes.has(String(u.assignedOfficeCode).trim());

                  return (
                    <tr key={u.id} className={`hover:bg-slate-50/80 transition ${isCurrent ? 'bg-purple-50/30' : ''}`}>
                      {/* Full Name & Badges */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                            u.role === 'SYSTEM_ADMIN' ? 'bg-purple-100 text-purple-800' :
                            u.role === 'SENIOR_INSPECTOR' ? 'bg-indigo-100 text-indigo-800' :
                            u.role === 'INSPECTOR' ? 'bg-blue-100 text-blue-800' :
                            'bg-emerald-100 text-emerald-800'
                          }`}>
                            {u.fullName.slice(0, 1) || 'U'}
                          </div>
                          <div>
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="font-bold text-slate-900 text-xs">{u.fullName}</span>
                              {isCurrent && (
                                <span className="text-[9px] bg-purple-100 text-purple-700 font-bold px-1 rounded">
                                  شما
                                </span>
                              )}
                              {isTest && (
                                <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1 rounded">
                                  تستی
                                </span>
                              )}
                            </div>
                            {u.notes && <p className="text-[10px] text-slate-400 truncate max-w-[140px]">{u.notes}</p>}
                          </div>
                        </div>
                      </td>

                      {/* Username & National ID - Placed Directly Below Username */}
                      <td className="py-2.5 px-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1">
                            <span className="font-mono font-bold text-purple-800 bg-purple-50 px-1.5 py-0.5 rounded text-[11px] border border-purple-200">
                              {u.username || u.nationalId}
                            </span>
                            <button
                              onClick={() => handleCopyUsername(u.username || u.nationalId)}
                              title="کپی نام کاربری"
                              className="text-slate-400 hover:text-purple-700 cursor-pointer p-0.5"
                            >
                              {copiedUsername === (u.username || u.nationalId) ? (
                                <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                          <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                            <span className="text-slate-400 font-sans">کد ملی:</span>
                            <span className="font-bold text-slate-700">{u.nationalId}</span>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {u.role === 'SYSTEM_ADMIN' && (
                          <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-800 border border-purple-200 text-[10px] font-bold px-2 py-0.5 rounded-md">
                            <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                            مدیر ارشد مرکز میانی
                          </span>
                        )}
                        {u.role === 'SENIOR_INSPECTOR' && (
                          <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-bold px-2 py-0.5 rounded-md shadow-2xs">
                            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                            بازرس ارشد (سطح ۲)
                          </span>
                        )}
                        {u.role === 'INSPECTOR' && (
                          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-md">
                            <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                            کارشناس بازرسی (سطح ۱)
                          </span>
                        )}
                        {u.role === 'OFFICE_USER' && (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-md">
                            <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                            مسئول دفتر
                          </span>
                        )}
                      </td>

                      {/* Assigned Office (with quick change/detach) */}
                      <td className="py-2.5 px-3">
                        {u.role === 'OFFICE_USER' ? (
                          u.assignedOfficeCode ? (
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1">
                                {isOrphanOffice ? (
                                  <span className="bg-rose-100 text-rose-800 text-[9px] font-bold px-1.5 py-0.2 rounded flex items-center gap-1">
                                    <AlertCircle className="w-2.5 h-2.5" />
                                    کد {u.assignedOfficeCode}
                                  </span>
                                ) : (
                                  <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.2 rounded font-mono">
                                    کد {u.assignedOfficeCode}
                                  </span>
                                )}
                                <span className="font-bold text-slate-800 truncate max-w-[130px] text-xs">
                                  {assignedOffice?.name || u.assignedOfficeName || 'دفتر ثبت نام'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[9px]">
                                <button
                                  onClick={() => setUserForOfficeAssign(u)}
                                  className="text-purple-700 hover:text-purple-900 font-bold underline cursor-pointer"
                                >
                                  تغییر
                                </button>
                                <span className="text-slate-300">|</span>
                                <button
                                  onClick={() => handleSaveOfficeAssignment(u.id, undefined)}
                                  className="text-rose-600 hover:text-rose-800 font-medium cursor-pointer"
                                >
                                  لغو
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="text-amber-600 font-bold text-[10px]">بدون انتساب</span>
                              <button
                                onClick={() => setUserForOfficeAssign(u)}
                                className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-bold hover:bg-emerald-100 cursor-pointer"
                              >
                                + تخصیص
                              </button>
                            </div>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-1 text-purple-900 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-lg text-[10px] font-bold whitespace-nowrap">
                            <ShieldCheck className="w-3 h-3 text-purple-600" />
                            <span>دسترسی سراسری</span>
                          </span>
                        )}
                      </td>

                      {/* Contact */}
                      <td className="py-2.5 px-3 text-[10px] text-slate-600">
                        <p className="font-mono font-bold text-slate-800">{u.mobilePhone || '---'}</p>
                        <p className="text-slate-400 text-[9px] truncate max-w-[110px]">{u.email || ''}</p>
                      </td>

                      {/* Active Status */}
                      <td className="py-2.5 px-2 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleToggleUserStatus(u.id)}
                          disabled={isCurrent}
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                            u.isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                          }`}
                        >
                          {u.isActive ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>فعال</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-rose-600" />
                              <span>غیرفعال</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Quick Office Assignment */}
                          <button
                            onClick={() => setUserForOfficeAssign(u)}
                            title="تخصیص یا تغییر دفتر ثبت‌نام"
                            className="p-1.5 text-slate-500 hover:text-emerald-700 bg-slate-50 hover:bg-emerald-50 rounded-lg transition border border-slate-200 cursor-pointer"
                          >
                            <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                          </button>

                          {/* Change Password */}
                          <button
                            onClick={() => setUserForPasswordReset(u)}
                            title="تغییر یا مشاهده رمز عبور"
                            className="p-1.5 text-slate-500 hover:text-purple-700 bg-slate-50 hover:bg-purple-50 rounded-lg transition border border-slate-200 cursor-pointer"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit Permissions Matrix */}
                          <button
                            onClick={() => {
                              setSelectedUserForPermissions(u);
                              setIsPermissionsModalOpen(true);
                            }}
                            title="تنظیم دقیق مجوزها و ماتریس دسترسی"
                            className="p-1.5 text-slate-500 hover:text-blue-700 bg-slate-50 hover:bg-blue-50 rounded-lg transition border border-slate-200 cursor-pointer"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit Full User Info */}
                          <button
                            onClick={() => setEditingUser(u)}
                            title="ویرایش کامل مشخصات کاربر"
                            className="p-1.5 text-slate-500 hover:text-amber-700 bg-slate-50 hover:bg-amber-50 rounded-lg transition border border-slate-200 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete User */}
                          {!isCurrent && (
                            <button
                              onClick={() => handleDeleteUser(u)}
                              title={isTest ? 'حذف این نام کاربری تستی' : 'حذف کاربر'}
                              className="p-1.5 text-slate-400 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 rounded-lg transition border border-slate-200 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Create / Edit User Modal */}
      {(isCreateModalOpen || editingUser) && (
        <CreateOrEditUserModal
          isOpen={isCreateModalOpen || Boolean(editingUser)}
          userToEdit={editingUser || undefined}
          offices={offices}
          existingUsers={users}
          onClose={() => {
            setIsCreateModalOpen(false);
            setEditingUser(null);
          }}
          onSave={(savedUser) => {
            let nextUsers: AppUser[];
            if (editingUser) {
              nextUsers = users.map((u) => (u.id === savedUser.id ? savedUser : u));
              showToast(`اطلاعات کاربر "${savedUser.fullName}" با موفقیت در دیتابیس مرکزی به‌روزرسانی شد.`);
            } else {
              nextUsers = [savedUser, ...users];
              showToast(`کاربر جدید "${savedUser.fullName}" با نام کاربری "${savedUser.username}" در دیتابیس مرکزی ایجاد شد.`);
            }
            setUsers(nextUsers);
            saveStoredUsers(nextUsers);

            // Persist user to server database & Supabase
            saveUserToServer(savedUser).catch(() => {});
            upsertUserToSupabase(savedUser).catch(() => {});

            if (savedUser.assignedOfficeCode) {
              const cleanOfficeCode = String(savedUser.assignedOfficeCode).trim();
              const cleanName = getCleanManagerName(savedUser.fullName);

              if (setOffices) {
                setOffices(prev => prev.map(off => {
                  if (String(off.code).trim() === cleanOfficeCode) {
                    return {
                      ...off,
                      managerName: cleanName || off.managerName,
                    };
                  }
                  return off;
                }));
              }

              if (setManagers) {
                setManagers(prev => {
                  const mgrCode = `MGR-${cleanOfficeCode}`;
                  const cleanPrev = prev.filter(m => String(m.assignedOfficeCode).trim() !== cleanOfficeCode && m.id !== mgrCode);
                  const existing = prev.find(m => String(m.assignedOfficeCode).trim() === cleanOfficeCode || m.id === mgrCode);
                  const matchedOff = offices.find(o => String(o.code).trim() === cleanOfficeCode);
                  const updated: OfficeManager = {
                    id: mgrCode,
                    managerCode: mgrCode,
                    nationalId: savedUser.nationalId || existing?.nationalId || '0000000000',
                    fullName: cleanName || savedUser.fullName,
                    mobilePhone: savedUser.mobilePhone || existing?.mobilePhone || '',
                    landlinePhone: matchedOff?.phone || existing?.landlinePhone || '',
                    email: savedUser.email || existing?.email,
                    assignedOfficeCode: cleanOfficeCode,
                    assignedOfficeName: matchedOff?.name || existing?.assignedOfficeName || `دفتر کد ${cleanOfficeCode}`,
                    appointmentDate: existing?.appointmentDate || '1403/01/01',
                    status: savedUser.isActive ? 'ACTIVE' : 'INACTIVE',
                  };
                  return [...cleanPrev, updated];
                });
              }
            }

            setIsCreateModalOpen(false);
            setEditingUser(null);
          }}
        />
      )}

      {/* MODAL 2: Quick Assign/Change Registration Office Modal */}
      {userForOfficeAssign && (
        <AssignOfficeModal
          isOpen={Boolean(userForOfficeAssign)}
          user={userForOfficeAssign}
          offices={offices}
          onClose={() => setUserForOfficeAssign(null)}
          onSave={(officeCode) => handleSaveOfficeAssignment(userForOfficeAssign.id, officeCode)}
        />
      )}

      {/* MODAL 3: Dedicated Password Reset */}
      {userForPasswordReset && (
        <ResetUserPasswordModal
          isOpen={Boolean(userForPasswordReset)}
          user={userForPasswordReset}
          onClose={() => setUserForPasswordReset(null)}
          onSave={async (newPass) => {
            const updatedUser: AppUser = {
              ...userForPasswordReset,
              passwordHash: newPass,
              isPasswordChanged: true,
            };
            setUsers((prev) => {
              const next = prev.map((u) => u.id === userForPasswordReset.id ? updatedUser : u);
              saveStoredUsers(next);
              return next;
            });
            // Persist to central server database and Supabase
            await syncUserPasswordToServer(userForPasswordReset.id, newPass, undefined, userForPasswordReset.username);
            await saveUserToServer(updatedUser);
            upsertUserToSupabase(updatedUser).catch(() => {});
            showToast(`کلمه عبور کاربر "${userForPasswordReset.username}" تغییر یافت و در دیتابیس مرکزی ثبت شد.`);
            setUserForPasswordReset(null);
          }}
        />
      )}

      {/* MODAL 4: Permissions / RBAC Matrix */}
      {isPermissionsModalOpen && selectedUserForPermissions && (
        <UserPermissionsMatrixModal
          isOpen={isPermissionsModalOpen}
          user={selectedUserForPermissions}
          onClose={() => {
            setIsPermissionsModalOpen(false);
            setSelectedUserForPermissions(null);
          }}
          onSave={(updatedPerms) => {
            setUsers((prev) =>
              prev.map((u) =>
                u.id === selectedUserForPermissions.id
                  ? { ...u, customPermissions: updatedPerms }
                  : u
              )
            );
            showToast(`ماتریس دسترسی‌های اختصاصی "${selectedUserForPermissions.fullName}" ذخیره شد.`);
            setIsPermissionsModalOpen(false);
            setSelectedUserForPermissions(null);
          }}
        />
      )}

      {/* MODAL 5: Purge Orphaned Office Data Confirmation Modal */}
      {isPurgeModalOpen && (
        <PurgeOrphanDataModal
          isOpen={isPurgeModalOpen}
          offices={offices}
          certificates={certificates}
          campaigns={campaigns}
          auditEvents={auditEvents}
          users={users}
          onClose={() => setIsPurgeModalOpen(false)}
          onConfirmPurge={handleExecutePurge}
        />
      )}

      {/* MODAL 6: Single User Delete Confirmation Modal */}
      {userToDelete && (
        <DeleteUserConfirmModal
          user={userToDelete}
          onClose={() => setUserToDelete(null)}
          onConfirm={handleConfirmDeleteUser}
        />
      )}

      {/* MODAL 7: Batch Delete Test Users Modal */}
      {isBatchDeleteModalOpen && (
        <BatchDeleteTestUsersModal
          testUsers={users.filter((u) => isTestUser(u) && u.id !== currentUser.id)}
          onClose={() => setIsBatchDeleteModalOpen(false)}
          onConfirm={handleConfirmBatchDeleteTestUsers}
        />
      )}
    </div>
  );
};

// =====================================================================
// Sub-component: Create / Edit User Modal
// =====================================================================
interface CreateOrEditUserModalProps {
  isOpen: boolean;
  userToEdit?: AppUser;
  offices: OfficeProfile[];
  existingUsers?: AppUser[];
  onClose: () => void;
  onSave: (user: AppUser) => void;
}

const CreateOrEditUserModal: React.FC<CreateOrEditUserModalProps> = ({
  isOpen,
  userToEdit,
  offices,
  existingUsers = [],
  onClose,
  onSave,
}) => {
  const [username, setUsername] = useState(userToEdit?.username || '');
  const [nationalId, setNationalId] = useState(userToEdit?.nationalId || '');
  const [fullName, setFullName] = useState(userToEdit?.fullName || '');
  const [role, setRole] = useState<UserRole>(userToEdit?.role || 'OFFICE_USER');
  const [password, setPassword] = useState(userToEdit?.passwordHash || '');
  const [showPassword, setShowPassword] = useState(false);
  const [assignedOfficeCode, setAssignedOfficeCode] = useState(userToEdit?.assignedOfficeCode || offices[0]?.code || '');
  const [mobilePhone, setMobilePhone] = useState(userToEdit?.mobilePhone || '');
  const [email, setEmail] = useState(userToEdit?.email || '');
  const [notes, setNotes] = useState(userToEdit?.notes || '');
  const [isActive, setIsActive] = useState(userToEdit ? userToEdit.isActive : true);

  if (!isOpen) return null;

  const isTest = userToEdit ? isTestUser(userToEdit) : false;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const cleanUsername = username.trim() || (role === 'OFFICE_USER' ? `office${assignedOfficeCode || nationalId}` : `user_${nationalId.slice(-4)}`);
    const cleanPassword = password.trim() || cleanUsername;

    if (!cleanUsername) {
      alert('لطفاً نام کاربری را وارد فرمایید.');
      return;
    }

    const cleanNid = normalizeNationalId(nationalId);
    if (!cleanNid || cleanNid.length !== 10) {
      alert('کد ملی باید دقیقاً ۱۰ رقم عددی معتبر باشد.');
      return;
    }

    // Check duplicate username against existing users
    const duplicateUser = existingUsers.find(
      (u) => u.id !== userToEdit?.id && normalizeUsername(u.username) === cleanUsername.toLowerCase()
    );
    if (duplicateUser) {
      alert(`نام کاربری «${cleanUsername}» تکراری است و قبلاً به «${duplicateUser.fullName}» اختصاص داده شده است. نام کاربری و کد ملی باید کاملاً یکتا باشند.`);
      return;
    }

    // Check duplicate nationalId against existing users
    const duplicateNidUser = existingUsers.find(
      (u) => u.id !== userToEdit?.id && normalizeNationalId(u.nationalId) === cleanNid
    );
    if (duplicateNidUser) {
      alert(`کد ملی «${cleanNid}» تکراری است و قبلاً برای کاربر «${duplicateNidUser.fullName}» (نام کاربری: ${duplicateNidUser.username}) ثبت شده است. نام کاربری و کد ملی باید کاملاً یکتا باشند.`);
      return;
    }

    // Check office assignment uniqueness for OFFICE_USER
    if (role === 'OFFICE_USER' && assignedOfficeCode) {
      const duplicateOfficeUser = existingUsers.find(
        (u) => u.id !== userToEdit?.id && u.role === 'OFFICE_USER' && u.assignedOfficeCode === assignedOfficeCode
      );
      if (duplicateOfficeUser) {
        alert(`دفتر کد «${assignedOfficeCode}» قبلاً به کاربر «${duplicateOfficeUser.fullName}» (نام کاربری: ${duplicateOfficeUser.username}) اختصاص داده شده است.`);
        return;
      }
    }

    if (!fullName.trim()) {
      alert('لطفاً نام و نام خانوادگی را وارد فرمایید.');
      return;
    }

    const assignedOffice = offices.find((o) => o.code === assignedOfficeCode);

    const userObj: AppUser = {
      id: userToEdit?.id || `user-${Date.now()}`,
      username: cleanUsername,
      nationalId: cleanNid,
      fullName: fullName.trim(),
      role,
      passwordHash: cleanPassword,
      isPasswordChanged: userToEdit ? userToEdit.isPasswordChanged : false,
      assignedOfficeCode: role === 'OFFICE_USER' ? assignedOfficeCode : undefined,
      assignedOfficeName: role === 'OFFICE_USER' ? (assignedOffice?.name || `دفتر کد ${assignedOfficeCode}`) : undefined,
      mobilePhone: mobilePhone.trim(),
      email: email.trim(),
      notes: notes.trim(),
      isActive,
      createdAt: userToEdit?.createdAt || '1403/01/01',
      customPermissions: userToEdit?.customPermissions,
    };

    onSave(userObj);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden my-8 animate-in zoom-in-95">
        <div className="bg-purple-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-800 border border-purple-700 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-purple-300" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {userToEdit ? 'ویرایش اطلاعات و نقش کاربر' : 'تعریف کاربر جدید در سامانه'}
              </h3>
              {isTest && (
                <p className="text-[11px] text-amber-300 mt-0.5">
                  (این کاربر آزمایشی است و می‌توانید نام، کدملی و دفتر آن را به مشخصات واقعی تغییر دهید)
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-purple-300 hover:text-white rounded-xl hover:bg-purple-800 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Username & Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                نام کاربری ورود <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (!userToEdit && !password) {
                    setPassword(e.target.value);
                  }
                }}
                placeholder="مثال: office1607 یا inspector_tehran"
                dir="ltr"
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                کلمه عبور <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="رمز عبور"
                  dir="ltr"
                  required
                  className="w-full px-3.5 py-2.5 pl-9 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* National ID & Full Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                کد ملی (۱۰ رقم) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
                placeholder="0071234567"
                maxLength={10}
                dir="ltr"
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                نام و نام خانوادگی <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="مثال: مهندس احمد باقری"
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Role Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              نقش سازمانی <span className="text-rose-500">*</span>
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
            >
              <option value="OFFICE_USER">مسئول دفتر ثبت‌نام صدور گواهی (دسترسی فقط به کارتابل دفتر اختصاصی)</option>
              <option value="INSPECTOR">کارشناس بازرسی (سطح ۱: بررسی مدارک، ثبت نواقص، برگشت به دفتر یا ارجاع به بازرس ارشد)</option>
              <option value="SENIOR_INSPECTOR">بازرس ارشد و سرپرست ممیزی (سطح ۲: صدور رأی قطعی، رصد تذکرات، بدون امکان دستکاری در نمونه‌ها)</option>
              <option value="SYSTEM_ADMIN">مدیر ارشد مرکز بازرسی و نظارت مرکز میانی عام (دسترسی تام مدیریتی به سامانه)</option>
            </select>
          </div>

          {/* Assigned Office (Interactive Selection) */}
          <div className={`p-4 rounded-2xl border transition ${
            role === 'OFFICE_USER' ? 'bg-emerald-50/70 border-emerald-200' : 'bg-slate-50 border-slate-200'
          }`}>
            <label className="block text-xs font-bold text-slate-900 mb-1.5 flex items-center justify-between">
              <span>دفتر ثبت‌نام منتسب به این کاربر:</span>
              {role !== 'OFFICE_USER' && (
                <span className="text-[10px] text-slate-500 font-normal">
                  (اختیاری برای بازرس / مدیر سیستم)
                </span>
              )}
            </label>
            
            <select
              value={assignedOfficeCode}
              onChange={(e) => setAssignedOfficeCode(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
            >
              {role !== 'OFFICE_USER' && (
                <option value="">-- بدون دفتر اختصاصی (دسترسی سراسری به تمام کشور) --</option>
              )}
              {offices.map((off) => (
                <option key={off.code} value={off.code}>
                  کد {off.code} - {off.name} ({off.province}، {off.city})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1.5">
              {role === 'OFFICE_USER' 
                ? 'این کاربر پس از ورود با کدملی/نام کاربری، به صورت خودکار به پرونده‌ها و کارتابل همین دفتر دسترسی خواهد داشت.'
                : 'برای بازرسان و مدیران سیستم، دسترسی پیش‌فرض به تمام دفاتر فعال است.'}
            </p>
          </div>

          {/* Contact Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">شماره همراه</label>
              <input
                type="text"
                value={mobilePhone}
                onChange={(e) => setMobilePhone(e.target.value)}
                dir="ltr"
                placeholder="09121234567"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ایمیل</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                dir="ltr"
                placeholder="user@example.ir"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">یادداشت و سمت</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: مسئول واحد صدور گواهی شیفت صبح"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isActiveCheck"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer"
            />
            <label htmlFor="isActiveCheck" className="text-xs font-bold text-slate-800 cursor-pointer">
              حساب کاربری فعال باشد و اجازه ورود به سامانه داشته باشد
            </label>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl shadow-md shadow-purple-700/20 flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>ذخیره اطلاعات کاربر</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =====================================================================
// Sub-component: Dedicated Quick Office Assignment Modal
// =====================================================================
interface AssignOfficeModalProps {
  isOpen: boolean;
  user: AppUser;
  offices: OfficeProfile[];
  onClose: () => void;
  onSave: (officeCode?: string) => void;
}

const AssignOfficeModal: React.FC<AssignOfficeModalProps> = ({
  isOpen,
  user,
  offices,
  onClose,
  onSave,
}) => {
  const [selectedCode, setSelectedCode] = useState<string>(user.assignedOfficeCode || (offices[0]?.code || ''));
  const [isDetached, setIsDetached] = useState<boolean>(!user.assignedOfficeCode);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden my-8 animate-in zoom-in-95">
        <div className="bg-emerald-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-800 border border-emerald-700 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">تخصیص / تغییر دفتر ثبت‌نام</h3>
              <p className="text-xs text-emerald-200 mt-0.5 font-mono">
                {user.fullName} ({user.username || user.nationalId})
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-emerald-300 hover:text-white rounded-xl hover:bg-emerald-800 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">کاربر:</span>
              <span className="font-bold text-slate-900">{user.fullName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">نقش:</span>
              <span className="font-bold text-purple-700">{user.role}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">دفتر فعلی:</span>
              <span className="font-bold text-emerald-700">
                {user.assignedOfficeCode ? `${user.assignedOfficeName || 'دفتر'} (کد ${user.assignedOfficeCode})` : 'بدون انتساب دفتر'}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">انتخاب شیوه تخصیص دفتر:</label>
            <div className="space-y-2">
              <label 
                onClick={() => setIsDetached(false)}
                className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition ${
                  !isDetached ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-bold' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <input 
                  type="radio" 
                  name="officeAssignMode" 
                  checked={!isDetached} 
                  onChange={() => setIsDetached(false)} 
                  className="text-emerald-600"
                />
                <span>تخصیص به یک دفتر ثبت‌نام معین</span>
              </label>

              <label 
                onClick={() => setIsDetached(true)}
                className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition ${
                  isDetached ? 'bg-purple-50/80 border-purple-300 text-purple-950 font-bold' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <input 
                  type="radio" 
                  name="officeAssignMode" 
                  checked={isDetached} 
                  onChange={() => setIsDetached(true)} 
                  className="text-purple-600"
                />
                <span>بدون دفتر (لغو انتساب / دسترسی ستادی یا بازرسی)</span>
              </label>
            </div>
          </div>

          {!isDetached && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                انتخاب دفتر ثبت‌نام از لیست دفاتر فعال:
              </label>
              <select
                value={selectedCode}
                onChange={(e) => setSelectedCode(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                {offices.map((off) => (
                  <option key={off.code} value={off.code}>
                    کد {off.code} - {off.name} ({off.province}، {off.city})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="button"
              onClick={() => onSave(isDetached ? undefined : selectedCode)}
              className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>ثبت تخصیص دفتر</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// =====================================================================
// Sub-component: Granular Permissions Matrix Modal
// =====================================================================
interface UserPermissionsMatrixModalProps {
  isOpen: boolean;
  user: AppUser;
  onClose: () => void;
  onSave: (customPermissions: Partial<UserPermissionConfig>) => void;
}

const UserPermissionsMatrixModal: React.FC<UserPermissionsMatrixModalProps> = ({
  isOpen,
  user,
  onClose,
  onSave,
}) => {
  const defaultRolePerms = DEFAULT_ROLE_PERMISSIONS[user.role];
  const [perms, setPerms] = useState<UserPermissionConfig>({
    ...defaultRolePerms,
    ...(user.customPermissions || {}),
  });

  if (!isOpen) return null;

  const togglePerm = (key: keyof UserPermissionConfig) => {
    setPerms((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const permItems: { key: keyof UserPermissionConfig; label: string; desc: string; locked?: boolean }[] = [
    { key: 'canManageUsers', label: 'مدیریت کاربران و تغییر رمزها', desc: 'دسترسی به بخش مدیریت کاربران و دسترسی‌ها' },
    { key: 'canManageOffices', label: 'مدیریت دفاتر، مسئولین و نقشه جغرافیایی', desc: 'ویرایش، تعلیق و مدیریت پروفایل دفاتر' },
    { key: 'canRunSampling', label: 'بارگذاری اکسل و اجرای نمونه‌گیری ۷ گانه', desc: 'ایجاد ماموریت‌های بازرسی جدید' },
    { key: 'canViewAllOffices', label: 'مشاهده و دسترسی به اطلاعات تمامی دفاتر', desc: 'در صورت غیرفعال بودن، فقط دفتر خود را می‌بیند' },
    { key: 'canReviewAndVerdict', label: 'بررسی مدارک کارشناسی (سطح ۱: ثبت نقص)', desc: 'پنل تطبیق کارشناس، ثبت نواقص و استعلام مدارک' },
    { key: 'canIssueFinalVerdict', label: 'صدور رأی قطعی و نهایی ممیزی (سطح ۲: بازرس ارشد)', desc: 'تصمیم‌گیری احکام انطباق، اخطار رسمی و تایید مشروط' },
    { key: 'canSuperviseWarnings', label: 'رصد زنده تذکرات و اخطارهای کارشناس به دفاتر', desc: 'نظارت بر تعاملات کارشناسی بازرسان با مسئولین دفاتر' },
    { key: 'canModifySampleSelection', label: 'اختیار مدیریت و جایگزینی نمونه‌های ممیزی', desc: 'دسترسی کامل برای بازرس ارشد و مقام بالاتر؛ غیرفعال برای بازرس رده پایین‌تر' },
    { key: 'canUploadOfficeDocuments', label: 'بارگذاری مدارک و تعهدنامه‌های دفتر', desc: 'کارتابل دفتر جهت ارسال فایل و پاسخ به نواقص' },
    { key: 'canViewAnalytics', label: 'مشاهده گزارشات مدیریتی و شاخص‌های انطباق', desc: 'داشبورد نمودارها و آمار بازرسی' },
    { key: 'canManageNotifications', label: 'مدیریت کانال‌های وب‌هوک و اعلان‌ها', desc: 'پیکربندی SMS، ایمیل و وب‌هوک نظارتی' },
    { key: 'canManageDatabaseSync', label: 'همگام‌سازی و مدیریت پایگاه داده ابری', desc: 'دسترسی به اتصالات و تنظیمات پایگاه داده' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden my-8">
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sliders className="w-5 h-5 text-purple-400" />
            <div>
              <h3 className="text-base font-bold text-white">ماتریس دسترسی‌های تفکیکی کاربر (RBAC)</h3>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                {user.fullName} ({user.username || user.nationalId}) - نقش: {user.role}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <p className="text-xs text-slate-600">
            شما می‌توانید دسترسی‌های مجزای این کاربر را فراتر از نقش پیش‌فرض فعال یا غیرفعال فرمایید:
          </p>

          <div className="space-y-2.5">
            {permItems.map((item) => (
              <div
                key={item.key}
                onClick={() => {
                  if (!item.locked) togglePerm(item.key);
                }}
                className={`p-3.5 rounded-2xl border transition flex items-center justify-between ${
                  item.locked
                    ? 'bg-slate-100/80 border-slate-200 opacity-60 cursor-not-allowed'
                    : 'cursor-pointer ' + (perms[item.key] ? 'bg-purple-50/70 border-purple-200' : 'bg-slate-50 border-slate-200 opacity-75')
                }`}
              >
                <div>
                  <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    {item.label}
                    {item.locked && (
                      <span className="text-[10px] bg-rose-100 text-rose-700 font-black px-1.5 py-0.2 rounded-md">
                        ممنوعیت سیستمی
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{item.desc}</p>
                </div>
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center border transition ${
                    item.locked
                      ? 'bg-slate-200 border-slate-300 text-slate-400'
                      : perms[item.key]
                      ? 'bg-purple-700 border-purple-800 text-white'
                      : 'bg-white border-slate-300 text-transparent'
                  }`}
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 bg-slate-50 flex items-center justify-between border-t border-slate-200">
          <button
            type="button"
            onClick={() => setPerms(defaultRolePerms)}
            className="text-xs font-bold text-purple-700 hover:text-purple-900 underline cursor-pointer"
          >
            بازنشانی به پیش‌فرض نقش ({user.role})
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
            >
              انصراف
            </button>
            <button
              onClick={() => onSave(perms)}
              className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl shadow-md shadow-purple-700/20 cursor-pointer"
            >
              ذخیره دسترسی‌ها
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// =====================================================================
// Sub-component: Dedicated User Password Reset Modal
// =====================================================================
interface ResetUserPasswordModalProps {
  isOpen: boolean;
  user: AppUser;
  onClose: () => void;
  onSave: (newPassword: string) => void;
}

const ResetUserPasswordModal: React.FC<ResetUserPasswordModalProps> = ({
  isOpen,
  user,
  onClose,
  onSave,
}) => {
  const defaultSuggestion = user.role === 'OFFICE_USER' ? (user.username || user.assignedOfficeCode || '123456') : (user.username || 'audit123');
  const [newPassword, setNewPassword] = useState(defaultSuggestion);
  const [confirmPassword, setConfirmPassword] = useState(defaultSuggestion);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanPass = newPassword.trim();
    if (!cleanPass) {
      setErrorMessage('لطفاً کلمه عبور جدید را وارد فرمایید.');
      return;
    }
    if (cleanPass.length < 4) {
      setErrorMessage('کلمه عبور باید حداقل دارای ۴ کاراکتر باشد.');
      return;
    }
    if (cleanPass !== confirmPassword.trim()) {
      setErrorMessage('کلمه عبور جدید با تکرار آن یکسان نمی‌باشد.');
      return;
    }

    onSave(cleanPass);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden my-8 animate-in zoom-in-95">
        <div className="bg-purple-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-purple-300" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">تنظیم و تغییر کلمه عبور</h3>
              <p className="text-xs text-purple-200 mt-0.5 font-mono">
                {user.fullName} ({user.username || user.nationalId})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-purple-300 hover:text-white rounded-xl hover:bg-purple-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">کد ملی:</span>
              <span className="font-mono font-bold text-slate-800">{user.nationalId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">نام کاربری سامانه:</span>
              <span className="font-mono font-bold text-purple-700">{user.username || user.nationalId}</span>
            </div>
            {user.assignedOfficeName && (
              <div className="flex justify-between">
                <span className="text-slate-500">دفتر:</span>
                <span className="font-bold text-slate-800">{user.assignedOfficeName}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              کلمه عبور جدید <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                dir="ltr"
                placeholder="حداقل ۴ کاراکتر"
                className="w-full px-3.5 py-2.5 pl-10 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              تکرار کلمه عبور جدید <span className="text-rose-500">*</span>
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              dir="ltr"
              placeholder="تکرار کلمه عبور"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl shadow-md shadow-purple-700/20 flex items-center gap-2 transition cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>ثبت و تغییر رمز عبور</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =====================================================================
// Sub-component: Purge Orphaned Office Data Modal
// =====================================================================
interface PurgeOrphanDataModalProps {
  isOpen: boolean;
  offices: OfficeProfile[];
  certificates: CertificateRecord[];
  campaigns: AuditCampaign[];
  auditEvents: OfficeAuditEvent[];
  users: AppUser[];
  onClose: () => void;
  onConfirmPurge: () => void;
}

const PurgeOrphanDataModal: React.FC<PurgeOrphanDataModalProps> = ({
  isOpen,
  offices,
  certificates,
  campaigns,
  auditEvents,
  users,
  onClose,
  onConfirmPurge,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const validCodes = useMemo(() => new Set(offices.map(o => String(o.code).trim()).filter(Boolean)), [offices]);

  // Discover all unlisted office codes across dataset
  const orphanDetails = useMemo(() => {
    const unlistedCodes = new Set<string>();
    
    const orphanCerts = certificates.filter(c => {
      const code = c.officeCode ? String(c.officeCode).trim() : '';
      if (code && !validCodes.has(code)) {
        unlistedCodes.add(code);
        return true;
      }
      return false;
    });

    const orphanCamps = campaigns.filter(c => {
      const code = c.officeCode ? String(c.officeCode).trim() : '';
      if (code && !validCodes.has(code)) {
        unlistedCodes.add(code);
        return true;
      }
      return false;
    });

    const orphanEvents = auditEvents.filter(e => {
      const code = e.officeCode ? String(e.officeCode).trim() : '';
      if (code && !validCodes.has(code)) {
        unlistedCodes.add(code);
        return true;
      }
      return false;
    });

    const orphanUsers = users.filter(u => {
      if (u.role === 'OFFICE_USER' && u.assignedOfficeCode) {
        const code = String(u.assignedOfficeCode).trim();
        if (code && !validCodes.has(code)) {
          unlistedCodes.add(code);
          return true;
        }
      }
      return false;
    });

    return {
      unlistedCodes: Array.from(unlistedCodes),
      orphanCertsCount: orphanCerts.length,
      orphanCampsCount: orphanCamps.length,
      orphanEventsCount: orphanEvents.length,
      orphanUsersCount: orphanUsers.length,
    };
  }, [offices, certificates, campaigns, auditEvents, users, validCodes]);

  if (!isOpen) return null;

  const totalIssues = orphanDetails.orphanCertsCount + orphanDetails.orphanCampsCount + orphanDetails.orphanEventsCount + orphanDetails.orphanUsersCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden my-8 animate-in zoom-in-95">
        <div className="bg-rose-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-800 border border-rose-700 flex items-center justify-center">
              <Database className="w-5 h-5 text-rose-300" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">پاکسازی داده‌های دفاتری که در لیست دفاتر نیستند</h3>
              <p className="text-xs text-rose-200 mt-0.5">
                حفظ سلامت و یکپارچگی پایگاه داده و رفع خطاهای کلید خارجی
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-rose-300 hover:text-white rounded-xl hover:bg-rose-800 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-700 leading-relaxed">
            این ابزار تمامی داده‌ها (گواهی‌ها، پرونده‌های بازرسی، رویدادها و حساب‌های کاربری) که به کدهای دفاتری ارجاع دارند که در لیست فعال دفاتر وجود ندارند را شناسایی و به صورت امن پاکسازی می‌نماید.
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-slate-200">
              <span className="text-slate-600">کدهای دفاتر ناموجود شناسایی شده:</span>
              <span className="font-mono font-bold text-rose-700">
                {orphanDetails.unlistedCodes.length > 0 ? orphanDetails.unlistedCodes.join(', ') : 'موردی یافت نشد'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-200">
              <span className="text-slate-600">گواهی‌های بدون دفتر معتبر:</span>
              <span className="font-mono font-bold text-slate-900">{orphanDetails.orphanCertsCount} رکورد</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-200">
              <span className="text-slate-600">پرونده‌ها و کمپین‌های بدون دفتر:</span>
              <span className="font-mono font-bold text-slate-900">{orphanDetails.orphanCampsCount} کمپین</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-200">
              <span className="text-slate-600">رویدادهای ممیزی بدون دفتر:</span>
              <span className="font-mono font-bold text-slate-900">{orphanDetails.orphanEventsCount} رویداد</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-600">حساب‌های کاربری با کد دفتر حذف شده:</span>
              <span className="font-mono font-bold text-slate-900">{orphanDetails.orphanUsersCount} حساب</span>
            </div>
          </div>

          {totalIssues === 0 ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-900 text-xs">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>پایگاه داده و لیست دفاتر کاملاً منطبق و یکپارچه هستند و هیچ رکورد سرگردانی یافت نشد.</span>
            </div>
          ) : (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-amber-900 text-xs">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                با تایید این عملیات، رکوردهای مربوط به کدهای فوق از حافظه محلی و جدول‌های Supabase حذف شده و انتساب حساب‌های کاربری مرتبط لغو می‌گردد.
              </span>
            </div>
          )}

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="button"
              disabled={totalIssues === 0 || isProcessing}
              onClick={async () => {
                setIsProcessing(true);
                await onConfirmPurge();
                setIsProcessing(false);
              }}
              className="px-5 py-2.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" />
              <span>{isProcessing ? 'در حال پاکسازی...' : 'تایید و پاکسازی کامل داده‌های سرگردان'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// =====================================================================
// Sub-component: Single User Delete Confirmation Modal
// =====================================================================
interface DeleteUserConfirmModalProps {
  user: AppUser;
  onClose: () => void;
  onConfirm: () => void;
}

const DeleteUserConfirmModal: React.FC<DeleteUserConfirmModalProps> = ({
  user,
  onClose,
  onConfirm,
}) => {
  const isTest = isTestUser(user);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-rose-100 bg-rose-50/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-100 text-rose-700">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-rose-950">
                {isTest ? 'حذف کاربر تستی' : 'حذف حساب کاربری'}
              </h3>
              <p className="text-[11px] text-rose-700">
                تایید حذف قطعی کاربر از سامانه
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-white/80 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">نام و نام‌خانوادگی:</span>
              <span className="font-extrabold text-slate-900">{user.fullName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">نام کاربری:</span>
              <span className="font-mono font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                {user.username}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">کد ملی:</span>
              <span className="font-mono text-slate-700">{user.nationalId}</span>
            </div>
            {user.assignedOfficeCode && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">دفتر منتسب:</span>
                <span className="text-slate-800 font-bold">کد {user.assignedOfficeCode} ({user.assignedOfficeName || 'دفتر'})</span>
              </div>
            )}
            {isTest && (
              <div className="pt-1 flex items-center justify-end">
                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                  کاربر تستی پیش‌فرض
                </span>
              </div>
            )}
          </div>

          <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-rose-800 text-[11px] leading-relaxed">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <span>
              با انجام این عملیات، این حساب کاربری به صورت دائمی حذف شده و کلیه نشست‌ها و دسترسی‌های آن به سامانه خاتمه خواهد یافت.
            </span>
          </div>

          {/* Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold rounded-xl shadow-md shadow-rose-600/20 flex items-center gap-2 transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>تایید و حذف قطعی</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// =====================================================================
// Sub-component: Batch Delete Test Users Modal
// =====================================================================
interface BatchDeleteTestUsersModalProps {
  testUsers: AppUser[];
  onClose: () => void;
  onConfirm: () => void;
}

const BatchDeleteTestUsersModal: React.FC<BatchDeleteTestUsersModalProps> = ({
  testUsers,
  onClose,
  onConfirm,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-amber-100 bg-amber-50/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-100 text-amber-900">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-amber-950">
                حذف گروهی کاربران آزمایشی و تستی
              </h3>
              <p className="text-[11px] text-amber-800">
                پاکسازی {testUsers.length} حساب کاربری آزمایشی از سامانه
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-white/80 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs">
          <p className="text-slate-700 leading-relaxed font-medium">
            نام‌های کاربری تستی زیر که به صورت پیش‌فرض در سامانه ایجاد شده بودند حذف خواهند شد:
          </p>

          <div className="max-h-48 overflow-y-auto space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
            {testUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-100 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800">{u.fullName}</span>
                  <span className="text-[10px] text-slate-500 font-mono">({u.role})</span>
                </div>
                <span className="font-mono font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 text-[11px]">
                  {u.username}
                </span>
              </div>
            ))}
          </div>

          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-emerald-900 text-[11px] leading-relaxed">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700 mt-0.5" />
            <span>
              <strong>نکته اطمینان‌بخش:</strong> کلیه حساب‌های واقعی تعریف‌شده توسط شما و همچنین حساب جاری که اکنون با آن وارد سامانه شده‌اید کاملاً حفظ شده و دست‌نخورده باقی خواهند ماند.
            </span>
          </div>

          {/* Buttons */}
          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold rounded-xl shadow-md shadow-amber-600/20 flex items-center gap-2 transition cursor-pointer"
            >
              <UserX className="w-4 h-4" />
              <span>تایید حذف {testUsers.length} کاربر تستی</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
