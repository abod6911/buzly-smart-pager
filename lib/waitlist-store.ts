import crypto from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  GuestTicketProjection,
  HostKpis,
  SeatingPreference,
  WaitlistAiBrief,
  WaitlistEntry,
  WaitlistSource,
  WaitlistStatus,
} from '@/types/waitlist';
import { estimateWaitMinutes } from '@/lib/wait-estimator';
import { hashGuestToken } from '@/lib/waitlist-security';

const CLAIM_WINDOW_MS = 5 * 60 * 1000; // 5:00 minutes

function getAdminSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey || !url.startsWith('http') || url.includes('placeholder')) {
    return null;
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// -----------------------------------------------------------------------------
// In-Memory Server Fallback Store (when SUPABASE_SERVICE_ROLE_KEY is absent)
// -----------------------------------------------------------------------------
declare global {
  // eslint-disable-next-line no-var
  var __chimer_waitlist_entries: WaitlistEntry[] | undefined;
  // eslint-disable-next-line no-var
  var __chimer_waitlist_briefs: WaitlistAiBrief[] | undefined;
  // eslint-disable-next-line no-var
  var __chimer_waitlist_seeded: boolean | undefined;
}

function getMemEntries(): WaitlistEntry[] {
  if (!globalThis.__chimer_waitlist_entries) {
    globalThis.__chimer_waitlist_entries = [];
  }
  return globalThis.__chimer_waitlist_entries;
}

function getMemBriefs(): WaitlistAiBrief[] {
  if (!globalThis.__chimer_waitlist_briefs) {
    globalThis.__chimer_waitlist_briefs = [];
  }
  return globalThis.__chimer_waitlist_briefs;
}

export function getTodayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function mapRow(row: Record<string, unknown>): WaitlistEntry {
  return {
    id: String(row.id),
    restaurantSlug: String(row.restaurant_slug || 'demo-cafe'),
    ticketNumber: Number(row.ticket_number),
    guestName: String(row.guest_name),
    partySize: Number(row.party_size),
    seatingPreference: (row.seating_preference as SeatingPreference) || 'either',
    phoneNumber: row.phone_number ? String(row.phone_number) : null,
    status: (row.status as WaitlistStatus) || 'waiting',
    tokenHash: String(row.token_hash),
    channelId: String(row.channel_id),
    quotedWaitMinutes: Number(row.quoted_wait_minutes || 15),
    joinedAt: String(row.joined_at),
    calledAt: row.called_at ? String(row.called_at) : null,
    acknowledgedAt: row.acknowledged_at ? String(row.acknowledged_at) : null,
    resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
    source: (row.source as WaitlistSource) || 'qr',
    createdDate: String(row.created_date || getTodayDateStr()),
  };
}

export async function getAllTodayEntries(slug: string, dateStr = getTodayDateStr()): Promise<WaitlistEntry[]> {
  const db = getAdminSupabase();
  if (db) {
    const { data, error } = await db
      .from('waitlist_entries')
      .select('*')
      .eq('restaurant_slug', slug)
      .eq('created_date', dateStr)
      .order('joined_at', { ascending: true });

    if (!error && data) {
      return data.map((r) => mapRow(r as Record<string, unknown>));
    }
  }

  return getMemEntries()
    .filter((e) => e.restaurantSlug === slug && e.createdDate === dateStr)
    .sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());
}

export async function getRestaurantDisplayName(slug: string): Promise<string> {
  const db = getAdminSupabase();
  if (db) {
    const { data } = await db
      .from('restaurants')
      .select('name')
      .eq('slug', slug)
      .maybeSingle();
    if (data?.name) return String(data.name);
  }
  return slug === 'demo-cafe' ? 'Chimer Bistro & Lounge' : slug;
}

export async function getNextTicketNumber(slug: string, dateStr = getTodayDateStr()): Promise<number> {
  const entries = await getAllTodayEntries(slug, dateStr);
  if (entries.length === 0) return 65; // Starts at #065 for warm realistic feel
  const maxNum = entries.reduce((max, e) => Math.max(max, e.ticketNumber), 64);
  return maxNum + 1;
}

