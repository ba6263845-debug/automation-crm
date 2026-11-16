import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSignedSessionToken,
  generateCryptographicLicenseKey,
  hashPassword,
  isAllowlistedAdminEmail,
  parseCookies,
  validateLicenseCreateInput,
  verifyAdminCredentials,
  verifyPassword,
  verifySignedSessionToken,
} from './adminAuthLogic';

test('verifyAdminCredentials accepts valid configured admin credentials and rejects others', () => {
  const env = {
    ADMIN_USERNAME: 'owner_admin',
    ADMIN_PASSWORD: 'SuperSecret#2026',
  } as unknown as NodeJS.ProcessEnv;

  assert.equal(verifyAdminCredentials('owner_admin', 'SuperSecret#2026', env), true);
  assert.equal(verifyAdminCredentials('OWNER_ADMIN', 'SuperSecret#2026', env), true);
  assert.equal(verifyAdminCredentials('owner_admin', 'wrong_pass', env), false);
  assert.equal(verifyAdminCredentials('customer@gmail.com', 'SuperSecret#2026', env), false);
  assert.equal(verifyAdminCredentials('', '', env), false);
});

test('createSignedSessionToken & verifySignedSessionToken round-trip and reject tampering', () => {
  const secret = 'test_hmac_secret_32_bytes_long_1234';
  const token = createSignedSessionToken(
    {
      sub: 'admin:biplob',
      role: 'admin',
      email: 'ba6263845@gmail.com',
      displayName: 'Biplob Ahmed',
      provider: 'admin_credentials',
    },
    secret,
    3600
  );

  const verified = verifySignedSessionToken(token, secret);
  assert.ok(verified);
  assert.equal(verified?.role, 'admin');
  assert.equal(verified?.email, 'ba6263845@gmail.com');

  // Tamper signature
  const tampered = token.slice(0, -4) + 'AAAA';
  assert.equal(verifySignedSessionToken(tampered, secret), null);

  // Expired token
  const expired = createSignedSessionToken(
    {
      sub: 'cust:1',
      role: 'customer',
      email: 'c@shop.bd',
      displayName: 'Shop',
      provider: 'customer_email',
    },
    secret,
    -10
  );
  assert.equal(verifySignedSessionToken(expired, secret), null);
});

test('hashPassword and verifyPassword use salted scrypt safely', () => {
  const hash1 = hashPassword('CustomerPass!99');
  const hash2 = hashPassword('CustomerPass!99');
  assert.notEqual(hash1, hash2);
  assert.equal(verifyPassword('CustomerPass!99', hash1), true);
  assert.equal(verifyPassword('WrongPass', hash1), false);
});

test('generateCryptographicLicenseKey creates high-entropy admin-only keys', () => {
  const k1 = generateCryptographicLicenseKey('ENTERPRISE', 'Dhaka Horizon');
  const k2 = generateCryptographicLicenseKey('ENTERPRISE', 'Dhaka Horizon');
  assert.match(k1, /^ACRM-ENT-\d{4}-DHAK-[A-F0-9]{8}$/);
  assert.notEqual(k1, k2);
});

test('validateLicenseCreateInput validates required fields and bounds', () => {
  const bad = validateLicenseCreateInput({
    customerName: 'A',
    customerEmail: 'not-an-email',
    tier: 'INVALID',
    validDays: 0,
  });
  assert.equal(bad.ok, false);

  const good = validateLicenseCreateInput({
    customerName: 'Padma Mart',
    customerEmail: 'ops@padmamart.bd',
    tier: 'GROWTH',
    validDays: 365,
  });
  assert.equal(good.ok, true);
  if (good.ok) {
    assert.equal(good.data.tier, 'GROWTH');
    assert.equal(good.data.validDays, 365);
  }
});

test('isAllowlistedAdminEmail & parseCookies behave deterministically', () => {
  assert.equal(isAllowlistedAdminEmail('ba6263845@gmail.com'), true);
  assert.equal(isAllowlistedAdminEmail('BIPLOB168896@GMAIL.COM'), true);
  assert.equal(isAllowlistedAdminEmail('random@gmail.com'), false);

  const parsed = parseCookies('acrm_session=abc.123; theme=dark');
  assert.equal(parsed.acrm_session, 'abc.123');
  assert.equal(parsed.theme, 'dark');
});
