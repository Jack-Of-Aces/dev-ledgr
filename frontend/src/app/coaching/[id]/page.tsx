'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { INITIAL_COACHING } from '@/lib/mock-data';
import { coachingService } from '@/services/coaching/coachingService';
import { launchpadService } from '@/services/launchpad/launchpadService';
import { CoachingItinerary } from '@/types';
import { aiService } from '@/services/ai/aiService';
import { CoachingSkeleton } from '@/components/ui/skeletons';
import { AuthGuard } from '@/components/auth/AuthGuard';
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Send,
  Code2,
  FileCode,
  ChevronRight,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';

type ConsoleTab = 'socratic' | 'custom' | 'patterns';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timeLabel: string;
}

let messageSeq = 0;
function createMessage(role: 'user' | 'assistant', content: string): ChatMessage {
  messageSeq += 1;
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return {
    id: `msg-${messageSeq}`,
    role,
    content,
    timeLabel: `${hours}:${minutes}`,
  };
}

export default function CoachingDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [itinerary, setItinerary] = useState<CoachingItinerary>(
    () => INITIAL_COACHING.find((c) => c.id === id) || INITIAL_COACHING[0]
  );

  const { user, submissions, ideas, setIdeas } = useAppStore();
  const userSubmissions = submissions.filter(
    (s) => s.authorUsername.toLowerCase() === user.username.toLowerCase()
  );
  // Stable string key so useMemo fires only when the actual set of solved IDs changes.
  const solvedKey = userSubmissions.map((s) => s.ideaId).sort().join(',');
  const userSolvedIdeaIds = React.useMemo(
    () => new Set(userSubmissions.map((s) => s.ideaId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [solvedKey]
  );

  // Ref mirror so the fetch effect can read the solved set without listing it as a dependency
  const userSolvedIdeaIdsRef = useRef(userSolvedIdeaIds);
  useEffect(() => {
    userSolvedIdeaIdsRef.current = userSolvedIdeaIds;
  }, [userSolvedIdeaIds]);

  // Default to first unsolved milestone if exists
  const initialWeek = itinerary.milestones.find(
    (m) => !m.ideaIdRef || !userSolvedIdeaIds.has(m.ideaIdRef)
  )?.week || 1;

  const [activeWeek, setActiveWeek] = useState(initialWeek);
  const [mounted, setMounted] = useState(false);
  const [consoleTab, setConsoleTab] = useState<ConsoleTab>('socratic');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [customQuestion, setCustomQuestion] = useState('');
  const [isLoadingCoach, setIsLoadingCoach] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    if (id) {
      coachingService
        .getItineraryById(id)
        .then((found) => {
          if (!found) return;
          setItinerary(found);
          const firstUnsolved = found.milestones.find(
            (m) => !m.ideaIdRef || !userSolvedIdeaIdsRef.current.has(m.ideaIdRef)
          );
          setActiveWeek(firstUnsolved?.week || found.milestones[0]?.week || 1);
        })
        .catch(() => {});
    }

    if (ideas.length === 0) {
      launchpadService
        .getProblems()
        .then((probs) => {
          if (probs && probs.length > 0) setIdeas(probs);
        })
        .catch(() => {});
    }
  }, [id, ideas.length, setIdeas]);

  // Clear chat thread when switching milestone weeks
  useEffect(() => {
    setChatMessages([]);
    setCustomQuestion('');
  }, [activeWeek]);

  // Auto-scroll chat to latest message
  useEffect(() => {
    if (chatMessages.length > 0 && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, isLoadingCoach]);

  // Arrow-key navigation across the milestone tablist (WAI-ARIA tabs pattern).
  const handleMilestoneKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const weeks = itinerary.milestones.map((m) => m.week);
    if (weeks.length === 0) return;
    const currentIndex = weeks.indexOf(activeWeek);
    if (currentIndex === -1) return;

    let nextIndex: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % weeks.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + weeks.length) % weeks.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = weeks.length - 1;
    }

    if (nextIndex === null) return;
    e.preventDefault();
    const nextWeek = weeks[nextIndex];
    setActiveWeek(nextWeek);
    document.getElementById(`tab-week-${nextWeek}`)?.focus();
  };

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

  const handleRunPrompt = async (promptText: string) => {
    if (!promptText.trim() || isLoadingCoach) return;
    const userMsg = createMessage('user', promptText.trim());
    const nextMessages = [...chatMessages, userMsg];
    setChatMessages(nextMessages);
    setIsLoadingCoach(true);

    try {
      const advice = await aiService.getCoachingAdvice({
        itineraryTitle: itinerary.title,
        milestoneTitle: selectedMilestone.title,
        prompt: promptText.trim(),
        messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        candidateContext: {
          username: user.username,
          name: user.name,
          headline: user.headline,
          statedSkills: user.statedSkills,
          verifiedProofCount: userSubmissions.length,
          solvedIdeaTitles: userSubmissions.map((s) => s.ideaTitle),
        },
      });

      const assistantMsg = createMessage('assistant', advice);
      setChatMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const errorMsg = createMessage(
        'assistant',
        'Unable to reach the coaching intelligence network. Please verify your connection or retry.'
      );
      setChatMessages((prev) => [...prev, errorMsg]);
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

  const handleResetChat = () => {
    setChatMessages([]);
    setCustomQuestion('');
  };

  if (!mounted || !itinerary) {
    return <CoachingSkeleton />;
  }

  return (
    <AuthGuard fallbackMessage="Access to structured career coaching curriculums and the interactive Socratic architecture console requires an active developer account.">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-12 space-y-8 font-sans">
        {/* ========================================================= */}
        {/* 1. BREADCRUMBS & EXECUTIVE HEADER                         */}
        {/* ========================================================= */}
        <section className="space-y-4 pb-6 border-b border-line">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs font-mono text-text-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <Link href="/coaching" className="hover:text-text-0 transition-colors shrink-0">
                Coaching
              </Link>
              <ChevronRight className="w-3.5 h-3.5 opacity-40 shrink-0" />
              <span className="text-text-0 font-medium truncate max-w-[130px] sm:max-w-xs">
                {itinerary.title}
              </span>
              <ChevronRight className="w-3.5 h-3.5 opacity-40 shrink-0" />
              <span className="text-emerald-text shrink-0">Week 0{selectedMilestone.week}</span>
            </div>

            <div className="flex items-center gap-3 shrink-0 text-xs">
              <span>
                Candidate: <strong className="text-text-0 font-medium">@{user.username}</strong>
              </span>
              <span className="text-line">/</span>
              <span className="text-emerald-text font-medium">
                {
                  itinerary.milestones.filter(
                    (m) => m.ideaIdRef && userSolvedIdeaIds.has(m.ideaIdRef)
                  ).length
                }{' '}
                of {itinerary.milestones.length} Stamped
              </span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-tint border border-emerald-border text-emerald-text font-mono font-medium shrink-0">
                  {itinerary.durationWeeks}-Week Career Flight Plan
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
              className="btn-outline text-xs py-2 px-3 self-start md:self-auto shrink-0 inline-flex items-center justify-center gap-1.5 font-mono w-full sm:w-auto"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>All Curriculums</span>
            </Link>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 2. MILESTONE STEPPER NAVIGATION BAR                       */}
        {/* ========================================================= */}
        <div
          role="tablist"
          aria-label="Curriculum milestone sequence"
          className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-2.5 pb-2"
          onKeyDown={handleMilestoneKeyDown}
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
                tabIndex={isCurrent ? 0 : -1}
                onClick={() => setActiveWeek(m.week)}
                className={`p-2.5 sm:p-3 rounded-radius border text-left transition-all cursor-pointer space-y-1.5 ${
                  isCurrent
                    ? 'border-emerald bg-card shadow-xs ring-1 ring-emerald/30'
                    : 'border-line bg-card/60 hover:border-text-1/60'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-mono">
                  <span
                    className={`font-semibold ${isCurrent ? 'text-emerald-text' : 'text-text-1'}`}
                  >
                    WEEK 0{m.week}
                  </span>
                  {isDone ? (
                    <span className="text-emerald-text inline-flex items-center gap-0.5 text-[11px] sm:text-xs font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Stamped</span>
                    </span>
                  ) : (
                    <span className="text-text-1 text-[11px] sm:text-xs">Pending</span>
                  )}
                </div>
                <div className="text-xs font-medium text-text-0 line-clamp-1">{m.title}</div>
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
                    <span>Stamped Proof: #{solvedMilestoneSubmission?.hash?.slice(0, 10)}</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-mono font-medium shrink-0">
                    <span>Awaiting Implementation</span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="text-xs font-mono text-text-1 uppercase tracking-wider">
                  Target Deliverable:
                </div>
                <p className="text-xs sm:text-sm text-text-0 leading-relaxed font-medium">
                  {selectedMilestone.deliverable}
                </p>
              </div>

              {/* Paired Problem Spec Card */}
              {pairedIdea ? (
                <div className="p-4 rounded-radius border border-line bg-card space-y-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono uppercase tracking-wider text-text-1">
                          Verifiable Launchpad Challenge:
                        </span>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-ink-0 text-text-0 border border-line capitalize">
                          {pairedIdea.domain}
                        </span>
                      </div>
                      <h3 className="font-semibold text-sm sm:text-base text-text-0">
                        {pairedIdea.title}
                      </h3>
                      {pairedIdea.tagline && (
                        <p className="text-xs text-text-1 line-clamp-2">
                          {pairedIdea.tagline}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {isMilestoneSolved && solvedMilestoneSubmission ? (
                        <Link
                          href={`/p/${user.username}#${solvedMilestoneSubmission.hash}`}
                          className="btn-outline text-xs py-1.5 px-3 inline-flex items-center gap-1.5 font-mono"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald" />
                          <span>View Proof Certificate</span>
                          <ExternalLink className="w-3 h-3 opacity-60" />
                        </Link>
                      ) : (
                        <Link
                          href={`/ideas/${pairedIdea.id}`}
                          className="btn-brass text-xs py-2 px-3.5 inline-flex items-center justify-center gap-1.5 font-medium"
                        >
                          <span>Claim & Build Challenge</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>

                  {pairedIdea.technicalRequirements && pairedIdea.technicalRequirements.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-line/40">
                      <div className="text-[11px] font-mono text-text-1 uppercase">
                        Core Constraints to Satisfy:
                      </div>
                      <ul className="text-xs text-text-0 space-y-1">
                        {pairedIdea.technicalRequirements.slice(0, 3).map((req, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-emerald-text font-bold">›</span>
                            <span>{req}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-line/40 text-xs font-mono text-text-1">
                    <div>
                      Difficulty: <span className="text-text-0 capitalize">{pairedIdea.difficulty}</span>
                    </div>
                    <div>
                      Est. Hours: <span className="text-text-0">~{pairedIdea.estimatedHours}h</span>
                    </div>
                    <div>
                      Submissions: <span className="text-text-0">{pairedIdea.submissionCount}</span>
                    </div>
                    <div>
                      Status:{' '}
                      <span
                        className={
                          isMilestoneSolved
                            ? 'text-emerald font-semibold'
                            : 'text-text-0 capitalize'
                        }
                      >
                        {isMilestoneSolved ? 'Verified Solved' : 'Pending Proof'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded border border-dashed border-line text-xs font-mono text-text-1">
                  Loading challenge specification from problem repository...
                </div>
              )}
            </div>

            {/* Interactive Socratic AI Architecture Console */}
            <div className="p-5 sm:p-6 rounded-radius border border-line bg-card/60 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-xs font-mono text-emerald-text font-semibold uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Socratic Architectural Guidance</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold text-text-0">
                    Principal Systems Architect Mentor
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  {chatMessages.length > 0 && (
                    <button
                      onClick={handleResetChat}
                      className="btn-outline text-xs py-1 px-2.5 inline-flex items-center gap-1 font-mono text-text-1 hover:text-text-0 cursor-pointer"
                      title="Clear chat and start fresh"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  )}

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
                      Dialogue
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
              </div>

              {/* Conversational Stream (if any messages exist) */}
              {chatMessages.length > 0 && (
                <div
                  ref={chatScrollRef}
                  className="space-y-4 max-h-[460px] overflow-y-auto pr-1 text-xs sm:text-sm"
                >
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-4 rounded-radius space-y-2 ${
                        msg.role === 'user'
                          ? 'bg-ink-0 border border-line ml-4 sm:ml-12'
                          : 'bg-emerald-tint/20 border border-emerald-border/60 mr-4 sm:mr-8'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-mono pb-1 border-b border-line/40">
                        <span
                          className={`font-semibold ${
                            msg.role === 'user' ? 'text-text-0' : 'text-emerald-text'
                          }`}
                        >
                          {msg.role === 'user' ? `@${user.username}` : 'Architect Mentor (DevLedgr AI Mesh)'}
                        </span>
                        <span className="text-text-1 font-mono text-[11px]">{msg.timeLabel}</span>
                      </div>
                      <div className="prose prose-sm dark:prose-invert max-w-none text-text-0 font-sans leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Loading State */}
              {isLoadingCoach && (
                <div className="p-4 rounded-radius border border-line bg-card space-y-3 text-xs md:text-sm">
                  <div className="flex items-center gap-3 text-text-1 font-mono">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-text shrink-0" />
                    <span>Architect Mentor analyzing system failure modes for @{user.username}...</span>
                  </div>
                  <div className="space-y-2 pt-1 pl-7">
                    <div className="h-3.5 w-full bg-line rounded skeleton-shimmer" />
                    <div className="h-3.5 w-4/5 bg-line rounded skeleton-shimmer" />
                    <div className="h-3.5 w-2/3 bg-line rounded skeleton-shimmer" />
                  </div>
                </div>
              )}

              {/* TAB 1: Socratic Architectural Dilemmas */}
              {consoleTab === 'socratic' && (
                <div className="space-y-3">
                  <p className="text-xs text-text-1">
                    Click an architectural dilemma below to debate trade-offs tuned to your stack (
                    {user.statedSkills?.slice(0, 3).join(', ') || 'Go, TypeScript, PostgreSQL'}).
                  </p>

                  <div className="grid grid-cols-1 gap-2">
                    {selectedMilestone.prompts.map((p, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleRunPrompt(p)}
                        disabled={isLoadingCoach}
                        className="w-full text-left p-3.5 rounded-radius border border-line bg-card hover:border-emerald/60 transition-all flex items-center justify-between group cursor-pointer text-xs sm:text-sm text-text-0"
                      >
                        <span className="font-medium">&ldquo;{p}&rdquo;</span>
                        <Sparkles className="w-3.5 h-3.5 text-emerald-text opacity-70 group-hover:opacity-100 shrink-0 ml-3" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 2: Custom In-Depth Discussion */}
              {consoleTab === 'custom' && (
                <div className="space-y-3">
                  <p className="text-xs text-text-1">
                    Ask an architectural question or paste your interface definition. The mentor provides critical design feedback and failure mode stress-testing.
                  </p>
                </div>
              )}

              {/* TAB 3: Reference Patterns */}
              {consoleTab === 'patterns' && (
                <div className="space-y-3">
                  <p className="text-xs text-text-1">
                    Key resilience patterns and architectural invariants demanded by engineering leads for this milestone:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded border border-line bg-card space-y-1">
                      <div className="font-mono font-semibold text-text-0 flex items-center gap-1.5">
                        <Code2 className="w-3.5 h-3.5 text-emerald-text" />
                        <span>Zero-Loss Idempotency</span>
                      </div>
                      <p className="text-text-1 leading-relaxed">
                        Atomic distributed locking with sliding TTL window; constant-time subtle comparison for HMAC signatures.
                      </p>
                    </div>

                    <div className="p-3 rounded border border-line bg-card space-y-1">
                      <div className="font-mono font-semibold text-text-0 flex items-center gap-1.5">
                        <FileCode className="w-3.5 h-3.5 text-emerald-text" />
                        <span>Telemetry Verification</span>
                      </div>
                      <p className="text-text-1 leading-relaxed">
                        Measured p99 latency target; deterministic test suite execution without asynchronous race conditions.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Persistent Input Bar */}
              <form onSubmit={handleCustomQuestionSubmit} className="pt-2">
                <div className="relative">
                  <input
                    type="text"
                    value={customQuestion}
                    onChange={(e) => setCustomQuestion(e.target.value)}
                    placeholder={
                      chatMessages.length === 0
                        ? `Ask an architectural question about ${selectedMilestone.title}...`
                        : `Ask a follow-up or challenge this trade-off...`
                    }
                    disabled={isLoadingCoach}
                    className="w-full pl-3.5 pr-11 py-2.5 rounded-radius border border-line bg-card text-xs sm:text-sm text-text-0 placeholder:text-text-1 focus:border-emerald focus:outline-none font-sans"
                  />
                  <button
                    type="submit"
                    disabled={!customQuestion.trim() || isLoadingCoach}
                    aria-label="Send message to mentor"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-emerald-text hover:bg-emerald-tint disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right 1 Column: Roadmap Sidebar */}
          <div className="space-y-4">
            <div className="border border-line bg-card/60 p-5 space-y-4 rounded-radius">
              <div className="flex items-center justify-between pb-2 border-b border-line text-xs font-mono">
                <span className="font-semibold text-text-0 uppercase">Curriculum Roadmap</span>
                <span className="text-emerald-text font-bold">
                  {
                    itinerary.milestones.filter(
                      (m) => m.ideaIdRef && userSolvedIdeaIds.has(m.ideaIdRef)
                    ).length
                  }{' '}
                  / {itinerary.milestones.length}
                </span>
              </div>

              <div className="space-y-2.5">
                {itinerary.milestones.map((m) => {
                  const isDone = m.ideaIdRef ? userSolvedIdeaIds.has(m.ideaIdRef) : false;
                  const isCurrent = m.week === activeWeek;

                  return (
                    <button
                      key={m.week}
                      onClick={() => setActiveWeek(m.week)}
                      className={`w-full text-left p-2.5 rounded transition-all flex items-center gap-3 cursor-pointer ${
                        isCurrent
                          ? 'bg-card border border-emerald/50 shadow-xs ring-1 ring-emerald/20'
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
                        <div
                          className={`font-medium text-xs truncate ${
                            isCurrent ? 'text-text-0 font-semibold' : 'text-text-1'
                          }`}
                        >
                          {m.title}
                        </div>
                        <div className="text-xs text-text-1 font-mono">
                          Week 0{m.week} · {isDone ? 'Stamped' : 'Pending'}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-line text-xs text-text-1 leading-relaxed space-y-2">
                <div className="flex items-center gap-1.5 text-text-0 font-medium font-mono">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-text" />
                  <span>Verified Proof Stamping</span>
                </div>
                <p>
                  Stamping each deliverable generates a signed commit hash with certified latency percentiles and test pass verification recorded on your permanent portfolio.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