export async function getLiveJoinEstimate(
  slug: string,
  partySize: number,
  seatingPreference: SeatingPreference
): Promise<{ estimateMinutes: number; waitingCount: number; nextTicketNumber: number }> {
  const entries = await getAllTodayEntries(slug);
  const waiting = entries.filter((e) => e.status === 'waiting');
  const seatedToday = entries.filter((e) => e.status === 'seated');

  const estimateMinutes = estimateWaitMinutes({
    partySize,
    seatingPreference,
    waitingAhead: waiting.map((w) => ({
      partySize: w.partySize,
      seatingPreference: w.seatingPreference,
      joinedAt: w.joinedAt,
    })),
    seatedToday: seatedToday.map((s) => ({
      joinedAt: s.joinedAt,
      resolvedAt: s.resolvedAt,
      partySize: s.partySize,
    })),
  });

  const maxNum = entries.length === 0 ? 64 : entries.reduce((m, e) => Math.max(m, e.ticketNumber), 64);

  return {
    estimateMinutes,
    waitingCount: waiting.length,
    nextTicketNumber: maxNum + 1,
  };
}

export async function createWaitlistEntry(params: {
  restaurantSlug: string;
  guestName: string;
  partySize: number;
  seatingPreference: SeatingPreference;
  phoneNumber: string | null;
  tokenHash: string;
  channelId: string;
  source: WaitlistSource;
}): Promise<WaitlistEntry> {
  const dateStr = getTodayDateStr();
  const { estimateMinutes, nextTicketNumber } = await getLiveJoinEstimate(
    params.restaurantSlug,
    params.partySize,
    params.seatingPreference
  );

  const nowIso = new Date().toISOString();
  const entry: WaitlistEntry = {
    id: crypto.randomUUID(),
    restaurantSlug: params.restaurantSlug,
    ticketNumber: nextTicketNumber,
    guestName: params.guestName,
    partySize: params.partySize,
    seatingPreference: params.seatingPreference,
    phoneNumber: params.phoneNumber,
    status: 'waiting',
    tokenHash: params.tokenHash,
    channelId: params.channelId,
    quotedWaitMinutes: estimateMinutes,
    joinedAt: nowIso,
    calledAt: null,
    acknowledgedAt: null,
    resolvedAt: null,
    source: params.source,
    createdDate: dateStr,
  };

  const db = getAdminSupabase();
  if (db) {
    const { data, error } = await db
      .from('waitlist_entries')
      .insert({
        id: entry.id,
        restaurant_slug: entry.restaurantSlug,
        ticket_number: entry.ticketNumber,
        guest_name: entry.guestName,
        party_size: entry.partySize,
        seating_preference: entry.seatingPreference,
        phone_number: entry.phoneNumber,
        status: entry.status,
        token_hash: entry.tokenHash,
        channel_id: entry.channelId,
        quoted_wait_minutes: entry.quotedWaitMinutes,
        joined_at: entry.joinedAt,
        source: entry.source,
        created_date: entry.createdDate,
      })
      .select('*')
      .single();

    if (!error && data) {
      return mapRow(data as Record<string, unknown>);
    }
    if (error) {
      console.warn('Supabase waitlist insert fallback:', error.message);
    }
  }

  getMemEntries().push(entry);
  return entry;
}

export async function findEntryByTokenHash(tokenHash: string): Promise<WaitlistEntry | null> {
  const db = getAdminSupabase();
  if (db) {
    const { data, error } = await db
      .from('waitlist_entries')
      .select('*')
      .eq('token_hash', tokenHash)
      .maybeSingle();
    if (!error && data) {
      return mapRow(data as Record<string, unknown>);
    }
  }

  return getMemEntries().find((e) => e.tokenHash === tokenHash) || null;
}

export async function buildGuestProjection(entry: WaitlistEntry): Promise<GuestTicketProjection> {
  const allToday = await getAllTodayEntries(entry.restaurantSlug, entry.createdDate);
  const restaurantName = await getRestaurantDisplayName(entry.restaurantSlug);

  const waitingQueue = allToday
    .filter((e) => e.status === 'waiting')
    .sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());

  const seatedToday = allToday.filter((e) => e.status === 'seated');

  let place = 0;
  let waitingAheadCount = 0;
  let estimateMinutes = entry.quotedWaitMinutes;

  if (entry.status === 'waiting') {
    const idx = waitingQueue.findIndex((w) => w.id === entry.id);
    place = idx >= 0 ? idx + 1 : waitingQueue.length + 1;
    const ahead = idx >= 0 ? waitingQueue.slice(0, idx) : waitingQueue;
    waitingAheadCount = ahead.length;

    estimateMinutes = estimateWaitMinutes({
      partySize: entry.partySize,
      seatingPreference: entry.seatingPreference,
      waitingAhead: ahead.map((w) => ({
        partySize: w.partySize,
        seatingPreference: w.seatingPreference,
        joinedAt: w.joinedAt,
      })),
      seatedToday: seatedToday.map((s) => ({
        joinedAt: s.joinedAt,
        resolvedAt: s.resolvedAt,
        partySize: s.partySize,
      })),
    });
  } else if (entry.status === 'called' || entry.status === 'on_my_way') {
    estimateMinutes = 0;
  }

  const claimDeadlineAt = entry.calledAt
    ? new Date(new Date(entry.calledAt).getTime() + CLAIM_WINDOW_MS).toISOString()
    : null;

  return {
    ticketNumber: entry.ticketNumber,
    restaurantSlug: entry.restaurantSlug,
    restaurantName,
    name: entry.guestName,
    partySize: entry.partySize,
    seatingPreference: entry.seatingPreference,
    place,
    waitingAheadCount,
    estimateMinutes,
    status: entry.status,
    joinedAt: entry.joinedAt,
    calledAt: entry.calledAt,
    claimDeadlineAt,
    acknowledgedAt: entry.acknowledgedAt,
    realtimeChannel: entry.channelId,
  };
}

