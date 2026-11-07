import React, { useState, useRef, useEffect } from 'react';
import {
  ShieldCheck,
  Building2,
  Bell,
  LogOut,
  ChevronDown,
  Menu,
  Database,
  SlidersHorizontal,
  RotateCcw,
  CheckCircle2,
  Check,
  Cloud,
  CloudCheck,
  RefreshCw
} from 'lucide-react';
import { OfficeProfile, AppNotification } from '../types';
import { AppUser } from '../types/auth';
import { NotificationDropdownQuickMenu } from './NotificationDropdownQuickMenu';
import { getUserPermissions, isStrictOfficeBoundUser } from '../services/authService';
import { isSupabaseReady } from '../lib/supabase';
import { subscribeToSyncStatus, SyncStatus } from '../services/autoSyncService';

interface NavbarProps {
  offices: OfficeProfile[];
  selectedOfficeCode: string;
  setSelectedOfficeCode: (code: string) => void;
  notifications: AppNotification[];
  onMarkAllNotificationsAsRead: () => void;
  onOpenSupabaseModal: () => void;
  onResetData: () => void;
  currentUser: AppUser | null;
  onOpenUserProfile: () => void;
  onOpenLoginModal: () => void;
  onLogout: () => void;
  onOpenAdminSettings?: () => void;
  onToggleMobileSidebar?: () => void;
  onNavigateToNotifications?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  offices,
  selectedOfficeCode,
  setSelectedOfficeCode,
  notifications,
  onMarkAllNotificationsAsRead,
  onOpenSupabaseModal,
  onResetData,
  currentUser,
  onOpenUserProfile,
  onOpenLoginModal,
  onLogout,
  onOpenAdminSettings,
  onToggleMobileSidebar,
  onNavigateToNotifications,
}) => {
  const [isOfficeDropdownOpen, setIsOfficeDropdownOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const officeDropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const currentOffice = offices.find(o => String(o.code).trim() === String(selectedOfficeCode).trim()) || offices[0];

  const perms = getUserPermissions(currentUser);
  const isStrictOffice = isStrictOfficeBoundUser(currentUser);
  const isAdmin = currentUser?.role === 'SYSTEM_ADMIN';
  const isSenior = currentUser?.role === 'SENIOR_INSPECTOR';
  const canSwitchOffices = !isStrictOffice || perms.canViewAllOffices || perms.canManageOffices || isAdmin;

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (officeDropdownRef.current && !officeDropdownRef.current.contains(target)) {
        setIsOfficeDropdownOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [displayName, setDisplayName] = useState(currentUser ? currentUser.fullName.split(' ')[0] : 'مهمان');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('IDLE');
  const [syncMessage, setSyncMessage] = useState<string>('');

  useEffect(() => {
    setDisplayName(currentUser ? currentUser.fullName.split(' ')[0] : 'مهمان');
  }, [currentUser]);

  useEffect(() => {
    return subscribeToSyncStatus((status, message) => {
      setSyncStatus(status);
      setSyncMessage(message);
    });
  }, []);

  return (
    <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 h-16 shrink-0 shadow-2xs">
      <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-4">
        {/* Right Section: Brand Logo & Title (as in design image) */}
        <div className="flex items-center gap-3">
          {/* Mobile Sidebar Toggle */}
          <button
            onClick={onToggleMobileSidebar}
            className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            title="منوی ناوبری"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Official Audit Emblem Badge */}
          <div className="w-9 h-9 rounded-full overflow-hidden border border-slate-300/80 bg-slate-900 flex items-center justify-center shrink-0 shadow-sm">
            <img src="/audit.png" alt="لوگوی سامانه بازرسی" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>

          {/* Application Title */}
          <div>
            <h1 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight select-none">
              سامانه بازرسی دفاتر صدور گواهی الکترونیکی
            </h1>
          </div>
        </div>

        {/* Left Section: Icons & User Controls (matching design image) */}
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          {/* 1. Notifications Bell Dropdown */}
          <NotificationDropdownQuickMenu
            notifications={notifications}
            onOpenFullCenter={() => {
              if (onNavigateToNotifications) onNavigateToNotifications();
            }}
            onMarkAllAsRead={onMarkAllNotificationsAsRead}
          />

          {/* 2. Logout Button */}
          {currentUser ? (
            <button
              onClick={onLogout}
              title="خروج از حساب کاربری"
              className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
            >
              <LogOut className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={onOpenLoginModal}
              className="text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-xl transition cursor-pointer"
            >
              ورود
            </button>
          )}

          {/* 3. Cloud Auto-Sync Status Badge */}
          {isSupabaseReady() && (
            <button
              onClick={onOpenSupabaseModal}
              className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                syncStatus === 'SYNCING'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : syncStatus === 'SUCCESS'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : syncStatus === 'ERROR'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
              title={syncMessage || 'همگام‌سازی خودکار پایگاه داده ابری Supabase فعال است'}
            >
              {syncStatus === 'SYNCING' ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
              ) : syncStatus === 'SUCCESS' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Database className="w-3.5 h-3.5 text-teal-600" />
              )}
              <span className="text-[11px] font-medium">
                {syncStatus === 'SYNCING'
                  ? 'در حال ذخیره ابری...'
                  : syncStatus === 'SUCCESS'
                  ? 'دیتابیس همگام'
                  : 'اتصال دیتابیس'}
              </span>
            </button>
          )}

          {/* 4. Active Office Pill / Switcher */}
          <div className="relative" ref={officeDropdownRef}>
            <button
              onClick={() => {
                if (canSwitchOffices) setIsOfficeDropdownOpen(prev => !prev);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs transition border ${
                canSwitchOffices
                  ? 'hover:bg-slate-50 border-transparent hover:border-slate-200 cursor-pointer text-slate-700'
                  : 'border-transparent text-slate-700 cursor-default'
              }`}
            >
              <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
              <div className="flex items-center gap-1 font-medium max-w-[200px] sm:max-w-[280px] truncate">
                <span className="text-slate-500 hidden md:inline">دفتر فعال:</span>
                <span className="text-slate-800 font-bold truncate">
                  {currentOffice?.name || 'دفتر پیشخوان خدمات دولت'} {currentOffice?.city ? `(${currentOffice.city})` : ''}
                </span>
              </div>
              {canSwitchOffices && (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              )}
            </button>

            {/* Office Dropdown Menu */}
            {isOfficeDropdownOpen && canSwitchOffices && (
              <div className="absolute left-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3.5 py-2 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">انتخاب دفتر فعال جهت بازرسی</span>
                  <span className="text-[10px] text-slate-500 font-mono">{offices.length} دفتر</span>
                </div>
                <div className="max-h-60 overflow-y-auto py-1">
                  {offices.map(office => {
                    const isSelected = String(office.code).trim() === String(selectedOfficeCode).trim();
                    return (
                      <button
                        key={office.code}
                        onClick={() => {
                          setSelectedOfficeCode(office.code);
                          setIsOfficeDropdownOpen(false);
                        }}
                        className={`w-full text-right px-3.5 py-2.5 text-xs flex items-center justify-between gap-2 hover:bg-slate-50 transition cursor-pointer ${
                          isSelected ? 'bg-teal-50 text-teal-900 font-bold' : 'text-slate-700'
                        }`}
                      >
                        <div className="truncate">
                          <p className="truncate font-semibold">{office.name}</p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            کد {office.code} • {office.province} ({office.city})
                          </p>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-teal-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Vertical Divider */}
          <div className="h-5 w-px bg-slate-200 hidden sm:block" />

          {/* 4. User Profile Dropdown Pill (Avatar + Name e.g. "ندا" + Chevron) */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setIsUserMenuOpen(prev => !prev)}
              className="flex items-center gap-2 px-2 py-1 hover:bg-slate-100 rounded-xl transition cursor-pointer select-none"
            >
              {/* Avatar dot */}
              <div className="relative w-8 h-8 rounded-full bg-teal-700 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                {currentUser?.fullName ? currentUser.fullName.charAt(0) : 'U'}
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
              </div>

              {/* Name */}
              <span className="text-xs sm:text-sm font-bold text-slate-800">
                {displayName}
              </span>

              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </button>

            {/* User Dropdown Menu */}
            {isUserMenuOpen && (
              <div className="absolute left-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-4 py-2 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {currentUser?.fullName || 'کاربر مهمان'}
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                    {currentUser?.role === 'SYSTEM_ADMIN'
                      ? 'مدیر ارشد سامانه'
                      : currentUser?.role === 'SENIOR_INSPECTOR'
                      ? 'بازرس ارشد'
                      : currentUser?.role === 'INSPECTOR'
                      ? 'کارشناس بازرس'
                      : 'مدیر دفتر'}
                  </p>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onOpenUserProfile();
                    }}
                    className="w-full text-right px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 font-medium transition cursor-pointer"
                  >
                    مشاهده مشخصات و کلمه عبور
                  </button>

                  {(perms.canManageSystemConfig || isAdmin || isSenior) && onOpenAdminSettings && (
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenAdminSettings();
                      }}
                      className="w-full text-right px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 font-medium transition cursor-pointer flex items-center justify-between"
                    >
                      <span>تنظیمات مدیریتی سیستم</span>
                      <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  )}

                  {(perms.canManageDatabaseSync || isAdmin || isSenior) && onOpenSupabaseModal && (
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenSupabaseModal();
                      }}
                      className="w-full text-right px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 font-medium transition cursor-pointer flex items-center justify-between"
                    >
                      <span>دیتابیس ابری Supabase</span>
                      <Database className="w-3.5 h-3.5 text-emerald-600" />
                    </button>
                  )}

                  {isAdmin && (
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onResetData();
                      }}
                      className="w-full text-right px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 font-medium transition cursor-pointer flex items-center justify-between"
                    >
                      <span>بازیابی داده‌های پیش‌فرض</span>
                      <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  )}

                  <div className="h-px bg-slate-100 my-1" />

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full text-right px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 font-bold transition cursor-pointer flex items-center justify-between"
                  >
                    <span>خروج از حساب</span>
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
