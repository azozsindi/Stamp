import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Lock,
  LogOut,
  RotateCcw,
  Save,
} from 'lucide-react';
import {
  BannerConfig,
  BannerCtaTarget,
  BannerTheme,
  DEFAULT_BANNER_CONFIG,
} from '../types/banner';
import { AnnouncementBanner } from './AnnouncementBanner';

interface AdminBannerPageProps {
  currentBanner: BannerConfig;
  bannerLoading: boolean;
  whatsappUrl: string;
  onBannerSaved: (banner: BannerConfig) => void;
  onExitAdmin: () => void;
}

const TOKEN_STORAGE_KEY = 'stamp_pen_admin_token';

const THEME_OPTIONS: { id: BannerTheme; label: string; swatch: string }[] = [
  { id: 'navy', label: 'أزرق البصمة', swatch: '#2B3A4D' },
  { id: 'slate', label: 'رمادي هادئ', swatch: '#E2E8F0' },
  { id: 'emerald', label: 'أخضر داكن', swatch: '#14532D' },
  { id: 'amber', label: 'عنبر دافئ', swatch: '#92400E' },
];

const TARGET_OPTIONS: { id: BannerCtaTarget; label: string }[] = [
  { id: 'none', label: 'بدون زر رابط' },
  { id: 'customize', label: 'قسم تخصيص الختم' },
  { id: 'shipping', label: 'قسم التوصيل والدفع' },
  { id: 'contact', label: 'قسم حسابات التواصل' },
  { id: 'whatsapp', label: 'محادثة واتساب مباشرة' },
];

