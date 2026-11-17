import React from 'react';

export type InkColorId = 'black' | 'blue';
export type StampFrameStyle = 'bordered' | 'clean' | 'signature';

interface StampPreviewProps {
  primaryText: string;
  secondaryText: string;
  inkColor: InkColorId;
  frameStyle: StampFrameStyle;
}

const INK_HEX: Record<InkColorId, { hex: string; label: string }> = {
  black: { hex: '#18181B', label: 'أسود' },
  blue: { hex: '#1D4ED8', label: 'أزرق' },
};

export function StampPreview({
  primaryText,
  secondaryText,
  inkColor,
  frameStyle,
}: StampPreviewProps) {
  const color = INK_HEX[inkColor];
  const displayPrimary = primaryText.trim();
  const displaySecondary = secondaryText.trim();
  const hasContent = Boolean(displayPrimary || displaySecondary);

  return (
    <div className="bg-[#F6F8FA] border border-[#E2E8F0] rounded-xl p-4 sm:p-5">
      <div className="flex items-center justify-between text-xs text-[#526277] mb-3">
        <span className="font-medium text-[#2B3A4D]">معاينة شكل الختم على الورق</span>
        <span>حبر: {color.label}</span>
      </div>

      {/* Tactile Paper Surface */}
      <div
        className="bg-white border border-[#E2E8F0] rounded-lg min-h-[104px] px-5 py-4 flex items-center justify-center relative overflow-hidden"
        aria-label="معاينة الختم"
      >
        {hasContent ? (
          <div
            className={`inline-flex flex-col items-center justify-center text-center transition-colors duration-200 ${
              frameStyle === 'bordered'
                ? 'border-2 px-5 py-2.5 rounded-md'
                : frameStyle === 'signature'
                ? 'px-4 py-1.5'
                : 'px-4 py-2'
            }`}
            style={{
              color: color.hex,
              borderColor: frameStyle === 'bordered' ? color.hex : 'transparent',
              opacity: 0.92,
            }}
          >
            {displayPrimary && (
              <span className="font-display font-bold text-base sm:text-lg leading-snug tracking-normal">
                {displayPrimary}
              </span>
            )}
            {displaySecondary && (
              <span className="text-xs sm:text-sm font-medium mt-0.5 opacity-90">
                {displaySecondary}
              </span>
            )}
            {frameStyle === 'signature' && (
              <span
                className="mt-2 w-28 border-b border-dashed opacity-70"
                style={{ borderColor: color.hex }}
              />
            )}
          </div>
        ) : (
          <span className="text-xs sm:text-sm text-[#94A3B8] select-none">
            اكتب النص في الحقول أعلاه لمعاينة الختم
          </span>
        )}
      </div>

      <p className="text-xs text-[#526277] mt-2.5 leading-relaxed">
        معاينة تقريبية — يمكن إضافة أي اسم، منصب، رقم سجل، أو شعار ترغب به عند تأكيد الطلب في واتساب.
      </p>
    </div>
  );
}
