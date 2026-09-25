'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { TerminalExplorer } from '@/components/ui/TerminalExplorer';
import { SubmitSolutionModal } from '@/components/ui/SubmitSolutionModal';
import { LedgerEntryRow } from '@/components/ui/LedgerEntryRow';
import { ArrowLeft, Clock, ExternalLink, GitBranch, ShieldCheck } from 'lucide-react';
import { getDomainStyle, getDifficultyStyle } from '@/lib/colors';

export default function IdeaDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { ideas, submissions } = useAppStore();
  const [modalOpen, setModalOpen] = useState(false);

  const idea = ideas.find((i) => i.id === id) || ideas[0];
  const problemSubmissions = submissions.filter((s) => s.ideaId === idea.id);
  const domainStyle = getDomainStyle(idea.domain);
  const diffStyle = getDifficultyStyle(idea.difficulty);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 md:py-16 space-y-10">
      {/* Navigation Breadcrumb */}
      <div>
        <Link
          href="/ideas"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-text-1 hover:text-text-0 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Idea Bank</span>
        </Link>
      </div>

      {/* Hero Problem Overview */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <span className={`uppercase tracking-wider px-2.5 py-1 rounded border text-xs font-semibold ${domainStyle.badge}`}>
            {domainStyle.name}
          </span>
          <span className={`px-2.5 py-1 rounded border text-xs font-medium ${diffStyle.badge}`}>
            {diffStyle.name}
          </span>
          <span className="flex items-center gap-1 text-text-1">
            <Clock className="w-3 h-3" />
            Estimated ~{idea.estimatedHours} hours
          </span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-text-0 leading-tight">
          {idea.title}
        </h1>

        <p style={{ maxWidth: '60ch' }} className="text-sm sm:text-base text-text-1 leading-relaxed">
          {idea.tagline}
        </p>

        {/* Action bar */}
        <div className="pt-2 flex flex-wrap items-center gap-3">
          <button
            onClick={() => setModalOpen(true)}
            className="btn-brass text-xs py-2 px-4 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Submit Solution & Docs</span>
          </button>

          <a
            href={idea.mockInfra.starterRepoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline text-xs py-2 px-4 inline-flex items-center gap-2"
          >
            <GitBranch className="w-4 h-4 text-green-700 dark:text-green-400" />
            <span>Fork Starter Repo</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
        </div>
      </section>

      {/* Origin Story Context */}
      <section className="pl-4 border-l-2 border-line space-y-1.5 my-6">
        <div className="text-xs font-mono text-text-1 uppercase tracking-wider font-semibold">
          Operator Origin Dispatch
        </div>
        <p style={{ maxWidth: '60ch' }} className="italic text-sm sm:text-base text-text-0 leading-relaxed">
          &ldquo;{idea.originStory}&rdquo;
        </p>
      </section>

      {/* Technical Problem Brief */}
      <section className="space-y-3">
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-text-0">
          Technical Problem Statement
        </h2>
        <div style={{ maxWidth: '60ch' }} className="text-sm text-text-0 leading-relaxed whitespace-pre-line">
          <p className="leading-relaxed">{idea.problemStatement}</p>
        </div>
      </section>

      {/* Technical Requirements Checklist */}
      <section className="space-y-3">
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-text-0">
          Required Engineering Constraints
        </h2>
        <div style={{ maxWidth: '60ch' }} className="space-y-2.5 text-xs sm:text-sm">
          {idea.technicalRequirements.map((req, i) => (
            <div key={i} style={{ maxWidth: '60ch' }} className="flex items-start gap-2.5 text-text-0">
              <span className="text-text-1 font-mono font-medium mt-0.5 shrink-0">[{i + 1}]</span>
              <p className="leading-relaxed">{req}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Mock Infrastructure & Interactive Test Harness */}
      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-text-0">
            Starter Mock Infrastructure
          </h2>
          <p style={{ maxWidth: '60ch' }} className="text-xs text-text-1">
            Build against this live mock server. You can simulate requests and verify JSON contract schemas directly below.
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
          <span className="text-xs text-text-1">
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
          <div className="p-6 sm:p-8 rounded-radius border border-dashed border-line text-center font-mono text-xs text-text-1 space-y-2">
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
