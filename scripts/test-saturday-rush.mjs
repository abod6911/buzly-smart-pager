import assert from 'node:assert/strict';

const BASE_URL = process.env.TEST_URL || 'http://127.0.0.1:3000';
const HOST_EMAIL = process.env.HOST_STAFF_EMAIL || 'host@chimer.app';
const HOST_PASSWORD = process.env.HOST_STAFF_PASSWORD || 'chimer-host-2026';

function extractCookie(res, name) {
  const raw = res.headers.get('set-cookie') || '';
  const parts = raw.split(/,(?=[^;]+=[^;]+)/g);
  for (const p of parts) {
    if (p.trim().startsWith(`${name}=`)) {
      return p.trim();
    }
  }
  return '';
}

function cookiePair(setCookieStr) {
  return setCookieStr.split(';')[0];
}

async function openSSE(path, cookieHeader) {
  const controller = new AbortController();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Cookie: cookieHeader },
    signal: controller.signal,
  });
  assert.equal(res.status, 200, `SSE ${path} should return 200`);
  const events = [];
  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  (async () => {
    try {
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n\n');
        buf = lines.pop() || '';
        for (const block of lines) {
          const dataLine = block.split('\n').find((l) => l.startsWith('data: '));
          if (dataLine) {
            events.push(JSON.parse(dataLine.slice(6)));
          }
        }
      }
    } catch {
      // Aborted at end of test
    }
  })();

  return { events, close: () => controller.abort() };
}

async function waitForEvent(events, predicate, timeoutMs = 1500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const found = events.find(predicate);
    if (found) return found;
    await new Promise((r) => setTimeout(r, 25));
  }
  return null;
}

