import React from 'react';
import { Skeleton } from '@/components/ui/skeletons';

export default function DocumentLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-20 space-y-8" aria-label="Loading document...">
      <div className="space-y-3 pb-6 border-b border-line">
        <Skeleton variant="pill" className="w-36 h-5" />
        <Skeleton variant="text" className="w-64 h-9" />
        <Skeleton variant="text" className="w-48 h-4" />
      </div>

      <div className="space-y-4">
        <Skeleton variant="text" className="w-full h-4" />
        <Skeleton variant="text" className="w-11/12 h-4" />
        <Skeleton variant="text" className="w-5/6 h-4" />
        <Skeleton variant="rectangular" className="w-full h-32 rounded-radius" />
      </div>
    </div>
  );
}
