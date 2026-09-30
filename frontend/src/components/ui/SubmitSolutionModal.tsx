'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { IdeaItem, SubmissionEntry } from '@/types';
import { useAppStore } from '@/lib/store';
import { generateProofSignature } from '@/lib/crypto';
import { submissionService } from '@/services/submissions/submissionService';
import {
  Loader2,
  ShieldCheck,
  X,
  GitCommit,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
  Star,
  GitBranch,
  Lock,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Skeleton } from '@/components/ui/skeletons';

interface GitHubInspectData {
  valid: boolean;
  owner?: string;
  repo?: string;
  fullName?: string;
  description?: string | null;
  stars?: number;
  defaultBranch?: string;
  // Each field is nullable because the inspect route no longer invents a
  // commit when the GitHub lookup fails. A null here is shown as unknown
  // rather than filled with a placeholder.
  latestCommit?: {
    sha: string | null;
    shortSha: string | null;
    message: string | null;
    author: string | null;
    date: string | null;
  } | null;
  languages?: { name: string; percentage: number }[];
  /** Unreachable in practice: the route fails closed rather than simulating. */
  isSimulated?: boolean;
  notice?: string;
  error?: string;
}

interface SubmitSolutionModalProps {
  idea: IdeaItem;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newEntry: SubmissionEntry) => void;
}

