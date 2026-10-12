import React, { useState } from 'react';
import {
  LayoutDashboard,
  Building2,
  Search,
  FileText,
  ShieldCheck,
  PauseCircle,
  Settings,
  ChevronLeft,
  ChevronDown,
  Users,
  UserCheck,
  MapPin,
  Layers,
  BellRing,
  History,
  SlidersHorizontal,
  Database,
  Lock,
  Award,
  Inbox,
  FileCheck2,
  FileSpreadsheet,
  ShieldAlert,
  ClipboardList
} from 'lucide-react';
import { AppUser } from '../types/auth';
import { getUserPermissions, isPrivilegedUser, isStrictOfficeBoundUser } from '../services/authService';

export type MainNavTab =
  | 'DASHBOARD'
  | 'INSPECTION_REVIEW'
  | 'OFFICE_KARTABLE'
  | 'SAMPLING'
  | 'CERTIFICATES_POOL'
  | 'INSPECTION_WARNINGS'
  | 'OFFICE_MANAGEMENT'
  | 'MANAGERS'
  | 'OFFICE_MAP'
  | 'OFFICE_TYPES'
  | 'COMPLAINTS'
  | 'COMMITMENTS'
  | 'SUSPENSIONS'
  | 'FORM_FIELDS'
  | 'USERS_MANAGEMENT'
  | 'NOTIFICATIONS'
  | 'ACCESS_LOGS';

