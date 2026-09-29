'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { aiService } from '@/services/ai/aiService';
import { ScrutinyResult } from '@/services/ai/IAIService';
import { JobApplySkeleton } from '@/components/ui/skeletons';
import { jobService } from '@/services/jobs/jobService';
import { JobOpportunity } from '@/types';
import { AuthGuard } from '@/components/auth/AuthGuard';
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

import { launchpadService } from '@/services/launchpad/launchpadService';
import { JobDescription } from '@/components/jobs/JobDescription';

export default function JobApplyPage() {
  const params = useParams();
  const id = params?.id as string;
  const { jobs, user, submissions, ideas, setIdeas } = useAppStore();
  const [mounted, setMounted] = useState(false);

  const [currentJob, setCurrentJob] = useState<JobOpportunity | undefined>(() => jobs.find((j) => j.id === id));

  useEffect(() => {
    setMounted(true);
    let active = true;

    if (id) {
      const found = jobs.find((j) => j.id === id);
      if (found) {
        setCurrentJob(found);
      } else {
        jobService.getJobById(id).then((fetched) => {
          if (active && fetched) {
            setCurrentJob(fetched);
          }
        }).catch(() => {});
      }
    }

    launchpadService.getProblems().then((problems) => {
      if (active && problems && problems.length > 0) {
        setIdeas(problems);
      }
    }).catch(() => {});

    return () => {
      active = false;
    };
  }, [id, jobs, setIdeas]);

  // Resolve the job by id only. This used to fall back to jobs[0], which meant
  // a deleted, inactive or mistyped id rendered a completely different posting
  // — the page confidently showed another company's title, description and
  // match score with nothing to indicate the id was wrong. That matters more
  // now that admins can deactivate jobs: pulling a listing quietly swaps in
  // an unrelated one.
  const job = currentJob || jobs.find((j) => j.id === id) || null;
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
  const runScrutiny = async (forceGap = false, overrideGap = false) => {
    // The callers all sit behind the `if (!job)` return below, but this is a
    // closure, so TypeScript cannot narrow `job` through the render gate.
    // Auditing against a null job is meaningless, so bail rather than assert.
    if (!job) return;

    setScrutinizing(true);
    setAnalysisResult(null);
    setScanLog([]);
    setGeneratedDocs(null);

    try {
      const result = await aiService.runScrutinyAudit(
        { job, user, userSubmissions, forceGap, overrideGap },
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

  // The recommended problem to close a detected skill gap. Resolved by id only,
  // for the same reason as the job above: presenting an unrelated problem as
  // "this closes your gap" is worse than presenting none.
  const gapProblem = job?.gapIdeaId ? ideas.find((i) => i.id === job.gapIdeaId) || null : null;

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
    if (!job) return;

    // Only whitespace used to be normalised, so path separators and other
    // reserved characters survived into the download attribute. Strip
    // anything that is not alphanumeric, dash, dot or underscore.
    const safeCompany = job.company.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^[._]+/, '');
    const filename = `${user.username}_${safeCompany || 'company'}_${
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

  if (!mounted) {
    return <JobApplySkeleton />;
  }

  // Previously this also covered !job, so a missing or inactive posting left
  // the skeleton spinning forever. jobService.getJobById swallows the 404 and
  // falls back to mock data, so nothing ever surfaced the failure.
  if (!job) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 md:py-16 space-y-6">
        <Link
          href="/jobs"
          className="inline-flex items-center gap-1.5 text-text-1 hover:text-text-0 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Opportunities</span>
        </Link>
        <div className="rounded-radius border border-line bg-card p-10 text-center space-y-3">
          <h1 className="text-xl font-semibold tracking-tight text-text-0 font-sans">
            This opportunity is no longer available
          </h1>
          <p className="text-xs md:text-sm text-text-1 leading-relaxed max-w-md mx-auto">
            The listing may have been closed or removed by the platform team.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AuthGuard fallbackMessage="You must be signed in with your developer account to run automated AI portfolio scrutiny and generate ATS-tailored application packages.">
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
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-0 break-words">
          {job.title} · {job.company}
        </h1>
        <JobDescription
          description={job.description}
          className="text-xs md:text-sm sm:text-sm lg:text-base max-w-prose"
        />
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
            <div className="flex items-center gap-2 pt-1 opacity-70">
              <span className="text-green-700 dark:text-green-400">›</span>
              <div className="h-3.5 w-52 bg-line rounded skeleton-shimmer" />
            </div>
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
              // The real listing URL, not a guess. This used to build
              // https://<company>.com/careers from the company name, which is
              // invented: it ignores the applyUrl and sourceUrl the API
              // actually returns, so for most of the bank it linked to a domain
              // that either does not exist or has no such page — presented to
              // the dev as a "Verified URL". Falls back to the source listing,
              // and only renders the button when one of them exists.
              href={job.applyUrl || job.sourceUrl || ''}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!job.applyUrl && !job.sourceUrl}
              className={`btn-brass text-xs md:text-sm py-2 px-5 inline-flex items-center justify-center gap-2 ${
                !job.applyUrl && !job.sourceUrl ? 'opacity-50 pointer-events-none' : ''
              }`}
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
            {gapProblem ? (
              <>
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
                    onClick={() => runScrutiny(false, true)}
                    className="text-text-1 hover:underline text-xs md:text-sm cursor-pointer text-left"
                  >
                    Generate the tailored package anyway
                  </button>
                  <Link
                    href={`/ideas/${gapProblem.id}`}
                    className="btn-brass text-xs md:text-sm py-2 px-5 inline-flex items-center justify-center gap-2"
                  >
                    <span>Go to Idea Bank Spec</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </>
            ) : (
              // The job points at a gap problem that is not in the bank we
              // loaded — a deactivated or unapproved one, most likely. Say so
              // instead of rendering an unrelated problem as the recommendation.
              <div className="space-y-3">
                <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-text-0">
                  Skill gap detected
                </h2>
                <p className="text-text-1 text-xs md:text-sm leading-relaxed max-w-prose">
                  This role has a proof gap, but the linked problem is not currently available in
                  the Idea Bank. Browse the bank to find a relevant spec.
                </p>
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-3">
                  <button
                    onClick={() => runScrutiny(false, true)}
                    className="text-text-1 hover:underline text-xs md:text-sm cursor-pointer text-left"
                  >
                    Generate the tailored package anyway
                  </button>
                  <Link
                    href="/ideas"
                    className="btn-brass text-xs md:text-sm py-2 px-5 inline-flex items-center justify-center gap-2"
                  >
                    <span>Browse Idea Bank</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </AuthGuard>
  );
}
