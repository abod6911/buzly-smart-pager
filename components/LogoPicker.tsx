'use client';

import React, { useState, useRef } from 'react';
import {
  Upload,
  Image as ImageIcon,
  Check,
  X,
  Sparkles,
  Link as LinkIcon,
  Coffee,
  Utensils,
  Pizza,
  Cake,
  Flame,
  Wine,
  Crown,
  Smile,
} from 'lucide-react';

// Curated high-resolution SVG Preset Logos for instant restaurant branding
export const PRESET_LOGOS = [
  {
    id: 'coffee',
    name: 'كافيه وقهوة مختصة',
    icon: Coffee,
    // Stylized SVG Data URI
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="24" fill="%23451A03"/><circle cx="50" cy="50" r="32" fill="%2378350F"/><path d="M35 62h30c1.1 0 2-.9 2-2V45H33v15c0 1.1.9 2 2 2zm32-13h6c2.2 0 4-1.8 4-4s-1.8-4-4-4h-6v8zm-29 17h24v2H38v-2zM42 36c-1-2-1-4 0-6m8 6c-1-2-1-4 0-6m8 6c-1-2-1-4 0-6" stroke="%23FDE68A" stroke-width="3" stroke-linecap="round"/></svg>',
  },
  {
    id: 'burger',
    name: 'برجر ووجبات سريعة',
    icon: Utensils,
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="24" fill="%23831843"/><circle cx="50" cy="50" r="32" fill="%239D174D"/><path d="M30 46c0-11 9-18 20-18s20 7 20 18H30zm-2 18c0 4 8 8 22 8s22-4 22-8H28zm-2-8c4 3 8 0 12 3s8 0 12 3 8 0 12 3 8 0 12 3v3H26v-3z" fill="%23FDE047"/><circle cx="42" cy="38" r="1.5" fill="%23fff"/><circle cx="50" cy="35" r="1.5" fill="%23fff"/><circle cx="58" cy="38" r="1.5" fill="%23fff"/></svg>',
  },
  {
    id: 'pizza',
    name: 'بيتزا ومعجنات إيطالية',
    icon: Pizza,
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="24" fill="%237F1D1D"/><circle cx="50" cy="50" r="32" fill="%23991B1B"/><path d="M50 26L74 70c-8 4-40 4-48 0L50 26z" fill="%23FBBF24"/><path d="M26 70c8 4 40 4 48 0" stroke="%23B45309" stroke-width="5" stroke-linecap="round"/><circle cx="48" cy="46" r="3.5" fill="%23DC2626"/><circle cx="56" cy="58" r="3" fill="%23DC2626"/><circle cx="42" cy="60" r="2.5" fill="%23DC2626"/><circle cx="52" cy="38" r="1.5" fill="%2316A34A"/><circle cx="45" cy="52" r="1.5" fill="%2316A34A"/><circle cx="58" cy="48" r="1.5" fill="%2316A34A"/></svg>',
  },
  {
    id: 'sweets',
    name: 'حلويات ومخبز فرنسي',
    icon: Cake,
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="24" fill="%234A044E"/><circle cx="50" cy="50" r="32" fill="%23701A75"/><path d="M32 50h36v20a4 4 0 01-4 4H36a4 4 0 01-4-4V50z" fill="%23F472B6"/><path d="M32 50c3 3 6 3 9 0s6-3 9 0 6 3 9 0 6-3 9 0v-6H32v6z" fill="%23FBCFE8"/><path d="M48 36h4v8h-4z" fill="%23E0E7FF"/><circle cx="50" cy="32" r="3" fill="%23F59E0B"/></svg>',
  },
  {
    id: 'grill',
    name: 'مشاوي ولحوم فاخرة',
    icon: Flame,
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="24" fill="%231E293B"/><circle cx="50" cy="50" r="32" fill="%230F172A"/><path d="M50 26c4 8 16 16 16 26a16 16 0 11-32 0c0-6 4-12 8-16 0 4 2 8 8 10z" fill="%23EA580C"/><path d="M50 42c2 4 8 8 8 13a8 8 0 11-16 0c0-3 2-6 4-8 0 2 1 4 4 5z" fill="%23FACC15"/></svg>',
  },
  {
    id: 'drinks',
    name: 'عصائر ومشروبات باردة',
    icon: Wine,
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="24" fill="%23064E3B"/><circle cx="50" cy="50" r="32" fill="%23065F46"/><path d="M35 34l8 36h14l8-36H35z" fill="%2334D399"/><path d="M56 22l-6 12" stroke="%23FDE047" stroke-width="3" stroke-linecap="round"/><circle cx="46" cy="46" r="3" fill="%23fff" fill-opacity="0.5"/><circle cx="52" cy="56" r="2.5" fill="%23fff" fill-opacity="0.5"/></svg>',
  },
  {
    id: 'lounge',
    name: 'شعار ذهبي ملكي (Lounge)',
    icon: Crown,
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="24" fill="%2318181B"/><circle cx="50" cy="50" r="32" fill="%2327272A"/><path d="M32 62h36l4-24-12 8-10-14-10 14-12-8 4 24z" fill="%23F59E0B"/><circle cx="50" cy="32" r="2" fill="%23FDE68A"/><circle cx="32" cy="38" r="2" fill="%23FDE68A"/><circle cx="68" cy="38" r="2" fill="%23FDE68A"/><rect x="34" y="64" width="32" height="3" rx="1.5" fill="%23D97706"/></svg>',
  },
  {
    id: 'fun',
    name: 'كافيه عصري ومرح',
    icon: Smile,
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="24" fill="%231E1B4B"/><circle cx="50" cy="50" r="32" fill="%23312E81"/><circle cx="50" cy="50" r="22" fill="%23FBBF24"/><circle cx="43" cy="46" r="2.5" fill="%231E1B4B"/><circle cx="57" cy="46" r="2.5" fill="%231E1B4B"/><path d="M41 54c3 4 15 4 18 0" stroke="%231E1B4B" stroke-width="3" stroke-linecap="round"/></svg>',
  },
];

