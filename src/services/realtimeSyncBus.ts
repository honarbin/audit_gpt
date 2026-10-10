/**
 * سرویس هاب ارتباطی و همگام‌سازی بلادرنگ (Real-Time Sync Bus)
 * 
 * وظایف:
 * ۱. هماهنگی بین تب‌ها و پنجره‌های باز یک سامانه از طریق BroadcastChannel مرورگر
 * ۲. هماهنگی بین کاربران و سیستم‌های مختلف تحت شبکه از طریق Supabase Realtime WebSocket
 * ۳. ارسال رویداد به سرور و دریافت آنی تغییرات توسط سایر کلاینت‌ها
 */

import { getSupabaseClient, isSupabaseReady } from '../lib/supabase';

export type RealtimeEventType = 
  | 'OFFICES_CHANGED'
  | 'USERS_CHANGED'
  | 'USER_UPDATED'
  | 'USER_PASSWORD_CHANGED'
  | 'CAMPAIGNS_CHANGED'
  | 'INSPECTION_RECORD_UPDATED'
  | 'AUDIT_EVENT_ADDED'
  | 'NOTIFICATION_DISPATCHED'
  | 'SYSTEM_STATE_REFRESH';

export interface RealtimeMessage {
  id: string;
  type: RealtimeEventType;
  payload?: any;
  source: 'LOCAL_TAB' | 'REMOTE_WEBSOCKET';
  senderId: string;
  timestamp: string;
}

