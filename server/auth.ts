import crypto from 'node:crypto';
import type { IncomingMessage } from 'node:http';

const DEFAULT_ADMIN_USERNAME = 'pinadmin';
const DEFAULT_ADMIN_PASSWORD_HASH =
  'b8048a3a5fda6080792e169b27a16aa1:f562290b1842bcfbb9fb39eec65e86e3492020d20c32c03c1f77dce906a6ae344ce7d97c8b73075ee6f61b51b3e44787b8f6bf57b2a86dace2a9fe68c6d3ba78';

const SESSION_COOKIE_NAME = 'stamp_admin_session';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 8;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const failedAttemptsByIp = new Map<string, RateLimitEntry>();

function getSessionSecret(): string {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured && configured.length >= 16) {
    return configured;
  }
  const seed = `${process.env.VERCEL_PROJECT_ID || 'stamp-pen'}:${DEFAULT_ADMIN_PASSWORD_HASH}`;
  return crypto.createHash('sha256').update(seed).digest('hex');
}

function constantTimeStringEqual(a: string, b: string): boolean {
  const aHash = crypto.createHash('sha256').update(a).digest();
  const bHash = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(aHash, bHash);
}

function verifyScryptHash(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (expectedBuf.length === 0) return false;
  const derivedBuf = crypto.scryptSync(password, salt, expectedBuf.length);
  if (derivedBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(derivedBuf, expectedBuf);
}

export function isRateLimited(ip: string): { limited: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = failedAttemptsByIp.get(ip);
  if (!entry) return { limited: false, retryAfterSec: 0 };
  if (now > entry.resetAt) {
    failedAttemptsByIp.delete(ip);
    return { limited: false, retryAfterSec: 0 };
  }
  if (entry.count >= MAX_FAILED_ATTEMPTS) {
    return {
      limited: true,
      retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }
  return { limited: false, retryAfterSec: 0 };
}

export function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const existing = failedAttemptsByIp.get(ip);
  if (!existing || now > existing.resetAt) {
    failedAttemptsByIp.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  } else {
    existing.count += 1;
  }
}

export function clearFailedAttempts(ip: string): void {
  failedAttemptsByIp.delete(ip);
}

export function verifyAdminCredentials(username: string, password: string): boolean {
  const expectedUsername = (process.env.ADMIN_USERNAME || DEFAULT_ADMIN_USERNAME)
    .trim()
    .toLowerCase();
  const normalizedInputUser = username.trim().toLowerCase();

  if (!normalizedInputUser || !password) {
    return false;
  }

  const userMatches = constantTimeStringEqual(normalizedInputUser, expectedUsername);
  const envPlainPassword = process.env.ADMIN_PASSWORD;
  const envHash = process.env.ADMIN_PASSWORD_HASH;

  let passMatches = false;
  if (envHash) {
    passMatches = verifyScryptHash(password, envHash);
  } else if (envPlainPassword) {
    passMatches = constantTimeStringEqual(password, envPlainPassword);
  } else {
    passMatches = verifyScryptHash(password, DEFAULT_ADMIN_PASSWORD_HASH);
  }

  return userMatches && passMatches;
}

export interface AdminSessionPayload {
  sub: string;
  role: 'admin';
  exp: number;
}

export function signAdminSessionToken(username: string): string {
  const payload: AdminSessionPayload = {
    sub: username.trim().toLowerCase(),
    role: 'admin',
    exp: Date.now() + SESSION_TTL_MS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
}

export function verifyAdminSessionToken(token: string | null | undefined): AdminSessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, providedSig] = parts;
  if (!encodedPayload || !providedSig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encodedPayload)
    .digest('base64url');

  const providedBuf = Buffer.from(providedSig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (providedBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) return null;

  try {
    const decoded = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as AdminSessionPayload;
    if (
      !decoded ||
      decoded.role !== 'admin' ||
      typeof decoded.sub !== 'string' ||
      typeof decoded.exp !== 'number' ||
      decoded.exp <= Date.now()
    ) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      result[key] = decodeURIComponent(val);
    }
  }
  return result;
}

export function getAuthenticatedAdmin(req: IncomingMessage): AdminSessionPayload | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    const bearerToken = authHeader.slice(7).trim();
    const session = verifyAdminSessionToken(bearerToken);
    if (session) return session;
  }

  const cookies = parseCookieHeader(req.headers.cookie);
  return verifyAdminSessionToken(cookies[SESSION_COOKIE_NAME]);
}

export function buildSessionCookie(token: string, req: IncomingMessage): string {
  const isHttps =
    req.headers['x-forwarded-proto'] === 'https' ||
    process.env.NODE_ENV === 'production';
  const maxAgeSec = Math.floor(SESSION_TTL_MS / 1000);
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSec}`,
  ];
  if (isHttps) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

export function buildClearSessionCookie(req: IncomingMessage): string {
  const isHttps =
    req.headers['x-forwarded-proto'] === 'https' ||
    process.env.NODE_ENV === 'production';
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (isHttps) {
    parts.push('Secure');
  }
  return parts.join('; ');
}
