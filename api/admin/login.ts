import type { ServerResponse } from 'node:http';
import {
  buildSessionCookie,
  clearFailedAttempts,
  isRateLimited,
  recordFailedAttempt,
  signAdminSessionToken,
  verifyAdminCredentials,
} from '../../server/auth.ts';
import {
  type MinimalRequest,
  getClientIp,
  readJsonBody,
  sendJson,
} from '../../server/httpHelpers.ts';

export default async function handler(req: MinimalRequest, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  const clientIp = getClientIp(req);
  const limitStatus = isRateLimited(clientIp);
  if (limitStatus.limited) {
    sendJson(
      res,
      429,
      { error: 'تم تجاوز عدد محاولات الدخول المسموحة. حاول بعد قليل.' },
      { 'Retry-After': String(limitStatus.retryAfterSec) }
    );
    return;
  }

  const body = await readJsonBody(req);
  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const username = typeof record.username === 'string' ? record.username : '';
  const password = typeof record.password === 'string' ? record.password : '';

  if (!username.trim() || !password) {
    sendJson(res, 400, { error: 'يرجى إدخال اسم المستخدم وكلمة المرور.' });
    return;
  }

  if (!verifyAdminCredentials(username, password)) {
    recordFailedAttempt(clientIp);
    sendJson(res, 401, { error: 'اسم المستخدم أو كلمة المرور غير صحيحة.' });
    return;
  }

  clearFailedAttempts(clientIp);
  const normalizedUsername = username.trim().toLowerCase();
  const token = signAdminSessionToken(normalizedUsername);

  sendJson(
    res,
    200,
    { authenticated: true, username: normalizedUsername, token },
    { 'Set-Cookie': buildSessionCookie(token, req) }
  );
}
