import assert from 'node:assert/strict';
import {
  estimateWaitMinutes,
  computeObservedTurnMinutes,
  getPartySizeMultiplier,
  formatOrdinal,
} from '../lib/wait-estimator.ts';

console.log('--- Running Wait-Time Estimator Unit Tests ---');

// 1. Party size scaling
assert.ok(
  getPartySizeMultiplier(8) > getPartySizeMultiplier(2),
  'Party of 8+ multiplier must exceed party of 2'
);

const emptyQueue2 = estimateWaitMinutes({
  partySize: 2,
  seatingPreference: 'either',
  waitingAhead: [],
  seatedToday: [],
});
const emptyQueue8 = estimateWaitMinutes({
  partySize: 8,
  seatingPreference: 'either',
  waitingAhead: [],
  seatedToday: [],
});
assert.ok(
  emptyQueue8 > emptyQueue2,
  `8+ wait (${emptyQueue8}m) must exceed party of 2 (${emptyQueue2}m) on empty queue`
);

// 2. Live queue depth scaling
const aheadSample = [
  { partySize: 2, seatingPreference: 'inside', joinedAt: new Date(Date.now() - 15 * 60000).toISOString() },
  { partySize: 4, seatingPreference: 'either', joinedAt: new Date(Date.now() - 10 * 60000).toISOString() },
  { partySize: 6, seatingPreference: 'inside', joinedAt: new Date(Date.now() - 5 * 60000).toISOString() },
];

const busyQueue2 = estimateWaitMinutes({
  partySize: 2,
  seatingPreference: 'either',
  waitingAhead: aheadSample,
  seatedToday: [],
});
const busyQueue8 = estimateWaitMinutes({
  partySize: 8,
  seatingPreference: 'either',
  waitingAhead: aheadSample,
  seatedToday: [],
});
assert.ok(busyQueue2 > emptyQueue2, 'Queue ahead must increase wait estimate');
assert.ok(busyQueue8 > busyQueue2, '8+ wait must exceed 2-top wait in busy queue');

// 3. Seating preference flexibility ('either' <= 'inside')
const insideWait = estimateWaitMinutes({
  partySize: 2,
  seatingPreference: 'inside',
  waitingAhead: aheadSample,
  seatedToday: [],
});
assert.ok(
  busyQueue2 <= insideWait,
  `'either' (${busyQueue2}m) must be <= 'inside' (${insideWait}m)`
);

// 4. Observed turn velocity from seatedToday
const now = Date.now();
const fastSeated = [
  { joinedAt: new Date(now - 30 * 60000).toISOString(), resolvedAt: new Date(now - 24 * 60000).toISOString(), partySize: 2 },
  { joinedAt: new Date(now - 25 * 60000).toISOString(), resolvedAt: new Date(now - 19 * 60000).toISOString(), partySize: 2 },
  { joinedAt: new Date(now - 20 * 60000).toISOString(), resolvedAt: new Date(now - 14 * 60000).toISOString(), partySize: 3 },
];
const slowSeated = [
  { joinedAt: new Date(now - 60 * 60000).toISOString(), resolvedAt: new Date(now - 30 * 60000).toISOString(), partySize: 4 },
  { joinedAt: new Date(now - 55 * 60000).toISOString(), resolvedAt: new Date(now - 23 * 60000).toISOString(), partySize: 4 },
  { joinedAt: new Date(now - 50 * 60000).toISOString(), resolvedAt: new Date(now - 20 * 60000).toISOString(), partySize: 6 },
];

const fastTurn = computeObservedTurnMinutes(fastSeated);
const slowTurn = computeObservedTurnMinutes(slowSeated);
assert.ok(slowTurn > fastTurn, `Slow turn (${slowTurn}) must exceed fast turn (${fastTurn})`);

const fastEst = estimateWaitMinutes({
  partySize: 4,
  seatingPreference: 'either',
  waitingAhead: aheadSample,
  seatedToday: fastSeated,
});
const slowEst = estimateWaitMinutes({
  partySize: 4,
  seatingPreference: 'either',
  waitingAhead: aheadSample,
  seatedToday: slowSeated,
});
assert.ok(slowEst > fastEst, `Slow velocity estimate (${slowEst}m) must exceed fast (${fastEst}m)`);

// 5. Ordinal formatting
assert.equal(formatOrdinal(1), '1st');
assert.equal(formatOrdinal(2), '2nd');
assert.equal(formatOrdinal(3), '3rd');
assert.equal(formatOrdinal(4), '4th');
assert.equal(formatOrdinal(11), '11th');
assert.equal(formatOrdinal(21), '21st');

console.log('ALL WAIT-TIME ESTIMATOR UNIT TESTS PASSED!');
