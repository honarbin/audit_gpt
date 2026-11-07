import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  User, 
  X, 
  Save, 
  Lock, 
  CheckCircle2, 
  AlertCircle, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  FileText,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { OfficeProfile, OfficeManager, FormFieldSetting, OfficeTypeDefinition } from '../types';
import { IRAN_PROVINCES } from '../data/iranGeoData';

interface OfficeKartableProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  office: OfficeProfile;
  manager: OfficeManager | null;
  offices?: OfficeProfile[];
  onSelectOffice?: (officeCode: string) => void;
  officeTypes: OfficeTypeDefinition[];
  fieldSettings: FormFieldSetting[];
  onSave: (updatedOffice: OfficeProfile, updatedManager: OfficeManager | null) => void;
}

export const OfficeKartableProfileModal: React.FC<OfficeKartableProfileModalProps> = ({
  isOpen,
  onClose,
  office,
  manager,
  offices = [],
  onSelectOffice,
  officeTypes,
  fieldSettings,
  onSave,
}) => {
  // Active Tab
  const [activeTab, setActiveTab] = useState<'OFFICE' | 'MANAGER'>('OFFICE');

  // Office Form State
  const [name, setName] = useState(office?.name || '');
  const [type, setType] = useState(office?.type || 'PRESHKHAN');
  const [customTypeName, setCustomTypeName] = useState(office?.customTypeName || '');
  const [province, setProvince] = useState(office?.province || 'تهران');
  const [city, setCity] = useState(office?.city || 'تهران');
  const [address, setAddress] = useState(office?.address || '');
  const [phone, setPhone] = useState(office?.phone || '');
  const [email, setEmail] = useState(office?.email || '');
  const [latitude, setLatitude] = useState(office?.latitude ? String(office.latitude) : '');
  const [longitude, setLongitude] = useState(office?.longitude ? String(office.longitude) : '');
  const [notes, setNotes] = useState(office?.notes || '');

  // Manager Form State
  const [managerCode, setManagerCode] = useState(manager?.managerCode || office?.managerId || (office?.code ? `MGR-${office.code}` : ''));
  const [nationalId, setNationalId] = useState(manager?.nationalId || office?.managerNationalId || '');
  const [fullName, setFullName] = useState(manager?.fullName || office?.managerName || '');
  const [mobilePhone, setMobilePhone] = useState(manager?.mobilePhone || office?.managerMobile || '');
  const [landlinePhone, setLandlinePhone] = useState(manager?.landlinePhone || office?.managerPhone || '');
  const [managerEmail, setManagerEmail] = useState(manager?.email || office?.managerEmail || '');
  const [appointmentDate, setAppointmentDate] = useState(manager?.appointmentDate || '');
  const [managerNotes, setManagerNotes] = useState(manager?.notes || '');

  // Validation errors
  const [errors, setErrors] = useState<string[]>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Synchronize form state whenever office, manager, or modal open status changes
  useEffect(() => {
    if (office) {
      setName(office.name || '');
      setType(office.type || 'PRESHKHAN');
      setCustomTypeName(office.customTypeName || '');
      setProvince(office.province || 'تهران');
      setCity(office.city || 'تهران');
      setAddress(office.address || '');
      setPhone(office.phone || '');
      setEmail(office.email || '');
      setLatitude(office.latitude ? String(office.latitude) : '');
      setLongitude(office.longitude ? String(office.longitude) : '');
      setNotes(office.notes || '');

      setManagerCode(manager?.managerCode || office.managerId || (office.code ? `MGR-${office.code}` : ''));
      setNationalId(manager?.nationalId || office.managerNationalId || '');
      setFullName(manager?.fullName || office.managerName || '');
      setMobilePhone(manager?.mobilePhone || office.managerMobile || '');
      setLandlinePhone(manager?.landlinePhone || office.managerPhone || '');
      setManagerEmail(manager?.email || office.managerEmail || '');
      setAppointmentDate(manager?.appointmentDate || '');
      setManagerNotes(manager?.notes || '');

      setErrors([]);
      setSaveSuccess(false);
    }
  }, [office, manager, isOpen, office?.code, office?.id, office?.name]);

  if (!isOpen || !office) return null;

  // Field helpers
  const getFieldSetting = (key: string, target: 'OFFICE' | 'MANAGER'): FormFieldSetting => {
    const found = fieldSettings.find(s => s.key === key && s.target === target);
    if (found) return found;
    return {
      key,
      target,
      label: key,
      isRequired: false,
      isEditable: true,
    };
  };

  const selectedProvinceData = IRAN_PROVINCES.find(p => p.name === province);
  const countyList = selectedProvinceData ? selectedProvinceData.counties : ['مرکز'];

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: string[] = [];

    // Validate Office fields
    fieldSettings.filter(s => s.target === 'OFFICE' && s.isRequired).forEach(setting => {
      if (setting.key === 'name' && !name.trim()) newErrors.push('فیلد «نام کامل دفتر» الزامی است.');
      if (setting.key === 'address' && !address.trim()) newErrors.push('فیلد «نشانی دقیق پستی دفتر» الزامی است.');
      if (setting.key === 'phone' && !phone.trim()) newErrors.push('فیلد «شماره تلفن ثابت دفتر» الزامی است.');
      if (setting.key === 'email' && !email.trim()) newErrors.push('فیلد «ایمیل رسمی دفتر» الزامی است.');
    });

    // Validate Manager fields
    fieldSettings.filter(s => s.target === 'MANAGER' && s.isRequired).forEach(setting => {
      if (setting.key === 'fullName' && !fullName.trim()) newErrors.push('فیلد «نام و نام خانوادگی مسئول» الزامی است.');
      if (setting.key === 'nationalId' && !nationalId.trim()) newErrors.push('فیلد «کد ملی مسئول» الزامی است.');
      if (setting.key === 'mobilePhone' && !mobilePhone.trim()) newErrors.push('فیلد «شماره موبایل مسئول» الزامی است.');
      if (setting.key === 'landlinePhone' && !landlinePhone.trim()) newErrors.push('فیلد «تلفن ثابت مسئول» الزامی است.');
      if (setting.key === 'email' && !managerEmail.trim()) newErrors.push('فیلد «ایمیل اختصاصی مسئول» الزامی است.');
    });

    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors([]);

    const updatedOffice: OfficeProfile = {
      ...office,
      name,
      type,
      customTypeName: type === 'OTHER' ? customTypeName : undefined,
      province,
      city,
      address,
      phone,
      email: email || undefined,
      latitude: latitude ? parseFloat(latitude) : office.latitude,
      longitude: longitude ? parseFloat(longitude) : office.longitude,
      notes: notes || undefined,
      managerId: managerCode,
      managerName: fullName,
    };

    const updatedManager: OfficeManager = {
      id: manager?.id || `MGR-${office.code}`,
      managerCode,
      nationalId,
      fullName,
      mobilePhone,
      landlinePhone,
      email: managerEmail || undefined,
      assignedOfficeCode: office.code,
      assignedOfficeName: name,
      appointmentDate: appointmentDate || manager?.appointmentDate || '1405/01/01',
      status: manager?.status || 'ACTIVE',
      notes: managerNotes || undefined,
    };

    onSave(updatedOffice, updatedManager);
    setSaveSuccess(true);

    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 my-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-50 text-teal-700 rounded-2xl border border-teal-200 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                ویرایش مشخصات دفتر و مسئول ثبت‌نام (کد {office.code})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                تکمیل اطلاعات پرونده بر اساس دسترسی‌ها و فیلدهای الزامی تعیین‌شده توسط بازرس
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2.5 self-end sm:self-center">
            {offices && offices.length > 1 && onSelectOffice && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
                <span className="text-[11px] font-bold text-slate-600 shrink-0 hidden md:inline">
                  تغییر دفتر فعال:
                </span>
                <select
                  value={office.code}
                  onChange={(e) => onSelectOffice(e.target.value)}
                  className="bg-white border border-slate-300 text-slate-800 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer max-w-[200px] truncate"
                  title="انتخاب دفتر فعال جهت مشاهده و ویرایش مشخصات"
                >
                  {offices.map((o) => (
                    <option key={o.code} value={o.code}>
                      کد {o.code} - {o.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer shrink-0"
              title="بستن پنجره"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('OFFICE')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
              activeTab === 'OFFICE'
                ? 'bg-white text-emerald-800 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-4 h-4 text-emerald-600" />
            <span>مشخصات و آدرس دفتر ثبت‌نام</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('MANAGER')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
              activeTab === 'MANAGER'
                ? 'bg-white text-teal-800 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className="w-4 h-4 text-teal-600" />
            <span>اطلاعات هویتی و پرسنلی مسئول دفتر</span>
          </button>
        </div>

        {/* Errors list if validation failed */}
        {errors.length > 0 && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-1.5 text-xs text-rose-900">
            <span className="font-bold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              خطاهای اعتبارسنجی فیلدهای الزامی:
            </span>
            <ul className="list-disc list-inside space-y-0.5 pr-2 font-semibold">
              {errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* TAB 1: OFFICE PROFILE */}
          {activeTab === 'OFFICE' && (
            <div className="space-y-4">
              {/* Code & Name */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-extrabold text-slate-800 block mb-1.5 flex items-center justify-between">
                    <span>کد دفتر (یکتا):</span>
                    <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                      <Lock className="w-3 h-3 text-slate-400" />
                      غیرقابل تغییر
                    </span>
                  </label>
                  <input
                    type="text"
                    disabled
                    value={office.code}
                    className="w-full bg-slate-100 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs text-slate-600 font-mono cursor-not-allowed font-bold"
                  />
                </div>

                <div className="sm:col-span-2">
                  {(() => {
                    const s = getFieldSetting('name', 'OFFICE');
                    return (
                      <div>
                        <label className="text-xs font-extrabold text-slate-800 block mb-1.5 flex items-center justify-between">
                          <span>
                            {s.label}
                            {s.isRequired && <span className="text-rose-500 mr-1">*</span>}
                          </span>
                          {!s.isEditable && (
                            <span className="text-[10px] text-amber-700 flex items-center gap-1">
                              <Lock className="w-3 h-3" /> فقط خواندنی
                            </span>
                          )}
                        </label>
                        <input
                          type="text"
                          disabled={!s.isEditable}
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className={`w-full rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none ${
                            !s.isEditable
                              ? 'bg-slate-100 border-slate-200 cursor-not-allowed text-slate-500'
                              : 'bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-emerald-500'
                          }`}
                        />
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Office Type & Province / City */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  {(() => {
                    const s = getFieldSetting('type', 'OFFICE');
                    return (
                      <div>
                        <label className="text-xs font-extrabold text-slate-800 block mb-1.5 flex items-center justify-between">
                          <span>
                            {s.label}
                            {s.isRequired && <span className="text-rose-500 mr-1">*</span>}
                          </span>
                        </label>
                        <select
                          disabled={!s.isEditable}
                          value={type}
                          onChange={(e) => setType(e.target.value)}
                          className={`w-full rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:outline-none ${
                            !s.isEditable
                              ? 'bg-slate-100 border-slate-200 cursor-not-allowed text-slate-500'
                              : 'bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-emerald-500'
                          }`}
                        >
                          {officeTypes.map(ot => (
                            <option key={ot.code} value={ot.code}>{ot.title}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })()}
                </div>

                <div>
                  {(() => {
                    const s = getFieldSetting('province', 'OFFICE');
                    return (
                      <div>
                        <label className="text-xs font-extrabold text-slate-800 block mb-1.5">
                          {s.label}
                          {s.isRequired && <span className="text-rose-500 mr-1">*</span>}
                        </label>
                        <select
                          disabled={!s.isEditable}
                          value={province}
                          onChange={(e) => {
                            setProvince(e.target.value);
                            const pData = IRAN_PROVINCES.find(p => p.name === e.target.value);
                            if (pData && pData.counties.length > 0) {
                              setCity(pData.counties[0]);
                            }
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500"
                        >
                          {IRAN_PROVINCES.map(p => (
                            <option key={p.name} value={p.name}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })()}
                </div>

                <div>
                  {(() => {
                    const s = getFieldSetting('city', 'OFFICE');
                    return (
                      <div>
                        <label className="text-xs font-extrabold text-slate-800 block mb-1.5">
                          {s.label}
                          {s.isRequired && <span className="text-rose-500 mr-1">*</span>}
                        </label>
                        <select
                          disabled={!s.isEditable}
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500"
                        >
                          {countyList.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Custom type title if OTHER */}
              {type === 'OTHER' && (
                <div>
                  <label className="text-xs font-extrabold text-slate-800 block mb-1.5">
                    عنوان نوع دفتر سفارشی:
                  </label>
                  <input
                    type="text"
                    value={customTypeName}
                    onChange={(e) => setCustomTypeName(e.target.value)}
                    placeholder="مثال: باجه صدور گواهی گمرک"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900"
                  />
                </div>
              )}

              {/* Address */}
              <div>
                {(() => {
                  const s = getFieldSetting('address', 'OFFICE');
                  return (
                    <div>
                      <label className="text-xs font-extrabold text-slate-800 block mb-1.5">
                        {s.label}
                        {s.isRequired && <span className="text-rose-500 mr-1">*</span>}
                      </label>
                      <textarea
                        rows={2}
                        disabled={!s.isEditable}
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  );
                })()}
              </div>

              {/* Phone, Email, Coordinates */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  {(() => {
                    const s = getFieldSetting('phone', 'OFFICE');
                    return (
                      <div>
                        <label className="text-xs font-extrabold text-slate-800 block mb-1.5">
                          {s.label}
                          {s.isRequired && <span className="text-rose-500 mr-1">*</span>}
                        </label>
                        <input
                          type="text"
                          disabled={!s.isEditable}
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="021-88765432"
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 font-mono"
                        />
                      </div>
                    );
                  })()}
                </div>

                <div>
                  {(() => {
                    const s = getFieldSetting('email', 'OFFICE');
                    return (
                      <div>
                        <label className="text-xs font-extrabold text-slate-800 block mb-1.5">
                          {s.label}
                          {s.isRequired && <span className="text-rose-500 mr-1">*</span>}
                        </label>
                        <input
                          type="email"
                          disabled={!s.isEditable}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="info@office.ir"
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 font-mono"
                        />
                      </div>
                    );
                  })()}
                </div>

                <div>
                  {(() => {
                    const s = getFieldSetting('coordinates', 'OFFICE');
                    return (
                      <div>
                        <label className="text-xs font-extrabold text-slate-800 block mb-1.5">
                          مختصات نقشه (Lat, Lng):
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                          <input
                            type="number"
                            step="0.0001"
                            disabled={!s.isEditable}
                            value={latitude}
                            onChange={(e) => setLatitude(e.target.value)}
                            placeholder="Lat"
                            className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs font-mono"
                          />
                          <input
                            type="number"
                            step="0.0001"
                            disabled={!s.isEditable}
                            value={longitude}
                            onChange={(e) => setLongitude(e.target.value)}
                            placeholder="Lng"
                            className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs font-mono"
                          />
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Notes */}
              <div>
                {(() => {
                  const s = getFieldSetting('notes', 'OFFICE');
                  return (
                    <div>
                      <label className="text-xs font-extrabold text-slate-800 block mb-1.5">
                        {s.label}
                      </label>
                      <textarea
                        rows={2}
                        disabled={!s.isEditable}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="توضیحات تکمیلی یا وضعیت دفتر..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs text-slate-900"
                      />
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* TAB 2: MANAGER PROFILE */}
          {activeTab === 'MANAGER' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-extrabold text-slate-800 block mb-1.5 flex items-center justify-between">
                    <span>شناسه یکتای مسئول:</span>
                    <span className="text-[10px] text-slate-400 font-mono">سیستمی</span>
                  </label>
                  <input
                    type="text"
                    disabled
                    value={managerCode}
                    className="w-full bg-slate-100 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs text-slate-600 font-mono cursor-not-allowed font-bold"
                  />
                </div>

                <div>
                  {(() => {
                    const s = getFieldSetting('nationalId', 'MANAGER');
                    return (
                      <div>
                        <label className="text-xs font-extrabold text-slate-800 block mb-1.5">
                          {s.label}
                          {s.isRequired && <span className="text-rose-500 mr-1">*</span>}
                        </label>
                        <input
                          type="text"
                          disabled={!s.isEditable}
                          maxLength={10}
                          value={nationalId}
                          onChange={(e) => setNationalId(e.target.value)}
                          placeholder="0078451234"
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 font-mono"
                        />
                      </div>
                    );
                  })()}
                </div>

                <div>
                  {(() => {
                    const s = getFieldSetting('fullName', 'MANAGER');
                    return (
                      <div>
                        <label className="text-xs font-extrabold text-slate-800 block mb-1.5">
                          {s.label}
                          {s.isRequired && <span className="text-rose-500 mr-1">*</span>}
                        </label>
                        <input
                          type="text"
                          disabled={!s.isEditable}
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="نام و نام خانوادگی کامل"
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900"
                        />
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Mobile, Landline, Email */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  {(() => {
                    const s = getFieldSetting('mobilePhone', 'MANAGER');
                    return (
                      <div>
                        <label className="text-xs font-extrabold text-slate-800 block mb-1.5">
                          {s.label}
                          {s.isRequired && <span className="text-rose-500 mr-1">*</span>}
                        </label>
                        <input
                          type="text"
                          disabled={!s.isEditable}
                          value={mobilePhone}
                          onChange={(e) => setMobilePhone(e.target.value)}
                          placeholder="09121112233"
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 font-mono"
                        />
                      </div>
                    );
                  })()}
                </div>

                <div>
                  {(() => {
                    const s = getFieldSetting('landlinePhone', 'MANAGER');
                    return (
                      <div>
                        <label className="text-xs font-extrabold text-slate-800 block mb-1.5">
                          {s.label}
                          {s.isRequired && <span className="text-rose-500 mr-1">*</span>}
                        </label>
                        <input
                          type="text"
                          disabled={!s.isEditable}
                          value={landlinePhone}
                          onChange={(e) => setLandlinePhone(e.target.value)}
                          placeholder="021-88765432"
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 font-mono"
                        />
                      </div>
                    );
                  })()}
                </div>

                <div>
                  {(() => {
                    const s = getFieldSetting('email', 'MANAGER');
                    return (
                      <div>
                        <label className="text-xs font-extrabold text-slate-800 block mb-1.5">
                          {s.label}
                          {s.isRequired && <span className="text-rose-500 mr-1">*</span>}
                        </label>
                        <input
                          type="email"
                          disabled={!s.isEditable}
                          value={managerEmail}
                          onChange={(e) => setManagerEmail(e.target.value)}
                          placeholder="manager@domain.ir"
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 font-mono"
                        />
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Appointment Date & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  {(() => {
                    const s = getFieldSetting('appointmentDate', 'MANAGER');
                    return (
                      <div>
                        <label className="text-xs font-extrabold text-slate-800 block mb-1.5">
                          {s.label}
                          {s.isRequired && <span className="text-rose-500 mr-1">*</span>}
                        </label>
                        <input
                          type="text"
                          disabled={!s.isEditable}
                          value={appointmentDate}
                          onChange={(e) => setAppointmentDate(e.target.value)}
                          placeholder="1403/01/15"
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 font-mono"
                        />
                      </div>
                    );
                  })()}
                </div>

                <div className="sm:col-span-2">
                  {(() => {
                    const s = getFieldSetting('notes', 'MANAGER');
                    return (
                      <div>
                        <label className="text-xs font-extrabold text-slate-800 block mb-1.5">
                          {s.label}
                        </label>
                        <input
                          type="text"
                          disabled={!s.isEditable}
                          value={managerNotes}
                          onChange={(e) => setManagerNotes(e.target.value)}
                          placeholder="سوابق، دوره‌های آموزشی و مدارک تایید صلاحیت..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900"
                        />
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Form Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>کلیه تغییرات در تایم‌لاین سیستمی دفتر ثبت می‌گردد</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-100 rounded-xl font-bold transition cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs transition cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{saveSuccess ? 'ذخیره شد!' : 'ذخیره مشخصات دفتر و مسئول'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
