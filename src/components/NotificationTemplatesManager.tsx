import React, { useState, useMemo } from 'react';
import { 
  NotificationMessageTemplate, 
  NotificationCategory, 
  TemplateVariable 
} from '../types/notifications';
import { 
  loadNotificationTemplates, 
  saveNotificationTemplates, 
  resetNotificationTemplatesToDefault, 
  renderTemplateText, 
  calculateSmsMetrics 
} from '../services/notificationTemplateService';
import { 
  MessageSquare, 
  Mail, 
  BellRing, 
  Save, 
  RotateCcw, 
  Sparkles, 
  Check, 
  Smartphone, 
  Eye, 
  Code, 
  HelpCircle, 
  Copy, 
  CheckCircle2, 
  Send,
  FileEdit,
  Tag,
  Laptop
} from 'lucide-react';

interface NotificationTemplatesManagerProps {
  onTemplatesUpdated?: (templates: NotificationMessageTemplate[]) => void;
}

export const NotificationTemplatesManager: React.FC<NotificationTemplatesManagerProps> = ({
  onTemplatesUpdated,
}) => {
  const [templates, setTemplates] = useState<NotificationMessageTemplate[]>(() => loadNotificationTemplates());
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0]?.id || 'tmpl-inspection-action');
  const [activeChannelTab, setActiveChannelTab] = useState<'SMS' | 'EMAIL' | 'IN_APP'>('SMS');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // The active template being edited
  const currentTemplate = useMemo(() => {
    return templates.find(t => t.id === selectedTemplateId) || templates[0];
  }, [templates, selectedTemplateId]);

  // Form draft state for current template
  const [draft, setDraft] = useState<NotificationMessageTemplate>(currentTemplate);

  // Sync draft when template selection changes
  React.useEffect(() => {
    if (currentTemplate) {
      setDraft(currentTemplate);
    }
  }, [currentTemplate]);

  // Dynamic sample variable map for live preview
  const sampleVariablesMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (currentTemplate && currentTemplate.variables) {
      for (const v of currentTemplate.variables) {
        map[v.key] = v.example;
      }
    }
    return map;
  }, [currentTemplate]);

  // Live rendered SMS text
  const renderedSmsText = useMemo(() => {
    return renderTemplateText(draft.smsTemplate, sampleVariablesMap);
  }, [draft.smsTemplate, sampleVariablesMap]);

  // Live rendered Email subject & body
  const renderedEmailSubject = useMemo(() => {
    return renderTemplateText(draft.emailSubject, sampleVariablesMap);
  }, [draft.emailSubject, sampleVariablesMap]);

  const renderedEmailBody = useMemo(() => {
    return renderTemplateText(draft.emailBodyHtml, sampleVariablesMap);
  }, [draft.emailBodyHtml, sampleVariablesMap]);

  // Live rendered In-App
  const renderedInAppTitle = useMemo(() => {
    return renderTemplateText(draft.inAppTitle, sampleVariablesMap);
  }, [draft.inAppTitle, sampleVariablesMap]);

  const renderedInAppMessage = useMemo(() => {
    return renderTemplateText(draft.inAppMessage, sampleVariablesMap);
  }, [draft.inAppMessage, sampleVariablesMap]);

  // SMS metrics
  const smsMetrics = useMemo(() => {
    return calculateSmsMetrics(renderedSmsText);
  }, [renderedSmsText]);

  // Save changes
  const handleSaveChanges = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const updated = templates.map(t => t.id === draft.id ? draft : t);
    setTemplates(updated);
    saveNotificationTemplates(updated);
    if (onTemplatesUpdated) onTemplatesUpdated(updated);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Reset all to default
  const handleResetToDefault = () => {
    if (window.confirm('آیا از بازنشانی کلیه متن‌های پیش‌فرض پیامک، ایمیل و اعلان‌ها به قالب‌های رسمی سامانه اطمینان دارید؟')) {
      const defs = resetNotificationTemplatesToDefault();
      setTemplates(defs);
      const match = defs.find(d => d.id === selectedTemplateId) || defs[0];
      setDraft(match);
      if (onTemplatesUpdated) onTemplatesUpdated(defs);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  // Insert variable tag into active text area
  const insertVariable = (varKey: string, field: 'smsTemplate' | 'emailSubject' | 'emailBodyHtml' | 'inAppTitle' | 'inAppMessage') => {
    const token = `{${varKey}}`;
    setDraft(prev => ({
      ...prev,
      [field]: (prev[field] || '') + token
    }));
  };

  const handleCopyVariable = (varKey: string) => {
    navigator.clipboard.writeText(`{${varKey}}`);
    setCopiedKey(varKey);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 p-0.5 shadow-md shadow-blue-500/10 flex items-center justify-center">
            <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center">
              <FileEdit className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-slate-900">مدیریت قالب‌های متن اعلان (SMS، Email و درون‌برنامه‌ای)</h3>
              <span className="text-xs bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-0.5 rounded-full font-bold">
                ویرایشگر زنده
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              شخصی‌سازی متن‌های ارسالی به دفاتر و بازرسین با قابلیت درج متغیرهای پویا (`{'{office_name}'}`، `{'{deadline}'}` و ...) و مشاهده پیش‌نمایش در موبایل و ایمیل
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetToDefault}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3.5 py-2.5 rounded-2xl font-bold transition cursor-pointer"
            title="بازنشانی تمامی قالب‌ها به مقادیر پیش‌فرض سامانه"
          >
            <RotateCcw className="w-4 h-4" />
            <span>بازگردانی متن‌های پیش‌فرض</span>
          </button>

          <button
            type="button"
            onClick={() => handleSaveChanges()}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2.5 rounded-2xl shadow-xs transition cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>ذخیره تغییرات قالب</span>
          </button>
        </div>
      </div>

      {/* Template Selector Pills */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-xs">
        <span className="text-xs font-bold text-slate-500 block mb-2.5">انتخاب نوع اعلان / رویداد جهت مشاهده و ویرایش متن:</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {templates.map(tmpl => {
            const isSelected = tmpl.id === selectedTemplateId;
            return (
              <button
                key={tmpl.id}
                onClick={() => setSelectedTemplateId(tmpl.id)}
                className={`flex items-start gap-3 p-3 rounded-2xl text-right transition border cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50/80 border-blue-300 text-blue-950 shadow-xs ring-2 ring-blue-500/20'
                    : 'bg-slate-50/70 hover:bg-slate-100/70 border-slate-200 text-slate-700'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                  isSelected ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-black truncate">{tmpl.name}</h4>
                  <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{tmpl.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Workspace: Left = Live Preview, Right = Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* RIGHT COLUMN (7 Cols): Editor and Variables */}
        <div className="lg:col-span-7 space-y-4">
          {/* Channel Selector Tabs */}
          <div className="bg-white border border-slate-200 rounded-3xl p-3 shadow-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveChannelTab('SMS')}
                className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition cursor-pointer ${
                  activeChannelTab === 'SMS'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>قالب پیام کوتاه (SMS)</span>
              </button>

              <button
                onClick={() => setActiveChannelTab('EMAIL')}
                className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition cursor-pointer ${
                  activeChannelTab === 'EMAIL'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Mail className="w-4 h-4" />
                <span>قالب پست الکترونیک (Email)</span>
              </button>

              <button
                onClick={() => setActiveChannelTab('IN_APP')}
                className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition cursor-pointer ${
                  activeChannelTab === 'IN_APP'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <BellRing className="w-4 h-4" />
                <span>اعلان کارتابل (In-App)</span>
              </button>
            </div>

            {saveSuccess && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 font-bold animate-in fade-in">
                <Check className="w-4 h-4" />
                <span>قالب ذخیره شد</span>
              </span>
            )}
          </div>

          {/* Available Dynamic Variables Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-3xl p-4 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>متغیرهای هوشمند قابل استفاده در این رویداد (با کلیک درج یا کپی می‌شود):</span>
              </span>
              <span className="text-[11px] text-slate-400">کپی خودکار تگ</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {draft.variables.map(v => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => {
                    handleCopyVariable(v.key);
                    if (activeChannelTab === 'SMS') insertVariable(v.key, 'smsTemplate');
                    else if (activeChannelTab === 'EMAIL') insertVariable(v.key, 'emailBodyHtml');
                    else insertVariable(v.key, 'inAppMessage');
                  }}
                  className="inline-flex items-center gap-1.5 bg-white hover:bg-blue-50 text-slate-800 hover:text-blue-800 border border-slate-200 hover:border-blue-300 text-xs px-2.5 py-1.5 rounded-xl transition shadow-2xs cursor-pointer group"
                  title={`مقدار نمونه: ${v.example}`}
                >
                  <Tag className="w-3 h-3 text-blue-500" />
                  <span className="font-bold font-mono" dir="ltr">{`{${v.key}}`}</span>
                  <span className="text-[11px] text-slate-500">({v.label})</span>
                  {copiedKey === v.key ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <Copy className="w-3 h-3 text-slate-400 group-hover:text-blue-600" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* EDITOR: SMS CHANNEL */}
          {activeChannelTab === 'SMS' && (
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-slate-900">متن پیامک ارسالی (SMS Template)</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    این پیامک مستقیماً به شماره تلفن همراه مسئول دفتر یا بازرس ارسال می‌گردد.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] bg-slate-100 text-slate-700 px-2 py-1 rounded-lg font-mono">
                    کد پترن: {draft.smsPatternCode || 'N/A'}
                  </span>
                </div>
              </div>

              <div>
                <textarea
                  rows={6}
                  value={draft.smsTemplate}
                  onChange={(e) => setDraft({ ...draft, smsTemplate: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs sm:text-sm text-slate-900 leading-relaxed focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition font-sans"
                  placeholder="متن پیامک را اینجا وارد کنید..."
                />
              </div>

              {/* SMS Metrics Banner */}
              <div className="flex items-center justify-between text-xs bg-slate-50 border border-slate-200 rounded-2xl p-3">
                <div className="flex items-center gap-4">
                  <span>تعداد کاراکتر: <strong className="font-mono text-slate-900">{smsMetrics.charCount}</strong></span>
                  <span>تعداد پارت پیامک: <strong className="font-mono text-blue-600">{smsMetrics.partsCount} پیامک</strong></span>
                  <span>زبان: <strong className="text-slate-700">{smsMetrics.isPersian ? 'فارسی (Unicode)' : 'انگلیسی (GSM)'}</strong></span>
                </div>
                <span className="text-[11px] text-slate-500">مبنا: ۷۰ کاراکتر پارت اول فارسی</span>
              </div>
            </div>
          )}

          {/* EDITOR: EMAIL CHANNEL */}
          {activeChannelTab === 'EMAIL' && (
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
              <div>
                <h4 className="text-sm font-black text-slate-900">قالب نامه الکترونیکی (Email Subject & HTML)</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  ارسال ابلاغیه رسمی با سربرگ استاندارد ممیزی مرکز میانی عام به آدرس ایمیل دفتر.
                </p>
              </div>

              <div>
                <label className="font-bold text-xs text-slate-700 block mb-1">موضوع ایمیل (Email Subject):</label>
                <input
                  type="text"
                  value={draft.emailSubject}
                  onChange={(e) => setDraft({ ...draft, emailSubject: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
                />
              </div>

              <div>
                <label className="font-bold text-xs text-slate-700 block mb-1">کد ساختار بدنه ایمیل (HTML & Inline Styles):</label>
                <textarea
                  rows={10}
                  dir="ltr"
                  value={draft.emailBodyHtml}
                  onChange={(e) => setDraft({ ...draft, emailBodyHtml: e.target.value })}
                  className="w-full bg-slate-900 text-slate-200 font-mono text-xs rounded-2xl p-4 leading-relaxed focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition"
                  placeholder="<div>HTML email body...</div>"
                />
              </div>
            </div>
          )}

          {/* EDITOR: IN-APP / PUSH CHANNEL */}
          {activeChannelTab === 'IN_APP' && (
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
              <div>
                <h4 className="text-sm font-black text-slate-900">اعلان درون‌برنامه‌ای و نوتیفیکیشن مرورگر (In-App & Push)</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  این اعلان در کارتابل دفتر و فهرست زنگوله بالای صفحه سیستم نمایش داده می‌شود.
                </p>
              </div>

              <div>
                <label className="font-bold text-xs text-slate-700 block mb-1">عنوان اعلان (Title):</label>
                <input
                  type="text"
                  value={draft.inAppTitle}
                  onChange={(e) => setDraft({ ...draft, inAppTitle: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold"
                />
              </div>

              <div>
                <label className="font-bold text-xs text-slate-700 block mb-1">متن شرح اعلان (Message Body):</label>
                <textarea
                  rows={4}
                  value={draft.inAppMessage}
                  onChange={(e) => setDraft({ ...draft, inAppMessage: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs text-slate-900 leading-relaxed"
                />
              </div>
            </div>
          )}
        </div>

        {/* LEFT COLUMN (5 Cols): Live Preview Mockup */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3 sticky top-24">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs sm:text-sm font-black text-slate-900">
                  پیش‌نمایش زنده در سمت گیرنده
                </h4>
              </div>
              <span className="text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold">
                Live Preview
              </span>
            </div>

            {/* SMS MOCKUP VIEW */}
            {activeChannelTab === 'SMS' && (
              <div className="space-y-3">
                <span className="text-xs text-slate-500 block">
                  شبیه‌ساز پیامک دریافتی روی گوشی همراه مسئول دفتر:
                </span>
                {/* Phone Mockup Frame */}
                <div className="bg-slate-900 p-3 rounded-[28px] shadow-xl border-4 border-slate-800 max-w-sm mx-auto">
                  {/* Phone Speaker Notch */}
                  <div className="w-16 h-3.5 bg-slate-800 rounded-full mx-auto mb-2 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-slate-900"></div>
                  </div>

                  {/* Phone Screen */}
                  <div className="bg-slate-100 rounded-[20px] p-4 text-slate-900 min-h-[340px] flex flex-col justify-between">
                    {/* SMS Top Header */}
                    <div className="border-b border-slate-200 pb-2 text-center">
                      <span className="text-[11px] font-bold text-slate-600 block">فرستنده:</span>
                      <span className="text-xs font-mono font-black text-blue-700">30005006 (سامانه بازرسی RA)</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">امروز • ۱۰:۲۵</span>
                    </div>

                    {/* SMS Bubble */}
                    <div className="my-auto py-2">
                      <div className="bg-white border border-slate-200 rounded-2xl rounded-tr-xs p-3.5 shadow-2xs text-xs sm:text-xs leading-relaxed text-slate-800 whitespace-pre-wrap">
                        {renderedSmsText}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 px-1">
                        <span>تحویل داده شد</span>
                        <span>{smsMetrics.charCount} کاراکتر ({smsMetrics.partsCount} پارت)</span>
                      </div>
                    </div>

                    {/* Bottom Indicator */}
                    <div className="pt-2 text-center border-t border-slate-200/60">
                      <span className="text-[10px] text-slate-400">سامانه پیام کوتاه نظارت مرکز میانی عام</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* EMAIL MOCKUP VIEW */}
            {activeChannelTab === 'EMAIL' && (
              <div className="space-y-3">
                <span className="text-xs text-slate-500 block">
                  شبیه‌ساز ایمیل دریافتی در صندوق پستی دفتر (Webmail/Outlook):
                </span>
                
                <div className="bg-white border border-slate-300 rounded-2xl shadow-md overflow-hidden text-xs">
                  {/* Email Header Info */}
                  <div className="bg-slate-100 border-b border-slate-200 p-3 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 font-bold">از:</span>
                      <span className="font-mono text-slate-800">audit-notifications@root-ca.gov.ir</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 font-bold">به:</span>
                      <span className="font-mono text-slate-800">office102@notary.ir</span>
                    </div>
                    <div className="flex items-center gap-1.5 pt-1 border-t border-slate-200">
                      <span className="text-slate-500 font-bold">موضوع:</span>
                      <span className="font-black text-slate-900">{renderedEmailSubject}</span>
                    </div>
                  </div>

                  {/* Rendered HTML Container */}
                  <div 
                    className="p-3 bg-slate-50 max-h-[420px] overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: renderedEmailBody }}
                  />
                </div>
              </div>
            )}

            {/* IN-APP MOCKUP VIEW */}
            {activeChannelTab === 'IN_APP' && (
              <div className="space-y-3">
                <span className="text-xs text-slate-500 block">
                  شبیه‌ساز اعلان در نوار اعلان‌های بالای سامانه و کارتابل:
                </span>

                <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                        <BellRing className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-black text-slate-900">{renderedInAppTitle}</span>
                    </div>
                    <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full font-bold">
                      فوری
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed pr-9">
                    {renderedInAppMessage}
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                    <span>همین الان</span>
                    <button className="text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer">
                      مشاهده در کارتابل &larr;
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
