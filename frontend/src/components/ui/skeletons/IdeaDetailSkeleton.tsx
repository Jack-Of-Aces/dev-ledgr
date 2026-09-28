'use client';

import React from 'react';
import { Skeleton } from './Skeleton';

export function IdeaDetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 md:py-16 space-y-10" aria-label="Loading problem specification...">
      {/* Navigation Breadcrumb */}
      <div>
        <Skeleton variant="pill" className="w-36 h-5" />
      </div>

      {/* Hero Overview */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton variant="pill" className="w-24 h-6" />
          <Skeleton variant="pill" className="w-28 h-6" />
          <Skeleton variant="text" className="w-32 h-5" />
        </div>

        <div className="space-y-2">
          <Skeleton variant="text" className="w-4/5 h-9" />
          <Skeleton variant="text" className="w-3/5 h-8" />
        </div>

        <div className="space-y-1.5 pt-1">
          <Skeleton variant="text" className="w-full h-5" />
          <Skeleton variant="text" className="w-10/12 h-5" />
        </div>

        {/* Action bar */}
        <div className="pt-2 flex flex-wrap items-center gap-3">
          <Skeleton variant="rectangular" className="w-44 h-10 rounded-radius" />
          <Skeleton variant="rectangular" className="w-36 h-10 rounded-radius" />
        </div>
      </section>

      {/* Origin Story Context */}
      <section className="pl-4 border-l-2 border-line space-y-2 my-6">
        <Skeleton variant="text" className="w-36 h-4" />
        <Skeleton variant="text" className="w-11/12 h-5" />
        <Skeleton variant="text" className="w-9/12 h-5" />
      </section>

      {/* Technical Problem Brief */}
      <section className="space-y-3">
        <Skeleton variant="text" className="w-64 h-7" />
        <div className="space-y-2">
          <Skeleton variant="text" className="w-full h-4" />
          <Skeleton variant="text" className="w-11/12 h-4" />
          <Skeleton variant="text" className="w-4/5 h-4" />
        </div>
      </section>

      {/* Technical Requirements Checklist */}
      <section className="space-y-3">
        <Skeleton variant="text" className="w-56 h-6" />
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <Skeleton variant="circular" className="w-4 h-4" />
            <Skeleton variant="text" className="w-5/6 h-4" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton variant="circular" className="w-4 h-4" />
            <Skeleton variant="text" className="w-4/6 h-4" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton variant="circular" className="w-4 h-4" />
            <Skeleton variant="text" className="w-5/6 h-4" />
          </div>
        </div>
      </section>

      {/* Mock Terminal Explorer */}
      <div className="rounded-radius border border-line bg-card overflow-hidden space-y-0">
        <div className="px-4 py-3 border-b border-line bg-ink-0 flex items-center justify-between">
          <Skeleton variant="text" className="w-48 h-5" />
          <Skeleton variant="pill" className="w-24 h-5" />
        </div>
        <div className="p-5 space-y-4">
          <Skeleton variant="text" className="w-full h-12 rounded" />
          <Skeleton variant="rectangular" className="w-full h-36 rounded" />
        </div>
      </div>
    </div>
  );
}
