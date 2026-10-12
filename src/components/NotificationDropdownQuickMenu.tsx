import React, { useState, useRef, useEffect } from 'react';
import { 
  Bell, 
  BellRing, 
  Check, 
  ExternalLink, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  MessageSquare, 
  ArrowLeft,
  X,
  FileJson
} from 'lucide-react';
import { AppNotification } from '../types/notifications';

interface NotificationDropdownQuickMenuProps {
  notifications: AppNotification[];
  onOpenFullCenter: () => void;
  onSelectNotification?: (notification: AppNotification) => void;
  onMarkAllAsRead: () => void;
}

export const NotificationDropdownQuickMenu: React.FC<NotificationDropdownQuickMenuProps> = ({
  notifications,
  onOpenFullCenter,
  onSelectNotification,
  onMarkAllAsRead,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => n.status === 'UNREAD' || n.status === 'ACTION_REQUIRED').length;
  const recentNotifications = notifications.slice(0, 5);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button with Live Badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-xl border transition cursor-pointer ${
          isOpen
            ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-xs'
            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs'
        }`}
        title="مرکز اعلان‌ها و پیام‌های ممیزی"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-rose-600 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 shadow-xs animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-3xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95">
          {/* Header */}
          <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BellRing className="w-4 h-4 text-amber-400" />
              <h4 className="text-xs font-black">اعلان‌ها و رویدادهای ممیزی</h4>
              {unreadCount > 0 && (
                <span className="text-[10px] bg-amber-500/20 border border-amber-500/40 text-amber-300 px-2 py-0.2 rounded-full font-bold">
                  {unreadCount} اقدام لازم
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  onClick={onMarkAllAsRead}
                  className="text-[11px] text-slate-300 hover:text-white transition cursor-pointer"
                  title="خواندن همه"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {recentNotifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                اعلانی برای نمایش وجود ندارد
              </div>
            ) : (
              recentNotifications.map(item => {
                const isActionReq = item.status === 'ACTION_REQUIRED';
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setIsOpen(false);
                      if (onSelectNotification) onSelectNotification(item);
                      onOpenFullCenter();
                    }}
                    className={`p-3.5 hover:bg-slate-50 transition cursor-pointer space-y-1.5 ${
                      isActionReq ? 'bg-amber-50/40' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
                        item.severity === 'CRITICAL' || isActionReq
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : item.status === 'RESPONDED'
                          ? 'bg-blue-100 text-blue-900'
                          : item.status === 'RESOLVED'
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {isActionReq ? 'اقدام لازم' : item.status === 'RESPONDED' ? 'پاسخ داده شده' : 'اعلان'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">{item.createdAt}</span>
                    </div>

                    <h5 className="text-xs font-bold text-slate-900 leading-snug truncate">{item.title}</h5>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{item.message}</p>

                    {item.latestResponse && (
                      <div className="text-[10px] bg-blue-50 text-blue-900 p-1.5 rounded-lg font-medium flex items-center gap-1 truncate">
                        <MessageSquare className="w-3 h-3 text-blue-600 shrink-0" />
                        <span className="truncate">پاسخ: {item.latestResponse.responseText}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer: Open Full Center Button */}
          <div className="bg-slate-50 border-t border-slate-200 p-3 text-center">
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenFullCenter();
              }}
              className="w-full py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <span>مشاهده مرکز جامع اعلان‌ها و تنظیمات وب‌هوک</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
