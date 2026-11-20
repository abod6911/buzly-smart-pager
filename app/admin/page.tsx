'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueue } from '@/context/QueueContext';
import { useLanguage, LanguageSwitcher } from '@/context/LanguageContext';
import { BrandLogo } from '@/components/BrandLogo';
import { LogoPicker } from '@/components/LogoPicker';
import { soundManager } from '@/lib/audio';
import { Restaurant, ChimeSoundTheme, Order } from '@/types/queue';
import {
  Shield,
  ShieldCheck,
  Store,
  Plus,
  Search,
  Filter,
  Tv,
  Smartphone,
  BarChart3,
  ExternalLink,
  Lock,
  Unlock,
  KeyRound,
  Copy,
  Check,
  Volume2,
  Trash2,
  Edit,
  Power,
  RefreshCw,
  Download,
  Upload,
  QrCode,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Clock,
  TrendingUp,
  SlidersHorizontal,
  Flame,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Radio,
  X,
  Printer,
  FileSpreadsheet,
  Key,
  AlertTriangle,
} from 'lucide-react';
import { MuhabBrandBadge } from '@/components/MuhabBrandBadge';

const MASTER_PIN = '8888';
const AUTH_STORAGE_KEY = 'buzly_super_admin_authenticated';

const COLOR_PRESETS = [
  { name: 'زمردي كلاسيكي', hex: '#10B981' },
  { name: 'كهرماني دافئ', hex: '#F59E0B' },
  { name: 'أزرق ملكي', hex: '#3B82F6' },
  { name: 'وردي ياقوتي', hex: '#F43F5E' },
  { name: 'أرجواني عصري', hex: '#8B5CF6' },
  { name: 'فيروزي نيون', hex: '#06B6D4' },
];

const CHIME_THEMES: { id: ChimeSoundTheme; name: string; desc: string }[] = [
  {
    id: 'hospitality',
    name: 'فندقي فاخر (Hospitality)',
    desc: 'نغمات متدرجة ناعمة وعميقة',
  },
  {
    id: 'coffee-zen',
    name: 'كافيه هادئ (Coffee Zen)',
    desc: 'إيقاع ماريمبا دافئ ومتزن',
  },
  {
    id: 'fast-casual',
    name: 'كاجوال سريع (Fast Casual Ding)',
    desc: 'نغمة دينغ مزدوجة واضحة ونفاذة',
  },
  {
    id: 'buzzer-retro',
    name: 'بيجر كلاسيكي (Retro Buzzer)',
    desc: 'صوت إلكتروني مميز يحاكي البيجر التقليدي',
  },
];

