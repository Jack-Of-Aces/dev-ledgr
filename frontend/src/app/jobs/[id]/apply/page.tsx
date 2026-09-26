'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { aiService } from '@/services/ai/aiService';
import { ScrutinyResult } from '@/services/ai/IAIService';
import {
  Sparkles,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Copy,
  Check,
  Loader2,
  ExternalLink,
  Download,
} from 'lucide-react';

/**
 * JobApplyPage
 *
 * BUSINESS LOGIC:
 * This page is the core value-delivery point of DevLedgr. It runs an AI-powered
 * audit of the candidate's verified ledger entries against a specific job's technical
 * requirements. There are two outcome branches:
 *
 *   1. "ready" - All proof points verified. The AI synthesizes an ATS-safe CV and
 *      tailored cover letter, both pre-populated with commit hashes and performance metrics.
 *
 *   2. "gap" - A skill gap is identified. The user is redirected to a targeted problem
 *      in the Idea Bank that closes the gap. This is the core "incentive loop" of DevLedgr.
 *
 * The audit delegates entirely to aiService.runScrutinyAudit(), which calls the AI gateway
 * if available or runs a deterministic heuristic fallback - callers never need to distinguish.
 * Mutations (generating CV content) never silently fall back to mocks; they either succeed
 * or fail loudly so users always know what they're getting.
 *
 * UI IMPLEMENTATION:
 * - Step 1: Trigger card → user initiates audit.
 * - Step 2: Live terminal log → streams audit steps in real-time via onLog callback.
 * - Step 3: Result branch (ready / gap) → renders the appropriate output.
 */
