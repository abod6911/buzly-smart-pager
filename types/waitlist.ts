export type SeatingPreference = 'inside' | 'patio' | 'either';

export type WaitlistStatus =
  | 'waiting'
  | 'called'
  | 'on_my_way'
  | 'seated'
  | 'no_show'
  | 'left';

export type WaitlistSource = 'qr' | 'walk_in';

export interface WaitlistEntry {
  id: string;
  restaurantSlug: string;
  ticketNumber: number;
  guestName: string;
  partySize: number;
  seatingPreference: SeatingPreference;
  phoneNumber: string | null;
  status: WaitlistStatus;
  tokenHash: string;
  channelId: string;
  quotedWaitMinutes: number;
  joinedAt: string; // ISO timestamp
  calledAt: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  source: WaitlistSource;
  createdDate: string; // YYYY-MM-DD
}

/**
 * Strict minimal projection returned to an authenticated guest.
 * NEVER includes other guests' data, tokenHash, or internal IDs.
 */
export interface GuestTicketProjection {
  ticketNumber: number;
  restaurantSlug: string;
  restaurantName: string;
  name: string;
  partySize: number;
  seatingPreference: SeatingPreference;
  place: number; // 1-indexed position in waiting line (0 if already called/resolved)
  waitingAheadCount: number;
  estimateMinutes: number;
  status: WaitlistStatus;
  joinedAt: string;
  calledAt: string | null;
  claimDeadlineAt: string | null; // calledAt + 5 minutes
  acknowledgedAt: string | null;
  realtimeChannel: string;
}

export interface HostKpis {
  waitingCount: number;
  calledCount: number;
  seatedCount: number;
  noShowCount: number;
  leftCount: number;
  avgWaitMinutes: number;
  nextTicketNumber: number;
}

export interface HourlyDropoffBucket {
  hour: number; // 0..23
  hourLabel: string;
  left: number;
  noShow: number;
  seated: number;
  totalDropoff: number;
}

export interface WaitlistAiBrief {
  id: string;
  restaurantSlug: string;
  serviceDate: string;
  dataFingerprint: string;
  summaryWhereLost: string;
  recommendations: string[];
  modelUsed: string;
  generatedAt: string;
  cached: boolean;
  hourlyBreakdown: HourlyDropoffBucket[];
  stats: {
    totalParties: number;
    seatedCount: number;
    leftCount: number;
    noShowCount: number;
    avgQuotedMinutes: number;
    avgActualWaitMinutes: number;
  };
}
