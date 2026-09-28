'use client';

import React from 'react';
import { Skeleton } from './Skeleton';

export function IdeaCardSkeleton() {
  return (
    <div className="rounded-radius border border-line bg-card p-6 flex flex-col justify-between space-y-5">
      <div className="space-y-4">
        {/* Domain & Difficulty Badges */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Skeleton variant="pill" className="w-20 h-5" />
            <Skeleton variant="pill" className="w-24 h-5" />
          </div>
          <Skeleton variant="text" className="w-16 h-4" />
        </div>

        {/* Title */}
        <div className="space-y-2 pt-1">
          <Skeleton variant="text" className="w-4/5 h-6" />
          <Skeleton variant="text" className="w-2/3 h-5" />
        </div>

        {/* Tagline */}
        <div className="space-y-1.5 pt-1">
          <Skeleton variant="text" className="w-full h-4" />
          <Skeleton variant="text" className="w-11/12 h-4" />
          <Skeleton variant="text" className="w-3/4 h-4" />
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 pt-2">
          <Skeleton variant="pill" className="w-14 h-5" />
          <Skeleton variant="pill" className="w-16 h-5" />
          <Skeleton variant="pill" className="w-20 h-5" />
          <Skeleton variant="pill" className="w-16 h-5" />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-line/60">
        <Skeleton variant="text" className="w-24 h-4" />
        <Skeleton variant="rectangular" className="w-28 h-8 rounded-radius" />
      </div>
    </div>
  );
}

export function IdeaGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5" aria-label="Loading problems...">
      {Array.from({ length: count }).map((_, idx) => (
        <IdeaCardSkeleton key={idx} />
      ))}
    </div>
  );
}
