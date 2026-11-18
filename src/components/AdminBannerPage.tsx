import React, { useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LogOut,
  RotateCcw,
  Save,
  ShieldAlert,
} from 'lucide-react';
import {
  OperationType,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
} from '../firebase';
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
  onExitAdmin: () => void;
}

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

export function AdminBannerPage({
  currentBanner,
  bannerLoading,
  whatsappUrl,
  onExitAdmin,
}: AdminBannerPageProps) {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [authReady, setAuthReady] = useState(false);
  const [isAdminVerified, setIsAdminVerified] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(false);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  const [formState, setFormState] = useState<BannerConfig>(currentBanner);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      setErrorMessage(null);

      if (!nextUser) {
        setIsAdminVerified(false);
        return;
      }

      setCheckingAdmin(true);
      try {
        const adminSnap = await getDoc(doc(db, 'admins', nextUser.uid));
        setIsAdminVerified(adminSnap.exists() && nextUser.emailVerified);
      } catch {
        setIsAdminVerified(false);
      } finally {
        setCheckingAdmin(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setFormState(currentBanner);
  }, [currentBanner]);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = loginEmail.trim();
    if (!trimmedEmail || !loginPassword) {
      setErrorMessage('يرجى إدخال البريد الإلكتروني وكلمة المرور.');
      return;
    }

    setSigningIn(true);
    try {
      await signInWithEmailAndPassword(auth, trimmedEmail, loginPassword);
      setLoginPassword('');
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: string }).code)
          : '';
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        setErrorMessage('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
      } else if (code === 'auth/operation-not-allowed') {
        setErrorMessage(
          'تسجيل الدخول بالبريد وكلمة المرور غير مفعّل بعد في Firebase Console (Authentication → Sign-in method → Email/Password).'
        );
      } else if (code === 'auth/too-many-requests') {
        setErrorMessage('تم حظر المحاولات مؤقتاً لكثرتها. حاول بعد قليل.');
      } else {
        setErrorMessage('تعذر تسجيل الدخول. يرجى التحقق من البيانات والمحاولة مرة أخرى.');
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleSendVerification = async () => {
    if (!user) return;
    setErrorMessage(null);
    try {
      await sendEmailVerification(user);
      setVerificationSent(true);
    } catch {
      setErrorMessage('تعذر إرسال رابط التفعيل حالياً. حاول مرة أخرى بعد قليل.');
    }
  };

  const handleRefreshVerification = async () => {
    if (!user) return;
    setErrorMessage(null);
    await user.reload();
    const refreshed = auth.currentUser;
    if (refreshed?.emailVerified) {
      try {
        const adminSnap = await getDoc(doc(db, 'admins', refreshed.uid));
        setIsAdminVerified(adminSnap.exists());
      } catch {
        setIsAdminVerified(false);
      }
      setUser({ ...refreshed } as User);
    } else {
      setErrorMessage('لم يتم تأكيد البريد الإلكتروني بعد. افتح الرابط المرسل لبريدك ثم اضغط تحديث.');
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: string }).code)
          : '';
      if (code === 'auth/unauthorized-domain') {
        setErrorMessage(
          `هذا النطاق (${window.location.hostname}) غير مضاف في النطاقات المصرح بها في Firebase Authentication. أضفه من لوحة تحكم Firebase ثم أعد المحاولة.`
        );
      } else if (code === 'auth/popup-closed-by-user') {
        setErrorMessage('تم إغلاق نافذة تسجيل الدخول قبل إتمام العملية.');
      } else {
        setErrorMessage('تعذر تسجيل الدخول حالياً. يرجى المحاولة مرة أخرى.');
      }
    }
  };

  const handleSignOut = async () => {
    setErrorMessage(null);
    setVerificationSent(false);
    await signOut(auth);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const cleanText = formState.text.trim().slice(0, 140);
    const cleanCtaLabel = formState.ctaLabel.trim().slice(0, 40);

    if (!cleanText) {
      setErrorMessage('يرجى كتابة نص البنر قبل الحفظ.');
      return;
    }

    setSaving(true);
    setSaveSuccess(false);
    setErrorMessage(null);

    const payload = {
      isActive: Boolean(formState.isActive),
      text: cleanText,
      ctaLabel: cleanCtaLabel,
      ctaTarget: formState.ctaTarget,
      theme: formState.theme,
      dismissible: Boolean(formState.dismissible),
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    };

    try {
      await setDoc(doc(db, 'site_settings', 'banner'), payload);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setErrorMessage('تعذر حفظ التغييرات. تأكد من صلاحيات الإدارة والاتصال.');
      handleFirestoreError(err, OperationType.WRITE, 'site_settings/banner');
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
            {isAdminVerified && (
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
            {user && (
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-xs sm:text-sm font-medium text-[#526277] hover:text-[#2B3A4D] border border-[#E2E8F0] rounded-lg bg-white transition-colors cursor-pointer whitespace-nowrap"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">تسجيل الخروج</span>
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
        {!authReady || checkingAdmin ? (
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 space-y-4">
            <div className="h-6 w-48 bg-[#F6F8FA] rounded animate-pulse" />
            <div className="h-12 w-full bg-[#F6F8FA] rounded animate-pulse" />
            <div className="h-32 w-full bg-[#F6F8FA] rounded animate-pulse" />
          </div>
        ) : !user ? (
          <div className="max-w-md mx-auto bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 space-y-5">
            <div className="space-y-1.5 text-center">
              <h1 className="font-display font-bold text-xl sm:text-2xl text-[#2B3A4D]">
                دخول الإدارة
              </h1>
              <p className="text-sm text-[#526277] leading-relaxed">
                هذه الصفحة مخصصة لصاحب المتجر فقط. يرجى تسجيل الدخول للوصول.
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

            <form onSubmit={handleEmailSignIn} className="space-y-4">
              <div>
                <label
                  htmlFor="admin-login-email"
                  className="block text-sm font-semibold text-[#2B3A4D] mb-1.5"
                >
                  البريد الإلكتروني (اسم المستخدم)
                </label>
                <input
                  id="admin-login-email"
                  type="email"
                  dir="ltr"
                  autoComplete="username"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="admin@example.com"
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

            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-[#E2E8F0]" />
              <span className="mx-3 text-xs text-[#94A3B8]">أو</span>
              <div className="flex-grow border-t border-[#E2E8F0]" />
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 border border-[#E2E8F0] hover:border-[#2B3A4D] bg-white text-[#2B3A4D] font-medium text-sm px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              <span>الدخول بحساب Google</span>
            </button>
          </div>
        ) : !user.emailVerified ? (
          <div className="max-w-lg mx-auto bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 space-y-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h1 className="font-display font-bold text-xl text-[#2B3A4D]">
              مطلوب تأكيد البريد الإلكتروني
            </h1>
            <p className="text-sm text-[#526277] leading-relaxed">
              لأغراض الحماية، يتطلب تفعيل البريد (<span dir="ltr">{user.email}</span>) لمرة واحدة قبل حفظ التعديلات.
            </p>
            {errorMessage && (
              <div
                role="alert"
                className="bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm rounded-xl p-3.5"
              >
                {errorMessage}
              </div>
            )}
            {verificationSent && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm rounded-xl p-3.5">
                تم إرسال رابط التفعيل إلى بريدك الإلكتروني. افتح الرابط ثم اضغط «تحقق من التفعيل».
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={handleSendVerification}
                className="flex-1 min-h-[46px] px-4 py-2.5 bg-[#2B3A4D] hover:bg-[#1E293B] text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
              >
                إرسال رابط التفعيل
              </button>
              <button
                type="button"
                onClick={handleRefreshVerification}
                className="flex-1 min-h-[46px] px-4 py-2.5 border border-[#E2E8F0] bg-white text-[#2B3A4D] text-sm font-medium rounded-xl hover:border-[#2B3A4D] transition-colors cursor-pointer"
              >
                تحقق من التفعيل
              </button>
            </div>
          </div>
        ) : !isAdminVerified ? (
          <div className="max-w-lg mx-auto bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 space-y-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h1 className="font-display font-bold text-xl text-[#2B3A4D]">
              الحساب غير مصرح له بالإدارة
            </h1>
            <p className="text-sm text-[#526277] leading-relaxed">
              الحساب المسجل حالياً (<span dir="ltr">{user.email}</span>) لا يملك
              صلاحية تعديل بنر المتجر. يرجى تسجيل الدخول بحساب مالك المتجر أو
              إضافة المعرف التالي في مجموعة <span dir="ltr">admins</span> بقاعدة البيانات:
            </p>
            <div
              dir="ltr"
              className="bg-[#F6F8FA] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#2B3A4D] font-mono select-all break-all"
            >
              {user.uid}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={handleSignOut}
                className="flex-1 min-h-[44px] px-4 py-2.5 bg-[#2B3A4D] hover:bg-[#1E293B] text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
              >
                تبديل الحساب
              </button>
              <button
                type="button"
                onClick={onExitAdmin}
                className="flex-1 min-h-[44px] px-4 py-2.5 border border-[#E2E8F0] bg-white text-[#2B3A4D] text-sm font-medium rounded-xl hover:border-[#2B3A4D] transition-colors cursor-pointer"
              >
                العودة للمتجر
              </button>
            </div>
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
                    البنر مخفي حالياً — فعّل خيار «إظهار البنر في المتجر» بالأسفل
                    ليظهر للزوار.
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
                    يتم حفظ التعديلات ومزامنتها فوراً لجميع زوار المتجر.
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
                  جاري تحميل الإعدادات الحالية من قاعدة البيانات...
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
