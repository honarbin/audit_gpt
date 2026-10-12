import React, { useState } from 'react';
import { 
  X, 
  User, 
  FileText, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Calendar, 
  Building2, 
  Copy, 
  Check, 
  Fingerprint, 
  Hash, 
  Phone, 
  BadgeAlert,
  Info,
  Layers,
  FileCheck
} from 'lucide-react';
import { AuditInspectionRecord, CertificateRecord } from '../types';
import { 
  getCertificateDates, 
  getDisplayDependencyTitle, 
  getCertificateTypeTitle,
  formatDisplayDate 
} from '../utils/dateFormatter';
import { getCertificateStatusTitle, getDocTypeTitle } from '../utils/samplingEngine';

interface CertificateDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: AuditInspectionRecord | null;
  officeName?: string;
  officeCode?: string;
}

export const CertificateDetailsModal: React.FC<CertificateDetailsModalProps> = ({
  isOpen,
  onClose,
  record,
  officeName,
  officeCode
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!isOpen || !record) return null;

  const cert: CertificateRecord = record.certificate;
  const certDates = getCertificateDates(cert);
  const dependencyTitle = getDisplayDependencyTitle(cert);
  const certTypeTitle = getCertificateTypeTitle(cert.certificateType);

  const copyToClipboard = (text: string, fieldId: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getStatusBadge = () => {
    switch (cert.status) {
      case 'VALID':
        return (
          <span className="inline-flex items-center gap-1.5 font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-3 py-1 rounded-full text-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>معتبر</span>
          </span>
        );
      case 'REVOKED':
        return (
          <span className="inline-flex items-center gap-1.5 font-bold text-rose-800 bg-rose-100 border border-rose-300 px-3 py-1 rounded-full text-xs">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>ابطال شده</span>
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1.5 font-bold text-amber-800 bg-amber-100 border border-amber-300 px-3 py-1 rounded-full text-xs">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>منقضی شده</span>
          </span>
        );
      case 'NOT_ACCEPTED':
        return (
          <span className="inline-flex items-center gap-1.5 font-bold text-purple-800 bg-purple-100 border border-purple-300 px-3 py-1 rounded-full text-xs">
            <span>پذیرش نشده</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 font-bold text-slate-700 bg-slate-100 border border-slate-300 px-3 py-1 rounded-full text-xs">
            <span>{getCertificateStatusTitle(cert.status)}</span>
          </span>
        );
    }
  };

  const getAuthMethodText = () => {
    if (cert.authMethod === 'IN_PERSON') return 'احراز هویت حضوری در دفتر';
    if (cert.authMethod === 'BIOMETRIC_ONLINE') return 'احراز هویت غیرحضوری (بیومتریک آنلاین)';
    if (cert.authMethod === 'SHAHKAR') return 'استعلام برخط تطبیق شماره (شاهکار)';
    return 'احراز هویت استاندارد مرکز ریشه';
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border-2 border-slate-300 max-h-[92vh] flex flex-col space-y-5 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shrink-0 shadow-2xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-black text-slate-900">
                  شناسنامه و جزئیات کامل گواهی الکترونیکی
                </h3>
                {getStatusBadge()}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                اطلاعات متقاضی، مشخصات هویتی، سریال، تاریخ‌ها و شرایط صدور پرونده
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition cursor-pointer"
            title="بستن پنجره"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto pr-1 space-y-5 flex-1">
          
          {/* 1. Identity & Applicant Block */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-black text-slate-800 border-b border-slate-200/60 pb-2">
              <User className="w-4 h-4 text-emerald-600" />
              <span>مشخصات هویتی متقاضی</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">نام و نام خانوادگی متقاضی:</span>
                <span className="font-extrabold text-slate-900 text-sm mt-0.5 block">
                  {cert.applicantName}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block text-[11px]">کد ملی:</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono font-bold text-slate-900 text-sm bg-white px-2 py-0.5 rounded-md border border-slate-200">
                    {cert.nationalId}
                  </span>
                  <button
                    onClick={() => copyToClipboard(cert.nationalId, 'nationalId')}
                    className="text-slate-500 hover:text-slate-800 p-1 hover:bg-white rounded transition cursor-pointer"
                    title="کپی کد ملی"
                  >
                    {copiedField === 'nationalId' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {cert.mobileNumber && (
                <div>
                  <span className="text-slate-500 block text-[11px]">شماره تلفن همراه:</span>
                  <span className="font-mono text-slate-800 mt-0.5 block">
                    {cert.mobileNumber}
                  </span>
                </div>
              )}

              <div>
                <span className="text-slate-500 block text-[11px]">روش احراز هویت:</span>
                <span className="text-slate-800 font-medium mt-0.5 block">
                  {getAuthMethodText()}
                </span>
              </div>

              {cert.companyName && (
                <div className="sm:col-span-2 bg-teal-50/70 border border-teal-200/80 rounded-xl p-2.5">
                  <div className="flex items-center gap-2 text-teal-950 font-bold">
                    <Building2 className="w-4 h-4 text-teal-700 shrink-0" />
                    <span>نام شرکت / سازمان متبوع: {cert.companyName}</span>
                  </div>
                  {cert.companyNationalId && (
                    <div className="text-[11px] text-teal-800 mt-1 font-mono">
                      شناسه ملی حقوقی: <strong>{cert.companyNationalId}</strong>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 2. Certificate Technical Parameters Block */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-black text-slate-800 border-b border-slate-200/60 pb-2">
              <FileText className="w-4 h-4 text-teal-600" />
              <span>مشخصات فنی و ساختار گواهی</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Serial Number */}
              <div>
                <span className="text-slate-500 block text-[11px]">شماره سریال گواهی:</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono font-bold text-slate-900 text-xs bg-white px-2 py-1 rounded-md border border-slate-200 truncate">
                    {cert.serialNumber}
                  </span>
                  <button
                    onClick={() => copyToClipboard(cert.serialNumber, 'serialNumber')}
                    className="text-slate-500 hover:text-slate-800 p-1 hover:bg-white rounded transition cursor-pointer"
                    title="کپی شماره سریال"
                  >
                    {copiedField === 'serialNumber' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Tracking Code */}
              <div>
                <span className="text-slate-500 block text-[11px]">کد رهگیری:</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono font-bold text-slate-900 text-xs bg-white px-2 py-1 rounded-md border border-slate-200 truncate">
                    {cert.trackingCode || '—'}
                  </span>
                  {cert.trackingCode && (
                    <button
                      onClick={() => copyToClipboard(cert.trackingCode, 'trackingCode')}
                      className="text-slate-500 hover:text-slate-800 p-1 hover:bg-white rounded transition cursor-pointer"
                      title="کپی کد رهگیری"
                    >
                      {copiedField === 'trackingCode' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Certificate Type */}
              <div>
                <span className="text-slate-500 block text-[11px]">نوع گواهی:</span>
                <span className="font-bold text-slate-800 mt-0.5 block">
                  {certTypeTitle}
                </span>
              </div>

              {/* Dependency Type */}
              <div>
                <span className="text-slate-500 block text-[11px]">نوع وابستگی ۵ گانه:</span>
                <span className="font-bold text-teal-800 mt-0.5 block">
                  {dependencyTitle}
                </span>
              </div>

              {/* Assurance Level */}
              <div>
                <span className="text-slate-500 block text-[11px]">سطح اطمینان:</span>
                <span className="font-medium text-slate-700 mt-0.5 block">
                  {cert.assuranceLevel === 'HIGH' ? 'سطح ۳ (بالا)' : cert.assuranceLevel === 'MEDIUM' ? 'سطح ۲ (متوسط)' : 'سطح ۱ (پایه)'}
                </span>
              </div>

              {/* Office Details */}
              <div>
                <span className="text-slate-500 block text-[11px]">دفتر ثبت نام صادرکننده:</span>
                <span className="font-medium text-slate-800 mt-0.5 block truncate">
                  {cert.officeName || officeName || 'دفتر ثبت نام'} ({cert.officeCode || officeCode})
                </span>
              </div>
            </div>
          </div>

          {/* 3. Dates & Validity Block */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-black text-slate-800 border-b border-slate-200/60 pb-2">
              <Calendar className="w-4 h-4 text-amber-600" />
              <span>تاریخ‌های صدور و اعتبار</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 block text-[11px]">تاریخ دقیق صدور:</span>
                <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">
                  {certDates.issue.formatted}
                </span>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 block text-[11px]">تاریخ انقضای گواهی:</span>
                <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">
                  {certDates.expire.date}
                </span>
              </div>

              {cert.status === 'REVOKED' && (
                <div className="sm:col-span-2 bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-950 space-y-1">
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1.5 text-rose-800">
                      <BadgeAlert className="w-4 h-4 text-rose-600" />
                      اطلاعات ابطال گواهی:
                    </span>
                    <span className="font-mono text-xs">
                      تاریخ ابطال: {formatDisplayDate(cert.revocationDate || '۱۴۰۴/۰۵/۲۵').date}
                    </span>
                  </div>
                  {cert.revocationReason && (
                    <p className="text-xs text-rose-800">
                      <strong>علت ابطال:</strong> {cert.revocationReason}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 4. Inspection & Sampling Context */}
          <div className="bg-teal-50/50 border border-teal-200/80 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-teal-200/60 pb-2">
              <div className="flex items-center gap-2 text-xs font-black text-teal-950">
                <Layers className="w-4 h-4 text-teal-700" />
                <span>پرونده بازرسی و مدارک الزامی</span>
              </div>
              <span className="text-[11px] font-mono text-teal-800">
                شناسه: {record.id.slice(0, 12)}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              {cert.selectedReasonBadge && (
                <div className="text-[11px] text-teal-900 bg-white p-2 rounded-xl border border-teal-200 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span><strong>معیار انتخاب در نمونه:</strong> {cert.selectedReasonBadge}</span>
                </div>
              )}

              <div>
                <span className="text-slate-600 block text-[11px] mb-1 font-bold">مدارک الزامی این پرونده جهت بارگذاری:</span>
                <div className="flex flex-wrap gap-1.5">
                  {record.requiredDocuments.map((docType, idx) => (
                    <span 
                      key={idx} 
                      className="bg-white text-slate-800 border border-slate-300 text-[11px] px-2.5 py-1 rounded-lg font-medium shadow-2xs flex items-center gap-1"
                    >
                      <FileCheck className="w-3 h-3 text-emerald-600" />
                      {getDocTypeTitle(docType)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="pt-2 border-t border-slate-200 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};
