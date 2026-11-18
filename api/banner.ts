import type { ServerResponse } from 'node:http';
import { getAuthenticatedAdmin } from '../server/auth.ts';
import {
  readBannerConfig,
  validateAndSanitizeBanner,
  writeBannerConfig,
} from '../server/bannerStore.ts';
import { type MinimalRequest, readJsonBody, sendJson } from '../server/httpHelpers.ts';

export default async function handler(req: MinimalRequest, res: ServerResponse): Promise<void> {
  if (req.method === 'GET') {
    try {
      const banner = await readBannerConfig();
      sendJson(res, 200, { banner });
    } catch {
      sendJson(res, 500, { error: 'تعذر قراءة إعدادات البنر.' });
    }
    return;
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    const admin = getAuthenticatedAdmin(req);
    if (!admin) {
      sendJson(res, 401, { error: 'يرجى تسجيل الدخول كمسؤول أولاً.' });
      return;
    }

    const body = await readJsonBody(req);
    const validated = validateAndSanitizeBanner(body, admin.sub);
    if (!validated.ok) {
      sendJson(res, 400, { error: validated.error });
      return;
    }

    try {
      const saved = await writeBannerConfig(validated.value);
      sendJson(res, 200, { banner: saved.banner, storage: saved.storage });
    } catch {
      sendJson(res, 500, { error: 'تعذر حفظ إعدادات البنر حالياً.' });
    }
    return;
  }

  sendJson(res, 405, { error: 'Method Not Allowed' });
}
