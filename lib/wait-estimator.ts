import type { SeatingPreference } from '@/types/waitlist';

export interface WaitingPartySample {
  partySize: number;
  seatingPreference: SeatingPreference;
  joinedAt: string;
}

export interface SeatedPartySample {
  joinedAt: string;
  resolvedAt: string | null;
  partySize: number;
}

export interface EstimateWaitInput {
  partySize: number;
  seatingPreference: SeatingPreference;
  waitingAhead: WaitingPartySample[];
  seatedToday: SeatedPartySample[];
}

const BASELINE_TURN_MINUTES = 12;

/**
 * Larger tables turn slower in real restaurant dining rooms.
 */
export function getPartySizeMultiplier(partySize: number): number {
  const size = Math.max(1, Math.round(partySize));
  if (size <= 2) return 1.0;
  if (size <= 4) return 1.25;
  if (size <= 6) return 1.55;
  return 1.85; // 7, 8+
}

/**
 * Computes today's observed turn velocity using median wait-to-seat time
 * blended with baseline defaults when fewer than 3 parties are seated.
 */
export function computeObservedTurnMinutes(seatedToday: SeatedPartySample[]): number {
  const durations: number[] = [];

  for (const s of seatedToday) {
    if (!s.resolvedAt || !s.joinedAt) continue;
    const joinedMs = new Date(s.joinedAt).getTime();
    const resolvedMs = new Date(s.resolvedAt).getTime();
    if (!Number.isFinite(joinedMs) || !Number.isFinite(resolvedMs) || resolvedMs <= joinedMs) {
      continue;
    }
    const mins = (resolvedMs - joinedMs) / 60000;
    if (mins >= 2 && mins <= 90) {
      durations.push(mins);
    }
  }

  if (durations.length < 3) {
    return BASELINE_TURN_MINUTES;
  }

  durations.sort((a, b) => a - b);
  const mid = Math.floor(durations.length / 2);
  const median =
    durations.length % 2 === 0
      ? (durations[mid - 1] + durations[mid]) / 2
      : durations[mid];

  const clamped = Math.max(5, Math.min(40, median));
  return 0.65 * clamped + 0.35 * BASELINE_TURN_MINUTES;
}

/**
 * Pure, deterministic Smart Wait-Time Estimator.
 * Factors: party size multiplier, live queue ahead (with zone weighting),
 * and today's observed turn velocity.
 */
export function estimateWaitMinutes(input: EstimateWaitInput): number {
  const sizeMult = getPartySizeMultiplier(input.partySize);
  const baseTurn = computeObservedTurnMinutes(input.seatedToday);

  if (input.waitingAhead.length === 0) {
    return Math.max(4, Math.round(5 * sizeMult));
  }

  let effectiveAheadLoad = 0;
  for (const ahead of input.waitingAhead) {
    const aheadMult = getPartySizeMultiplier(ahead.partySize);
    if (input.seatingPreference === 'either') {
      effectiveAheadLoad += 0.65 * aheadMult;
    } else if (
      ahead.seatingPreference === input.seatingPreference ||
      ahead.seatingPreference === 'either'
    ) {
      effectiveAheadLoad += 0.85 * aheadMult;
    } else {
      // Opposite zone has minimal indirect impact on this zone's tables
      effectiveAheadLoad += 0.2 * aheadMult;
    }
  }

  const zoneFactor = input.seatingPreference === 'either' ? 1.0 : 1.15;
  const rawMinutes = baseTurn * (0.35 + effectiveAheadLoad * 0.55) * sizeMult * zoneFactor;

  return Math.max(5, Math.min(150, Math.round(rawMinutes)));
}

export function formatOrdinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