// شناسه منحصربه‌فرد این تب/نشست جهت جلوگیری از پردازش پیام‌های ارسالی خودی
export const CLIENT_SESSION_ID = `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

// کانال محلی BroadcastChannel برای تب‌های باز روی یک مرورگر
let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel('ra_audit_sync_bus');
  }
} catch (e) {
  console.warn('BroadcastChannel not supported in this environment', e);
}

// لیست شنوندگان تغییرات در اپلیکیشن
const listeners = new Set<(message: RealtimeMessage) => void>();

// راه‌اندازی و اتصال به شنونده‌های محلی
if (broadcastChannel) {
  broadcastChannel.onmessage = (event) => {
    try {
      const msg: RealtimeMessage = event.data;
      if (msg && msg.senderId !== CLIENT_SESSION_ID) {
        listeners.forEach((fn) => fn(msg));
      }
    } catch (err) {
      console.error('Error handling BroadcastChannel message:', err);
    }
  };
}

// فال‌بک رویداد storage در صورت عدم پشتیبانی یا هماهنگی بیشتر بین پنجره‌ها
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === 'ra_audit_cross_tab_event' && event.newValue) {
      try {
        const msg: RealtimeMessage = JSON.parse(event.newValue);
        if (msg && msg.senderId !== CLIENT_SESSION_ID) {
          listeners.forEach((fn) => fn(msg));
        }
      } catch (e) {
        // ignore
      }
    }
  });

  // ۴. اتصال بلادرنگ به استریم سرور دیتابیس مرکزی (Server-Sent Events)
  let sseEventSource: EventSource | null = null;
  function connectServerSSE() {
    try {
      // Vercel Functions are not a reliable long-lived SSE host; use Supabase Realtime / polling fallbacks there.
      if (import.meta.env.VERCEL || import.meta.env.PROD) return;
      if (typeof window === 'undefined' || !window.EventSource) return;
      if (sseEventSource) {
        sseEventSource.close();
      }

      sseEventSource = new EventSource('/api/v1/realtime/stream');
      
      sseEventSource.addEventListener('db_update', (e) => {
        try {
          const parsed = JSON.parse(e.data);
          if (parsed && parsed.type) {
            const realtimeMsg: RealtimeMessage = {
              id: `sse_${Date.now()}`,
              type: parsed.type as RealtimeEventType,
              payload: parsed.payload,
              source: 'REMOTE_WEBSOCKET',
              senderId: 'SERVER_DB',
              timestamp: parsed.timestamp || new Date().toISOString(),
            };
            listeners.forEach((fn) => fn(realtimeMsg));
          }
        } catch (err) {
          console.debug('Failed to parse SSE db_update:', err);
        }
      });

      sseEventSource.onerror = () => {
        if (sseEventSource) {
          sseEventSource.close();
          sseEventSource = null;
        }
        // تلاش مجدد بعد از ۵ ثانیه
        setTimeout(connectServerSSE, 5000);
      };
    } catch (e) {
      console.debug('SSE initialization skipped:', e);
    }
  }

  // راه‌اندازی ارتباط بلادرنگ پس از بارگذاری صفحه
  if (!import.meta.env.VERCEL && !import.meta.env.PROD) {
    setTimeout(connectServerSSE, 1000);
  }
}

/**
 * ارسال رخداد تغییرات به سایر تب‌ها و سیستم‌های باز
 */
export function broadcastSyncEvent(type: RealtimeEventType, payload?: any) {
  const message: RealtimeMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type,
    payload,
    source: 'LOCAL_TAB',
    senderId: CLIENT_SESSION_ID,
    timestamp: new Date().toISOString(),
  };

  // ۱. ارسال به تب‌های باز همان مرورگر
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(message);
    } catch (e) {
      console.warn('Failed to postMessage on BroadcastChannel', e);
    }
  }

  // ۲. ارسال از طریق storage event
  try {
    localStorage.setItem('ra_audit_cross_tab_event', JSON.stringify(message));
  } catch (e) {
    // ignore
  }

  // ۳. ارسال به سرور مرکزی جهت بازپخش به کلیه کلاینت‌های متصل از طریق SSE
  try {
    fetch('/api/v1/realtime/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload }),
    }).catch(() => {});
  } catch (e) {
    // ignore
  }

  // ۳. ارسال از طریق Supabase Realtime Broadcast در صورت اتصال به دیتابیس
  if (isSupabaseReady()) {
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        const channel = supabase.channel('ra_audit_realtime_broadcast');
        channel.send({
          type: 'broadcast',
          event: type,
          payload: {
            ...message,
            source: 'REMOTE_WEBSOCKET',
          },
        }).catch((err) => {
          // Non-blocking log
          console.debug('Realtime broadcast dispatch:', err);
        });
      }
    } catch (err) {
      console.debug('Supabase realtime broadcast skipped:', err);
    }
  }
}

/**
 * ثبت‌نام شنونده برای دریافت تغییرات اعمال شده در سایر سیستم‌ها یا تب‌ها
 */
export function subscribeToRealtimeSync(listener: (message: RealtimeMessage) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * اتصال به اشتراک تغییرات دیتابیس Supabase Realtime (Postgres Changes)
 * برای مطلع شدن لحظه‌ای از تغییرات سیستم‌های دیگر در شبکه
 */
let supabaseRealtimeSubscribed = false;

export function initSupabasePostgresSubscription(onRemoteDbChange: (table: string, eventType: string, record: any) => void) {
  if (supabaseRealtimeSubscribed || !isSupabaseReady()) return;

  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    const channel = supabase
      .channel('ra_audit_db_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inspection_records' },
        (payload) => {
          onRemoteDbChange('inspection_records', payload.eventType, payload.new || payload.old);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'offices' },
        (payload) => {
          onRemoteDbChange('offices', payload.eventType, payload.new || payload.old);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        (payload) => {
          onRemoteDbChange('notifications', payload.eventType, payload.new || payload.old);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'audit_campaigns' },
        (payload) => {
          onRemoteDbChange('audit_campaigns', payload.eventType, payload.new || payload.old);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          supabaseRealtimeSubscribed = true;
          console.info('📡 Supabase Realtime WebSocket successfully connected for all tables.');
        }
      });

    return () => {
      supabase.removeChannel(channel);
      supabaseRealtimeSubscribed = false;
    };
  } catch (err) {
    console.warn('Could not initialize Supabase Realtime subscription:', err);
  }
}

/**
 * خلاصه وضعیت معماری جریان داده برای نمایش در UI
 */
export function getDataFlowArchitectureStatus() {
  const isCloudConnected = isSupabaseReady();
  const hasBroadcastChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window;

  return {
    clientSessionId: CLIENT_SESSION_ID,
    storageType: 'Hybrid (LocalStorage Cache v2 + Supabase PostgreSQL)',
    localBusStatus: hasBroadcastChannel ? 'ACTIVE (BroadcastChannel API)' : 'ACTIVE (Storage Event Fallback)',
    remoteBusStatus: isCloudConnected ? 'CONNECTED (Supabase WebSocket / Realtime)' : 'OFFLINE (Local Standalone)',
    readPath: [
      '۱. بارگذاری آنی از کش سریع مرورگر (LocalStorage v2) جهت پاسخ‌دهی بدون تاخیر (Latency 0ms)',
      '۲. همگام‌سازی پس‌زمینه (Background Hydration) از جداول رابطه‌ای PostgreSQL دیتابیس Supabase',
      '۳. اعمال فیلترهای استانی و نقشی به تفکیک کارشناس یا مدیر دفتر',
    ],
    writePath: [
      '۱. اعتبارسنجی ورودی کاربر در لایه کامپوننت و اعمال تغییر در استیت ری‌اکت (Optimistic Update)',
      '۲. ذخیره‌سازی فوری در حافظه کلاینت (Local Persistence)',
      '۳. فراخوانی سرویس خودکار autoSyncService جهت ارسال به سرور از طریق PostgREST API یا Backend',
      '۴. ثبت وقایع دسترسی و ممیزی (Access Logs & Audit Timeline)',
    ],
    broadcastPath: [
      '۱. اطلاع‌رسانی به تب‌های باز در یک سیستم: ارسال رویداد بلادرنگ از طریق BroadcastChannel',
      '۲. اطلاع‌رسانی به سیستم‌های دیگر در شبکه: انتشار رویداد از طریق WebSocket کانال Supabase Realtime',
      '۳. بازسازی استیت در سایر سیستم‌ها بدون نیاز به رفرش دستی صفحه',
    ],
  };
}