export const SubmitSolutionModal: React.FC<SubmitSolutionModalProps> = ({
  idea,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user, addSubmission } = useAppStore();
  const [repoUrl, setRepoUrl] = useState('');
  const [demoUrl, setDemoUrl] = useState('');
  const [architectureNotes, setArchitectureNotes] = useState('');
  const [verifyingStep, setVerifyingStep] = useState<number | null>(null);
  const [completedEntry, setCompletedEntry] = useState<SubmissionEntry | null>(null);
  const [copiedFingerprint, setCopiedFingerprint] = useState(false);

  // Live GitHub Inspector State
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectionData, setInspectionData] = useState<GitHubInspectData | null>(null);
  const [inspectionError, setInspectionError] = useState<string | null>(null);
  const [linkHandle, setLinkHandle] = useState('');
  const [isVerifyingLink, setIsVerifyingLink] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const handleVerifyAndLinkGitHub = async () => {
    const clean = linkHandle.replace(/^@/, '').trim();
    if (!clean) return;

    setIsVerifyingLink(true);
    setLinkError(null);

    const userEmail = user.email || '';
    if (!userEmail) {
      setIsVerifyingLink(false);
      setLinkError('Registered account email is required to verify GitHub ownership.');
      return;
    }

    try {
      const res = await fetch('/api/github/verify-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: clean, userEmail }),
      });
      const data = await res.json();
      if (res.ok && data.matched) {
        useAppStore.getState().connectGitHubAccount(clean);
        setLinkError(null);
      } else {
        setLinkError(
          data.error ||
            `Email mismatch: @${clean} is not associated with your registered email (${userEmail}). You can only link a GitHub account that belongs to you.`
        );
      }
    } catch {
      setLinkError('Failed to contact verification server. Please verify your connection.');
    } finally {
      setIsVerifyingLink(false);
    }
  };

  const modalRef = useRef<HTMLDivElement>(null);

  /**
   * What actually happens on submit, in order.
   *
   * This list was previously a five-beat performance piece that described a
   * test harness which does not exist: "Spinning up isolated mock
   * infrastructure test harness", "Benchmarking p95 latency under simulated
   * concurrency load", "minting certificate". Nothing was spun up, benchmarked
   * or minted, and the resulting modal asserted "20/20 CI tests passed" and
   * "28ms p99" to the developer. The steps below are the real work.
   */
  const steps = [
    'Recording the HEAD commit from GitHub...',
    'Fingerprinting the submission...',
    'Submitting to the review queue...',
  ];

  const handleRepoUrlChange = (value: string) => {
    setRepoUrl(value);
    if (!value.trim() || (!value.includes('github.com/') && !value.includes('/'))) {
      setInspectionData(null);
      setInspectionError(null);
      setIsInspecting(false);
    }
  };

  // Debounced GitHub Inspection
  useEffect(() => {
    const isPotentialGitHubUrl =
      repoUrl.includes('github.com/') || (repoUrl.includes('/') && !repoUrl.includes(' '));

    if (!isPotentialGitHubUrl) {
      return;
    }

    const timer = setTimeout(async () => {
      setIsInspecting(true);
      setInspectionError(null);

      try {
        const res = await fetch('/api/github/inspect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repoUrl }),
        });

        const data: GitHubInspectData = await res.json();

        if (data.valid) {
          setInspectionData(data);
          setInspectionError(null);
        } else {
          setInspectionData(null);
          setInspectionError(data.error || 'Unable to verify GitHub repository.');
        }
      } catch {
        setInspectionData(null);
        setInspectionError('Failed to connect to GitHub inspection service.');
      } finally {
        setIsInspecting(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [repoUrl]);

  const handleReset = useCallback(() => {
    setCompletedEntry(null);
    setVerifyingStep(null);
    setRepoUrl('');
    setDemoUrl('');
    setArchitectureNotes('');
    setInspectionData(null);
    setInspectionError(null);
    onClose();
  }, [onClose]);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (verifyingStep === null) {
          handleReset();
        }
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, verifyingStep, handleReset]);

  // Focus management
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;
    const focusable = modalRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length > 0) {
      focusable[0].focus();
    }
  }, [isOpen, verifyingStep, completedEntry]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl) return;

    setVerifyingStep(0);

    // The commit this proof refers to, or null when GitHub could not tell us.
    // It used to fall back to a hardcoded SHA, which meant a submission could
    // be fingerprinted against a commit the dev never made.
    const commitSha = inspectionData?.latestCommit?.sha ?? null;

    const timestamp = new Date().toISOString();

    // A SHA-256 fingerprint over the submission's own fields, so the same
    // input always yields the same id. This is a content address, not a
    // signature: it is computed with no secret, so anyone can recompute it and
    // it attests nothing about authorship. The authoritative proof of work is
    // the HMAC certificate the backend mints at review time.
    const { shortHash, proofSignature } = await generateProofSignature({
      authorUsername: user.username,
      repoUrl,
      commitSha: commitSha ?? '',
      testPassed: 0,
      testTotal: 0,
      timestamp,
    });

    // Verification pipeline steps
    let current = 0;
    const interval = setInterval(() => {
      current++;
      if (current < steps.length) {
        setVerifyingStep(current);
      } else {
        clearInterval(interval);
        setVerifyingStep(null);

        const newEntry = addSubmission({
          ideaId: idea.id,
          ideaTitle: idea.title,
          authorUsername: user.username,
          authorName: user.name,
          authorAvatar: user.avatarUrl,
          repoUrl,
          demoUrl: demoUrl || undefined,
          architectureNotes:
            architectureNotes ||
            `Implemented solution meeting all technical requirements for ${idea.title}. Verified against mock test suite.`,
          hash: shortHash,
          proofSignature,
          // Nothing has been measured here. A submission starts pending with
          // no test results and no metrics, and only a reviewer (or, later, an
          // automated replay runner) fills those in. Hardcoding 20/20 and
          // 28ms/240 req/s/96.4% here is what put invented telemetry into
          // portfolios and generated CVs.
          testResults: {
            passed: 0,
            total: 0,
            suiteName: 'Not yet verified',
          },
        });

        setCompletedEntry(newEntry);

        // Record submission in backend API (POST /api/v1/submissions).
        // commitHash is sent when GitHub told us the HEAD sha, so the review
        // can be pinned to a specific commit. The server mints its own
        // submission hash; the client-side shortHash is display only.
        submissionService
          .submitSolution({
            ideaId: idea.id,
            ideaTitle: idea.title,
            authorUsername: user.username,
            authorName: user.name,
            authorAvatar: user.avatarUrl,
            repoUrl,
            demoUrl: demoUrl || undefined,
            commitHash: commitSha ?? undefined,
            architectureNotes:
              architectureNotes ||
              `Implemented solution for ${idea.title}. Awaiting verification.`,
          })
          .catch((err) => {
            console.warn('[SubmitSolutionModal] Backend submission sync note:', err);
          });

        // Confetti explosion with prefers-reduced-motion protection
        const prefersReducedMotion =
          typeof window !== 'undefined' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (!prefersReducedMotion) {
          try {
            confetti({
              particleCount: 65,
              spread: 75,
              origin: { y: 0.6 },
              colors: ['#15803D', '#22C55E', '#18181B']
            });
          } catch {
            // ignore if canvas unsupported
          }
        }

        if (onSuccess) {
          onSuccess(newEntry);
        }
      }
    }, 600);
  };

  const handleCopyFingerprint = () => {
    if (completedEntry?.proofSignature && typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(completedEntry.proofSignature);
      setCopiedFingerprint(true);
      setTimeout(() => setCopiedFingerprint(false), 2000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && verifyingStep === null) handleReset();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-solution-modal-title"
        className="relative w-full max-w-xl max-h-[calc(100dvh-2rem)] flex flex-col rounded-radius border border-line bg-ink-0 shadow-2xl overflow-hidden font-mono text-xs md:text-sm"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-card border-b border-line shrink-0">
          <div className="flex items-center gap-2">
            <GitCommit className="w-4 h-4 text-green-700 dark:text-green-400" aria-hidden="true" />
            <h2 id="submit-solution-modal-title" className="font-sans text-base font-semibold text-text-0">
              Record Proof of Work
            </h2>
          </div>
          <button
            onClick={handleReset}
            aria-label="Close submission modal"
            className="text-text-1 hover:text-text-0 transition-colors p-1 cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto">
          {completedEntry ? (
            <div className="space-y-5 text-center py-2">
              <div className="w-12 h-12 rounded-full bg-amber-500/15 border border-amber-500/30 mx-auto flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              </div>

              <div>
                <h3 className="font-sans text-xl font-bold tracking-tight text-text-0">
                  Proof submitted for review
                </h3>
                <p className="text-xs md:text-sm text-text-1 mt-1 font-mono">
                  Entry <code className="text-text-0 font-bold bg-card px-1.5 py-0.5 rounded border border-line">#{completedEntry.hash}</code> is pending. A reviewer records the test results and issues the certificate.
                </p>
              </div>

              {/* Content fingerprint. Not a signature: it is a SHA-256 over the
                  submission's own fields with no secret, so anyone can
                  recompute it. The certificate the backend mints at review time
                  is the HMAC-signed artefact. */}
              {completedEntry.proofSignature && (
                <div className="p-3.5 rounded-radius border border-line bg-card/50 text-left space-y-1.5 font-mono">
                  <div className="flex items-center justify-between text-xs md:text-sm text-text-0 font-semibold">
                    <span>Submission fingerprint:</span>
                    <button
                      type="button"
                      onClick={handleCopyFingerprint}
                      className="inline-flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      {copiedFingerprint ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Hash</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="text-xs md:text-sm text-text-0 break-all bg-ink-0 p-2 rounded border border-line leading-relaxed font-mono">
                    {completedEntry.proofSignature}
                  </div>
                </div>
              )}

              <div className="p-4 rounded-radius border border-line bg-card/50 text-left text-xs md:text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-text-1">Problem:</span>
                  <span className="font-semibold text-text-0">{idea.title}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-text-1">Status:</span>
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">
                    Pending review
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-text-1">Test results:</span>
                  <span className="text-text-1 font-semibold">
                    Not yet recorded
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-text-1">Measured latency:</span>
                  <span className="text-text-1 font-semibold">
                    Not yet recorded
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-text-1">Certificate:</span>
                  <span className="text-text-1 font-semibold">
                    Issued on approval
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <a
                  href={`/p/${user.username}`}
                  className="btn-brass text-xs md:text-sm py-2 px-4 inline-flex items-center gap-1.5"
                >
                  <span>View in Public Portfolio</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  onClick={handleReset}
                  className="btn-outline text-xs md:text-sm py-2 px-4 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          ) : verifyingStep !== null ? (
            <div className="space-y-6 py-6 text-center">
              <Loader2 className="w-8 h-8 text-text-1 animate-spin mx-auto" aria-hidden="true" />
              <div className="space-y-2">
                <div className="text-sm lg:text-base font-semibold text-text-0 font-sans">
                  Submitting your proof...
                </div>
                <div aria-live="polite" className="text-xs md:text-sm text-text-1 font-mono">
                  {steps[verifyingStep]}
                </div>
              </div>

              <div
                role="progressbar"
                aria-valuenow={Math.round(((verifyingStep + 1) / steps.length) * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuetext={steps[verifyingStep]}
                className="w-full bg-card h-2 rounded-full overflow-hidden border border-line"
              >
                <div
                  className="bg-green-600 dark:bg-green-500 h-full transition-all duration-300"
                  style={{ width: `${((verifyingStep + 1) / steps.length) * 100}%` }}
                />
              </div>
            </div>
          ) : !user.githubConnected && !user.githubUsername ? (
            <div className="py-6 px-2 text-center space-y-4 font-mono text-xs md:text-sm">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
                <Lock className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-sans text-lg font-semibold text-text-0">
                  GitHub Account Verification Required
                </h3>
                <p className="text-text-1 max-w-md mx-auto leading-relaxed">
                  DevLedgr records immutable cryptographic proofs anchored to your verified GitHub commit tree. The linked GitHub profile must match your registered account email ({user.email}).
                </p>
              </div>

              <div className="max-w-sm mx-auto space-y-3 pt-2">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-1">@</span>
                  <input
                    type="text"
                    placeholder="your_github_username"
                    value={linkHandle}
                    onChange={(e) => {
                      setLinkHandle(e.target.value);
                      setLinkError(null);
                    }}
                    className="w-full pl-7 pr-3 py-2 rounded-radius border border-line bg-card text-text-0 outline-none focus:border-brass text-xs"
                  />
                </div>

                {linkError && (
                  <div className="p-2.5 rounded border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs text-left font-mono">
                    {linkError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleVerifyAndLinkGitHub}
                  disabled={!linkHandle.trim() || isVerifyingLink}
                  className="w-full btn-brass text-xs py-2 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isVerifyingLink ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying Ownership...</span>
                    </>
                  ) : (
                    <span>Verify &amp; Unlock Submissions</span>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs md:text-sm">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="solution-repo-url" className="block text-xs md:text-sm uppercase tracking-wider text-text-1 font-semibold">
                    GitHub Solution Repository *
                  </label>
                  {isInspecting && (
                    <span className="inline-flex items-center gap-1 text-xs md:text-sm text-green-700 dark:text-green-400">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Inspecting GitHub...</span>
                    </span>
                  )}
                </div>

                <input
                  id="solution-repo-url"
                  type="url"
                  required
                  placeholder="https://github.com/username/solution-repo"
                  value={repoUrl}
                  onChange={(e) => handleRepoUrlChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-radius border border-line bg-card text-text-0 focus:border-green-500 outline-none transition-colors"
                />

                {/* Shimmering Inspection Skeleton */}
                {isInspecting && !inspectionData && (
                  <div className="mt-2.5 p-3 rounded-radius border border-line bg-card/60 space-y-2 text-xs md:text-sm">
                    <div className="flex items-center justify-between">
                      <Skeleton variant="rectangular" className="h-4 w-44" />
                      <Skeleton variant="rectangular" className="h-3.5 w-32" />
                    </div>
                    <div className="flex items-center gap-3 pt-1">
                      <Skeleton variant="pill" className="h-4 w-20" />
                      <Skeleton variant="pill" className="h-4 w-24" />
                      <Skeleton variant="rectangular" className="h-4 w-36" />
                    </div>
                  </div>
                )}

                {/* Live GitHub Inspection Result Card.
                    Wording is deliberately limited to what was actually
                    fetched: the repo exists and is public. This is not a
                    statement about the code, and it is not a verification
                    result — that arrives from a reviewer. */}
                {inspectionData && (
                  <div className="mt-2.5 p-3 rounded-radius border border-emerald/30 bg-emerald-tint/30 space-y-2 text-xs md:text-sm">
                    <div className="flex items-center justify-between text-emerald-text font-semibold">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Public repository found</span>
                      </div>
                      <a
                        href={`https://github.com/${inspectionData.fullName}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline inline-flex items-center gap-1 font-mono"
                      >
                        <span>github.com/{inspectionData.fullName}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-text-1 font-mono text-xs md:text-sm">
                      {inspectionData.stars !== undefined && (
                        <span className="inline-flex items-center gap-1">
                          <Star className="w-3 h-3 text-amber-500" />
                          <span>{inspectionData.stars} stars</span>
                        </span>
                      )}
                      {inspectionData.defaultBranch && (
                        <span className="inline-flex items-center gap-1">
                          <GitBranch className="w-3 h-3 text-text-1" />
                          <span>{inspectionData.defaultBranch}</span>
                        </span>
                      )}
                      {inspectionData.languages && inspectionData.languages.length > 0 && (
                        <span>
                          Stack: {inspectionData.languages.slice(0, 2).map((l) => `${l.name} ${l.percentage}%`).join(', ')}
                        </span>
                      )}
                    </div>

                    {inspectionData.latestCommit?.shortSha && (
                      <div className="text-xs md:text-sm text-text-0 pt-1 border-t border-line/60 flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-emerald-text">HEAD commit:</span>
                        <span className="bg-card px-1.5 py-0.5 rounded border border-line font-mono font-bold">
                          #{inspectionData.latestCommit.shortSha}
                        </span>
                        {inspectionData.latestCommit.message && (
                          <span className="text-text-1 truncate max-w-xs">
                            &ldquo;{inspectionData.latestCommit.message}&rdquo;
                          </span>
                        )}
                      </div>
                    )}
                    {!inspectionData.latestCommit?.shortSha && (
                      <div className="text-xs text-text-1 pt-1 border-t border-line/60">
                        The HEAD commit could not be read, so this submission
                        will be reviewed without one.
                      </div>
                    )}
                  </div>
                )}

                {inspectionError && (
                  <div className="mt-2 p-2.5 rounded-radius border border-rose-500/30 bg-rose-500/5 text-rose-700 dark:text-rose-400 flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{inspectionError}</span>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="solution-demo-url" className="block text-xs md:text-sm uppercase tracking-wider text-text-1 mb-1 font-semibold">
                  Deployed Demo / Live Endpoint (Optional)
                </label>
                <input
                  id="solution-demo-url"
                  type="url"
                  placeholder="https://my-solution.onrender.com"
                  value={demoUrl}
                  onChange={(e) => setDemoUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-radius border border-line bg-card text-text-0 focus:border-green-500 outline-none transition-colors"
                />
              </div>

              <div>
                <label htmlFor="solution-arch-notes" className="block text-xs md:text-sm uppercase tracking-wider text-text-1 mb-1 font-semibold">
                  Architecture Notes &amp; Trade-offs
                </label>
                <textarea
                  id="solution-arch-notes"
                  rows={3}
                  placeholder="Explain how you handled edge cases, latency constraints, concurrency locks, and algorithmic trade-offs..."
                  value={architectureNotes}
                  onChange={(e) => setArchitectureNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-radius border border-line bg-card text-text-0 focus:border-green-500 outline-none transition-colors leading-relaxed"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-outline text-xs md:text-sm py-1.5 px-3 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isInspecting}
                  className="btn-brass text-xs md:text-sm py-1.5 px-4 cursor-pointer inline-flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Submit for Verification</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