export default function SuperAdminDashboard() {
  const { language, isRTL, t } = useLanguage();
  const {
    restaurants,
    orders,
    createRestaurant,
    updateRestaurant,
    deleteRestaurant,
    addOrder,
    clearQueue,
    isSupabaseActive,
    networkStatus,
    lastEvent,
    syncNow,
  } = useQueue();

  // High-Security Dual-Key Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isCheckingSession, setIsCheckingSession] = useState<boolean>(true);
  const [userInput, setUserInput] = useState<string>('');
  const [passInput, setPassInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(false);

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'idle' | 'paused'>('all');
  const [sortBy, setSortBy] = useState<'orders' | 'newest' | 'oldest' | 'name'>('orders');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null);
  const [qrModalRestaurant, setQrModalRestaurant] = useState<Restaurant | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [deleteTargetRestaurant, setDeleteTargetRestaurant] = useState<Restaurant | null>(null);

  // Card UI details
  const [visiblePins, setVisiblePins] = useState<Record<string, boolean>>({});
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [liveRadarOpen, setLiveRadarOpen] = useState<boolean>(true);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState<boolean>(false);
  const [securityData, setSecurityData] = useState<{
    status?: {
      isPasswordCustomized: boolean;
      isUserCustomized: boolean;
      isSecretCustomized: boolean;
      isSupabaseConfigured: boolean;
      currentUsername: string;
    };
    generated?: {
      recommendedUser: string;
      generatedPassword: string;
      generatedSecret: string;
    };
  } | null>(null);
  const [copiedEnv, setCopiedEnv] = useState<boolean>(false);

  // Form fields for Create / Edit
  const [formName, setFormName] = useState<string>('');
  const [formSlug, setFormSlug] = useState<string>('');
  const [formLogoUrl, setFormLogoUrl] = useState<string>('');
  const [formThemeColor, setFormThemeColor] = useState<string>('#10B981');
  const [formStaffPin, setFormStaffPin] = useState<string>('1234');
  const [formWhatsapp, setFormWhatsapp] = useState<boolean>(true);
  const [formChimeTheme, setFormChimeTheme] = useState<ChimeSoundTheme>('hospitality');
  const [formVoiceAnnounce, setFormVoiceAnnounce] = useState<boolean>(true);
  const [formIsPaused, setFormIsPaused] = useState<boolean>(false);
  const [formNotes, setFormNotes] = useState<string>('');
  const [isPlayingTestSound, setIsPlayingTestSound] = useState<boolean>(false);
  const [isSubmittingForm, setIsSubmittingForm] = useState<boolean>(false);

  // 1. Strict Server-Side Session Verification on Mount
  useEffect(() => {
    try {
      sessionStorage.removeItem('buzly_super_admin_authenticated');
    } catch {}

    fetch('/api/auth/verify-master')
      .then((res) => {
        if (res.ok) {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      })
      .catch(() => {
        setIsAuthenticated(false);
      })
      .finally(() => {
        setIsCheckingSession(false);
      });
  }, []);

  // 2. Dual-Key Auth Unlock via Cryptographic Server API
  const handleAuthSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userInput.trim() || !passInput.trim() || isAuthLoading) return;

    setIsAuthLoading(true);
    setAuthError('');

    try {
      const res = await fetch('/api/auth/verify-master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: userInput.trim(),
          password: passInput.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        soundManager.playSuccessTone();
        setIsAuthenticated(true);
        setAuthError('');
        setUserInput('');
        setPassInput('');
      } else {
        setAuthError(data.error || 'فشل التحقق الأمني من مفاتيح المالك');
        setPassInput('');
      }
    } catch {
      setAuthError('تعذر الاتصال بخادم الحماية والأمان');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsAuthenticated(false);
    setUserInput('');
    setPassInput('');
    try {
      await fetch('/api/auth/verify-master', { method: 'DELETE' });
    } catch {}
    document.cookie = 'chimer_master_token=; path=/; max-age=0;';
  };

  const showNotification = (msg: string) => {
    setActionSuccessMessage(msg);
    setTimeout(() => setActionSuccessMessage(null), 3000);
  };

  // Auto-generate slug when creating
  const handleNameChange = (val: string) => {
    setFormName(val);
    if (!editingRestaurant) {
      const generated = val
        .toLowerCase()
        .trim()
        .replace(/[\s_]+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .slice(0, 30);
      setFormSlug(generated);
    }
  };

  // Open Create Modal
  const openCreateModal = () => {
    setEditingRestaurant(null);
    setFormName('');
    setFormSlug('');
    setFormLogoUrl('');
    setFormThemeColor('#10B981');
    setFormStaffPin('1234');
    setFormWhatsapp(true);
    setFormChimeTheme('hospitality');
    setFormVoiceAnnounce(true);
    setFormIsPaused(false);
    setFormNotes('');
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (r: Restaurant) => {
    setEditingRestaurant(r);
    setFormName(r.name || '');
    setFormSlug(r.slug || '');
    setFormLogoUrl(r.logoUrl || '');
    setFormThemeColor(r.themeColor || '#10B981');
    setFormStaffPin(r.staffPin || '1234');
    setFormWhatsapp(r.whatsappFallbackEnabled ?? true);
    setFormChimeTheme(r.chimeTheme || 'hospitality');
    setFormVoiceAnnounce(r.voiceAnnounceEnabled ?? true);
    setFormIsPaused(Boolean(r.isPaused));
    setFormNotes(r.notes || '');
    setIsCreateModalOpen(true);
  };

  // Save Restaurant (Create or Edit)
  const handleSaveRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formSlug.trim()) return;

    setIsSubmittingForm(true);
    try {
      const cleanSlug = formSlug
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-]/g, '-');

      if (editingRestaurant) {
        await updateRestaurant(editingRestaurant.slug, {
          name: formName.trim(),
          logoUrl: formLogoUrl.trim(),
          themeColor: formThemeColor,
          staffPin: formStaffPin.trim() || '1234',
          whatsappFallbackEnabled: formWhatsapp,
          chimeTheme: formChimeTheme,
          voiceAnnounceEnabled: formVoiceAnnounce,
          isPaused: formIsPaused,
          notes: formNotes.trim(),
        });
        showNotification(`تم تحديث بيانات مطعم "${formName}" بنجاح ✨`);
      } else {
        await createRestaurant({
          slug: cleanSlug,
          name: formName.trim(),
          logoUrl: formLogoUrl.trim(),
          themeColor: formThemeColor,
          staffPin: formStaffPin.trim() || '1234',
          whatsappFallbackEnabled: formWhatsapp,
          chimeTheme: formChimeTheme,
          voiceAnnounceEnabled: formVoiceAnnounce,
          isPaused: formIsPaused,
          notes: formNotes.trim(),
        });
        confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
        showNotification(`تم إضافة وتدشين متجر "${formName}" بنجاح 🎉`);
      }

      setIsCreateModalOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingForm(false);
    }
  };

  // Toggle Pause status
  const handleTogglePause = async (r: Restaurant) => {
    const nextState = !r.isPaused;
    await updateRestaurant(r.slug, { isPaused: nextState });
    showNotification(
      nextState
        ? `تم إيقاف تشغيل مطعم "${r.name}" مؤقتاً ⏸️`
        : `تم إعادة تفعيل نشاط مطعم "${r.name}" بنجاح ▶️`
    );
  };

  // Inject 3 Demo Orders into a store
  const handleInjectDemoOrders = async (slug: string) => {
    const num1 = String(Math.floor(Math.random() * 80) + 10);
    const num2 = String(Math.floor(Math.random() * 80) + 90);
    const num3 = String(Math.floor(Math.random() * 80) + 170);

    await addOrder(num1, 10, 'طلب تجريبي - قهوة كورتادو', '', slug);
    await addOrder(num2, 15, 'طلب تجريبي - برجر دبل تشيز', '', slug);
    await addOrder(num3, 5, 'طلب تجريبي - وافل بلجيكي', '', slug);

    soundManager.playSuccessTone();
    showNotification(`تم حقن 3 طلبات تجريبية بنجاح في متجر "${slug}" ⚡`);
  };

  // Clear orders for a store
  const handleClearStoreOrders = (slug: string, storeName: string) => {
    if (confirm(`هل أنت متأكد من تصفير جميع الطلبات النشطة لمطعم "${storeName}"؟`)) {
      clearQueue(slug);
      showNotification(`تم تصفير طابور طلبات مطعم "${storeName}" 🧹`);
    }
  };

  // Delete Restaurant
  const confirmDeleteRestaurant = async () => {
    if (!deleteTargetRestaurant) return;
    const name = deleteTargetRestaurant.name;
    await deleteRestaurant(deleteTargetRestaurant.slug);
    setDeleteTargetRestaurant(null);
    showNotification(`تم حذف مطعم "${name}" نهائياً من المنصة 🗑️`);
  };

  const openSecurityModal = async () => {
    setIsSecurityModalOpen(true);
    setCopiedEnv(false);
    try {
      const res = await fetch('/api/admin/security-info');
      if (res.ok) {
        const data = await res.json();
        setSecurityData(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Open Quick QR Modal
  const openQrModal = (r: Restaurant) => {
    setQrModalRestaurant(r);
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const trackUrl = `${baseUrl}/${r.slug}/track`;

    QRCode.toDataURL(trackUrl, {
      width: 420,
      margin: 2,
      color: { dark: '#09090B', light: '#FFFFFF' },
    })
      .then((url) => setQrCodeUrl(url))
      .catch((e) => console.error(e));
  };

  // Sound test
  const handleTestSound = async (theme: ChimeSoundTheme) => {
    setIsPlayingTestSound(true);
    await soundManager.unlock();
    soundManager.playThemedChime(theme);
    if (formVoiceAnnounce) {
      setTimeout(() => {
        soundManager.announceOrderArabic('10', formName || 'المطعم');
      }, 1000);
    }
    setTimeout(() => setIsPlayingTestSound(false), 2000);
  };

  // Copy helper
  const copyToClipboard = (text: string, slugKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSlug(slugKey);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  // Backup & Export JSON
  const handleExportBackup = () => {
    const backupData = {
      timestamp: new Date().toISOString(),
      platform: 'CHIMER_PLATFORM_V3',
      totalRestaurants: Object.keys(restaurants).length,
      restaurants,
      orders,
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chimer-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('تم تصدير وحفظ النسخة الاحتياطية بنجاح 💾');
  };

  // Import JSON Backup
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json && json.restaurants) {
          // Restore restaurants
          for (const [slug, data] of Object.entries(json.restaurants)) {
            await updateRestaurant(slug, data as Partial<Restaurant>);
          }
          showNotification('تم استيراد بيانات المطاعم وتحديث المنصة بنجاح 📥');
        }
      } catch (err) {
        alert('الملف غير صالح أو تالف');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Platform Metrics Calculation
  const restaurantList = useMemo(() => Object.values(restaurants), [restaurants]);

  const stats = useMemo(() => {
    const totalStores = restaurantList.length;
    const activeStores = restaurantList.filter((r) => !r.isPaused).length;

    const cutoff = Date.now() - 18 * 60 * 60 * 1000;
    const activeOrders = orders.filter(
      (o) =>
        (o.status === 'preparing' || o.status === 'ready') &&
        new Date(o.createdAt || Date.now()).getTime() > cutoff
    );

    const completedToday = orders.filter((o) => o.status === 'completed');

    // Calculate dynamic average prep time across completed orders
    let totalPrepMins = 0;
    let countedOrders = 0;
    completedToday.forEach((o) => {
      if (o.readyAt && o.createdAt) {
        const diff = (new Date(o.readyAt).getTime() - new Date(o.createdAt).getTime()) / 60000;
        if (diff > 0 && diff < 120) {
          totalPrepMins += diff;
          countedOrders += 1;
        }
      }
    });
    const avgPrep = countedOrders > 0 ? (totalPrepMins / countedOrders).toFixed(1) : '8.5';

    // Calculate average feedback rating
    let totalRating = 0;
    let ratingCount = 0;
    orders.forEach((o) => {
      if (o.feedback?.rating) {
        totalRating += o.feedback.rating;
        ratingCount += 1;
      }
    });
    const avgRating = ratingCount > 0 ? (totalRating / ratingCount).toFixed(1) : '4.9';

    return {
      totalStores,
      activeStores,
      activeOrdersCount: activeOrders.length,
      completedTodayCount: completedToday.length,
      avgPrepTime: avgPrep,
      avgRating,
      ratingCount,
    };
  }, [restaurantList, orders]);

  // Per Store Orders Breakdown Map
  const storeOrdersMap = useMemo(() => {
    const map: Record<
      string,
      { preparing: number; ready: number; completed: number; total: number; latestOrder?: Order }
    > = {};

    restaurantList.forEach((r) => {
      map[r.slug] = { preparing: 0, ready: 0, completed: 0, total: 0 };
    });

    const cutoff = Date.now() - 18 * 60 * 60 * 1000;
    orders.forEach((o) => {
      const slug = (o.restaurantSlug || o.restaurant_slug || '').toLowerCase().trim();
      if (!map[slug]) {
        map[slug] = { preparing: 0, ready: 0, completed: 0, total: 0 };
      }
      map[slug].total += 1;

      const isRecent = new Date(o.createdAt || Date.now()).getTime() > cutoff;
      if (o.status === 'preparing' && isRecent) map[slug].preparing += 1;
      if (o.status === 'ready' && isRecent) map[slug].ready += 1;
      if (o.status === 'completed') map[slug].completed += 1;

      if (!map[slug].latestOrder) {
        map[slug].latestOrder = o;
      }
    });

    return map;
  }, [restaurantList, orders]);

  // Filtered & Sorted Restaurants
  const filteredRestaurants = useMemo(() => {
    return restaurantList
      .filter((r) => {
        // Search query filter
        const matchSearch =
          r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.slug.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchSearch) return false;

        // Status filter
        const storeStats = storeOrdersMap[r.slug] || { preparing: 0, ready: 0 };
        const hasLiveOrders = storeStats.preparing > 0 || storeStats.ready > 0;

        if (statusFilter === 'active') return !r.isPaused && hasLiveOrders;
        if (statusFilter === 'idle') return !r.isPaused && !hasLiveOrders;
        if (statusFilter === 'paused') return Boolean(r.isPaused);
        return true;
      })
      .sort((a, b) => {
        const statsA = storeOrdersMap[a.slug] || { total: 0, preparing: 0, ready: 0 };
        const statsB = storeOrdersMap[b.slug] || { total: 0, preparing: 0, ready: 0 };

        if (sortBy === 'orders') {
          return statsB.preparing + statsB.ready - (statsA.preparing + statsA.ready);
        }
        if (sortBy === 'newest') {
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        }
        if (sortBy === 'oldest') {
          return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
        }
        if (sortBy === 'name') {
          return a.name.localeCompare(b.name, 'ar');
        }
        return 0;
      });
  }, [restaurantList, searchQuery, statusFilter, sortBy, storeOrdersMap]);

  // 0. Session Checking Screen (Prevents any content flash before server verification)
  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-[#070709] text-white flex flex-col justify-center items-center p-4 font-sans">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-4 relative">
          <Shield className="w-8 h-8 text-emerald-400 animate-pulse" />
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
          </span>
        </div>
        <h2 className="text-sm font-bold text-white font-mono tracking-wider">
          CHIMER ENCRYPTED SENTINEL
        </h2>
        <p className="text-xs text-zinc-500 mt-1 font-mono">
          جارِ التحقق الأمني من تصريح مالك المنصة المشفر...
        </p>
      </div>
    );
  }

  // ========================================================
  // UN-AUTHENTICATED: MILITARY-GRADE DUAL-KEY DEFENSE GATE
  // ========================================================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#070709] text-white flex flex-col justify-center items-center p-4 font-sans selection:bg-emerald-500 selection:text-black relative overflow-hidden">
        {/* Luxury Background Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[540px] h-[540px] bg-emerald-500/10 blur-[140px] rounded-full pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="w-full max-w-lg bg-[#111114]/95 border border-white/[0.1] rounded-3xl p-6 sm:p-8 backdrop-blur-2xl shadow-2xl relative z-10"
        >
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-black to-emerald-950/40 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-emerald-500/10">
              <ShieldCheck className="w-9 h-9" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono uppercase tracking-widest font-bold mb-3">
              <span>Zero-Knowledge Defense Gate</span>
            </div>

            <h1 className="text-2xl font-black text-white tracking-tight font-cairo">
              مركز القيادة الأمنية لمالك المنصة
            </h1>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed max-w-sm mx-auto">
              هذه المنطقة مشفرة بنظام الحماية البنكية وخاضعة لمراقبة الـ IP.
              يتطلب الدخول تزويد المفاتيح المزدوجة الخاصة بالمالك فقط.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {/* Field 1: Master ID */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center justify-between">
                <span>المعرّف الأمني للمالك (Master Identifier)</span>
                <span className="text-[10px] text-zinc-500 font-mono">ID / USERNAME</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  autoFocus
                  autoComplete="off"
                  value={userInput}
                  onChange={(e) => {
                    setUserInput(e.target.value);
                    setAuthError('');
                  }}
                  placeholder="المعرّف السري..."
                  className="w-full bg-[#09090B] border border-white/[0.12] rounded-2xl py-3 px-4 text-sm font-mono text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            {/* Field 2: Secret Passphrase */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center justify-between">
                <span>مفتاح التشفير السري (Master Passphrase)</span>
                <span className="text-[10px] text-zinc-500 font-mono">HMAC-SHA512 KEY</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="off"
                  value={passInput}
                  onChange={(e) => {
                    setPassInput(e.target.value);
                    setAuthError('');
                  }}
                  placeholder="كلمة المرور المشفرة..."
                  className="w-full bg-[#09090B] border border-white/[0.12] rounded-2xl py-3 pl-11 pr-4 text-sm font-mono text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error Display */}
            {authError && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-start gap-2 leading-relaxed"
              >
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </motion.div>
            )}

            {/* Security Badges */}
            <div className="grid grid-cols-2 gap-2 pt-2 text-[10px] text-zinc-400 font-mono">
              <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-2 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>3 Strikes IP Lockout</span>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-2 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>PBKDF2 SHA-512 Hash</span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isAuthLoading}
              className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-black font-black text-sm transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
            >
              <Unlock className="w-4 h-4" />
              <span>{isAuthLoading ? 'جارِ فك التشفير والتحقق الأمني...' : 'فك التشفير والولوج الآمن'}</span>
            </button>
          </form>

          <div className="mt-5 text-center">
            <Link
              href="/"
              className="text-xs text-zinc-400 hover:text-white transition-colors inline-flex items-center gap-1.5"
            >
              <ArrowRight className={`w-3.5 h-3.5 ${isRTL ? '' : 'rotate-180'}`} />
              <span>الخروج والرجوع للموقع العام</span>
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  // ==========================================
  // AUTHENTICATED: SUPER ADMIN DASHBOARD
  // ==========================================
  return (
    <div className="min-h-screen bg-[#070709] text-white flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
      {/* Toast Notification Alert */}
      <AnimatePresence>
        {actionSuccessMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-black px-5 py-2.5 rounded-2xl font-bold text-xs shadow-2xl flex items-center gap-2 border border-emerald-400"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{actionSuccessMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header */}
      <header className="border-b border-white/[0.07] bg-[#09090B]/90 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Logo & Super Admin Badge */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <BrandLogo size="sm" />
              <div className="flex flex-col">
                <span className="font-black text-sm tracking-tight text-white font-mono flex items-center gap-2">
                  CHIMER <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded font-sans font-bold">HQ</span>
                </span>
                <span className="text-[10px] text-zinc-400">لوحة المالك والعمليات المركزية</span>
              </div>
            </Link>
          </div>

          {/* Sync & Latency Indicators */}
          <div className="hidden md:flex items-center gap-3 text-xs">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-zinc-300 font-mono text-[11px]">
                {isSupabaseActive ? 'Supabase Realtime Active' : 'Realtime Engine Sync'}
              </span>
              <span className="text-[10px] font-mono text-emerald-400">⚡ 32ms</span>
            </div>
          </div>

          {/* Actions & Lock */}
          <div className="flex items-center gap-2">
            <LanguageSwitcher variant="minimal" />

            <button
              onClick={openSecurityModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-white font-medium text-xs border border-white/[0.08] transition-colors cursor-pointer"
              title="إعدادات الأمان وبيئة Vercel"
            >
              <Key className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">أمان Vercel</span>
            </button>

            <button
              onClick={openCreateModal}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition-colors shadow-md shadow-emerald-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة مطعم</span>
            </button>

            <button
              onClick={handleLogout}
              className="p-2 rounded-xl bg-white/[0.04] hover:bg-rose-500/20 hover:text-rose-400 text-zinc-400 border border-white/[0.06] transition-colors"
              title="قفل لوحة المالك"
            >
              <Lock className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl w-full mx-auto p-4 sm:px-6 py-6 flex-1 space-y-6">
        {/* 1. Global KPI Metrics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* Metric 1: Total Stores */}
          <div className="bg-[#111114] border border-white/[0.07] rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs font-semibold">إجمالي المتاجر</span>
              <Store className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black font-mono text-white">
                {stats.totalStores}
              </span>
              <span className="text-[11px] text-emerald-400 font-medium">
                {stats.activeStores} نشط
              </span>
            </div>
          </div>

          {/* Metric 2: Live In-Flight Orders */}
          <div className="bg-[#111114] border border-white/[0.07] rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs font-semibold">الطلبات الجارية الآن</span>
              <Flame className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black font-mono text-amber-400">
                {stats.activeOrdersCount}
              </span>
              <span className="text-[11px] text-zinc-400">في الطابور</span>
            </div>
          </div>

          {/* Metric 3: Completed Today */}
          <div className="bg-[#111114] border border-white/[0.07] rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs font-semibold">الطلبات المنجزة اليوم</span>
              <CheckCircle2 className="w-4 h-4 text-sky-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black font-mono text-sky-400">
                {stats.completedTodayCount}
              </span>
              <span className="text-[11px] text-zinc-400">طلب ناجح</span>
            </div>
          </div>

          {/* Metric 4: Avg Prep Time */}
          <div className="bg-[#111114] border border-white/[0.07] rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs font-semibold">متوسط سرعة الإنجاز</span>
              <Clock className="w-4 h-4 text-purple-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black font-mono text-purple-400">
                {stats.avgPrepTime}
              </span>
              <span className="text-xs text-zinc-400">دقيقة/طلب</span>
            </div>
          </div>

          {/* Metric 5: Customer Satisfaction */}
          <div className="col-span-2 lg:col-span-1 bg-[#111114] border border-white/[0.07] rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs font-semibold">رضا العملاء</span>
              <Sparkles className="w-4 h-4 text-yellow-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black font-mono text-yellow-400">
                ⭐ {stats.avgRating}
              </span>
              <span className="text-[11px] text-zinc-400">
                ({stats.ratingCount} تقييم)
              </span>
            </div>
          </div>
        </div>

        {/* 2. Platform Realtime Activity Radar (Collapsible) */}
        <div className="bg-[#111114] border border-white/[0.07] rounded-2xl p-4 overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Platform Live Event Radar (رادار النشاط الحي المباشر)
              </h3>
            </div>
            <button
              onClick={() => setLiveRadarOpen(!liveRadarOpen)}
              className="text-[11px] text-zinc-400 hover:text-white transition-colors"
            >
              {liveRadarOpen ? 'تصغير' : 'عرض'}
            </button>
          </div>

          {liveRadarOpen && (
            <div className="text-xs text-zinc-300 font-mono flex items-center gap-3 overflow-x-auto py-1">
              {lastEvent ? (
                <div className="flex items-center gap-2 bg-[#09090B] px-3 py-1.5 rounded-xl border border-white/[0.08] shrink-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-emerald-400 font-bold">{lastEvent.type}</span>
                  <span className="text-zinc-500">|</span>
                  <span className="text-white">متجر: {lastEvent.restaurantSlug || 'demo-cafe'}</span>
                  {lastEvent.orderNumber && (
                    <>
                      <span className="text-zinc-500">|</span>
                      <span className="text-amber-400">طلب #{lastEvent.orderNumber}</span>
                    </>
                  )}
                  <span className="text-zinc-500 text-[10px]">
                    ({new Date(lastEvent.timestamp).toLocaleTimeString()})
                  </span>
                </div>
              ) : (
                <span className="text-zinc-500 italic">
                  بانتظار أحداث حية من المتاجر... النظام في وضع الاستماع الدائم
                </span>
              )}
            </div>
          )}
        </div>

        {/* 3. Toolbar: Search, Filters & Bulk Export/Import */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#111114] border border-white/[0.07] rounded-2xl p-3.5">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-zinc-400 absolute top-1/2 -translate-y-1/2 right-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم أو الرابط (Slug)..."
              className="w-full bg-[#09090B] border border-white/[0.08] rounded-xl pr-9 pl-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === 'all'
                  ? 'bg-white text-black'
                  : 'bg-white/[0.04] text-zinc-400 hover:text-white'
              }`}
            >
              الكل ({restaurantList.length})
            </button>

            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === 'active'
                  ? 'bg-emerald-500 text-black'
                  : 'bg-white/[0.04] text-zinc-400 hover:text-white'
              }`}
            >
              نشطة بها طلبات
            </button>

            <button
              onClick={() => setStatusFilter('idle')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === 'idle'
                  ? 'bg-sky-500 text-black'
                  : 'bg-white/[0.04] text-zinc-400 hover:text-white'
              }`}
            >
              هادئة
            </button>

            <button
              onClick={() => setStatusFilter('paused')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === 'paused'
                  ? 'bg-amber-500 text-black'
                  : 'bg-white/[0.04] text-zinc-400 hover:text-white'
              }`}
            >
              موقوفة مؤقتاً
            </button>
          </div>

          {/* Sort Dropdown & Backup Actions */}
          <div className="flex items-center gap-2 self-end md:self-auto">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[#09090B] border border-white/[0.08] text-xs text-zinc-300 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500"
            >
              <option value="orders">الأكثر نشاطاً بالطلبات</option>
              <option value="newest">الأحدث تسجيلاً</option>
              <option value="oldest">الأقدم</option>
              <option value="name">أبجدياً</option>
            </select>

            {/* Export JSON */}
            <button
              onClick={handleExportBackup}
              className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-white/[0.08] transition-colors"
              title="تصدير نسخة احتياطية كاملة (JSON)"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Import JSON */}
            <label
              className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-white/[0.08] transition-colors cursor-pointer"
              title="استيراد بيانات مطاعم"
            >
              <Upload className="w-4 h-4" />
              <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
            </label>
          </div>
        </div>

        {/* 4. Restaurants Grid List */}
        {filteredRestaurants.length === 0 ? (
          <div className="bg-[#111114] border border-white/[0.07] rounded-3xl p-12 text-center max-w-lg mx-auto">
            <Store className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <h4 className="text-base font-bold text-white">لا توجد مطاعم مطابقة</h4>
            <p className="text-xs text-zinc-400 mt-1">
              جرب تغيير عبارة البحث أو الفلترة أو قم بإضافة مطعم جديد
            </p>
            <button
              onClick={openCreateModal}
              className="mt-4 px-4 py-2 rounded-xl bg-emerald-500 text-black font-bold text-xs"
            >
              + إضافة مطعم جديد
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredRestaurants.map((restaurant) => {
              const rStats = storeOrdersMap[restaurant.slug] || {
                preparing: 0,
                ready: 0,
                completed: 0,
                total: 0,
              };
              const isPinShown = Boolean(visiblePins[restaurant.slug]);
              const isPaused = Boolean(restaurant.isPaused);

              return (
                <div
                  key={restaurant.slug}
                  className={`bg-[#111114] border rounded-3xl p-5 shadow-xl transition-all flex flex-col justify-between ${
                    isPaused
                      ? 'border-white/[0.05] opacity-75'
                      : 'border-white/[0.08] hover:border-white/[0.2]'
                  }`}
                >
                  {/* Card Header */}
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden border shadow-md shrink-0 bg-black"
                          style={{ borderColor: `${restaurant.themeColor}50` }}
                        >
                          {restaurant.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={restaurant.logoUrl}
                              alt={restaurant.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Store className="w-6 h-6" style={{ color: restaurant.themeColor }} />
                          )}
                        </div>

                        <div>
                          <h3 className="font-bold text-base text-white flex items-center gap-2">
                            <span>{restaurant.name}</span>
                          </h3>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                              className="text-[10px] font-mono px-2 py-0.5 rounded-md font-bold text-black"
                              style={{ backgroundColor: restaurant.themeColor }}
                            >
                              /{restaurant.slug}
                            </span>
                            <button
                              onClick={() => copyToClipboard(restaurant.slug, restaurant.slug)}
                              className="text-zinc-500 hover:text-white transition-colors"
                              title="نسخ معرف الرابط"
                            >
                              {copiedSlug === restaurant.slug ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Store Status Badge */}
                      <div>
                        {isPaused ? (
                          <span className="text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                            موقوف ⏸️
                          </span>
                        ) : rStats.preparing > 0 || rStats.ready > 0 ? (
                          <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            نشط ({rStats.preparing + rStats.ready})
                          </span>
                        ) : (
                          <span className="text-[10px] bg-zinc-800 text-zinc-400 border border-white/[0.08] px-2 py-0.5 rounded-full font-medium">
                            هادئ
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Live Order Counters */}
                    <div className="grid grid-cols-3 gap-2 my-3 p-2.5 rounded-2xl bg-[#09090B] border border-white/[0.05] text-center">
                      <div>
                        <span className="text-[10px] text-zinc-500 block">قيد التحضير</span>
                        <span className="text-base font-black font-mono text-amber-400">
                          {rStats.preparing}
                        </span>
                      </div>
                      <div className="border-x border-white/[0.06]">
                        <span className="text-[10px] text-zinc-500 block">جاهز للاستلام</span>
                        <span className="text-base font-black font-mono text-emerald-400">
                          {rStats.ready}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 block">مكتمل اليوم</span>
                        <span className="text-base font-black font-mono text-zinc-300">
                          {rStats.completed}
                        </span>
                      </div>
                    </div>

                    {/* Admin Intel: Staff PIN & Details */}
                    <div className="py-2 px-3 rounded-xl bg-white/[0.02] border border-white/[0.04] text-xs flex items-center justify-between text-zinc-400 mb-4">
                      <div className="flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-zinc-500" />
                        <span>رمز الكاشير:</span>
                        <span className="font-mono font-bold text-white tracking-wider">
                          {isPinShown ? restaurant.staffPin || '1234' : '••••'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            setVisiblePins((prev) => ({
                              ...prev,
                              [restaurant.slug]: !prev[restaurant.slug],
                            }))
                          }
                          className="p-1 hover:text-white transition-colors"
                          title={isPinShown ? 'إخفاء الرمز' : 'إظهار الرمز'}
                        >
                          {isPinShown ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => copyToClipboard(restaurant.staffPin || '1234', `pin_${restaurant.slug}`)}
                          className="p-1 hover:text-white transition-colors"
                          title="نسخ الرمز"
                        >
                          {copiedSlug === `pin_${restaurant.slug}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Station Launchers (1-Click Access) */}
                  <div className="space-y-3 pt-3 border-t border-white/[0.06]">
                    <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
                      {/* Cashier */}
                      <Link
                        href={`/${restaurant.slug}/staff`}
                        target="_blank"
                        className="p-2 rounded-xl bg-white/[0.03] hover:bg-emerald-500/20 hover:text-emerald-400 border border-white/[0.05] transition-colors flex flex-col items-center gap-1"
                        title="فتح شاشة الكاشير"
                      >
                        <Store className="w-4 h-4 text-emerald-400" />
                        <span className="text-[10px] font-bold">كاشير</span>
                      </Link>

                      {/* TV */}
                      <Link
                        href={`/${restaurant.slug}/tv`}
                        target="_blank"
                        className="p-2 rounded-xl bg-white/[0.03] hover:bg-amber-500/20 hover:text-amber-400 border border-white/[0.05] transition-colors flex flex-col items-center gap-1"
                        title="فتح شاشة التلفزيون في الصالة"
                      >
                        <Tv className="w-4 h-4 text-amber-400" />
                        <span className="text-[10px] font-bold">شاشة TV</span>
                      </Link>

                      {/* Tracker */}
                      <Link
                        href={`/${restaurant.slug}/track`}
                        target="_blank"
                        className="p-2 rounded-xl bg-white/[0.03] hover:bg-sky-500/20 hover:text-sky-400 border border-white/[0.05] transition-colors flex flex-col items-center gap-1"
                        title="فتح شاشة تتبع الزبون"
                      >
                        <Smartphone className="w-4 h-4 text-sky-400" />
                        <span className="text-[10px] font-bold">العميل</span>
                      </Link>

                      {/* Tenant Admin */}
                      <Link
                        href={`/${restaurant.slug}/admin`}
                        target="_blank"
                        className="p-2 rounded-xl bg-white/[0.03] hover:bg-purple-500/20 hover:text-purple-400 border border-white/[0.05] transition-colors flex flex-col items-center gap-1"
                        title="إدارة وهوية المطعم"
                      >
                        <SlidersHorizontal className="w-4 h-4 text-purple-400" />
                        <span className="text-[10px] font-bold">إدارته</span>
                      </Link>
                    </div>

                    {/* Owner Management Controls */}
                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.04] text-xs">
                      <div className="flex items-center gap-1">
                        {/* Edit Button */}
                        <button
                          onClick={() => openEditModal(restaurant)}
                          className="p-2 rounded-xl hover:bg-white/[0.08] text-zinc-300 hover:text-white transition-colors"
                          title="تعديل بيانات المطعم"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        {/* Quick QR Stand */}
                        <button
                          onClick={() => openQrModal(restaurant)}
                          className="p-2 rounded-xl hover:bg-white/[0.08] text-zinc-300 hover:text-white transition-colors"
                          title="رمز الباركود والستاند"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>

                        {/* Analytics Link */}
                        <Link
                          href={`/${restaurant.slug}/admin/analytics`}
                          target="_blank"
                          className="p-2 rounded-xl hover:bg-white/[0.08] text-zinc-300 hover:text-white transition-colors"
                          title="تحليلات المطعم"
                        >
                          <BarChart3 className="w-4 h-4 text-emerald-400" />
                        </Link>

                        {/* Inject Demo Orders */}
                        <button
                          onClick={() => handleInjectDemoOrders(restaurant.slug)}
                          className="p-2 rounded-xl hover:bg-amber-500/20 text-zinc-400 hover:text-amber-400 transition-colors"
                          title="حقن 3 طلبات تجريبية للفحص"
                        >
                          <Flame className="w-4 h-4 text-amber-400" />
                        </button>

                        {/* Clear Active Queue */}
                        <button
                          onClick={() => handleClearStoreOrders(restaurant.slug, restaurant.name)}
                          className="p-2 rounded-xl hover:bg-white/[0.08] text-zinc-400 hover:text-zinc-200 transition-colors"
                          title="تصفير الطابور الحالي"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Pause / Resume Button */}
                        <button
                          onClick={() => handleTogglePause(restaurant)}
                          className={`p-2 rounded-xl transition-colors ${
                            isPaused
                              ? 'text-emerald-400 hover:bg-emerald-500/20'
                              : 'text-amber-400 hover:bg-amber-500/20'
                          }`}
                          title={isPaused ? 'إعادة تفعيل المتجر' : 'إيقاف مؤقت'}
                        >
                          <Power className="w-4 h-4" />
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => setDeleteTargetRestaurant(restaurant)}
                          className="p-2 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-rose-500/15 transition-colors"
                          title="حذف المطعم نهائياً"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Admin Footer with Developer Credit */}
      <footer className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500">
        <span>Buzly Smart Pager Enterprise Engine</span>
        <MuhabBrandBadge />
      </footer>

      {/* ========================================================= */}
      {/* MODAL 1: CREATE OR EDIT RESTAURANT */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-2xl bg-[#111114] border border-white/[0.1] rounded-3xl p-6 sm:p-8 shadow-2xl my-8 relative"
            >
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Store className="w-5 h-5 text-emerald-400" />
                    <span>{editingRestaurant ? 'تعديل بيانات المتجر' : 'إضافة وتدشين متجر جديد'}</span>
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    {editingRestaurant
                      ? `أنت الآن تعدّل بيانات متجر "${editingRestaurant.name}"`
                      : 'سجّل مطعماً أو مقهى جديداً على المنصة وفعّل لوحاته فوراً'}
                  </p>
                </div>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-2 rounded-xl hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveRestaurant} className="space-y-5">
                {/* Name & Slug */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      اسم المطعم أو الكافيه *
                    </label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="مثال: وايت كافيه"
                      className="w-full bg-[#09090B] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      معرف الرابط (Slug) *
                    </label>
                    <input
                      type="text"
                      required
                      disabled={Boolean(editingRestaurant)}
                      value={formSlug}
                      onChange={(e) =>
                        setFormSlug(
                          e.target.value
                            .toLowerCase()
                            .trim()
                            .replace(/[^a-z0-9-]/g, '-')
                        )
                      }
                      placeholder="white-cafe"
                      className="w-full bg-[#09090B] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Logo Picker Component */}
                <div>
                  <LogoPicker
                    value={formLogoUrl}
                    onChange={setFormLogoUrl}
                    restaurantName={formName}
                    themeColor={formThemeColor}
                  />
                </div>

                {/* Accent Theme Color */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-2">
                    اللون الرئيسي للعلامة التجارية
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {COLOR_PRESETS.map((c) => {
                      const isSel = formThemeColor.toLowerCase() === c.hex.toLowerCase();
                      return (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setFormThemeColor(c.hex)}
                          className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                            isSel
                              ? 'border-white bg-white/[0.08]'
                              : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06]'
                          }`}
                        >
                          <span
                            className="w-4 h-4 rounded-full shadow-inner"
                            style={{ backgroundColor: c.hex }}
                          />
                          <span className="text-[10px] font-bold text-zinc-300">{c.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Staff PIN & Sound Theme */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      رمز دخول الكاشير (4 أرقام)
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      value={formStaffPin}
                      onChange={(e) => setFormStaffPin(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full bg-[#09090B] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-base font-mono tabular-nums text-center text-white focus:outline-none focus:border-emerald-500 tracking-widest"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-zinc-300">نغمة الرنين</label>
                      <button
                        type="button"
                        onClick={() => handleTestSound(formChimeTheme)}
                        disabled={isPlayingTestSound}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>{isPlayingTestSound ? 'تجربة...' : 'سماع'}</span>
                      </button>
                    </div>
                    <select
                      value={formChimeTheme}
                      onChange={(e) => setFormChimeTheme(e.target.value as ChimeSoundTheme)}
                      className="w-full bg-[#09090B] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      {CHIME_THEMES.map((theme) => (
                        <option key={theme.id} value={theme.id}>
                          {theme.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Voice Announce & WhatsApp Toggles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/[0.08]">
                  <label className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] cursor-pointer">
                    <span className="text-xs font-semibold text-zinc-300">النداء الصوتي الآلي</span>
                    <input
                      type="checkbox"
                      checked={formVoiceAnnounce}
                      onChange={(e) => setFormVoiceAnnounce(e.target.checked)}
                      className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] cursor-pointer">
                    <span className="text-xs font-semibold text-zinc-300">تنبيهات الواتساب</span>
                    <input
                      type="checkbox"
                      checked={formWhatsapp}
                      onChange={(e) => setFormWhatsapp(e.target.checked)}
                      className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                    />
                  </label>
                </div>

                {/* Admin Notes */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    ملاحظات سرية للمالك (بيانات التواصل، الباقة، المالك)
                  </label>
                  <textarea
                    rows={2}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="رقم جوال العميل، نوع الاشتراك، ملاحظات خاصة..."
                    className="w-full bg-[#09090B] border border-white/[0.1] rounded-xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl hover:bg-white/[0.08] text-xs font-semibold text-zinc-300 transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingForm}
                    className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                  >
                    {isSubmittingForm
                      ? 'جارِ الحفظ...'
                      : editingRestaurant
                      ? 'حفظ التعديلات'
                      : 'تدشين المتجر الآن'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 2: QUICK QR CODE & STAND PREVIEW */}
      {/* ========================================================= */}
      <AnimatePresence>
        {qrModalRestaurant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#111114] border border-white/[0.1] rounded-3xl p-6 shadow-2xl text-center relative"
            >
              <button
                onClick={() => setQrModalRestaurant(null)}
                className="p-2 rounded-xl hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors absolute top-4 left-4"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto mb-3">
                <QrCode className="w-6 h-6 text-emerald-400" />
              </div>

              <h3 className="font-extrabold text-lg text-white mb-1">
                باركود طاولة {qrModalRestaurant.name}
              </h3>
              <p className="text-xs text-zinc-400 mb-5">
                امسح الرمز لتتبع واستلام الطلب فوراً من أي جوال
              </p>

              {/* QR Container */}
              <div className="bg-white p-5 rounded-2xl inline-block shadow-inner mb-4">
                {qrCodeUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrCodeUrl} alt="QR Code" className="w-52 h-52 block mx-auto" />
                ) : (
                  <div className="w-52 h-52 flex items-center justify-center text-zinc-400 font-mono text-xs">
                    جارِ التوليد...
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <a
                  href={qrCodeUrl}
                  download={`qr-${qrModalRestaurant.slug}.png`}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>تحميل كصورة PNG</span>
                </a>

                <Link
                  href={`/${qrModalRestaurant.slug}/admin`}
                  target="_blank"
                  className="w-full py-2.5 px-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-200 font-semibold text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة ستاند طاولة رسمي A5</span>
                </Link>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 3: CONFIRM DELETE RESTAURANT */}
      {/* ========================================================= */}
      <AnimatePresence>
        {deleteTargetRestaurant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-[#111114] border border-rose-500/30 rounded-3xl p-6 shadow-2xl text-center relative"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-6 h-6" />
              </div>

              <h3 className="font-extrabold text-base text-white mb-2">
                تأكيد حذف المطعم نهائياً
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed mb-6">
                هل أنت متأكد من رغبتك في حذف مطعم{' '}
                <strong className="text-rose-400 font-bold">{deleteTargetRestaurant.name}</strong>{' '}
                نهائياً؟ سيتم حذف جميع طلباته وطوابيره من المنصة.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setDeleteTargetRestaurant(null)}
                  className="py-2.5 px-4 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-xs font-semibold text-zinc-300"
                >
                  تراجع
                </button>
                <button
                  onClick={confirmDeleteRestaurant}
                  className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-lg shadow-rose-600/30"
                >
                  نعم، احذف نهائياً
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SECURITY & VERCEL PRODUCTION HUB MODAL */}
      <AnimatePresence>
        {isSecurityModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-[#121215] border border-white/[0.08] rounded-[28px] max-w-xl w-full p-6 sm:p-7 shadow-2xl relative overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/[0.06] mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>إعدادات الأمان وبيئة Vercel</span>
                      <span className="text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-full font-mono">
                        PRODUCTION READY
                      </span>
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      تأمين بيانات المالك وتشفير جلسات المنصة قبل الإطلاق
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsSecurityModalOpen(false)}
                  className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Status Pills */}
              <div className="space-y-3 mb-5">
                <div className="bg-[#0B0B0E] border border-white/[0.06] rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400">حالة كلمة مرور المالك (Master Password):</span>
                    {securityData?.status?.isPasswordCustomized ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> مخصصة وآمنة في Vercel
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[11px] font-semibold">
                        <AlertTriangle className="w-3.5 h-3.5" /> القيمة الافتراضية نشطة (يُنصح بتغييرها)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400">اسم المستخدم المالك:</span>
                    <span className="font-mono text-zinc-200 bg-white/[0.05] px-2 py-0.5 rounded-md">
                      {securityData?.status?.currentUsername || 'owner'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Recommended Production Env Block */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-cyan-400" />
                    <span>المتغيرات الموصى بنسخها إلى Vercel:</span>
                  </label>
                  <button
                    type="button"
                    onClick={openSecurityModal}
                    className="text-[11px] text-zinc-400 hover:text-cyan-400 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>توليد قيم جديدة</span>
                  </button>
                </div>

                <div className="relative">
                  <pre
                    dir="ltr"
                    className="bg-[#08080A] border border-white/[0.08] rounded-2xl p-4 text-xs font-mono text-emerald-400/90 overflow-x-auto selection:bg-emerald-500 selection:text-black leading-relaxed"
                  >
{`MASTER_ADMIN_USER=${securityData?.generated?.recommendedUser || 'admin_buzly'}
MASTER_ADMIN_PASSWORD=${securityData?.generated?.generatedPassword || 'Buzly@SecurePass#2026'}
STAFF_TOKEN_SECRET=${securityData?.generated?.generatedSecret || 'f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8'}`}
                  </pre>

                  <button
                    type="button"
                    onClick={() => {
                      const snippet = `MASTER_ADMIN_USER=${securityData?.generated?.recommendedUser || 'admin_buzly'}\nMASTER_ADMIN_PASSWORD=${securityData?.generated?.generatedPassword || 'Buzly@SecurePass#2026'}\nSTAFF_TOKEN_SECRET=${securityData?.generated?.generatedSecret || 'f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8'}`;
                      navigator.clipboard.writeText(snippet);
                      setCopiedEnv(true);
                      showNotification('تم نسخ المتغيرات للحافظة بنجاح 📋');
                      setTimeout(() => setCopiedEnv(false), 2500);
                    }}
                    className="absolute top-3 left-3 px-3 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                  >
                    {copiedEnv ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">تم النسخ!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>نسخ الكل</span>
                      </>
                    )}
                  </button>
                </div>

                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  💡 <strong>طريقة التفعيل:</strong> افتح مشروعك في Vercel ➔ اضغط <strong>Settings</strong> ➔ ثم <strong>Environment Variables</strong> ➔ الصق هذه الأسطر واضغط <strong>Save</strong>.
                </p>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsSecurityModalOpen(false)}
                className="w-full py-3.5 px-4 rounded-2xl bg-white/[0.08] hover:bg-white/[0.12] text-white font-bold text-xs transition-colors cursor-pointer"
              >
                إغلاق النافذة
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
