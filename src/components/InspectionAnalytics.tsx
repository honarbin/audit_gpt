import React, { useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  CheckCircle2, 
  AlertTriangle, 
  FileSpreadsheet, 
  Building2, 
  Download, 
  Search,
  PieChart,
  ShieldAlert,
  Printer
} from 'lucide-react';
import { AuditCampaign, AuditInspectionRecord, OfficeProfile } from '../types';
import { exportAuditCampaignToExcel } from '../utils/excelParser';
import { deduplicateAuditRecords } from '../utils/samplingEngine';

interface InspectionAnalyticsProps {
  campaigns: AuditCampaign[];
  offices: OfficeProfile[];
  onOpenOfficialMinutes: (record: AuditInspectionRecord) => void;
}

export const InspectionAnalytics: React.FC<InspectionAnalyticsProps> = ({
  campaigns,
  offices,
  onOpenOfficialMinutes,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOfficeFilter, setSelectedOfficeFilter] = useState('ALL');

  const allRecords = React.useMemo(() => deduplicateAuditRecords(campaigns.flatMap(c => c.records || [])), [campaigns]);

  const totalCampaigns = campaigns.length;
  const totalSampled = allRecords.length;
  const totalUploaded = allRecords.filter(r => (r.uploadedDocuments?.length || 0) > 0).length;
  const totalApproved = allRecords.filter(r => r.status === 'APPROVED').length;
  const totalDefects = allRecords.filter(r => r.status.includes('DEFECT')).length;

  const uploadRate = totalSampled > 0 ? Math.round((totalUploaded / totalSampled) * 100) : 0;
  const approvalRate = totalUploaded > 0 ? Math.round((totalApproved / totalUploaded) * 100) : 0;

  // Filter records
  const filteredRecords = allRecords.filter(r => {
    const q = (searchTerm || '').toLowerCase();
    const cert = r.certificate;
    const matchesSearch = 
      !q ||
      (cert?.applicantName || '').toLowerCase().includes(q) ||
      (cert?.nationalId || '').includes(q) ||
      (cert?.trackingCode || '').toLowerCase().includes(q) ||
      (r.officeName || '').toLowerCase().includes(q);

    const matchesOffice = selectedOfficeFilter === 'ALL' || r.officeCode === selectedOfficeFilter;

    return matchesSearch && matchesOffice;
  });

  const handleExportAll = () => {
    exportAuditCampaignToExcel('جامع_بازرسی_دفاتر', filteredRecords);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner - Light Theme */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-purple-50 text-purple-800 text-xs px-3 py-1 rounded-full font-bold border border-purple-200">
              مرکز آمار و تحلیل
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">
              داشبورد آمار، شاخص‌های سلامت و تحلیل انطباق دفاتر
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-3xl">
            گزارش جامع عملکرد دفاتر صدور گواهی الکترونیکی، نرخ تمکین در بارگذاری مدارک و وضعیت عدم انطباق‌ها.
          </p>
        </div>

        <button
          onClick={handleExportAll}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm px-5 py-3 rounded-2xl shadow-xs transition shrink-0"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>خروجی اکسل از کلیه نتایج</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-2">
          <span className="text-xs text-slate-500 block font-bold">کل دوره‌های بازرسی</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">{totalCampaigns}</span>
            <span className="text-xs text-emerald-700 font-bold">{offices.length} دفتر فعال</span>
          </div>
          <p className="text-[11px] text-slate-400">دوره‌های ادواری بر اساس الگوریتم</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-2">
          <span className="text-xs text-slate-500 block font-bold">تعداد کل نمونه‌های مطالبه‌شده</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">{totalSampled}</span>
            <span className="text-xs text-blue-700 font-bold">{uploadRate}٪ تمکین بارگذاری</span>
          </div>
          <p className="text-[11px] text-slate-400">{totalUploaded} پرونده مدارک ارسال شده</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-2">
          <span className="text-xs text-slate-500 block font-bold">گواهی‌های تاییدشده کامل</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-emerald-700">{totalApproved}</span>
            <span className="text-xs text-emerald-700 font-bold">{approvalRate}٪ نرخ انطباق</span>
          </div>
          <p className="text-[11px] text-slate-400">مدارک منطبق با استانداردهای ریشه</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-2">
          <span className="text-xs text-slate-500 block font-bold">موارد دارای عدم انطباق / تذکر</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-rose-700">{totalDefects}</span>
            <span className="text-xs text-rose-700 font-bold">نیازمند اصلاح</span>
          </div>
          <p className="text-[11px] text-slate-400">نقص در فرم، شاهکار یا مدارک حقوقی</p>
        </div>
      </div>

      {/* Offices Performance Table */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-600" />
              <span>کارنامه و شاخص سلامت دفاتر ثبت‌نام (RA Performance Index)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              مقایسه عملکرد دفاتر در بازرسی‌های ادواری، سرعت پاسخگویی و میزان انطباق
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-700 font-black border-b border-slate-200">
              <tr>
                <th className="p-3.5">کد دفتر</th>
                <th className="p-3.5">نام دفتر و استان</th>
                <th className="p-3.5">مسئول دفتر</th>
                <th className="p-3.5">تعداد نمونه بازرسی</th>
                <th className="p-3.5">تکمیل مدارک</th>
                <th className="p-3.5">نمره سلامت</th>
                <th className="p-3.5">وضعیت نظارتی</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {offices.map((office) => {
                const officeRecords = allRecords.filter(r => r.officeCode === office.code);
                const recCount = officeRecords.length;
                const uploaded = officeRecords.filter(r => (r.uploadedDocuments?.length || 0) > 0).length;
                const approved = officeRecords.filter(r => r.status === 'APPROVED').length;

                return (
                  <tr key={office.code} className="hover:bg-slate-50 transition">
                    <td className="p-3.5 font-mono font-bold text-slate-900">{office.code}</td>
                    <td className="p-3.5">
                      <div className="font-extrabold text-slate-900">{office.name}</div>
                      <div className="text-[11px] text-slate-500">{office.city} - {office.province}</div>
                    </td>
                    <td className="p-3.5 font-medium">{office.managerName}</td>
                    <td className="p-3.5 font-mono font-bold">{recCount > 0 ? `${recCount} گواهی` : 'در نوبت'}</td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-2 font-mono">
                        <span className="font-bold">{uploaded}/{recCount}</span>
                        <div className="w-16 bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-600 h-full"
                            style={{ width: `${recCount > 0 ? (uploaded / recCount) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full font-black font-mono text-xs border ${
                        office.complianceHealthScore >= 85
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : office.complianceHealthScore >= 70
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : 'bg-rose-50 text-rose-800 border-rose-300'
                      }`}>
                        {office.complianceHealthScore}٪
                      </span>
                    </td>
                    <td className="p-3.5">
                      {office.complianceHealthScore >= 85 ? (
                        <span className="text-emerald-700 font-bold text-[11px] flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          عالی و استاندارد
                        </span>
                      ) : (
                        <span className="text-amber-700 font-bold text-[11px] flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          مشروط / تحت نظارت
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Inspection Records Audit Log */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
          <h3 className="text-base font-extrabold text-slate-900">
            دفتر کل سوابق بازرسی و آرای صادره
          </h3>

          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                placeholder="جستجو در متقاضی یا کدملی..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-xl pr-9 pl-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 shadow-2xs"
              />
            </div>

            <select
              value={selectedOfficeFilter}
              onChange={(e) => setSelectedOfficeFilter(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none shadow-2xs"
            >
              <option value="ALL">همه دفاتر</option>
              {offices.map(o => (
                <option key={o.code} value={o.code}>{o.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-700 font-black border-b border-slate-200">
              <tr>
                <th className="p-3.5">کد رهگیری</th>
                <th className="p-3.5">متقاضی</th>
                <th className="p-3.5">دفتر صادرکننده</th>
                <th className="p-3.5">مدارک پیوست</th>
                <th className="p-3.5">وضعیت رای</th>
                <th className="p-3.5">امتیاز</th>
                <th className="p-3.5 text-center">صورت‌جلسه</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 text-xs">
                    موردی یافت نشد.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition">
                    <td className="p-3.5 font-mono text-slate-600 font-bold">{r.certificate.trackingCode}</td>
                    <td className="p-3.5 font-extrabold text-slate-900">{r.certificate.applicantName}</td>
                    <td className="p-3.5 font-semibold text-slate-700">{r.officeName}</td>
                    <td className="p-3.5 font-mono">
                      {r.uploadedDocuments?.length || 0} مدرک
                    </td>
                    <td className="p-3.5">
                      {r.status === 'APPROVED' ? (
                        <span className="text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                          تایید کامل
                        </span>
                      ) : r.status === 'UPLOADED' ? (
                        <span className="text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                          ارسال شده
                        </span>
                      ) : r.status.includes('DEFECT') ? (
                        <span className="text-rose-800 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                          عدم انطباق
                        </span>
                      ) : (
                        <span className="text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full text-[10px] font-semibold">
                          در انتظار مدارک
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 font-mono font-black">
                      {r.complianceScore ? `${r.complianceScore}٪` : '-'}
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => onOpenOfficialMinutes(r)}
                        className="text-slate-600 hover:text-emerald-700 font-bold text-xs p-1.5 rounded-lg hover:bg-slate-100 transition inline-flex items-center gap-1"
                        title="مشاهده صورت‌جلسه"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>صورت‌جلسه</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
