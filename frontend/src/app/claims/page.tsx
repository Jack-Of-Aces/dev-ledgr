'use client';

/**
 * @file page.tsx
 * @description "My Claims" — every problem this dev has claimed, with the
 * status they set on it.
 *
 * This exists because claiming was a write-only act. The claim button on a
 * problem detail page put a row in problems.status and the dev was never shown
 * a list of what they had picked up, so the only way to find a claim again was
 * to remember which problem it was and go looking for it. The lifecycle spread
 * across two more surfaces as well: status changes live on the problem page, and
 * sealed proofs live on the dashboard.
 *
 * The backend already answers this in one call — GET /api/launchpad/claims
 * returns full problem rows for the caller, optionally narrowed by status — so
 * this page is a read surface, not new persistence.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Flame,
  Loader2,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';

import { AuthGuard } from '@/components/auth/AuthGuard';
import { launchpadService } from '@/services/launchpad/launchpadService';
import { getDifficultyStyle } from '@/lib/colors';
import { LaunchpadProblem, ProblemStatus } from '@/types';

/**
 * Status presentation. A claim is only "done" when the problem itself is
 * complete; a dev marking their own progress never sets that, so a claimed
 * problem that reads "complete" came from the bank, not the claimant.
 */
const STATUS_META: Record<
  ProblemStatus,
  { label: string; hint: string; className: string }
> = {
  in_progress: {
    label: 'In progress',
    hint: 'You claimed this and marked yourself as building it.',
    className: 'border-emerald/40 text-emerald-text bg-emerald-tint/30',
  },
  seeking_contributors: {
    label: 'Seeking contributors',
    hint: 'Flagged as wanting more people on it.',
    className: 'border-amber-500/40 text-amber-700 dark:text-amber-300',
  },
  complete: {
    label: 'Complete',
    hint: 'The bank marked this problem complete.',
    className: 'border-line text-text-1',
  },
  open: {
    label: 'Open',
    hint: 'Back in the pool, available to claim again.',
    className: 'border-line text-text-1',
  },
};

type StatusFilter = ProblemStatus | 'all';

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'seeking_contributors', label: 'Seeking' },
  { id: 'complete', label: 'Complete' },
  { id: 'open', label: 'Open' },
];

