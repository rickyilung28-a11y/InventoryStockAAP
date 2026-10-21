import React, { useEffect } from 'react';
import { CheckCircle2, Info, AlertTriangle, X, Volume2, ArrowRight } from 'lucide-react';

interface ToastProps {
  toast: {
    id: string;
    type: 'success' | 'info' | 'warning' | 'error';
    title: string;
    message: string;
    voucherNumber?: string;
  } | null;
  onDismiss: () => void;
  onViewVoucher?: (voucherNumber: string) => void;
}

export const ToastNotification: React.FC<ToastProps> = ({
  toast,
  onDismiss,
  onViewVoucher,
}) => {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 9000); // 9 seconds dwell for real-time awareness
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  const isSuccess = toast.type === 'success';
  const isWarning = toast.type === 'warning';

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-md w-full animate-in slide-in-from-bottom-5 duration-200">
      <div
        className={`rounded-xl border p-4 shadow-xl backdrop-blur-md ${
          isSuccess
            ? 'bg-emerald-950/95 border-emerald-500/40 text-white'
            : isWarning
            ? 'bg-amber-950/95 border-amber-500/40 text-white'
            : 'bg-slate-900/95 border-slate-700 text-white'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5">
            {isSuccess ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : isWarning ? (
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            ) : (
              <Info className="w-5 h-5 text-sky-400" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono tracking-wider uppercase text-emerald-400 font-semibold flex items-center gap-1">
                <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                NOTIFIKASI REAL-TIME
              </span>
            </div>
            <h4 className="text-sm font-semibold text-white mt-0.5">{toast.title}</h4>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">{toast.message}</p>

            {toast.voucherNumber && onViewVoucher && (
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => {
                    onViewVoucher(toast.voucherNumber!);
                    onDismiss();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/15 hover:bg-white/25 rounded-md text-xs font-medium text-white transition-colors"
                >
                  <span>Buka Dokumen {toast.voucherNumber}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <button
            onClick={onDismiss}
            className="shrink-0 p-1 text-slate-400 hover:text-white rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
