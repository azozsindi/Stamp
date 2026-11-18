import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('Application error caught by boundary:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F6F8FA] text-[#2B3A4D] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-[#E2E8F0] rounded-2xl p-6 text-center space-y-4">
            <h1 className="font-display font-bold text-xl text-[#2B3A4D]">
              حدث خطأ غير متوقع
            </h1>
            <p className="text-sm text-[#526277] leading-relaxed">
              تعذر تحميل الصفحة أو تنفيذ العملية المطلوبة. يرجى تحديث الصفحة
              والمحاولة مرة أخرى.
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false });
                window.location.hash = '';
                window.location.reload();
              }}
              className="inline-flex items-center justify-center px-5 py-2.5 min-h-[44px] rounded-xl bg-[#2B3A4D] text-white text-sm font-semibold hover:bg-[#1E293B] transition-colors cursor-pointer"
            >
              تحديث الصفحة
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
