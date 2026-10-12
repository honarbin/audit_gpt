import React from 'react';
import { 
  X, 
  Printer, 
  Download, 
  ShieldCheck, 
  Building, 
  CheckCircle, 
  AlertCircle,
  FileCheck2
} from 'lucide-react';
import { AuditInspectionRecord } from '../types';
import { exportAuditCampaignToExcel } from '../utils/excelParser';
import { getDependencyTypeTitle, getCertificateStatusTitle, getDocTypeTitle } from '../utils/samplingEngine';
import { formatDisplayDate, getCertificateTypeTitle } from '../utils/dateFormatter';

interface OfficialMinutesModalProps {
  record: AuditInspectionRecord | null;
  onClose: () => void;
}

export const OfficialMinutesModal: React.FC<OfficialMinutesModalProps> = ({
  record,
  onClose,
}) => {
  if (!record) return null;

  const cert = record.certificate;
  const minutesNumber = `م‌ب/۱۴۰۵/${cert.officeCode}/${Math.floor(1000 + Math.random() * 9000)}`;
  const inspectionDate = record.reviewDate || '1405/06/02';

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    exportAuditCampaignToExcel(record.campaignTitle, [record]);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl space-y-4 my-6">
        {/* Top Control Bar (Hidden in Print) */}
        <div className="no-print sticky top-0 bg-white/95 backdrop-blur-md border-b border-slate-200 p-5 flex items-center justify-between z-10">
          <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
            <FileCheck2 className="w-5 h-5 text-emerald-600" />
            <span>صورت‌جلسه رسمی بازرسی و ارزیابی انطباق گواهی الکترونیکی</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs px-3.5 py-2 rounded-xl border border-slate-200 transition shadow-2xs"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>خروجی اکسل</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs transition"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ / ذخیره PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Official Sheet */}
        <div className="p-8 text-slate-900 bg-white rounded-2xl mx-4 my-2 font-sans print:m-0 print:p-6 print:shadow-none space-y-6 text-xs leading-relaxed border border-slate-200">
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between">
            <div className="w-24 text-center">
              <div className="w-12 h-12 border-2 border-slate-900 rounded-full mx-auto flex items-center justify-center font-black text-xs">
                CA-IR
              </div>
              <span className="text-[10px] text-slate-600 block mt-1 font-bold">مرکز میانی عام</span>
            </div>

            <div className="text-center space-y-1">
              <h1 className="text-xs font-bold text-slate-700">جمهوری اسلامی ایران</h1>
              <h2 className="text-base font-black text-slate-900">
                مرکز بازرسی و نظارت دفاتر ثبت نام مرکز میانی عام
              </h2>
              <p className="text-[11px] text-slate-600 font-bold">
                صورت‌جلسه ارزیابی انطباق صدور گواهی امضای الکترونیکی
              </p>
            </div>

            <div className="w-36 text-[10px] space-y-1 text-right border border-slate-300 p-2.5 rounded-xl bg-slate-50">
              <div>شماره: <span className="font-mono font-bold text-slate-900">{minutesNumber}</span></div>
              <div>تاریخ بازرسی: <span className="font-mono text-slate-900">{inspectionDate}</span></div>
              <div>پیوست: دارد</div>
            </div>
          </div>

          {/* Office Information Box */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 space-y-2">
            <div className="font-extrabold text-slate-900 text-xs border-b border-slate-200 pb-1.5">
              الف) مشخصات دفتر تحت بازرسی:
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <div>نام دفتر: <span className="font-bold text-slate-900">{record.officeName}</span></div>
              <div>کد شناسه دفتر: <span className="font-black font-mono text-slate-900">{record.officeCode}</span></div>
              <div>دوره بازرسی: <span className="font-semibold text-slate-800">{record.campaignTitle}</span></div>
            </div>
          </div>

          {/* Certificate Specifications */}
          <div className="border border-slate-200 rounded-2xl p-4 space-y-2.5">
            <div className="font-extrabold text-slate-900 text-xs border-b border-slate-200 pb-1.5">
              ب) مشخصات گواهی نمونه‌گیری شده:
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <div>نام متقاضی: <span className="font-black text-slate-900">{cert.applicantName}</span></div>
              <div>کد ملی: <span className="font-mono font-black text-slate-900">{cert.nationalId}</span></div>
              <div>شماره سریال گواهی: <span className="font-mono text-slate-800">{cert.serialNumber}</span></div>
              <div>کد رهگیری: <span className="font-mono text-slate-800">{cert.trackingCode}</span></div>
              <div>نوع گواهی: <span className="font-bold text-slate-900">
                {getCertificateTypeTitle(cert.certificateType, cert.rawRowData?.['certType'] || cert.rawRowData?.['نوع گواهی'], cert.dependencyType)}
              </span></div>
              <div>نوع وابستگی ۵‌گانه: <span className="font-black text-teal-800">{getDependencyTypeTitle(cert.dependencyType)}</span></div>
              <div>وضعیت گواهی: <span className={`font-black ${cert.status === 'REVOKED' ? 'text-rose-700' : 'text-emerald-700'}`}>{getCertificateStatusTitle(cert.status)}</span></div>
              <div>تاریخ و ساعت صدور: <span className="font-mono text-slate-800">{formatDisplayDate(cert.issueDate, cert.issueTime).formatted}</span></div>
              {cert.companyName && (
                <div className="col-span-2">شرکت / سازمان متبوع: <span className="font-bold text-slate-900">{cert.companyName} (شناسه: {cert.companyNationalId || '-'})</span></div>
              )}
              {cert.status === 'REVOKED' && (
                <div className="col-span-2 text-rose-900 bg-rose-50 p-2 rounded-xl border border-rose-200">
                  علت و تاریخ ابطال: <span>{cert.revocationReason || 'درخواست رسمی متقاضی'} ({cert.revocationDate ? formatDisplayDate(cert.revocationDate).date : '-'})</span>
                </div>
              )}
            </div>
          </div>

          {/* Uploaded Documents List */}
          <div className="space-y-2.5">
            <div className="font-extrabold text-slate-900 text-xs flex items-center justify-between">
              <span>ج) مستندات و مدارک احراز هویت واصله از دفتر:</span>
              <span className="text-[10px] text-slate-500 font-normal">بایگانی ابری: Google Drive / اسناد مرکز بازرسی و نظارت مرکز میانی عام</span>
            </div>
            <table className="w-full border-collapse border border-slate-200 text-xs text-right">
              <thead className="bg-slate-50 font-black text-slate-700">
                <tr>
                  <th className="border border-slate-200 p-2">ردیف</th>
                  <th className="border border-slate-200 p-2">نوع سند الزامی</th>
                  <th className="border border-slate-200 p-2">نام فایل پیوست</th>
                  <th className="border border-slate-200 p-2">تاریخ بارگذاری</th>
                  <th className="border border-slate-200 p-2">وضعیت انطباق اختصاصی</th>
                </tr>
              </thead>
              <tbody>
                {record.requiredDocuments.map((docType, index) => {
                  const uploaded = record.uploadedDocuments?.find(d => d.docType === docType);
                  const isDefective = uploaded?.complianceStatus === 'DEFECTIVE' || (uploaded?.defects && uploaded.defects.length > 0);
                  return (
                    <tr key={docType}>
                      <td className="border border-slate-200 p-2 text-center font-mono font-bold">{index + 1}</td>
                      <td className="border border-slate-200 p-2 font-bold text-slate-900">
                        {getDocTypeTitle(docType)}
                      </td>
                      <td className="border border-slate-200 p-2 font-mono text-[11px]">
                        {uploaded?.fileName || 'بارگذاری نشده'}
                      </td>
                      <td className="border border-slate-200 p-2 font-mono">
                        {uploaded?.uploadDate || '-'}
                      </td>
                      <td className="border border-slate-200 p-2">
                        {isDefective ? (
                          <div className="text-rose-700 font-bold space-y-0.5">
                            <span>✗ دارای عدم انطباق:</span>
                            <div className="text-[10px] text-rose-800 font-normal">
                              {uploaded?.defects?.map(d => d.title).join('، ') || 'نقص در محتوا'}
                            </div>
                          </div>
                        ) : uploaded ? (
                          <span className="text-emerald-700 font-black">✓ تایید و منطبق</span>
                        ) : (
                          <span className="text-rose-700 font-black">✗ کسری مدرک</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Audit Checklist & Verdict */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 space-y-2">
            <div className="font-extrabold text-slate-900 text-xs border-b border-slate-200 pb-1.5">
              د) نتیجه بازرسی و رای هیئت نظارت:
            </div>
            <div className="space-y-1.5 text-xs">
              <div>
                وضعیت انطباق نهایی: {' '}
                <span className="font-black text-sm underline text-emerald-800">
                  {record.status === 'APPROVED' ? 'تایید شده (کاملاً منطبق با مقررات و استانداردها)' : record.status.includes('DEFECT') ? 'دارای عدم انطباق قانونی' : 'در انتظار رفع نقص'}
                </span>
              </div>
              <div>امتیاز انطباق: <span className="font-black font-mono text-emerald-800">{record.complianceScore || 100} از ۱۰۰</span></div>
              <div>
                شرح و تذکرات بازرس: {' '}
                <span className="italic font-medium text-slate-700">{record.inspectorNotes || 'مدارک و الزامات قانونی با موفقیت بررسی و تایید شد.'}</span>
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-3 gap-6 pt-8 text-center text-[11px] font-bold text-slate-800">
            <div className="space-y-8">
              <span>مسئول دفتر صدور گواهی (RA)</span>
              <div className="text-slate-400 italic">مهر و امضای دفتر</div>
            </div>

            <div className="space-y-8">
              <span>بازرس ناظر هیئت بازرسی</span>
              <div className="text-emerald-700 italic font-mono font-bold">
                [امضای دیجیتال معتبر]
              </div>
            </div>

            <div className="space-y-8">
              <span>مدیرکل بازرسی و نظارت مرکز میانی عام</span>
              <div className="text-slate-400 italic">مهر برجسته مرکز میانی عام</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
