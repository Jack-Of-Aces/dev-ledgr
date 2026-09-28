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
  Copy,
  Download,
  Check,
  FileText,
  Edit3,
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auditResult, setAuditResult] = useState<CVAudit | null>(null);
  const [activeTab, setActiveTab] = useState<'audit' | 'curated'>('audit');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('File size exceeds 5MB limit.');
      return;
    }

    setSelectedFile(file);
    setFileName(file.name);
    setError(null);

    // If it's plain text or markdown, read it client-side into text area for preview
    if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) setCvText(content);
      };
      reader.readAsText(file);
    }
  };

  const handleRunAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile && cvText.trim().length < 30) {
      setError('Please upload a document (.pdf, .docx, .txt) or paste your resume text (at least 30 characters).');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (selectedFile) {
        // Send file to server-side parser route
        const formData = new FormData();
        formData.append('file', selectedFile);
        if (job) {
          formData.append('jobTitle', job.title);
          formData.append('company', job.company);
          formData.append('jobDescription', job.description || '');
        }

        const res = await fetch('/api/ai/audit-cv', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}: Failed to parse document`);
        }

        const data: CVAudit = await res.json();
        setAuditResult(data);
      } else {
        // Fallback or text-based call
        const result = await jobService.runCVAudit({
          cvText: cvText.trim(),
          jobId: job?.id,
        });
        setAuditResult(result);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to run ATS compliance audit. Please check your document and retry.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCuratedCv = () => {
    if (!auditResult?.curatedCvMarkdown) return;
    navigator.clipboard.writeText(auditResult.curatedCvMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCuratedCv = () => {
    if (!auditResult?.curatedCvMarkdown) return;
    const blob = new Blob([auditResult.curatedCvMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ATS_Refined_Resume_${job?.company ? job.company.replace(/[^a-z0-9]/gi, '_') : 'Curated'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-0/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-radius border border-line bg-card p-6 shadow-xl space-y-5 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-emerald/10 text-emerald-text">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-0 font-sans">
                ATS Resume Audit & AI Tailoring
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
                <span>Multi-Format Document Extractor & AI Mesh Engine:</span>
              </div>
              <p>
                Upload your resume file (.pdf, .docx, .txt) or paste raw text. The parser extracts your work history, evaluates keyword alignment, and curates a tailored ATS-optimized markdown resume.
              </p>
            </div>

            {/* Document File Uploader Box */}
            <div className="p-4 rounded-radius border-2 border-dashed border-line bg-ink-0/30 hover:border-emerald-border transition-colors text-center space-y-2">
              <Upload className="w-6 h-6 text-emerald-text mx-auto" />
              <div className="text-xs font-mono text-text-0 font-medium">
                {fileName ? (
                  <span className="text-emerald-text font-bold">Selected: {fileName}</span>
                ) : (
                  <span>Upload Resume File (.PDF, .DOCX, .TXT, .MD)</span>
                )}
              </div>
              <p className="text-[11px] text-text-1 font-mono">
                Supports text extraction up to 5MB. PDF and Word documents parsed automatically.
              </p>
              <label className="btn-outline text-xs py-1.5 px-3 inline-flex items-center gap-1.5 cursor-pointer font-mono">
                <span>{fileName ? 'Change File' : 'Browse File'}</span>
                <input
                  type="file"
                  accept=".pdf,.docx,.doc,.txt,.md,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={handleFileSelect}
                  disabled={loading}
                />
              </label>
            </div>

            {/* Fallback Text Input */}
            <div className="space-y-2">
              <label htmlFor="cv-text-input" className="block text-xs font-mono font-medium text-text-0">
                Or Paste Resume Plaintext / Markdown Below:
              </label>
              <textarea
                id="cv-text-input"
                rows={6}
                value={cvText}
                onChange={(e) => setCvText(e.target.value)}
                placeholder={`Jane Doe\nBackend Systems Engineer | jane.devledgr.xyz\n\nEXPERIENCE:\n- Built zero-loss webhook deduplicator processing 10,000 req/s\n- Reduced p99 DB lock contention by 45% using Postgres advisory locks\n\nSKILLS:\nGo, PostgreSQL, Redis, Docker, Distributed Systems`}
                className="w-full p-3 rounded-radius border border-line bg-ink-0 text-text-0 font-mono text-xs focus:border-emerald outline-none transition-colors"
                disabled={loading}
              />
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
                disabled={loading || (!selectedFile && cvText.trim().length < 30)}
                className="btn-brass text-xs py-2 px-4 inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Extracting & Auditing with AI...</span>
                  </>
                ) : (
                  <>
                    <span>Audit & Curate Resume</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-5 animate-in fade-in duration-150">
            {/* View Mode Toggle: Audit Report vs Curated ATS Resume */}
            <div className="flex items-center justify-between border-b border-line pb-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('audit')}
                  className={`px-3 py-1.5 rounded-radius text-xs font-mono font-medium transition-colors cursor-pointer ${
                    activeTab === 'audit'
                      ? 'bg-text-0 text-ink-0 font-semibold'
                      : 'bg-card border border-line text-text-1 hover:text-text-0'
                  }`}
                >
                  Audit Score & Recommendations
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('curated')}
                  className={`px-3 py-1.5 rounded-radius text-xs font-mono font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                    activeTab === 'curated'
                      ? 'bg-text-0 text-ink-0 font-semibold'
                      : 'bg-card border border-line text-text-1 hover:text-text-0'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-brass" />
                  <span>Curated ATS Resume</span>
                </button>
              </div>

              {activeTab === 'curated' && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyCuratedCv}
                    className="btn-outline text-xs py-1 px-2.5 inline-flex items-center gap-1 font-mono cursor-pointer"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-text" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copied!' : 'Copy Markdown'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadCuratedCv}
                    className="btn-brass text-xs py-1 px-2.5 inline-flex items-center gap-1 font-mono cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download .md</span>
                  </button>
                </div>
              )}
            </div>

            {activeTab === 'audit' ? (
              <div className="space-y-5">
                {/* Score Banner */}
                <div className="p-4 rounded-radius border border-emerald-border bg-emerald-tint/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono uppercase tracking-wider text-emerald-text font-bold">
                        ATS Compliance Score
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald text-white font-mono font-bold">
                        AI Tailoring Engine
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
              </div>
            ) : (
              /* Curated ATS Resume Tab */
              <div className="space-y-3">
                <div className="p-3 rounded border border-line bg-ink-0/40 text-xs font-mono text-text-1 flex items-center justify-between">
                  <span>AI-Curated Resume tailored for {job?.company || 'Target Role'}</span>
                  <span className="text-emerald-text font-bold">Ready to Export (.md)</span>
                </div>

                <textarea
                  readOnly
                  rows={14}
                  value={auditResult.curatedCvMarkdown || '# Curated ATS Resume\nNo text generated.'}
                  className="w-full p-4 rounded-radius border border-line bg-ink-0 text-text-0 font-mono text-xs focus:outline-none leading-relaxed"
                />
              </div>
            )}

            {/* Modal actions */}
            <div className="flex items-center justify-between pt-3 border-t border-line">
              <button
                type="button"
                onClick={() => {
                  setAuditResult(null);
                  setSelectedFile(null);
                  setFileName(null);
                }}
                className="btn-outline text-xs py-2 px-3 font-mono cursor-pointer"
              >
                Audit Another File / Text
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn-brass text-xs py-2 px-4 font-mono cursor-pointer"
              >
                Close Modal
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