export async function updateEntryById(
  id: string,
  slug: string,
  patch: Partial<WaitlistEntry>
): Promise<WaitlistEntry | null> {
  const db = getAdminSupabase();
  if (db) {
    const dbPatch: Record<string, unknown> = {};
    if (patch.status !== undefined) dbPatch.status = patch.status;
    if (patch.calledAt !== undefined) dbPatch.called_at = patch.calledAt;
    if (patch.acknowledgedAt !== undefined) dbPatch.acknowledged_at = patch.acknowledgedAt;
    if (patch.resolvedAt !== undefined) dbPatch.resolved_at = patch.resolvedAt;

    const { data, error } = await db
      .from('waitlist_entries')
      .update(dbPatch)
      .eq('id', id)
      .eq('restaurant_slug', slug)
      .select('*')
      .maybeSingle();

    if (!error && data) {
      return mapRow(data as Record<string, unknown>);
    }
  }

  const entries = getMemEntries();
  const idx = entries.findIndex((e) => e.id === id && e.restaurantSlug === slug);
  if (idx === -1) return null;
  entries[idx] = { ...entries[idx], ...patch };
  return entries[idx];
}

export async function getEntryById(id: string, slug: string): Promise<WaitlistEntry | null> {
  const db = getAdminSupabase();
  if (db) {
    const { data, error } = await db
      .from('waitlist_entries')
      .select('*')
      .eq('id', id)
      .eq('restaurant_slug', slug)
      .maybeSingle();
    if (!error && data) return mapRow(data as Record<string, unknown>);
  }
  return getMemEntries().find((e) => e.id === id && e.restaurantSlug === slug) || null;
}

export async function listHostWaitlist(slug: string): Promise<{
  called: WaitlistEntry[];
  waiting: WaitlistEntry[];
  kpis: HostKpis;
}> {
  const entries = await getAllTodayEntries(slug);
  const called = entries
    .filter((e) => e.status === 'called' || e.status === 'on_my_way')
    .sort((a, b) => {
      const aT = a.calledAt ? new Date(a.calledAt).getTime() : 0;
      const bT = b.calledAt ? new Date(b.calledAt).getTime() : 0;
      return aT - bT;
    });

  const waiting = entries
    .filter((e) => e.status === 'waiting')
    .sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());

  const seated = entries.filter((e) => e.status === 'seated');
  const noShow = entries.filter((e) => e.status === 'no_show');
  const left = entries.filter((e) => e.status === 'left');

  const avgWaitMinutes = estimateWaitMinutes({
    partySize: 2,
    seatingPreference: 'either',
    waitingAhead: waiting.map((w) => ({
      partySize: w.partySize,
      seatingPreference: w.seatingPreference,
      joinedAt: w.joinedAt,
    })),
    seatedToday: seated.map((s) => ({
      joinedAt: s.joinedAt,
      resolvedAt: s.resolvedAt,
      partySize: s.partySize,
    })),
  });

  const maxNum = entries.length === 0 ? 64 : entries.reduce((m, e) => Math.max(m, e.ticketNumber), 64);

  return {
    called,
    waiting,
    kpis: {
      waitingCount: waiting.length,
      calledCount: called.length,
      seatedCount: seated.length,
      noShowCount: noShow.length,
      leftCount: left.length,
      avgWaitMinutes,
      nextTicketNumber: maxNum + 1,
    },
  };
}

/**
 * Idempotent Saturday Brunch Rush seeder for local/dev testing and analytics demos.
 */
