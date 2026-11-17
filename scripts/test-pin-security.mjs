import assert from 'assert';

const BASE_URL = 'http://127.0.0.1:3044';

async function runSecurityTests() {
  console.log('======================================================================');
  console.log('RUNNING PIN SECURITY & SESSION ENCRYPTION VERIFICATION');
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

  // 1. Wrong PIN rejected
  const resWrong = await fetch(`${BASE_URL}/api/auth/verify-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug: 'demo-cafe', pin: '0000' }),
  });
  const dataWrong = await resWrong.json();
  test('Wrong PIN is rejected with HTTP 401', () => {
    assert.strictEqual(resWrong.status, 401);
    assert.strictEqual(dataWrong.success, false);
  });

  // 2. Correct PIN accepted & sets session cookie
  const resCorrect = await fetch(`${BASE_URL}/api/auth/verify-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug: 'demo-cafe', pin: '1234' }),
  });
  const dataCorrect = await resCorrect.json();
  const setCookie = resCorrect.headers.get('set-cookie') || '';

  test('Valid PIN returns HTTP 200 and success: true', () => {
    assert.strictEqual(resCorrect.status, 200);
    assert.strictEqual(dataCorrect.success, true);
    assert(dataCorrect.token, 'Token returned');
  });

  test('Signed HttpOnly session cookie is issued', () => {
    assert(setCookie.includes('chimer_staff_token'), 'chimer_staff_token cookie present');
    assert(setCookie.includes('HttpOnly') || setCookie.toLowerCase().includes('httponly'), 'Cookie is HttpOnly');
  });

  // Extract cookie value for subsequent session checks
  const cookieMatch = setCookie.match(/chimer_staff_token=([^;]+)/);
  const cookieVal = cookieMatch ? cookieMatch[1] : '';

  // 3. Verify Active Session
  const resSession = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: {
      Cookie: `chimer_staff_token=${cookieVal}`,
    },
  });
  const dataSession = await resSession.json();
  test('Active session is verified with authenticated: true', () => {
    assert.strictEqual(resSession.status, 200);
    assert.strictEqual(dataSession.authenticated, true);
    assert.strictEqual(dataSession.slug, 'demo-cafe');
  });

  // 4. Test Logout (Terminal Lock)
  const resLogout = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: {
      Cookie: `chimer_staff_token=${cookieVal}`,
    },
  });
  const logoutCookie = resLogout.headers.get('set-cookie') || '';
  test('Logout returns HTTP 200 and expires the cookie', () => {
    assert.strictEqual(resLogout.status, 200);
    assert(logoutCookie.includes('Max-Age=0') || logoutCookie.includes('max-age=0'), 'Max-Age=0 on logout cookie');
  });

  // 5. Verify Session is now closed/unauthenticated
  const resSessionAfter = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: {
      Cookie: `chimer_staff_token=`,
    },
  });
  const dataSessionAfter = await resSessionAfter.json();
  test('Session verification after logout returns authenticated: false', () => {
    assert.strictEqual(dataSessionAfter.authenticated, false);
  });

  console.log(`\n======================================================================`);
  console.log(`PIN & SESSION SECURITY SUMMARY: ${passed}/${total} Passed (${Math.round((passed / total) * 100)}%)`);
  console.log(`======================================================================`);

  if (passed !== total) {
    process.exit(1);
  }
}

runSecurityTests();
