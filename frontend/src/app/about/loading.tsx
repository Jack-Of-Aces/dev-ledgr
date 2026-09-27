import React from 'react';
import { Skeleton } from '@/components/ui/skeletons';

export default function AboutLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 md:py-20 space-y-12" aria-label="Loading manifesto...">
      <div className="space-y-4">
        <Skeleton variant="circular" className="w-10 h-10" />
        <Skeleton variant="text" className="w-72 h-10" />
        <Skeleton variant="text" className="w-64 h-5" />
      </div>

      <div className="space-y-4 max-w-xl">
        <Skeleton variant="text" className="w-full h-4" />
        <Skeleton variant="text" className="w-11/12 h-4" />
        <Skeleton variant="text" className="w-4/5 h-4" />
      </div>

      <div className="p-6 rounded-radius border border-line bg-card/40 space-y-3">
        <Skeleton variant="text" className="w-full h-5" />
        <Skeleton variant="text" className="w-5/6 h-4" />
      </div>
    </div>
  );
}
