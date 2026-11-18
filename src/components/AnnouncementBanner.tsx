import React from 'react';
import { X } from 'lucide-react';
import { BannerConfig, BannerCtaTarget, BannerTheme } from '../types/banner';

interface AnnouncementBannerProps {
  banner: BannerConfig;
  whatsappUrl: string;
  onDismiss?: () => void;
  isPreview?: boolean;
}

const THEME_CLASSES: Record<
  BannerTheme,
  { wrapper: string; link: string; close: string }
> = {
  navy: {
    wrapper: 'bg-[#2B3A4D] text-white border-b border-[#1E293B]',
    link: 'text-white underline decoration-white/60 hover:decoration-white',
    close: 'text-slate-300 hover:text-white hover:bg-white/10',
  },
  slate: {
    wrapper: 'bg-[#F6F8FA] text-[#2B3A4D] border-b border-[#E2E8F0]',
    link: 'text-[#2B3A4D] underline decoration-[#2B3A4D]/50 hover:decoration-[#2B3A4D]',
    close: 'text-[#526277] hover:text-[#2B3A4D] hover:bg-black/5',
  },
  emerald: {
    wrapper: 'bg-[#14532D] text-white border-b border-[#0F3F22]',
    link: 'text-white underline decoration-white/60 hover:decoration-white',
    close: 'text-emerald-200 hover:text-white hover:bg-white/10',
  },
  amber: {
    wrapper: 'bg-[#92400E] text-white border-b border-[#78350F]',
    link: 'text-white underline decoration-white/60 hover:decoration-white',
    close: 'text-amber-200 hover:text-white hover:bg-white/10',
  },
};

function resolveCtaHref(target: BannerCtaTarget, whatsappUrl: string): string | null {
  switch (target) {
    case 'customize':
      return '#customize';
    case 'shipping':
      return '#shipping';
    case 'contact':
      return '#contact';
    case 'whatsapp':
      return whatsappUrl;
    default:
      return null;
  }
}

export function AnnouncementBanner({
  banner,
  whatsappUrl,
  onDismiss,
  isPreview = false,
}: AnnouncementBannerProps) {
  const styles = THEME_CLASSES[banner.theme] ?? THEME_CLASSES.navy;
  const href = resolveCtaHref(banner.ctaTarget, whatsappUrl);
  const showCta = Boolean(href && banner.ctaLabel.trim());

  return (
    <div
      role="region"
      aria-label="إعلان المتجر"
      className={`${styles.wrapper} px-3 sm:px-6 py-2 min-h-[40px] flex items-center justify-center relative`}
    >
      <div className="max-w-6xl w-full mx-auto flex items-center justify-center gap-x-3 gap-y-1 flex-wrap text-center pl-7 pr-7 sm:pl-8 sm:pr-8">
        <p className="text-xs sm:text-sm font-medium leading-snug">
          {banner.text}
        </p>

        {showCta && href && (
          isPreview ? (
            <span
              className={`text-xs sm:text-sm font-semibold underline-offset-4 whitespace-nowrap shrink-0 ${styles.link}`}
            >
              {banner.ctaLabel}
            </span>
          ) : (
            <a
              href={href}
              target={banner.ctaTarget === 'whatsapp' ? '_blank' : undefined}
              rel={banner.ctaTarget === 'whatsapp' ? 'noopener noreferrer' : undefined}
              className={`text-xs sm:text-sm font-semibold underline-offset-4 whitespace-nowrap shrink-0 ${styles.link}`}
            >
              {banner.ctaLabel}
            </a>
          )
        )}
      </div>

      {banner.dismissible && onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="إغلاق الإعلان"
          className={`absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-md transition-colors cursor-pointer ${styles.close}`}
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
