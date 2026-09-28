import React from 'react';

export default function OnboardingLoading() {
  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-3xl rounded-radius border border-line bg-card p-6 sm:p-10 space-y-8 shadow-sm">
        <div className="flex items-center justify-between pb-6 border-b border-line">
          <div className="space-y-2">
            <div className="h-4 w-32 bg-line rounded skeleton-shimmer" />
            <div className="h-7 w-64 bg-line rounded skeleton-shimmer" />
          </div>
          <div className="h-8 w-24 bg-line rounded-full skeleton-shimmer" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 rounded border border-line bg-ink-0/60 space-y-3">
              <div className="h-5 w-3/4 bg-line rounded skeleton-shimmer" />
              <div className="h-4 w-full bg-line rounded skeleton-shimmer" />
              <div className="h-4 w-1/2 bg-line rounded skeleton-shimmer" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
