import crypto from 'crypto';

export type SessionRole = 'admin' | 'customer';
export type SessionProvider =
  | 'admin_credentials'
  | 'google_admin'
  | 'customer_email'
  | 'google_customer';

export type LicenseTier = 'STARTER' | 'GROWTH' | 'ENTERPRISE';
export type LicenseStatus = 'ACTIVE' | 'REVOKED';

export interface SessionPayload {
  sub: string;
  role: SessionRole;
  email: string;
  displayName: string;
  provider: SessionProvider;
  iat: number;
  exp: number;
}

export interface AdminLicenseRecord {
  id: string;
  licenseKey: string;
  tier: LicenseTier;
  customerName: string;
  customerEmail: string;
  status: LicenseStatus;
  validDays: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredCustomerAccount {
  id: string;
  email: string;
  displayName: string;
  businessName: string;
  passwordHash: string;
  createdAt: string;
}

export const ALLOWLISTED_ADMIN_EMAILS = [
  'ba6263845@gmail.com',
  'biplob168896@gmail.com',
] as const;

const DEFAULT_ADMIN_USER = 'biplob_admin';
const DEFAULT_ADMIN_PASS = 'Biplob@01989981370';

export function isAllowlistedAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return (ALLOWLISTED_ADMIN_EMAILS as readonly string[]).includes(normalized);
}

export function getEffectiveAdminCredentials(env: NodeJS.ProcessEnv = process.env): {
  username: string;
  password: string;
} {
  const rawUser = (env.ADMIN_USERNAME || '').trim();
  const rawPass = (env.ADMIN_PASSWORD || '').trim();
  const username =
    rawUser && rawUser !== 'MY_ADMIN_USERNAME' ? rawUser : DEFAULT_ADMIN_USER;
  const password =
    rawPass && rawPass !== 'MY_ADMIN_PASSWORD' ? rawPass : DEFAULT_ADMIN_PASS;
  return { username, password };
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export function verifyAdminCredentials(
  usernameInput: string,
  passwordInput: string,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  if (!usernameInput || !passwordInput) return false;
  const { username, password } = getEffectiveAdminCredentials(env);
  const cleanUser = usernameInput.trim().toLowerCase();
  const expectedUser = username.trim().toLowerCase();
  const userMatches = timingSafeStringEqual(cleanUser, expectedUser);
  const passMatches = timingSafeStringEqual(passwordInput, password);
  return userMatches && passMatches;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  try {
    const keyBuf = Buffer.from(keyHex, 'hex');
    const derived = crypto.scryptSync(password, salt, 64);
    if (keyBuf.length !== derived.length) return false;
    return crypto.timingSafeEqual(keyBuf, derived);
  } catch {
    return false;
  }
}

export function createSignedSessionToken(
  input: Omit<SessionPayload, 'iat' | 'exp'>,
  secret: string,
  ttlSeconds: number = 60 * 60 * 12
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    ...input,
    iat: now,
    exp: now + ttlSeconds,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
}

export function verifySignedSessionToken(
  token: string | undefined | null,
  secret: string
): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, providedSig] = parts;
  if (!encodedPayload || !providedSig) return null;

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');

  const sigBufA = Buffer.from(providedSig, 'utf8');
  const sigBufB = Buffer.from(expectedSig, 'utf8');
  if (sigBufA.length !== sigBufB.length || !crypto.timingSafeEqual(sigBufA, sigBufB)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as SessionPayload;
    const now = Math.floor(Date.now() / 1000);
    if (!parsed || typeof parsed.exp !== 'number' || parsed.exp <= now) {
      return null;
    }
    if (parsed.role !== 'admin' && parsed.role !== 'customer') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function generateCryptographicLicenseKey(
  tier: LicenseTier,
  customerName: string
): string {
  const prefix = tier === 'ENTERPRISE' ? 'ENT' : tier === 'GROWTH' ? 'GRW' : 'STR';
  const cleanCode = (customerName || 'ACRM')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4)
    .padEnd(4, 'X');
  const year = new Date().getUTCFullYear();
  const randHex = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `ACRM-${prefix}-${year}-${cleanCode}-${randHex}`;
}

export function validateLicenseCreateInput(body: {
  customerName?: unknown;
  customerEmail?: unknown;
  tier?: unknown;
  validDays?: unknown;
}):
  | {
      ok: true;
      data: {
        customerName: string;
        customerEmail: string;
        tier: LicenseTier;
        validDays: number;
      };
    }
  | { ok: false; error: string } {
  const customerName =
    typeof body.customerName === 'string' ? body.customerName.trim().slice(0, 120) : '';
  if (customerName.length < 2) {
    return { ok: false, error: 'Customer or business name must be at least 2 characters.' };
  }

  const customerEmail =
    typeof body.customerEmail === 'string' ? body.customerEmail.trim().slice(0, 180) : '';
  if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    return { ok: false, error: 'Enter a valid customer email address.' };
  }

  const tier = body.tier;
  if (tier !== 'STARTER' && tier !== 'GROWTH' && tier !== 'ENTERPRISE') {
    return { ok: false, error: 'Invalid license tier selected.' };
  }

  const validDaysNum = Number(body.validDays ?? 365);
  if (!Number.isInteger(validDaysNum) || validDaysNum < 1 || validDaysNum > 3650) {
    return { ok: false, error: 'Validity days must be an integer between 1 and 3650.' };
  }

  return {
    ok: true,
    data: {
      customerName,
      customerEmail,
      tier,
      validDays: validDaysNum,
    },
  };
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx <= 0) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    try {
      out[key] = decodeURIComponent(val);
    } catch {
      out[key] = val;
    }
  }
  return out;
}
