import React, { useState, useMemo } from 'react';
import { 
  Bell, 
  BellRing, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  Send, 
  FileJson, 
  Webhook, 
  Smartphone, 
  Mail, 
  SlidersHorizontal, 
  ArrowRight, 
  ExternalLink, 
  Check, 
  MessageSquare, 
  User, 
  Building2, 
  Sparkles, 
  Download, 
  Radio,
  Layers,
  Inbox,
  Calendar,
  AlertCircle,
  Eye,
  RefreshCw,
  Plus,
  FileEdit
} from 'lucide-react';
import { 
  AppNotification, 
  NotificationCategory, 
  NotificationSeverity, 
  NotificationStatus, 
  NotificationChannelConfig, 
  NotificationChannelType,
  OfficeProfile 
} from '../types';
import { NotificationPayloadInspectorModal } from './NotificationPayloadInspectorModal';
import { NotificationChannelsConfigTab } from './NotificationChannelsConfigTab';
import { NotificationTemplatesManager } from './NotificationTemplatesManager';
import { updateNotificationOnResponse } from '../utils/notificationEngine';
import { getCurrentSessionUser, logUserAccessAction } from '../services/authService';

interface NotificationCenterViewProps {
  notifications: AppNotification[];
  setNotifications: React.Dispatch<React.SetStateAction<AppNotification[]>>;
  channelConfig: NotificationChannelConfig;
  setChannelConfig: React.Dispatch<React.SetStateAction<NotificationChannelConfig>>;
  offices: OfficeProfile[];
  onNavigateToOfficeKartable?: (officeCode?: string) => void;
  onNavigateToInspectorReview?: () => void;
  onNavigateToEntity?: (entityType: string, entityId?: string, officeCode?: string) => void;
}