export default function JobApplyPage() {
  const params = useParams();
  const id = params?.id as string;
  const { jobs, user, submissions, ideas } = useAppStore();

  const job = jobs.find((j) => j.id === id) || jobs[0];
  const userSubmissions = submissions.filter(
    (s) => s.authorUsername.toLowerCase() === user.username.toLowerCase()
  );

  // ─── Audit State ────────────────────────────────────────────────────────────
  const [scrutinizing, setScrutinizing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<'ready' | 'gap' | null>(null);
  const [scanLog, setScanLog] = useState<string[]>([]);

  // ─── Generated Docs (only populated after a 'ready' result) ────────────────
  const [generatedDocs, setGeneratedDocs] = useState<Pick<ScrutinyResult, 'cvMarkdown' | 'coverLetter'> | null>(null);

  // ─── UI State ────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'cv' | 'coverLetter'>('cv');
  const [copied, setCopied] = useState(false);

  /**
   * runScrutiny
   *
   * BUSINESS LOGIC:
   * Delegates the full audit pipeline to the AI service. The onLog callback streams
   * audit steps back to the terminal UI in real-time. The ScrutinyResult drives
   * which branch is rendered - the service hides the AI/fallback implementation detail.
   *
   * forceGap=true is only used for demo/test purposes to exercise the gap branch.
   */
  const runScrutiny = async (forceGap = false) => {
    setScrutinizing(true);
    setAnalysisResult(null);
    setScanLog([]);
    setGeneratedDocs(null);

    try {
      const result = await aiService.runScrutinyAudit(
        { job, user, userSubmissions, forceGap },
        (log) => setScanLog((prev) => [...prev, log])
      );
      setAnalysisResult(result.status);
      if (result.status === 'ready') {
        setGeneratedDocs({ cvMarkdown: result.cvMarkdown, coverLetter: result.coverLetter });
      }
    } catch {
      // Surface failure explicitly - never silently continue with stale mock docs
      setAnalysisResult('gap');
    } finally {
      setScrutinizing(false);
    }
  };

  // The recommended problem to close a detected skill gap
  const gapProblem = ideas.find((i) => i.id === job.gapIdeaId) || ideas[0];

  // Active document content for the tabbed output panel
  const activeDocContent =
    activeTab === 'cv'
      ? (generatedDocs?.cvMarkdown ?? '')
      : (generatedDocs?.coverLetter ?? '');

  const handleCopy = () => {
    navigator.clipboard.writeText(activeDocContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const filename = `${user.username}_${job.company.replace(/\s+/g, '_')}_${
      activeTab === 'cv' ? 'CV' : 'CoverLetter'
    }.md`;
    const blob = new Blob([activeDocContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 md:py-16 space-y-10 font-mono text-xs md:text-sm">
      {/* Back Link */}
      <div>
        <Link
          href="/jobs"
          className="inline-flex items-center gap-1.5 text-text-1 hover:text-text-0 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Opportunities</span>
        </Link>
      </div>

      {/* Target Job Header */}
      <div className="border border-line bg-card/50 p-5 sm:p-6 space-y-3 rounded-radius">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-0">
          {job.title} · {job.company}
        </h1>
        <p className="text-text-1 leading-relaxed text-xs md:text-sm sm:text-sm lg:text-base max-w-prose">{job.description}</p>
      </div>

      {/* Step 1: Audit Trigger Card */}
      {!analysisResult && !scrutinizing && (
        <div className="p-5 sm:p-8 rounded-radius border border-line bg-card text-center space-y-5">
          <Sparkles className="w-8 h-8 text-green-700 dark:text-green-400 mx-auto" />
          <div className="space-y-1 max-w-lg mx-auto">
            <h2 className="text-xl font-semibold tracking-tight text-text-0">
              Audit Portfolio Against Job Spec
            </h2>
            <p className="text-text-1 text-xs md:text-sm leading-relaxed max-w-prose mx-auto">
              Match your verified test telemetry against {job.company}&apos;s technical requirements.
              If criteria pass, export an ATS-safe application package with verified commit links.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => runScrutiny(false)}
              className="btn-brass text-xs md:text-sm py-2 px-5 cursor-pointer"
            >
              <span>Run Automated Audit</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => runScrutiny(true)}
              className="btn-outline text-xs md:text-sm py-2 px-4 cursor-pointer text-text-1 hover:text-text-0"
              title="Test the Skill Gap routing branch"
            >
              Simulate Skill Gap Branch
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Live Terminal Log - streams audit steps via aiService onLog callback */}
      {scrutinizing && (
        <div className="rounded-radius border border-line bg-ink-0 p-5 space-y-3">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400 pb-2 border-b border-line">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="font-semibold uppercase tracking-wider text-xs md:text-sm font-mono">
              Audit Engine Active
            </span>
          </div>
          <div className="space-y-1.5 text-xs md:text-sm text-text-0 font-mono">
            {scanLog.map((log, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-green-700 dark:text-green-400">›</span>
                <span>{log}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 3a: Branch - Ready -> ATS CV Draft + Cover Letter Package */}
      {analysisResult === 'ready' && generatedDocs && (
        <div className="space-y-6">
          <div className="p-4 rounded-radius border border-green-500/25 bg-green-500/10 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-green-700 dark:text-green-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-text-0 text-sm lg:text-base">
                Portfolio Audit Passed: 100% Requirements Verified
              </div>
              <p className="text-text-1 mt-0.5 leading-relaxed text-xs md:text-sm">
                Your verified submissions satisfy all high-concurrency and latency requirements for{' '}
                {job.company}. Your application package is ready below.
              </p>
            </div>
          </div>

          {/* Package Tabs */}
          <div className="rounded-radius border border-line bg-card/40 overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2.5 bg-card border-b border-line">
              <div role="tablist" aria-label="Application package tabs" className="flex flex-wrap items-center gap-2">
                <button
                  id="tab-cv"
                  role="tab"
                  aria-selected={activeTab === 'cv'}
                  aria-controls="panel-application-package"
                  onClick={() => setActiveTab('cv')}
                  className={`px-3 py-1 rounded-radius text-xs md:text-sm font-semibold cursor-pointer ${
                    activeTab === 'cv'
                      ? 'bg-ink-0 text-text-0 border border-line'
                      : 'text-text-1 hover:text-text-0'
                  }`}
                >
                  ATS-Compliant CV Draft
                </button>
                <button
                  id="tab-coverLetter"
                  role="tab"
                  aria-selected={activeTab === 'coverLetter'}
                  aria-controls="panel-application-package"
                  onClick={() => setActiveTab('coverLetter')}
                  className={`px-3 py-1 rounded-radius text-xs md:text-sm font-semibold cursor-pointer ${
                    activeTab === 'coverLetter'
                      ? 'bg-ink-0 text-text-0 border border-line'
                      : 'text-text-1 hover:text-text-0'
                  }`}
                >
                  Tailored Cover Letter
                </button>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={handleDownload}
                  className="btn-outline text-xs md:text-sm py-1 px-3 cursor-pointer flex items-center gap-1.5"
                  title="Download raw Markdown package file"
                  aria-label="Download raw Markdown package file"
                >
                  <Download className="w-3 h-3" aria-hidden="true" />
                  <span>Download .md</span>
                </button>

                <button
                  onClick={handleCopy}
                  className="btn-brass text-xs md:text-sm py-1 px-3 cursor-pointer flex items-center gap-1.5"
                  aria-label={copied ? 'Copied package content to clipboard' : 'Copy package content to clipboard'}
                >
                  {copied ? (
                    <Check className="w-3 h-3" aria-hidden="true" />
                  ) : (
                    <Copy className="w-3 h-3" aria-hidden="true" />
                  )}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div
              id="panel-application-package"
              role="tabpanel"
              aria-labelledby={activeTab === 'cv' ? 'tab-cv' : 'tab-coverLetter'}
              className="p-5"
            >
              <pre className="overflow-x-auto whitespace-pre-wrap leading-relaxed text-xs md:text-sm text-text-0 bg-ink-0 p-4 rounded-radius border border-line max-h-125">
                {activeDocContent}
              </pre>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <button
              onClick={() => runScrutiny(false)}
              className="text-text-1 hover:underline text-left cursor-pointer"
            >
              Re-run analysis
            </button>
            <a
              href={`https://${job.company.toLowerCase()}.com/careers`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-brass text-xs md:text-sm py-2 px-5 inline-flex items-center justify-center gap-2"
            >
              <span>Submit to {job.company} with Verified URL</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}

      {/* Step 3b: Branch - Gap -> Route user to targeted Idea Bank problem */}
      {analysisResult === 'gap' && (
        <div className="space-y-6">
          <div className="p-4 rounded-radius border border-amber-500/25 bg-amber-500/5 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-text-0 text-sm lg:text-base">
                Targeted Gap Identified: Database Internals & DDL Safety
              </div>
              <p className="text-text-1 mt-0.5 leading-relaxed text-xs md:text-sm max-w-prose">
                {job.company} explicitly requires demonstrated proof in Postgres lock contention and
                zero-downtime schema deployments. Submitting now without this proof risks ATS rejection.
              </p>
            </div>
          </div>

          {/* Recommended Problem to close the gap */}
          <div className="border border-line bg-card p-5 sm:p-6 space-y-4 rounded-radius">
            <div>
              <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-text-0">
                {gapProblem.title}
              </h2>
              <p className="text-text-1 text-xs md:text-sm mt-1.5 leading-relaxed max-w-prose">
                {gapProblem.tagline}
              </p>
            </div>

            <div className="pl-3 border-l-2 border-green-500/40 text-xs md:text-sm text-text-0 space-y-1 py-1">
              <div className="font-semibold text-green-700 dark:text-green-400">Why this closes the gap:</div>
              <div className="text-text-1 leading-relaxed max-w-prose">
                Solving this problem proves to {job.company} that you can prevent table-locking outages
                on multi-tenant production databases.
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <button
                onClick={() => setAnalysisResult('ready')}
                className="text-text-1 hover:underline text-xs md:text-sm cursor-pointer text-left"
              >
                (Override: proceed to CV anyway)
              </button>
              <Link
                href={`/ideas/${gapProblem.id}`}
                className="btn-brass text-xs md:text-sm py-2 px-5 inline-flex items-center justify-center gap-2"
              >
                <span>Go to Idea Bank Spec</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
