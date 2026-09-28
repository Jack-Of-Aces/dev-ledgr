'use client';

import React from 'react';
import { Skeleton } from './Skeleton';
import { LedgerFeedSkeleton } from './LedgerEntrySkeleton';

export function DashboardSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-12 space-y-8" aria-label="Loading dashboard...">
      {/* Profile Banner */}
      <div className="rounded-radius border border-line bg-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Skeleton variant="circular" className="w-16 h-16 sm:w-20 sm:h-20" />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton variant="text" className="w-40 h-6" />
              <Skeleton variant="pill" className="w-24 h-5" />
            </div>
            <Skeleton variant="text" className="w-64 h-4" />
            <Skeleton variant="text" className="w-48 h-4" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Skeleton variant="rectangular" className="w-36 h-9 rounded-radius" />
          <Skeleton variant="rectangular" className="w-32 h-9 rounded-radius" />
        </div>
      </div>

      {/* Telemetry Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="p-4 rounded-radius border border-line bg-card space-y-2">
            <Skeleton variant="text" className="w-20 h-4" />
            <Skeleton variant="text" className="w-16 h-7" />
            <Skeleton variant="text" className="w-28 h-3" />
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-line pb-2">
        <Skeleton variant="pill" className="w-28 h-8" />
        <Skeleton variant="pill" className="w-32 h-8" />
        <Skeleton variant="pill" className="w-28 h-8" />
        <Skeleton variant="pill" className="w-24 h-8" />
      </div>

      {/* Content Feed */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Skeleton variant="rectangular" className="w-64 h-9 rounded-radius" />
          <Skeleton variant="rectangular" className="w-36 h-9 rounded-radius" />
        </div>
        <LedgerFeedSkeleton count={3} />
      </div>
    </div>
  );
}
