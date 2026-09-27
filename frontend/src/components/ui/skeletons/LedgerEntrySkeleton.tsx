'use client';

import React from 'react';
import { Skeleton } from './Skeleton';

export function LedgerEntrySkeleton() {
  return (
    <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line last:border-b-0 bg-card/20">
      <div className="space-y-2 flex-1">
        {/* Hash & Status */}
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton variant="pill" className="w-20 h-5" />
          <Skeleton variant="pill" className="w-28 h-5" />
          <Skeleton variant="text" className="w-24 h-4" />
        </div>

        {/* Title */}
        <Skeleton variant="text" className="w-3/4 sm:w-1/2 h-5" />

        {/* Author & Telemetry Metrics */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <div className="flex items-center gap-2">
            <Skeleton variant="circular" className="w-5 h-5" />
            <Skeleton variant="text" className="w-24 h-4" />
          </div>
          <span className="text-line">·</span>
          <Skeleton variant="text" className="w-20 h-4" />
          <Skeleton variant="text" className="w-24 h-4" />
          <Skeleton variant="text" className="w-16 h-4" />
        </div>
      </div>

      {/* Action button */}
      <div className="shrink-0 flex items-center gap-2 self-start md:self-center">
        <Skeleton variant="rectangular" className="w-28 h-9 rounded-radius" />
      </div>
    </div>
  );
}

export function LedgerFeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="rounded-radius border border-line bg-card/30 overflow-hidden divide-y divide-line" aria-label="Loading verified ledger feed...">
      {Array.from({ length: count }).map((_, idx) => (
        <LedgerEntrySkeleton key={idx} />
      ))}
    </div>
  );
}