export async function seedSaturdayBrunchRush(slug = 'demo-cafe'): Promise<{
  inserted: number;
  alreadySeeded: boolean;
}> {
  const dateStr = getTodayDateStr();
  const existing = await getAllTodayEntries(slug, dateStr);
  if (existing.length >= 8) {
    return { inserted: 0, alreadySeeded: true };
  }

  const now = Date.now();
  const minsAgo = (m: number) => new Date(now - m * 60000).toISOString();

  const samples: Array<{
    ticketNumber: number;
    guestName: string;
    partySize: number;
    seatingPreference: SeatingPreference;
    phoneNumber: string | null;
    status: WaitlistStatus;
    quotedWaitMinutes: number;
    joinedAt: string;
    calledAt: string | null;
    acknowledgedAt: string | null;
    resolvedAt: string | null;
    source: WaitlistSource;
  }> = [
    // Seated earlier during morning rush
    { ticketNumber: 55, guestName: 'Layla H.', partySize: 2, seatingPreference: 'inside', phoneNumber: null, status: 'seated', quotedWaitMinutes: 12, joinedAt: minsAgo(150), calledAt: minsAgo(139), acknowledgedAt: minsAgo(138), resolvedAt: minsAgo(136), source: 'qr' },
    { ticketNumber: 56, guestName: 'Omar K.', partySize: 4, seatingPreference: 'patio', phoneNumber: '555-0101', status: 'seated', quotedWaitMinutes: 18, joinedAt: minsAgo(140), calledAt: minsAgo(124), acknowledgedAt: null, resolvedAt: minsAgo(121), source: 'qr' },
    { ticketNumber: 57, guestName: 'Maya R.', partySize: 2, seatingPreference: 'either', phoneNumber: null, status: 'seated', quotedWaitMinutes: 10, joinedAt: minsAgo(120), calledAt: minsAgo(109), acknowledgedAt: minsAgo(108), resolvedAt: minsAgo(106), source: 'walk_in' },
    { ticketNumber: 58, guestName: 'Tariq S.', partySize: 6, seatingPreference: 'inside', phoneNumber: '555-0144', status: 'left', quotedWaitMinutes: 25, joinedAt: minsAgo(115), calledAt: null, acknowledgedAt: null, resolvedAt: minsAgo(84), source: 'qr' },
    { ticketNumber: 59, guestName: 'Elena V.', partySize: 5, seatingPreference: 'patio', phoneNumber: null, status: 'left', quotedWaitMinutes: 22, joinedAt: minsAgo(95), calledAt: null, acknowledgedAt: null, resolvedAt: minsAgo(66), source: 'qr' },
    { ticketNumber: 60, guestName: 'Noah B.', partySize: 3, seatingPreference: 'either', phoneNumber: '555-0188', status: 'no_show', quotedWaitMinutes: 15, joinedAt: minsAgo(80), calledAt: minsAgo(62), acknowledgedAt: null, resolvedAt: minsAgo(56), source: 'qr' },
    { ticketNumber: 61, guestName: 'Hana M.', partySize: 2, seatingPreference: 'inside', phoneNumber: null, status: 'seated', quotedWaitMinutes: 14, joinedAt: minsAgo(65), calledAt: minsAgo(51), acknowledgedAt: minsAgo(50), resolvedAt: minsAgo(48), source: 'qr' },
    { ticketNumber: 62, guestName: 'Zayd A.', partySize: 4, seatingPreference: 'either', phoneNumber: '555-0199', status: 'no_show', quotedWaitMinutes: 18, joinedAt: minsAgo(55), calledAt: minsAgo(37), acknowledgedAt: null, resolvedAt: minsAgo(31), source: 'walk_in' },
    // Currently Called
    { ticketNumber: 63, guestName: 'Nadia F.', partySize: 4, seatingPreference: 'inside', phoneNumber: '555-0102', status: 'called', quotedWaitMinutes: 20, joinedAt: minsAgo(24), calledAt: minsAgo(2), acknowledgedAt: null, resolvedAt: null, source: 'qr' },
    { ticketNumber: 64, guestName: 'Samir W.', partySize: 2, seatingPreference: 'patio', phoneNumber: null, status: 'on_my_way', quotedWaitMinutes: 14, joinedAt: minsAgo(19), calledAt: minsAgo(1), acknowledgedAt: minsAgo(0.5), resolvedAt: null, source: 'qr' },
    // Currently Waiting FIFO
    { ticketNumber: 65, guestName: 'Lina D.', partySize: 2, seatingPreference: 'either', phoneNumber: '555-0123', status: 'waiting', quotedWaitMinutes: 14, joinedAt: minsAgo(16), calledAt: null, acknowledgedAt: null, resolvedAt: null, source: 'qr' },
    { ticketNumber: 66, guestName: 'Kareem T.', partySize: 6, seatingPreference: 'inside', phoneNumber: null, status: 'waiting', quotedWaitMinutes: 28, joinedAt: minsAgo(11), calledAt: null, acknowledgedAt: null, resolvedAt: null, source: 'qr' },
    { ticketNumber: 67, guestName: 'Chloe P.', partySize: 3, seatingPreference: 'patio', phoneNumber: '555-0177', status: 'waiting', quotedWaitMinutes: 21, joinedAt: minsAgo(6), calledAt: null, acknowledgedAt: null, resolvedAt: null, source: 'walk_in' },
  ];

  const db = getAdminSupabase();
  let inserted = 0;

  for (const s of samples) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const entry: WaitlistEntry = {
      id: crypto.randomUUID(),
      restaurantSlug: slug,
      ticketNumber: s.ticketNumber,
      guestName: s.guestName,
      partySize: s.partySize,
      seatingPreference: s.seatingPreference,
      phoneNumber: s.phoneNumber,
      status: s.status,
      tokenHash: hashGuestToken(rawToken),
      channelId: crypto.randomBytes(16).toString('hex'),
      quotedWaitMinutes: s.quotedWaitMinutes,
      joinedAt: s.joinedAt,
      calledAt: s.calledAt,
      acknowledgedAt: s.acknowledgedAt,
      resolvedAt: s.resolvedAt,
      source: s.source,
      createdDate: dateStr,
    };

    if (db) {
      const { error } = await db.from('waitlist_entries').insert({
        id: entry.id,
        restaurant_slug: entry.restaurantSlug,
        ticket_number: entry.ticketNumber,
        guest_name: entry.guestName,
        party_size: entry.partySize,
        seating_preference: entry.seatingPreference,
        phone_number: entry.phoneNumber,
        status: entry.status,
        token_hash: entry.tokenHash,
        channel_id: entry.channelId,
        quoted_wait_minutes: entry.quotedWaitMinutes,
        joined_at: entry.joinedAt,
        called_at: entry.calledAt,
        acknowledged_at: entry.acknowledgedAt,
        resolved_at: entry.resolvedAt,
        source: entry.source,
        created_date: entry.createdDate,
      });
      if (!error) inserted++;
    } else {
      getMemEntries().push(entry);
      inserted++;
    }
  }

  return { inserted, alreadySeeded: false };
}

