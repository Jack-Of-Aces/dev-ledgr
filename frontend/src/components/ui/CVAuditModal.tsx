/**
 * @file CVAuditModal.tsx
 * @description Modal dialog for submitting a resume/CV for automated ATS Compliance Audit.
 * Connects directly to Go backend POST /api/jobBoard/audit powered by Claude / heuristic engines.
 */

'use client';

import React, { useState } from 'react';
import {
  X,
  FileCheck2,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  TrendingUp,
  Tag,
  Upload,
} from 'lucide-react';
import { jobService } from '@/services/jobs/jobService';
import { JobOpportunity, CVAudit } from '@/types';

interface CVAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  job?: JobOpportunity;
}

export const CVAuditModal: React.FC<CVAuditModalProps> = ({
  isOpen,
  onClose,
  job,
}) => {
  const [cvText, setCvText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auditResult, setAuditResult] = useState<CVAudit | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError('File size exceeds 2MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setCvText(content);
        setError(null);
      }
    };
    reader.onerror = () => {
      setError('Failed to read file content.');
    };
    reader.readAsText(file);
  };

  const handleRunAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cvText.trim().length < 50) {
      setError('Please provide at least 50 characters of your CV / resume text to run a meaningful audit.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await jobService.runCVAudit({
        cvText: cvText.trim(),
        jobId: job?.id,
      });
      setAuditResult(result);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to run ATS compliance audit. Please check your connection and retry.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-0/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-radius border border-line bg-card p-6 shadow-xl space-y-5 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-emerald/10 text-emerald-text">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-0 font-sans">
                ATS Resume Compliance Audit
              </h2>
              <p className="text-xs text-text-1 font-mono">
                {job ? `Targeted for ${job.title} at ${job.company}` : 'General Backend & Distributed Systems Audit'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-radius text-text-1 hover:text-text-0 hover:bg-card-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Audit Form or Results */}
        {!auditResult ? (
          <form onSubmit={handleRunAudit} className="space-y-4">
            <div className="p-3.5 rounded border border-line/60 bg-ink-0/40 text-xs text-text-1 space-y-1 font-mono">
              <div className="flex items-center gap-1.5 text-text-0 font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-brass" />
                <span>Dual-Engine Evaluation:</span>
              </div>
              <p>
                Parsed by Claude & heuristic rule engines. Evaluates keyword density, impact metrics (p99 latency, throughput), and cryptographic proof-of-work readiness.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="cv-text-input" className="block text-xs font-mono font-medium text-text-0">
                  Paste Resume / CV Plaintext (Markdown or Raw Text):
                </label>
                <label className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-text hover:underline cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload File (.txt, .md)</span>
                  <input
                    type="file"
                    accept=".txt,.md,text/plain,text/markdown"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={loading}
                  />
                </label>
              </div>
              <textarea
                id="cv-text-input"
                rows={9}
                value={cvText}
                onChange={(e) => setCvText(e.target.value)}
                placeholder={`Jane Doe\nBackend Systems Engineer | jane.devledgr.xyz\n\nEXPERIENCE:\n- Built zero-loss webhook deduplicator processing 10,000 req/s\n- Reduced p99 DB lock contention by 45% using Postgres advisory locks\n\nSKILLS:\nGo, PostgreSQL, Redis, Docker, Distributed Systems`}
                className="w-full p-3 rounded-radius border border-line bg-ink-0 text-text-0 font-mono text-xs focus:border-emerald outline-none transition-colors"
                disabled={loading}
              />
              <div className="flex justify-between items-center text-[11px] font-mono text-text-1">
                <span>Min: 50 characters · Max: 60,000 characters</span>
                <span>{cvText.length} chars</span>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded border border-rose-500/30 bg-rose-500/10 text-rose-500 text-xs font-mono flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-line">
              <button
                type="button"
                onClick={onClose}
                className="btn-outline text-xs py-2 px-3.5"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || cvText.trim().length < 50}
                className="btn-brass text-xs py-2 px-4 inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing with Claude...</span>
                  </>
                ) : (
                  <>
                    <span>Run ATS Audit</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-5 animate-in fade-in duration-150">
            {/* Score Banner */}
            <div className="p-4 rounded-radius border border-emerald-border bg-emerald-tint/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono uppercase tracking-wider text-emerald-text font-bold">
                    ATS Compliance Score
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald text-white font-mono font-bold">
                    {auditResult.engine === 'claude' ? 'Claude Opus 5' : 'Heuristic Engine'}
                  </span>
                </div>
                <p className="text-xs text-text-0 font-medium">
                  {auditResult.summary}
                </p>
              </div>

              <div className="text-right shrink-0">
                <div className="text-3xl font-bold font-mono text-emerald-text">
                  {auditResult.score}%
                </div>
                <div className="text-[11px] font-mono text-text-1">Audit Match</div>
              </div>
            </div>

            {/* Category Breakdown */}
            {auditResult.breakdown && auditResult.breakdown.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-mono uppercase tracking-wider text-text-1 font-semibold flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Evaluation Breakdown</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {auditResult.breakdown.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded border border-line bg-ink-0/40 space-y-1"
                    >
                      <div className="flex justify-between items-center text-xs font-mono">
                        <span className="text-text-0 font-medium">{item.category}</span>
                        <span className="font-bold text-emerald-text">{item.score}%</span>
                      </div>
                      <p className="text-[11px] text-text-1 leading-relaxed">
                        {item.notes}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Keyword Matches & Gaps */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 rounded border border-line bg-card space-y-2">
                <div className="flex items-center gap-1.5 text-emerald-text font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Matched Keywords ({auditResult.matchedKeywords.length})</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {auditResult.matchedKeywords.map((kw, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded bg-emerald/10 text-emerald-text text-[11px]"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded border border-line bg-card space-y-2">
                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold">
                  <Tag className="w-3.5 h-3.5" />
                  <span>Recommended Keywords ({auditResult.missingKeywords.length})</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {auditResult.missingKeywords.map((kw, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[11px]"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Targeted Recommendations */}
            {auditResult.recommendations && auditResult.recommendations.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-mono uppercase tracking-wider text-text-1 font-semibold">
                  Actionable High-Signal Recommendations:
                </h4>
                <div className="space-y-2">
                  {auditResult.recommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded border border-line bg-ink-0/60 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between font-mono">
                        <span className="font-semibold text-text-0">{rec.issue}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded uppercase font-bold ${
                            rec.priority === 'high'
                              ? 'bg-rose-500/20 text-rose-500'
                              : 'bg-zinc-500/20 text-text-1'
                          }`}
                        >
                          {rec.priority} priority
                        </span>
                      </div>
                      <p className="text-text-1 text-[11px] leading-relaxed">
                        {rec.suggestion}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal actions */}
            <div className="flex items-center justify-between pt-3 border-t border-line">
              <button
                type="button"
                onClick={() => setAuditResult(null)}
                className="btn-outline text-xs py-2 px-3 font-mono"
              >
                Audit Another Version
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn-brass text-xs py-2 px-4 font-mono"
              >
                Close Audit
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
