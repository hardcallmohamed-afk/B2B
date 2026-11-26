import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getCasablancaDateKey,
  getCasablancaHourKey,
  checkAndIncrementAiUsage,
  checkAndIncrementCrawlUsage,
  resetAiUsageTracker,
  resetCrawlUsageTracker,
  validatePublicHttpUrl,
  extractVisibleTextFromHtml,
} from './aiRateLimiter';

test('getCasablancaDateKey returns valid YYYY-MM-DD for Africa/Casablanca', () => {
  const d = new Date('2026-11-26T00:30:00Z');
  const key = getCasablancaDateKey(d);
  assert.match(key, /^\d{4}-\d{2}-\d{2}$/);
});

test('checkAndIncrementAiUsage allows up to 40 calls per calendar day and blocks at 41', () => {
  resetAiUsageTracker();
  const testUid = 'user_test_casablanca_123';
  const now = new Date('2026-11-26T10:00:00Z');

  for (let i = 1; i <= 40; i++) {
    const result = checkAndIncrementAiUsage(testUid, 40, now);
    assert.equal(result.allowed, true, `Call ${i} should be allowed`);
    assert.equal(result.count, i);
    assert.equal(result.remaining, 40 - i);
  }

  // 41st call should be rejected
  const rejected = checkAndIncrementAiUsage(testUid, 40, now);
  assert.equal(rejected.allowed, false, 'Call 41 must be rejected');
  assert.equal(rejected.count, 40);
  assert.equal(rejected.remaining, 0);

  // Different user on same day should be allowed
  const otherUser = checkAndIncrementAiUsage('user_test_456', 40, now);
  assert.equal(otherUser.allowed, true);
  assert.equal(otherUser.count, 1);

  // Next calendar day should reset quota automatically
  const nextDay = new Date('2026-11-27T08:00:00Z');
  const nextDayResult = checkAndIncrementAiUsage(testUid, 40, nextDay);
  assert.equal(nextDayResult.allowed, true);
  assert.equal(nextDayResult.count, 1);
});

test('checkAndIncrementCrawlUsage allows up to 30 pages per hour and blocks at 31', () => {
  resetCrawlUsageTracker();
  const testUid = 'crawler_user_789';
  const now = new Date('2026-11-26T14:15:00Z');

  for (let i = 1; i <= 30; i++) {
    const res = checkAndIncrementCrawlUsage(testUid, 30, now);
    assert.equal(res.allowed, true);
    assert.equal(res.count, i);
  }

  const rejected = checkAndIncrementCrawlUsage(testUid, 30, now);
  assert.equal(rejected.allowed, false);
  assert.equal(rejected.count, 30);

  // Next hour resets
  const nextHour = new Date('2026-11-26T15:05:00Z');
  const nextHourRes = checkAndIncrementCrawlUsage(testUid, 30, nextHour);
  assert.equal(nextHourRes.allowed, true);
  assert.equal(nextHourRes.count, 1);
});

test('validatePublicHttpUrl blocks SSRF (localhost, private IPv4, metadata) and accepts public domains', () => {
  // Forbidden targets
  assert.equal(validatePublicHttpUrl('http://localhost:3000').valid, false);
  assert.equal(validatePublicHttpUrl('http://127.0.0.1/admin').valid, false);
  assert.equal(validatePublicHttpUrl('http://10.0.0.1/secrets').valid, false);
  assert.equal(validatePublicHttpUrl('http://172.16.5.1/api').valid, false);
  assert.equal(validatePublicHttpUrl('http://172.31.255.255/api').valid, false);
  assert.equal(validatePublicHttpUrl('http://192.168.1.1/router').valid, false);
  assert.equal(validatePublicHttpUrl('http://169.254.169.254/latest/meta-data').valid, false);
  assert.equal(validatePublicHttpUrl('http://metadata.google.internal/computeMetadata').valid, false);
  assert.equal(validatePublicHttpUrl('ftp://example.com').valid, false);
  assert.equal(validatePublicHttpUrl('file:///etc/passwd').valid, false);

  // Allowed public domains
  assert.equal(validatePublicHttpUrl('https://www.telecontact.ma/liens/annuaire.php').valid, true);
  assert.equal(validatePublicHttpUrl('https://diversifia.ma').valid, true);
  assert.equal(validatePublicHttpUrl('https://orange.ma/entreprises').valid, true);
});

test('extractVisibleTextFromHtml strips scripts, styles and extracts readable text', () => {
  const html = `
    <html>
      <head>
        <title>Annuaire Entreprises</title>
        <script>alert("xss");</script>
        <style>body { color: red; }</style>
      </head>
      <body>
        <h1>Société B2B Maroc</h1>
        <p>Téléphone : +212 5 22 00 11 22 &amp; Fax</p>
        <div>Email: contact@societe.ma</div>
      </body>
    </html>
  `;

  const text = extractVisibleTextFromHtml(html);
  assert.match(text, /Société B2B Maroc/);
  assert.match(text, /\+212 5 22 00 11 22 & Fax/);
  assert.match(text, /contact@societe\.ma/);
  assert.equal(text.includes('alert'), false);
  assert.equal(text.includes('color: red'), false);
});

