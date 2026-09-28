'use client';

import React from 'react';
import { Skeleton } from './Skeleton';

export function LoginSkeleton() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 font-sans" aria-label="Loading sign in...">
      <div className="w-full max-w-md rounded-radius border border-line bg-card p-6 sm:p-8 space-y-6 shadow-sm">
        {/* Header */}
        <div className="text-center space-y-3">
          <Skeleton variant="circular" className="w-10 h-10 mx-auto" />
          <Skeleton variant="text" className="w-48 h-7 mx-auto" />
          <Skeleton variant="text" className="w-64 h-4 mx-auto" />
        </div>

        {/* Buttons */}
        <div className="space-y-3 pt-2">
          <Skeleton variant="rectangular" className="w-full h-11 rounded-radius" />
          <Skeleton variant="rectangular" className="w-full h-11 rounded-radius" />
          <div className="flex items-center justify-between pt-1">
            <Skeleton variant="text" className="w-24 h-4" />
            <Skeleton variant="text" className="w-32 h-4" />
          </div>
        </div>

        {/* Accordion */}
        <div className="pt-3 border-t border-line">
          <Skeleton variant="rectangular" className="w-full h-8 rounded" />
        </div>

        {/* Footer */}
        <div className="pt-2 text-center">
          <Skeleton variant="text" className="w-28 h-4 mx-auto" />
        </div>
      </div>
    </div>
  );
}
