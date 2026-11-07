import React, { useState, useMemo } from 'react';
import { 
  X, 
  Code2, 
  Copy, 
  Check, 
  Send, 
  Radio, 
  ShieldCheck, 
  ExternalLink, 
  Terminal, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  Layers,
  FileJson,
  Smartphone,
  Mail,
  SlidersHorizontal
} from 'lucide-react';
import { AppNotification, NotificationChannelConfig } from '../types/notifications';
import { simulateWebhookDispatch } from '../utils/notificationEngine';
import { 
  loadNotificationTemplates, 
  renderTemplateText, 
  calculateSmsMetrics 
} from '../services/notificationTemplateService';

interface NotificationPayloadInspectorModalProps {
  notification: AppNotification | null;
  channelConfig: NotificationChannelConfig;
  onClose: () => void;
}

export const NotificationPayloadInspectorModal: React.FC<NotificationPayloadInspectorModalProps> = ({
  notification,
  channelConfig,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'JSON' | 'SMS' | 'EMAIL' | 'CURL' | 'DISPATCH_TEST'>('JSON');
  const [copied, setCopied] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<{
    success: boolean;
    statusCode: number;
    responseBody: string;
    latencyMs: number;
  } | null>(null);

  if (!notification) return null;

  const templates = useMemo(() => loadNotificationTemplates(), []);
  const matchedTemplate = useMemo(() => {
    return templates.find(t => t.category === notification.category) || templates[0];
  }, [templates, notification.category]);

  const templateVars = useMemo(() => {
    return {
      office_name: notification.officeName || 'دفتر ثبت‌نام',
      office_code: notification.officeCode || '0',
      campaign_title: notification.metadata?.campaignTitle || 'دوره ممیزی دوره‌ای',
      samples_count: String(notification.metadata?.sampleSize || 5),
      deadline: notification.expiresAt || 'مهلت مقرر',
      tracking_code: notification.metadata?.trackingCode || notification.eventCode,
      applicant_name: notification.metadata?.applicantName || 'متقاضی گواهی',
      defects_summary: notification.metadata?.defectsList?.join('، ') || notification.message,
      suspension_days: String(notification.metadata?.suspensionDays || 15),
      suspension_reason: notification.message || 'عدم انطباق در ممیزی',
      remaining_hours: '۲۴',
      action_url: window.location.origin,
    };
  }, [notification]);

  const renderedSms = useMemo(() => {
    return renderTemplateText(matchedTemplate.smsTemplate, templateVars);
  }, [matchedTemplate, templateVars]);

  const renderedEmailSubject = useMemo(() => {
    return renderTemplateText(matchedTemplate.emailSubject, templateVars);
  }, [matchedTemplate, templateVars]);

  const renderedEmailBody = useMemo(() => {
    return renderTemplateText(matchedTemplate.emailBodyHtml, templateVars);
  }, [matchedTemplate, templateVars]);

  const smsMetrics = useMemo(() => {
    return calculateSmsMetrics(renderedSms);
  }, [renderedSms]);

  const payloadJson = JSON.stringify(notification.exportablePayload, null, 2);

  const curlCommand = `curl -X POST "${channelConfig.webhookUrl || 'https://audit.root-ca.gov.ir/api/v1/webhook/events'}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: ${channelConfig.webhookAuthBearer || 'Bearer ra_audit_sec_token'}" \\
  -H "X-RA-Signature: ${notification.exportablePayload.dispatchInfo.signatureHMAC || 'sha256=...'}" \\
  -d '${JSON.stringify(notification.exportablePayload)}'`;

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleTestDispatch = async () => {
    setIsSending(true);
    setDispatchResult(null);
    try {
      const result = await simulateWebhookDispatch(
        notification.exportablePayload,
        channelConfig.webhookUrl || 'https://audit.root-ca.gov.ir/api/v1/webhook/events',
        channelConfig.webhookAuthBearer
      );
      setDispatchResult(result);
    } catch (err: any) {
      setDispatchResult({
        success: false,
        statusCode: 500,
        responseBody: JSON.stringify({ error: err.message || 'خطا در برقراری ارتباط' }, null, 2),
        latencyMs: 0,
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 my-6 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileJson className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold">ساختار استاندارد اعلان (Payload Inspector)</h3>
                <span className="text-[11px] font-mono bg-emerald-900/80 text-emerald-300 px-2.5 py-0.5 rounded-lg border border-emerald-700/50">
                  {notification.eventCode}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                قالب داده ساخت‌یافته و استاندارد جهت نمایش یا ارسال مستقیم به وب‌هوک و سامانه نظارتی ثانویه
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Subheader & Tabs */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 p-1 rounded-2xl flex-wrap">
            <button
              onClick={() => setActiveTab('JSON')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'JSON'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>داده ساختاریافته (JSON)</span>
            </button>

            <button
              onClick={() => setActiveTab('SMS')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'SMS'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5 text-blue-400" />
              <span>متن پیامک (SMS)</span>
            </button>

            <button
              onClick={() => setActiveTab('EMAIL')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'EMAIL'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Mail className="w-3.5 h-3.5 text-amber-400" />
              <span>ابلاغیه ایمیل (Email)</span>
            </button>

            <button
              onClick={() => setActiveTab('CURL')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'CURL'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>دستور cURL</span>
            </button>

            <button
              onClick={() => setActiveTab('DISPATCH_TEST')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'DISPATCH_TEST'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>تست زنده وب‌هوک</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const textToCopy = 
                  activeTab === 'CURL' ? curlCommand : 
                  activeTab === 'SMS' ? renderedSms : 
                  activeTab === 'EMAIL' ? renderedEmailSubject + '\n\n' + renderedEmailBody : 
                  payloadJson;
                handleCopy(textToCopy, activeTab);
              }}
              className="flex items-center gap-1.5 text-xs font-bold bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 px-3 py-1.5 rounded-xl transition shadow-2xs cursor-pointer"
            >
              {copied === activeTab ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600">کپی شد!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>کپی محتوا</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {activeTab === 'JSON' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  نسخه شمای رویداد: <code className="font-mono text-slate-700">{notification.exportablePayload.version}</code>
                </span>
                <span>اندازه بسته: <strong className="font-mono text-slate-800">{payloadJson.length} کاراکتر</strong></span>
              </div>
              <div className="bg-slate-950 text-emerald-400 p-4 rounded-2xl font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800 shadow-inner" dir="ltr">
                <pre>{payloadJson}</pre>
              </div>
            </div>
          )}

          {activeTab === 'SMS' && (
            <div className="space-y-4">
              <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-bold text-blue-900 block">مشخصات پیامک ارسالی به شماره مسئول دفتر:</span>
                  <span className="text-blue-700 font-mono mt-0.5 inline-block">
                    گیرنده: {notification.metadata?.mobileNumber || channelConfig.smsDefaultRecipient || '۰۹۱۲۱۲۳۴۵۶۷'}
                  </span>
                </div>
                <div className="flex items-center gap-3 font-semibold text-blue-950">
                  <span>طول متن: <strong className="font-mono">{smsMetrics.charCount}</strong> کاراکتر</span>
                  <span className="bg-blue-200/80 px-2 py-0.5 rounded-md font-mono">{smsMetrics.partsCount} پارت SMS</span>
                </div>
              </div>

              {/* Phone Bubble */}
              <div className="bg-slate-100 border border-slate-200 rounded-3xl p-5 max-w-md mx-auto shadow-inner">
                <div className="text-center text-[11px] text-slate-500 pb-2 border-b border-slate-200 mb-3">
                  فرستنده: <strong className="font-mono text-blue-700">{channelConfig.smsSenderNumber || '30005006'}</strong> (مرکز میانی عام)
                </div>
                <div className="bg-white border border-slate-300 rounded-2xl rounded-tr-xs p-4 text-xs sm:text-sm text-slate-800 leading-relaxed shadow-xs whitespace-pre-wrap">
                  {renderedSms}
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 px-1">
                  <span>تحویل به شبکه مخابراتی</span>
                  <span>کد پترن: {matchedTemplate.smsPatternCode || 'CUSTOM'}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'EMAIL' && (
            <div className="space-y-4">
              <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-950 space-y-1">
                <div>
                  <span className="font-bold">موضوع رسمی ایمیل: </span>
                  <span className="font-semibold">{renderedEmailSubject}</span>
                </div>
                <div className="text-amber-800 text-[11px]">
                  فرستنده: <code className="font-mono">{channelConfig.emailSenderAddress || 'audit-notifications@root-ca.gov.ir'}</code> | گیرنده: <code className="font-mono">{notification.metadata?.email || channelConfig.emailDefaultRecipient || 'office@notary.ir'}</code>
                </div>
              </div>

              {/* Rendered HTML Container */}
              <div 
                className="p-4 bg-slate-50 border border-slate-200 rounded-2xl max-h-[460px] overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: renderedEmailBody }}
              />
            </div>
          )}

          {activeTab === 'CURL' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                این دستور را می‌توانید مستقیماً در ترمینال سرور یا ابزارهای تست API مانند Postman و Insomnia برای ارسال رویداد به وب‌هوک سامانه مقصد اجرا کنید:
              </p>
              <div className="bg-slate-950 text-blue-300 p-4 rounded-2xl font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800 shadow-inner" dir="ltr">
                <pre>{curlCommand}</pre>
              </div>
            </div>
          )}

          {activeTab === 'DISPATCH_TEST' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-900 flex items-center gap-2">
                    <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
                    <span>شبیه‌ساز ارسال آنی به وب‌هوک سامانه نظارتی ثانویه</span>
                  </h4>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                    Webhook Dispatcher
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-slate-600 block mb-1 font-bold">آدرس وب‌هوک مقصد (Endpoint):</label>
                    <input
                      type="text"
                      readOnly
                      value={channelConfig.webhookUrl || 'https://audit.root-ca.gov.ir/api/v1/webhook/events'}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800"
                      dir="ltr"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end">
                    <button
                      onClick={handleTestDispatch}
                      disabled={isSending}
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {isSending ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>در حال ارسال بسته به سامانه مقصد...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>ارسال آزمایشی این اعلان به سامانه بیرونی</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {dispatchResult && (
                <div className={`border rounded-2xl p-4 space-y-3 animate-in fade-in ${
                  dispatchResult.success ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {dispatchResult.success ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-rose-600" />
                      )}
                      <h5 className={`text-xs font-black ${
                        dispatchResult.success ? 'text-emerald-950' : 'text-rose-950'
                      }`}>
                        {dispatchResult.success ? 'پاسخ موفق از وب‌هوک سامانه مقصد دریافت شد' : 'خطا در ارسال'}
                      </h5>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className={`px-2 py-0.5 rounded font-bold ${
                        dispatchResult.success ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'
                      }`}>
                        HTTP {dispatchResult.statusCode}
                      </span>
                      <span className="text-slate-500">زمان پاسخ: {dispatchResult.latencyMs}ms</span>
                    </div>
                  </div>

                  <div className="bg-slate-950 text-slate-200 p-3 rounded-xl font-mono text-xs overflow-x-auto" dir="ltr">
                    <pre>{dispatchResult.responseBody}</pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-teal-600" />
            <span>امضای دیجیتال و کنترل یکپارچگی HMAC فعال است</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer"
          >
            بستن پنجره
          </button>
        </div>
      </div>
    </div>
  );
};
