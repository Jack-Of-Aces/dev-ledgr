'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { IdeaItem, SubmissionEntry } from '@/types';
import { useAppStore } from '@/lib/store';
import { Loader2, ShieldCheck, X, GitCommit } from 'lucide-react';
import confetti from 'canvas-confetti';

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
  const modalRef = useRef<HTMLDivElement>(null);

  const steps = [
    'Cloning repository and validating commit tree...',
    'Spinning up isolated mock infrastructure test harness...',
    'Executing 20 integration and constraint checks against test vectors...',
    'Verifying p95 latency and cryptographic idempotency signatures...',
    'Minting permanent 1-year proof-of-work certificate & commit hash...'
  ];

  const handleReset = useCallback(() => {
    setCompletedEntry(null);
    setVerifyingStep(null);
    setRepoUrl('');
    setDemoUrl('');
    setArchitectureNotes('');
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl) return;

    setVerifyingStep(0);

    // Simulate verification pipeline
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
        });

        setCompletedEntry(newEntry);

        // Confetti explosion with prefers-reduced-motion protection
        const prefersReducedMotion =
          typeof window !== 'undefined' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (!prefersReducedMotion) {
          try {
            confetti({
              particleCount: 60,
              spread: 70,
              origin: { y: 0.6 },
              colors: ['#A97A2E', '#2F7A4C', '#EDEEE1']
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
        className="relative w-full max-w-xl rounded-radius border border-brass bg-ink-0 shadow-2xl overflow-hidden font-mono"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-card border-b border-line">
          <div className="flex items-center gap-2">
            <GitCommit className="w-4 h-4 text-brass" aria-hidden="true" />
            <h2 id="submit-solution-modal-title" className="font-serif text-lg font-medium text-text-0">
              Record Proof of Work
            </h2>
          </div>
          <button
            onClick={handleReset}
            aria-label="Close submission modal"
            className="text-text-1 hover:text-text-0 transition-colors p-1"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {completedEntry ? (
            <div className="space-y-5 text-center py-4">
              <div className="w-12 h-12 rounded-full bg-diff-green/15 border border-diff-green/30 mx-auto flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-diff-green" aria-hidden="true" />
              </div>

              <div>
                <h3 className="font-serif text-2xl font-medium text-text-0">
                  Proof Merged & Stamped
                </h3>
                <p className="text-xs text-text-1 mt-1">
                  Commit hash <code className="text-text-0 font-bold">#{completedEntry.hash}</code> is now permanently verified on your public ledger.
                </p>
              </div>

              <div className="p-4 rounded-radius border border-line bg-card/50 text-left text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-text-1">Problem:</span>
                  <span className="font-semibold text-text-0">{idea.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-1">Status:</span>
                  <span className="text-diff-green font-semibold">20/20 CI tests passed ✓</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-1">Validity:</span>
                  <span className="text-brass font-semibold">1 Year Public Guarantee</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <a
                  href={`/p/${user.username}`}
                  className="btn-brass text-xs py-1.5 px-3"
                >
                  View in Public Portfolio →
                </a>
                <button
                  onClick={handleReset}
                  className="btn-outline text-xs py-1.5 px-3"
                >
                  Close
                </button>
              </div>
            </div>
          ) : verifyingStep !== null ? (
            <div className="space-y-6 py-6 text-center">
              <Loader2 className="w-8 h-8 text-brass animate-spin mx-auto" aria-hidden="true" />
              <div className="space-y-2">
                <div className="text-sm font-semibold text-text-0">
                  Running Verification Harness...
                </div>
                <div aria-live="polite" className="text-xs text-green-700 dark:text-green-400 font-mono">
                  {steps[verifyingStep]}
                </div>
              </div>

              <div
                role="progressbar"
                aria-valuenow={Math.round(((verifyingStep + 1) / steps.length) * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuetext={steps[verifyingStep]}
                className="w-full bg-card h-1.5 rounded-full overflow-hidden border border-line"
              >
                <div
                  className="bg-brass h-full transition-all duration-300"
                  style={{ width: `${((verifyingStep + 1) / steps.length) * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label htmlFor="solution-repo-url" className="block text-xs uppercase tracking-wider text-text-1 mb-1 font-semibold">
                  GitHub Solution Repository *
                </label>
                <input
                  id="solution-repo-url"
                  type="url"
                  required
                  placeholder="https://github.com/username/solution-repo"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-radius border border-line bg-card text-text-0 focus:border-brass outline-none transition-colors"
                />
              </div>

              <div>
                <label htmlFor="solution-demo-url" className="block text-xs uppercase tracking-wider text-text-1 mb-1 font-semibold">
                  Deployed Demo / Live Endpoint (Optional)
                </label>
                <input
                  id="solution-demo-url"
                  type="url"
                  placeholder="https://my-solution.onrender.com"
                  value={demoUrl}
                  onChange={(e) => setDemoUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-radius border border-line bg-card text-text-0 focus:border-brass outline-none transition-colors"
                />
              </div>

              <div>
                <label htmlFor="solution-arch-notes" className="block text-xs uppercase tracking-wider text-text-1 mb-1 font-semibold">
                  Architecture Notes & Trade-offs
                </label>
                <textarea
                  id="solution-arch-notes"
                  rows={4}
                  placeholder="Explain how you handled edge cases, latency constraints, and algorithmic trade-offs..."
                  value={architectureNotes}
                  onChange={(e) => setArchitectureNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-radius border border-line bg-card text-text-0 focus:border-brass outline-none transition-colors leading-relaxed"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-outline text-xs py-1.5 px-3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-brass text-xs py-1.5 px-3"
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
