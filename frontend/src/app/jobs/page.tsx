'use client';

import React from 'react';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { ArrowRight, Sparkles, Building2, MapPin, CheckCircle2 } from 'lucide-react';

export default function JobsPage() {
  const { jobs, submissions, getJobMatchDetails } = useAppStore();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 md:py-16 space-y-10">
      {/* Header */}
      <div className="space-y-3">
        <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-text-0">
          Opportunities
        </h1>
        <p className="text-sm lg:text-base sm:text-base text-text-1 max-w-2xl leading-relaxed">
          Roles matched against your verified Idea Bank submissions. Our AI scrutinizes your portfolio against job specs before applying, guaranteeing high-signal proof.
        </p>
      </div>

      {/* Match Summary Register */}
      <div className="rounded-radius border border-line bg-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs md:text-sm">
        <div className="flex items-center gap-3">
          <Sparkles className="w-4 h-4 text-green-700 dark:text-green-400" />
          <div>
            <div className="font-semibold text-text-0 font-sans">
              AI Portfolio Scrutiny Active
            </div>
            <div className="text-xs md:text-sm text-text-1 font-mono">
              You have <span className="text-green-700 dark:text-green-400 font-bold">{submissions.length} verified proof entries</span> on your ledger. Higher match scores unlock instantaneous ATS-safe application package generation.
            </div>
          </div>
        </div>
        <Link
          href="/ideas"
          className="btn-outline text-xs md:text-sm py-1.5 px-3 self-start sm:self-auto shrink-0 font-sans"
        >
          Solve more problems →
        </Link>
      </div>

      {/* Jobs List */}
      <div className="space-y-4">
        {jobs.map((job) => {
          const matchDetails = getJobMatchDetails(job);
          const isHighMatch = !matchDetails.hasGap && matchDetails.score >= 80;

          return (
            <div
              key={job.id}
              className="rounded-radius border border-line bg-card hover:border-zinc-700/80 transition-all p-6 space-y-4 text-xs md:text-sm"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
                <div>
                  <div className="flex items-center gap-2 text-xs md:text-sm font-mono text-green-700 dark:text-green-400 font-medium">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>{job.company}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1 text-text-1">
                      <MapPin className="w-3 h-3" />
                      {job.location}
                    </span>
                  </div>
                  <h2 className="text-xl font-semibold tracking-tight text-text-0 mt-1 font-sans">
                    {job.title}
                  </h2>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 font-mono w-full sm:w-auto">
                  <div className="text-left sm:text-right">
                    <div
                      className={`text-sm lg:text-base font-bold ${
                        isHighMatch ? 'text-green-700 dark:text-green-400' : 'text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      {matchDetails.score}% Match
                    </div>
                    <div className={`text-xs md:text-sm font-semibold ${isHighMatch ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
                      {isHighMatch ? 'Ready to apply' : 'Skill gap detected'}
                    </div>
                  </div>

                  <Link
                    href={`/jobs/${job.id}/apply`}
                    className="btn-brass text-xs md:text-sm py-2 px-4 shrink-0"
                  >
                    <span>Run AI Scrutiny</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs md:text-sm sm:text-sm lg:text-base text-text-0 leading-relaxed max-w-lg">
                {job.description}
              </p>

              {/* Required Proofs & Match tags */}
              <div className="space-y-2 pt-2">
                <div className="text-xs md:text-sm uppercase tracking-wider text-text-1 font-semibold">
                  Required Proof-of-Work:
                </div>
                <div className="flex flex-wrap gap-2">
                  {job.requiredSkills.map((req, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-line bg-ink-0 text-xs md:text-sm text-text-0"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-700 dark:text-green-400 shrink-0" />
                      <span>{req}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Salary & Type */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-line text-xs md:text-sm text-text-1">
                <span className="font-semibold text-text-0">
                  Compensation: {job.salary}
                </span>
                <span>Type: {job.type}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
