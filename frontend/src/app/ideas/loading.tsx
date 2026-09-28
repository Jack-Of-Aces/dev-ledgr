import React from 'react';
import { Skeleton, IdeaGridSkeleton } from '@/components/ui/skeletons';

export default function IdeasLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 md:py-16 space-y-10">
      {/* Header */}
      <div className="space-y-3">
        <Skeleton variant="text" className="w-56 h-10" />
        <Skeleton variant="text" className="w-full max-w-xl h-5" />
      </div>

      <hr className="rule my-2" />

      {/* Search & Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <Skeleton variant="rectangular" className="w-full sm:w-80 h-10 rounded-radius" />
        <div className="flex items-center gap-2">
          <Skeleton variant="pill" className="w-24 h-8" />
          <Skeleton variant="pill" className="w-24 h-8" />
          <Skeleton variant="pill" className="w-24 h-8" />
        </div>
      </div>

      {/* Grid */}
      <IdeaGridSkeleton count={6} />
    </div>
  );
}
