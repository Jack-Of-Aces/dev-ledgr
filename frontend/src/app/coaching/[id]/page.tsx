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
import { SubmitSolutionModal } from '@/components/ui/SubmitSolutionModal';
import { getMilestoneConcept } from '@/lib/coaching-content';
import { FormattedMarkdown } from '@/components/ui/FormattedMarkdown';
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
  UploadCloud,
  CheckSquare,
  Copy,
  Check,
  Terminal,
  BookOpen,
  Layers,
  AlertTriangle,
  Cpu,
  Maximize2,
  Minimize2,
  Edit3,
} from 'lucide-react';

type ConsoleTab = 'socratic' | 'custom' | 'patterns' | 'harness';
type ConceptTab = 'diagram' | 'invariants' | 'failure-modes' | 'blueprint';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timeLabel: string;
  provider?: string;
  model?: string;
}

let messageSeq = 0;
function createMessage(
  role: 'user' | 'assistant',
  content: string,
  meta?: { provider?: string; model?: string }
): ChatMessage {
  messageSeq += 1;
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return {
    id: `msg-${messageSeq}`,
    role,
    content,
    timeLabel: `${hours}:${minutes}`,
    provider: meta?.provider,
    model: meta?.model,
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
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [checkedCriteria, setCheckedCriteria] = useState<Record<string, boolean>>({});
  const [conceptTab, setConceptTab] = useState<ConceptTab>('diagram');
  const [isDiagramExpanded, setIsDiagramExpanded] = useState(false);
  const [isChatMaximized, setIsChatMaximized] = useState(false);
  const [copiedBlueprint, setCopiedBlueprint] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const handleCopyCurl = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedCurl(true);
      setTimeout(() => setCopiedCurl(false), 2000);
    }
  };

  const handleCopyBlueprint = (code: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedBlueprint(true);
      setTimeout(() => setCopiedBlueprint(false), 2000);
    }
  };

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

  // Load chat thread for the active milestone week from localStorage
  useEffect(() => {
    if (!itinerary?.id) return;
    const storageKey = `devledgr_coaching_chat_${itinerary.id}_w${activeWeek}`;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setChatMessages(parsed);
          return;
        }
      }
    } catch {
      // ignore JSON parse error
    }
    setChatMessages([]);
    setCustomQuestion('');
  }, [itinerary?.id, activeWeek]);

  // Persist chat thread to localStorage whenever messages update (if non-empty)
  useEffect(() => {
    if (!itinerary?.id || !mounted) return;
    const storageKey = `devledgr_coaching_chat_${itinerary.id}_w${activeWeek}`;
    try {
      if (chatMessages.length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(chatMessages));
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch {
      // ignore storage quota errors
    }
  }, [itinerary?.id, activeWeek, chatMessages, mounted]);

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
  const nextMilestone = itinerary.milestones.find((m) => m.week === activeWeek + 1);

  const isMilestoneSolved = selectedMilestone.ideaIdRef
    ? userSolvedIdeaIds.has(selectedMilestone.ideaIdRef)
    : false;

  const solvedMilestoneSubmission = selectedMilestone.ideaIdRef
    ? userSubmissions.find((s) => s.ideaId === selectedMilestone.ideaIdRef)
    : undefined;

  const pairedIdea = selectedMilestone.ideaIdRef
    ? ideas.find((i) => i.id === selectedMilestone.ideaIdRef)
    : undefined;

  const milestoneConcept = getMilestoneConcept(itinerary.id, selectedMilestone.week);

  useEffect(() => {
    setConceptTab('diagram');
    setIsDiagramExpanded(false);
  }, [activeWeek]);

  const handleRunPrompt = async (promptText: string) => {
    if (!promptText.trim() || isLoadingCoach) return;
    const userMsg = createMessage('user', promptText.trim());
    const nextMessages = [...chatMessages, userMsg];

    // Create an empty assistant message slot immediately so tokens stream into it
    const assistantMsg = createMessage('assistant', '', {
      provider: 'connecting',
      model: 'mesh-streaming',
    });

    setChatMessages([...nextMessages, assistantMsg]);
    setIsLoadingCoach(true);

    try {
      await aiService.getCoachingAdviceStream(
        {
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
        },
        (chunk) => {
          // Progressively append streaming token chunk to the active assistant message
          setChatMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsg.id
                ? { ...msg, content: msg.content + chunk }
                : msg
            )
          );
        },
        (meta) => {
          // Update model and provider badges as soon as the model handshake completes
          setChatMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsg.id
                ? { ...msg, provider: meta.provider, model: meta.model }
                : msg
            )
          );
        }
      );
    } catch {
      setChatMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsg.id
            ? {
                ...msg,
                content:
                  msg.content ||
                  'Unable to reach the coaching intelligence network. Please verify your connection or retry.',
                provider: 'error',
                model: 'network',
              }
            : msg
        )
      );
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
    if (itinerary?.id) {
      const storageKey = `devledgr_coaching_chat_${itinerary.id}_w${activeWeek}`;
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
    }
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
            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
              <Link href="/coaching" className="hover:text-text-0 transition-colors shrink-0">
                Coaching
              </Link>
              <ChevronRight className="w-3.5 h-3.5 opacity-40 shrink-0" />
              <span className="text-text-0 font-medium truncate max-w-[150px] sm:max-w-xs">
                {itinerary.title}
              </span>
              <ChevronRight className="w-3.5 h-3.5 opacity-40 shrink-0" />
              <span className="text-emerald-text shrink-0">Week 0{selectedMilestone.week}</span>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0 text-xs flex-wrap">
              <span className="truncate">
                Candidate: <strong className="text-text-0 font-medium">@{user.username}</strong>
              </span>
              <span className="text-line">/</span>
              <span className="text-emerald-text font-medium shrink-0">
                {
                  itinerary.milestones.filter(
                    (m) => m.ideaIdRef && userSolvedIdeaIds.has(m.ideaIdRef)
                  ).length
                }{' '}
                of {itinerary.milestones.length} Stamped
              </span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 sm:gap-6">
            <div className="space-y-2 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-tint border border-emerald-border text-emerald-text font-mono font-medium shrink-0">
                  {itinerary.durationWeeks}-Week Career Flight Plan
                </span>
                <span className="text-xs font-mono text-text-1">
                  Target: {itinerary.targetRole}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-text-0">
                {itinerary.title}
              </h1>
              <p className="text-xs sm:text-sm text-text-1 leading-relaxed">
                {itinerary.subtitle}
              </p>
            </div>

            <Link
              href="/coaching"
              className="btn-outline text-xs py-2 px-3 self-stretch sm:self-auto shrink-0 inline-flex items-center justify-center gap-1.5 font-mono w-full sm:w-auto"
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
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

              {/* ========================================================= */}
              {/* CONCEPT MASTERCLASS & VISUAL ARCHITECTURE BLUEPRINT       */}
              {/* ========================================================= */}
              {milestoneConcept && (
                <div className="rounded-radius border border-line bg-card space-y-4 p-4 sm:p-5">
                  <div className="space-y-3.5 pb-3 border-b border-line">
                    <div className="space-y-1.5 w-full">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-tint border border-emerald-border text-emerald-text uppercase flex items-center gap-1 shrink-0">
                          <BookOpen className="w-3 h-3" />
                          <span>System Masterclass</span>
                        </span>
                        <span className="text-xs font-mono text-text-1 flex items-center gap-1 shrink-0">
                          <Cpu className="w-3 h-3 text-text-1/70" />
                          <span>Week 0{selectedMilestone.week} Core Engineering</span>
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-bold tracking-tight text-text-0">
                        {milestoneConcept.conceptTitle}
                      </h3>
                    </div>

                    {/* Mode Tabs on dedicated row */}
                    <div className="flex items-center gap-1 bg-ink-0 p-1 rounded border border-line text-xs font-mono w-fit max-w-full overflow-x-auto">
                      <button
                        type="button"
                        onClick={() => setConceptTab('diagram')}
                        className={`px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                          conceptTab === 'diagram'
                            ? 'bg-card text-text-0 font-medium border border-line shadow-xs'
                            : 'text-text-1 hover:text-text-0'
                        }`}
                      >
                        <Layers className="w-3.5 h-3.5 text-emerald-text shrink-0" />
                        <span>Visual Architecture</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConceptTab('invariants')}
                        className={`px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                          conceptTab === 'invariants'
                            ? 'bg-card text-text-0 font-medium border border-line shadow-xs'
                            : 'text-text-1 hover:text-text-0'
                        }`}
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-text shrink-0" />
                        <span>Invariants ({milestoneConcept.coreConcepts.length})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConceptTab('failure-modes')}
                        className={`px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                          conceptTab === 'failure-modes'
                            ? 'bg-card text-text-0 font-medium border border-line shadow-xs'
                            : 'text-text-1 hover:text-text-0'
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>Failure Modes ({milestoneConcept.failureModes.length})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConceptTab('blueprint')}
                        className={`px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                          conceptTab === 'blueprint'
                            ? 'bg-card text-text-0 font-medium border border-line shadow-xs'
                            : 'text-text-1 hover:text-text-0'
                        }`}
                      >
                        <Code2 className="w-3.5 h-3.5 text-emerald-text shrink-0" />
                        <span>Blueprint</span>
                      </button>
                    </div>
                  </div>

                  {/* Executive Summary Callout */}
                  <div className="p-3.5 rounded bg-ink-0/60 border-l-2 border-emerald text-xs sm:text-sm text-text-0 leading-relaxed font-sans">
                    <p className="italic">{milestoneConcept.executiveSummary}</p>
                  </div>

                  {/* Tab 1: Visual Architecture Diagram */}
                  {conceptTab === 'diagram' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs font-mono text-text-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-text-0">{milestoneConcept.diagramTitle}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-ink-0 border border-line">
                            Vector SVG
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsDiagramExpanded(!isDiagramExpanded)}
                          className="btn-outline text-[11px] py-0.5 px-2 inline-flex items-center gap-1 font-mono cursor-pointer"
                        >
                          {isDiagramExpanded ? (
                            <>
                              <Minimize2 className="w-3 h-3" />
                              <span>Compact View</span>
                            </>
                          ) : (
                            <>
                              <Maximize2 className="w-3 h-3" />
                              <span>Wide View</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div
                        className={`p-4 sm:p-6 rounded border border-line bg-ink-0/80 overflow-x-auto transition-all ${
                          isDiagramExpanded ? 'max-h-none' : 'max-h-[520px]'
                        }`}
                      >
                        <div
                          className="w-full min-w-[700px] flex items-center justify-center text-text-0"
                          dangerouslySetInnerHTML={{ __html: milestoneConcept.diagramSvg }}
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono pt-1 text-text-1">
                        <div className="flex items-center gap-2 p-2 rounded bg-ink-0/40 border border-line/40">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald shrink-0" />
                          <span>Emerald: Verified Ingestion & Atomic Commit Boundary</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 rounded bg-ink-0/40 border border-line/40">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                          <span>Amber / Red: Network Dropped Timeouts & Traps</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 rounded bg-ink-0/40 border border-line/40">
                          <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shrink-0" />
                          <span>Cyan: Memory Caches, Filters & State Buffers</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tab 2: Core Engineering Invariants */}
                  {conceptTab === 'invariants' && (
                    <div className="space-y-3">
                      <p className="text-xs text-text-1">
                        Principal invariants that must never be violated when implementing this milestone:
                      </p>
                      <div className="grid grid-cols-1 gap-3">
                        {milestoneConcept.coreConcepts.map((c, idx) => (
                          <div key={idx} className="p-3.5 rounded border border-line bg-ink-0/40 space-y-2">
                            <h4 className="text-xs sm:text-sm font-semibold text-text-0 flex items-center gap-2">
                              <span className="text-emerald-text font-mono font-bold">0{idx + 1}.</span>
                              <span>{c.title}</span>
                            </h4>
                            <p className="text-xs text-text-1 leading-relaxed">
                              {c.description}
                            </p>
                            <div className="pt-2 border-t border-line/40 space-y-1">
                              <div className="text-[11px] font-mono text-emerald-text font-semibold uppercase">
                                Non-Negotiable Invariants:
                              </div>
                              <ul className="space-y-1">
                                {c.invariants.map((inv, invIdx) => (
                                  <li key={invIdx} className="flex items-start gap-2 text-xs text-text-0">
                                    <span className="text-emerald font-bold">✓</span>
                                    <span>{inv}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tab 3: Production Failure Modes */}
                  {conceptTab === 'failure-modes' && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs text-text-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>Real-world postmortems from scaled production systems:</span>
                      </div>
                      <div className="space-y-3">
                        {milestoneConcept.failureModes.map((fm, idx) => (
                          <div
                            key={idx}
                            className="p-3.5 rounded border border-line bg-ink-0/40 space-y-2 text-xs"
                          >
                            <div className="flex items-start gap-2">
                              <span className="px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-500 font-mono text-[10px] uppercase font-bold shrink-0">
                                Common Trap
                              </span>
                              <span className="font-medium text-text-0">{fm.trap}</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-mono text-[10px] uppercase font-bold shrink-0">
                                System Impact
                              </span>
                              <span className="text-text-1">{fm.impact}</span>
                            </div>
                            <div className="flex items-start gap-2 pt-1 border-t border-line/40">
                              <span className="px-1.5 py-0.5 rounded bg-emerald-tint border border-emerald-border text-emerald-text font-mono text-[10px] uppercase font-bold shrink-0">
                                Production Fix
                              </span>
                              <span className="text-text-0 font-medium">{fm.remediation}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tab 4: Reference Implementation Blueprint */}
                  {conceptTab === 'blueprint' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-text-0">{milestoneConcept.codeSnippet.filename}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-ink-0 border border-line uppercase">
                            {milestoneConcept.codeSnippet.language}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyBlueprint(milestoneConcept.codeSnippet.code)}
                          className="btn-outline text-[11px] py-0.5 px-2 inline-flex items-center gap-1 font-mono cursor-pointer"
                        >
                          {copiedBlueprint ? (
                            <>
                              <Check className="w-3 h-3 text-emerald" />
                              <span>Copied Blueprint</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy Blueprint</span>
                            </>
                          )}
                        </button>
                      </div>

                      <pre className="p-3.5 rounded bg-ink-0 border border-line text-xs font-mono text-text-0 overflow-x-auto whitespace-pre leading-relaxed">
                        {milestoneConcept.codeSnippet.code}
                      </pre>

                      <div className="p-2.5 rounded bg-ink-0/40 border border-line/40 text-xs text-text-1">
                        <span className="font-semibold text-text-0">Architectural Rationale: </span>
                        {milestoneConcept.codeSnippet.explanation}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Prompt transition to Paired Problem */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2 text-xs font-mono text-text-1">
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-text" />
                  <span className="font-semibold text-text-0">Paired Verifiable Implementation Challenge</span>
                  <span className="hidden sm:inline text-[11px] opacity-75">— Apply these invariants to pass automated verification:</span>
                </div>
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

                    <div className="shrink-0 flex items-center gap-2 w-full sm:w-auto">
                      {isMilestoneSolved && solvedMilestoneSubmission ? (
                        <div className="flex flex-col xs:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                          <button
                            onClick={() => setSubmitModalOpen(true)}
                            className="btn-outline text-xs py-2 px-3 inline-flex items-center justify-center gap-1.5 font-medium cursor-pointer w-full xs:w-auto hover:border-text-0"
                            title="Edit and re-submit your solution"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span>Edit Solution</span>
                          </button>
                          <Link
                            href={`/p/${user.username}#${solvedMilestoneSubmission.hash}`}
                            className="btn-outline text-xs py-2 px-3 inline-flex items-center justify-center gap-1.5 font-mono w-full xs:w-auto text-emerald-text border-emerald-border/60 bg-emerald-tint"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald shrink-0" />
                            <span>Proof #{solvedMilestoneSubmission.hash.slice(0, 8)}</span>
                            <ExternalLink className="w-3 h-3 opacity-60 shrink-0" />
                          </Link>
                          {nextMilestone && (
                            <button
                              onClick={() => setActiveWeek(nextMilestone.week)}
                              className="btn-brass text-xs py-2 px-3 inline-flex items-center justify-center gap-1.5 font-medium cursor-pointer w-full xs:w-auto"
                            >
                              <span>Next: Week 0{nextMilestone.week}</span>
                              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col xs:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                          <button
                            onClick={() => setSubmitModalOpen(true)}
                            className="btn-brass text-xs py-2 px-3.5 inline-flex items-center justify-center gap-1.5 font-medium cursor-pointer shadow-xs w-full xs:w-auto"
                          >
                            <UploadCloud className="w-3.5 h-3.5 shrink-0" />
                            <span>Submit Solution & Pass Milestone</span>
                          </button>
                          <Link
                            href={`/ideas/${pairedIdea.id}`}
                            className="btn-outline text-xs py-2 px-3 inline-flex items-center justify-center gap-1.5 font-mono w-full xs:w-auto"
                          >
                            <span>Mock Infra Specs</span>
                            <ArrowRight className="w-3 h-3 shrink-0" />
                          </Link>
                        </div>
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
            <div
              className={`p-5 sm:p-6 rounded-radius border border-line bg-card/60 space-y-5 transition-all duration-200 ${
                isChatMaximized
                  ? 'fixed inset-2 sm:inset-6 z-50 bg-background/95 backdrop-blur-md shadow-2xl overflow-y-auto max-h-[96vh] flex flex-col justify-between'
                  : ''
              }`}
            >
              <div className="space-y-3.5 pb-3 border-b border-line">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 text-xs font-mono text-emerald-text font-semibold uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Socratic Architectural Guidance</span>
                    </div>
                    <h3 className="text-base sm:text-lg font-semibold text-text-0">
                      Principal Systems Architect Mentor
                    </h3>
                  </div>

                  {/* Maximize / Restore Screen Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setIsChatMaximized(!isChatMaximized)}
                    className="btn-outline text-xs py-1.5 px-2.5 inline-flex items-center gap-1.5 font-mono text-text-1 hover:text-text-0 cursor-pointer shrink-0"
                    title={isChatMaximized ? 'Restore normal view' : 'Maximize chat console to full screen'}
                  >
                    {isChatMaximized ? (
                      <>
                        <Minimize2 className="w-3.5 h-3.5 text-emerald" />
                        <span className="hidden xs:inline">Restore</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 className="w-3.5 h-3.5 text-text-1 hover:text-emerald" />
                        <span className="hidden xs:inline">Maximize</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 max-w-full">
                  {chatMessages.length > 0 && (
                    <button
                      onClick={handleResetChat}
                      className="btn-outline text-xs py-1 px-2.5 inline-flex items-center gap-1 font-mono text-text-1 hover:text-text-0 cursor-pointer shrink-0"
                      title="Clear chat and start fresh"
                    >
                      <RotateCcw className="w-3 h-3 shrink-0" />
                      <span>Reset</span>
                    </button>
                  )}

                  {/* Mode Switcher */}
                  <div className="flex items-center gap-1 bg-ink-0 p-1 rounded border border-line text-xs font-mono w-fit max-w-full overflow-x-auto">
                    <button
                      onClick={() => setConsoleTab('socratic')}
                      className={`px-2.5 py-1 rounded transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
                        consoleTab === 'socratic'
                          ? 'bg-card text-text-0 font-medium border border-line shadow-xs'
                          : 'text-text-1 hover:text-text-0'
                      }`}
                    >
                      Prompts
                    </button>
                    <button
                      onClick={() => setConsoleTab('custom')}
                      className={`px-2.5 py-1 rounded transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
                        consoleTab === 'custom'
                          ? 'bg-card text-text-0 font-medium border border-line shadow-xs'
                          : 'text-text-1 hover:text-text-0'
                      }`}
                    >
                      Dialogue
                    </button>
                    <button
                      onClick={() => setConsoleTab('patterns')}
                      className={`px-2.5 py-1 rounded transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
                        consoleTab === 'patterns'
                          ? 'bg-card text-text-0 font-medium border border-line shadow-xs'
                          : 'text-text-1 hover:text-text-0'
                      }`}
                    >
                      Patterns
                    </button>
                    <button
                      onClick={() => setConsoleTab('harness')}
                      className={`px-2.5 py-1 rounded transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
                        consoleTab === 'harness'
                          ? 'bg-card text-text-0 font-medium border border-line shadow-xs'
                          : 'text-text-1 hover:text-text-0'
                      }`}
                    >
                      Grading & Criteria
                    </button>
                  </div>
                </div>
              </div>

              {/* Conversational Stream (if any messages exist) */}
              {chatMessages.length > 0 && (
                <div
                  ref={chatScrollRef}
                  className={`space-y-4 overflow-y-auto pr-1 text-xs sm:text-sm ${
                    isChatMaximized ? 'flex-1 max-h-[calc(88vh-220px)] min-h-[380px]' : 'max-h-[560px]'
                  }`}
                >
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-4 sm:p-5 rounded-radius space-y-3 ${
                        msg.role === 'user'
                          ? 'bg-ink-0 border border-line ml-4 sm:ml-12'
                          : 'bg-emerald-tint/20 border border-emerald-border/60 mr-2 sm:mr-6'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono pb-2 border-b border-line/40">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-semibold ${
                              msg.role === 'user' ? 'text-text-0' : 'text-emerald-text'
                            }`}
                          >
                            {msg.role === 'user' ? `@${user.username}` : 'Architect Mentor'}
                          </span>
                          {msg.role === 'assistant' && msg.model && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-ink-0 border border-line text-text-1 uppercase font-semibold">
                              {msg.provider === 'heuristic' ? 'Heuristic Mesh' : msg.model}
                            </span>
                          )}
                        </div>
                        <span className="text-text-1 font-mono text-[11px]">{msg.timeLabel}</span>
                      </div>
                      <div className="text-text-0 font-sans leading-relaxed">
                        {msg.role === 'assistant' ? (
                          msg.content ? (
                            <div>
                              <FormattedMarkdown content={msg.content} />
                              {isLoadingCoach && msg === chatMessages[chatMessages.length - 1] && (
                                <span className="inline-block w-2 h-4 ml-1 bg-emerald-text animate-pulse align-middle" />
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-text-1 font-mono text-xs py-1">
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-text" />
                              <span>Establishing neural handshake with AI Mesh...</span>
                            </div>
                          )
                        ) : (
                          <div className="whitespace-pre-wrap">{msg.content}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Initial Loading Skeleton (only before first token or if chat is empty) */}
              {isLoadingCoach && chatMessages.length === 0 && (
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
                    Ask any custom question, paste your interface design, or challenge a trade-off below. The mentor conducts deep design reviews and probes failure modes.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => handleRunPrompt(`What are the exact failure modes of this architecture during a network split, and how do we ensure recovery without data loss?`)}
                      disabled={isLoadingCoach}
                      className="p-2.5 rounded border border-line bg-card hover:border-emerald/60 text-left transition-colors cursor-pointer text-text-0"
                    >
                      <span className="font-semibold text-emerald-text">Network Partition Audit →</span>
                      <p className="text-text-1 text-[11px] mt-0.5">Explore split-brain risks and recovery invariants</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRunPrompt(`How do we benchmark and guarantee p99 tail latency under a 10x concurrency burst for this design?`)}
                      disabled={isLoadingCoach}
                      className="p-2.5 rounded border border-line bg-card hover:border-emerald/60 text-left transition-colors cursor-pointer text-text-0"
                    >
                      <span className="font-semibold text-emerald-text">p99 Tail Latency Audit →</span>
                      <p className="text-text-1 text-[11px] mt-0.5">Identify cache stampedes, lock contention, and queue delays</p>
                    </button>
                  </div>
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

              {/* TAB 4: Automated Grading, Acceptance Criteria & Harness */}
              {consoleTab === 'harness' && pairedIdea && (
                <div className="space-y-4 text-xs">
                  {/* Protocol Overview */}
                  <div className="p-3.5 rounded border border-line bg-card space-y-2">
                    <div className="flex items-center gap-2 font-mono font-semibold text-text-0">
                      <ShieldCheck className="w-4 h-4 text-emerald-text shrink-0" />
                      <span>End-to-End Verification & Automated Grading Protocol</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1 text-[11px] font-mono text-text-1">
                      <div className="p-2 rounded bg-ink-0 border border-line/60 space-y-1">
                        <div className="font-semibold text-text-0">1. Code In Repo</div>
                        <p className="font-sans leading-snug">
                          Implement the core constraints in your public GitHub repository using your chosen stack.
                        </p>
                      </div>
                      <div className="p-2 rounded bg-ink-0 border border-line/60 space-y-1">
                        <div className="font-semibold text-text-0">2. Live GitHub Audit</div>
                        <p className="font-sans leading-snug">
                          DevLedgr inspects the repo via GitHub API, extracting HEAD SHA, languages, and commit history.
                        </p>
                      </div>
                      <div className="p-2 rounded bg-ink-0 border border-line/60 space-y-1">
                        <div className="font-semibold text-text-0">3. Proof Fingerprint</div>
                        <p className="font-sans leading-snug">
                          Submitting stamps the milestone, mints a SHA-256 content address, and unlocks the next week.
                        </p>
                      </div>
                      <div className="p-2 rounded bg-ink-0 border border-line/60 space-y-1">
                        <div className="font-semibold text-text-0">4. Ledger Cert</div>
                        <p className="font-sans leading-snug">
                          Reviewers verify test criteria and mint an HMAC-signed ledger certificate for your portfolio.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Interactive Acceptance Criteria */}
                  {pairedIdea.mockInfra?.testCriteria && pairedIdea.mockInfra.testCriteria.length > 0 && (
                    <div className="p-3.5 rounded border border-line bg-card space-y-2.5">
                      <div className="flex items-center justify-between font-mono text-xs">
                        <span className="font-semibold text-text-0 flex items-center gap-1.5">
                          <CheckSquare className="w-3.5 h-3.5 text-emerald-text" />
                          <span>Acceptance Criteria Self-Audit Checklist</span>
                        </span>
                        <span className="text-[11px] text-text-1">
                          {Object.values(checkedCriteria).filter(Boolean).length} of{' '}
                          {pairedIdea.mockInfra.testCriteria.length} checked
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {pairedIdea.mockInfra.testCriteria.map((criterion, idx) => {
                          const isChecked = !!checkedCriteria[`${selectedMilestone.week}-${idx}`];
                          return (
                            <label
                              key={idx}
                              className="flex items-start gap-2.5 p-2 rounded hover:bg-ink-0 transition-colors cursor-pointer border border-transparent hover:border-line/40 text-xs"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) =>
                                  setCheckedCriteria((prev) => ({
                                    ...prev,
                                    [`${selectedMilestone.week}-${idx}`]: e.target.checked,
                                  }))
                                }
                                className="mt-0.5 rounded border-line text-emerald focus:ring-emerald cursor-pointer"
                              />
                              <span className={isChecked ? 'line-through text-text-1' : 'text-text-0'}>
                                {criterion}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Runnable cURL Harness */}
                  {pairedIdea.mockInfra?.curlExample && (
                    <div className="p-3.5 rounded border border-line bg-card space-y-2">
                      <div className="flex items-center justify-between font-mono text-xs">
                        <span className="font-semibold text-text-0 flex items-center gap-1.5">
                          <Terminal className="w-3.5 h-3.5 text-emerald-text" />
                          <span>Mock Infrastructure Test Command</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyCurl(pairedIdea.mockInfra.curlExample)}
                          className="btn-outline text-[11px] py-0.5 px-2 inline-flex items-center gap-1 font-mono cursor-pointer"
                        >
                          {copiedCurl ? (
                            <>
                              <Check className="w-3 h-3 text-emerald" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy cURL</span>
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="p-2.5 rounded bg-ink-0 border border-line/60 text-[11px] font-mono text-text-0 overflow-x-auto whitespace-pre">
                        {pairedIdea.mockInfra.curlExample}
                      </pre>
                    </div>
                  )}
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

      {pairedIdea && (
        <SubmitSolutionModal
          idea={pairedIdea}
          isOpen={submitModalOpen}
          onClose={() => setSubmitModalOpen(false)}
          onSuccess={() => {
            setSubmitModalOpen(false);
            if (nextMilestone) {
              setActiveWeek(nextMilestone.week);
            }
          }}
        />
      )}
    </AuthGuard>
  );
}