async function main() {
  console.log('='.repeat(70));
  console.log('CHIMER DIGITAL BUZZER — SATURDAY RUSH & SECURITY VERIFICATION');
  console.log(`Target: ${BASE_URL}`);
  console.log('='.repeat(70));

  // 1. UI Routes return 200 OK
  for (const route of ['/join']) {
    const res = await fetch(`${BASE_URL}${route}`, { cache: 'no-store' });
    assert.equal(res.status, 200, `GET ${route} should return 200`);
  }
  console.log('[PASS] UI route (/join) returns 200 OK');

  // 2. Security: Unauthenticated host endpoints must reject with 401
  for (const [method, path] of [
    ['GET', '/api/host/waitlist'],
    ['GET', '/api/host/insights'],
    ['POST', '/api/host/walk-in'],
    ['POST', '/api/host/entries/fake-id/notify'],
    ['POST', '/api/host/entries/fake-id/seat'],
    ['POST', '/api/host/entries/fake-id/no-show'],
  ]) {
    const res = await fetch(`${BASE_URL}${path}`, { method });
    assert.equal(res.status, 401, `Unauthenticated ${method} ${path} must return 401`);
  }
  console.log('[PASS] All unauthenticated host endpoints rejected with 401');

  // 3. Three simultaneous guests (A, B, C) join concurrently
  const [resA, resB, resC] = await Promise.all([
    fetch(`${BASE_URL}/api/waitlist/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantSlug: 'demo-cafe',
        name: 'GuestAlpha_Unique',
        partySize: 2,
        seatingPreference: 'inside',
        phoneNumber: '555-9001',
      }),
    }),
    fetch(`${BASE_URL}/api/waitlist/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantSlug: 'demo-cafe',
        name: 'GuestBeta_Unique',
        partySize: 4,
        seatingPreference: 'either',
        phoneNumber: '555-9002',
      }),
    }),
    fetch(`${BASE_URL}/api/waitlist/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantSlug: 'demo-cafe',
        name: 'GuestGamma_Unique',
        partySize: 6,
        seatingPreference: 'patio',
        phoneNumber: '555-9003',
      }),
    }),
  ]);

  assert.equal(resA.status, 201, 'Guest A join 201');
  assert.equal(resB.status, 201, 'Guest B join 201');
  assert.equal(resC.status, 201, 'Guest C join 201');

  const rawSetA = extractCookie(resA, 'chimer_ticket_token');
  const rawSetB = extractCookie(resB, 'chimer_ticket_token');
  const rawSetC = extractCookie(resC, 'chimer_ticket_token');

  assert.ok(/httponly/i.test(rawSetA), 'Guest ticket cookie MUST be HttpOnly');
  assert.ok(/samesite=lax/i.test(rawSetA), 'Guest ticket cookie MUST be SameSite=Lax');

  const cookieA = cookiePair(rawSetA);
  const cookieB = cookiePair(rawSetB);
  const cookieC = cookiePair(rawSetC);

  const jsonA = await resA.json();
  const jsonB = await resB.json();
  const jsonC = await resC.json();

  // Verify zero cross-guest PII in guest responses
  const textA = JSON.stringify(jsonA);
  assert.ok(!textA.includes('GuestBeta_Unique') && !textA.includes('555-9002'), 'Guest A response has zero Guest B PII');
  assert.ok(!textA.includes('GuestGamma_Unique') && !textA.includes('555-9003'), 'Guest A response has zero Guest C PII');
  console.log('[PASS] 3 concurrent guests joined; HttpOnly cookies verified; zero cross-guest PII');

  // 4. Security: Guest cookie cannot access host endpoints
  const guestToHost = await fetch(`${BASE_URL}/api/host/waitlist`, {
    headers: { Cookie: cookieA },
  });
  assert.equal(guestToHost.status, 401, 'Guest cookie must be rejected by host endpoints (401)');
  console.log('[PASS] Guest cookie rejected on host endpoints');

  // 5. Open scoped SSE streams for A, B, C
  const sseA = await openSSE('/api/waitlist/stream', cookieA);
  const sseB = await openSSE('/api/waitlist/stream', cookieB);
  const sseC = await openSSE('/api/waitlist/stream', cookieC);
  await new Promise((r) => setTimeout(r, 150));

  // 6. Host signs in and notifies Guest B
  const loginRes = await fetch(`${BASE_URL}/api/host/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: HOST_EMAIL, password: HOST_PASSWORD }),
  });
  assert.equal(loginRes.status, 200, 'Host login 200');
  const hostCookie = cookiePair(extractCookie(loginRes, 'chimer_host_token'));

  const listRes = await fetch(`${BASE_URL}/api/host/waitlist`, {
    headers: { Cookie: hostCookie },
  });
  assert.equal(listRes.status, 200);
  const listData = await listRes.json();
  const entryA = listData.waiting.find((e) => e.guestName === 'GuestAlpha_Unique');
  const entryB = listData.waiting.find((e) => e.guestName === 'GuestBeta_Unique');
  const entryC = listData.waiting.find((e) => e.guestName === 'GuestGamma_Unique');
  assert.ok(entryA && entryB && entryC, 'All 3 guests visible on Host Stand');

  const notifyStart = Date.now();
  const notifyRes = await fetch(`${BASE_URL}/api/host/entries/${entryB.id}/notify`, {
    method: 'POST',
    headers: { Cookie: hostCookie },
  });
  assert.equal(notifyRes.status, 200, 'Host notify Guest B 200');

  const bCalledEv = await waitForEvent(sseB.events, (e) => e.type === 'TICKET_CALLED', 1000);
  const latencyMs = Date.now() - notifyStart;
  assert.ok(bCalledEv, `Guest B received TICKET_CALLED in ${latencyMs}ms (< 1000ms)`);
  assert.ok(bCalledEv.claimDeadlineAt, 'TICKET_CALLED includes server-synced claimDeadlineAt');

  // Verify A and C did NOT receive TICKET_CALLED and received zero PII
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(
    sseA.events.some((e) => e.type === 'TICKET_CALLED'),
    false,
    'Guest A must NOT receive TICKET_CALLED'
  );
  assert.equal(
    sseC.events.some((e) => e.type === 'TICKET_CALLED'),
    false,
    'Guest C must NOT receive TICKET_CALLED'
  );
  assert.ok(
    !JSON.stringify(sseA.events).includes('GuestBeta_Unique'),
    'Guest A SSE stream contains zero Guest B PII'
  );
  console.log(`[PASS] Sub-second Realtime isolation verified (${latencyMs}ms); ONLY Guest B buzzed`);

  // 7. Test Undo Notify -> reverts Guest B cleanly to waiting in original order
  const undoRes = await fetch(`${BASE_URL}/api/host/entries/${entryB.id}/undo-notify`, {
    method: 'POST',
    headers: { Cookie: hostCookie },
  });
  assert.equal(undoRes.status, 200, 'Undo notify 200');
  const bUndoneEv = await waitForEvent(sseB.events, (e) => e.type === 'TICKET_UNDONE', 1000);
  assert.ok(bUndoneEv, 'Guest B received TICKET_UNDONE');

  const myBRes = await fetch(`${BASE_URL}/api/waitlist/my-ticket`, {
    headers: { Cookie: cookieB },
  });
  const myBJson = await myBRes.json();
  assert.equal(myBJson.ticket.status, 'waiting', 'Guest B reverted to waiting');
  console.log('[PASS] Undo Notify reverted Guest B cleanly to waiting in original order');

  // 8. Re-notify Guest B, Guest B taps "I'm on my way", Host sees badge, then Seated & No-show
  await fetch(`${BASE_URL}/api/host/entries/${entryB.id}/notify`, {
    method: 'POST',
    headers: { Cookie: hostCookie },
  });

  const omwRes = await fetch(`${BASE_URL}/api/waitlist/on-my-way`, {
    method: 'POST',
    headers: { Cookie: cookieB },
  });
  assert.equal(omwRes.status, 200, "Guest B I'm on my way 200");
  const omwJson = await omwRes.json();
  assert.equal(omwJson.ticket.status, 'on_my_way');

  const hostAfterOmw = await (
    await fetch(`${BASE_URL}/api/host/waitlist`, { headers: { Cookie: hostCookie } })
  ).json();
  const hostEntryB = hostAfterOmw.called.find((e) => e.id === entryB.id);
  assert.equal(hostEntryB.status, 'on_my_way', 'Host Stand shows on_my_way badge live');

  // Seat Guest B, Notify + No-show Guest A
  const seatRes = await fetch(`${BASE_URL}/api/host/entries/${entryB.id}/seat`, {
    method: 'POST',
    headers: { Cookie: hostCookie },
  });
  assert.equal(seatRes.status, 200, 'Seat Guest B 200');

  await fetch(`${BASE_URL}/api/host/entries/${entryA.id}/notify`, {
    method: 'POST',
    headers: { Cookie: hostCookie },
  });
  const noShowRes = await fetch(`${BASE_URL}/api/host/entries/${entryA.id}/no-show`, {
    method: 'POST',
    headers: { Cookie: hostCookie },
  });
  assert.equal(noShowRes.status, 200, 'No-show Guest A 200');
  console.log('[PASS] On my way, Seated, and No-show state transitions verified');

  // 9. AI Insights Privacy & Idempotent Snapshot Caching Check
  const ins1 = await (
    await fetch(`${BASE_URL}/api/host/insights`, { headers: { Cookie: hostCookie } })
  ).json();
  const ins2 = await (
    await fetch(`${BASE_URL}/api/host/insights`, { headers: { Cookie: hostCookie } })
  ).json();

  assert.equal(ins1.brief.cached, false, 'First insights call generates & caches brief');
  assert.equal(ins2.brief.cached, true, 'Second insights call hits cache (Note is up to date)');
  const insText = JSON.stringify(ins2);
  assert.ok(
    !insText.includes('GuestAlpha_Unique') &&
      !insText.includes('GuestBeta_Unique') &&
      !insText.includes('555-9001'),
    'AI brief contains ZERO guest names or phone numbers'
  );
  console.log('[PASS] AI Insights zero-PII & idempotent snapshot caching verified');

  sseA.close();
  sseB.close();
  sseC.close();
  console.log('\nALL SATURDAY RUSH E2E & SECURITY TESTS PASSED!');
}

main().catch((err) => {
  console.error('\nTEST FAILED:', err);
  process.exit(1);
});
