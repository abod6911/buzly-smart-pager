'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import { useQueue } from '@/context/QueueContext';
import { soundManager } from '@/lib/audio';
import { ChimeSoundTheme } from '@/types/queue';
import {
  Store,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  Volume2,
  Lock,
  Palette,
  ShieldCheck,
  Building2,
} from 'lucide-react';

const COLOR_OPTIONS = [
  { name: 'زمردي فاخر (Emerald)', hex: '#10B981' },
  { name: 'كهرماني دافئ (Amber)', hex: '#F59E0B' },
  { name: 'أزرق ملكي (Royal Blue)', hex: '#3B82F6' },
  { name: 'وردي جريء (Rose)', hex: '#F43F5E' },
  { name: 'بنفسجي عصري (Purple)', hex: '#8B5CF6' },
];

const CHIME_OPTIONS: { id: ChimeSoundTheme; title: string; desc: string }[] = [
  {
    id: 'hospitality',
    title: 'جرس الضيافة الفندقي (Hotel Concierge)',
    desc: 'نغمة فاخرة متدرجة مناسبة للمطاعم واللاونجات الراقية',
  },
  {
    id: 'coffee-zen',
    title: 'نغمة الكافيه الهادئة (Coffee Zen)',
    desc: 'صوت فايبرافون عضوي دافئ ومريح لمقاهي القهوة المختصة',
  },
  {
    id: 'fast-casual',
    title: 'تنبيه سريع مرح (Fast Casual Ding)',
    desc: 'رنين واضح وحيوي للمطاعم السريعة والبرجر والشاورما',
  },
  {
    id: 'buzzer-retro',
    title: 'بيجر كلاسيكي نبضي (Classic Buzzer)',
    desc: 'محاكاة لصوت واهتزاز أجهزة البيجر البلاستيكية الشهيرة',
  },
];