interface LogoPickerProps {
  value: string;
  onChange: (url: string) => void;
  restaurantName?: string;
  themeColor?: string;
}

export const LogoPicker: React.FC<LogoPickerProps> = ({
  value,
  onChange,
  restaurantName = 'المتجر',
  themeColor = '#10B981',
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'presets' | 'url'>('upload');
  const [urlInput, setUrlInput] = useState<string>(value.startsWith('data:') ? '' : value);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // File Upload & Canvas Resizer to optimize Base64 data (<200KB)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('الرجاء اختيار ملف صورة صالح (PNG, JPG, WEBP, SVG)');
      return;
    }

    setIsProcessing(true);
    setUploadError(null);

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const rawDataUrl = event.target?.result as string;

        // If SVG, keep as is
        if (file.type === 'image/svg+xml') {
          onChange(rawDataUrl);
          setIsProcessing(false);
          return;
        }

        // Optimize raster images using Canvas
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 400; // 400x400 is ideal for TV and phone avatars
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const optimized = canvas.toDataURL('image/webp', 0.88);
            onChange(optimized);
          } else {
            onChange(rawDataUrl);
          }
          setIsProcessing(false);
        };
        img.onerror = () => {
          onChange(rawDataUrl);
          setIsProcessing(false);
        };
        img.src = rawDataUrl;
      };
      reader.onerror = () => {
        setUploadError('تعذر قراءة ملف الصورة');
        setIsProcessing(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setUploadError('حدث خطأ أثناء معالجة الصورة');
      setIsProcessing(false);
    }
  };

  const handleClear = () => {
    onChange('');
    setUrlInput('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleApplyUrl = () => {
    if (urlInput.trim()) {
      onChange(urlInput.trim());
    }
  };

  return (
    <div className="bg-[#121216] border border-white/[0.08] rounded-2xl p-4 sm:p-5 space-y-4">
      {/* 1. Header with Current Logo Preview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl overflow-hidden bg-[#18181C] border-2 border-white/10 flex items-center justify-center shadow-lg shrink-0">
              {value ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={value} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-white font-bold text-lg select-none"
                  style={{ backgroundColor: themeColor }}
                >
                  {(restaurantName || 'م').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            {value && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#121216] flex items-center justify-center text-[9px] text-black font-black">
                ✓
              </span>
            )}
          </div>

          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>شعار المطعم / الكافيه</span>
              <span className="text-[10px] text-zinc-400 font-normal">
                (يظهر في شاشة الـ TV وهاتف العميل)
              </span>
            </h4>
            <p className="text-xs text-zinc-400 mt-0.5">
              {value ? 'تم تحديد شعار للمتجر بنجاح' : 'لم يتم اختيار شعار (يُعرض الحرف الأول كبديل)'}
            </p>
          </div>
        </div>

        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="self-start sm:self-center text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            <span>حذف الشعار الحالي</span>
          </button>
        )}
      </div>

      {/* 2. Navigation Tabs for Logo Source */}
      <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#18181C] rounded-xl border border-white/[0.06] text-xs font-medium">
        <button
          type="button"
          onClick={() => setActiveTab('upload')}
          className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === 'upload'
              ? 'bg-zinc-800 text-white font-bold shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Upload className="w-3.5 h-3.5 text-emerald-400" />
          <span>رفع من جهازك</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('presets')}
          className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === 'presets'
              ? 'bg-zinc-800 text-white font-bold shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>شعارات جاهزة</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('url')}
          className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === 'url'
              ? 'bg-zinc-800 text-white font-bold shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <LinkIcon className="w-3.5 h-3.5 text-sky-400" />
          <span>رابط خارجي</span>
        </button>
      </div>

      {/* 3. Tab Contents */}

      {/* TAB A: DIRECT FILE UPLOAD */}
      {activeTab === 'upload' && (
        <div className="space-y-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-white/15 hover:border-emerald-500/50 bg-[#16161A] hover:bg-[#18181E] rounded-2xl p-6 text-center cursor-pointer transition-all group"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform">
              <Upload className="w-6 h-6" />
            </div>

            <p className="text-sm font-bold text-white mb-1">
              انقر هنا لاختيار صورة الشعار من جوالك أو كمبيوترك
            </p>
            <p className="text-xs text-zinc-400">
              يدعم PNG, JPG, WEBP, SVG (يتم تحسين الحجم تلقائياً بأعلى دقة)
            </p>

            {isProcessing && (
              <div className="mt-3 flex items-center justify-center gap-2 text-xs text-emerald-400 font-medium">
                <span className="w-3 h-3 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
                <span>جارِ معالجة وتحسين الشعار...</span>
              </div>
            )}
          </div>

          {uploadError && (
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl">
              {uploadError}
            </p>
          )}
        </div>
      )}

      {/* TAB B: READY PRESET LOGOS */}
      {activeTab === 'presets' && (
        <div className="space-y-2">
          <p className="text-xs text-zinc-400">
            اختر شعاراً يناسب نوع نشاطك ليظهر فوراً على شاشات التلفزيون وهواتف العملاء:
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {PRESET_LOGOS.map((item) => {
              const isSelected = value === item.url;
              const IconComp = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onChange(item.url)}
                  className={`p-2.5 rounded-2xl border text-right transition-all flex flex-col items-center gap-2 relative cursor-pointer ${
                    isSelected
                      ? 'border-emerald-400 bg-emerald-950/20 shadow-md ring-1 ring-emerald-500/50'
                      : 'border-white/[0.08] bg-[#16161A] hover:bg-[#1A1A20] hover:border-white/20'
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center shadow-inner">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.url} alt={item.name} className="w-full h-full object-contain" />
                  </div>

                  <span className="text-[11px] font-bold text-zinc-200 text-center line-clamp-1">
                    {item.name}
                  </span>

                  {isSelected && (
                    <span className="absolute top-2 left-2 w-4 h-4 rounded-full bg-emerald-500 text-black flex items-center justify-center text-[10px] font-black">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB C: DIRECT URL INPUT */}
      {activeTab === 'url' && (
        <div className="space-y-2.5">
          <label className="block text-xs text-zinc-300 font-medium">
            أدخل رابط الشعار المباشر (Direct Image URL):
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              dir="ltr"
              placeholder="https://example.com/logo.png"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="flex-1 bg-[#18181C] border border-white/[0.1] rounded-xl px-3.5 py-2 text-xs text-white font-mono placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={handleApplyUrl}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition-colors shrink-0"
            >
              تطبيق
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