export const NotificationCenterView: React.FC<NotificationCenterViewProps> = ({
  notifications,
  setNotifications,
  channelConfig,
  setChannelConfig,
  offices,
  onNavigateToOfficeKartable,
  onNavigateToInspectorReview,
  onNavigateToEntity,
}) => {
  const [activeMainTab, setActiveMainTab] = useState<'FEED' | 'TEMPLATES' | 'CHANNELS_CONFIG'>('FEED');

  // Track viewing notifications in audit logs
  React.useEffect(() => {
    const user = getCurrentSessionUser();
    if (user) {
      logUserAccessAction(user, 'VIEW_NOTIFICATIONS', `مشاهده مرکز مدیریت اعلان‌ها (${notifications.length} اعلان موجود)`);
    }
  }, []);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOfficeFilter, setSelectedOfficeFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [selectedChannelFilter, setSelectedChannelFilter] = useState<string>('ALL');

  // Modals & Panels
  const [inspectingNotification, setInspectingNotification] = useState<AppNotification | null>(null);
  const [respondingNotifId, setRespondingNotifId] = useState<string | null>(null);
  const [responseTextDraft, setResponseTextDraft] = useState<string>('');
  const [responderRoleDraft, setResponderRoleDraft] = useState<'OFFICE_USER' | 'INSPECTOR'>('OFFICE_USER');
  const [responderNameDraft, setResponderNameDraft] = useState<string>('محسن کریمی (مسئول دفتر)');
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false);

  // Statistics
  const totalCount = notifications.length;
  const actionRequiredCount = notifications.filter(n => n.status === 'ACTION_REQUIRED').length;
  const respondedCount = notifications.filter(n => n.status === 'RESPONDED').length;
  const resolvedCount = notifications.filter(n => n.status === 'RESOLVED').length;
  const unreadCount = notifications.filter(n => n.status === 'UNREAD').length;

  // Filtered Notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter(notif => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = notif.title.toLowerCase().includes(q);
        const matchMsg = notif.message.toLowerCase().includes(q);
        const matchCode = notif.eventCode.toLowerCase().includes(q);
        const matchOffice = notif.officeName?.toLowerCase().includes(q) || notif.officeCode?.includes(q);
        const matchApplicant = notif.metadata?.applicantName?.toLowerCase().includes(q);
        const matchTracking = notif.metadata?.trackingCode?.toLowerCase().includes(q);
        if (!matchTitle && !matchMsg && !matchCode && !matchOffice && !matchApplicant && !matchTracking) {
          return false;
        }
      }

      // Office Filter
      if (selectedOfficeFilter !== 'ALL' && notif.officeCode !== selectedOfficeFilter) {
        return false;
      }

      // Status Filter
      if (selectedStatusFilter !== 'ALL' && notif.status !== selectedStatusFilter) {
        return false;
      }

      // Category Filter
      if (selectedCategoryFilter !== 'ALL' && notif.category !== selectedCategoryFilter) {
        return false;
      }

      // Channel Filter
      if (selectedChannelFilter !== 'ALL') {
        const hasChannel = notif.channels.some(c => c.channel === selectedChannelFilter);
        if (!hasChannel) return false;
      }

      return true;
    });
  }, [notifications, searchQuery, selectedOfficeFilter, selectedStatusFilter, selectedCategoryFilter, selectedChannelFilter]);

  // Mark all as read
  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => n.status === 'UNREAD' ? { ...n, status: 'READ' } : n));
  };

  // Toggle single status
  const handleToggleStatus = (notifId: string, targetStatus: NotificationStatus) => {
    setNotifications(prev => prev.map(n => {
      if (n.id === notifId) {
        return {
          ...n,
          status: targetStatus,
          updatedAt: new Intl.DateTimeFormat('fa-IR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date()),
        };
      }
      return n;
    }));
  };

  // Submit response to notification
  const handleSubmitNotificationResponse = (notification: AppNotification) => {
    if (!responseTextDraft.trim()) return;

    setIsSubmittingResponse(true);

    const updated = updateNotificationOnResponse(notifications, {
      targetEntityId: notification.targetEntityId || notification.id,
      responderRole: responderRoleDraft,
      responderName: responderNameDraft,
      responseText: responseTextDraft.trim(),
      actionTaken: responderRoleDraft === 'OFFICE_USER' ? 'ثبت پاسخ و رفع نقص توسط دفتر' : 'ثبت نتیجه بررسی توسط بازرس',
      newStatus: 'RESPONDED',
      channelsConfig: channelConfig,
    });

    setNotifications(updated);
    setResponseTextDraft('');
    setRespondingNotifId(null);
    setIsSubmittingResponse(false);
  };

  // Download all exportable JSON
  const handleExportAllJson = () => {
    const exportBatch = {
      exportedAt: new Date().toISOString(),
      sourceSystem: 'RA_AUDIT_NOTIFICATIONS_CENTER',
      totalEventsCount: filteredNotifications.length,
      notifications: filteredNotifications.map(n => n.exportablePayload),
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportBatch, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `ra_audit_notifications_export_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const getCategoryBadge = (category: NotificationCategory) => {
    switch (category) {
      case 'INSPECTION_ACTION':
        return { title: 'درخواست بارگذاری مدارک', bg: 'bg-amber-50 text-amber-800 border-amber-200' };
      case 'DEFECT_ALERT':
        return { title: 'اعلام نقص و عدم انطباق', bg: 'bg-rose-50 text-rose-800 border-rose-200' };
      case 'OFFICE_RESPONSE':
        return { title: 'پاسخ و ارسال مدارک دفتر', bg: 'bg-blue-50 text-blue-800 border-blue-200' };
      case 'INSPECTOR_VERDICT':
        return { title: 'تایید و صدور رأی بازرس', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
      case 'LIFECYCLE_EVENT':
        return { title: 'احکام نظارتی و تعلیق', bg: 'bg-purple-50 text-purple-800 border-purple-200' };
      case 'EXPIRATION_ALARM':
        return { title: 'هشدار مهلت زمانی', bg: 'bg-orange-50 text-orange-800 border-orange-200' };
      case 'SYSTEM':
      default:
        return { title: 'سیستمی', bg: 'bg-slate-50 text-slate-800 border-slate-200' };
    }
  };

  const getStatusBadge = (status: NotificationStatus) => {
    switch (status) {
      case 'ACTION_REQUIRED':
        return { title: 'اقدام لازم / پاسخ فوری', bg: 'bg-amber-500 text-white shadow-2xs' };
      case 'RESPONDED':
        return { title: 'پاسخ داده شده', bg: 'bg-blue-600 text-white' };
      case 'RESOLVED':
        return { title: 'مختومه و منطبق', bg: 'bg-emerald-600 text-white' };
      case 'UNREAD':
        return { title: 'خوانده نشده', bg: 'bg-purple-600 text-white' };
      case 'READ':
      default:
        return { title: 'خوانده شده', bg: 'bg-slate-200 text-slate-700' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 p-0.5 shadow-md shadow-amber-500/10 flex items-center justify-center">
            <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center">
              <BellRing className="w-6 h-6 text-amber-600 animate-wiggle" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-900">مرکز مدیریت اعلان‌ها و رویدادهای نظارتی</h2>
              <span className="text-xs bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full font-bold">
                Notification Center v2.4
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              ثبت رویدادهای ممیزی، به‌روزرسانی خودکار اعلان پس از ثبت پاسخ، و ارسال بسته‌های ساخت‌یافته JSON به وب‌هوک، SMS و Email
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportAllJson}
            title="دانلود بسته داده JSON کلیه اعلان‌ها جهت تغذیه سامانه‌های بیرونی"
            className="flex items-center gap-1.5 text-xs bg-slate-900 hover:bg-slate-800 text-white font-bold px-3.5 py-2.5 rounded-2xl transition shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>خروجی JSON برای سامانه بیرونی</span>
          </button>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="flex items-center gap-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3.5 py-2.5 rounded-2xl transition cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>خواندن همه</span>
            </button>
          )}
        </div>
      </div>

      {/* Statistics Counter Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-1">
          <span className="text-xs text-slate-500 font-medium">کل اعلان‌های فعال:</span>
          <div className="flex items-center justify-between">
            <span className="text-xl font-black text-slate-900 font-mono">{totalCount}</span>
            <Bell className="w-4 h-4 text-slate-400" />
          </div>
        </div>

        <div className="bg-white border border-amber-200 bg-amber-50/40 rounded-2xl p-4 shadow-2xs space-y-1">
          <span className="text-xs text-amber-800 font-bold">نیازمند اقدام / پاسخ:</span>
          <div className="flex items-center justify-between">
            <span className="text-xl font-black text-amber-900 font-mono">{actionRequiredCount}</span>
            <AlertTriangle className="w-4 h-4 text-amber-600 animate-pulse" />
          </div>
        </div>

        <div className="bg-white border border-blue-200 bg-blue-50/40 rounded-2xl p-4 shadow-2xs space-y-1">
          <span className="text-xs text-blue-800 font-bold">پاسخ داده شده (در جریان):</span>
          <div className="flex items-center justify-between">
            <span className="text-xl font-black text-blue-900 font-mono">{respondedCount}</span>
            <MessageSquare className="w-4 h-4 text-blue-600" />
          </div>
        </div>

        <div className="bg-white border border-emerald-200 bg-emerald-50/40 rounded-2xl p-4 shadow-2xs space-y-1">
          <span className="text-xs text-emerald-800 font-bold">مختومه و منطبق:</span>
          <div className="flex items-center justify-between">
            <span className="text-xl font-black text-emerald-900 font-mono">{resolvedCount}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-1 col-span-2 sm:col-span-1">
          <span className="text-xs text-slate-500 font-medium">کانال‌های متصل:</span>
          <div className="flex items-center gap-1.5 pt-1 text-[11px] font-bold text-slate-700">
            <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">Webhook</span>
            <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">SMS</span>
            <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">Email</span>
          </div>
        </div>
      </div>

      {/* Main Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 flex-wrap">
        <button
          onClick={() => setActiveMainTab('FEED')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition cursor-pointer ${
            activeMainTab === 'FEED'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span>کارتابل و فهرست اعلان‌ها ({filteredNotifications.length})</span>
        </button>

        <button
          onClick={() => setActiveMainTab('TEMPLATES')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition cursor-pointer ${
            activeMainTab === 'TEMPLATES'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileEdit className="w-4 h-4 text-blue-400" />
          <span>قالب‌های متنی اعلان‌ها (SMS، Email و درون‌برنامه‌ای)</span>
        </button>

        <button
          onClick={() => setActiveMainTab('CHANNELS_CONFIG')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition cursor-pointer ${
            activeMainTab === 'CHANNELS_CONFIG'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4 text-amber-500" />
          <span>پیکربندی درگاه‌ها و معماری اتصال</span>
        </button>
      </div>

      {/* TAB 1: NOTIFICATIONS FEED */}
      {activeMainTab === 'FEED' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute right-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="جستجو در عنوان، کد رویداد، نام متقاضی، کد رهگیری یا متن پیام..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pr-10 pl-4 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                />
              </div>

              {/* Office Selector */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                <select
                  value={selectedOfficeFilter}
                  onChange={(e) => setSelectedOfficeFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer w-full sm:w-48"
                >
                  <option value="ALL">همه دفاتر ({offices.length})</option>
                  {offices.map(o => (
                    <option key={o.code} value={o.code}>{o.name} ({o.code})</option>
                  ))}
                </select>
              </div>

              {/* Status Filter Dropdown */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer w-full sm:w-40"
                >
                  <option value="ALL">همه وضعیت‌ها</option>
                  <option value="ACTION_REQUIRED">اقدام لازم</option>
                  <option value="RESPONDED">پاسخ داده شده</option>
                  <option value="RESOLVED">مختومه</option>
                  <option value="UNREAD">خوانده نشده</option>
                  <option value="READ">خوانده شده</option>
                </select>
              </div>

              {/* Channel Filter Dropdown */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={selectedChannelFilter}
                  onChange={(e) => setSelectedChannelFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer w-full sm:w-36"
                >
                  <option value="ALL">همه کانال‌ها</option>
                  <option value="SMS">پیامک (SMS)</option>
                  <option value="EMAIL">پست الکترونیک (Email)</option>
                  <option value="WEBHOOK">وب‌هوک (Webhook)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Notifications Feed List */}
          {filteredNotifications.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-3">
              <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
                <Bell className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">هیچ اعلانی مطابق فیلترهای انتخابی یافت نشد</h4>
              <p className="text-xs text-slate-500">می‌توانید فیلترهای جستجو را پاک کنید یا اعلان‌های جدید ایجاد نمایید.</p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredNotifications.map(notification => {
                const catBadge = getCategoryBadge(notification.category);
                const statBadge = getStatusBadge(notification.status);
                const isActionReq = notification.status === 'ACTION_REQUIRED';
                const isResponding = respondingNotifId === notification.id;

                return (
                  <div
                    key={notification.id}
                    className={`bg-white border rounded-3xl p-5 shadow-xs transition space-y-4 ${
                      isActionReq
                        ? 'border-amber-300 ring-1 ring-amber-100'
                        : notification.status === 'RESPONDED'
                        ? 'border-blue-200'
                        : notification.status === 'RESOLVED'
                        ? 'border-emerald-200'
                        : 'border-slate-200'
                    }`}
                  >
                    {/* Top Row: Meta & Badges */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${catBadge.bg}`}>
                          {catBadge.title}
                        </span>

                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${statBadge.bg}`}>
                          {statBadge.title}
                        </span>

                        {notification.priority === 'URGENT' && (
                          <span className="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full font-bold">
                            اولویت فوری
                          </span>
                        )}

                        <span className="text-[11px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                          {notification.eventCode}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Clock className="w-3.5 h-3.5" />
                        <span>ثبت: {notification.createdAt}</span>
                        {notification.updatedAt !== notification.createdAt && (
                          <span className="text-blue-600 font-semibold">(به‌روزرسانی: {notification.updatedAt})</span>
                        )}
                      </div>
                    </div>

                    {/* Middle: Title & Message */}
                    <div className="space-y-1.5">
                      <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        {notification.title}
                      </h4>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {notification.message}
                      </p>
                    </div>

                    {/* Metadata Context Box (Office, Applicant, Tracking) */}
                    {notification.metadata && (
                      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-700">
                        {notification.officeName && (
                          <div className="flex items-center gap-1.5 truncate">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="text-slate-500">دفتر:</span>
                            <span className="font-bold truncate">{notification.officeName}</span>
                          </div>
                        )}

                        {notification.metadata.applicantName && (
                          <div className="flex items-center gap-1.5 truncate">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="text-slate-500">متقاضی:</span>
                            <span className="font-bold truncate">{notification.metadata.applicantName}</span>
                          </div>
                        )}

                        {notification.metadata.trackingCode && (
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-slate-500">کد رهگیری:</span>
                            <span className="font-mono font-bold text-slate-900">{notification.metadata.trackingCode}</span>
                          </div>
                        )}

                        {notification.expiresAt && (
                          <div className="flex items-center gap-1.5 text-amber-800 font-semibold">
                            <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>مهلت اقدام: {notification.expiresAt}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Response History & Linked Actions */}
                    {notification.responseHistory && notification.responseHistory.length > 0 && (
                      <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-3.5 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <h5 className="font-black text-blue-950 flex items-center gap-1.5">
                            <MessageSquare className="w-4 h-4 text-blue-600" />
                            <span>تاریخچه پاسخ‌ها و اقدامات ثبت شده روی این اعلان ({notification.responseHistory.length}):</span>
                          </h5>
                          <span className="text-[10px] bg-blue-200 text-blue-900 px-2 py-0.5 rounded-full font-bold">
                            Live Updated
                          </span>
                        </div>

                        <div className="space-y-2 divide-y divide-blue-200/60 pt-1">
                          {notification.responseHistory.map((resp, idx) => (
                            <div key={resp.id || idx} className="pt-2 first:pt-0 space-y-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-bold text-blue-900 flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {resp.responderName}
                                </span>
                                <span className="text-blue-700 font-mono">{resp.responseDate}</span>
                              </div>
                              <p className="text-slate-700 leading-relaxed">{resp.responseText}</p>
                              {resp.actionTaken && (
                                <div className="text-[10px] text-blue-800 font-semibold flex items-center gap-1">
                                  <Check className="w-3 h-3 text-blue-600" />
                                  <span>اقدام: {resp.actionTaken}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Interactive Response Box (Collapsible) */}
                    {isResponding && (
                      <div className="bg-slate-50 border border-slate-300 rounded-2xl p-4 space-y-3 animate-in fade-in">
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                            <Send className="w-4 h-4 text-emerald-600" />
                            <span>ثبت پاسخ و به‌روزرسانی وضعیت اعلان</span>
                          </h5>
                          <button
                            onClick={() => setRespondingNotifId(null)}
                            className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
                          >
                            انصراف
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <label className="text-slate-600 block mb-1 font-bold">نقش پاسخ‌دهنده:</label>
                            <select
                              value={responderRoleDraft}
                              onChange={(e) => setResponderRoleDraft(e.target.value as any)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold"
                            >
                              <option value="OFFICE_USER">مسئول دفتر صدور گواهی</option>
                              <option value="INSPECTOR">بازرس مرکز بازرسی و نظارت مرکز میانی عام</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-slate-600 block mb-1 font-bold">نام پاسخ‌دهنده:</label>
                            <input
                              type="text"
                              value={responderNameDraft}
                              onChange={(e) => setResponderNameDraft(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-slate-600 block mb-1 font-bold">متن پاسخ و شرح اقدام انجام شده:</label>
                          <textarea
                            rows={2}
                            value={responseTextDraft}
                            onChange={(e) => setResponseTextDraft(e.target.value)}
                            placeholder="توضیحات و اقدامات انجام شده جهت رفع نقص یا اعلام نتیجه..."
                            className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            onClick={() => setRespondingNotifId(null)}
                            className="px-3 py-1.5 rounded-xl text-xs text-slate-600 hover:bg-slate-200 cursor-pointer"
                          >
                            انصراف
                          </button>
                          <button
                            onClick={() => handleSubmitNotificationResponse(notification)}
                            disabled={!responseTextDraft.trim() || isSubmittingResponse}
                            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-1.5 rounded-xl transition shadow-2xs cursor-pointer disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>ثبت پاسخ و به‌روزرسانی خودکار اعلان</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Bottom Row: Multi-Channel Badges & Action Buttons */}
                    <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      {/* Channels delivery status */}
                      <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                        <span className="text-slate-400 font-bold ml-1">کانال‌ها:</span>
                        {notification.channels.map((ch, idx) => (
                          <span
                            key={idx}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border font-semibold ${
                              ch.status === 'DISPATCHED'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                            }`}
                            title={`وضعیت: ${ch.status} | زمان: ${ch.dispatchedAt || '-'} | آدرس: ${ch.targetAddress || '-'}`}
                          >
                            {ch.channel === 'SMS' && <Smartphone className="w-3 h-3 text-blue-600" />}
                            {ch.channel === 'EMAIL' && <Mail className="w-3 h-3 text-amber-600" />}
                            {ch.channel === 'WEBHOOK' && <Webhook className="w-3 h-3 text-emerald-600" />}
                            {ch.channel === 'IN_APP' && <Bell className="w-3 h-3 text-purple-600" />}
                            <span>{ch.channel}</span>
                            <span className="text-[9px] bg-emerald-200/60 text-emerald-900 px-1 rounded">
                              {ch.status === 'DISPATCHED' ? 'ارسال شده' : ch.status}
                            </span>
                          </span>
                        ))}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
                        {/* Machine-readable payload button */}
                        <button
                          onClick={() => setInspectingNotification(notification)}
                          className="flex items-center gap-1 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl font-bold transition cursor-pointer"
                          title="مشاهده ساختار داده JSON و آزمون ارسال به سامانه بیرونی"
                        >
                          <FileJson className="w-3.5 h-3.5 text-emerald-600" />
                          <span>مشاهده Payload / API</span>
                        </button>

                        {/* Reply / Action button */}
                        {!isResponding && (
                          <button
                            onClick={() => {
                              setRespondingNotifId(notification.id);
                              setResponseTextDraft('');
                            }}
                            className="flex items-center gap-1 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-xl font-bold transition cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>ثبت پاسخ</span>
                          </button>
                        )}

                        {/* Resolve button */}
                        {notification.status !== 'RESOLVED' && (
                          <button
                            onClick={() => handleToggleStatus(notification.id, 'RESOLVED')}
                            className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl font-bold transition cursor-pointer"
                            title="مختومه‌سازی پرونده اعلان"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>مختومه</span>
                          </button>
                        )}

                        {/* Go to case in kartable */}
                        {onNavigateToOfficeKartable && notification.officeCode && (
                          <button
                            onClick={() => onNavigateToOfficeKartable(notification.officeCode)}
                            className="flex items-center gap-1 text-xs text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded-xl font-bold transition cursor-pointer"
                            title="مشاهده مستقیم در کارتابل دفتر"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                            <span>کارتابل</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: NOTIFICATION TEMPLATES MANAGER */}
      {activeMainTab === 'TEMPLATES' && (
        <NotificationTemplatesManager />
      )}

      {/* TAB 3: CHANNELS CONFIGURATION & INTEGRATION ARCHITECTURE */}
      {activeMainTab === 'CHANNELS_CONFIG' && (
        <NotificationChannelsConfigTab
          config={channelConfig}
          onSaveConfig={(updated) => setChannelConfig(updated)}
        />
      )}

      {/* MODAL: PAYLOAD INSPECTOR */}
      {inspectingNotification && (
        <NotificationPayloadInspectorModal
          notification={inspectingNotification}
          channelConfig={channelConfig}
          onClose={() => setInspectingNotification(null)}
        />
      )}
    </div>
  );
};
