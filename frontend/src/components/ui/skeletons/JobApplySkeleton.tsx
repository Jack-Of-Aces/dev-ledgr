'use client';

import React from 'react';
import { Skeleton } from './Skeleton';

export function JobApplySkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 md:py-16 space-y-8" aria-label="Loading application scrutiny harness...">
      {/* Back button */}
      <div>
        <Skeleton variant="pill" className="w-40 h-5" />
      </div>

      {/* Target Job Header Card */}
      <div className="rounded-radius border border-line bg-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton variant="text" className="w-32 h-4" />
            <Skeleton variant="text" className="w-64 h-7" />
          </div>
          <Skeleton variant="pill" className="w-28 h-8" />
        </div>
        <Skeleton variant="text" className="w-full h-4" />
      </div>

      {/* Scrutiny Action / Terminal Box */}
      <div className="rounded-radius border border-line bg-card p-6 space-y-6">
        <div className="space-y-2">
          <Skeleton variant="text" className="w-48 h-6" />
          <Skeleton variant="text" className="w-3/4 h-4" />
        </div>

        <div className="rounded-radius border border-line bg-ink-0 p-5 space-y-3 font-mono">
          <div className="flex items-center gap-2">
            <Skeleton variant="circular" className="w-2 h-2" />
            <Skeleton variant="text" className="w-64 h-4" />
          </div>
          <Skeleton variant="text" className="w-4/5 h-4" />
          <Skeleton variant="text" className="w-3/5 h-4" />
        </div>

        <div className="flex items-center gap-3">
          <Skeleton variant="rectangular" className="w-48 h-10 rounded-radius" />
          <Skeleton variant="rectangular" className="w-32 h-10 rounded-radius" />
        </div>
      </div>
    </div>
  );
}
