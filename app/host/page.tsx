'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  Bell,
  Check,
  Clock,
  LogOut,
  Plus,
  QrCode,
  RotateCcw,
  Sparkles,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import { HostKpis, SeatingPreference, WaitlistEntry } from '@/types/waitlist';

const CLAIM_WINDOW_MS = 5 * 60 * 1000;
const PARTY_SIZES = [1, 2, 3, 4, 5, 6, 7, 8] as const;

function padTicket(n: number): string {
  return String(n).padStart(3, '0');
}

function formatZone(pref: SeatingPreference): string {
  if (pref === 'inside') return 'Inside';
  if (pref === 'patio') return 'Patio';
  return 'Either';
}

function formatClaimLeft(calledAt: string | null, nowMs: number): {
  text: string;
  urgent: boolean;
  expired: boolean;
} {
  if (!calledAt) return { text: '5:00 left to claim', urgent: false, expired: false };
  const deadline = new Date(calledAt).getTime() + CLAIM_WINDOW_MS;
  const diff = deadline - nowMs;
  if (diff <= 0) {
    return { text: 'Claim window expired', urgent: true, expired: true };
  }
  const totalSec = Math.floor(diff / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return {
    text: `${m}:${String(s).padStart(2, '0')} left to claim`,
    urgent: totalSec < 60,
    expired: false,
  };
}

export default function HostStandPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [restaurantName, setRestaurantName] = useState('Chimer Bistro & Lounge');
  const [called, setCalled] = useState<WaitlistEntry[]>([]);
  const [waiting, setWaiting] = useState<WaitlistEntry[]>([]);
  const [kpis, setKpis] = useState<HostKpis>({
    waitingCount: 0,
    calledCount: 0,
    seatedCount: 0,
    noShowCount: 0,
    leftCount: 0,
    avgWaitMinutes: 12,
    nextTicketNumber: 65,
  });
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [busyId, setBusyId] = useState<string | null>(null);

  // Undo toast state
  const [toast, setToast] = useState<{ entryId: string; guestName: string } | null>(null);

  // Walk-in modal state
  const [showWalkIn, setShowWalkIn] = useState(false);
  const [walkInName, setWalkInName] = useState('');
  const [walkInSize, setWalkInSize] = useState(2);
  const [walkInSeating, setWalkInSeating] = useState<SeatingPreference>('either');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [walkInBusy, setWalkInBusy] = useState(false);

  const fetchWaitlist = useCallback(async () => {
    const res = await fetch('/api/host/waitlist', { cache: 'no-store' });
    if (res.status === 401 || res.status === 403) {
      router.replace('/host/login');
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    setAuthorized(true);
    setCalled(data.called || []);
    setWaiting(data.waiting || []);
    if (data.kpis) setKpis(data.kpis);
    if (data.restaurantName) setRestaurantName(data.restaurantName);
  }, [router]);

  useEffect(() => {
    let active = true;
    (async () => {
      await fetchWaitlist();
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [fetchWaitlist]);

  // 1-second live tick for claim countdowns & wait durations
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Sub-second Host Stand SSE stream
  useEffect(() => {
    if (!authorized) return;
    const es = new EventSource('/api/host/stream');
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'HOST_REFRESH') {
          fetchWaitlist();
        }
      } catch {
        // Ignore
      }
    };
    return () => es.close();
  }, [authorized, fetchWaitlist]);

  const handleNotify = async (entry: WaitlistEntry) => {
    setBusyId(entry.id);
    try {
      const res = await fetch(`/api/host/entries/${entry.id}/notify`, { method: 'POST' });
      if (res.ok) {
        setToast({ entryId: entry.id, guestName: entry.guestName });
        await fetchWaitlist();
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleUndoNotify = async (entryId: string) => {
    setBusyId(entryId);
    try {
      const res = await fetch(`/api/host/entries/${entryId}/undo-notify`, { method: 'POST' });
      if (res.ok) {
        setToast(null);
        await fetchWaitlist();
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleSeat = async (entryId: string) => {
    setBusyId(entryId);
    try {
      const res = await fetch(`/api/host/entries/${entryId}/seat`, { method: 'POST' });
      if (res.ok) {
        if (toast?.entryId === entryId) setToast(null);
        await fetchWaitlist();
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleNoShow = async (entryId: string) => {
    setBusyId(entryId);
    try {
      const res = await fetch(`/api/host/entries/${entryId}/no-show`, { method: 'POST' });
      if (res.ok) {
        if (toast?.entryId === entryId) setToast(null);
        await fetchWaitlist();
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleAddWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walkInName.trim()) return;
    setWalkInBusy(true);
    try {
      const res = await fetch('/api/host/walk-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: walkInName.trim(),
          partySize: walkInSize,
          seatingPreference: walkInSeating,
          phoneNumber: walkInPhone.trim() || null,
        }),
      });
      if (res.ok) {
        setWalkInName('');
        setWalkInPhone('');
        setWalkInSize(2);
        setWalkInSeating('either');
        setShowWalkIn(false);
        await fetchWaitlist();
      }
    } finally {
      setWalkInBusy(false);
    }
  };

  const handleSeedRush = async () => {
    await fetch('/api/host/seed', { method: 'POST' });
    await fetchWaitlist();
  };

  const handleSignOut = async () => {
    await fetch('/api/host/logout', { method: 'POST' });
    router.replace('/host/login');
  };

  if (loading || !authorized) {
    return (
      <div
        dir="ltr"
        className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center"
      >
        <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div dir="ltr" className="min-h-screen bg-zinc-950 text-zinc-100 pb-24">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/80 px-4 sm:px-6 py-3.5">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
                {restaurantName}
              </p>
              <h1 className="text-xl font-extrabold tracking-tight text-white">The Line</h1>
            </div>

            {/* KPI Pills */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <span className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-full text-zinc-200 tabular-nums">
                {kpis.waitingCount} waiting
              </span>
              <span className="bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 rounded-full text-emerald-300 tabular-nums">
                {kpis.calledCount} called
              </span>
              <span className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-full text-zinc-400 tabular-nums">
                {kpis.seatedCount} seated
              </span>
              <span className="bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 rounded-full text-amber-300 tabular-nums">
                {kpis.avgWaitMinutes}m wait
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowWalkIn(true)}
              data-testid="add-walkin-btn"
              className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add walk-in
            </button>

            <Link
              href="/host/insights"
              className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-semibold text-sm px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <BarChart3 className="w-4 h-4 text-zinc-400" />
              Insights
            </Link>

            <Link
              href="/host/door-sign"
              className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-semibold text-sm px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <QrCode className="w-4 h-4 text-zinc-400" />
              Door Sign
            </Link>

            {waiting.length === 0 && called.length === 0 && (
              <button
                type="button"
                onClick={handleSeedRush}
                className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-amber-300 font-semibold text-xs px-3 py-2.5 rounded-xl flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Seed Rush
              </button>
            )}

            <button
              type="button"
              onClick={handleSignOut}
              title="Sign Out"
              className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white p-2.5 rounded-xl transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-8">
        {/* SECTION 1: Called, waiting to be seated */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-400">
              Called, waiting to be seated ({called.length})
            </h2>
          </div>

          {called.length === 0 ? (
            <div className="bg-zinc-900/40 border border-dashed border-zinc-800 rounded-2xl p-6 text-center text-sm text-zinc-500">
              No parties currently called. Tap Notify on a waiting party below.
            </div>
          ) : (
            <div className="grid gap-3">
              {called.map((entry) => {
                const claim = formatClaimLeft(entry.calledAt, nowMs);
                const isOnMyWay = entry.status === 'on_my_way';
                return (
                  <div
                    key={entry.id}
                    data-testid={`called-row-${entry.ticketNumber}`}
                    className="bg-emerald-950/40 border border-emerald-500/35 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-start sm:items-center gap-4">
                      <span className="font-mono text-lg font-extrabold bg-emerald-500/20 text-emerald-300 px-3 py-1.5 rounded-xl shrink-0">
                        #{padTicket(entry.ticketNumber)}
                      </span>
                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-lg font-bold text-white">
                            {entry.guestName}
                          </span>
                          <span className="text-xs font-bold bg-zinc-900 text-zinc-200 px-2.5 py-0.5 rounded-full">
                            {entry.partySize} {entry.partySize === 1 ? 'guest' : 'guests'}
                          </span>
                          {isOnMyWay && (
                            <span
                              data-testid={`on-my-way-badge-${entry.ticketNumber}`}
                              className="inline-flex items-center gap-1 text-xs font-bold bg-emerald-400 text-zinc-950 px-2.5 py-0.5 rounded-full"
                            >
                              <Check className="w-3.5 h-3.5" />
                              I&apos;m on my way
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400 flex-wrap">
                          <span>
                            {formatZone(entry.seatingPreference)} ·{' '}
                            {entry.phoneNumber || 'no phone'}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 font-mono font-bold tabular-nums ${
                              claim.expired
                                ? 'text-rose-400'
                                : claim.urgent
                                  ? 'text-amber-300'
                                  : 'text-emerald-300'
                            }`}
                          >
                            <Clock className="w-3.5 h-3.5" />
                            {claim.text}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <button
                        type="button"
                        disabled={busyId === entry.id}
                        onClick={() => handleSeat(entry.id)}
                        data-testid={`seat-btn-${entry.ticketNumber}`}
                        className="flex-1 sm:flex-none bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <UserCheck className="w-4 h-4" />
                        Seated
                      </button>
                      <button
                        type="button"
                        disabled={busyId === entry.id}
                        onClick={() => handleNoShow(entry.id)}
                        data-testid={`noshow-btn-${entry.ticketNumber}`}
                        className="flex-1 sm:flex-none bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 font-semibold text-sm px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <UserX className="w-4 h-4" />
                        No-show
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* SECTION 2: Waiting, in order */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
              Waiting, in order ({waiting.length})
            </h2>
          </div>

          {waiting.length === 0 ? (
            <div className="bg-zinc-900/40 border border-dashed border-zinc-800 rounded-2xl p-8 text-center text-sm text-zinc-500">
              The waiting list is clear. Guests can scan the door QR code or you can tap + Add walk-in.
            </div>
          ) : (
            <div className="grid gap-3">
              {waiting.map((entry) => {
                const waitedMins = Math.max(
                  0,
                  Math.floor((nowMs - new Date(entry.joinedAt).getTime()) / 60000)
                );
                const overdue = waitedMins > entry.quotedWaitMinutes;
                return (
                  <div
                    key={entry.id}
                    data-testid={`waiting-row-${entry.ticketNumber}`}
                    className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors"
                  >
                    <div className="flex items-start sm:items-center gap-4">
                      <span className="font-mono text-lg font-bold bg-zinc-800 text-zinc-200 px-3 py-1.5 rounded-xl shrink-0">
                        #{padTicket(entry.ticketNumber)}
                      </span>
                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-lg font-bold text-white">
                            {entry.guestName}
                          </span>
                          <span className="text-xs font-bold bg-zinc-800 text-zinc-300 px-2.5 py-0.5 rounded-full">
                            {entry.partySize} {entry.partySize === 1 ? 'guest' : 'guests'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400 flex-wrap">
                          <span>
                            {formatZone(entry.seatingPreference)} ·{' '}
                            {entry.phoneNumber || 'no phone'}
                          </span>
                          <span
                            className={`font-semibold tabular-nums ${
                              overdue ? 'text-amber-400' : 'text-zinc-400'
                            }`}
                          >
                            {waitedMins} min waiting
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <button
                        type="button"
                        disabled={busyId === entry.id}
                        onClick={() => handleNotify(entry)}
                        data-testid={`notify-btn-${entry.ticketNumber}`}
                        className="flex-1 sm:flex-none bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-sm px-5 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <Bell className="w-4 h-4" />
                        Notify
                      </button>
                      <button
                        type="button"
                        disabled={busyId === entry.id}
                        onClick={() => handleSeat(entry.id)}
                        data-testid={`seat-waiting-btn-${entry.ticketNumber}`}
                        className="flex-1 sm:flex-none bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-sm px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <UserCheck className="w-4 h-4" />
                        Seated
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Bottom Action Toast with Undo */}
      {toast && (
        <div
          data-testid="notify-undo-toast"
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 max-w-md w-[calc(100%-2rem)] bg-zinc-900 border border-emerald-500/40 text-white rounded-2xl px-4 py-3.5 shadow-2xl flex items-center justify-between gap-3"
        >
          <span className="text-sm font-medium">
            Notified <strong>{toast.guestName}</strong>. Their phone is buzzing.
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleUndoNotify(toast.entryId)}
              data-testid="undo-notify-btn"
              className="bg-white text-zinc-950 hover:bg-zinc-200 font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Undo
            </button>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="p-1 text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Add Walk-In Modal */}
      {showWalkIn && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-white">Add walk-in party</h2>
              <button
                type="button"
                onClick={() => setShowWalkIn(false)}
                className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddWalkIn} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Guest name
                </label>
                <input
                  type="text"
                  required
                  value={walkInName}
                  onChange={(e) => setWalkInName(e.target.value)}
                  placeholder="e.g. Jordan"
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <span className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Party size
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {PARTY_SIZES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setWalkInSize(s)}
                      className={`py-2.5 rounded-xl font-mono text-sm font-bold ${
                        walkInSize === s
                          ? 'bg-emerald-500 text-zinc-950'
                          : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                      }`}
                    >
                      {s === 8 ? '8+' : s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Seating
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {(['inside', 'patio', 'either'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setWalkInSeating(opt)}
                      className={`py-2.5 rounded-xl text-xs font-bold capitalize ${
                        walkInSeating === opt
                          ? 'bg-white text-zinc-950'
                          : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Phone (optional)
                </label>
                <input
                  type="tel"
                  value={walkInPhone}
                  onChange={(e) => setWalkInPhone(e.target.value)}
                  placeholder="555-0199"
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={walkInBusy}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm py-3.5 rounded-xl transition-colors disabled:opacity-60"
              >
                {walkInBusy ? 'Adding...' : 'Add to waiting list'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
