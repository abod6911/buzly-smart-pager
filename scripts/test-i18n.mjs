import assert from 'node:assert';
import { translations } from '../lib/translations.ts';

console.log('======================================================================');
console.log('RUNNING BILINGUAL (ARABIC / ENGLISH) VERIFICATION SUITE');
console.log('======================================================================');

const arKeys = Object.keys(translations.ar);
const enKeys = Object.keys(translations.en);

console.log(`[CHECK] Arabic dictionary total keys: ${arKeys.length}`);
console.log(`[CHECK] English dictionary total keys: ${enKeys.length}`);

// 1. Verify 100% key parity
const missingInEn = arKeys.filter((key) => !(key in translations.en));
const missingInAr = enKeys.filter((key) => !(key in translations.ar));

if (missingInEn.length > 0) {
  console.error('  [FAIL] Keys missing in English:', missingInEn);
  process.exit(1);
} else {
  console.log('  [PASS] 100% Key Parity: All Arabic keys have exact English counterparts');
}

if (missingInAr.length > 0) {
  console.error('  [FAIL] Keys missing in Arabic:', missingInAr);
  process.exit(1);
} else {
  console.log('  [PASS] 100% Key Parity: All English keys have exact Arabic counterparts');
}

// 2. Verify key customer tracker terms
const essentialTerms = [
  'preparing',
  'ready',
  'completed',
  'orderReadyHeadline',
  'orderPreparingHeadline',
  'orderCompletedHeadline',
  'liveConnected',
  'cashierPos',
  'nowPreparing',
  'readyForPickup',
  'pinPromptTitle',
];

for (const term of essentialTerms) {
  assert(translations.ar[term], `Arabic missing essential term: ${term}`);
  assert(translations.en[term], `English missing essential term: ${term}`);
  assert.notStrictEqual(translations.ar[term], translations.en[term], `Translation identical for ${term}`);
}
console.log(`  [PASS] Essential terminology verified in both languages (${essentialTerms.length} verified)`);

// 3. Verify Server HTML Rendering for Customer Tracker & TV
const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3044';

try {
  const resTracker = await fetch(`${BASE_URL}/demo-cafe/track`);
  assert.strictEqual(resTracker.status, 200, 'Customer track route must return HTTP 200');
  const trackerHtml = await resTracker.text();
  assert(trackerHtml.includes('CHIMER') || trackerHtml.includes('demo-cafe'), 'Customer tracker rendered');
  console.log('  [PASS] Customer Tracker route returns 200 and loads successfully');

  const resTv = await fetch(`${BASE_URL}/demo-cafe/tv`);
  assert.strictEqual(resTv.status, 200, 'TV route must return HTTP 200');
  const tvHtml = await resTv.text();
  assert(tvHtml.includes('demo-cafe') || tvHtml.includes('TV'), 'TV screen rendered');
  console.log('  [PASS] Kitchen TV screen route returns 200 and loads successfully');
} catch (err) {
  console.error('  [FAIL] HTTP check failed:', err.message);
  process.exit(1);
}

console.log('======================================================================');
console.log('BILINGUAL I18N VERIFICATION SUMMARY: ALL CHECKS PASSED (100%)');
console.log('======================================================================');
