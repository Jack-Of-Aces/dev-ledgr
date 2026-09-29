'use client';

import React from 'react';
import { Skeleton } from './Skeleton';

export function AdminSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 md:py-16 space-y-10" aria-label="Loading admin dashboard...">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div className="space-y-2">
          <Skeleton variant="text" className="w-64 h-8" />
          <Skeleton variant="text" className="w-80 h-4" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton variant="pill" className="w-28 h-8" />
          <Skeleton variant="pill" className="w-24 h-8" />
          <Skeleton variant="rectangular" className="w-36 h-9 rounded-radius" />
        </div>
      </div>

      {/* Submissions queue skeleton */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="rounded-radius border border-line bg-card p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-line">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Skeleton variant="pill" className="w-20 h-5" />
                  <Skeleton variant="pill" className="w-24 h-5" />
                  <Skeleton variant="text" className="w-28 h-4" />
                </div>
                <Skeleton variant="text" className="w-64 h-6" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton variant="rectangular" className="w-28 h-8 rounded-radius" />
                <Skeleton variant="rectangular" className="w-20 h-8 rounded-radius" />
              </div>
            </div>
            <Skeleton variant="text" className="w-full h-4" />
            <Skeleton variant="text" className="w-3/4 h-4" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 md:py-16 space-y-8" aria-label="Loading account settings...">
      <div className="space-y-2 pb-4 border-b border-line">
        <Skeleton variant="text" className="w-48 h-8" />
        <Skeleton variant="text" className="w-72 h-4" />
      </div>

      <div className="rounded-radius border border-line bg-card p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton variant="circular" className="w-16 h-16" />
          <div className="space-y-2">
            <Skeleton variant="text" className="w-36 h-5" />
            <Skeleton variant="text" className="w-48 h-4" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Skeleton variant="text" className="w-24 h-4" />
            <Skeleton variant="rectangular" className="w-full h-10 rounded-radius" />
          </div>
          <div className="space-y-1.5">
            <Skeleton variant="text" className="w-20 h-4" />
            <Skeleton variant="rectangular" className="w-full h-10 rounded-radius" />
          </div>
          <div className="space-y-1.5">
            <Skeleton variant="text" className="w-16 h-4" />
            <Skeleton variant="rectangular" className="w-full h-24 rounded-radius" />
          </div>
        </div>

        <div className="pt-4 border-t border-line flex justify-end">
          <Skeleton variant="rectangular" className="w-32 h-10 rounded-radius" />
        </div>
      </div>
    </div>
  );
}
