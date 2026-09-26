'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { INITIAL_COACHING } from '@/lib/mock-data';
import { aiService } from '@/services/ai/aiService';
import { ArrowLeft, Terminal, Sparkles, Loader2 } from 'lucide-react';

export default function CoachingDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const itinerary = INITIAL_COACHING.find((c) => c.id === id) || INITIAL_COACHING[0];
  const [activeWeek, setActiveWeek] = useState(1);
  const [promptOutput, setPromptOutput] = useState<string | null>(null);
  const [isLoadingCoach, setIsLoadingCoach] = useState(false);

  const selectedMilestone =
    itinerary.milestones.find((m) => m.week === activeWeek) || itinerary.milestones[0];

  const handleRunPrompt = async (prompt: string) => {
    setPromptOutput(null);
    setIsLoadingCoach(true);
    try {
      const advice = await aiService.getCoachingAdvice({
        itineraryTitle: itinerary.title,
        milestoneTitle: selectedMilestone.title,
        prompt,
      });
      setPromptOutput(advice);
    } catch {
      setPromptOutput('Unable to load coaching guidance. Please try again.');
    } finally {
      setIsLoadingCoach(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 md:py-16 space-y-8 text-sm lg:text-base font-sans">
      <div>
        <Link
          href="/coaching"
          className="inline-flex items-center gap-1.5 text-xs md:text-sm text-text-1 hover:text-text-0 transition-colors font-mono"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Coaching Itineraries</span>
        </Link>
      </div>

      <div style={{ maxWidth: '54ch' }} className="space-y-2 pb-6 border-b border-line">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-text-0">
          {itinerary.title}
        </h1>
        <div className="text-xs md:text-sm font-mono text-green-700 dark:text-green-400 font-medium">
          4-Week Track · Target: {itinerary.targetRole}
        </div>
        <p style={{ maxWidth: '54ch' }} className="text-text-1 text-xs md:text-sm sm:text-sm lg:text-base leading-relaxed pt-1">
          {itinerary.subtitle}
        </p>
      </div>

      {/* Week Selector Tabs */}
      <div role="tablist" aria-label="Curriculum milestone weeks" className="flex border-b border-line gap-2 overflow-x-auto px-1 pt-1 text-xs md:text-sm">
        {itinerary.milestones.map((m) => (
          <button
            key={m.week}
            id={`tab-week-${m.week}`}
            role="tab"
            aria-selected={activeWeek === m.week}
            aria-controls={`panel-week-${m.week}`}
            onClick={() => {
              setActiveWeek(m.week);
              setPromptOutput(null);
            }}
            className={`px-3 py-2 cursor-pointer font-medium transition-colors border-b-2 whitespace-nowrap -mb-px ${
              activeWeek === m.week
                ? 'border-green-600 dark:border-green-400 text-text-0'
                : 'border-transparent text-text-1 hover:text-text-0'
            }`}
          >
            Week {m.week}: {m.title}
          </button>
        ))}
      </div>

      {/* Milestone Detail Card */}
      <div
        id={`panel-week-${selectedMilestone.week}`}
        role="tabpanel"
        aria-labelledby={`tab-week-${selectedMilestone.week}`}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        <div style={{ maxWidth: '65ch' }} className="md:col-span-2 space-y-5 rounded-radius border border-line bg-card/40 p-5 sm:p-6">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-text-0">
              {selectedMilestone.title}
            </h2>
            <p className="text-text-0 pt-1 leading-relaxed text-xs md:text-sm sm:text-sm lg:text-base">
              {selectedMilestone.deliverable}
            </p>
          </div>

          {selectedMilestone.ideaIdRef && (
            <div className="pl-3 border-l-2 border-green-500/40 flex flex-wrap items-center justify-between gap-2 text-xs md:text-sm py-1">
              <span className="text-text-1">Paired Challenge Spec:</span>
              <Link
                href={`/ideas/${selectedMilestone.ideaIdRef}`}
                className="text-green-700 dark:text-green-400 hover:underline font-mono font-medium"
              >
                Inspect Problem Spec →
              </Link>
            </div>
          )}

          {/* Socratic Prompts */}
          <div style={{ maxWidth: '65ch' }} className="space-y-3 pt-3">
            <h3 className="text-xs md:text-sm font-semibold text-text-0">
              Interactive Guided Prompts
            </h3>
            <div className="space-y-2">
              {selectedMilestone.prompts.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleRunPrompt(p)}
                  className="w-full text-left p-3 rounded-radius border border-line bg-card hover:border-green-500/50 text-text-0 text-xs md:text-sm transition-colors flex items-center justify-between group cursor-pointer"
                >
                  <span>&ldquo;{p}&rdquo;</span>
                  <Sparkles className="w-3.5 h-3.5 text-green-700 dark:text-green-400 opacity-60 group-hover:opacity-100 shrink-0 ml-2" />
                </button>
              ))}
            </div>
          </div>

          {isLoadingCoach && (
            <div className="p-4 rounded-radius border border-line bg-ink-0 flex items-center gap-2 text-xs md:text-sm text-text-1">
              <Loader2 className="w-4 h-4 animate-spin text-text-0" />
              <span>Generating guidance...</span>
            </div>
          )}

          {promptOutput && (
            <div className="p-4 rounded-radius border border-green-500/20 bg-ink-0 space-y-2">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400 text-xs md:text-sm font-semibold font-mono">
                <Terminal className="w-3.5 h-3.5" />
                <span>Coach Guidance</span>
              </div>
              <pre className="text-xs md:text-sm font-mono leading-relaxed text-text-0 whitespace-pre-wrap">
                {promptOutput}
              </pre>
            </div>
          )}
        </div>

        {/* Sidebar Summary */}
        <div className="border border-line bg-card/20 p-5 space-y-4 rounded-radius">
          <h3 className="text-base font-semibold text-text-0">
            Track Progress
          </h3>
          <div className="space-y-3 text-xs md:text-sm">
            {itinerary.milestones.map((m) => (
              <div
                key={m.week}
                className="flex items-center gap-2.5 text-text-1"
              >
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-xs md:text-sm font-bold ${
                    m.week < activeWeek
                      ? 'bg-green-600 dark:bg-green-500 text-white dark:text-black'
                      : m.week === activeWeek
                      ? 'border border-green-600 dark:border-green-400 text-green-700 dark:text-green-400 font-mono'
                      : 'border border-line font-mono'
                  }`}
                >
                  {m.week < activeWeek ? '✓' : m.week}
                </span>
                <span className={m.week === activeWeek ? 'text-text-0 font-medium' : ''}>
                  {m.title}
                </span>
              </div>
            ))}
          </div>

          <div
            style={{ maxWidth: '40ch' }}
            className="pt-4 border-t border-line text-xs md:text-sm text-text-1 leading-relaxed"
          >
            Completing this itinerary provides 4 verified commits, unlocking automatic 90%+ match scoring on junior platform roles.
          </div>
        </div>
      </div>
    </div>
  );
}
