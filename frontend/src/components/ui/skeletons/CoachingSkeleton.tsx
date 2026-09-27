'use client';

import React from 'react';
import { Skeleton } from './Skeleton';

export function CoachingSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-12 space-y-8" aria-label="Loading coaching curriculum...">
      {/* Header */}
      <section className="space-y-4 pb-6 border-b border-line">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton variant="pill" className="w-56 h-5" />
          <Skeleton variant="pill" className="w-40 h-5" />
        </div>
        <div className="space-y-2">
          <Skeleton variant="text" className="w-80 h-9" />
          <Skeleton variant="text" className="w-2/3 h-5" />
        </div>
      </section>

      {/* Progress & Milestone Overview */}
      <div className="rounded-radius border border-line bg-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <Skeleton variant="text" className="w-48 h-5" />
            <Skeleton variant="text" className="w-64 h-4" />
          </div>
          <Skeleton variant="pill" className="w-20 h-7" />
        </div>
        <Skeleton variant="rectangular" className="w-full h-3 rounded-full" />
      </div>

      {/* Curriculum Tracks */}
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="rounded-radius border border-line bg-card p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-2">
                <Skeleton variant="pill" className="w-36 h-5" />
                <Skeleton variant="text" className="w-72 h-6" />
                <Skeleton variant="text" className="w-96 h-4" />
              </div>
              <Skeleton variant="rectangular" className="w-32 h-9 rounded-radius" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3">
              {Array.from({ length: 4 }).map((_, mIdx) => (
                <div key={mIdx} className="p-3 rounded border border-line bg-ink-0/40 space-y-2">
                  <Skeleton variant="pill" className="w-16 h-4" />
                  <Skeleton variant="text" className="w-full h-4" />
                  <Skeleton variant="text" className="w-4/5 h-3" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
