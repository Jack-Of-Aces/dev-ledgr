'use client';

import React from 'react';
import { Skeleton } from './Skeleton';

export function PortfolioSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 md:py-16 space-y-10" aria-label="Loading public portfolio...">
      {/* Top Banner & Seal */}
      <div className="rounded-radius border border-line bg-card p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-line">
          <div className="flex items-center gap-4">
            <Skeleton variant="circular" className="w-16 h-16 sm:w-20 sm:h-20" />
            <div className="space-y-2">
              <Skeleton variant="text" className="w-48 h-7" />
              <Skeleton variant="text" className="w-64 h-4" />
              <Skeleton variant="pill" className="w-32 h-5" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton variant="rectangular" className="w-28 h-9 rounded-radius" />
            <Skeleton variant="rectangular" className="w-24 h-9 rounded-radius" />
          </div>
        </div>

        {/* Bio */}
        <div className="space-y-2">
          <Skeleton variant="text" className="w-full h-4" />
          <Skeleton variant="text" className="w-5/6 h-4" />
        </div>

        {/* Stated Skills */}
        <div className="flex flex-wrap gap-2 pt-2">
          <Skeleton variant="pill" className="w-16 h-6" />
          <Skeleton variant="pill" className="w-20 h-6" />
          <Skeleton variant="pill" className="w-24 h-6" />
          <Skeleton variant="pill" className="w-16 h-6" />
          <Skeleton variant="pill" className="w-20 h-6" />
        </div>
      </div>

      {/* Telemetry Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="p-4 rounded-radius border border-line bg-card space-y-2">
            <Skeleton variant="text" className="w-20 h-3" />
            <Skeleton variant="text" className="w-16 h-6" />
          </div>
        ))}
      </div>

      {/* Verified Commit History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton variant="text" className="w-48 h-6" />
          <Skeleton variant="text" className="w-24 h-4" />
        </div>

        <div className="rounded-radius border border-line bg-card overflow-hidden divide-y divide-line">
          {Array.from({ length: 2 }).map((_, idx) => (
            <div key={idx} className="p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Skeleton variant="pill" className="w-20 h-5" />
                    <Skeleton variant="text" className="w-32 h-4" />
                  </div>
                  <Skeleton variant="text" className="w-64 h-5" />
                </div>
                <Skeleton variant="rectangular" className="w-28 h-8 rounded-radius" />
              </div>
              <Skeleton variant="rectangular" className="w-full h-24 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