/** Renders a timestamp, or an honest "unknown" when the API omitted it. */
function dateLabel(raw: string | undefined | null): string {
  if (!raw) return 'Date unknown';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return 'Date unknown';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ClaimsPage() {
  const [claims, setClaims] = useState<LaunchpadProblem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [loadedAt, setLoadedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const rows = await launchpadService.getMyClaims();
      setClaims(Array.isArray(rows) ? rows : []);
      setLoadedAt(new Date().toISOString());
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Could not load your claims.'
      );
      setClaims([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Counted from the full set, not the filtered view, so the tabs keep showing
  // where the rest of the work is while one of them is selected.
  const counts = useMemo(() => {
    const base: Record<StatusFilter, number> = {
      all: claims?.length ?? 0,
      open: 0,
      in_progress: 0,
      seeking_contributors: 0,
      complete: 0,
    };
    for (const c of claims ?? []) {
      if (c.status in base) base[c.status] += 1;
    }
    return base;
  }, [claims]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (claims ?? []).filter((c) => {
      if (status !== 'all' && c.status !== status) return false;
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.tagline.toLowerCase().includes(q) ||
        c.domain.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [claims, query, status]);

  return (
    <AuthGuard fallbackMessage="Sign in to see the problems you have claimed.">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 md:py-16 space-y-8 font-sans">
        <div className="flex items-center gap-1.5 text-text-1 text-xs md:text-sm">
          <Link
            href="/ideas"
            className="inline-flex items-center gap-1.5 hover:text-text-0 transition-colors"
          >
            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            <span>Back to Idea Bank</span>
          </Link>
        </div>

        <header className="space-y-2">
          <div className="flex items-center gap-2.5">
            <ClipboardList className="w-5 h-5 text-emerald-text" aria-hidden="true" />
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-text-0">
              My Claims
            </h1>
          </div>
          <p className="text-xs md:text-sm text-text-1 leading-relaxed max-w-2xl">
            Every problem you have claimed, and the status you set on it. A
            claim is a statement that you are building it — it is not a verified
            proof. Sealing a claim needs a submission, which is reviewed before
            it counts.
          </p>
        </header>

        {/* Search above the status tabs, matching the Idea Bank and dashboard. */}
        <div className="space-y-3">
          <div className="relative w-full">
            <Search
              className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-1 shrink-0"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your claims by title, tag, or domain..."
              aria-label="Search your claims"
              className="w-full pl-10 pr-9 py-2 rounded-radius border border-line bg-card text-text-0 placeholder:text-text-1 focus:border-emerald focus:ring-1 focus:ring-emerald/30 outline-none text-xs sm:text-sm"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-1 hover:text-text-0 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_TABS.map((tab) => {
              const isSelected = status === tab.id;
              // A tab with nothing behind it is noise, unless it is already
              // selected, otherwise there is no way back to an empty view.
              if (counts[tab.id] === 0 && !isSelected) return null;
              return (
                <button
                  key={tab.id}
                  onClick={() => setStatus(tab.id)}
                  aria-pressed={isSelected}
                  className={`px-3 py-1.5 rounded-radius font-medium transition-colors cursor-pointer text-xs shrink-0 whitespace-nowrap inline-flex items-center border ${
                    isSelected
                      ? 'bg-text-0 text-ink-0 font-semibold border-text-0'
                      : 'bg-card border-line text-text-1 hover:text-text-0 hover:border-text-1/60'
                  }`}
                >
                  {tab.label}
                  <span
                    className={`ml-1.5 font-mono text-[11px] ${
                      isSelected ? 'opacity-80' : 'opacity-60'
                    }`}
                  >
                    ({counts[tab.id]})
                  </span>
                </button>
              );
            })}
            <button
              onClick={() => void load()}
              className="btn-outline py-1 px-2.5 ml-auto shrink-0 inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-radius border border-rose-500/30 bg-rose-500/5 p-4 text-xs md:text-sm text-rose-700 dark:text-rose-300 flex items-center justify-between gap-3">
            <span>{error}</span>
            <button
              onClick={() => void load()}
              className="btn-outline py-1 px-2.5 shrink-0 cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : claims === null ? (
          <div className="flex items-center gap-2 text-text-1 text-xs md:text-sm py-6">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            <span>Loading your claims…</span>
          </div>
        ) : claims.length === 0 ? (
          <div className="rounded-radius border border-line bg-card/40 p-8 text-center space-y-3">
            <Flame className="w-6 h-6 text-text-1 mx-auto" aria-hidden="true" />
            <p className="text-xs md:text-sm text-text-1 max-w-md mx-auto leading-relaxed">
              You have not claimed a problem yet. Claiming one puts it on this
              list and marks you as building it.
            </p>
            <Link
              href="/ideas"
              className="btn-brass text-xs md:text-sm py-2 px-4 inline-flex items-center gap-1.5"
            >
              <span>Browse the Idea Bank</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-radius border border-line bg-card/40 p-6 text-center text-text-1 text-xs md:text-sm">
            {query
              ? `No claims match “${query}”.`
              : 'No claims with that status.'}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((claim) => {
              const meta = STATUS_META[claim.status] ?? STATUS_META.open;
              const submitted = claim.completedAt != null;
              return (
                <article
                  key={claim.id}
                  className="rounded-radius border border-line bg-card/40 p-4 sm:p-5 space-y-3"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/ideas/${claim.id}`}
                        className="font-semibold text-text-0 hover:underline wrap-break-word"
                      >
                        {claim.title}
                      </Link>
                      <span
                        className={`text-xs font-mono px-1.5 py-0.5 rounded border shrink-0 ${meta.className}`}
                      >
                        {meta.label}
                      </span>
                      {submitted && (
                        <span className="text-xs font-mono px-1.5 py-0.5 rounded border border-emerald/40 text-emerald-text inline-flex items-center gap-1 shrink-0">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Submitted</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs md:text-sm text-text-1 leading-relaxed">
                      {claim.tagline}
                    </p>
                  </div>

                  <dl className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] md:text-xs text-text-1 font-mono">
                    <div className="flex items-center gap-1.5">
                      <dt className="opacity-70">Claimed:</dt>
                      <dd>{dateLabel(claim.claimedAt)}</dd>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <dt className="opacity-70">Updated:</dt>
                      <dd>{dateLabel(claim.statusUpdatedAt)}</dd>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <dt className="opacity-70">Effort:</dt>
                      <dd>
                        {claim.estimatedHours}h ·{' '}
                        {getDifficultyStyle(claim.difficulty).name}
                      </dd>
                    </div>
                  </dl>

                  <p className="text-[11px] md:text-xs text-text-1 italic">
                    {meta.hint}
                  </p>

                  <div className="pt-1 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/ideas/${claim.id}`}
                      className="btn-outline text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
                    >
                      <span>Open spec</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                    {!submitted && (
                      // The submit entry point lives on the problem page
                      // because it needs the problem context; this is a
                      // shortcut there rather than a second submit form.
                      <Link
                        href={`/ideas/${claim.id}`}
                        className="btn-brass text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
                      >
                        <span>Submit proof</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}

            <p className="text-[11px] text-text-1 pt-1">
              {loadedAt
                ? `Loaded ${dateLabel(loadedAt)} at ${new Date(loadedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.`
                : null}
            </p>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