export async function getCachedAiBrief(
  slug: string,
  serviceDate: string,
  dataFingerprint: string
): Promise<{
  id: string;
  summaryWhereLost: string;
  recommendations: string[];
  modelUsed: string;
  generatedAt: string;
} | null> {
  const db = getAdminSupabase();
  if (db) {
    const { data, error } = await db
      .from('waitlist_ai_briefs')
      .select('*')
      .eq('restaurant_slug', slug)
      .eq('service_date', serviceDate)
      .eq('data_fingerprint', dataFingerprint)
      .maybeSingle();

    if (!error && data) {
      return {
        id: String(data.id),
        summaryWhereLost: String(data.summary_where_lost),
        recommendations: Array.isArray(data.recommendations_json)
          ? (data.recommendations_json as string[])
          : [],
        modelUsed: String(data.model_used || 'cached'),
        generatedAt: String(data.generated_at),
      };
    }
  }

  const mem = getMemBriefs().find(
    (b) =>
      b.restaurantSlug === slug &&
      b.serviceDate === serviceDate &&
      b.dataFingerprint === dataFingerprint
  );
  if (!mem) return null;
  return {
    id: mem.id,
    summaryWhereLost: mem.summaryWhereLost,
    recommendations: mem.recommendations,
    modelUsed: mem.modelUsed,
    generatedAt: mem.generatedAt,
  };
}

export async function saveAiBrief(brief: WaitlistAiBrief): Promise<void> {
  const db = getAdminSupabase();
  if (db) {
    await db
      .from('waitlist_ai_briefs')
      .upsert(
        {
          id: brief.id,
          restaurant_slug: brief.restaurantSlug,
          service_date: brief.serviceDate,
          data_fingerprint: brief.dataFingerprint,
          summary_where_lost: brief.summaryWhereLost,
          recommendations_json: brief.recommendations,
          model_used: brief.modelUsed,
          generated_at: brief.generatedAt,
        },
        { onConflict: 'restaurant_slug,service_date,data_fingerprint' }
      );
  }

  const briefs = getMemBriefs();
  const existingIdx = briefs.findIndex(
    (b) =>
      b.restaurantSlug === brief.restaurantSlug &&
      b.serviceDate === brief.serviceDate &&
      b.dataFingerprint === brief.dataFingerprint
  );
  if (existingIdx >= 0) {
    briefs[existingIdx] = brief;
  } else {
    briefs.push(brief);
  }
}
