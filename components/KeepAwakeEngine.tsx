'use client';

import React, { useState, useEffect } from 'react';
import {
  BellRing,
  ShieldCheck,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Share,
  PlusSquare,
  Sparkles,
  Volume2,
  Moon,
  Radio,
  X,
} from 'lucide-react';
import { pwaHelper, DEFAULT_VAPID_PUBLIC_KEY } from '@/lib/pwa-helper';
import { soundManager } from '@/lib/audio';
import { OrderStatus, PushSubscriptionData } from '@/types/queue';

interface KeepAwakeEngineProps {
  orderNumber: string;
  orderStatus?: OrderStatus;
  restaurantName?: string;
  onPushSubscribed?: (sub: PushSubscriptionData) => void;
  onSubscriptionObtained?: (sub: PushSubscriptionData) => void;
}

export const KeepAwakeEngine: React.FC<KeepAwakeEngineProps> = ({
  orderNumber,
  orderStatus = 'preparing',
  restaurantName,
  onPushSubscribed,
  onSubscriptionObtained,
}) => {
  const handlePushSub = onPushSubscribed || onSubscriptionObtained;
  const [isActivated, setIsActivated] = useState<boolean>(false);
  const [isActivating, setIsActivating] = useState<boolean>(false);
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);
  const [pushStatus, setPushStatus] = useState<string>('idle');
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [showIosSheet, setShowIosSheet] = useState<boolean>(false);

  useEffect(() => {
    setIsIOS(pwaHelper.isIOS());
    setIsStandalone(pwaHelper.isStandalonePWA());

    // Register service worker quietly on mount
    pwaHelper.registerServiceWorker();
  }, []);

  // When order status transitions from preparing to ready, stop silent audio
  useEffect(() => {
    if (orderStatus === 'ready') {
      soundManager.stopSilentKeepAlive();
    } else if (orderStatus === 'preparing' && isActivated) {
      soundManager.startSilentKeepAlive();
    }
  }, [orderStatus, isActivated]);

  const handleActivateTripleProtection = async () => {
    setIsActivating(true);

    try {
      // 1. AudioContext Unlock & Start Silent iOS Keep-Alive
      await soundManager.unlock();
      soundManager.playHospitalityChime(); // Short chime confirmation

      if (orderStatus === 'preparing') {
        soundManager.startSilentKeepAlive();
      }

      // 2. Screen Wake Lock Request
      const wlSuccess = await pwaHelper.acquireWakeLock();
      setWakeLockActive(wlSuccess);

      // 3. Web Push API Subscription & Notification Permission
      const notifPerm = await pwaHelper.requestNotification();

      if (notifPerm === 'granted') {
        const pushSub = await pwaHelper.subscribeToWebPush(DEFAULT_VAPID_PUBLIC_KEY);
        if (pushSub) {
          setPushStatus('subscribed');
          const serialized: PushSubscriptionData = JSON.parse(JSON.stringify(pushSub));
          if (handlePushSub) {
            handlePushSub(serialized);
          }
        } else {
          setPushStatus('permission_granted');
        }
      } else {
        setPushStatus('denied');
      }

      setIsActivated(true);
    } catch (err) {
      console.warn('Triple protection activation error:', err);
      setIsActivated(true);
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div className="w-full space-y-3">
      {/* Primary Banner */}
      {!isActivated ? (
        <div className="bg-gradient-to-r from-emerald-950/80 via-obsidian-surface to-emerald-950/80 border-2 border-emerald-500/50 rounded-3xl p-5 shadow-2xl relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 text-right w-full sm:w-auto">
              <div className="w-13 h-13 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/10">
                <BellRing className="w-6 h-6 animate-bounce-subtle" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="font-extrabold text-white text-base font-cairo">
                    فعّل جرس التنبيه وبقاء الشاشة
                  </h4>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono font-bold px-1.5 py-0.2 rounded">
                    Triple-Shield
                  </span>
                </div>
                <p className="text-xs text-zinc-300 mt-0.5 leading-relaxed">
                  يمنع قفل الشاشة، ويبقي الرنين جاهزاً، ويفعل إشعارات النظام الفورية.
                </p>
              </div>
            </div>

            <button
              onClick={handleActivateTripleProtection}
              disabled={isActivating}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-black font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/30 transition-all cursor-pointer whitespace-nowrap"
            >
              <Volume2 className="w-4 h-4 stroke-[2.5]" />
              <span>{isActivating ? 'جارِ التفعيل...' : 'تفعيل الجرس الآن'}</span>
            </button>
          </div>

          {/* iOS Tip Link */}
          {isIOS && !isStandalone && (
            <div className="mt-3.5 pt-3 border-t border-emerald-500/20 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-zinc-400">
                <Smartphone className="w-3.5 h-3.5 text-zinc-400" /> مستخدم آيفون؟
              </span>
              <button
                type="button"
                onClick={() => setShowIosSheet(!showIosSheet)}
                className="text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <span>طريقة التنبيه مع الشاشة المغلقة تماماً</span>
                {showIosSheet ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Status Card after activation */
        <div className="bg-obsidian-surface/90 border border-emerald-500/40 rounded-2xl p-3.5 shadow-lg backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
              <ShieldCheck className="w-4.5 h-4.5 text-emerald-400" />
              <span>نظام التنبيه الذكي نشط وجاهز للرنين الفوري</span>
            </div>

            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                <Volume2 className="w-3 h-3" /> صوت فندقي
              </span>
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-obsidian-card text-zinc-300 font-semibold border border-obsidian-border">
                <Moon className="w-3 h-3 text-buzly-amber" /> شاشة يقظة
              </span>
              {pushStatus === 'subscribed' && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                  <Radio className="w-3 h-3" /> Web Push
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Collapsible iOS Add-to-Home-Screen Guide */}
      {showIosSheet && isIOS && (
        <div className="bg-obsidian-card border-2 border-emerald-500/30 rounded-2xl p-4 text-xs text-zinc-300 space-y-3 shadow-xl animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <Sparkles className="w-4 h-4" />
              <span>ميزة التنبيه مع الشاشة المغلقة على الآيفون (iOS 16.4+):</span>
            </div>
            <button
              onClick={() => setShowIosSheet(false)}
              className="text-zinc-500 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-zinc-400 leading-relaxed">
            تفرض شركة Apple تشغيل إشعارات الشاشة المغلقة عن طريق إضافة الرابط للشاشة الرئيسية. لتفعيل ذلك في 3 ثوانٍ:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            <div className="bg-obsidian-surface p-2.5 rounded-xl border border-obsidian-border flex items-center gap-2">
              <Share className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>1. اضغط زر <strong>المشاركة</strong> في أسفل سفاري.</span>
            </div>
            <div className="bg-obsidian-surface p-2.5 rounded-xl border border-obsidian-border flex items-center gap-2">
              <PlusSquare className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>2. اختر <strong>إضافة للشاشة الرئيسية</strong>.</span>
            </div>
          </div>

          <p className="text-[10px] text-zinc-500 text-center">
            بمجرد إضافته، سيعمل التطبيق كبرنامج أصلي يرسل إشعارات ويرن حتى لو كان الآيفون مغلقاً!
          </p>
        </div>
      )}
    </div>
  );
};
