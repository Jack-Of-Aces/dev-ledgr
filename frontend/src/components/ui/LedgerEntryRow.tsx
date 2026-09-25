'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { SubmissionEntry } from '@/types';
import { Check, Copy, ExternalLink } from 'lucide-react';

interface LedgerEntryRowProps {
  entry: SubmissionEntry;
  showIdeaLink?: boolean;
}

export const LedgerEntryRow: React.FC<LedgerEntryRowProps> = ({
  entry,
  showIdeaLink = true,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyHash = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(entry.hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Format relative timestamp
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="group grid grid-cols-1 md:grid-cols-[100px_1fr_auto] gap-2 md:gap-4 py-3.5 px-3 md:px-4 ledger-border-t hover:bg-card/60 transition-colors items-start">
      {/* Hash Column */}
      <div className="flex items-center gap-1.5 pt-0.5">
        <button
          onClick={handleCopyHash}
          aria-label={copied ? `Commit hash ${entry.hash} copied` : `Copy commit hash ${entry.hash}`}
          className="commit-hash flex items-center gap-1 hover:border-brass hover:text-text-0 transition-colors cursor-pointer group/btn"
          title="Click to copy commit hash"
        >
          <span>{entry.hash}</span>
          {copied ? (
            <Check className="w-3 h-3 text-diff-green" aria-hidden="true" />
          ) : (
            <Copy className="w-2.5 h-2.5 opacity-40 group-hover/btn:opacity-100 transition-opacity" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Main Details */}
      <div className="space-y-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {showIdeaLink ? (
            <Link
              href={`/ideas/${entry.ideaId}`}
              className="font-medium text-[13.5px] text-text-0 hover:text-brass transition-colors hover:underline truncate max-w-full"
            >
              {entry.ideaTitle}
            </Link>
          ) : (
            <span className="font-medium text-[13.5px] text-text-0 truncate max-w-full">
              {entry.ideaTitle}
            </span>
          )}

          <span className="text-[12px] text-text-1">by</span>
          <Link
            href={`/p/${entry.authorUsername}`}
            className="text-[12px] font-mono font-medium text-text-0 hover:underline"
          >
            @{entry.authorUsername}
          </Link>

          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 text-xs font-mono font-medium ml-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-600 dark:bg-green-500" aria-hidden="true" />
            verified
          </span>
        </div>

        <p className="text-xs text-text-1 line-clamp-2 leading-relaxed wrap-break-word max-w-md">
          {entry.architectureNotes}
        </p>

        {/* Metrics Row */}
        {entry.metrics && (
          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs font-mono text-text-1">
            {entry.metrics.latencyP99 && (
              <span>
                p99: <b className="text-text-0 font-medium">{entry.metrics.latencyP99}</b>
              </span>
            )}
            {entry.metrics.throughput && (
              <span>
                throughput: <b className="text-text-0 font-medium">{entry.metrics.throughput}</b>
              </span>
            )}
            {entry.metrics.coverage && (
              <span>
                coverage: <b className="text-text-0 font-medium">{entry.metrics.coverage}</b>
              </span>
            )}
            <span className="text-text-1">
              CI: {entry.testResults.passed}/{entry.testResults.total} tests passed
            </span>
          </div>
        )}
      </div>

      {/* Meta & Links */}
      <div className="flex md:flex-col items-center md:items-end justify-between md:justify-start gap-2 pt-0.5 text-xs font-mono text-text-1">
        <span>{formatTime(entry.timestamp)}</span>
        <div className="flex items-center gap-2">
          {entry.repoUrl && (
            <a
              href={entry.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`View code repository for ${entry.ideaTitle} (opens in new tab)`}
              className="hover:text-text-0 hover:underline flex items-center gap-0.5"
            >
              <span>repo</span>
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
          )}
          {entry.demoUrl && (
            <a
              href={entry.demoUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`View live demo for ${entry.ideaTitle} (opens in new tab)`}
              className="text-brass hover:underline flex items-center gap-0.5"
            >
              <span>demo</span>
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
