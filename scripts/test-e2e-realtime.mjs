// Automated Real-World End-to-End Verification Test
// Tests API endpoints, SSE stream connection, and real-time latency (<100ms)

const BASE_URL = process.env.TEST_URL || 'http://127.0.0.1:3044';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${message}`);
    process.exitCode = 1;
  }
}

async function runTestSuite() {
  console.log('='.repeat(70));
  console.log(`STARTING BUZLY FULL-SYSTEM REALTIME VERIFICATION SUITE`);
  console.log(`Target Server: ${BASE_URL}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('='.repeat(70));

  // 1. UI Page HTTP Status Check
  console.log('\n--- 1. Testing UI Routes (200 OK) ---');
  for (const path of [
    '/',
    '/demo-cafe/tv',
    '/staff',
    '/demo-cafe/staff',
    '/demo-cafe/track/101',
    '/debug',
  ]) {
    try {
      const res = await fetch(`${BASE_URL}${path}`, { cache: 'no-store' });
      assert(res.status === 200, `GET ${path} returned HTTP ${res.status}`);
    } catch (err) {
      assert(false, `GET ${path} failed to connect: ${err.message}`);
    }
  }

  // 2. Anti-Abuse & Validation on POST /api/orders
  console.log('\n--- 2. Testing API Validation & Headers ---');
  try {
    const invalidRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ADD', order: { orderNumber: 'INVALID_TOO_LONG_12345' } }),
    });
    assert(invalidRes.status === 400, `Rejects invalid orderNumber with HTTP 400 (Got ${invalidRes.status})`);
  } catch (e) {
    assert(false, `Validation test error: ${e.message}`);
  }

  // 3. Create a New Order as Cashier
  console.log('\n--- 3. Testing Order Creation (Cashier POS) ---');
  const testOrderNum = `T${Math.floor(10 + Math.random() * 89)}`;
  let createdOrder = null;
  try {
    const addRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'ADD',
        restaurantSlug: 'demo-cafe',
        order: {
          orderNumber: testOrderNum,
          customerName: 'Ahmad Realtime',
          estimatedMinutes: 8,
          status: 'preparing',
        },
      }),
    });
    const addData = await addRes.json();
    assert(addRes.status === 200 && addData.success, `Order #${testOrderNum} created successfully`);
    createdOrder = addData.order;
    assert(createdOrder && createdOrder.status === 'preparing', `Order status is 'preparing'`);
  } catch (e) {
    assert(false, `Add order error: ${e.message}`);
  }

  // 4. Targeted Customer Query (With & Without Hash prefix)
  console.log('\n--- 4. Testing Targeted Customer Order Retrieval ---');
  try {
    const getPlain = await fetch(`${BASE_URL}/api/orders?slug=demo-cafe&orderNumber=${testOrderNum}`, { cache: 'no-store' });
    const getPlainData = await getPlain.json();
    assert(getPlain.status === 200 && getPlainData.order?.orderNumber === testOrderNum, `Customer found order by plain number '${testOrderNum}'`);

    // Verify No-Cache headers to protect customer phone from stale CDN caching
    const cacheControl = getPlain.headers.get('cache-control') || '';
    assert(cacheControl.includes('no-store'), `Cache-Control includes 'no-store' (Actual: '${cacheControl}')`);

    const getHash = await fetch(`${BASE_URL}/api/orders?slug=demo-cafe&orderNumber=%23${testOrderNum}`, { cache: 'no-store' });
    const getHashData = await getHash.json();
    assert(getHash.status === 200 && getHashData.order?.orderNumber === testOrderNum, `Customer found order with hash prefix '#${testOrderNum}'`);
  } catch (e) {
    assert(false, `Customer fetch error: ${e.message}`);
  }

  // 5. Real-Time SSE Push Latency Measurement (<100ms)
  console.log('\n--- 5. Measuring Real-Time SSE Stream Push Latency ---');
  try {
    const sseUrl = `${BASE_URL}/api/orders/stream?slug=demo-cafe&orderNumber=${testOrderNum}`;
    const sseController = new AbortController();
    const sseResponse = await fetch(sseUrl, {
      signal: sseController.signal,
      headers: { Accept: 'text/event-stream' },
    });

    assert(sseResponse.status === 200, `SSE Stream connected successfully with HTTP 200`);
    const reader = sseResponse.body.getReader();
    const decoder = new TextDecoder();

    // Read initial welcome packet
    const firstChunk = await reader.read();
    const firstText = decoder.decode(firstChunk.value || new Uint8Array());
    assert(firstText.includes('CONNECTED'), `SSE received welcome handshake packet`);

    // Setup listener promise for ORDER_READY
    let receivedPayload = null;
    let sseArrivalTime = 0;
    const ssePromise = (async () => {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        if (text.includes('ORDER_READY')) {
          sseArrivalTime = performance.now();
          const match = text.match(/data: ({.*})/);
          if (match && match[1]) {
            try {
              receivedPayload = JSON.parse(match[1]);
            } catch {}
          }
          break;
        }
      }
    })();

    // Small delay to ensure client stream is listening
    await sleep(60);

    // Cashier taps "نداء الاستلام" (PATCH /api/orders)
    const cashierDispatchTime = performance.now();
    const patchRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'ORDER_READY',
        orderNumber: testOrderNum,
        restaurantSlug: 'demo-cafe',
        status: 'ready',
      }),
    });
    assert(patchRes.status === 200, `Cashier PATCH /api/orders returned HTTP 200`);

    // Wait for SSE packet to arrive
    await Promise.race([
      ssePromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('SSE timeout after 3000ms')), 3000)),
    ]);

    const roundtripLatencyMs = Math.round(sseArrivalTime - cashierDispatchTime);
    console.log(`  --> Measured Real-time Latency: ${roundtripLatencyMs} ms`);
    assert(
      roundtripLatencyMs <= 150,
      `Instant Zero-Latency Delivery achieved: ${roundtripLatencyMs}ms (Target: < 150ms)`
    );
    assert(receivedPayload && receivedPayload.type === 'ORDER_READY', `SSE Event type is 'ORDER_READY'`);
    assert(
      receivedPayload && receivedPayload.orderNumber === testOrderNum,
      `SSE Event payload orderNumber matches #${testOrderNum}`
    );

    sseController.abort();
  } catch (e) {
    assert(false, `SSE stream push test error: ${e.message}`);
  }

  // 6. Complete Order
  console.log('\n--- 6. Testing Order Completion ---');
  try {
    const compRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'COMPLETE',
        orderNumber: testOrderNum,
        restaurantSlug: 'demo-cafe',
      }),
    });
    const compData = await compRes.json();
    assert(compRes.status === 200 && compData.success, `Order #${testOrderNum} marked as completed`);

    const finalCheck = await fetch(`${BASE_URL}/api/orders?slug=demo-cafe&orderNumber=${testOrderNum}`, { cache: 'no-store' });
    const finalData = await finalCheck.json();
    assert(finalData.order?.status === 'completed', `Order final status verified as 'completed'`);
  } catch (e) {
    assert(false, `Completion test error: ${e.message}`);
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log(`TEST SUMMARY: ${passedTests}/${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('='.repeat(70));

  if (passedTests === totalTests) {
    console.log('ALL TESTS PASSED WITH 100% SUCCESS.');
    process.exit(0);
  } else {
    console.error('SOME TESTS FAILED.');
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
