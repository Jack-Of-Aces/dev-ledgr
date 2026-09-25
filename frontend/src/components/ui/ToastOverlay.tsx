'use client';

import React, { useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { ShieldCheck, X } from 'lucide-react';
import Link from 'next/link';

export const ToastOverlay: React.FC = () => {
  const { activeToast, clearToast, user } = useAppStore();

  useEffect(() => {
    if (activeToast) {
      const timer = setTimeout(() => {
        clearToast();
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [activeToast, clearToast]);

  if (!activeToast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 max-w-md w-full p-4 bg-card border border-brass rounded-radius shadow-2xl transition-all animate-in fade-in duration-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-1 rounded bg-diff-green/15 border border-diff-green/30 mt-0.5">
            <ShieldCheck className="w-5 h-5 text-diff-green" aria-hidden="true" />
          </div>
          <div>
            <div className="font-mono text-[13px] font-semibold text-text-0 flex items-center gap-2">
              {activeToast.title}
              {activeToast.hash && (
                <span className="text-[11px] font-mono text-diff-green bg-diff-green/10 px-1.5 py-0.5 rounded border border-diff-green/20">
                  verified ✓
                </span>
              )}
            </div>
            <div className="font-mono text-[12px] text-text-1 mt-1 leading-relaxed">
              {activeToast.message}
            </div>
            {activeToast.hash && (
              <div className="mt-2 flex items-center gap-2 font-mono text-[11px]">
                <Link
                  href={`/p/${user.username}`}
                  className="text-brass hover:underline inline-flex items-center gap-1 font-semibold"
                >
                  View in Public Portfolio →
                </Link>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={clearToast}
          aria-label="Dismiss notification"
          className="text-text-1 hover:text-text-0 p-1 rounded transition-colors"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
