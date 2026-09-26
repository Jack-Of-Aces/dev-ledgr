'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { INITIAL_COACHING } from '@/lib/mock-data';
import { aiService } from '@/services/ai/aiService';
import {
  ArrowLeft,
  Terminal,
  Sparkles,
  Loader2,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Send,
  Code2,
  FileCode,
  ChevronRight,
} from 'lucide-react';

type ConsoleTab = 'socratic' | 'custom' | 'patterns';

export default function CoachingDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const itinerary = INITIAL_COACHING.find((c) => c.id === id) || INITIAL_COACHING[0];

  const { user, submissions, ideas } = useAppStore();
  const userSubmissions = submissions.filter(
    (s) => s.authorUsername.toLowerCase() === user.username.toLowerCase()
  );
  const userSolvedIdeaIds = new Set(userSubmissions.map((s) => s.ideaId));

  // Default to first unsolved milestone if exists
  const initialWeek = itinerary.milestones.find(
    (m) => !m.ideaIdRef || !userSolvedIdeaIds.has(m.ideaIdRef)
  )?.week || 1;

  const [activeWeek, setActiveWeek] = useState(initialWeek);
  const [consoleTab, setConsoleTab] = useState<ConsoleTab>('socratic');
  const [promptOutput, setPromptOutput] = useState<string | null>(null);
  const [activePromptLabel, setActivePromptLabel] = useState<string | null>(null);
  const [customQuestion, setCustomQuestion] = useState('');
  const [isLoadingCoach, setIsLoadingCoach] = useState(false);

  const selectedMilestone =
    itinerary.milestones.find((m) => m.week === activeWeek) || itinerary.milestones[0];

  const isMilestoneSolved = selectedMilestone.ideaIdRef
    ? userSolvedIdeaIds.has(selectedMilestone.ideaIdRef)
    : false;

  const solvedMilestoneSubmission = selectedMilestone.ideaIdRef
    ? userSubmissions.find((s) => s.ideaId === selectedMilestone.ideaIdRef)
    : undefined;

  const pairedIdea = selectedMilestone.ideaIdRef
    ? ideas.find((i) => i.id === selectedMilestone.ideaIdRef)
    : undefined;

  const handleRunPrompt = async (prompt: string) => {
    setActivePromptLabel(prompt);
    setPromptOutput(null);
    setIsLoadingCoach(true);
    try {
      const advice = await aiService.getCoachingAdvice({
        itineraryTitle: itinerary.title,
        milestoneTitle: selectedMilestone.title,
        prompt,
        apiKey: user.apiKey,
        candidateContext: {
          username: user.username,
          name: user.name,
          headline: user.headline,
          statedSkills: user.statedSkills,
          verifiedProofCount: userSubmissions.length,
          solvedIdeaTitles: userSubmissions.map((s) => s.ideaTitle),
        },
      });
      setPromptOutput(advice);
    } catch {
      setPromptOutput('Unable to load coaching guidance. Please try again.');
    } finally {
      setIsLoadingCoach(false);
    }
  };

  const handleCustomQuestionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuestion.trim() || isLoadingCoach) return;
    const q = customQuestion.trim();
    setCustomQuestion('');
    handleRunPrompt(q);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-12 space-y-8 font-sans">
      {/* ========================================================= */}
      {/* 1. BREADCRUMBS & EXECUTIVE HEADER                         */}
      {/* ========================================================= */}
      <section className="space-y-4 pb-6 border-b border-line">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-text-1">
          <div className="flex items-center gap-2">
            <Link href="/coaching" className="hover:text-text-0 transition-colors">
              Coaching
            </Link>
            <ChevronRight className="w-3.5 h-3.5 opacity-40" />
            <span className="text-text-0 font-medium truncate max-w-xs">{itinerary.title}</span>
            <ChevronRight className="w-3.5 h-3.5 opacity-40" />
            <span className="text-emerald-text">Week 0{selectedMilestone.week}</span>
          </div>

          <div className="flex items-center gap-3">
            <span>Candidate: <strong className="text-text-0 font-medium">@{user.username}</strong></span>
            <span className="text-line">/</span>
            <span className="text-emerald-text font-medium">
              {itinerary.milestones.filter((m) => m.ideaIdRef && userSolvedIdeaIds.has(m.ideaIdRef)).length} of {itinerary.milestones.length} Stamped
            </span>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-tint border border-emerald-border text-emerald-text font-mono font-medium">
                {itinerary.durationWeeks}-Week Career Track
              </span>
              <span className="text-xs font-mono text-text-1">
                Target: {itinerary.targetRole}
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-semibold tracking-tight text-text-0">
              {itinerary.title}
            </h1>
            <p className="text-xs sm:text-sm text-text-1 leading-relaxed">
              {itinerary.subtitle}
            </p>
          </div>

          <Link
            href="/coaching"
            className="btn-outline text-xs py-2 px-3 self-start md:self-auto shrink-0 inline-flex items-center gap-1.5 font-mono"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>All Itineraries</span>
          </Link>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 2. MILESTONE STEPPER NAVIGATION BAR                       */}
      {/* ========================================================= */}
      <div
        role="tablist"
        aria-label="Curriculum milestone sequence"
        className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pb-2"
      >
        {itinerary.milestones.map((m) => {
          const isDone = m.ideaIdRef ? userSolvedIdeaIds.has(m.ideaIdRef) : false;
          const isCurrent = activeWeek === m.week;

          return (
            <button
              key={m.week}
              id={`tab-week-${m.week}`}
              role="tab"
              aria-selected={isCurrent}
              aria-controls={`panel-week-${m.week}`}
              onClick={() => {
                setActiveWeek(m.week);
                setPromptOutput(null);
                setActivePromptLabel(null);
              }}
              className={`p-3 rounded-radius border text-left transition-all cursor-pointer space-y-1.5 ${
                isCurrent
                  ? 'border-emerald bg-card shadow-xs ring-1 ring-emerald/30'
                  : 'border-line bg-card/60 hover:border-text-1/60'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-mono">
                <span className={`font-semibold ${isCurrent ? 'text-emerald-text' : 'text-text-1'}`}>
                  WEEK 0{m.week}
                </span>
                {isDone ? (
                  <span className="text-emerald-text inline-flex items-center gap-0.5 text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Sealed</span>
                  </span>
                ) : (
                  <span className="text-text-1 text-xs">Target</span>
                )}
              </div>
              <div className="text-xs font-medium text-text-0 line-clamp-1">
                {m.title}
              </div>
            </button>
          );
        })}
      </div>

      {/* ========================================================= */}
      {/* 3. WORKSPACE: MILESTONE BRIEF & AI SCRUTINY CONSOLE       */}
      {/* ========================================================= */}
      <div
        id={`panel-week-${selectedMilestone.week}`}
        role="tabpanel"
        aria-labelledby={`tab-week-${selectedMilestone.week}`}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        {/* Left 2 Columns: Milestone Briefing & AI Guidance */}
        <div className="lg:col-span-2 space-y-6">
          {/* Milestone Briefing Tile */}
          <div className="p-5 sm:p-6 rounded-radius border border-line bg-card/60 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
              <div className="space-y-1">
                <div className="text-xs font-mono font-semibold text-emerald-text uppercase tracking-wider">
                  Milestone Specification 0{selectedMilestone.week}
                </div>
                <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-text-0">
                  {selectedMilestone.title}
                </h2>
              </div>

              {isMilestoneSolved ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-tint border border-emerald-border text-emerald-text text-xs font-mono font-medium shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald" />
                  <span>Verified: #{solvedMilestoneSubmission?.hash}</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-mono font-medium shrink-0">
                  <span>Awaiting Implementation</span>
                </div>
              )}
            </div>

            <p className="text-xs sm:text-sm text-text-0 leading-relaxed">
              {selectedMilestone.deliverable}
            </p>

            {/* Paired Problem Spec Card */}
            {pairedIdea && (
              <div className="p-4 rounded-radius border border-line bg-card space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-mono uppercase tracking-wider text-text-1">
                      Required Proof Spec:
                    </span>
                    <h3 className="font-semibold text-sm text-text-0 mt-0.5">
                      {pairedIdea.title}
                    </h3>
                  </div>

                  <Link
                    href={`/ideas/${pairedIdea.id}`}
                    className="btn-brass text-xs py-1.5 px-3 self-start sm:self-auto shrink-0 inline-flex items-center gap-1"
                  >
                    <span>{isMilestoneSolved ? 'Inspect Sealed Spec' : 'Solve Spec →'}</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-line/40 text-xs font-mono text-text-1">
                  <div>
                    Domain: <span className="text-text-0 capitalize">{pairedIdea.domain}</span>
                  </div>
                  <div>
                    Difficulty: <span className="text-text-0 capitalize">{pairedIdea.difficulty}</span>
                  </div>
                  <div>
                    Est. Hours: <span className="text-text-0">~{pairedIdea.estimatedHours}h</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Interactive AI Architecture Console */}
          <div className="p-5 sm:p-6 rounded-radius border border-line bg-card/60 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-xs font-mono text-emerald-text font-semibold uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Socratic Architectural Guidance</span>
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-text-0">
                  Live Technical Mentor Console
                </h3>
              </div>

              {/* Mode Switcher */}
              <div className="flex items-center gap-1 bg-ink-0 p-1 rounded border border-line text-xs font-mono">
                <button
                  onClick={() => setConsoleTab('socratic')}
                  className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                    consoleTab === 'socratic'
                      ? 'bg-card text-text-0 font-medium border border-line shadow-xs'
                      : 'text-text-1 hover:text-text-0'
                  }`}
                >
                  Prompts
                </button>
                <button
                  onClick={() => setConsoleTab('custom')}
                  className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                    consoleTab === 'custom'
                      ? 'bg-card text-text-0 font-medium border border-line shadow-xs'
                      : 'text-text-1 hover:text-text-0'
                  }`}
                >
                  Custom Q&A
                </button>
                <button
                  onClick={() => setConsoleTab('patterns')}
                  className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                    consoleTab === 'patterns'
                      ? 'bg-card text-text-0 font-medium border border-line shadow-xs'
                      : 'text-text-1 hover:text-text-0'
                  }`}
                >
                  Patterns
                </button>
              </div>
            </div>

            {/* TAB 1: Socratic Prompts */}
            {consoleTab === 'socratic' && (
              <div className="space-y-3">
                <p className="text-xs text-text-1">
                  Click a core architectural dilemma below. The Socratic engine simulates edge-case failures and explains production trade-offs tuned to your stack ({user.statedSkills?.slice(0, 2).join(', ') || 'Go, TypeScript'}).
                </p>

                <div className="space-y-2">
                  {selectedMilestone.prompts.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleRunPrompt(p)}
                      disabled={isLoadingCoach}
                      className={`w-full text-left p-3.5 rounded-radius border transition-all flex items-center justify-between group cursor-pointer text-xs sm:text-sm ${
                        activePromptLabel === p
                          ? 'border-emerald bg-card shadow-xs ring-1 ring-emerald/30 text-text-0'
                          : 'border-line bg-card hover:border-emerald/50 text-text-0'
                      }`}
                    >
                      <span className="font-medium">&ldquo;{p}&rdquo;</span>
                      <Sparkles className="w-3.5 h-3.5 text-emerald-text opacity-70 group-hover:opacity-100 shrink-0 ml-3" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 2: Custom Deep-Dive Inquiry */}
            {consoleTab === 'custom' && (
              <div className="space-y-3">
                <p className="text-xs text-text-1">
                  Ask any specific system design question regarding <strong className="text-text-0">{selectedMilestone.title}</strong>. Responses incorporate your verified proofs and stated stack.
                </p>

                <form onSubmit={handleCustomQuestionSubmit} className="space-y-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={customQuestion}
                      onChange={(e) => setCustomQuestion(e.target.value)}
                      placeholder={`e.g. How do I benchmark latency p99 under Redis lock contention in Go?`}
                      disabled={isLoadingCoach}
                      className="w-full pl-3.5 pr-10 py-2.5 rounded-radius border border-line bg-card text-xs sm:text-sm text-text-0 placeholder:text-text-1 focus:border-emerald focus:outline-none font-sans"
                    />
                    <button
                      type="submit"
                      disabled={!customQuestion.trim() || isLoadingCoach}
                      aria-label="Send inquiry to AI Coach"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-emerald-text hover:bg-emerald-tint disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* TAB 3: Reference Patterns */}
            {consoleTab === 'patterns' && (
              <div className="space-y-3">
                <p className="text-xs text-text-1">
                  Key resilience patterns and architectural invariants demanded by recruiters for this milestone:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded border border-line bg-card space-y-1">
                    <div className="font-mono font-semibold text-text-0 flex items-center gap-1.5">
                      <Code2 className="w-3.5 h-3.5 text-emerald-text" />
                      <span>Zero-Loss Idempotency</span>
                    </div>
                    <p className="text-text-1 leading-relaxed">
                      Atomic SET NX PX with sliding TTL window; constant-time subtle comparison for HMAC headers.
                    </p>
                  </div>

                  <div className="p-3 rounded border border-line bg-card space-y-1">
                    <div className="font-mono font-semibold text-text-0 flex items-center gap-1.5">
                      <FileCode className="w-3.5 h-3.5 text-emerald-text" />
                      <span>Telemetry Invariants</span>
                    </div>
                    <p className="text-text-1 leading-relaxed">
                      Sub-50ms p99 latency target; deterministic test suite execution without flaky asynchronous timeouts.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Loading State */}
            {isLoadingCoach && (
              <div className="p-4 rounded-radius border border-line bg-card flex items-center gap-3 text-xs md:text-sm text-text-1">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-text" />
                <span>AI Mentor synthesizing architectural trade-offs for @{user.username}...</span>
              </div>
            )}

            {/* Live Guidance Output Console */}
            {promptOutput && (
              <div className="p-5 rounded-radius border border-emerald-border bg-emerald-tint/20 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-emerald-border/40 text-xs font-mono">
                  <div className="flex items-center gap-2 text-emerald-text font-semibold">
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Personalized Architectural Analysis</span>
                  </div>
                  <span className="text-text-1">DevLedgr AI Mesh</span>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none text-xs sm:text-sm leading-relaxed text-text-0 font-sans whitespace-pre-wrap">
                  {promptOutput}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Column: Roadmap Sidebar */}
        <div className="space-y-4">
          <div className="border border-line bg-card/60 p-5 space-y-4 rounded-radius">
            <div className="flex items-center justify-between pb-2 border-b border-line text-xs font-mono">
              <span className="font-semibold text-text-0 uppercase">Curriculum Roadmap</span>
              <span className="text-emerald-text font-bold">
                {itinerary.milestones.filter((m) => m.ideaIdRef && userSolvedIdeaIds.has(m.ideaIdRef)).length} / {itinerary.milestones.length}
              </span>
            </div>

            <div className="space-y-2.5">
              {itinerary.milestones.map((m) => {
                const isDone = m.ideaIdRef ? userSolvedIdeaIds.has(m.ideaIdRef) : false;
                const isCurrent = m.week === activeWeek;

                return (
                  <button
                    key={m.week}
                    onClick={() => {
                      setActiveWeek(m.week);
                      setPromptOutput(null);
                      setActivePromptLabel(null);
                    }}
                    className={`w-full text-left p-2.5 rounded transition-all flex items-center gap-3 cursor-pointer ${
                      isCurrent
                        ? 'bg-card border border-emerald/50 shadow-xs'
                        : 'hover:bg-card/60'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        isDone
                          ? 'bg-emerald text-white'
                          : isCurrent
                          ? 'border border-emerald text-emerald-text font-mono'
                          : 'border border-line text-text-1 font-mono'
                      }`}
                    >
                      {isDone ? '✓' : m.week}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className={`font-medium text-xs truncate ${isCurrent ? 'text-text-0 font-semibold' : 'text-text-1'}`}>
                        {m.title}
                      </div>
                      <div className="text-xs text-text-1 font-mono">
                        Week 0{m.week} · {isDone ? 'Sealed' : 'Pending'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-3 border-t border-line text-xs text-text-1 leading-relaxed space-y-2">
              <div className="flex items-center gap-1.5 text-text-0 font-medium font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-text" />
                <span>1-Year Cryptographic Seal</span>
              </div>
              <p>
                Stamping each deliverable generates a signed commit hash with certified latency percentiles and test pass verification.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
