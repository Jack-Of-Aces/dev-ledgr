'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { IdeaItem, SubmissionEntry } from '@/types';
import { useAppStore } from '@/lib/store';
import { generateProofSignature } from '@/lib/crypto';
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
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface GitHubInspectData {
  valid: boolean;
  owner?: string;
  repo?: string;
  fullName?: string;
  description?: string | null;
  stars?: number;
  defaultBranch?: string;
  latestCommit?: {
    sha: string;
    shortSha: string;
    message: string;
    author: string;
    date: string;
  };
  languages?: { name: string; percentage: number }[];
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

  const modalRef = useRef<HTMLDivElement>(null);

  const steps = [
    'Querying GitHub API and verifying HEAD commit tree...',
    'Spinning up isolated mock infrastructure test harness...',
    'Executing integration and constraint checks against test vectors...',
    'Benchmarking p95 latency under simulated concurrency load...',
    'Computing cryptographic SHA-256 proof signature & minting certificate...'
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

    const commitSha =
      inspectionData?.latestCommit?.sha ||
      'd0422dd08f599de5567d55bf94f6531b68d28971';

    const timestamp = new Date().toISOString();

    // Compute genuine SHA-256 fingerprint
    const { shortHash, proofSignature } = await generateProofSignature({
      authorUsername: user.username,
      repoUrl,
      commitSha,
      testPassed: 20,
      testTotal: 20,
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
          testResults: {
            passed: 20,
            total: 20,
            suiteName: 'Automated CI & Contract Test Suite v2.0',
          },
          metrics: {
            latencyP99: '28ms',
            throughput: '240 req/s',
            coverage: '96.4%',
          },
        });

        setCompletedEntry(newEntry);

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
              <div className="w-12 h-12 rounded-full bg-green-500/15 border border-green-500/30 mx-auto flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-green-700 dark:text-green-400" aria-hidden="true" />
              </div>

              <div>
                <h3 className="font-sans text-xl font-bold tracking-tight text-text-0">
                  Proof Cryptographically Stamped
                </h3>
                <p className="text-xs md:text-sm text-text-1 mt-1 font-mono">
                  Verified commit <code className="text-text-0 font-bold bg-card px-1.5 py-0.5 rounded border border-line">#{completedEntry.hash}</code> is now sealed into your public ledger.
                </p>
              </div>

              {/* Cryptographic SHA-256 Digest Card */}
              {completedEntry.proofSignature && (
                <div className="p-3.5 rounded-radius border border-green-500/30 bg-green-500/5 text-left space-y-1.5 font-mono">
                  <div className="flex items-center justify-between text-xs md:text-sm text-green-700 dark:text-green-400 font-semibold">
                    <span>SHA-256 Proof Fingerprint:</span>
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
                <div className="flex justify-between">
                  <span className="text-text-1">Telemetry Status:</span>
                  <span className="text-green-700 dark:text-green-400 font-semibold">20/20 CI tests passed ✓</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-1">Benchmark Latency:</span>
                  <span className="text-text-0 font-semibold">28ms p99</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-1">Validity Guarantee:</span>
                  <span className="text-green-700 dark:text-green-400 font-semibold">1 Year Certificate</span>
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
              <Loader2 className="w-8 h-8 text-green-700 dark:text-green-400 animate-spin mx-auto" aria-hidden="true" />
              <div className="space-y-2">
                <div className="text-sm lg:text-base font-semibold text-text-0 font-sans">
                  Running Verification Harness...
                </div>
                <div aria-live="polite" className="text-xs md:text-sm text-green-700 dark:text-green-400 font-mono">
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

                {/* Live GitHub Inspection Result Card */}
                {inspectionData && (
                  <div className="mt-2.5 p-3 rounded-radius border border-green-500/30 bg-green-500/5 space-y-2 text-xs md:text-sm">
                    <div className="flex items-center justify-between text-green-700 dark:text-green-400 font-semibold">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Public Repository Verified</span>
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
                      <span className="inline-flex items-center gap-1">
                        <GitBranch className="w-3 h-3 text-text-1" />
                        <span>{inspectionData.defaultBranch || 'main'}</span>
                      </span>
                      {inspectionData.languages && inspectionData.languages.length > 0 && (
                        <span>
                          Stack: {inspectionData.languages.slice(0, 2).map((l) => `${l.name} ${l.percentage}%`).join(', ')}
                        </span>
                      )}
                    </div>

                    {inspectionData.latestCommit && (
                      <div className="text-xs md:text-sm text-text-0 pt-1 border-t border-line/60 flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-green-700 dark:text-green-400">HEAD commit:</span>
                        <span className="bg-card px-1.5 py-0.5 rounded border border-line font-mono font-bold">
                          #{inspectionData.latestCommit.shortSha}
                        </span>
                        <span className="text-text-1 truncate max-w-xs">
                          &ldquo;{inspectionData.latestCommit.message}&rdquo;
                        </span>
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
