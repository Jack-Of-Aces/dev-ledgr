import React from 'react';
import { Skeleton, JobGridSkeleton } from '@/components/ui/skeletons';

export default function JobsLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 md:py-16 space-y-10">
      {/* Header */}
      <div className="space-y-3">
        <Skeleton variant="text" className="w-56 h-10" />
        <Skeleton variant="text" className="w-full max-w-xl h-5" />
      </div>

      {/* Match summary skeleton */}
      <Skeleton variant="rectangular" className="w-full h-16 rounded-radius" />

      {/* Jobs grid */}
      <JobGridSkeleton count={4} />
    </div>
  );
}
