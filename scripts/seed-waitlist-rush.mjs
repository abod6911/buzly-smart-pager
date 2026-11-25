const BASE_URL = process.env.TEST_URL || 'http://127.0.0.1:3045';
const HOST_EMAIL = process.env.HOST_STAFF_EMAIL || 'host@chimer.app';
const HOST_PASSWORD = process.env.HOST_STAFF_PASSWORD || 'chimer-host-2026';

async function main() {
  const loginRes = await fetch(`${BASE_URL}/api/host/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: HOST_EMAIL, password: HOST_PASSWORD }),
  });

  if (!loginRes.ok) {
    throw new Error(`Host login failed: ${loginRes.status}`);
  }

  const cookie = loginRes.headers.get('set-cookie')?.split(';')[0] || '';
  const seedRes = await fetch(`${BASE_URL}/api/host/seed`, {
    method: 'POST',
    headers: { Cookie: cookie },
  });

  const data = await seedRes.json();
  console.log('Saturday Brunch Rush Seed Result:', data);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