function getStoredToken(): string {
  try {
    return window.sessionStorage.getItem(TOKEN_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function setStoredToken(token: string): void {
  try {
    if (token) {
      window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage restriction errors
  }
}

export function AdminBannerPage({
  currentBanner,
  bannerLoading,
  whatsappUrl,
  onBannerSaved,
  onExitAdmin,
}: AdminBannerPageProps) {
  const [authReady, setAuthReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [adminUsername, setAdminUsername] = useState<string>('');

  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  const [formState, setFormState] = useState<BannerConfig>(currentBanner);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [ephemeralNotice, setEphemeralNotice] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const verifySession = async () => {
      const token = getStoredToken();
      try {
        const res = await fetch('/api/admin/session', {
          method: 'GET',
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: 'no-store',
        });
        if (!cancelled && res.ok) {
          const data = (await res.json()) as {
            authenticated?: boolean;
            username?: string;
          };
          if (data.authenticated) {
            setAuthenticated(true);
            setAdminUsername(data.username || '');
          } else {
            setAuthenticated(false);
            setStoredToken('');
          }
        } else if (!cancelled) {
          setAuthenticated(false);
          setStoredToken('');
        }
      } catch {
        if (!cancelled) {
          setAuthenticated(false);
        }
      } finally {
        if (!cancelled) {
          setAuthReady(true);
        }
      }
    };

    void verifySession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setFormState(currentBanner);
  }, [currentBanner]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedUsername = loginUsername.trim();
    if (!trimmedUsername || !loginPassword) {
      setErrorMessage('يرجى إدخال اسم المستخدم وكلمة المرور.');
      return;
    }

    setSigningIn(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: trimmedUsername,
          password: loginPassword,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        authenticated?: boolean;
        username?: string;
        token?: string;
        error?: string;
      };

      if (!res.ok || !data.authenticated) {
        setErrorMessage(data.error || 'اسم المستخدم أو كلمة المرور غير صحيحة.');
        return;
      }

      if (data.token) {
        setStoredToken(data.token);
      }
      setAdminUsername(data.username || trimmedUsername);
      setAuthenticated(true);
      setLoginPassword('');
    } catch {
      setErrorMessage('تعذر الاتصال بالخادم حالياً. يرجى المحاولة مرة أخرى.');
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    setErrorMessage(null);
    setSaveSuccess(false);
    setStoredToken('');
    setAuthenticated(false);
    setAdminUsername('');
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Ignore network error on sign out
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = formState.text.trim().slice(0, 140);
    const cleanCtaLabel = formState.ctaLabel.trim().slice(0, 40);

    if (!cleanText) {
      setErrorMessage('يرجى كتابة نص البنر قبل الحفظ.');
      return;
    }

    setSaving(true);
    setSaveSuccess(false);
    setEphemeralNotice(false);
    setErrorMessage(null);

    const token = getStoredToken();
    try {
      const res = await fetch('/api/banner', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          isActive: Boolean(formState.isActive),
          text: cleanText,
          ctaLabel: cleanCtaLabel,
          ctaTarget: formState.ctaTarget,
          theme: formState.theme,
          dismissible: Boolean(formState.dismissible),
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        banner?: BannerConfig;
        storage?: 'kv' | 'disk' | 'ephemeral';
        error?: string;
      };

      if (res.status === 401) {
        setAuthenticated(false);
        setStoredToken('');
        setErrorMessage('انتهت جلسة الدخول. يرجى تسجيل الدخول مجدداً.');
        return;
      }

      if (!res.ok || !data.banner) {
        setErrorMessage(data.error || 'تعذر حفظ التغييرات حالياً.');
        return;
      }

      setFormState(data.banner);
      onBannerSaved(data.banner);
      setSaveSuccess(true);
      if (data.storage === 'ephemeral') {
        setEphemeralNotice(true);
      }
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch {
      setErrorMessage('تعذر الاتصال بالخادم لحفظ التعديلات.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8FA] text-[#2B3A4D]">
      {/* Admin Top Header */}
      <header className="bg-white border-b border-[#E2E8F0]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm sm:text-base font-display font-bold text-[#2B3A4D] min-w-0 truncate">
            <span className="truncate">Stamp pen</span>
            {authenticated && (
              <>
                <span className="text-[#94A3B8]" aria-hidden="true">
                  /
                </span>
                <span className="text-[#526277] font-medium truncate">
                  إدارة البنر
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {authenticated && (
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-xs sm:text-sm font-medium text-[#526277] hover:text-[#2B3A4D] border border-[#E2E8F0] rounded-lg bg-white transition-colors cursor-pointer whitespace-nowrap"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">
                  خروج{adminUsername ? ` (${adminUsername})` : ''}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={onExitAdmin}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs sm:text-sm font-medium text-white bg-[#2B3A4D] hover:bg-[#1E293B] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <ArrowRight className="w-4 h-4" />
              <span>العودة للمتجر</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {!authReady ? (
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 space-y-4">
            <div className="h-6 w-48 bg-[#F6F8FA] rounded animate-pulse" />
            <div className="h-12 w-full bg-[#F6F8FA] rounded animate-pulse" />
            <div className="h-32 w-full bg-[#F6F8FA] rounded animate-pulse" />
          </div>
        ) : !authenticated ? (
          <div className="max-w-md mx-auto bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 space-y-5">
            <div className="space-y-1.5 text-center">
              <div className="w-11 h-11 rounded-xl bg-[#F6F8FA] border border-[#E2E8F0] text-[#2B3A4D] flex items-center justify-center mx-auto mb-2">
                <Lock className="w-5 h-5" />
              </div>
              <h1 className="font-display font-bold text-xl sm:text-2xl text-[#2B3A4D]">
                دخول الإدارة
              </h1>
              <p className="text-sm text-[#526277] leading-relaxed">
                هذه الصفحة مخصصة لصاحب المتجر فقط. أدخل اسم المستخدم وكلمة المرور للمتابعة.
              </p>
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm rounded-xl p-3.5 text-right leading-relaxed"
              >
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label
                  htmlFor="admin-login-username"
                  className="block text-sm font-semibold text-[#2B3A4D] mb-1.5"
                >
                  اسم المستخدم
                </label>
                <input
                  id="admin-login-username"
                  type="text"
                  dir="ltr"
                  autoComplete="username"
                  required
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="اسم المستخدم"
                  className="w-full min-h-[46px] px-3.5 py-2.5 text-base sm:text-sm text-left bg-white border border-[#E2E8F0] rounded-xl text-[#2B3A4D] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2B3A4D] focus:ring-1 focus:ring-[#2B3A4D]"
                />
              </div>

              <div>
                <label
                  htmlFor="admin-login-password"
                  className="block text-sm font-semibold text-[#2B3A4D] mb-1.5"
                >
                  كلمة المرور
                </label>
                <div className="relative">
                  <input
                    id="admin-login-password"
                    type={showPassword ? 'text' : 'password'}
                    dir="ltr"
                    autoComplete="current-password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full min-h-[46px] pl-11 pr-3.5 py-2.5 text-base sm:text-sm text-left bg-white border border-[#E2E8F0] rounded-xl text-[#2B3A4D] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2B3A4D] focus:ring-1 focus:ring-[#2B3A4D]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-[#526277] hover:text-[#2B3A4D] cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={signingIn}
                className="w-full min-h-[48px] inline-flex items-center justify-center bg-[#2B3A4D] hover:bg-[#1E293B] disabled:opacity-60 text-white font-semibold text-sm sm:text-base px-5 py-3 rounded-xl transition-colors cursor-pointer"
              >
                <span>{signingIn ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}</span>
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Live Preview Card */}
            <section className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
              <div className="px-4 sm:px-6 py-3.5 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {formState.isActive ? (
                    <Eye className="w-4 h-4 text-[#16A34A]" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-[#526277]" />
                  )}
                  <h2 className="font-display font-semibold text-sm sm:text-base text-[#2B3A4D]">
                    معاينة مباشرة للبنر أعلى المتجر
                  </h2>
                </div>
                <span className="text-xs font-medium text-[#526277]">
                  الحالة:{' '}
                  <strong
                    className={
                      formState.isActive ? 'text-[#15803D]' : 'text-[#526277]'
                    }
                  >
                    {formState.isActive ? 'ظاهر للزوار' : 'مخفي حالياً'}
                  </strong>
                </span>
              </div>

              <div className="p-4 sm:p-6 bg-[#F6F8FA]">
                {formState.isActive ? (
                  <div className="rounded-xl overflow-hidden border border-[#E2E8F0]">
                    <AnnouncementBanner
                      banner={{
                        ...formState,
                        text: formState.text.trim() || 'اكتب نص البنر هنا...',
                      }}
                      whatsappUrl={whatsappUrl}
                      isPreview
                    />
                  </div>
                ) : (
                  <div className="border border-dashed border-[#CBD5E1] rounded-xl py-5 px-4 text-center text-xs sm:text-sm text-[#526277] bg-white">
                    البنر مخفي حالياً — فعّل خيار «البنر مفعّل» بالأسفل ليظهر للزوار.
                  </div>
                )}
              </div>
            </section>

            {/* Editor Form */}
            <form
              onSubmit={handleSave}
              className="bg-white border border-[#E2E8F0] rounded-2xl p-5 sm:p-7 space-y-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#E2E8F0]">
                <div>
                  <h1 className="font-display font-bold text-lg sm:text-xl text-[#2B3A4D]">
                    إعدادات البنر الإعلاني
                  </h1>
                  <p className="text-xs sm:text-sm text-[#526277] mt-0.5">
                    يتم حفظ التعديلات وتطبيقها على البنر العلوي في المتجر.
                  </p>
                </div>

                {/* Active Toggle */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={formState.isActive}
                  onClick={() =>
                    setFormState((prev) => ({
                      ...prev,
                      isActive: !prev.isActive,
                    }))
                  }
                  className={`inline-flex items-center gap-2.5 px-4 py-2.5 min-h-[44px] rounded-xl border text-sm font-semibold transition-colors cursor-pointer ${
                    formState.isActive
                      ? 'bg-[#2B3A4D] border-[#2B3A4D] text-white'
                      : 'bg-[#F6F8FA] border-[#E2E8F0] text-[#526277]'
                  }`}
                >
                  <span>
                    {formState.isActive ? 'البنر مفعّل' : 'البنر متوقف'}
                  </span>
                </button>
              </div>

              {bannerLoading && (
                <p className="text-xs text-[#526277]">
                  جاري تحميل الإعدادات الحالية...
                </p>
              )}

              {/* Banner Text */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="banner-text-input"
                    className="block text-sm font-semibold text-[#2B3A4D]"
                  >
                    نص البنر الرئيسي
                  </label>
                  <span className="text-xs text-[#526277] tabular-nums">
                    {formState.text.length} / 140
                  </span>
                </div>
                <input
                  id="banner-text-input"
                  type="text"
                  maxLength={140}
                  value={formState.text}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, text: e.target.value }))
                  }
                  placeholder="مثال: توصيل لجميع مناطق المملكة والدفع عند الاستلام"
                  className="w-full min-h-[46px] px-3.5 py-2.5 text-base sm:text-sm bg-white border border-[#E2E8F0] rounded-xl text-[#2B3A4D] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2B3A4D] focus:ring-1 focus:ring-[#2B3A4D]"
                />
              </div>

              {/* CTA Label + Target */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="banner-cta-label"
                      className="block text-sm font-semibold text-[#2B3A4D]"
                    >
                      نص الرابط داخل البنر (اختياري)
                    </label>
                    <span className="text-xs text-[#526277] tabular-nums">
                      {formState.ctaLabel.length} / 40
                    </span>
                  </div>
                  <input
                    id="banner-cta-label"
                    type="text"
                    maxLength={40}
                    value={formState.ctaLabel}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        ctaLabel: e.target.value,
                      }))
                    }
                    placeholder="مثال: اطلب الآن"
                    className="w-full min-h-[46px] px-3.5 py-2.5 text-base sm:text-sm bg-white border border-[#E2E8F0] rounded-xl text-[#2B3A4D] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2B3A4D] focus:ring-1 focus:ring-[#2B3A4D]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="banner-cta-target"
                    className="block text-sm font-semibold text-[#2B3A4D] mb-1.5"
                  >
                    عند الضغط على الرابط ينتقل إلى
                  </label>
                  <select
                    id="banner-cta-target"
                    value={formState.ctaTarget}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        ctaTarget: e.target.value as BannerCtaTarget,
                      }))
                    }
                    className="w-full min-h-[46px] px-3 text-base sm:text-sm bg-white border border-[#E2E8F0] rounded-xl text-[#2B3A4D] focus:outline-none focus:border-[#2B3A4D] focus:ring-1 focus:ring-[#2B3A4D]"
                  >
                    {TARGET_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Theme & Dismissible */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <span className="block text-sm font-semibold text-[#2B3A4D] mb-2">
                    لون خلفية البنر
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {THEME_OPTIONS.map((themeOpt) => {
                      const active = formState.theme === themeOpt.id;
                      return (
                        <button
                          key={themeOpt.id}
                          type="button"
                          onClick={() =>
                            setFormState((prev) => ({
                              ...prev,
                              theme: themeOpt.id,
                            }))
                          }
                          className={`inline-flex items-center gap-2 px-3 py-2.5 min-h-[44px] rounded-xl border text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                            active
                              ? 'border-[#2B3A4D] bg-[#F6F8FA] text-[#2B3A4D] font-semibold'
                              : 'border-[#E2E8F0] bg-white text-[#526277] hover:border-[#94A3B8]'
                          }`}
                        >
                          <span
                            className="w-4 h-4 rounded-full border border-black/15 shrink-0"
                            style={{ backgroundColor: themeOpt.swatch }}
                            aria-hidden="true"
                          />
                          <span>{themeOpt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <span className="block text-sm font-semibold text-[#2B3A4D] mb-2">
                    إمكانية إغلاق البنر من الزائر
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setFormState((prev) => ({ ...prev, dismissible: true }))
                      }
                      className={`min-h-[44px] px-3 py-2.5 rounded-xl border text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                        formState.dismissible
                          ? 'border-[#2B3A4D] bg-[#2B3A4D] text-white'
                          : 'border-[#E2E8F0] bg-white text-[#526277]'
                      }`}
                    >
                      يسمح بالإغلاق
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFormState((prev) => ({
                          ...prev,
                          dismissible: false,
                        }))
                      }
                      className={`min-h-[44px] px-3 py-2.5 rounded-xl border text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                        !formState.dismissible
                          ? 'border-[#2B3A4D] bg-[#2B3A4D] text-white'
                          : 'border-[#E2E8F0] bg-white text-[#526277]'
                      }`}
                    >
                      ثابت بدون إغلاق
                    </button>
                  </div>
                </div>
              </div>

              {errorMessage && (
                <div
                  role="alert"
                  className="bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm rounded-xl p-3.5"
                >
                  {errorMessage}
                </div>
              )}

              {saveSuccess && (
                <div
                  role="status"
                  className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm rounded-xl p-3.5 flex items-center gap-2"
                >
                  <Check className="w-4 h-4 shrink-0" />
                  <span>تم حفظ ونشر إعدادات البنر في المتجر بنجاح.</span>
                </div>
              )}

              {ephemeralNotice && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl p-3.5 leading-relaxed">
                  ملاحظة استضافة Vercel: للحفظ الدائم بين جميع الزوار بعد إعادة تشغيل الخادم، اربط Upstash Redis / Vercel KV من لوحة Storage في Vercel.
                </div>
              )}

              {/* Actions */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 min-h-[48px] inline-flex items-center justify-center gap-2 bg-[#2B3A4D] hover:bg-[#1E293B] disabled:opacity-60 text-white font-semibold text-sm sm:text-base px-6 py-3 rounded-xl transition-colors cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'جاري الحفظ...' : 'حفظ ونشر البنر'}</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setFormState({
                      ...DEFAULT_BANNER_CONFIG,
                      isActive: formState.isActive,
                    })
                  }
                  className="min-h-[48px] inline-flex items-center justify-center gap-2 px-4 py-3 border border-[#E2E8F0] hover:border-[#2B3A4D] bg-white text-[#2B3A4D] text-sm font-medium rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>استعادة النص الافتراضي</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
