'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { INITIAL_COACHING } from '@/lib/mock-data';
import {
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  Target,
  Sparkles,
  ShieldCheck,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  Code,
  Zap,
} from 'lucide-react';

export default function CoachingListPage() {
  const { user, submissions, jobs, getJobMatchDetails } = useAppStore();
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'fintech' | 'systems' | 'devtools'>('all');
  const [expandedTrackId, setExpandedTrackId] = useState<string | null>(null);

  const userSubmissions = submissions.filter(
    (s) => s.authorUsername.toLowerCase() === user.username.toLowerCase()
  );
  const solvedIdeaIds = new Set(userSubmissions.map((s) => s.ideaId));

  // Determine user skill gaps from jobs
  const primaryJobWithGap = (() => {
    for (const job of jobs) {
      const details = getJobMatchDetails(job);
      if (details.hasGap && details.gapProblem) {
        return { job, details, gapProblem: details.gapProblem };
      }
    }
    return null;
  })();

  // Match best recommendation track
  const recommendedTrackId = primaryJobWithGap?.gapProblem?.domain === 'devtools'
    ? 'devtools-infrastructure'
    : primaryJobWithGap?.gapProblem?.domain === 'fintech'
    ? 'fintech-reliability'
    : 'backend-fundamentals';

  // Calculate cumulative coaching metrics
  const totalCurriculumMilestones = INITIAL_COACHING.reduce((acc, t) => acc + t.milestones.length, 0);
  const totalSolvedInCurriculum = INITIAL_COACHING.reduce(
    (acc, t) => acc + t.milestones.filter((m) => m.ideaIdRef && solvedIdeaIds.has(m.ideaIdRef)).length,
    0
  );
  const overallReadinessPct = Math.round((totalSolvedInCurriculum / totalCurriculumMilestones) * 100);

  // Filtered tracks
  const filteredTracks = INITIAL_COACHING.filter((track) => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'fintech') return track.id.includes('fintech') || track.id === 'backend-fundamentals';
    if (selectedFilter === 'systems') return track.id === 'backend-fundamentals';
    if (selectedFilter === 'devtools') return track.id.includes('devtools');
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-12 space-y-8 font-sans">
      {/* ========================================================= */}
      {/* 1. EXECUTIVE HEADER & BREADCRUMB CONTEXT                  */}
      {/* ========================================================= */}
      <section className="space-y-4 pb-6 border-b border-line">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-text-1">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald" />
            </span>
            <span className="font-semibold text-text-0 uppercase tracking-wider">
              Engineering Apprenticeship & Socratic Engine
            </span>
            <span className="text-line">/</span>
            <span className="text-emerald-text">Milestone-Sealed</span>
          </div>

          <div className="flex items-center gap-3">
            <span>Candidate: <strong className="text-text-0 font-medium">@{user.username}</strong></span>
            <span className="text-line">/</span>
            <Link href="/dashboard" className="text-emerald-text hover:underline">
              Dashboard View →
            </Link>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-text-0">
              Personalized Coaching Curriculum
            </h1>
            <p className="text-xs sm:text-sm text-text-1 leading-relaxed">
              DevLedgr coaching transforms theoretical study into cryptographically verifiable proof-of-work. Every milestone is tethered to a production failure mode spec, real mock infrastructure, and live AI architectural scrutiny.
            </p>
          </div>

          <Link
            href={`/coaching/${recommendedTrackId}`}
            className="btn-brass text-xs md:text-sm py-2 px-4 self-start md:self-auto shrink-0 inline-flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Resume Target Track</span>
          </Link>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 2. CANDIDATE READINESS & ROADMAP KPI TILES               */}
      {/* ========================================================= */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-radius border border-line bg-card/60 space-y-1">
          <div className="flex items-center justify-between text-xs text-text-1 font-mono">
            <span>Verified Proofs</span>
            <ShieldCheck className="w-4 h-4 text-emerald-text" />
          </div>
          <div className="text-2xl font-bold font-mono text-text-0">
            {userSubmissions.length}
          </div>
          <div className="text-xs text-text-1">
            {userSubmissions.length > 0 ? 'Cryptographically stamped' : 'Awaiting 1st milestone seal'}
          </div>
        </div>

        <div className="p-4 rounded-radius border border-line bg-card/60 space-y-1">
          <div className="flex items-center justify-between text-xs text-text-1 font-mono">
            <span>Target Role Match</span>
            <Target className="w-4 h-4 text-emerald-text" />
          </div>
          <div className="text-2xl font-bold font-mono text-text-0">
            {primaryJobWithGap ? `${primaryJobWithGap.details.score}%` : '94%'}
          </div>
          <div className="text-xs text-emerald-text font-mono truncate">
            {primaryJobWithGap ? `Unlocks: ${primaryJobWithGap.job.company}` : 'Production Ready'}
          </div>
        </div>

        <div className="p-4 rounded-radius border border-line bg-card/60 space-y-1">
          <div className="flex items-center justify-between text-xs text-text-1 font-mono">
            <span>Curriculum Progress</span>
            <GraduationCap className="w-4 h-4 text-emerald-text" />
          </div>
          <div className="text-2xl font-bold font-mono text-text-0">
            {totalSolvedInCurriculum} / {totalCurriculumMilestones}
          </div>
          <div className="text-xs text-text-1 font-mono">
            {overallReadinessPct}% tracks completed
          </div>
        </div>

        <div className="p-4 rounded-radius border border-line bg-card/60 space-y-1">
          <div className="flex items-center justify-between text-xs text-text-1 font-mono">
            <span>Stated Stack</span>
            <Code className="w-4 h-4 text-emerald-text" />
          </div>
          <div className="text-base font-bold font-mono text-text-0 truncate pt-1">
            {user.statedSkills?.slice(0, 3).join(', ') || 'Go, TypeScript'}
          </div>
          <div className="text-xs text-text-1">
            Auto-tuned Socratic responses
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 3. TARGET GAP ACCELERATOR BANNER                          */}
      {/* ========================================================= */}
      {primaryJobWithGap && (
        <section className="p-4.5 rounded-radius border border-emerald-border bg-emerald-tint/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded bg-emerald/15 text-emerald-text shrink-0 mt-0.5">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono uppercase tracking-wider font-semibold text-emerald-text">
                  Direct Career Accelerator
                </span>
                <span className="text-xs px-2 py-0.2 rounded-full bg-emerald text-white font-mono font-bold">
                  Recommended Track
                </span>
              </div>
              <p className="text-xs sm:text-sm text-text-0 font-medium">
                Enrolling in <span className="font-bold underline">{INITIAL_COACHING.find((t) => t.id === recommendedTrackId)?.title}</span> covers the missing proof required for <span className="font-bold">{primaryJobWithGap.job.company}</span>.
              </p>
              <p className="text-xs text-text-1">
                {primaryJobWithGap.job.gapReason}
              </p>
            </div>
          </div>

          <Link
            href={`/coaching/${recommendedTrackId}`}
            className="btn-brass text-xs py-2 px-3.5 self-start md:self-center shrink-0 inline-flex items-center gap-1.5"
          >
            <span>Open Recommended Track</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </section>
      )}

      {/* ========================================================= */}
      {/* 4. IA WORKSPACE: DOMAIN FILTERS & TRACK DIRECTORY         */}
      {/* ========================================================= */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-line">
          <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
            {[
              { id: 'all', label: 'All Curriculums', count: INITIAL_COACHING.length },
              { id: 'fintech', label: 'Fintech & Payments', count: 2 },
              { id: 'systems', label: 'Distributed Systems', count: 1 },
              { id: 'devtools', label: 'DevTools & Reliability', count: 1 },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setSelectedFilter(f.id as typeof selectedFilter)}
                className={`px-3 py-1.5 rounded-radius font-medium transition-colors cursor-pointer text-xs ${
                  selectedFilter === f.id
                    ? 'bg-text-0 text-ink-0 font-semibold'
                    : 'bg-card border border-line text-text-1 hover:text-text-0 hover:border-text-1'
                }`}
              >
                <span>{f.label}</span>
                <span className="ml-1.5 opacity-60 font-mono">({f.count})</span>
              </button>
            ))}
          </div>

          <div className="text-xs font-mono text-text-1">
            Showing <span className="text-text-0 font-medium">{filteredTracks.length}</span> verified tracks
          </div>
        </div>

        {/* Tracks List */}
        <div className="space-y-4">
          {filteredTracks.map((track) => {
            const solvedMilestones = track.milestones.filter(
              (m) => m.ideaIdRef && solvedIdeaIds.has(m.ideaIdRef)
            ).length;
            const totalMilestones = track.milestones.length;
            const progressPercent = Math.round((solvedMilestones / totalMilestones) * 100);
            const isRecommended = track.id === recommendedTrackId;
            const isExpanded = expandedTrackId === track.id;

            return (
              <div
                key={track.id}
                className={`rounded-radius border transition-all p-5 sm:p-6 space-y-5 ${
                  isRecommended
                    ? 'border-emerald bg-card shadow-xs ring-1 ring-emerald/30'
                    : 'border-line bg-card/60 hover:border-text-1/60'
                }`}
              >
                {/* Track Card Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-text-0">
                        {track.title}
                      </h2>
                      {isRecommended && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald text-white text-xs font-mono font-bold">
                          Top Match For You
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-text-1">
                      <span className="text-emerald-text font-semibold">
                        Role: {track.targetRole}
                      </span>
                      <span className="text-line">·</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {track.durationWeeks} Weeks
                      </span>
                      <span className="text-line">·</span>
                      <span className="flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5" />
                        {track.milestones.length} Milestones
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
                    <button
                      onClick={() => setExpandedTrackId(isExpanded ? null : track.id)}
                      className="btn-outline text-xs py-2 px-3 inline-flex items-center gap-1.5 cursor-pointer font-mono"
                    >
                      <span>{isExpanded ? 'Hide Syllabus' : 'View Syllabus'}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <Link
                      href={`/coaching/${track.id}`}
                      className="btn-brass text-xs py-2 px-4 inline-flex items-center gap-1.5"
                    >
                      <span>{solvedMilestones > 0 ? 'Resume Track' : 'Start Track'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                {/* Subtitle */}
                <p className="text-xs sm:text-sm text-text-1 leading-relaxed max-w-3xl">
                  {track.subtitle}
                </p>

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-text-1">Curriculum Completion</span>
                    <span className="text-emerald-text font-semibold">
                      {solvedMilestones} of {totalMilestones} Milestones Stamped ({progressPercent}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-line overflow-hidden">
                    <div
                      className="h-full bg-emerald transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Milestones Preview / Accordion */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                  {track.milestones.map((m) => {
                    const isSolved = m.ideaIdRef ? solvedIdeaIds.has(m.ideaIdRef) : false;

                    return (
                      <div
                        key={m.week}
                        className={`p-3 rounded-radius border transition-colors space-y-1.5 ${
                          isSolved
                            ? 'border-emerald-border bg-emerald-tint/40'
                            : 'border-line bg-card/40'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="font-semibold text-text-1 uppercase">
                            Week {m.week}
                          </span>
                          {isSolved ? (
                            <span className="text-emerald-text font-medium inline-flex items-center gap-0.5">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Done</span>
                            </span>
                          ) : (
                            <span className="text-text-1 font-mono">Pending</span>
                          )}
                        </div>
                        <h3 className="font-medium text-text-0 text-xs line-clamp-1">{m.title}</h3>
                        <p className="text-xs text-text-1 line-clamp-2 leading-relaxed">
                          {m.deliverable}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Expanded Detailed Syllabus View */}
                {isExpanded && (
                  <div className="p-4 rounded-radius border border-line bg-card space-y-4 animate-in fade-in duration-150">
                    <div className="text-xs font-mono font-semibold uppercase tracking-wider text-text-0 pb-2 border-b border-line">
                      Detailed Curriculum Breakdown & Required Contracts
                    </div>
                    <div className="space-y-3">
                      {track.milestones.map((m) => {
                        const isSolved = m.ideaIdRef ? solvedIdeaIds.has(m.ideaIdRef) : false;

                        return (
                          <div
                            key={m.week}
                            className="p-3.5 rounded border border-line bg-card/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-text-0">Week 0{m.week}:</span>
                                <span className="font-semibold text-text-0 text-sm">{m.title}</span>
                                {isSolved && (
                                  <span className="text-emerald-text font-mono inline-flex items-center gap-1 font-semibold">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Verified</span>
                                  </span>
                                )}
                              </div>
                              <p className="text-text-1">{m.deliverable}</p>
                              <div className="text-text-1 font-mono pt-0.5">
                                Sample prompt: &ldquo;{m.prompts[0]}&rdquo;
                              </div>
                            </div>

                            <div className="shrink-0 flex items-center gap-2">
                              {m.ideaIdRef && (
                                <Link
                                  href={`/ideas/${m.ideaIdRef}`}
                                  className="text-text-1 hover:text-text-0 hover:underline font-mono inline-flex items-center gap-1"
                                >
                                  <span>Problem Spec</span>
                                  <ArrowRight className="w-3 h-3" />
                                </Link>
                              )}
                              <Link
                                href={`/coaching/${track.id}`}
                                className="text-emerald-text hover:underline font-mono font-medium inline-flex items-center gap-1"
                              >
                                <span>AI Guidance →</span>
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
