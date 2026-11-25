'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  BellRing,
  CheckCircle2,
  Clock,
  ExternalLink,
  LogOut,
  Radio,
  ShieldCheck,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';
import { GuestTicketProjection, SeatingPreference } from '@/types/waitlist';
import { formatOrdinal } from '@/lib/wait-estimator';
import { waitlistBuzzer } from '@/lib/waitlist-buzzer';
import { useWakeLock } from '@/lib/useWakeLock';

const PARTY_SIZES = [1, 2, 3, 4, 5, 6, 7, 8] as const;

function formatTicketNum(n: number): string {
  return String(n).padStart(3, '0');
}

function formatSeatingLabel(pref: SeatingPreference): string {
  if (pref === 'inside') return 'inside';
  if (pref === 'patio') return 'patio';
  return 'first open table';
}

function formatCountdown(msRemaining: number): string {
  const totalSec = Math.max(0, Math.floor(msRemaining / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function JoinWaitlistContent() {
  const searchParams = useSearchParams();
  const slug = searchParams.get('slug') || 'demo-cafe';

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [ticket, setTicket] = useState<GuestTicketProjection | null>(null);

  // Join form state
  const [restaurantName, setRestaurantName] = useState('Chimer Bistro & Lounge');
  const [nextTicketNumber, setNextTicketNumber] = useState(65);
  const [waitingCount, setWaitingCount] = useState(0);
  const [estimateMinutes, setEstimateMinutes] = useState(12);

  const [name, setName] = useState('');
  const [partySize, setPartySize] = useState<number>(2);
  const [seatingPreference, setSeatingPreference] = useState<SeatingPreference>('either');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Ticket live state
  const [sseConnected, setSseConnected] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  const prevStatusRef = useRef<string | null>(null);

  // Wake Lock active while waiting or called
  const shouldStayAwake = Boolean(
    ticket && (ticket.status === 'waiting' || ticket.status === 'called')
  );
  const wakeLock = useWakeLock(shouldStayAwake);

  // Fetch existing HttpOnly ticket session on mount
  const fetchMyTicket = useCallback(async (): Promise<GuestTicketProjection | null> => {
    try {
      const res = await fetch('/api/waitlist/my-ticket', { cache: 'no-store' });
      if (!res.ok) return null;
      const data = (await res.json()) as { ticket?: GuestTicketProjection };
      return data.ticket || null;
    } catch {
      return null;
    }
  }, []);

  const fetchEstimate = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/waitlist/estimate?slug=${encodeURIComponent(slug)}&partySize=${partySize}&seating=${seatingPreference}`,
        { cache: 'no-store' }
      );
      if (!res.ok) return;
      const data = await res.json();
      setEstimateMinutes(data.estimateMinutes ?? 12);
      setWaitingCount(data.waitingCount ?? 0);
      setNextTicketNumber(data.nextTicketNumber ?? 65);
      if (data.restaurantName) setRestaurantName(data.restaurantName);
    } catch {
      // Non-blocking
    }
  }, [slug, partySize, seatingPreference]);

  useEffect(() => {
    let active = true;
    (async () => {
      const existing = await fetchMyTicket();
      if (!active) return;
      if (existing && existing.status !== 'left' && existing.status !== 'seated' && existing.status !== 'no_show') {
        setTicket(existing);
        prevStatusRef.current = existing.status;
      } else {
        await fetchEstimate();
      }
      setLoadingInitial(false);
    })();
    return () => {
      active = false;
    };
  }, [fetchMyTicket, fetchEstimate]);

  // Re-fetch live estimate whenever partySize or seatingPreference changes on join form
  useEffect(() => {
    if (!ticket && !loadingInitial) {
      fetchEstimate();
    }
  }, [ticket, loadingInitial, fetchEstimate]);

  // 1-second tick for 5:00 claim countdown when called
  useEffect(() => {
    if (!ticket || (ticket.status !== 'called' && ticket.status !== 'on_my_way')) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [ticket]);

  // Trigger loud buzzer + haptics when status transitions to 'called'
  useEffect(() => {
    if (!ticket) {
      waitlistBuzzer.stopPagerLoop();
      return;
    }

    if (ticket.status === 'called') {
      if (prevStatusRef.current !== 'called') {
        waitlistBuzzer.startPagerLoop();
      }
    } else {
      waitlistBuzzer.stopPagerLoop();
    }
    prevStatusRef.current = ticket.status;
  }, [ticket]);

  // Scoped SSE listener (zero-polling, instant <1s push)
  useEffect(() => {
    if (!ticket) return;
    if (ticket.status === 'seated' || ticket.status === 'no_show' || ticket.status === 'left') {
      return;
    }

    const es = new EventSource('/api/waitlist/stream');
    es.onopen = () => setSseConnected(true);
    es.onerror = () => setSseConnected(false);
    es.onmessage = async (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'CONNECTED') {
          setSseConnected(true);
          return;
        }
        if (
          msg.type === 'TICKET_CALLED' ||
          msg.type === 'TICKET_UNDONE' ||
          msg.type === 'TICKET_STATUS' ||
          msg.type === 'QUEUE_MOVED'
        ) {
          const updated = await fetchMyTicket();
          if (updated) setTicket(updated);
        }
      } catch {
        // Ignore malformed event
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchMyTicket().then((u) => u && setTicket(u));
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      es.close();
      setSseConnected(false);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [ticket?.realtimeChannel, ticket?.status, fetchMyTicket]);

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Please enter your name so the host knows who to call.');
      return;
    }

    // Unlock Web Audio API inside the user gesture!
    const unlocked = await waitlistBuzzer.unlock();
    setAudioUnlocked(unlocked);

    setSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch('/api/waitlist/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantSlug: slug,
          name: name.trim(),
          partySize,
          seatingPreference,
          phoneNumber: phoneNumber.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Could not join the line. Please try again.');
        return;
      }
      prevStatusRef.current = data.ticket.status;
      setTicket(data.ticket);
    } catch {
      setFormError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOnMyWay = async () => {
    setActionBusy(true);
    waitlistBuzzer.stopPagerLoop();
    try {
      const res = await fetch('/api/waitlist/on-my-way', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.ticket) {
        setTicket(data.ticket);
      }
    } finally {
      setActionBusy(false);
    }
  };

  const handleLeaveLine = async () => {
    setActionBusy(true);
    waitlistBuzzer.stopPagerLoop();
    try {
      const res = await fetch('/api/waitlist/leave', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.ticket) {
        setTicket(data.ticket);
      }
      setShowLeaveModal(false);
    } finally {
      setActionBusy(false);
    }
  };

  const handleResetToJoin = () => {
    setTicket(null);
    setName('');
    setPhoneNumber('');
    fetchEstimate();
  };

  const claimRemainingMs = useMemo(() => {
    if (!ticket?.claimDeadlineAt) return 5 * 60 * 1000;
    return Math.max(0, new Date(ticket.claimDeadlineAt).getTime() - nowMs);
  }, [ticket?.claimDeadlineAt, nowMs]);

  if (loadingInitial) {
    return (
      <div
        dir="ltr"
        className="min-h-screen bg-[#F4F1EA] text-zinc-900 flex items-center justify-center p-6"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-zinc-900 border-t-transparent animate-spin" />
          <p className="text-sm font-medium text-zinc-600">Loading your table ticket...</p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // STATE: FULL-SCREEN GREEN "TABLE READY" TAKEOVER
  // ---------------------------------------------------------------------------
  if (ticket && (ticket.status === 'called' || ticket.status === 'on_my_way')) {
    const isAck = ticket.status === 'on_my_way';
    return (
      <div
        dir="ltr"
        data-testid="buzzer-ready-takeover"
        className="min-h-screen bg-emerald-600 text-white flex flex-col justify-between p-6 sm:p-8 transition-colors duration-300"
      >
        <div className="flex items-center justify-between text-emerald-100 text-sm font-medium">
          <span>{ticket.restaurantName}</span>
          <span className="font-mono bg-emerald-700/70 px-3 py-1 rounded-full">
            No. {formatTicketNum(ticket.ticketNumber)}
          </span>
        </div>

        <div className="my-auto py-8 text-center max-w-md mx-auto w-full">
          <div className="w-20 h-20 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center mx-auto mb-6 animate-bounce">
            <BellRing className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3">
            Your table is ready.
          </h1>
          <p className="text-xl text-emerald-50 font-medium mb-6">
            Come to the host stand.
          </p>

          <div className="bg-emerald-700/60 border border-emerald-400/30 rounded-2xl p-5 mb-6">
            <p className="text-lg font-semibold">
              {ticket.name}, party of {ticket.partySize}, ticket{' '}
              <span className="font-mono">{formatTicketNum(ticket.ticketNumber)}</span>
            </p>
            <div className="mt-3 inline-flex items-center gap-2 bg-white/15 px-4 py-1.5 rounded-full text-sm font-mono font-semibold tabular-nums">
              <Clock className="w-4 h-4" />
              <span data-testid="claim-countdown">
                {formatCountdown(claimRemainingMs)} left to claim it
              </span>
            </div>
          </div>

          {isAck ? (
            <div
              data-testid="on-my-way-confirmed"
              className="w-full bg-white text-emerald-800 rounded-2xl py-4 px-6 font-bold text-lg flex items-center justify-center gap-2 shadow-lg"
            >
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              Host notified — see you at the stand!
            </div>
          ) : (
            <button
              type="button"
              disabled={actionBusy}
              onClick={handleOnMyWay}
              data-testid="on-my-way-btn"
              className="w-full bg-white hover:bg-emerald-50 active:scale-[0.98] text-emerald-900 rounded-2xl py-4 px-6 font-bold text-lg shadow-xl transition-all disabled:opacity-60"
            >
              {actionBusy ? 'Notifying host...' : "I'm on my way"}
            </button>
          )}
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={() => setShowLeaveModal(true)}
            className="text-sm text-emerald-100/80 hover:text-white underline underline-offset-4"
          >
            Plans changed? Leave the line
          </button>
        </div>

        {showLeaveModal && (
          <LeaveConfirmModal
            busy={actionBusy}
            onCancel={() => setShowLeaveModal(false)}
            onConfirm={handleLeaveLine}
          />
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // STATE: RESOLVED (SEATED / NO_SHOW / LEFT)
  // ---------------------------------------------------------------------------
  if (
    ticket &&
    (ticket.status === 'seated' || ticket.status === 'no_show' || ticket.status === 'left')
  ) {
    const title =
      ticket.status === 'seated'
        ? 'Enjoy your meal!'
        : ticket.status === 'no_show'
          ? 'Table claim window expired'
          : 'You left the line';

    const subtitle =
      ticket.status === 'seated'
        ? `Ticket #${formatTicketNum(ticket.ticketNumber)} has been seated.`
        : ticket.status === 'no_show'
          ? 'The host marked this ticket as a no-show. Please check with the host stand or rejoin.'
          : 'Your spot has been freed for the next party.';

    return (
      <div
        dir="ltr"
        className="min-h-screen bg-[#F4F1EA] text-zinc-900 flex items-center justify-center p-6"
      >
        <div className="max-w-md w-full bg-[#FFFDF9] border border-zinc-200 rounded-3xl p-8 text-center shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-7 h-7 text-zinc-800" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">{title}</h1>
          <p className="text-zinc-600 text-sm mb-6">{subtitle}</p>
          <button
            type="button"
            onClick={handleResetToJoin}
            className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold py-3.5 rounded-2xl transition-colors"
          >
            Join the line again
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // STATE: WAITING TACTILE PERFORATED TICKET
  // ---------------------------------------------------------------------------
  if (ticket && ticket.status === 'waiting') {
    const formattedNum = formatTicketNum(ticket.ticketNumber);
    return (
      <div
        dir="ltr"
        data-testid="waiting-ticket-view"
        className="min-h-screen bg-[#F4F1EA] text-zinc-900 flex flex-col justify-between p-4 sm:p-6"
      >
        <div className="max-w-md w-full mx-auto my-auto py-4">
          {/* Audio recovery bar if user refreshed on iOS Safari */}
          {!audioUnlocked && (
            <button
              type="button"
              onClick={async () => {
                const ok = await waitlistBuzzer.unlock();
                setAudioUnlocked(ok);
                waitlistBuzzer.playPagerBurst();
              }}
              className="w-full mb-4 bg-amber-100 hover:bg-amber-200/80 border border-amber-300 text-amber-950 rounded-2xl px-4 py-2.5 text-xs font-semibold flex items-center justify-between transition-colors"
            >
              <span className="flex items-center gap-2">
                <Volume2 className="w-4 h-4" />
                Tap to enable loud buzzer chime
              </span>
              <span className="underline">Test chime</span>
            </button>
          )}

          {/* Tactile Physical Ticket Card */}
          <div className="bg-[#FFFDF9] border border-zinc-200/90 rounded-[28px] shadow-[0_14px_40px_rgba(24,24,27,0.08)] overflow-hidden">
            {/* Upper Ticket Body */}
            <div className="p-6 sm:p-7">
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                  {ticket.restaurantName}
                </span>
                <span className="font-mono text-sm font-bold text-zinc-900 bg-zinc-100 px-3 py-1 rounded-full">
                  No. {formattedNum}
                </span>
              </div>

              <div className="text-center py-3">
                <h1
                  data-testid="ticket-place-heading"
                  className="text-4xl sm:text-5xl font-extrabold tracking-tight text-zinc-950 leading-tight"
                >
                  You&apos;re {formatOrdinal(ticket.place)} in line
                </h1>

                <div className="mt-4 inline-flex items-center gap-2 bg-amber-100 border border-amber-200 text-amber-950 px-4 py-1.5 rounded-full text-sm font-bold">
                  <Clock className="w-4 h-4 text-amber-700" />
                  <span>About {ticket.estimateMinutes} minutes</span>
                </div>

                <p className="mt-5 text-base font-medium text-zinc-700">
                  {ticket.name}, party of {ticket.partySize},{' '}
                  {formatSeatingLabel(ticket.seatingPreference)}
                </p>
              </div>
            </div>

            {/* Perforated Tear Line with Circular Side Notches */}
            <div className="relative flex items-center">
              <div className="w-5 h-10 bg-[#F4F1EA] rounded-r-full border-y border-r border-zinc-200/90 -ml-px" />
              <div className="flex-1 border-t-2 border-dashed border-zinc-300 mx-2" />
              <div className="w-5 h-10 bg-[#F4F1EA] rounded-l-full border-y border-l border-zinc-200/90 -mr-px" />
            </div>

            {/* Lower Ticket Stub */}
            <div className="p-6 sm:p-7 pt-5 flex items-center gap-5 bg-[#FAF7F0]">
              <div className="flex items-center justify-center w-12 shrink-0 border-r border-zinc-200 pr-4">
                <span className="font-mono text-2xl font-black tracking-widest text-zinc-400 -rotate-90 select-none">
                  {formattedNum}
                </span>
              </div>

              <div className="flex-1 space-y-2.5">
                <p className="text-sm font-medium text-zinc-700 leading-snug">
                  We&apos;ll buzz this phone when your table is ready. Keep this page open.
                </p>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        sseConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                      }`}
                    />
                    {sseConnected
                      ? 'Live. Your place moves the moment the line does.'
                      : 'Reconnecting to live line...'}
                  </span>

                  {wakeLock.isActive && (
                    <span className="inline-flex items-center gap-1 text-zinc-500 font-medium">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Screen staying awake
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dark Bottom Utility Bar */}
        <div className="max-w-md w-full mx-auto pt-3">
          <div className="bg-zinc-900 text-white rounded-2xl p-2 flex items-center justify-between gap-2 shadow-lg">
            <button
              type="button"
              onClick={() => setShowMenuModal(true)}
              className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4 text-zinc-400" />
              See the menu
            </button>
            <div className="w-px h-6 bg-zinc-700" />
            <button
              type="button"
              onClick={() => setShowLeaveModal(true)}
              data-testid="leave-line-btn"
              className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-rose-300 hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Leave the line
            </button>
          </div>
        </div>

        {showLeaveModal && (
          <LeaveConfirmModal
            busy={actionBusy}
            onCancel={() => setShowLeaveModal(false)}
            onConfirm={handleLeaveLine}
          />
        )}

        {showMenuModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
            <div className="bg-[#FFFDF9] text-zinc-900 rounded-3xl max-w-md w-full p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">{ticket.restaurantName} — Menu Highlights</h2>
                <button
                  type="button"
                  onClick={() => setShowMenuModal(false)}
                  className="p-1.5 rounded-full hover:bg-zinc-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-zinc-100">
                  <span className="font-semibold">Truffle Brioche Eggs</span>
                  <span className="font-mono text-zinc-600">$18</span>
                </div>
                <div className="flex justify-between py-2 border-b border-zinc-100">
                  <span className="font-semibold">Cardamom Spanish Latte</span>
                  <span className="font-mono text-zinc-600">$7</span>
                </div>
                <div className="flex justify-between py-2 border-b border-zinc-100">
                  <span className="font-semibold">Crispy Halloumi Flatbread</span>
                  <span className="font-mono text-zinc-600">$15</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="font-semibold">Pistachio Rose Croissant</span>
                  <span className="font-mono text-zinc-600">$8</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMenuModal(false)}
                className="mt-5 w-full bg-zinc-900 text-white py-3 rounded-2xl font-semibold text-sm"
              >
                Back to my ticket
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // STATE: GUEST JOIN FORM
  // ---------------------------------------------------------------------------
  return (
    <div dir="ltr" className="min-h-screen bg-[#F4F1EA] text-zinc-900 py-8 px-4 sm:px-6">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-bold tracking-tight text-zinc-800">
              {restaurantName}
            </span>
          </div>
          <span className="font-mono text-xs font-bold bg-zinc-900 text-white px-3 py-1 rounded-full">
            Now joining: #{formatTicketNum(nextTicketNumber)}
          </span>
        </div>

        <div className="bg-[#FFFDF9] border border-zinc-200/90 rounded-[28px] p-6 sm:p-7 shadow-[0_12px_36px_rgba(24,24,27,0.06)]">
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-950 mb-4">
            Get in line for a table
          </h1>

          {/* Dynamic Wait Banner */}
          <div
            data-testid="dynamic-wait-banner"
            className="bg-amber-100/90 border border-amber-200 rounded-2xl p-4 mb-6"
          >
            <div className="flex items-center gap-2 text-amber-950 font-bold text-base">
              <Sparkles className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                About {estimateMinutes} minutes for {partySize === 8 ? '8+' : partySize}
              </span>
            </div>
            <p className="text-xs text-amber-900/80 mt-1 leading-relaxed">
              {waitingCount === 0
                ? 'No parties ahead of you right now. '
                : `${waitingCount} ${waitingCount === 1 ? 'party is' : 'parties are'} ahead of you. `}
              Bigger tables turn slower, so bigger parties wait a little longer.
            </p>
          </div>

          <form onSubmit={handleJoinSubmit} className="space-y-5">
            {/* 1. Your Name */}
            <div>
              <label htmlFor="guest-name" className="block text-sm font-bold text-zinc-800 mb-1.5">
                Your name
              </label>
              <input
                id="guest-name"
                type="text"
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex"
                className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3.5 text-base font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>

            {/* 2. Party Size 2x4 Grid */}
            <div>
              <span className="block text-sm font-bold text-zinc-800 mb-2">
                How many of you?
              </span>
              <div className="grid grid-cols-4 gap-2">
                {PARTY_SIZES.map((size) => {
                  const selected = partySize === size;
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setPartySize(size)}
                      data-testid={`party-size-${size}`}
                      className={`py-3 rounded-2xl font-mono text-base font-bold transition-all ${
                        selected
                          ? 'bg-zinc-900 text-white shadow-sm scale-[1.02]'
                          : 'bg-zinc-100 text-zinc-800 hover:bg-zinc-200'
                      }`}
                    >
                      {size === 8 ? '8+' : size}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Seating Preference */}
            <div>
              <span className="block text-sm font-bold text-zinc-800 mb-2">
                Where do you want to sit?
              </span>
              <div className="grid grid-cols-3 gap-2 bg-zinc-100 p-1.5 rounded-2xl">
                {(['inside', 'patio', 'either'] as const).map((opt) => {
                  const selected = seatingPreference === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setSeatingPreference(opt)}
                      className={`py-2.5 rounded-xl text-sm font-bold capitalize transition-all ${
                        selected
                          ? 'bg-white text-zinc-950 shadow-sm'
                          : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-zinc-500 mt-1.5">
                Either gets you the first open table.
              </p>
            </div>

            {/* 4. Optional Phone Number */}
            <div>
              <label htmlFor="guest-phone" className="block text-sm font-bold text-zinc-800 mb-1.5">
                Phone number <span className="font-normal text-zinc-500">(optional)</span>
              </label>
              <input
                id="guest-phone"
                type="tel"
                maxLength={30}
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="(555) 012-3456"
                className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-base font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
              <p className="text-xs text-zinc-500 mt-1.5">
                Only so the host can call if you step away. No texts, ever.
              </p>
            </div>

            {formError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium px-4 py-3 rounded-2xl">
                {formError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              data-testid="join-line-submit"
              className="w-full bg-zinc-950 hover:bg-zinc-800 active:scale-[0.99] text-white font-bold text-base py-4 rounded-2xl shadow-md transition-all disabled:opacity-60"
            >
              {submitting ? 'Adding you to the line...' : 'Join the line'}
            </button>
          </form>

          <p className="text-center text-xs text-zinc-500 mt-4">
            Keep this page open after you join. Your phone acts as your table buzzer.
          </p>
        </div>
      </div>
    </div>
  );
}

function LeaveConfirmModal({
  busy,
  onCancel,
  onConfirm,
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#FFFDF9] text-zinc-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl">
        <h2 className="text-xl font-bold mb-2">Leave the line?</h2>
        <p className="text-sm text-zinc-600 mb-6">
          Your spot will be given to the next party waiting.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 rounded-2xl bg-zinc-100 hover:bg-zinc-200 font-semibold text-sm"
          >
            Stay in line
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            data-testid="confirm-leave-btn"
            className="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm disabled:opacity-60"
          >
            {busy ? 'Leaving...' : 'Leave line'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <div dir="ltr" className="min-h-screen bg-[#F4F1EA] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-zinc-900 border-t-transparent animate-spin" />
        </div>
      }
    >
      <JoinWaitlistContent />
    </Suspense>
  );
}
