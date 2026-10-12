import React, { useEffect, useRef, useState } from 'react';
import { 
  X, 
  MapPin, 
  Search, 
  Check, 
  Crosshair, 
  Maximize2, 
  Navigation,
  Globe2,
  Building2,
  HelpCircle
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { IRAN_PROVINCES } from '../data/iranGeoData';

// Fix Leaflet's default icon path issues with Webpack/Vite
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface IranLocationPickerModalProps {
  initialLat?: number;
  initialLng?: number;
  province?: string;
  city?: string;
  officeName?: string;
  onSelectLocation: (lat: number, lng: number) => void;
  onClose: () => void;
}

export const IranLocationPickerModal: React.FC<IranLocationPickerModalProps> = ({
  initialLat,
  initialLng,
  province,
  city,
  officeName,
  onSelectLocation,
  onClose,
}) => {
  // Find initial province center if no exact coordinates
  const matchedProv = IRAN_PROVINCES.find(p => p.name === province || (province && province.includes(p.name)));
  const defaultLat = initialLat || matchedProv?.centerLat || 35.6892;
  const defaultLng = initialLng || matchedProv?.centerLng || 51.3890;
  const defaultZoom = initialLat ? 14 : (matchedProv?.zoom || 11);

  const [lat, setLat] = useState<number>(defaultLat);
  const [lng, setLng] = useState<number>(defaultLng);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedProvinceName, setSelectedProvinceName] = useState<string>(province || 'تهران');

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Clean up if already initialized
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
    }

    // Initialize Leaflet map
    const map = L.map(mapContainerRef.current, {
      center: [defaultLat, defaultLng],
      zoom: defaultZoom,
      zoomControl: true,
    });

    // Add Tile Layer (CartoDB Positron / OSM tiles for crisp Persian labels)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    // Add Draggable Marker
    const marker = L.marker([defaultLat, defaultLng], {
      icon: defaultIcon,
      draggable: true,
      autoPan: true,
    }).addTo(map);

    marker.bindPopup(`
      <div style="font-family: Vazirmatn, sans-serif; text-align: right; direction: rtl; font-size: 12px; line-height: 1.6;">
        <strong style="color: #047857;">${officeName || 'موقعیت دفتر ثبت نام'}</strong><br/>
        <span>موقعیت انتخابی را با کشیدن پین تنظیم کنید.</span>
      </div>
    `).openPopup();

    // Event on drag end
    marker.on('dragend', () => {
      const position = marker.getLatLng();
      setLat(Number(position.lat.toFixed(6)));
      setLng(Number(position.lng.toFixed(6)));
    });

    // Event on click map anywhere
    map.on('click', (e: L.LeafletMouseEvent) => {
      const clickedLat = Number(e.latlng.lat.toFixed(6));
      const clickedLng = Number(e.latlng.lng.toFixed(6));
      setLat(clickedLat);
      setLng(clickedLng);
      marker.setLatLng([clickedLat, clickedLng]);
      marker.openPopup();
    });

    mapInstanceRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Jump map to a specific province
  const handleJumpToProvince = (provName: string) => {
    setSelectedProvinceName(provName);
    const prov = IRAN_PROVINCES.find(p => p.name === provName);
    if (prov && mapInstanceRef.current && markerRef.current) {
      mapInstanceRef.current.flyTo([prov.centerLat, prov.centerLng], prov.zoom, { duration: 1.2 });
      markerRef.current.setLatLng([prov.centerLat, prov.centerLng]);
      setLat(prov.centerLat);
      setLng(prov.centerLng);
    }
  };

  // Recenter to current pin
  const handleRecenter = () => {
    if (mapInstanceRef.current && markerRef.current) {
      mapInstanceRef.current.setView([lat, lng], 15);
      markerRef.current.setLatLng([lat, lng]);
    }
  };

  // Confirm and Save
  const handleConfirm = () => {
    onSelectLocation(lat, lng);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 my-4">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-2xs">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <span>انتخاب موقعیت جغرافیایی روی نقشه ایران</span>
                {officeName && <span className="text-xs text-slate-500 font-normal">({officeName})</span>}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                روی نقشه کلیک کنید یا پین را بکشید تا مختصات دقیق دفتر ثبت نام مشخص شود.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Toolbar */}
        <div className="p-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Province Fast Jump Selector */}
          <div className="flex items-center gap-2">
            <Globe2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-slate-600 font-semibold">پرش سریع به استان:</span>
            <select
              value={selectedProvinceName}
              onChange={(e) => handleJumpToProvince(e.target.value)}
              className="bg-slate-100 border border-slate-200 text-slate-900 rounded-xl px-3 py-1.5 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer text-xs"
            >
              {IRAN_PROVINCES.map(p => (
                <option key={p.name} value={p.name}>
                  استان {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Coordinates readout and actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 font-mono bg-slate-100 border border-slate-200 px-3 py-1 rounded-xl text-[11px] text-slate-700">
              <span>عرض: <strong className="text-slate-900">{lat}</strong></span>
              <span>•</span>
              <span>طول: <strong className="text-slate-900">{lng}</strong></span>
            </div>

            <button
              type="button"
              onClick={handleRecenter}
              className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2.5 py-1.5 rounded-xl border border-slate-200 transition"
              title="بزرگنمایی و تمرکز روی پین"
            >
              <Crosshair className="w-3.5 h-3.5 text-emerald-600" />
              <span>تمرکز روی نشانگر</span>
            </button>
          </div>
        </div>

        {/* Map View Canvas Container */}
        <div className="relative flex-1 min-h-[380px] sm:min-h-[460px] bg-slate-100">
          <div ref={mapContainerRef} className="w-full h-full absolute inset-0 z-10" />

          {/* Hint Overlay */}
          <div className="absolute bottom-4 right-4 z-20 bg-white/90 backdrop-blur-xs border border-slate-200 rounded-2xl p-2.5 shadow-md flex items-center gap-2 text-xs text-slate-700 pointer-events-none">
            <HelpCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>با کلیک روی هر نقطه یا جابجایی نشانگر، موقعیت دفتر ذخیره می‌گردد.</span>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            استان منتخب: <strong className="text-slate-800">{selectedProvinceName}</strong> {city ? `• شهرستان: ${city}` : ''}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition"
            >
              انصراف
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-xs transition"
            >
              <Check className="w-4 h-4" />
              <span>تایید موقعیت جغرافیایی</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