export default function RestaurantOnboardingPage() {
  const router = useRouter();
  const { createRestaurant } = useQueue();

  const [name, setName] = useState<string>('');
  const [slug, setSlug] = useState<string>('');
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [themeColor, setThemeColor] = useState<string>('#10B981');
  const [staffPin, setStaffPin] = useState<string>('1234');
  const [chimeTheme, setChimeTheme] = useState<ChimeSoundTheme>('hospitality');
  const [voiceAnnounce, setVoiceAnnounce] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Auto-generate slug from name
  const handleNameChange = (val: string) => {
    setName(val);
    if (!slug || slug === cleanSlug(name)) {
      setSlug(cleanSlug(val));
    }
  };

  const cleanSlug = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[\s_]+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .slice(0, 30);
  };

  const handleTestChime = async (theme: ChimeSoundTheme) => {
    await soundManager.unlock();
    soundManager.playThemedChime(theme);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    soundManager.playSuccessTone();

    const targetSlug = slug.trim() || cleanSlug(name) || 'my-restaurant';

    try {
      await createRestaurant({
        name: name.trim(),
        slug: targetSlug,
        logoUrl: logoUrl.trim() || undefined,
        themeColor,
        staffPin: staffPin.trim() || '1234',
        whatsappFallbackEnabled: true,
        chimeTheme,
        voiceAnnounceEnabled: voiceAnnounce,
      });

      try {
        confetti({
          particleCount: 150,
          spread: 100,
          origin: { y: 0.5 },
          colors: [themeColor, '#FFFFFF', '#F59E0B'],
        });
      } catch {}

      // Automatically authenticate session for this new restaurant
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(`buzly_pin_auth_${targetSlug}`, 'true');
      }

      setTimeout(() => {
        router.push(`/${targetSlug}/admin`);
      }, 800);
    } catch (err) {
      console.error('Failed to create restaurant:', err);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-obsidian text-white flex flex-col font-cairo selection:bg-emerald-500 selection:text-black">
      {/* Header */}
      <header className="border-b border-obsidian-border bg-obsidian-surface/80 backdrop-blur-md px-4 py-4 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group text-zinc-400 hover:text-white transition-colors text-xs font-bold">
            <ArrowRight className="w-4 h-4" />
            <span>العودة للرئيسية</span>
          </Link>
          <span className="font-mono font-bold text-xs text-emerald-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> تسجيل مطعم جديد (30 ثانية)
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-4 sm:p-6 py-10 flex flex-col justify-center">
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-3xl mx-auto mb-4 flex items-center justify-center shadow-xl border border-white/10"
            style={{ backgroundColor: `${themeColor}20` }}
          >
            <Store className="w-8 h-8" style={{ color: themeColor }} />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black font-cairo text-white">
            أنشئ بيجر مطعمك الذكي الآن 🚀
          </h1>
          <p className="text-sm text-zinc-400 mt-2 max-w-md mx-auto leading-relaxed">
            احصل على رابط خاص بمطعمك، كود QR للطاولات، شاشة تلفاز حية، وكاشير سريع في ثوانٍ.
          </p>
        </div>

        {/* Form Card */}
        <form onSubmit={handleSubmit} className="bg-obsidian-surface border border-obsidian-border rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Restaurant Name */}
          <div>
            <label className="block text-xs font-bold text-zinc-200 mb-1.5">
              اسم المطعم أو المقهى <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="مثال: شاورما الريان، كافيه لافوا، برجر هاوس"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full bg-obsidian-card border border-obsidian-border rounded-2xl px-4 py-3.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Custom Slug */}
          <div>
            <label className="block text-xs font-bold text-zinc-200 mb-1.5">
              رابط المتجر بالإنجليزية (URL Slug) <span className="text-rose-400">*</span>
            </label>
            <div className="flex items-center bg-obsidian-card border border-obsidian-border rounded-2xl px-3 py-2 text-sm dir-ltr">
              <span className="text-zinc-500 font-mono text-xs select-none">buzly.app/</span>
              <input
                type="text"
                required
                placeholder="al-rayyan-shawarma"
                value={slug}
                onChange={(e) => setSlug(cleanSlug(e.target.value))}
                className="flex-1 bg-transparent border-none text-white font-mono text-sm focus:outline-none px-1"
              />
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">هذا الرابط سيفتحه زبائنك عند مسح الباركود</p>
          </div>

          {/* Logo URL */}
          <div>
            <label className="block text-xs font-bold text-zinc-200 mb-1.5">
              رابط الشعار أو صورة البراند (اختياري)
            </label>
            <input
              type="url"
              placeholder="https://example.com/logo.png"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              className="w-full bg-obsidian-card border border-obsidian-border rounded-2xl px-4 py-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 dir-ltr"
            />
          </div>

          {/* Accent Color */}
          <div>
            <label className="block text-xs font-bold text-zinc-200 mb-2">
              لون الهوية البصرية للبيجر والشاشات
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {COLOR_OPTIONS.map((c) => {
                const isSelected = themeColor.toLowerCase() === c.hex.toLowerCase();
                return (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setThemeColor(c.hex)}
                    className={`p-2.5 rounded-xl border text-right transition-all flex items-center gap-2 ${
                      isSelected
                        ? 'border-white bg-obsidian-card shadow-lg'
                        : 'border-obsidian-border bg-obsidian-card/40 hover:bg-obsidian-card'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full shadow shrink-0" style={{ backgroundColor: c.hex }} />
                    <span className="text-[11px] font-bold text-zinc-200">{c.name.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sound Theme Selection */}
          <div>
            <label className="block text-xs font-bold text-zinc-200 mb-2">
              نغمة ورنين جرس الاستدعاء
            </label>
            <div className="space-y-2">
              {CHIME_OPTIONS.map((chime) => {
                const isSelected = chimeTheme === chime.id;
                return (
                  <div
                    key={chime.id}
                    onClick={() => setChimeTheme(chime.id)}
                    className={`p-3 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-obsidian-border bg-obsidian-card hover:border-obsidian-borderHover'
                    }`}
                  >
                    <div>
                      <h4 className="text-xs font-bold text-white">{chime.title}</h4>
                      <p className="text-[11px] text-zinc-400 mt-0.5">{chime.desc}</p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTestChime(chime.id);
                      }}
                      className="p-2 rounded-xl bg-obsidian-surface hover:bg-obsidian-border text-emerald-400 transition-colors shrink-0 mr-2"
                      title="تجربة النغمة"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Staff 4-digit PIN */}
          <div>
            <label className="block text-xs font-bold text-zinc-200 mb-1">
              الرقم السري للكاشير (4 أرقام)
            </label>
            <input
              type="text"
              maxLength={4}
              value={staffPin}
              onChange={(e) => setStaffPin(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-32 bg-obsidian-card border border-obsidian-border rounded-xl px-4 py-2 text-base font-mono text-center tracking-widest text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!name.trim() || isSubmitting}
            className="w-full py-4 px-6 rounded-2xl font-black text-sm text-black flex items-center justify-center gap-2 shadow-2xl transition-all cursor-pointer active:scale-98"
            style={{ backgroundColor: themeColor }}
          >
            <span>{isSubmitting ? 'جارِ تجهيز بيجر المطعم...' : 'إنشاء وتفعيل المنظومة مجاناً'}</span>
            <ArrowLeft className="w-4 h-4 stroke-[3]" />
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-zinc-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>لا يلزم بطاقة ائتمانية • جاهز للاستخدام الفوري على الطاولات</span>
        </div>
      </main>
    </div>
  );
}
