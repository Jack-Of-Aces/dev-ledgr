import React from 'react';

export default function AccessDeniedLoading() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-lg w-full rounded-radius border border-line bg-card p-6 sm:p-8 text-center space-y-6 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-line mx-auto skeleton-shimmer" />
        <div className="space-y-2">
          <div className="h-4 w-32 bg-line rounded mx-auto skeleton-shimmer" />
          <div className="h-8 w-64 bg-line rounded mx-auto skeleton-shimmer" />
          <div className="h-12 w-full bg-line rounded skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}
