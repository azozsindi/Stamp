import React, { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  Check,
  Copy,
  MapPin,
  Minus,
  PenTool,
  Plus,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { AdminBannerPage } from './components/AdminBannerPage';
import { AnnouncementBanner } from './components/AnnouncementBanner';
import { InstagramIcon, TikTokIcon, WhatsAppIcon } from './components/Icons';
import {
  InkColorId,
  StampFrameStyle,
  StampPreview,
} from './components/StampPreview';
import { OperationType, db, handleFirestoreError } from './firebase';
import { BannerConfig, DEFAULT_BANNER_CONFIG } from './types/banner';

type StampCategory = 'name_title' | 'signature' | 'company' | 'custom';
type PaymentMethod = 'cod' | 'transfer';
type PenColorId = 'matte_silver' | 'glossy_silver' | 'black';
type GalleryViewMode = 'all' | PenColorId;

const UNIT_PRICE_SAR = 70;
const WHATSAPP_NUMBER = '966530200694';
const DISPLAY_PHONE = '+966 53 020 0694';

const PRODUCT_IMAGE_SRC = '/assets/aistudio/_______________________________71fc9b59.png';
const LOGO_IMAGE_SRC = '/assets/aistudio/image_a8a7c260.png';

const PEN_COLORS: { id: PenColorId; label: string; swatch: string; cropOffset: string }[] = [
  { id: 'matte_silver', label: 'فضي مطفي', swatch: '#B8BDC4', cropOffset: '0%' },
  { id: 'glossy_silver', label: 'فضي لماع', swatch: '#E2E6EB', cropOffset: '-33.3333%' },
  { id: 'black', label: 'أسود', swatch: '#1F2329', cropOffset: '-66.6666%' },
];

const STAMP_CATEGORIES: { id: StampCategory; label: string; placeholderPrimary: string; placeholderSecondary: string }[] = [
  {
    id: 'name_title',
    label: 'اسم ومنصب',
    placeholderPrimary: 'اكتب الاسم المطلوب على الختم',
    placeholderSecondary: 'المنصب أو التخصص (اختياري)',
  },
  {
    id: 'signature',
    label: 'توقيع وعبارة',
    placeholderPrimary: 'اكتب الاسم أو عبارة التوقيع',
    placeholderSecondary: 'سطر إضافي (اختياري)',
  },
  {
    id: 'company',
    label: 'مؤسسة / سجل',
    placeholderPrimary: 'اسم الشركة أو المؤسسة',
    placeholderSecondary: 'رقم السجل أو الهاتف (اختياري)',
  },
  {
    id: 'custom',
    label: 'حسب الرغبة',
    placeholderPrimary: 'اكتب النص المطلوب على الختم',
    placeholderSecondary: 'سطر إضافي (اختياري)',
  },
];

const INK_OPTIONS: { id: InkColorId; label: string; swatch: string }[] = [
  { id: 'black', label: 'أسود', swatch: '#18181B' },
  { id: 'blue', label: 'أزرق', swatch: '#1D4ED8' },
];

const FRAME_OPTIONS: { id: StampFrameStyle; label: string }[] = [
  { id: 'bordered', label: 'بإطار رسمي' },
  { id: 'clean', label: 'بدون إطار' },
  { id: 'signature', label: 'مع خط توقيع' },
];

const KSA_REGIONS = [
  'الرياض',
  'جدة',
  'مكة المكرمة',
  'المدينة المنورة',
  'الدمام والخبر (الشرقية)',
  'القصيم',
  'عسير وأبها',
  'تبوك',
  'حائل',
  'جازان',
  'نجران',
  'الباحة',
  'الجوف والحدود الشمالية',
  'مدينة أخرى بالمملكة',
];

export default function App() {
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(
    () => window.location.hash.toLowerCase() === '#admin'
  );
  const [banner, setBanner] = useState<BannerConfig>(DEFAULT_BANNER_CONFIG);
  const [bannerLoading, setBannerLoading] = useState<boolean>(true);
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(false);

  const [penColor, setPenColor] = useState<PenColorId>('matte_silver');
  const [galleryView, setGalleryView] = useState<GalleryViewMode>('all');
  const [category, setCategory] = useState<StampCategory>('name_title');
  const [primaryText, setPrimaryText] = useState('');
  const [secondaryText, setSecondaryText] = useState('');
  const [inkColor, setInkColor] = useState<InkColorId>('black');
  const [frameStyle, setFrameStyle] = useState<StampFrameStyle>('bordered');
  const [quantity, setQuantity] = useState<number>(1);
  const [region, setRegion] = useState<string>('الرياض');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [customerNotes, setCustomerNotes] = useState('');
  const [copied, setCopied] = useState(false);

  const [productImgError, setProductImgError] = useState(false);
  const [logoImgError, setLogoImgError] = useState(false);

  useEffect(() => {
    const syncHash = () => {
      setIsAdminRoute(window.location.hash.toLowerCase() === '#admin');
    };
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  useEffect(() => {
    const bannerPath = 'site_settings/banner';
    const unsubscribe = onSnapshot(
      doc(db, 'site_settings', 'banner'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setBanner({
            isActive: Boolean(data.isActive),
            text: typeof data.text === 'string' ? data.text : DEFAULT_BANNER_CONFIG.text,
            ctaLabel: typeof data.ctaLabel === 'string' ? data.ctaLabel : '',
            ctaTarget:
              data.ctaTarget === 'customize' ||
              data.ctaTarget === 'shipping' ||
              data.ctaTarget === 'contact' ||
              data.ctaTarget === 'whatsapp' ||
              data.ctaTarget === 'none'
                ? data.ctaTarget
                : 'none',
            theme:
              data.theme === 'navy' ||
              data.theme === 'slate' ||
              data.theme === 'emerald' ||
              data.theme === 'amber'
                ? data.theme
                : 'navy',
            dismissible: data.dismissible !== false,
            updatedAt: data.updatedAt,
            updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : undefined,
          });
          setBannerDismissed(false);
        } else {
          setBanner(DEFAULT_BANNER_CONFIG);
        }
        setBannerLoading(false);
      },
      (error) => {
        setBannerLoading(false);
        handleFirestoreError(error, OperationType.GET, bannerPath);
      }
    );

    return () => unsubscribe();
  }, []);

  const activeCategoryConfig =
    STAMP_CATEGORIES.find((c) => c.id === category) || STAMP_CATEGORIES[0];

  const activePenColorConfig =
    PEN_COLORS.find((c) => c.id === penColor) || PEN_COLORS[0];

  const subtotal = quantity * UNIT_PRICE_SAR;

  const orderSummaryText = useMemo(() => {
    const categoryLabel =
      STAMP_CATEGORIES.find((c) => c.id === category)?.label ?? 'حسب الرغبة';
    const inkLabel =
      INK_OPTIONS.find((i) => i.id === inkColor)?.label ?? 'أسود';
    const frameLabel =
      FRAME_OPTIONS.find((f) => f.id === frameStyle)?.label ?? 'بإطار رسمي';
    const paymentLabel =
      paymentMethod === 'cod' ? 'الدفع عند الاستلام' : 'تحويل بنكي';

    const lines = [
      'السلام عليكم، أرغب بطلب قلم الختم من متجر Stamp pen:',
      `• لون القلم: ${activePenColorConfig.label}`,
      `• الكمية: ${quantity}`,
      `• السعر: ${subtotal} ريال (بدون الشحن — سعر القلم 70 ريال)`,
      `• نوع الختم: ${categoryLabel}`,
      `• النص الأساسي للختم: ${primaryText.trim() || 'سيتم تحديده في المحادثة'}`,
      secondaryText.trim()
        ? `• السطر الثاني للختم: ${secondaryText.trim()}`
        : null,
      `• شكل الختم: ${frameLabel}`,
      `• لون الحبر: ${inkLabel}`,
      `• المدينة / المنطقة: ${region}`,
      `• طريقة الدفع: ${paymentLabel}`,
      customerNotes.trim() ? `• ملاحظات إضافية: ${customerNotes.trim()}` : null,
    ].filter(Boolean);

    return lines.join('\n');
  }, [
    activePenColorConfig.label,
    category,
    customerNotes,
    frameStyle,
    inkColor,
    paymentMethod,
    primaryText,
    quantity,
    region,
    secondaryText,
    subtotal,
  ]);

  const whatsappOrderUrl = useMemo(() => {
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(orderSummaryText)}`;
  }, [orderSummaryText]);

  const whatsappDirectInquiryUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    'السلام عليكم، أرغب بالاستفسار وطلب قلم الختم (70 ريال).'
  )}`;

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(orderSummaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  const handleExitAdmin = () => {
    window.history.replaceState(
      null,
      '',
      window.location.pathname + window.location.search
    );
    setIsAdminRoute(false);
  };

  if (isAdminRoute) {
    return (
      <AdminBannerPage
        currentBanner={banner}
        bannerLoading={bannerLoading}
        whatsappUrl={whatsappDirectInquiryUrl}
        onExitAdmin={handleExitAdmin}
      />
    );
  }

  return (
    <div id="top" className="min-h-screen bg-white text-[#2B3A4D] pb-24 md:pb-0 overflow-x-clip">
      {banner.isActive && !bannerDismissed && (
        <AnnouncementBanner
          banner={banner}
          whatsappUrl={whatsappDirectInquiryUrl}
          onDismiss={() => setBannerDismissed(true)}
        />
      )}

      {/* Top Navigation Bar: Strict 3-zone contract */}
      <header className="border-b border-[#E2E8F0] bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Single-element Brand Wordmark */}
          <a
            href="#top"
            className="text-lg sm:text-xl font-display font-bold tracking-tight text-[#2B3A4D] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2B3A4D]"
          >
            Stamp pen
          </a>

          {/* Zone 2: 4 concise single-line text links */}
          <nav
            aria-label="التنقل الرئيسي"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-[#526277]"
          >
            <a
              href="#product"
              className="hover:text-[#2B3A4D] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              المنتج
            </a>
            <a
              href="#customize"
              className="hover:text-[#2B3A4D] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              تخصيص الختم
            </a>
            <a
              href="#features"
              className="hover:text-[#2B3A4D] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              المميزات
            </a>
            <a
              href="#shipping"
              className="hover:text-[#2B3A4D] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              التوصيل والدفع
            </a>
          </nav>

          {/* Zone 3: 1 primary WhatsApp action */}
          <div className="flex items-center shrink-0">
            <a
              href={whatsappDirectInquiryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#2B3A4D] hover:bg-[#1E293B] text-white text-xs sm:text-sm font-medium px-3.5 sm:px-4 py-2 min-h-[40px] rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B3A4D]"
            >
              <WhatsAppIcon className="w-4 h-4" />
              <span>اطلب عبر واتساب</span>
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* Section 1: Hero & Contiguous Product Purchase + Stamp Customizer */}
        <section
          id="product"
          className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-12 sm:pt-8 sm:pb-14 lg:pt-12 lg:pb-20"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-12 items-start">
            {/* Right Column (in RTL): Visual Gallery & Brand Mark */}
            <div className="lg:col-span-6 lg:sticky lg:top-8 space-y-4">
              <div className="max-w-[520px] mx-auto bg-[#F6F8FA] border border-[#E2E8F0] rounded-2xl overflow-hidden p-3 space-y-3">
                {!productImgError ? (
                  galleryView === 'all' ? (
                    <img
                      src={PRODUCT_IMAGE_SRC}
                      alt="قلم الختم الشخصي بثلاثة ألوان: فضي مطفي، فضي لماع، وأسود"
                      referrerPolicy="no-referrer"
                      onError={() => setProductImgError(true)}
                      className="w-full aspect-[3/2] object-contain rounded-xl block mx-auto"
                    />
                  ) : (
                    <div
                      dir="ltr"
                      className="w-full max-w-[195px] aspect-[1/2] mx-auto overflow-hidden rounded-xl bg-[#EAECEF]"
                    >
                      <img
                        src={PRODUCT_IMAGE_SRC}
                        alt={`قلم الختم الشخصي — لون ${
                          PEN_COLORS.find((c) => c.id === galleryView)?.label ?? ''
                        }`}
                        referrerPolicy="no-referrer"
                        onError={() => setProductImgError(true)}
                        className="h-full w-[300%] max-w-none block transition-transform duration-200"
                        style={{
                          transform: `translateX(${
                            PEN_COLORS.find((c) => c.id === galleryView)?.cropOffset ?? '0%'
                          })`,
                        }}
                      />
                    </div>
                  )
                ) : (
                  <div className="w-full aspect-[3/2] bg-[#F6F8FA] flex flex-col items-center justify-center p-8 text-center">
                    <PenTool className="w-12 h-12 text-[#2B3A4D] mb-4" />
                    <p className="font-display font-bold text-xl text-[#2B3A4D]">
                      قلم الختم الشخصي
                    </p>
                    <p className="text-sm text-[#526277] mt-1">
                      متوفر بثلاثة ألوان: فضي مطفي · فضي لماع · أسود
                    </p>
                  </div>
                )}

                {/* Gallery View Tabs: 2x2 on mobile, 4-across on sm+ */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-white border border-[#E2E8F0] rounded-xl">
                  <button
                    type="button"
                    onClick={() => setGalleryView('all')}
                    className={`px-2 py-2 min-h-[44px] sm:min-h-[38px] text-xs font-medium rounded-lg transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                      galleryView === 'all'
                        ? 'bg-[#2B3A4D] text-white'
                        : 'text-[#526277] hover:text-[#2B3A4D]'
                    }`}
                  >
                    كل الألوان
                  </button>
                  {PEN_COLORS.map((colorOpt) => {
                    const active = galleryView === colorOpt.id;
                    return (
                      <button
                        key={colorOpt.id}
                        type="button"
                        onClick={() => {
                          setGalleryView(colorOpt.id);
                          setPenColor(colorOpt.id);
                        }}
                        className={`inline-flex items-center justify-center gap-1.5 px-2 py-2 min-h-[44px] sm:min-h-[38px] text-xs font-medium rounded-lg transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                          active
                            ? 'bg-[#2B3A4D] text-white'
                            : 'text-[#526277] hover:text-[#2B3A4D]'
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-black/15 shrink-0"
                          style={{ backgroundColor: colorOpt.swatch }}
                          aria-hidden="true"
                        />
                        <span>{colorOpt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Brand Identity Strip featuring the Fingerprint Logo */}
              <div className="max-w-[520px] mx-auto bg-white border border-[#E2E8F0] rounded-xl p-3 sm:p-5 flex items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg border border-[#E2E8F0] bg-white flex items-center justify-center shrink-0 overflow-hidden p-1 sm:p-1.5">
                    {!logoImgError ? (
                      <img
                        src={LOGO_IMAGE_SRC}
                        alt="شعار البصمة Stamp pen"
                        referrerPolicy="no-referrer"
                        onError={() => setLogoImgError(true)}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="font-display font-bold text-xs text-[#2B3A4D]">
                        Stamp pen
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-display font-semibold text-sm sm:text-base text-[#2B3A4D]">
                      أناقتك تبدأ بتوقيعك
                    </p>
                    <p className="text-xs sm:text-sm text-[#526277] mt-0.5 leading-relaxed">
                      مثالي لتوقيع الأوراق والختم الرسمي في لحظة واحدة
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Left Column (in RTL): Contiguous Purchase & Customizer Module */}
            <div id="customize" className="lg:col-span-6 space-y-6">
              {/* Quiet text metadata (Zero-pill discipline) */}
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-[#526277]">
                <span>قلم وختم مدمج</span>
                <span aria-hidden="true">·</span>
                <span>توصيل لجميع مناطق المملكة</span>
                <span aria-hidden="true">·</span>
                <span>دفع عند الاستلام</span>
              </div>

              <div className="space-y-3">
                <h1 className="font-display font-bold text-3xl sm:text-4xl lg:text-[2.6rem] leading-tight text-[#2B3A4D]">
                  قلم الختم الشخصي الفاخر
                </h1>
                <p className="text-base text-[#526277] leading-relaxed max-w-xl">
                  اجمع بين الأناقة والعملية في قلم واحد. صمم الختم الذي يناسب
                  احتياجك — سواءً لاسمك، منصبك الوظيفي، توقيعك، أو اسم مؤسستك —
                  واطلب مباشرة عبر واتساب.
                </p>
              </div>

              {/* Price Block */}
              <div className="border-y border-[#E2E8F0] py-5 flex flex-wrap items-baseline justify-between gap-4">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display font-bold text-4xl text-[#2B3A4D] tabular-nums">
                      70
                    </span>
                    <span className="text-lg font-semibold text-[#2B3A4D]">
                      ريال فقط
                    </span>
                  </div>
                  <p className="text-sm text-[#526277] mt-1">
                    السعر لا يشمل الشحن · يتم احتساب التوصيل حسب المنطقة
                  </p>
                </div>
                <div className="text-sm font-medium text-[#2B3A4D] tabular-nums">
                  {quantity > 1
                    ? `الإجمالي (${quantity} أقلام): ${subtotal} ريال + الشحن`
                    : 'متوفر للتجهيز والشحن الفوري'}
                </div>
              </div>

              {/* Stamp Customization Form */}
              <div className="space-y-5">
                {/* 0. Pen Body Color Selector */}
                <div>
                  <span className="block text-sm font-semibold text-[#2B3A4D] mb-2">
                    1. اختر لون القلم
                  </span>
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                    {PEN_COLORS.map((opt) => {
                      const active = penColor === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setPenColor(opt.id)}
                          className={`inline-flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2.5 min-h-[44px] text-xs sm:text-sm font-medium rounded-lg border transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                            active
                              ? 'border-[#2B3A4D] bg-[#2B3A4D] text-white'
                              : 'border-[#E2E8F0] bg-white text-[#526277] hover:border-[#94A3B8] hover:text-[#2B3A4D]'
                          }`}
                        >
                          <span
                            className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full border border-black/15 shrink-0"
                            style={{ backgroundColor: opt.swatch }}
                            aria-hidden="true"
                          />
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Stamp Category */}
                <div>
                  <label className="block text-sm font-semibold text-[#2B3A4D] mb-2">
                    2. اختر نوع الختم المطلوب
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-[#F6F8FA] border border-[#E2E8F0] rounded-lg">
                    {STAMP_CATEGORIES.map((item) => {
                      const active = category === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setCategory(item.id)}
                          className={`px-3 py-2 min-h-[44px] sm:min-h-[38px] text-xs sm:text-sm font-medium rounded-md transition-colors duration-150 whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2B3A4D] ${
                            active
                              ? 'bg-[#2B3A4D] text-white'
                              : 'text-[#526277] hover:text-[#2B3A4D]'
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Stamp Text Inputs (16px on mobile to prevent iOS auto-zoom) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="primary-stamp-text"
                      className="block text-sm font-semibold text-[#2B3A4D] mb-1.5"
                    >
                      3. النص الأساسي على الختم
                    </label>
                    <input
                      id="primary-stamp-text"
                      type="text"
                      value={primaryText}
                      onChange={(e) => setPrimaryText(e.target.value)}
                      placeholder={activeCategoryConfig.placeholderPrimary}
                      className="w-full min-h-[46px] sm:min-h-[42px] px-3.5 py-2.5 text-base sm:text-sm bg-white border border-[#E2E8F0] rounded-lg text-[#2B3A4D] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2B3A4D] focus:ring-1 focus:ring-[#2B3A4D] transition-colors"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="secondary-stamp-text"
                      className="block text-sm font-semibold text-[#2B3A4D] mb-1.5"
                    >
                      سطر إضافي (اختياري)
                    </label>
                    <input
                      id="secondary-stamp-text"
                      type="text"
                      value={secondaryText}
                      onChange={(e) => setSecondaryText(e.target.value)}
                      placeholder={activeCategoryConfig.placeholderSecondary}
                      className="w-full min-h-[46px] sm:min-h-[42px] px-3.5 py-2.5 text-base sm:text-sm bg-white border border-[#E2E8F0] rounded-lg text-[#2B3A4D] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2B3A4D] focus:ring-1 focus:ring-[#2B3A4D] transition-colors"
                    />
                  </div>
                </div>

                {/* Live Stamp Preview */}
                <StampPreview
                  primaryText={primaryText}
                  secondaryText={secondaryText}
                  inkColor={inkColor}
                  frameStyle={frameStyle}
                />

                {/* 3. Ink Color & Frame Style */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="block text-sm font-semibold text-[#2B3A4D] mb-2">
                      4. لون حبر الختم
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {INK_OPTIONS.map((opt) => {
                        const active = inkColor === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setInkColor(opt.id)}
                            className={`inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[44px] sm:min-h-[38px] text-xs sm:text-sm font-medium rounded-lg border transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0 ${
                              active
                                ? 'border-[#2B3A4D] bg-[#F6F8FA] text-[#2B3A4D]'
                                : 'border-[#E2E8F0] bg-white text-[#526277] hover:border-[#94A3B8]'
                            }`}
                          >
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
                              style={{ backgroundColor: opt.swatch }}
                              aria-hidden="true"
                            />
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <span className="block text-sm font-semibold text-[#2B3A4D] mb-2">
                      تنسيق الختم
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {FRAME_OPTIONS.map((opt) => {
                        const active = frameStyle === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setFrameStyle(opt.id)}
                            className={`px-3 py-2 min-h-[44px] sm:min-h-[38px] text-xs sm:text-sm font-medium rounded-lg border transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0 ${
                              active
                                ? 'border-[#2B3A4D] bg-[#2B3A4D] text-white'
                                : 'border-[#E2E8F0] bg-white text-[#526277] hover:border-[#94A3B8]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 4. Quantity, Region & Payment Method */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <span className="block text-sm font-semibold text-[#2B3A4D] mb-1.5">
                      الكمية
                    </span>
                    <div className="inline-flex items-center justify-between w-full border border-[#E2E8F0] rounded-lg bg-white h-[46px] sm:h-[42px] px-1.5 sm:px-2">
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        aria-label="إنقاص الكمية"
                        className="w-11 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-md text-[#2B3A4D] hover:bg-[#F6F8FA] transition-colors cursor-pointer"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="font-semibold text-base text-[#2B3A4D] tabular-nums">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => Math.min(50, q + 1))}
                        aria-label="زيادة الكمية"
                        className="w-11 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-md text-[#2B3A4D] hover:bg-[#F6F8FA] transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="region-select"
                      className="block text-sm font-semibold text-[#2B3A4D] mb-1.5"
                    >
                      المنطقة / المدينة
                    </label>
                    <select
                      id="region-select"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      className="w-full h-[46px] sm:h-[42px] px-3 text-base sm:text-sm bg-white border border-[#E2E8F0] rounded-lg text-[#2B3A4D] focus:outline-none focus:border-[#2B3A4D] focus:ring-1 focus:ring-[#2B3A4D]"
                    >
                      {KSA_REGIONS.map((city) => (
                        <option key={city} value={city}>
                          {city}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <span className="block text-sm font-semibold text-[#2B3A4D] mb-1.5">
                      طريقة الدفع
                    </span>
                    <div className="grid grid-cols-2 gap-1 p-1 bg-[#F6F8FA] border border-[#E2E8F0] rounded-lg h-[46px] sm:h-[42px]">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('cod')}
                        className={`text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                          paymentMethod === 'cod'
                            ? 'bg-white text-[#2B3A4D] border border-[#E2E8F0]'
                            : 'text-[#526277] hover:text-[#2B3A4D]'
                        }`}
                      >
                        عند الاستلام
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('transfer')}
                        className={`text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                          paymentMethod === 'transfer'
                            ? 'bg-white text-[#2B3A4D] border border-[#E2E8F0]'
                            : 'text-[#526277] hover:text-[#2B3A4D]'
                        }`}
                      >
                        تحويل بنكي
                      </button>
                    </div>
                  </div>
                </div>

                {/* Optional Notes */}
                <div>
                  <label
                    htmlFor="order-notes"
                    className="block text-sm font-semibold text-[#2B3A4D] mb-1.5"
                  >
                    ملاحظات إضافية أو تفاصيل شعار (اختياري)
                  </label>
                  <input
                    id="order-notes"
                    type="text"
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    placeholder="مثال: أرغب بإرسال صورة الشعار في محادثة الواتساب"
                    className="w-full min-h-[46px] sm:min-h-[42px] px-3.5 py-2.5 text-base sm:text-sm bg-white border border-[#E2E8F0] rounded-lg text-[#2B3A4D] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2B3A4D] focus:ring-1 focus:ring-[#2B3A4D] transition-colors"
                  />
                </div>

                {/* Primary Order Action -> WhatsApp */}
                <div className="pt-2 space-y-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <a
                      href={whatsappOrderUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-h-[48px] inline-flex items-center justify-center gap-2.5 bg-[#2B3A4D] hover:bg-[#1E293B] text-white font-semibold text-base px-6 py-3.5 rounded-xl transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B3A4D]"
                    >
                      <WhatsAppIcon className="w-5 h-5 text-[#4ADE80]" />
                      <span>اطلب الآن عبر واتساب</span>
                    </a>

                    <button
                      type="button"
                      onClick={handleCopySummary}
                      className="min-h-[48px] inline-flex items-center justify-center gap-2 px-4 py-3.5 border border-[#E2E8F0] hover:border-[#2B3A4D] bg-white text-[#2B3A4D] text-sm font-medium rounded-xl transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 text-[#15803D]" />
                          <span>تم نسخ الطلب</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>نسخ تفاصيل الطلب</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-xs text-[#526277] leading-relaxed">
                    عند الضغط على زر الطلب سيتم تحويلك مباشرة إلى محادثة واتساب
                    الخاصة بالمتجر ({DISPLAY_PHONE}) مع تفاصيل طلبك جاهزة للإرسال.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Features & Craftsmanship */}
        <section
          id="features"
          className="bg-[#F6F8FA] border-y border-[#E2E8F0] py-14 lg:py-20"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-10">
              <h2 className="font-display font-bold text-2xl sm:text-3xl text-[#2B3A4D]">
                لماذا تختار قلم الختم من Stamp pen؟
              </h2>
              <p className="text-base text-[#526277] mt-2 leading-relaxed">
                تصميم معدني يجمع دقة الكتابة اليومية مع جاهزية الختم الرسمي في
                أي مكان.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 space-y-3">
                <div className="w-10 h-10 rounded-lg bg-[#F6F8FA] border border-[#E2E8F0] flex items-center justify-center text-[#2B3A4D]">
                  <PenTool className="w-5 h-5" />
                </div>
                <h3 className="font-display font-semibold text-lg text-[#2B3A4D]">
                  01. كتابة وختم في قلم واحد
                </h3>
                <p className="text-sm text-[#526277] leading-relaxed">
                  آلية فتح سلسة تكشف عن الختم المدمج داخل جسم القلم المعدني،
                  لتوقيع الأوراق والمستندات وختمها في لحظة واحدة دون حمل أختام
                  منفصلة.
                </p>
              </div>

              <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 space-y-3">
                <div className="w-10 h-10 rounded-lg bg-[#F6F8FA] border border-[#E2E8F0] flex items-center justify-center text-[#2B3A4D]">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="font-display font-semibold text-lg text-[#2B3A4D]">
                  02. تخصيص كامل لأي ختم ترغب به
                </h3>
                <p className="text-sm text-[#526277] leading-relaxed">
                  أضف اسمك الثلاثي، مسماك الوظيفي، توقيعك الخاص، اسم مؤسستك،
                  رقم السجل، أو حتى شعاراً مخصصاً بدقة طباعة واضحة وثبات ممتاز.
                </p>
              </div>

              <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 space-y-3">
                <div className="w-10 h-10 rounded-lg bg-[#F6F8FA] border border-[#E2E8F0] flex items-center justify-center text-[#2B3A4D]">
                  <Truck className="w-5 h-5" />
                </div>
                <h3 className="font-display font-semibold text-lg text-[#2B3A4D]">
                  03. توصيل لجميع مناطق المملكة
                </h3>
                <p className="text-sm text-[#526277] leading-relaxed">
                  نشحن طلبك إلى كافة مدن ومناطق المملكة العربية السعودية مع توفر
                  خدمة الدفع عند الاستلام لراحة وأمان كامل عند الشراء.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: How Ordering Works & Shipping / COD Transparency */}
        <section
          id="shipping"
          className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            <div className="lg:col-span-7 space-y-6">
              <div>
                <h2 className="font-display font-bold text-2xl sm:text-3xl text-[#2B3A4D]">
                  خطوات الطلب والتوصيل
                </h2>
                <p className="text-base text-[#526277] mt-2 leading-relaxed">
                  تجربة طلب مباشرة وسريعة عبر واتساب بدون إجراءات معقدة.
                </p>
              </div>

              <div className="divide-y divide-[#E2E8F0] border-y border-[#E2E8F0]">
                <div className="py-5 flex gap-4">
                  <span className="font-display font-bold text-base text-[#2B3A4D] tabular-nums shrink-0">
                    01
                  </span>
                  <div>
                    <h3 className="font-display font-semibold text-base text-[#2B3A4D]">
                      حدد بيانات الختم والكمية
                    </h3>
                    <p className="text-sm text-[#526277] mt-1 leading-relaxed">
                      اكتب النص المطلوب في أداة التخصيص أعلاه، واختر لون الحبر
                      ومدينتك داخل المملكة.
                    </p>
                  </div>
                </div>

                <div className="py-5 flex gap-4">
                  <span className="font-display font-bold text-base text-[#2B3A4D] tabular-nums shrink-0">
                    02
                  </span>
                  <div>
                    <h3 className="font-display font-semibold text-base text-[#2B3A4D]">
                      أرسل الطلب عبر واتساب للتأكيد
                    </h3>
                    <p className="text-sm text-[#526277] mt-1 leading-relaxed">
                      ينقلك زر الطلب تلقائياً إلى محادثة واتساب مع رسالة مجهزة
                      بتفاصيل ختمك، وإذا كان لديك شعار خاص يمكنك إرفاقه مباشرة
                      في المحادثة.
                    </p>
                  </div>
                </div>

                <div className="py-5 flex gap-4">
                  <span className="font-display font-bold text-base text-[#2B3A4D] tabular-nums shrink-0">
                    03
                  </span>
                  <div>
                    <h3 className="font-display font-semibold text-base text-[#2B3A4D]">
                      التجهيز والشحن والدفع عند الاستلام
                    </h3>
                    <p className="text-sm text-[#526277] mt-1 leading-relaxed">
                      بعد تأكيد تكلفة الشحن لمنطقتك، يتم تجهيز القلم وشحنه
                      لبابك مع إمكانية الدفع عند الاستلام.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing & Shipping Clarity Box */}
            <div className="lg:col-span-5 bg-[#F6F8FA] border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 space-y-5">
              <div className="flex items-center gap-2.5 text-[#2B3A4D]">
                <MapPin className="w-5 h-5 shrink-0" />
                <h3 className="font-display font-bold text-xl">
                  تفاصيل التوصيل والدفع
                </h3>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 py-2.5 border-b border-[#E2E8F0]">
                  <span className="text-[#526277]">تخصيص الختم بالطلب</span>
                  <span className="font-semibold text-[#2B3A4D]">
                    متاح لأي نص أو شعار
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 py-2.5 border-b border-[#E2E8F0]">
                  <span className="text-[#526277]">نطاق التوصيل</span>
                  <span className="font-semibold text-[#2B3A4D]">
                    جميع مناطق المملكة
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 py-2.5 border-b border-[#E2E8F0]">
                  <span className="text-[#526277]">رسوم الشحن</span>
                  <span className="font-semibold text-[#2B3A4D]">
                    تُحدد حسب المنطقة (غير مشمولة)
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span className="text-[#526277]">الدفع عند الاستلام</span>
                  <span className="font-semibold text-[#2B3A4D]">متوفر</span>
                </div>
              </div>

              <a
                href={whatsappOrderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 bg-[#2B3A4D] hover:bg-[#1E293B] text-white font-semibold text-sm px-5 py-3 rounded-xl transition-colors duration-150"
              >
                <WhatsAppIcon className="w-4 h-4 text-[#4ADE80]" />
                <span>تأكيد الطلب ومعرفة رسوم الشحن عبر واتساب</span>
              </a>
            </div>
          </div>
        </section>

        {/* Section 4: Social Accounts & Contact */}
        <section
          id="contact"
          className="bg-[#2B3A4D] text-white py-12 sm:py-14 lg:py-16"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center">
              <div className="lg:col-span-6 space-y-2">
                <h2 className="font-display font-bold text-2xl sm:text-3xl text-white tracking-wide">
                  للطلب والاستفسار تواصل معنا عبر حساباتنا
                </h2>
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                  فريقنا جاهز لاستقبال طلباتكم وتصاميم الأختام الخاصة بكم
                  يومياً عبر واتساب وحسابات التواصل الاجتماعي.
                </p>
              </div>

              <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-3.5">
                <a
                  href={whatsappDirectInquiryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white/10 hover:bg-white/15 border border-white/15 rounded-xl p-4 min-h-[56px] flex flex-row sm:flex-col items-center sm:items-stretch justify-between gap-3 transition-colors duration-150"
                >
                  <div className="flex items-center gap-2.5 sm:justify-between">
                    <WhatsAppIcon className="w-5 h-5 text-[#4ADE80] sm:order-2" />
                    <span className="text-sm sm:text-xs font-medium text-slate-200 sm:order-1">
                      واتساب
                    </span>
                  </div>
                  <span
                    dir="ltr"
                    className="font-semibold text-sm text-white text-right tabular-nums"
                  >
                    {DISPLAY_PHONE}
                  </span>
                </a>

                <a
                  href="https://www.instagram.com/stamp.pen"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white/10 hover:bg-white/15 border border-white/15 rounded-xl p-4 min-h-[56px] flex flex-row sm:flex-col items-center sm:items-stretch justify-between gap-3 transition-colors duration-150"
                >
                  <div className="flex items-center gap-2.5 sm:justify-between">
                    <InstagramIcon className="w-5 h-5 text-white sm:order-2" />
                    <span className="text-sm sm:text-xs font-medium text-slate-200 sm:order-1">
                      إنستغرام
                    </span>
                  </div>
                  <span
                    dir="ltr"
                    className="font-semibold text-sm text-white text-right"
                  >
                    @stamp.pen
                  </span>
                </a>

                <a
                  href="https://www.tiktok.com/@stamp.pen"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white/10 hover:bg-white/15 border border-white/15 rounded-xl p-4 min-h-[56px] flex flex-row sm:flex-col items-center sm:items-stretch justify-between gap-3 transition-colors duration-150"
                >
                  <div className="flex items-center gap-2.5 sm:justify-between">
                    <TikTokIcon className="w-5 h-5 text-white sm:order-2" />
                    <span className="text-sm sm:text-xs font-medium text-slate-200 sm:order-1">
                      تيك توك
                    </span>
                  </div>
                  <span
                    dir="ltr"
                    className="font-semibold text-sm text-white text-right"
                  >
                    @stamp.pen
                  </span>
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Clean Minimal Footer */}
      <footer className="bg-white border-t border-[#E2E8F0] py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {!logoImgError && (
              <img
                src={LOGO_IMAGE_SRC}
                alt="Stamp pen"
                referrerPolicy="no-referrer"
                onError={() => setLogoImgError(true)}
                className="w-8 h-8 object-contain"
              />
            )}
            <span className="font-display font-bold text-base text-[#2B3A4D]">
              Stamp pen
            </span>
          </div>

          <p className="text-xs sm:text-sm text-[#526277] text-center">
            أناقتك تبدأ بتوقيعك · التوصيل لجميع مناطق المملكة والدفع عند
            الاستلام
          </p>
        </div>
      </footer>

      {/* Mobile Compact Sticky Bottom Order Bar (< 15% mobile viewport height + safe-area) */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-sm border-t border-[#E2E8F0] px-4 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-bold text-[#2B3A4D] tabular-nums truncate">
            {quantity > 1 ? `الإجمالي: ${subtotal} ريال` : 'قلم الختم الشخصي'}
          </div>
          <div className="text-[11px] text-[#526277] truncate">
            {activePenColorConfig.label} · {region}
          </div>
        </div>
        <a
          href={whatsappOrderUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-[#2B3A4D] hover:bg-[#1E293B] text-white text-sm font-semibold px-4 py-2.5 min-h-[44px] rounded-lg whitespace-nowrap shrink-0"
        >
          <WhatsAppIcon className="w-4 h-4 text-[#4ADE80]" />
          <span>اطلب واتساب</span>
        </a>
      </div>
    </div>
  );
}
