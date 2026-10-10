import React, { useState } from 'react';
import { 
  Smartphone, 
  X, 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle, 
  Server, 
  Key, 
  PhoneCall, 
  ShieldCheck,
  RefreshCw,
  Code2
} from 'lucide-react';
import { NotificationChannelsConfig } from '../types/notifications';
import { executeSmsDispatch, SmsDispatchReport, validateIranianMobile } from '../services/smsService';

interface SmsTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: Partial<NotificationChannelsConfig>;
}

export const SmsTestModal: React.FC<SmsTestModalProps> = ({
  isOpen,
  onClose,
  config,
}) => {
  const [recipient, setRecipient] = useState<string>(() => config.smsDefaultRecipient || '09120000000');
  const [senderNumber, setSenderNumber] = useState<string>(() => config.smsSenderNumber || '10008585');
  const [message, setMessage] = useState<string>(
    'آزمون زیرساخت پیام‌رسانی سامانه ممیزی و بازرسی دفاتر صدور گواهی الکترونیکی. شناسه تست: ' + Math.floor(10000 + Math.random() * 90000)
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [report, setReport] = useState<SmsDispatchReport | null>(null);
  const [showRawJson, setShowRawJson] = useState<boolean>(false);

  if (!isOpen) return null;

  const hasApiKey = Boolean(config.smsApiKey && config.smsApiKey.trim().length > 0);

  const handleExecuteTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setReport(null);

    try {
      const result = await executeSmsDispatch(config, {
        recipient,
        senderNumber,
        message,
        provider: config.smsProvider,
        apiKey: config.smsApiKey,
      });
      setReport(result);
    } catch (err: any) {
      setReport({
        success: false,
        mode: hasApiKey ? 'REAL_GATEWAY' : 'SANDBOX_SIMULATION',
        provider: config.smsProvider || 'KAVENEGAR',
        recipient,
        senderNumber,
        sentAt: new Date().toLocaleTimeString('fa-IR'),
        statusDescription: 'خطای سیستمی غیرمنتظره',
        errorMessage: err.message || String(err),
        diagnostics: ['بروز خطا در اسکریپت ارسال: ' + (err.message || err)],
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden animate-in zoom-in-95 my-4">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-l from-blue-50 via-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                آزمون واقعی و عیب‌یابی درگاه پیام کوتاه (SMS Test & Diagnostic)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                بررسی خط ارتباطی با اپراتور و تست تفکیک‌شده ارسال واقعی یا شبیه‌ساز (Sandbox)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleExecuteTest} className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {/* Provider & API Key Status Banner */}
          <div className={`p-4 rounded-2xl border text-xs space-y-2 ${
            hasApiKey 
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950' 
              : 'bg-amber-50 border-amber-300 text-amber-950'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-black">
                {hasApiKey ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                )}
                <span>درگاه انتخابی: {config.smsProvider || 'KAVENEGAR (کاوه‌نگار)'}</span>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                hasApiKey 
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                  : 'bg-amber-100 text-amber-800 border-amber-300'
              }`}>
                {hasApiKey ? 'آماده ارسال واقعی' : 'حالت شبیه‌ساز (Mock Sandbox)'}
              </span>
            </div>

            <p className="text-[11px] leading-relaxed">
              {hasApiKey ? (
                <span>
                  کلید وب‌سرویس مخابراتی تعریف شده است. درخواست با فشردن دکمه زیر به سرورهای اپراتور پیامک ارسال می‌شود و در صورت داشتن شارژ، پیامک واقعی به گوشی تلفن خواهد رسید.
                </span>
              ) : (
                <span>
                  <strong>دلیل شبیه‌سازی:</strong> کلید وب‌سرویس (API Key) وارد نشده است! به همین دلیل سامانه تست را در حالت مجازی (Sandbox) اجرا می‌کند تا فرآیند بدون شکست تست شود. برای دریافت پیامک روی تلفن همراه، کلید وب‌سرویس اختصاصی پنل پیامک را در تب تنظیمات کانال‌ها وارد نمایید.
                </span>
              )}
            </p>
          </div>

          {/* Input Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="text-xs font-black text-slate-800 block mb-1">
                شماره گیرنده آزمایشی <span className="text-rose-500">*</span>:
              </label>
              <input
                type="text"
                required
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="09121234567"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-mono text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="text-xs font-black text-slate-800 block mb-1">
                شماره خط فرستنده (اختصاصی / خدماتی):
              </label>
              <input
                type="text"
                value={senderNumber}
                onChange={(e) => setSenderNumber(e.target.value)}
                placeholder="10008585"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-mono text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Message Text */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-black text-slate-800">
                متن پیامک ارسالی:
              </label>
              <span className="text-[11px] text-slate-500 font-mono">
                {message.length} کاراکتر (بخش {Math.ceil(message.length / 70) || 1} پیامک فارسی)
              </span>
            </div>
            <textarea
              rows={3}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          {/* Execute Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-2xl text-xs font-black text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition shadow-md shadow-blue-600/20 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>در حال ارسال به درگاه...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>
                    {hasApiKey ? 'ارسال واقعی پیامک به تلفن همراه' : 'اجرای تست اعتبارسنجی (شبیه‌ساز)'}
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Test Diagnostic Result */}
          {report && (
            <div className={`p-4 rounded-2xl border space-y-3 animate-in fade-in ${
              report.success 
                ? 'bg-slate-900 text-white border-slate-700' 
                : 'bg-rose-950 text-white border-rose-800'
            }`}>
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center gap-2 text-xs font-black">
                  {report.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                  )}
                  <span>نتیجه آزمون: {report.statusDescription}</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  report.mode === 'REAL_GATEWAY' 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {report.mode === 'REAL_GATEWAY' ? 'ارسال به اپراتور واقعی' : 'شبیه‌سازی شبیه‌ساز (Sandbox)'}
                </span>
              </div>

              {report.errorMessage && (
                <div className="p-2.5 rounded-xl bg-rose-900/60 border border-rose-700 text-xs text-rose-200">
                  <strong>علت خطا:</strong> {report.errorMessage}
                </div>
              )}

              {/* Diagnostic Checklist */}
              <div className="space-y-1 text-xs text-slate-300">
                <span className="font-bold text-slate-200 text-[11px] block">گزارش گام‌به‌گام دیاگنوستیک:</span>
                {report.diagnostics.map((diag, idx) => (
                  <div key={idx} className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="text-teal-400">›</span>
                    <span>{diag}</span>
                  </div>
                ))}
              </div>

              {/* Meta details */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-white/10 text-[11px] text-slate-300 font-mono">
                <div>گیرنده: {report.recipient}</div>
                <div>فرستنده: {report.senderNumber}</div>
                <div>شناسه رهگیری: {report.messageId || 'MOCK'}</div>
              </div>

              {/* Toggle Raw JSON */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>{showRawJson ? 'مخفی‌سازی پاسخ خام درگاه' : 'مشاهده بسته پاسخ خام درگاه (Raw Response)'}</span>
                </button>

                {showRawJson && (
                  <pre className="mt-2 p-3 bg-black/50 border border-white/10 rounded-xl text-[10px] text-emerald-400 font-mono overflow-x-auto max-h-40">
                    {JSON.stringify(report.rawResponse, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition cursor-pointer"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};
