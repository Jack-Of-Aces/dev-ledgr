'use client';

import React from 'react';
import { Skeleton } from './Skeleton';

export function JobCardSkeleton() {
  return (
    <div className="rounded-radius border border-line bg-card p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton variant="pill" className="w-24 h-4" />
            <Skeleton variant="text" className="w-20 h-4" />
          </div>
          <Skeleton variant="text" className="w-64 h-6" />
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
          <div className="space-y-1 text-right">
            <Skeleton variant="text" className="w-20 h-5 ml-auto" />
            <Skeleton variant="text" className="w-24 h-4 ml-auto" />
          </div>
          <Skeleton variant="rectangular" className="w-36 h-9 rounded-radius" />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2 py-1">
        <Skeleton variant="text" className="w-full h-4" />
        <Skeleton variant="text" className="w-11/12 h-4" />
        <Skeleton variant="text" className="w-3/4 h-4" />
      </div>

      {/* Required Proofs & Skills */}
      <div className="space-y-2 pt-2">
        <Skeleton variant="text" className="w-32 h-4" />
        <div className="flex flex-wrap gap-2">
          <Skeleton variant="pill" className="w-28 h-6" />
          <Skeleton variant="pill" className="w-32 h-6" />
          <Skeleton variant="pill" className="w-24 h-6" />
        </div>
      </div>
    </div>
  );
}

export function JobGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4" aria-label="Loading opportunities...">
      {Array.from({ length: count }).map((_, idx) => (
        <JobCardSkeleton key={idx} />
      ))}
    </div>
  );
}
