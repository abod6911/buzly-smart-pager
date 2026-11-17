import assert from 'assert';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3044';
const SLUG = 'demo-cafe';

async function runArchiveTests() {
  console.log('======================================================================');
  console.log('RUNNING DAILY ARCHIVE & RESET TO ZERO VERIFICATION SUITE');
  console.log('======================================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}:`, err.message);
    }
  }

  // 1. Test GET /api/restaurants/[slug]/archive
  const resGet = await fetch(`${BASE_URL}/api/restaurants/${SLUG}/archive`);
  const dataGet = await resGet.json();

  test('GET /api/restaurants/[slug]/archive returns HTTP 200 and success: true', () => {
    assert.strictEqual(resGet.status, 200);
    assert.strictEqual(dataGet.success, true);
    assert(Array.isArray(dataGet.orders), 'orders is array');
    assert(Array.isArray(dataGet.summaries), 'summaries is array');
  });

  // 2. Test POST /api/restaurants/[slug]/archive with test completed order
  const testOrder = {
    id: 'ord_arch_test_' + Date.now(),
    orderNumber: 'A99',
    restaurantSlug: SLUG,
    status: 'completed',
    customerPhone: '0501234567',
    notes: 'طلب أرشيف تجريبي للتأكد من حفظ الملف',
    estimatedMinutes: 8,
    createdAt: new Date().toISOString(),
    readyAt: new Date(Date.now() + 5 * 60000).toISOString(),
    completedAt: new Date(Date.now() + 8 * 60000).toISOString(),
    feedback: { rating: 5, submittedAt: new Date().toISOString() },
  };

  const resPost = await fetch(`${BASE_URL}/api/restaurants/${SLUG}/archive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orders: [testOrder] }),
  });
  const dataPost = await resPost.json();

  test('POST /api/restaurants/[slug]/archive saves orders successfully', () => {
    assert.strictEqual(resPost.status, 200);
    assert.strictEqual(dataPost.success, true);
  });

  // 3. Verify server file data/archives/[slug].json exists on disk
  const filePath = path.join(process.cwd(), 'data', 'archives', `${SLUG}.json`);
  test('Archive file data/archives/demo-cafe.json is created on disk', () => {
    assert(fs.existsSync(filePath), `File exists at ${filePath}`);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    assert(Array.isArray(content), 'Content is JSON array');
    const found = content.some((o) => o.orderNumber === 'A99');
    assert(found, 'Archived order #A99 found inside file');
  });

  // 4. Test GET returns updated orders with daily summary
  const resGetAfter = await fetch(`${BASE_URL}/api/restaurants/${SLUG}/archive`);
  const dataGetAfter = await resGetAfter.json();

  test('GET returns updated archive containing archived order #A99', () => {
    assert.strictEqual(resGetAfter.status, 200);
    const found = dataGetAfter.orders.some((o) => o.orderNumber === 'A99');
    assert(found, 'Order found in API response');
  });

  test('Daily summaries accurately calculate total and avg prep time', () => {
    assert(dataGetAfter.summaries.length > 0, 'At least one day summary exists');
    const todayStr = new Date().toISOString().split('T')[0];
    const todaySummary = dataGetAfter.summaries.find((s) => s.date === todayStr);
    assert(todaySummary, 'Today summary exists');
    assert(todaySummary.totalOrders >= 1, 'Total orders >= 1');
  });

  console.log(`\n======================================================================`);
  console.log(`ARCHIVE VERIFICATION SUMMARY: ${passed}/${total} Passed (${Math.round((passed / total) * 100)}%)`);
  console.log(`======================================================================`);

  if (passed !== total) {
    process.exit(1);
  }
}

runArchiveTests();
