'use client';

import React from 'react';
import Link from 'next/link';
import { INITIAL_COACHING } from '@/lib/mock-data';
import { Clock, ArrowRight } from 'lucide-react';

export default function CoachingListPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 md:py-16 space-y-10 text-sm lg:text-base font-sans">
      <div className="space-y-3">
        <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-text-0">
          Coaching Itineraries
        </h1>
        <p className="text-sm lg:text-base sm:text-base text-text-1 max-w-2xl leading-relaxed">
          Structured, multi-step programs built around closing specific architectural gaps so you can land targeted mid/senior-level junior roles.
        </p>
      </div>

      <div className="space-y-6">
        {INITIAL_COACHING.map((track) => (
          <div
            key={track.id}
            className="rounded-radius border border-line bg-card hover:border-zinc-700/80 transition-all p-5 sm:p-6 space-y-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
              <div>
                <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-text-0">
                  {track.title}
                </h2>
                <div className="text-xs md:text-sm text-green-700 dark:text-green-400 font-medium mt-1 font-mono">
                  Target: {track.targetRole}
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                <span className="flex items-center gap-1 text-text-1 text-xs md:text-sm font-mono">
                  <Clock className="w-3.5 h-3.5" />
                  {track.durationWeeks} Weeks
                </span>
                <Link
                  href={`/coaching/${track.id}`}
                  className="btn-brass text-xs md:text-sm py-1.5 px-4 shrink-0"
                >
                  <span>Open Itinerary</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            <p className="text-text-1 leading-relaxed text-xs md:text-sm sm:text-sm lg:text-base max-w-lg">
              {track.subtitle}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2">
              {track.milestones.map((m) => (
                <div
                  key={m.week}
                  className="pl-3 border-l-2 border-line space-y-1"
                >
                  <div className="text-xs md:text-sm text-green-700 dark:text-green-400 font-mono font-semibold uppercase tracking-wider">
                    Week {m.week}
                  </div>
                  <h3 className="font-medium text-text-0 text-xs md:text-sm">{m.title}</h3>
                  <p className="text-xs md:text-sm text-text-1 line-clamp-2 leading-relaxed">
                    {m.deliverable}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
