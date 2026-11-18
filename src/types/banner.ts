export type BannerTheme = 'navy' | 'slate' | 'emerald' | 'amber';
export type BannerCtaTarget = 'none' | 'customize' | 'shipping' | 'contact' | 'whatsapp';

export interface BannerConfig {
  isActive: boolean;
  text: string;
  ctaLabel: string;
  ctaTarget: BannerCtaTarget;
  theme: BannerTheme;
  dismissible: boolean;
  updatedAt?: unknown;
  updatedBy?: string;
}

export const DEFAULT_BANNER_CONFIG: BannerConfig = {
  isActive: false,
  text: 'توصيل لجميع مناطق المملكة والدفع عند الاستلام — خصص ختمك الآن بـ 70 ريال فقط',
  ctaLabel: 'خصص ختمك',
  ctaTarget: 'customize',
  theme: 'navy',
  dismissible: true,
};
