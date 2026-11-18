import type { ServerResponse } from 'node:http';
import { buildClearSessionCookie } from '../../server/auth.ts';
import { type MinimalRequest, sendJson } from '../../server/httpHelpers.ts';

export default async function handler(req: MinimalRequest, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  sendJson(
    res,
    200,
    { authenticated: false },
    { 'Set-Cookie': buildClearSessionCookie(req) }
  );
}
