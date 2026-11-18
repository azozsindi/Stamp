import fs from 'node:fs/promises';
import path from 'node:path';
import type { BannerConfig, BannerCtaTarget, BannerTheme } from '../src/types/banner.ts';
import { DEFAULT_BANNER_CONFIG } from '../src/types/banner.ts';

const ALLOWED_THEMES: readonly BannerTheme[] = ['navy', 'slate', 'emerald', 'amber'];
const ALLOWED_TARGETS: readonly BannerCtaTarget[] = [
  'none',
  'customize',
  'shipping',
  'contact',
  'whatsapp',
];

const KV_KEY = 'stamp_pen:banner';
const LOCAL_DATA_PATH = path.resolve(process.cwd(), 'data', 'banner.json');
const TMP_DATA_PATH = '/tmp/stamp-pen-banner.json';

let memoryCache: BannerConfig = { ...DEFAULT_BANNER_CONFIG };

function getKvCredentials(): { url: string; token: string } | null {
  const url =
    process.env.KV_REST_API_URL?.trim() ||
    process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token =
    process.env.KV_REST_API_TOKEN?.trim() ||
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (url && token) {
    return { url: url.replace(/\/+$/, ''), token };
  }
  return null;
}

export function validateAndSanitizeBanner(
  raw: unknown,
  updatedBy: string
): { ok: true; value: BannerConfig } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'صيغة البيانات غير صالحة.' };
  }

  const record = raw as Record<string, unknown>;
  const text = typeof record.text === 'string' ? record.text.trim().slice(0, 140) : '';
  if (!text) {
    return { ok: false, error: 'يرجى كتابة نص البنر قبل الحفظ.' };
  }

  const ctaLabel =
    typeof record.ctaLabel === 'string' ? record.ctaLabel.trim().slice(0, 40) : '';

  const ctaTarget =
    typeof record.ctaTarget === 'string' &&
    (ALLOWED_TARGETS as readonly string[]).includes(record.ctaTarget)
      ? (record.ctaTarget as BannerCtaTarget)
      : 'none';

  const theme =
    typeof record.theme === 'string' &&
    (ALLOWED_THEMES as readonly string[]).includes(record.theme)
      ? (record.theme as BannerTheme)
      : 'navy';

  const isActive = Boolean(record.isActive);
  const dismissible =
    typeof record.dismissible === 'boolean' ? record.dismissible : true;

  return {
    ok: true,
    value: {
      isActive,
      text,
      ctaLabel,
      ctaTarget,
      theme,
      dismissible,
      updatedAt: new Date().toISOString(),
      updatedBy,
    },
  };
}

function normalizeStoredBanner(raw: unknown): BannerConfig {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_BANNER_CONFIG };
  const record = raw as Record<string, unknown>;
  return {
    isActive: Boolean(record.isActive),
    text:
      typeof record.text === 'string' && record.text.trim()
        ? record.text.trim().slice(0, 140)
        : DEFAULT_BANNER_CONFIG.text,
    ctaLabel:
      typeof record.ctaLabel === 'string' ? record.ctaLabel.trim().slice(0, 40) : '',
    ctaTarget:
      typeof record.ctaTarget === 'string' &&
      (ALLOWED_TARGETS as readonly string[]).includes(record.ctaTarget)
        ? (record.ctaTarget as BannerCtaTarget)
        : 'none',
    theme:
      typeof record.theme === 'string' &&
      (ALLOWED_THEMES as readonly string[]).includes(record.theme)
        ? (record.theme as BannerTheme)
        : 'navy',
    dismissible:
      typeof record.dismissible === 'boolean' ? record.dismissible : true,
    updatedAt: record.updatedAt,
    updatedBy: typeof record.updatedBy === 'string' ? record.updatedBy : undefined,
  };
}

export async function readBannerConfig(): Promise<BannerConfig> {
  const kv = getKvCredentials();
  if (kv) {
    try {
      const response = await fetch(`${kv.url}/get/${encodeURIComponent(KV_KEY)}`, {
        headers: { Authorization: `Bearer ${kv.token}` },
      });
      if (response.ok) {
        const data = (await response.json()) as { result?: string | null };
        if (typeof data.result === 'string' && data.result.length > 0) {
          const parsed = normalizeStoredBanner(JSON.parse(data.result));
          memoryCache = parsed;
          return parsed;
        }
      }
    } catch (err) {
      console.error('KV read failed, falling back to local store:', err);
    }
  }

  for (const filePath of [LOCAL_DATA_PATH, TMP_DATA_PATH]) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const parsed = normalizeStoredBanner(JSON.parse(content));
      memoryCache = parsed;
      return parsed;
    } catch {
      // Try next storage location
    }
  }

  return memoryCache;
}

export async function writeBannerConfig(
  banner: BannerConfig
): Promise<{ banner: BannerConfig; storage: 'kv' | 'disk' | 'ephemeral' }> {
  memoryCache = banner;
  const serialized = JSON.stringify(banner, null, 2);

  const kv = getKvCredentials();
  if (kv) {
    const response = await fetch(`${kv.url}/set/${encodeURIComponent(KV_KEY)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${kv.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(serialized),
    });
    if (!response.ok) {
      throw new Error(`KV write failed with status ${response.status}`);
    }
    return { banner, storage: 'kv' };
  }

  try {
    await fs.mkdir(path.dirname(LOCAL_DATA_PATH), { recursive: true });
    await fs.writeFile(LOCAL_DATA_PATH, serialized, 'utf8');
    return { banner, storage: 'disk' };
  } catch {
    try {
      await fs.writeFile(TMP_DATA_PATH, serialized, 'utf8');
    } catch {
      // Ignore if /tmp is unavailable; memoryCache already holds latest state
    }
    return { banner, storage: 'ephemeral' };
  }
}
