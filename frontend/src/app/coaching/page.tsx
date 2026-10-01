'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { INITIAL_COACHING } from '@/lib/mock-data';
import { coachingService } from '@/services/coaching/coachingService';
import { launchpadService } from '@/services/launchpad/launchpadService';
import { jobService } from '@/services/jobs/jobService';
import { CoachingItinerary } from '@/types';
import { CoachingSkeleton } from '@/components/ui/skeletons';
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
  Check,
} from 'lucide-react';

export default function CoachingListPage() {
  const { user, submissions, jobs, ideas, getJobMatchDetails, setIdeas, setJobs } = useAppStore();
  const [mounted, setMounted] = useState(false);
  const [itineraries, setItineraries] = useState<CoachingItinerary[]>(INITIAL_COACHING);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [expandedTrackId, setExpandedTrackId] = useState<string | null>(null);
  // Distinguishes a real fetch from the bundled itinerary fixture, and separates
  // "failed" from "published nothing" so the page never renders sample tracks
  // under a heading that implies live data.
  const [itineraryStatus, setItineraryStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [itineraryRetry, setItineraryRetry] = useState(0);

  useEffect(() => {
    setMounted(true);
    let active = true;
    coachingService
      .getItineraries()
      .then((data) => {
        if (!active) return;
        if (data && data.length > 0) {
          setItineraries(data);
        }
        setItineraryStatus('ready');
      })
      .catch(() => {
        if (active) setItineraryStatus('error');
      });

    if (ideas.length === 0) {
      launchpadService.getProblems().then((data) => {
        if (active && data && data.length > 0) setIdeas(data);
      }).catch(() => {});
    }
    if (jobs.length === 0) {
      jobService.getJobs().then((data) => {
        if (active && data && data.length > 0) setJobs(data);
      }).catch(() => {});
    }

    return () => {
      active = false;
    };
  }, [ideas.length, jobs.length, setIdeas, setJobs]);

  useEffect(() => {
    if (itineraryRetry === 0) return;
    let active = true;
    setItineraryStatus('loading');
    coachingService
      .getItineraries()
      .then((data) => {
        if (!active) return;
        if (data && data.length > 0) {
          setItineraries(data);
        }
        setItineraryStatus('ready');
      })
      .catch(() => {
        if (active) setItineraryStatus('error');
      });
    return () => {
      active = false;
    };
  }, [itineraryRetry]);

  // On a failed fetch `itineraries` is still the bundled fixture, so the page is
  // showing sample tracks and must say so.
  const usingSampleTracks = itineraryStatus === 'error';

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

  // Match best recommendation track based on user's calibrated track & job gaps
  const recommendedTrackId = (() => {
    const track = user.engineeringTrack;
    if (track === 'devops-infra') return 'devtools-infrastructure';
    if (track === 'frontend-ui') return 'frontend-architecture';
    if (track === 'ai-ml') return 'ai-systems-engineering';
    if (track === 'fullstack') return 'fintech-reliability';
    if (track === 'backend-systems') return 'backend-fundamentals';
    if (primaryJobWithGap?.gapProblem?.domain === 'devtools') return 'devtools-infrastructure';
    if (primaryJobWithGap?.gapProblem?.domain === 'fintech') return 'fintech-reliability';
    if (primaryJobWithGap?.gapProblem?.domain === 'social' || primaryJobWithGap?.gapProblem?.domain === 'ecommerce') {
      return 'frontend-architecture';
    }
    return 'backend-fundamentals';
  })();

  // Calculate cumulative coaching metrics
  const totalCurriculumMilestones = itineraries.reduce((acc, t) => acc + t.milestones.length, 0);
  const totalSolvedInCurriculum = itineraries.reduce(
    (acc, t) => acc + t.milestones.filter((m) => m.ideaIdRef && solvedIdeaIds.has(m.ideaIdRef)).length,
    0
  );
  const overallReadinessPct = totalCurriculumMilestones > 0 ? Math.round((totalSolvedInCurriculum / totalCurriculumMilestones) * 100) : 0;

  // Highest-scoring role overall, used when no role currently has an open gap.
  const topJobMatch = (() => {
    let best: { job: (typeof jobs)[number]; details: ReturnType<typeof getJobMatchDetails> } | null = null;
    for (const job of jobs) {
      const details = getJobMatchDetails(job);
      if (!best || details.score > best.details.score) best = { job, details };
    }
    return best;
  })();

  // Multi-select toggle helper
  const toggleFilter = (id: string) => {
    if (id === 'all') {
      setSelectedFilters([]);
      return;
    }
    setSelectedFilters((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  // Domain facets and their counts, derived from the itineraries actually loaded.
  const trackFacets = useMemo(() => {
    const matches: Record<string, (id: string) => boolean> = {
      systems: (id: string) => id === 'backend-fundamentals',
      fintech: (id: string) => id === 'fintech-reliability',
      devtools: (id: string) => id === 'devtools-infrastructure',
      frontend: (id: string) => id === 'frontend-architecture',
      ai: (id: string) => id === 'ai-systems-engineering',
    };
    const defs = [
      { id: 'systems', label: 'Distributed Systems' },
      { id: 'fintech', label: 'Fintech & Ledgers' },
      { id: 'devtools', label: 'DevOps & Tooling' },
      { id: 'frontend', label: 'Frontend & UI' },
      { id: 'ai', label: 'AI Systems & RAG' },
    ] as const;
    return [
      { id: 'all', label: 'All Curriculums', count: itineraries.length },
      ...defs.map((d) => ({
        ...d,
        count: itineraries.filter((t) => matches[d.id]?.(t.id)).length,
      })),
    ];
  }, [itineraries]);

  // Filtered tracks with multi-selection support
  const filteredTracks = itineraries.filter((track) => {
    if (selectedFilters.length === 0) return true;
    return selectedFilters.some((f) => {
      if (f === 'systems') return track.id === 'backend-fundamentals';
      if (f === 'fintech') return track.id === 'fintech-reliability';
      if (f === 'devtools') return track.id === 'devtools-infrastructure';
      if (f === 'frontend') return track.id === 'frontend-architecture';
      if (f === 'ai') return track.id === 'ai-systems-engineering';
      return false;
    });
  });

  if (!mounted) {
    return <CoachingSkeleton />;
  }

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

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <span className="truncate">Candidate: <strong className="text-text-0 font-medium">@{user.username}</strong></span>
            {user.targetRole && (
              <>
                <span className="text-line hidden xs:inline">/</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-tint border border-emerald-border text-emerald-text font-mono text-[11px] font-semibold truncate max-w-[180px]">
                  {user.targetRole}
                </span>
              </>
            )}
            <span className="text-line hidden xs:inline">/</span>
            <Link href="/dashboard" className="text-emerald-text hover:underline shrink-0">
              Dashboard View →
            </Link>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 sm:gap-6">
          <div className="space-y-2 max-w-3xl">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-text-0">
              Personalized Coaching Curriculum
            </h1>
            <p className="text-xs sm:text-sm text-text-1 leading-relaxed">
              DevLedgr coaching transforms theoretical study into cryptographically verifiable proof-of-work. Every milestone is tethered to a production failure mode spec, real mock infrastructure, and live AI architectural scrutiny.
            </p>
          </div>

          <Link
            href={`/coaching/${recommendedTrackId}`}
            className="btn-brass text-xs md:text-sm py-2 px-4 w-full md:w-auto shrink-0 inline-flex items-center justify-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5 shrink-0" />
            <span>Resume Target Track</span>
          </Link>
        </div>
      {/* The bundled itinerary fixture is still rendered when the fetch fails,
            so disclose it rather than presenting sample tracks as live. */}
        {itineraryStatus !== 'loading' && usingSampleTracks && (
          <div
            role="alert"
            className="p-3 rounded-radius border border-amber-500/30 bg-amber-500/10 text-xs font-mono text-text-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <span>
              Could not reach the coaching service, so these are bundled sample
              curriculums — not live tracks.
            </span>
            <button
              type="button"
              onClick={() => setItineraryRetry((n) => n + 1)}
              className="btn-outline text-xs py-1 px-2.5 shrink-0 self-start sm:self-auto"
            >
              Retry
            </button>
          </div>
        )}
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
            {/* Previously fell back to a hardcoded "94%" whenever no role with a
                gap was found — a score that was never measured. Report the real
                best match across the board instead, or say there is none. */}
            {topJobMatch ? `${topJobMatch.details.score}%` : '--'}
          </div>
          <div className="text-xs text-emerald-text font-mono truncate">
            {primaryJobWithGap
              ? `Unlocks: ${primaryJobWithGap.job.company}`
              : topJobMatch
                ? `Best match: ${topJobMatch.job.company}`
                : 'No roles to match against'}
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
        <section className="p-4 sm:p-4.5 rounded-radius border border-emerald-border bg-emerald-tint/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2 rounded bg-emerald/15 text-emerald-text shrink-0 mt-0.5">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono uppercase tracking-wider font-semibold text-emerald-text">
                  Direct Career Accelerator
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald text-white font-mono font-bold shrink-0">
                  Recommended Track
                </span>
              </div>
              <p className="text-xs sm:text-sm text-text-0 font-medium break-words">
                Enrolling in <span className="font-bold underline">{itineraries.find((t) => t.id === recommendedTrackId)?.title}</span> covers the missing proof required for <span className="font-bold">{primaryJobWithGap.job.company}</span>.
              </p>
              <p className="text-xs text-text-1">
                {primaryJobWithGap.job.gapReason}
              </p>
            </div>
          </div>

          <Link
            href={`/coaching/${recommendedTrackId}`}
            className="btn-brass text-xs py-2.5 px-4 w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-1.5 font-medium"
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-line">
          <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 py-1 min-w-0">
            {/* Facet counts are computed from the loaded itineraries. They were
                hardcoded to 2/1/1 and drifted whenever the track list changed. */}
            {trackFacets.map((f) => {
              const isSelected = f.id === 'all' ? selectedFilters.length === 0 : selectedFilters.includes(f.id);
              return (
                <button
                  key={f.id}
                  onClick={() => toggleFilter(f.id)}
                  className={`px-3 py-1.5 rounded-radius font-medium transition-colors cursor-pointer text-xs shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 border ${
                    isSelected
                      ? 'bg-text-0 text-ink-0 font-semibold border-text-0 shadow-xs'
                      : 'bg-card border-line text-text-1 hover:text-text-0 hover:border-text-1'
                  }`}
                  aria-pressed={isSelected}
                >
                  {isSelected && f.id !== 'all' && <Check className="w-3 h-3 shrink-0" />}
                  <span>{f.label}</span>
                  <span className={`font-mono ${isSelected ? 'opacity-80' : 'opacity-60'}`}>
                    ({f.count})
                  </span>
                </button>
              );
            })}
          </div>

          <div className="text-xs font-mono text-text-1 shrink-0 flex items-center gap-2">
            <span>
              Showing <span className="text-text-0 font-medium">{filteredTracks.length}</span> verified tracks
            </span>
            {selectedFilters.length > 0 && (
              <button
                onClick={() => setSelectedFilters([])}
                className="text-emerald-text hover:underline cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Tracks List */}
        <div className="space-y-4">
          {filteredTracks.map((track) => {
            const solvedMilestones = track.milestones.filter(
              (m) => m.ideaIdRef && solvedIdeaIds.has(m.ideaIdRef)
            ).length;
            const totalMilestones = track.milestones.length;
            // A track with no milestones divides by zero and rendered "NaN%".
            const progressPercent =
              totalMilestones > 0 ? Math.round((solvedMilestones / totalMilestones) * 100) : 0;
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

                  <div className="flex flex-col xs:flex-row items-stretch sm:items-center gap-2 sm:gap-3 shrink-0 w-full sm:w-auto">
                    <button
                      onClick={() => setExpandedTrackId(isExpanded ? null : track.id)}
                      className="btn-outline text-xs py-2 px-3 inline-flex items-center justify-center gap-1.5 cursor-pointer font-mono w-full xs:w-auto"
                    >
                      <span>{isExpanded ? 'Hide Syllabus' : 'View Syllabus'}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                      )}
                    </button>

                    <Link
                      href={`/coaching/${track.id}`}
                      className="btn-brass text-xs py-2 px-4 inline-flex items-center justify-center gap-1.5 font-medium w-full xs:w-auto"
                    >
                      <span>{solvedMilestones > 0 ? 'Resume Track' : 'Start Track'}</span>
                      <ArrowRight className="w-3.5 h-3.5 shrink-0" />
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
