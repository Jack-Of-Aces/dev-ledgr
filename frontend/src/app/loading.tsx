import React from 'react';
import { Skeleton, LedgerFeedSkeleton } from '@/components/ui/skeletons';

export default function RootLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 md:py-16 space-y-16" aria-label="Loading DevLedgr...">
      {/* Hero skeleton */}
      <section className="space-y-6 max-w-3xl">
        <Skeleton variant="pill" className="w-48 h-6" />
        <div className="space-y-3">
          <Skeleton variant="text" className="w-full h-12 sm:h-16" />
          <Skeleton variant="text" className="w-4/5 h-12 sm:h-16" />
        </div>
        <Skeleton variant="text" className="w-2/3 h-6" />
        <div className="flex items-center gap-3 pt-2">
          <Skeleton variant="rectangular" className="w-36 h-11 rounded-radius" />
          <Skeleton variant="rectangular" className="w-36 h-11 rounded-radius" />
        </div>
      </section>

      {/* Live ledger feed skeleton */}
      <section className="space-y-6">
        <div className="space-y-2">
          <Skeleton variant="text" className="w-64 h-7" />
          <Skeleton variant="text" className="w-80 h-4" />
        </div>
        <LedgerFeedSkeleton count={3} />
      </section>
    </div>
  );
}
