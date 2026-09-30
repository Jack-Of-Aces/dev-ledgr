'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { TerminalExplorer } from '@/components/ui/TerminalExplorer';
import { SubmitSolutionModal } from '@/components/ui/SubmitSolutionModal';
import { LedgerEntryRow } from '@/components/ui/LedgerEntryRow';
import { ArrowLeft, Clock, ExternalLink, GitBranch, ShieldCheck, Flame, Loader2 } from 'lucide-react';
import { getDomainStyle, getDifficultyStyle } from '@/lib/colors';
import { IdeaDetailSkeleton } from '@/components/ui/skeletons';
import { launchpadService } from '@/services/launchpad/launchpadService';
import { ProblemClaimStatus, IdeaItem } from '@/types';

export default function IdeaDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { ideas, submissions, isLoggedIn, showToast, openAuthModal } = useAppStore();
  const [currentIdea, setCurrentIdea] = useState<IdeaItem | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [claimStatus, setClaimStatus] = useState<ProblemClaimStatus | null>(null);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    let active = true;
    if (!id) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    setLoading(true);
    setNotFound(false);
    // Prefer the already-hydrated row, then fall back to the API. Never fall
    // back to ideas[0]: an id that resolves to nothing must say so rather than
    // render a different problem under the requested URL.
    const found = ideas.find((i) => i.id === id);
    if (found) {
      setCurrentIdea(found);
      setLoading(false);
    } else {
      setCurrentIdea(undefined);
      launchpadService
        .getProblemById(id)
        .then((p) => {
          if (!active) return;
          if (p) {
            setCurrentIdea(p);
          } else {
            setNotFound(true);
          }
        })
        .catch(() => {
          if (active) setNotFound(true);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }
    launchpadService.getStatus(id).then((status) => {
      if (active && status) setClaimStatus(status);
    }).catch(() => {});
    return () => {
      active = false;
    };
  }, [id, ideas]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClaim = async () => {
    if (!isLoggedIn) {
      showToast({
        title: 'Authentication Required',
        message: 'Sign in to claim this Launchpad challenge and register as builder.',
      });
      openAuthModal();
      return;
    }

    setClaiming(true);
    try {
      const res = await launchpadService.claimProblem(id);
      setClaimStatus(res);
      showToast({
        title: 'Challenge Claimed!',
        message: 'You are now registered as the active builder for this challenge.',
      });
    } catch (err: unknown) {
      showToast({
        title: 'Claim Failed',
        message: err instanceof Error ? err.message : 'Could not claim challenge.',
      });
    } finally {
      setClaiming(false);
    }
  };

  const handleSubmitSolutionClick = () => {
    if (!isLoggedIn) {
      showToast({
        title: 'Authentication Required',
        message: 'Please sign in with your developer account to submit solutions and seal your cryptographic proof.',
      });
      openAuthModal();
      return;
    }
    setModalOpen(true);
  };

  const idea = currentIdea;

  if (!mounted || loading) {
    return <IdeaDetailSkeleton />;
  }

  if (!idea || notFound) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 md:py-16 space-y-6 text-center">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-0">
          Problem not found
        </h1>
        <p className="text-sm text-text-1 max-w-md mx-auto leading-relaxed">
          No problem matches this id. It may have been unpublished or removed
          from the bank.
        </p>
        <Link
          href="/ideas"
          className="btn-brass text-xs md:text-sm py-2 px-4 inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Idea Bank</span>
        </Link>
      </div>
    );
  }

  const problemSubmissions = submissions.filter((s) => s.ideaId === idea.id);
  const domainStyle = getDomainStyle(idea.domain);
  const diffStyle = getDifficultyStyle(idea.difficulty);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 md:py-16 space-y-10">
      {/* Navigation Breadcrumb */}
      <div>
        <Link
          href="/ideas"
          className="inline-flex items-center gap-1.5 text-xs md:text-sm font-mono text-text-1 hover:text-text-0 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Idea Bank</span>
        </Link>
      </div>

      {/* Hero Problem Overview */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs md:text-sm">
          <span className={`uppercase tracking-wider px-2.5 py-1 rounded border text-xs md:text-sm font-semibold ${domainStyle.badge}`}>
            {domainStyle.name}
          </span>
          <span className={`px-2.5 py-1 rounded border text-xs md:text-sm font-medium ${diffStyle.badge}`}>
            {diffStyle.name}
          </span>
          <span className="flex items-center gap-1 text-text-1">
            <Clock className="w-3 h-3" />
            Estimated ~{idea.estimatedHours} hours
          </span>
          {claimStatus && (
            <span
              className={`px-2.5 py-1 rounded border text-xs font-mono uppercase font-semibold ${
                claimStatus.status === 'open'
                  ? 'border-emerald-border bg-emerald-tint text-emerald-text'
                  : claimStatus.status === 'in_progress'
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'border-line bg-card text-text-1'
              }`}
            >
              {claimStatus.status === 'open'
                ? 'Open for Claim'
                : claimStatus.status === 'in_progress'
                ? `In Progress${claimStatus.claimedBy ? ` (@${claimStatus.claimedBy.username})` : ''}`
                : claimStatus.status === 'seeking_contributors'
                ? 'Seeking Contributors'
                : 'Complete'}
            </span>
          )}
        </div>

        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-text-0 leading-tight">
          {idea.title}
        </h1>

        {idea.tagline && (
          <p style={{ maxWidth: '60ch' }} className="text-sm lg:text-base sm:text-base text-text-1 leading-relaxed">
            {idea.tagline}
          </p>
        )}

        {/* Action bar */}
        <div className="pt-2 flex flex-wrap items-center gap-3">
          {(!claimStatus || claimStatus.status === 'open') && (
            <button
              onClick={handleClaim}
              disabled={claiming}
              className="btn-outline text-xs md:text-sm py-2 px-4 cursor-pointer inline-flex items-center gap-2 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:border-amber-500"
            >
              {claiming ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Registering Claim...</span>
                </>
              ) : (
                <>
                  <Flame className="w-4 h-4 text-amber-500" />
                  <span>Claim Challenge</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={handleSubmitSolutionClick}
            className="btn-brass text-xs md:text-sm py-2 px-4 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Submit Solution & Docs</span>
          </button>

          {/* Only render when a starter repo actually exists: an empty href
              resolves to the current page, which looks like a dead button. */}
          {idea.mockInfra?.starterRepoUrl && (
            <a
              href={idea.mockInfra.starterRepoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline text-xs md:text-sm py-2 px-4 inline-flex items-center gap-2"
            >
              <GitBranch className="w-4 h-4 text-green-700 dark:text-green-400" />
              <span>Fork Starter Repo</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
          )}
        </div>
      </section>

      {/* Origin Story Context. Every field here is optional in the database: a
          problem sourced from a field report may carry no origin context at
          all, and an empty pair of quotation marks reads as broken data. */}
      {idea.originStory && (
        <section className="pl-4 border-l-2 border-line space-y-1.5 my-6">
          <div className="text-xs md:text-sm font-mono text-text-1 uppercase tracking-wider font-semibold">
            Operator Origin Dispatch
          </div>
          <p style={{ maxWidth: '60ch' }} className="italic text-sm lg:text-base sm:text-base text-text-0 leading-relaxed">
            &ldquo;{idea.originStory}&rdquo;
          </p>
        </section>
      )}

      {/* Technical Problem Brief */}
      <section className="space-y-3">
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-text-0">
          Technical Problem Statement
        </h2>
        <div style={{ maxWidth: '60ch' }} className="text-sm lg:text-base text-text-0 leading-relaxed whitespace-pre-line">
          <p className="leading-relaxed">{idea.problemStatement}</p>
        </div>
      </section>

      {/* Technical Requirements Checklist. Scraped problems frequently arrive
          with no structured requirements, so the section is hidden rather than
          showing a heading above an empty list. */}
      {idea.technicalRequirements?.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-text-0">
            Required Engineering Constraints
          </h2>
          <div style={{ maxWidth: '60ch' }} className="space-y-2.5 text-xs md:text-sm sm:text-sm lg:text-base">
            {idea.technicalRequirements.map((req, i) => (
              <div key={i} style={{ maxWidth: '60ch' }} className="flex items-start gap-2.5 text-text-0">
                <span className="text-text-1 font-mono font-medium mt-0.5 shrink-0">[{i + 1}]</span>
                <p className="leading-relaxed">{req}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Mock Infrastructure & Interactive Test Harness */}
      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-text-0">
            Starter Mock Infrastructure
          </h2>
          <p style={{ maxWidth: '60ch' }} className="text-xs md:text-sm text-text-1">
            {idea.mockInfra?.baseUrl
              ? 'This problem references a mock server. Requests are sent to the URL below and whatever comes back is shown as-is; if nothing is deployed there yet, the panel will say so.'
              : 'No mock server is attached to this problem yet, so there is nothing to ping here.'}
          </p>
        </div>

        <TerminalExplorer mockInfra={idea.mockInfra} />
      </section>

      {/* Verified Community Solutions for this Problem */}
      <section className="space-y-4 pt-6 border-t border-line">
        <div className="flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-text-0">
            Verified Submissions ({problemSubmissions.length})
          </h2>
          <span className="text-xs md:text-sm text-text-1">
            Permanently stamped commit records
          </span>
        </div>

        {problemSubmissions.length > 0 ? (
          <div className="rounded-radius border border-line bg-card/30 divide-y divide-line overflow-hidden">
            {problemSubmissions.map((sub) => (
              <LedgerEntryRow key={sub.hash} entry={sub} showIdeaLink={false} />
            ))}
          </div>
        ) : (
          <div className="p-6 sm:p-8 rounded-radius border border-dashed border-line text-center font-mono text-xs md:text-sm text-text-1 space-y-2">
            <div>No submissions recorded yet for this problem.</div>
            <button
              onClick={() => setModalOpen(true)}
              className="text-brass hover:underline font-semibold cursor-pointer"
            >
              Be the first engineer to merge proof →
            </button>
          </div>
        )}
      </section>

      {/* Submission Modal */}
      <SubmitSolutionModal
        idea={idea}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