interface SidebarProps {
  currentTab: string;
  onNavigate: (tab: MainNavTab, filterPreset?: string) => void;
  currentUser: AppUser | null;
  onOpenAdminSettings?: () => void;
  onOpenSupabaseModal?: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  activePresetFilter?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onNavigate,
  currentUser,
  onOpenAdminSettings,
  onOpenSupabaseModal,
  isOpenMobile = false,
  onCloseMobile,
  activePresetFilter,
}) => {
  const [isInspectionOpen, setIsInspectionOpen] = useState(
    ['SAMPLING', 'CERTIFICATES_POOL', 'INSPECTION_WARNINGS'].includes(currentTab)
  );
  const [isSystemMgmtOpen, setIsSystemMgmtOpen] = useState(
    ['USERS_MANAGEMENT', 'FORM_FIELDS', 'NOTIFICATIONS', 'ACCESS_LOGS'].includes(currentTab)
  );
  const [isTrackingOpen, setIsTrackingOpen] = useState(
    ['SUSPENSIONS', 'COMMITMENTS', 'COMPLAINTS'].includes(currentTab) ||
    ['SUSPENDED', 'COMMITMENT', 'COMPLAINT'].includes(activePresetFilter || '')
  );

  const perms = getUserPermissions(currentUser);
  const isStrictOffice = isStrictOfficeBoundUser(currentUser);
  const isAdmin = currentUser?.role === 'SYSTEM_ADMIN';
  const isSenior = currentUser?.role === 'SENIOR_INSPECTOR';

  const canAccessManagement = !isStrictOffice && (perms.canManageOffices || isAdmin || isSenior);
  const canAccessInspection = !isStrictOffice && (perms.canRunSampling || perms.canReviewAndVerdict || isAdmin || isSenior);
  const canAccessUsers = !isStrictOffice && (perms.canManageUsers || isAdmin);
  const canAccessConfig = !isStrictOffice && (perms.canManageSystemConfig || isAdmin || isSenior);
  const canAccessNotifications = !isStrictOffice && (perms.canManageNotifications || isAdmin);
  const canAccessLogs = !isStrictOffice && (perms.canManageUsers || perms.canManageSystemConfig || isAdmin || isSenior);

  const isTabActive = (tabKey: string) => {
    if (tabKey === 'OFFICE_MANAGEMENT') {
      return currentTab === 'OFFICE_MANAGEMENT' && !activePresetFilter;
    }
    if (tabKey === 'DASHBOARD') return currentTab === 'ANALYTICS';
    if (tabKey === 'INSPECTION_REVIEW') return currentTab === 'INSPECTION_REVIEW';
    if (tabKey === 'OFFICE_KARTABLE') return currentTab === 'OFFICE_KARTABLE';
    if (tabKey === 'SAMPLING') return currentTab === 'SAMPLING';
    if (tabKey === 'CERTIFICATES_POOL') return currentTab === 'CERTIFICATES_POOL';
    if (tabKey === 'INSPECTION_WARNINGS') return currentTab === 'INSPECTION_WARNINGS';
    if (tabKey === 'SUSPENSIONS') {
      return currentTab === 'SUSPENSIONS' || (currentTab === 'OFFICE_MANAGEMENT' && activePresetFilter === 'SUSPENDED');
    }
    if (tabKey === 'COMMITMENTS') {
      return currentTab === 'COMMITMENTS' || (currentTab === 'OFFICE_MANAGEMENT' && activePresetFilter === 'COMMITMENT');
    }
    if (tabKey === 'COMPLAINTS') {
      return currentTab === 'COMPLAINTS' || (currentTab === 'OFFICE_MANAGEMENT' && activePresetFilter === 'COMPLAINT');
    }
    return currentTab === tabKey;
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
        />
      )}

      {/* Main Sidebar Container - Dark Petrol Slate */}
      <aside
        className={`fixed lg:static top-0 right-0 z-50 h-screen lg:h-auto lg:min-h-[calc(100vh-4rem)] w-64 bg-[#082c35] text-slate-200 flex flex-col justify-between shrink-0 transition-transform duration-300 ease-in-out select-none shadow-2xl lg:shadow-none border-l border-[#0e3c48] ${
          isOpenMobile ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top Section: Navigation Links */}
        <div className="flex-1 overflow-y-auto lg:overflow-y-visible px-3.5 py-4 space-y-4">
          {/* Logo / Title in Mobile */}
          <div className="lg:hidden flex items-center justify-between pb-3 border-b border-[#12424e]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center shrink-0 border border-teal-500/40 bg-slate-950">
                <img src="/audit.png" alt="لوگو" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <span className="font-bold text-xs text-white">سامانه نظارت بر دفاتر RA</span>
            </div>
            <button
              onClick={onCloseMobile}
              className="p-1 text-slate-400 hover:text-white rounded-lg"
            >
              ✕
            </button>
          </div>

          {/* Group 1: میز کار و کارتابل‌ها */}
          <div className="space-y-1">
            <div className="px-3 text-[10px] font-bold text-teal-400/70 uppercase tracking-wider mb-1">
              {isStrictOffice ? 'میز کار دفتر' : 'میز کار و کارتابل‌ها'}
            </div>

            {/* 1. داشبورد (برای بازرسان و ادمین‌ها) */}
            {!isStrictOffice && (
              <button
                id="sidebar-item-dashboard"
                onClick={() => {
                  onNavigate('DASHBOARD');
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isTabActive('DASHBOARD')
                    ? 'bg-[#0d9488] text-white shadow-xs font-bold'
                    : 'text-slate-300 hover:bg-[#0c3743] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <LayoutDashboard className="w-4 h-4 shrink-0" />
                  <span>داشبورد تحلیلی</span>
                </div>
              </button>
            )}

            {/* 2. کارتابل بازرسی (مخصوص بازرسان و ممیزان) */}
            {!isStrictOffice && (
              <button
                id="sidebar-item-inspection-review"
                onClick={() => {
                  onNavigate('INSPECTION_REVIEW');
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isTabActive('INSPECTION_REVIEW')
                    ? 'bg-[#0d9488] text-white shadow-xs font-bold'
                    : 'text-slate-300 hover:bg-[#0c3743] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <FileCheck2 className="w-4 h-4 shrink-0 text-emerald-300" />
                  <span>کارتابل بازرسی</span>
                </div>
                <span className="text-[10px] bg-emerald-900/60 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                  ممیزی
                </span>
              </button>
            )}

            {/* 3. کارتابل دفتر ثبت نام (قابل دسترسی برای همه کاربران، به ویژه دفاتر) */}
            <button
              id="sidebar-item-office-kartable"
              onClick={() => {
                onNavigate('OFFICE_KARTABLE');
                if (onCloseMobile) onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isTabActive('OFFICE_KARTABLE')
                  ? 'bg-[#0d9488] text-white shadow-xs font-bold'
                  : 'text-slate-300 hover:bg-[#0c3743] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Inbox className="w-4 h-4 shrink-0 text-cyan-300" />
                <span>کارتابل دفتر ثبت نام</span>
              </div>
              <span className="text-[10px] bg-cyan-900/60 text-cyan-300 px-2 py-0.5 rounded-full font-bold">
                اسناد
              </span>
            </button>
          </div>

          {/* Group 2: عملیات بازرسی و نظارت (اختصاصی‌سازی وظایف بازرسی) */}
          {canAccessInspection && (
            <div className="space-y-1 pt-2 border-t border-[#0e3c48]">
              <div className="px-3 text-[10px] font-bold text-teal-400/70 uppercase tracking-wider mb-1">
                فرآیند بازرسی
              </div>

              {/* 1. نمونه‌گیری و ابلاغ بازرسی */}
              <button
                id="sidebar-item-sampling"
                onClick={() => {
                  onNavigate('SAMPLING');
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isTabActive('SAMPLING')
                    ? 'bg-[#0d9488] text-white shadow-xs font-bold'
                    : 'text-slate-300 hover:bg-[#0c3743] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Search className="w-4 h-4 shrink-0" />
                  <span>نمونه‌گیری و ابلاغ بازرسی</span>
                </div>
              </button>

              {/* 2. بانک جامع گواهی‌ها و فایل اکسل */}
              <button
                id="sidebar-item-certificates-pool"
                onClick={() => {
                  onNavigate('CERTIFICATES_POOL');
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isTabActive('CERTIFICATES_POOL')
                    ? 'bg-[#0d9488] text-white shadow-xs font-bold'
                    : 'text-slate-300 hover:bg-[#0c3743] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <FileSpreadsheet className="w-4 h-4 shrink-0 text-amber-300" />
                  <span>بانک گواهی‌ها و فایل اکسل</span>
                </div>
              </button>

              {/* 3. رصد و نظارت بر اخطارها و احکام بازرسی */}
              <button
                id="sidebar-item-inspection-warnings"
                onClick={() => {
                  onNavigate('INSPECTION_WARNINGS');
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isTabActive('INSPECTION_WARNINGS')
                    ? 'bg-[#0d9488] text-white shadow-xs font-bold'
                    : 'text-slate-300 hover:bg-[#0c3743] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-purple-300" />
                  <span>نظارت بر اخطارهای بازرسی</span>
                </div>
              </button>
            </div>
          )}

          {/* Group 2: مدیریت دفاتر */}
          <div className="space-y-1 pt-2 border-t border-[#0e3c48]">
            <div className="px-3 text-[10px] font-bold text-teal-400/70 uppercase tracking-wider mb-1">
              مدیریت دفاتر
            </div>

            {/* 1. دفاتر RA */}
            <button
              id="sidebar-item-offices"
              onClick={() => {
                onNavigate('OFFICE_MANAGEMENT');
                if (onCloseMobile) onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isTabActive('OFFICE_MANAGEMENT')
                  ? 'bg-[#0d9488] text-white shadow-xs font-bold'
                  : 'text-slate-300 hover:bg-[#0c3743] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Building2 className="w-4 h-4 shrink-0" />
                <span>دفاتر RA</span>
              </div>
            </button>

            {/* 2. مسئولین دفاتر */}
            <button
              id="sidebar-item-managers"
              onClick={() => {
                onNavigate('MANAGERS');
                if (onCloseMobile) onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isTabActive('MANAGERS')
                  ? 'bg-[#0d9488] text-white shadow-xs font-bold'
                  : 'text-slate-300 hover:bg-[#0c3743] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <UserCheck className="w-4 h-4 shrink-0" />
                <span>مسئولین دفاتر</span>
              </div>
            </button>

            {/* 3. نقشه جغرافیایی */}
            <button
              id="sidebar-item-map"
              onClick={() => {
                onNavigate('OFFICE_MAP');
                if (onCloseMobile) onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isTabActive('OFFICE_MAP')
                  ? 'bg-[#0d9488] text-white shadow-xs font-bold'
                  : 'text-slate-300 hover:bg-[#0c3743] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 shrink-0" />
                <span>نقشه جغرافیایی دفاتر</span>
              </div>
            </button>

            {/* 4. انواع دفاتر RA */}
            <button
              id="sidebar-item-office-types"
              onClick={() => {
                onNavigate('OFFICE_TYPES');
                if (onCloseMobile) onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isTabActive('OFFICE_TYPES')
                  ? 'bg-[#0d9488] text-white shadow-xs font-bold'
                  : 'text-slate-300 hover:bg-[#0c3743] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Layers className="w-4 h-4 shrink-0" />
                <span>تعاریف و انواع دفاتر</span>
              </div>
            </button>

            {/* نظارت و پیگیری (Collapsible) */}
            <div className="space-y-1 pt-1">
              <button
                id="sidebar-item-tracking"
                onClick={() => setIsTrackingOpen(prev => !prev)}
                className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-[#0c3743] hover:text-white transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>نظارت و پیگیری</span>
                </div>
                {isTrackingOpen ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
                )}
              </button>

              {isTrackingOpen && (
                <div className="pr-4 space-y-1 border-r border-[#12424e] mr-3 py-1">
                  <button
                    id="sidebar-item-suspensions"
                    onClick={() => {
                      onNavigate('SUSPENSIONS');
                      if (onCloseMobile) onCloseMobile();
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                      isTabActive('SUSPENSIONS')
                        ? 'bg-[#0d9488] text-white font-bold'
                        : 'text-slate-300 hover:bg-[#0c3743] hover:text-white'
                    }`}
                  >
                    <PauseCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                    <span>دفاتر معلق</span>
                  </button>

                  <button
                    id="sidebar-item-commitments"
                    onClick={() => {
                      onNavigate('COMMITMENTS');
                      if (onCloseMobile) onCloseMobile();
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                      isTabActive('COMMITMENTS')
                        ? 'bg-[#0d9488] text-white font-bold'
                        : 'text-slate-300 hover:bg-[#0c3743] hover:text-white'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-teal-400" />
                    <span>تعهدنامه‌ها</span>
                  </button>

                  <button
                    id="sidebar-item-complaints"
                    onClick={() => {
                      onNavigate('COMPLAINTS');
                      if (onCloseMobile) onCloseMobile();
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                      isTabActive('COMPLAINTS')
                        ? 'bg-[#0d9488] text-white font-bold'
                        : 'text-slate-300 hover:bg-[#0c3743] hover:text-white'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                    <span>شکایات و گزارش‌ها</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Group 3: مدیریت سامانه */}
          {!isStrictOffice && (
            <div className="space-y-1 pt-2 border-t border-[#0e3c48]">
              <div className="px-3 text-[10px] font-bold text-teal-400/70 uppercase tracking-wider mb-1">
                مدیریت سامانه
              </div>

              <button
                id="sidebar-item-system-management"
                onClick={() => setIsSystemMgmtOpen(prev => !prev)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-[#0c3743] hover:text-white transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Settings className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>تنظیمات و دسترسی‌ها</span>
                </div>
                {isSystemMgmtOpen ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
                )}
              </button>

              {/* Submenu for System Management */}
              {isSystemMgmtOpen && (
                <div className="pr-4 space-y-1 border-r border-[#12424e] mr-3 py-1">
                  {canAccessUsers && (
                    <button
                      onClick={() => {
                        onNavigate('USERS_MANAGEMENT');
                        if (onCloseMobile) onCloseMobile();
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                        currentTab === 'USERS_MANAGEMENT'
                          ? 'bg-[#0d9488] text-white font-bold'
                          : 'text-slate-300 hover:bg-[#0c3743] hover:text-white'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>کاربران و دسترسی‌ها</span>
                    </button>
                  )}

                  {canAccessConfig && (
                    <button
                      onClick={() => {
                        onNavigate('FORM_FIELDS');
                        if (onCloseMobile) onCloseMobile();
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                        currentTab === 'FORM_FIELDS'
                          ? 'bg-[#0d9488] text-white font-bold'
                          : 'text-slate-300 hover:bg-[#0c3743] hover:text-white'
                      }`}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>فیلدهای فرم دفاتر</span>
                    </button>
                  )}

                  {canAccessNotifications && (
                    <button
                      onClick={() => {
                        onNavigate('NOTIFICATIONS');
                        if (onCloseMobile) onCloseMobile();
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                        currentTab === 'NOTIFICATIONS'
                          ? 'bg-[#0d9488] text-white font-bold'
                          : 'text-slate-300 hover:bg-[#0c3743] hover:text-white'
                      }`}
                    >
                      <BellRing className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>مرکز اعلان‌ها</span>
                    </button>
                  )}

                  {canAccessLogs && (
                    <button
                      onClick={() => {
                        onNavigate('ACCESS_LOGS');
                        if (onCloseMobile) onCloseMobile();
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                        currentTab === 'ACCESS_LOGS'
                          ? 'bg-[#0d9488] text-white font-bold'
                          : 'text-slate-300 hover:bg-[#0c3743] hover:text-white'
                      }`}
                    >
                      <History className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>لاگ تردد و رویت</span>
                    </button>
                  )}

                  {onOpenAdminSettings && (perms.canManageSystemConfig || isAdmin || isSenior) && (
                    <button
                      onClick={() => {
                        onOpenAdminSettings();
                        if (onCloseMobile) onCloseMobile();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:bg-[#0c3743] hover:text-white transition cursor-pointer"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>تنظیمات مدیریتی</span>
                    </button>
                  )}

                  {onOpenSupabaseModal && (perms.canManageDatabaseSync || isAdmin || isSenior) && (
                    <button
                      onClick={() => {
                        onOpenSupabaseModal();
                        if (onCloseMobile) onCloseMobile();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:bg-[#0c3743] hover:text-white transition cursor-pointer"
                    >
                      <Database className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>دیتابیس ابری Supabase</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Section: Clean Compact Status Footer */}
        <div className="px-4 py-3 border-t border-[#0e3c48] flex items-center justify-between text-xs bg-[#06242c]/50">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
            <span className="text-[11px] font-medium text-slate-300">
              سامانه دفاتر RA
            </span>
          </div>
          <span className="text-[10px] text-teal-300/60 font-mono font-bold">v2.4</span>
        </div>
      </aside>
    </>
  );
};
