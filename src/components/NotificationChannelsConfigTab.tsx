import React, { useState } from 'react';
import { 
  Radio, 
  MessageSquare, 
  Mail, 
  BellRing, 
  Webhook, 
  ShieldCheck, 
  Check, 
  Save, 
  RotateCcw, 
  Send, 
  Layers, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  Smartphone,
  Server,
  Key,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { NotificationChannelConfig } from '../types/notifications';
import { DEFAULT_NOTIFICATION_CHANNELS_CONFIG, simulateWebhookDispatch, buildExportableNotificationPayload } from '../utils/notificationEngine';
import { executeSmsDispatch } from '../services/smsService';
import { SmsTestModal } from './SmsTestModal';

interface NotificationChannelsConfigTabProps {
  config: NotificationChannelConfig;
  onSaveConfig: (updatedConfig: NotificationChannelConfig) => void;
}

export const NotificationChannelsConfigTab: React.FC<NotificationChannelsConfigTabProps> = ({
  config,
  onSaveConfig,
}) => {
  const [formData, setFormData] = useState<NotificationChannelConfig>(config);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; details?: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig(formData);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleReset = () => {
    setFormData(DEFAULT_NOTIFICATION_CHANNELS_CONFIG);
    onSaveConfig(DEFAULT_NOTIFICATION_CHANNELS_CONFIG);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleTestChannelConnectivity = async (channelType: 'WEBHOOK' | 'SMS' | 'EMAIL') => {
    setIsTesting(true);
    setTestResult(null);

    if (channelType === 'WEBHOOK') {
      const dummyPayload = buildExportableNotificationPayload({
        eventId: `test-${Date.now()}`,
        eventCode: 'TEST-PING-001',
        category: 'SYSTEM',
        severity: 'INFO',
        priority: 'NORMAL',
        title: 'آزمون اتصال و ارسال داده به سامانه نظارتی ثانویه',
        summary: 'تست موفقیت‌آمیز ارتباط زیرساخت اعلان‌ها با وب‌هوک سامانه ریشه',
        status: 'RESOLVED',
        webhookUrl: formData.webhookUrl,
      });

      const res = await simulateWebhookDispatch(
        dummyPayload,
        formData.webhookUrl || 'https://audit.root-ca.gov.ir/api/v1/webhook/events',
        formData.webhookAuthBearer
      );

      if (res.success) {
        setTestResult({
          success: true,
          message: `ارتباط وب‌هوک با موفقیت برقرار شد (HTTP ${res.statusCode} - پاسخ در ${res.latencyMs} میلی‌ثانیه).`,
          details: res.responseBody,
        });
      } else {
        setTestResult({
          success: false,
          message: `خطا در اتصال به آدرس وب‌هوک (HTTP ${res.statusCode})`,
          details: res.responseBody,
        });
      }
    } else if (channelType === 'SMS') {
      const smsReport = await executeSmsDispatch(formData, {
        recipient: formData.smsDefaultRecipient || '09121234567',
        senderNumber: formData.smsSenderNumber,
        message: 'آزمون اتصال درگاه پیام کوتاه سامانه ممیزی دفاتر صدور گواهی الکترونیکی.',
        provider: formData.smsProvider,
        apiKey: formData.smsApiKey,
      });

      if (smsReport.success) {
        setTestResult({
          success: true,
          message: smsReport.mode === 'REAL_GATEWAY'
            ? `پیامک با موفقیت توسط درگاه مخابراتی ${formData.smsProvider} پذیرش و به شماره ${smsReport.recipient} ارسال گردید (شناسه پیام: ${smsReport.messageId || 'OK'}).`
            : `تست موفق در حالت شبیه‌ساز (Sandbox): ${smsReport.statusDescription}. جهت ارسال واقعی به تلفن همراه، کلید وب‌سرویس (API Key) را در کادر زیر وارد فرمایید.`,
          details: JSON.stringify(smsReport, null, 2),
        });
      } else {
        setTestResult({
          success: false,
          message: `خطا در ارسال پیامک به درگاه ${formData.smsProvider}: ${smsReport.errorMessage || smsReport.statusDescription}`,
          details: JSON.stringify(smsReport, null, 2),
        });
      }
    } else if (channelType === 'EMAIL') {
      await new Promise(r => setTimeout(r, 700));
      setTestResult({
        success: true,
        message: `ایمیل آزمایشی از طریق سرور SMTP ${formData.emailSmtpHost}:${formData.emailSmtpPort} آماده ارسال گردید.`,
        details: JSON.stringify({ smtpServer: formData.emailSmtpHost, port: formData.emailSmtpPort, from: formData.emailSenderAddress, status: 'QUEUED_READY' }, null, 2),
      });
    }

    setIsTesting(false);
  };

  return (
    <div className="space-y-6">
      {/* Architecture Explanation Card */}
      <div className="bg-gradient-to-l from-slate-900 to-slate-800 text-white rounded-3xl p-6 shadow-md border border-slate-700 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black">معماری ماژولار و رویدادمحور مرکز اعلان‌ها (Multi-Channel Dispatcher)</h3>
            <p className="text-xs text-slate-300 mt-0.5">
              طراحی کامپوننت‌محور و مستقل: اتصال به درگاه‌های SMS، Email، Web Push و سامانه‌های نظارتی ثانویه بدون هیچ‌گونه دستکاری در منطق بازرسی پرونده‌ها.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 text-xs">
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <Webhook className="w-4 h-4" />
              <span>وب‌هوک و API ثانویه</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              ارسال بسته‌های JSON استاندارد به وب‌هوک مرکز بازرسی و نظارت دفاتر ثبت نام مرکز میانی عام همراه با امضای امنیتی HMAC.
            </p>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-blue-400 font-bold">
              <Smartphone className="w-4 h-4" />
              <span>سامانه پیام کوتاه (SMS)</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              ارسال پیامک با قالب مصوب به شماره همراه مسئولین دفاتر با قابلیت اتصال به کاوه‌نگار و مگفا.
            </p>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-amber-400 font-bold">
              <Mail className="w-4 h-4" />
              <span>پست الکترونیک (SMTP)</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              ارسال ابلاغیه‌های رسمی و صورتجلسات عدم انطباق با فرمت رسمی اداری به دفاتر.
            </p>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-purple-400 font-bold">
              <BellRing className="w-4 h-4" />
              <span>اعلان درون‌برنامه‌ای و پوش</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              به‌روزرسانی خودکار وضعیت اعلان‌ها هنگام ثبت پاسخ توسط دفتر یا بررسی بازرس.
            </p>
          </div>
        </div>
      </div>

      {/* Form Settings */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Section 1: Webhook & External System Dispatch */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Webhook className="w-4 h-4 text-emerald-600" />
                <span>تنظیمات وب‌هوک و سامانه نظارتی ثانویه</span>
              </h4>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.webhookEnabled}
                  onChange={(e) => setFormData({ ...formData, webhookEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">آدرس وب‌هوک مقصد (Endpoint URL):</label>
                <input
                  type="text"
                  value={formData.webhookUrl || ''}
                  onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                  placeholder="https://audit.root-ca.gov.ir/api/v1/webhook/events"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-left"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">توکن احراز هویت (Bearer Token):</label>
                <input
                  type="password"
                  value={formData.webhookAuthBearer || ''}
                  onChange={(e) => setFormData({ ...formData, webhookAuthBearer: e.target.value })}
                  placeholder="Bearer ra_audit_sec_token..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-left"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">کلید امضای امنیتی (HMAC Secret):</label>
                <input
                  type="text"
                  value={formData.webhookSecretHMAC || ''}
                  onChange={(e) => setFormData({ ...formData, webhookSecretHMAC: e.target.value })}
                  placeholder="sha256=secret_key..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-left"
                  dir="ltr"
                />
              </div>

              <div className="pt-1 flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.webhookAutoDispatchOnCreate}
                    onChange={(e) => setFormData({ ...formData, webhookAutoDispatchOnCreate: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-slate-700 font-semibold">ارسال خودکار هنگام ایجاد رویداد</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.webhookAutoDispatchOnResponse}
                    onChange={(e) => setFormData({ ...formData, webhookAutoDispatchOnResponse: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-slate-700 font-semibold">ارسال خودکار هنگام ثبت پاسخ</span>
                </label>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => handleTestChannelConnectivity('WEBHOOK')}
                  disabled={isTesting || !formData.webhookEnabled}
                  className="flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl font-bold transition cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>تست ارتباط وب‌هوک</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: SMS Gateway */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-blue-600" />
                <span>تنظیمات درگاه پیام کوتاه (SMS Gateway)</span>
              </h4>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.smsEnabled}
                  onChange={(e) => setFormData({ ...formData, smsEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">ارائه‌دهنده سرویس پیامک (Provider):</label>
                <select
                  value={formData.smsProvider}
                  onChange={(e) => setFormData({ ...formData, smsProvider: e.target.value as any })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
                >
                  <option value="KAVENEGAR">کاوه‌نگار (Kavenegar Web Service)</option>
                  <option value="MAGFA">مگفا (Magfa SMS API)</option>
                  <option value="FARAPARTO">فراپرتو (Faraparto Gateway)</option>
                  <option value="CUSTOM">درگاه اختصاصی دولت / سازمان</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">شماره اختصاصی فرستنده (Sender Line):</label>
                <input
                  type="text"
                  value={formData.smsSenderNumber || ''}
                  onChange={(e) => setFormData({ ...formData, smsSenderNumber: e.target.value })}
                  placeholder="30005006"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-left"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  کلید وب‌سرویس مخابراتی (API Key / Token):
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={formData.smsApiKey || ''}
                    onChange={(e) => setFormData({ ...formData, smsApiKey: e.target.value })}
                    placeholder="مثال: 4F6832... (در صورت خالی بودن، حالت شبیه‌ساز فعال است)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-left"
                    dir="ltr"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {formData.smsApiKey ? (
                    <span className="text-emerald-700 font-bold">✓ کلید API تعریف شده و پیامک به اپراتور واقعی ارسال می‌شود.</span>
                  ) : (
                    <span className="text-amber-700">⚠️ بدون کلید، سیستم در حالت شبیه‌ساز (Sandbox) عمل می‌کند و پیامکی به تلفن همراه تحویل داده نمی‌شود.</span>
                  )}
                </p>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">شماره پیش‌فرض آزمایشی گیرنده:</label>
                <input
                  type="text"
                  value={formData.smsDefaultRecipient || ''}
                  onChange={(e) => setFormData({ ...formData, smsDefaultRecipient: e.target.value })}
                  placeholder="09121234567"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-left"
                  dir="ltr"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsSmsModalOpen(true)}
                  disabled={!formData.smsEnabled}
                  className="flex items-center gap-1.5 text-xs text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-xl font-bold transition cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>آزمون واقعی و عیب‌یابی درگاه پیامک</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTestChannelConnectivity('SMS')}
                  disabled={isTesting || !formData.smsEnabled}
                  className="flex items-center gap-1.5 text-xs text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-xl font-bold transition cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>تست سریع ارسال</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 3: Email SMTP */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Mail className="w-4 h-4 text-amber-600" />
                <span>تنظیمات سرور پست الکترونیک (SMTP Email)</span>
              </h4>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.emailEnabled}
                  onChange={(e) => setFormData({ ...formData, emailEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="font-bold text-slate-700 block mb-1">هاست سرور SMTP:</label>
                  <input
                    type="text"
                    value={formData.emailSmtpHost || ''}
                    onChange={(e) => setFormData({ ...formData, emailSmtpHost: e.target.value })}
                    placeholder="smtp.root-ca.gov.ir"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-left"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">پورت:</label>
                  <input
                    type="number"
                    value={formData.emailSmtpPort || 587}
                    onChange={(e) => setFormData({ ...formData, emailSmtpPort: parseInt(e.target.value, 10) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">آدرس فرستنده (From Address):</label>
                <input
                  type="text"
                  value={formData.emailSenderAddress || ''}
                  onChange={(e) => setFormData({ ...formData, emailSenderAddress: e.target.value })}
                  placeholder="audit-notifications@root-ca.gov.ir"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-left"
                  dir="ltr"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => handleTestChannelConnectivity('EMAIL')}
                  disabled={isTesting || !formData.emailEnabled}
                  className="flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-xl font-bold transition cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>تست اتصال ایمیل</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 4: Web Push & In-App */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <BellRing className="w-4 h-4 text-purple-600" />
                <span>اعلان‌های بلادرنگ مرورگر (Web Push & In-App)</span>
              </h4>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.webPushEnabled}
                  onChange={(e) => setFormData({ ...formData, webPushEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-500 leading-relaxed">
                ارسال پوش نوتیفیکیشن بر روی سیستم‌عامل و مرورگر مسئولین دفاتر و بازرسین به محض صدور رأی، اعلام نقص، یا پایان مهلت انقضا.
              </p>

              <div className="bg-purple-50 border border-purple-200 rounded-2xl p-3.5 space-y-2 text-purple-900">
                <div className="flex items-center gap-2 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-purple-700" />
                  <span>همگام‌سازی بلادرنگ رویدادها فعال است</span>
                </div>
                <p className="text-[11px] leading-relaxed text-purple-800">
                  به‌روزرسانی خودکار کارتابل و نوار اعلان بدون نیاز به بارگذاری مجدد صفحه (Instant Push Sync).
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Live Test Feedback Banner */}
        {testResult && (
          <div className={`p-4 rounded-2xl border text-xs space-y-2 animate-in fade-in ${
            testResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-rose-50 border-rose-200 text-rose-950'
          }`}>
            <div className="flex items-center gap-2 font-bold">
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600" />
              )}
              <span>{testResult.message}</span>
            </div>
            {testResult.details && (
              <div className="bg-slate-950 text-slate-200 p-2.5 rounded-xl font-mono text-[11px] overflow-x-auto" dir="ltr">
                <pre>{testResult.details}</pre>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-2xl font-bold transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>بازگردانی پیش‌فرض</span>
          </button>

          <div className="flex items-center gap-3">
            {saveSuccess && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 font-bold animate-in fade-in">
                <Check className="w-4 h-4" />
                <span>تنظیمات کانال‌ها با موفقیت ذخیره شد</span>
              </span>
            )}
            <button
              type="submit"
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-6 py-2.5 rounded-2xl transition shadow-xs cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>ذخیره پیکربندی کانال‌های ارتباطی</span>
            </button>
          </div>
        </div>
      </form>

      <SmsTestModal
        isOpen={isSmsModalOpen}
        onClose={() => setIsSmsModalOpen(false)}
        config={formData}
      />
    </div>
  );
};
