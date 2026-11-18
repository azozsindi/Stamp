import type { ServerResponse } from 'node:http';
import { getAuthenticatedAdmin } from '../../server/auth.ts';
import { type MinimalRequest, sendJson } from '../../server/httpHelpers.ts';

export default async function handler(req: MinimalRequest, res: ServerResponse): Promise<void> {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  const admin = getAuthenticatedAdmin(req);
  if (!admin) {
    sendJson(res, 401, { authenticated: false });
    return;
  }

  sendJson(res, 200, { authenticated: true, username: admin.sub });
}
