'use client';

import React, { useState, useEffect } from 'react';
import { BellRing, ShieldCheck, Moon, Volume2, HelpCircle, ChevronDown, Check, Smartphone } from 'lucide-react';
import { pwaHelper } from '@/lib/pwa-helper';
import { soundManager } from '@/lib/audio';

interface ActivationBannerProps {
  onActivated?: () => void;
}

export const ActivationBanner: React.FC<ActivationBannerProps> = ({ onActivated }) => {
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);
  const [notificationStatus, setNotificationStatus] = useState<string>('default');
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [showIosTip, setShowIosTip] = useState<boolean>(false);
  const [isActivating, setIsActivating] = useState<boolean>(false);

  useEffect(() => {
    setIsIOS(pwaHelper.isIOS());
    setNotificationStatus(pwaHelper.getNotificationPermission());
  }, []);

  const handleActivateAll = async () => {
    setIsActivating(true);

    try {
      // 1. Unlock Audio Context
      const audioSuccess = await soundManager.unlock();
      setAudioUnlocked(audioSuccess);

      // Play soft confirmation chime so the customer knows their speakers work
      soundManager.playHospitalityChime();

      // 2. Request Notifications
      const notifPerm = await pwaHelper.requestNotification();
      setNotificationStatus(notifPerm);

      // 3. Acquire Screen Wake Lock
      const wlSuccess = await pwaHelper.acquireWakeLock();
      setWakeLockActive(wlSuccess);

      if (onActivated) onActivated();
    } catch (err) {
      console.warn('Activation error:', err);
    } finally {
      setIsActivating(false);
    }
  };

  const isFullyActivated = audioUnlocked || wakeLockActive || notificationStatus === 'granted';

  return (
    <div className="w-full">
      {!isFullyActivated ? (
        <div className="bg-gradient-to-r from-emerald-950/70 via-obsidian-surface to-emerald-950/70 border-2 border-emerald-500/40 rounded-3xl p-4 sm:p-5 shadow-2xl relative overflow-hidden backdrop-blur-md">
          {/* Ambient Glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-right">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/10">
                <BellRing className="w-6 h-6 animate-bounce-subtle" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm sm:text-base font-cairo">
                  فعّل جرس التنبيه والشاشة لكي لا يفوتك الطلب!
                </h4>
                <p className="text-xs text-zinc-300 mt-0.5">
                  يمنع نوم الشاشة ويشغل جرس رنين فوري حتى لو وضعت الهاتف في جيبك
                </p>
              </div>
            </div>

            <button
              onClick={handleActivateAll}
              disabled={isActivating}
              className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-black font-extrabold text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/25 transition-all cursor-pointer whitespace-nowrap"
            >
              <Volume2 className="w-4 h-4" />
              <span>{isActivating ? 'جارِ التفعيل...' : 'تفعيل الجرس والتنبيه الآن'}</span>
            </button>
          </div>

          {/* Quick iOS Tip trigger */}
          {isIOS && (
            <div className="mt-3 pt-3 border-t border-emerald-500/15 flex items-center justify-between text-xs text-zinc-400">
              <span className="flex items-center gap-1 text-[11px]">
                <Smartphone className="w-3.5 h-3.5 text-zinc-400" /> مستخدم آيفون؟
              </span>
              <button
                type="button"
                onClick={() => setShowIosTip(!showIosTip)}
                className="text-emerald-400 hover:underline flex items-center gap-1 font-medium"
              >
                <span>طريقة التنبيه مع الشاشة المغلقة</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${showIosTip ? 'rotate-180' : ''}`}
                />
              </button>
            </div>
          )}

          {/* Expanded iOS Instructions */}
          {showIosTip && (
            <div className="mt-2.5 p-3 rounded-xl bg-obsidian-card border border-emerald-500/20 text-xs text-zinc-300 space-y-1.5 animate-fade-in">
              <p className="font-semibold text-emerald-400">
                خطوة إضافية للحصول على إشعار عند إغلاق شاشة الآيفون:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-zinc-300 pr-1">
                <li>
                  اضغط على زر <strong className="text-white">المشاركة</strong> في أسفل متصفح Safari.
                </li>
                <li>
                  اختر <strong className="text-white">إضافة إلى الشاشة الرئيسية</strong>.
                </li>
                <li>
                  افتح التطبيق من شاشتك وسيصلك الإشعار الصوتي الفوري مثل تطبيقات التوصيل تماماً!
                </li>
              </ol>
            </div>
          )}
        </div>
      ) : (
        /* Status Chips when active */
        <div className="bg-obsidian-surface/90 border border-emerald-500/30 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>نظام التنبيه الذكي نشط وجاهز للرنين</span>
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20">
              <Check className="w-3 h-3" /> جرس الصوت مفعل
            </span>
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-obsidian-card text-zinc-300 font-medium border border-obsidian-border">
              <Moon className="w-3 h-3 text-buzly-amber" /> شاشة يقظة
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
