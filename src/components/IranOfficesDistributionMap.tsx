import React, { useEffect, useRef, useState, useMemo } from 'react';
import { 
  Building2, 
  MapPin, 
  Search, 
  Phone, 
  User, 
  Mail, 
  Layers, 
  Filter, 
  Navigation,
  Globe,
  Sparkles,
  ExternalLink,
  History,
  AlertTriangle,
  FileText,
  Clock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Ban
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { OfficeProfile, OfficeManager, OfficeTypeDefinition } from '../types';
import { IRAN_PROVINCES } from '../data/iranGeoData';

interface IranOfficesDistributionMapProps {
  offices: OfficeProfile[];
  managers: OfficeManager[];
  officeTypes: OfficeTypeDefinition[];
  onSelectOffice?: (office: OfficeProfile) => void;
  onOpenTimeline?: (office: OfficeProfile) => void;
  onOpenCard?: (office: OfficeProfile) => void;
}

export const IranOfficesDistributionMap: React.FC<IranOfficesDistributionMapProps> = ({
  offices,
  managers,
  officeTypes,
  onSelectOffice,
  onOpenTimeline,
  onOpenCard,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const markerMapRef = useRef<Map<string, L.Marker>>(new Map());

  const [selectedProvince, setSelectedProvince] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedOfficeCode, setSelectedOfficeCode] = useState<string>('');
  const [highlightedOffice, setHighlightedOffice] = useState<OfficeProfile | null>(null);

  // Filter offices based on selections
  const filteredOffices = useMemo(() => {
    return offices.filter((office) => {
      if (selectedProvince !== 'ALL' && office.province !== selectedProvince) return false;
      if (selectedType !== 'ALL' && office.type !== selectedType) return false;
      if (selectedStatus !== 'ALL' && (office.status || 'ACTIVE') !== selectedStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = office.name.toLowerCase().includes(q);
        const matchCode = String(office.code).toLowerCase().includes(q);
        const matchManager = (office.managerName || '').toLowerCase().includes(q);
        const matchCity = (office.city || '').toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchManager && !matchCity) return false;
      }
      return true;
    });
  }, [offices, selectedProvince, selectedType, selectedStatus, searchQuery]);

  // Get color for office based on status and type
  const getOfficeColor = (office: OfficeProfile): string => {
    if (office.status === 'REVOKED') return '#ef4444'; // Red
    if (office.status === 'SUSPENDED') return '#f59e0b'; // Amber / Orange
    if (office.status === 'INACTIVE') return '#64748b'; // Slate / Gray

    switch (office.type) {
      case 'PRESHKHAN': return '#059669'; // Emerald
      case 'NOTARY': return '#d97706';    // Amber
      case 'EDUCATION': return '#2563eb'; // Blue
      case 'ORGANIZATION': return '#0891b2'; // Cyan
      default: return '#8b5cf6';          // Violet/Other
    }
  };

  // Helper for Status Badge
  const renderStatusBadge = (status?: string) => {
    switch (status) {
      case 'SUSPENDED':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3 h-3" />
            <span>تعلیق شده</span>
          </span>
        );
      case 'REVOKED':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
            <Ban className="w-3 h-3" />
            <span>ابطال شده</span>
          </span>
        );
      case 'INACTIVE':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300">
            <XCircle className="w-3 h-3" />
            <span>غیرفعال</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3" />
            <span>فعال</span>
          </span>
        );
    }
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
    }

    const map = L.map(mapContainerRef.current, {
      center: [32.4279, 53.6880], // Geographic center of Iran
      zoom: 5.5,
      zoomControl: true,
      minZoom: 4.5,
      maxZoom: 18,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    markersLayerGroupRef.current = layerGroup;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Markers whenever filteredOffices change
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerGroupRef.current) return;

    markersLayerGroupRef.current.clearLayers();
    markerMapRef.current.clear();

    filteredOffices.forEach((office) => {
      const lat = office.latitude || 35.6892;
      const lng = office.longitude || 51.3890;
      const color = getOfficeColor(office);
      const isSuspended = office.status === 'SUSPENDED';
      const isRevoked = office.status === 'REVOKED';

      // Create Custom SVG Circle Marker with pulsing effect for suspended/revoked
      const customIcon = L.divIcon({
        className: 'custom-office-pin',
        html: `
          <div style="
            background-color: ${color};
            width: 24px;
            height: 24px;
            border-radius: 50%;
            border: 2.5px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 10px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.2s;
            ${isSuspended ? 'outline: 3px solid #f59e0b;' : ''}
            ${isRevoked ? 'outline: 3px solid #ef4444;' : ''}
          " onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'">
            ${isSuspended ? '⚠️' : isRevoked ? '✕' : ''}
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -14],
      });

      const marker = L.marker([lat, lng], { icon: customIcon });

      const statusHtml = office.status === 'SUSPENDED' 
        ? '<span style="background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 10px; border: 1px solid #fcd34d;">⚠️ تعلیق شده</span>'
        : office.status === 'REVOKED'
        ? '<span style="background: #ffe4e6; color: #9f1239; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 10px; border: 1px solid #fda4af;">✕ ابطال شده</span>'
        : office.status === 'INACTIVE'
        ? '<span style="background: #f1f5f9; color: #475569; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 10px;">غیرفعال</span>'
        : '<span style="background: #dcfce7; color: #166534; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 10px;">فعال</span>';

      const popupContent = `
        <div style="font-family: Vazirmatn, sans-serif; text-align: right; direction: rtl; min-width: 250px; padding: 4px; line-height: 1.6;">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 6px;">
            <strong style="color: #0f172a; font-size: 13px;">${office.name}</strong>
            ${statusHtml}
          </div>
          <div style="font-size: 11px; color: #475569; margin-bottom: 3px;">
            <strong>کد دفتر:</strong> <span style="font-family: monospace; font-weight: bold; color: #0f172a;">${office.code}</span>
          </div>
          <div style="font-size: 11px; color: #475569; margin-bottom: 3px;">
            <strong>مسئول دفتر:</strong> <span style="color: #0f172a; font-weight: 600;">${office.managerName || 'نامشخص'}</span>
          </div>
          <div style="font-size: 11px; color: #475569; margin-bottom: 3px;">
            <strong>شماره موبایل:</strong> <span style="font-family: monospace; direction: ltr; display: inline-block;">${office.managerMobile || '-'}</span>
          </div>
          <div style="font-size: 11px; color: #475569; margin-bottom: 3px;">
            <strong>تلفن ثابت:</strong> <span style="font-family: monospace; direction: ltr; display: inline-block;">${office.phone || '-'}</span>
          </div>
          <div style="font-size: 10px; color: #64748b; margin-top: 6px; background-color: #f8fafc; padding: 5px 8px; border-radius: 6px;">
            📍 ${office.province}، ${office.city} - ${office.address || ''}
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      marker.on('click', () => {
        setHighlightedOffice(office);
        setSelectedOfficeCode(office.code);
        if (onSelectOffice) onSelectOffice(office);
      });

      markersLayerGroupRef.current?.addLayer(marker);
      markerMapRef.current.set(office.code, marker);
    });
  }, [filteredOffices]);

  // Jump to selected office on map when user picks from dropdown
  const handleSelectOfficeByName = (code: string) => {
    setSelectedOfficeCode(code);
    if (!code) {
      setHighlightedOffice(null);
      return;
    }

    const office = offices.find(o => o.code === code);
    if (office && mapInstanceRef.current) {
      setHighlightedOffice(office);
      const lat = office.latitude || 35.6892;
      const lng = office.longitude || 51.3890;
      
      mapInstanceRef.current.flyTo([lat, lng], 14, { duration: 1.5 });
      
      const marker = markerMapRef.current.get(code);
      if (marker) {
        setTimeout(() => {
          marker.openPopup();
        }, 1200);
      }
    }
  };

  // Handle Province change and zoom
  const handleProvinceChange = (provName: string) => {
    setSelectedProvince(provName);
    if (provName === 'ALL') {
      mapInstanceRef.current?.flyTo([32.4279, 53.6880], 5.5, { duration: 1 });
    } else {
      const prov = IRAN_PROVINCES.find(p => p.name === provName);
      if (prov && mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([prov.centerLat, prov.centerLng], prov.zoom, { duration: 1.2 });
      }
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs space-y-4 p-5 sm:p-6">
      {/* Top Header & Search Bar */}
      <div className="space-y-4 border-b border-slate-100 pb-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Globe className="w-5 h-5 text-emerald-600" />
              <span>نقشه تعاملی و موقعیت‌یابی کل دفاتر ثبت نام (RA)</span>
              <span className="text-xs bg-emerald-50 text-emerald-700 font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                {filteredOffices.length} دفتر
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              مشاهده موقعیت مکانی دفاتر روی نقشه ایران، جستجو و انتخاب مستقیم بر اساس نام دفتر، مشاهده وضعیت فعالیت و اطلاعات تماس مسئولین
            </p>
          </div>

          {/* Quick Select Office By Name Dropdown */}
          <div className="w-full lg:w-80">
            <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              <span>انتخاب مستقیم نام دفتر و پرش روی نقشه:</span>
            </label>
            <select
              id="select-office-on-map"
              value={selectedOfficeCode}
              onChange={(e) => handleSelectOfficeByName(e.target.value)}
              className="w-full bg-emerald-50/70 border border-emerald-300 text-slate-900 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-xs"
            >
              <option value="">-- برای نمایش روی نقشه کلیک کنید --</option>
              {offices.map((off) => (
                <option key={off.code} value={off.code}>
                  کد {off.code} - {off.name} ({off.province} - {off.status === 'SUSPENDED' ? 'تعلیق' : off.status === 'REVOKED' ? 'ابطال' : 'فعال'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] sm:w-60">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              placeholder="جستجوی نام دفتر، کد یا مسئول..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans"
            />
          </div>

          {/* Province Filter */}
          <select
            value={selectedProvince}
            onChange={(e) => handleProvinceChange(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="ALL">همه استان‌ها (۳۱ استان)</option>
            {IRAN_PROVINCES.map(p => (
              <option key={p.name} value={p.name}>استان {p.name}</option>
            ))}
          </select>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="ALL">همه انواع دفاتر</option>
            {officeTypes.map(t => (
              <option key={t.code} value={t.code}>{t.title}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="ALL">همه وضعیت‌ها</option>
            <option value="ACTIVE">فقط فعال</option>
            <option value="SUSPENDED">فقط تعلیق شده</option>
            <option value="REVOKED">فقط ابطال شده</option>
            <option value="INACTIVE">فقط غیرفعال</option>
          </select>
        </div>
      </div>

      {/* Map Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-bold text-slate-900">راهنمای انواع:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block"></span>
            <span>پیشخوان دولت</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
            <span>اسناد رسمی</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-blue-600 inline-block"></span>
            <span>مرکز آموزش</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-cyan-600 inline-block"></span>
            <span>سازمان/شرکت</span>
          </div>
        </div>

        <div className="flex items-center gap-3 border-r border-slate-200 pr-3">
          <span className="font-bold text-slate-900">وضعیت‌ها:</span>
          <div className="flex items-center gap-1.5 text-amber-700 font-medium">
            <span className="w-3 h-3 rounded-full bg-amber-500 ring-2 ring-amber-300 inline-block"></span>
            <span>تعلیق شده</span>
          </div>
          <div className="flex items-center gap-1.5 text-rose-700 font-medium">
            <span className="w-3 h-3 rounded-full bg-rose-600 ring-2 ring-rose-300 inline-block"></span>
            <span>ابطال شده</span>
          </div>
        </div>
      </div>

      {/* Map Stage */}
      <div className="relative w-full h-[480px] sm:h-[580px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
        <div ref={mapContainerRef} className="w-full h-full absolute inset-0 z-10" />

        {/* Selected Office Quick Card (Floating bottom left) */}
        {highlightedOffice && (
          <div className="absolute bottom-4 left-4 z-20 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-4 shadow-xl max-w-sm w-full space-y-3 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold border border-emerald-200">
                    کد {highlightedOffice.code}
                  </span>
                  {renderStatusBadge(highlightedOffice.status)}
                </div>
                <h4 className="text-xs font-black text-slate-900 mt-1">{highlightedOffice.name}</h4>
              </div>
              <button
                onClick={() => setHighlightedOffice(null)}
                className="text-slate-400 hover:text-slate-700 text-xs font-bold p-1"
                title="بستن"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-1.5 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>مسئول: <strong className="text-slate-900">{highlightedOffice.managerName}</strong></span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-400" />
                  <span>همراه:</span>
                  <strong className="font-mono text-slate-800">{highlightedOffice.managerMobile || '-'}</strong>
                </div>
                <div className="flex items-center gap-1">
                  <span>ثابت:</span>
                  <strong className="font-mono text-slate-800">{highlightedOffice.phone || '-'}</strong>
                </div>
              </div>
              {highlightedOffice.email && (
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-mono text-[11px] truncate text-slate-700">{highlightedOffice.email}</span>
                </div>
              )}
              <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                📍 {highlightedOffice.province}، {highlightedOffice.city} - {highlightedOffice.address || ''}
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2 pt-1">
              {onOpenTimeline && (
                <button
                  onClick={() => onOpenTimeline(highlightedOffice)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>تایم‌لاین بازرسی</span>
                </button>
              )}

              {onOpenCard && (
                <button
                  onClick={() => onOpenCard(highlightedOffice)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>شناسنامه دفتر</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

