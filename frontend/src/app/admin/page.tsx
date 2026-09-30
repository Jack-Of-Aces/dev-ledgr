'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { LaunchpadProblem, JobOpportunity, AdminJobFilters, SubmissionEntry } from '@/types';
import { IdeaDraft } from '@/services/ideas/IIdeaService';
import {
  ShieldCheck,
  Plus,
  ExternalLink,
  X,
  AlertTriangle,
  Check,
  Loader2,
  Eye,
  EyeOff,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { submissionService } from '@/services/submissions/submissionService';
import { VerifySubmissionInput } from '@/services/submissions/ISubmissionService';
import { launchpadService } from '@/services/launchpad/launchpadService';
import { ideaService } from '@/services/ideas/ideaService';
import { jobService } from '@/services/jobs/jobService';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission, UserRole } from '@/types/auth';
import { envConfig } from '@/lib/config';
import { getDomainStyle, getDifficultyStyle } from '@/lib/colors';
import { userService } from '@/services/user/userService';
import { PlatformUser } from '@/services/user/IUserService';

/** Splits a comma-separated field into trimmed, non-empty entries. */
function splitList(raw: string): string[] {
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/** Splits a textarea into one requirement per non-empty line. */
function splitLines(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function describeError(err: unknown): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return 'The request failed for an unknown reason.';
}

export default function AdminPage() {
  const { role } = useAuth();
  // Approving a problem needs seed_ideas, which only admin holds. A reviewer
  // can stamp proofs but must not be offered publish controls that will 403.
  const canSeed = hasPermission(role, 'seed_ideas');
  // Reviewers hold assign_roles, so they can staff the review queue without an
  // admin. Only manage_platform holders may grant admin or edit an admin, and
  // the Team tab hides those controls rather than offering a guaranteed 403.
  const canAssignRoles = hasPermission(role, 'assign_roles');
  const canManagePlatform = hasPermission(role, 'manage_platform');
  // Without a backend URL the console is editing the in-memory sample bank.
  // It still has to say so, or a reviewer reads sample rows as real records.
  const isMockMode = envConfig.useMocks;
  const [activeTab, setActiveTab] = useState<'submissions' | 'ideas' | 'team' | 'jobs'>(
    'submissions'
  );
  const [seedModalOpen, setSeedModalOpen] = useState(false);

  // The console reads the live bank rather than the local store, which only
  // ever holds mock seed data. Drafts are included because reviewing them is
  // the point of the console.
  const [problems, setProblems] = useState<LaunchpadProblem[] | null>(null);
  const [problemError, setProblemError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());

  const [queue, setQueue] = useState<SubmissionEntry[] | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [queueBusy, setQueueBusy] = useState<ReadonlySet<string>>(new Set());

  const [team, setTeam] = useState<PlatformUser[] | null>(null);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [teamBusy, setTeamBusy] = useState<ReadonlySet<string>>(new Set());
  const [teamQuery, setTeamQuery] = useState('');

  const [jobs, setJobs] = useState<JobOpportunity[] | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [jobBusy, setJobBusy] = useState<ReadonlySet<string>>(new Set());
  const [jobQuery, setJobQuery] = useState('');
  const [jobStatus, setJobStatus] = useState<AdminJobFilters['active']>('all');
  const [jobPendingDelete, setJobPendingDelete] = useState<JobOpportunity | null>(null);

  const [notice, setNotice] = useState<{ tone: 'error' | 'ok'; text: string } | null>(
    null
  );

  const loadProblems = useCallback(async () => {
    if (!canSeed) {
      // Without the permission the backend pins the list to published
      // problems, so a moderation view would be misleading and un-actionable.
      setProblems([]);
      return;
    }
    setProblemError(null);
    try {
      const rows = await launchpadService.getProblems({ approved: 'all' });
      setProblems(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setProblemError(describeError(err));
      setProblems([]);
    }
  }, [canSeed]);

  const loadQueue = useCallback(async () => {
    setQueueError(null);
    try {
      const subs = await submissionService.getReviewQueue();
      setQueue(Array.isArray(subs) ? subs : []);
    } catch (err) {
      setQueueError(describeError(err));
      setQueue([]);
    }
  }, []);

  const loadTeam = useCallback(
    async (query = '') => {
      if (!canAssignRoles) {
        setTeam([]);
        return;
      }
      setTeamError(null);
      try {
        const rows = await userService.listPlatformUsers(query);
        setTeam(Array.isArray(rows) ? rows : []);
      } catch (err) {
        setTeamError(describeError(err));
        setTeam([]);
      }
    },
    [canAssignRoles]
  );

  // Job moderation reads the backend directly, with no mock fallback: the
  // sample bank cannot represent a hidden or removed listing, so falling back
  // would show an admin jobs that do not exist.
  const loadJobs = useCallback(
    async (query = '', status: AdminJobFilters['active'] = 'all') => {
      if (!canManagePlatform) {
        setJobs([]);
        return;
      }
      setJobError(null);
      try {
        const rows = await jobService.listAllJobs({ active: status, search: query });
        setJobs(Array.isArray(rows) ? rows : []);
      } catch (err) {
        setJobError(describeError(err));
        setJobs([]);
      }
    },
    [canManagePlatform]
  );

  useEffect(() => {
    if (activeTab === 'ideas') {
      void loadProblems();
    } else if (activeTab === 'team') {
      void loadTeam(teamQuery);
    } else if (activeTab === 'jobs') {
      void loadJobs(jobQuery, jobStatus);
    } else {
      void loadQueue();
    }
  }, [activeTab, loadProblems, loadQueue, loadTeam, loadJobs, teamQuery, jobQuery, jobStatus]);

  // Close whichever dialog is open on Escape.
  useEffect(() => {
    if (!seedModalOpen && !jobPendingDelete) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setSeedModalOpen(false);
      setJobPendingDelete(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [seedModalOpen, jobPendingDelete]);

  const setPending = (
    setter: React.Dispatch<React.SetStateAction<ReadonlySet<string>>>,
    id: string,
    on: boolean
  ) =>
    setter((prev) => {
      const next = new Set(prev);
      if (on) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });

  const handleApproval = async (id: string, approved: boolean) => {
    setPending(setPendingIds, id, true);
    setNotice(null);
    try {
      const updated = await launchpadService.setProblemApproval(id, approved);
      // Trust the server's row rather than the optimistic guess, so the badge
      // reflects the state that was actually persisted.
      setProblems((prev) =>
        prev ? prev.map((p) => (p.id === id ? { ...p, ...updated } : p)) : prev
      );
      setNotice({
        tone: 'ok',
        text: approved
          ? 'Problem published. It is now visible to developers.'
          : 'Problem unpublished. It is hidden from developers.',
      });
    } catch (err) {
      setNotice({ tone: 'error', text: describeError(err) });
    } finally {
      setPending(setPendingIds, id, false);
    }
  };

  // Both review actions open a dialog. Stamping now has to record what was
  // checked, and rejecting has always required a reason that the old
  // single-click button never collected.
  const [reviewTarget, setReviewTarget] = useState<{
    submission: SubmissionEntry;
    action: 'verify' | 'reject';
  } | null>(null);

  const handleVerify = async (hash: string, input: VerifySubmissionInput) => {
    setPending(setQueueBusy, hash, true);
    setNotice(null);
    try {
      const updated = await submissionService.verifySubmission(hash, input);
      setQueue((prev) =>
        prev ? prev.map((s) => (s.hash === hash ? { ...s, ...updated } : s)) : prev
      );
    } catch (err) {
      setNotice({ tone: 'error', text: describeError(err) });
    } finally {
      setPending(setQueueBusy, hash, false);
      setReviewTarget(null);
    }
  };

  const handleReject = async (hash: string, notes: string) => {
    setPending(setQueueBusy, hash, true);
    setNotice(null);
    try {
      const updated = await submissionService.rejectSubmission(hash, notes);
      setQueue((prev) =>
        prev ? prev.map((s) => (s.hash === hash ? { ...s, ...updated } : s)) : prev
      );
    } catch (err) {
      setNotice({ tone: 'error', text: describeError(err) });
    } finally {
      setPending(setQueueBusy, hash, false);
      setReviewTarget(null);
    }
  };

  const handleRoleChange = async (userId: string, nextRole: UserRole) => {
    setPending(setTeamBusy, userId, true);
    setNotice(null);
    try {
      await userService.setUserRole(userId, nextRole);
      // Take the server's roster rather than patching locally, so the row shows
      // the role that was actually persisted rather than the one requested.
      await loadTeam(teamQuery);
      setNotice({
        tone: 'ok',
        text: `Role updated to ${nextRole}. They must sign in again for it to take effect.`,
      });
    } catch (err) {
      setNotice({ tone: 'error', text: describeError(err) });
    } finally {
      setPending(setTeamBusy, userId, false);
    }
  };

  const handleSetJobActive = async (job: JobOpportunity, active: boolean) => {
    setPending(setJobBusy, job.id, true);
    setNotice(null);
    try {
      const updated = await jobService.setJobActive(job.id, active);
      // Take the server's row rather than patching locally, so the badge shows
      // the state that was actually persisted.
      await loadJobs(jobQuery, jobStatus);
      setNotice({
        tone: 'ok',
        text: active
          ? `"${updated.title}" is live on the job board again.`
          : `"${updated.title}" is hidden from developers. It stays in the bank and can be reactivated.`,
      });
    } catch (err) {
      setNotice({ tone: 'error', text: describeError(err) });
    } finally {
      setPending(setJobBusy, job.id, false);
    }
  };

  const handleDeleteJob = async (job: JobOpportunity) => {
    setPending(setJobBusy, job.id, true);
    setNotice(null);
    try {
      await jobService.deleteJob(job.id);
      setJobPendingDelete(null);
      // Reload so the row reflects what the server stored, not a local splice.
      await loadJobs(jobQuery, jobStatus);
      setNotice({
        tone: 'ok',
        text: `"${job.title}" was removed from the job board.`,
      });
    } catch (err) {
      setNotice({ tone: 'error', text: describeError(err) });
    } finally {
      setPending(setJobBusy, job.id, false);
    }
  };

  const draftCount = useMemo(
    () => (problems ?? []).filter((p) => !p.adminApproved).length,
    [problems]
  );

  const staffCount = useMemo(
    () => (team ?? []).filter((u) => u.role !== 'user').length,
    [team]
  );

  // Counted separately from removed rows: a hidden job is one an admin may
  // still want to bring back, a removed one is a tombstone.
  const hiddenJobCount = useMemo(
    () => (jobs ?? []).filter((j) => !j.isActive && !j.deletedAt).length,
    [jobs]
  );

  return (
    <AuthGuard allowedRoles={['admin', 'reviewer']}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 md:py-16 space-y-10 text-sm lg:text-base font-sans">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-text-0">
              Ledger Review &amp; Problem Console
            </h1>
            <p className="text-text-1 mt-1 text-xs md:text-sm max-w-md leading-relaxed">
              Gated review console for verifiers to audit incoming code,
              publish or unpublish problems, and manage team clearance.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('submissions')}
              className={`px-3 py-1.5 rounded-radius cursor-pointer text-xs md:text-sm font-medium ${
                activeTab === 'submissions'
                  ? 'bg-card text-text-0 border border-green-500'
                  : 'text-text-1'
              }`}
            >
              Review Queue
            </button>
            <button
              onClick={() => setActiveTab('ideas')}
              className={`px-3 py-1.5 rounded-radius cursor-pointer text-xs md:text-sm font-medium ${
                activeTab === 'ideas'
                  ? 'bg-card text-text-0 border border-green-500'
                  : 'text-text-1'
              }`}
            >
              Problem Bank
              {draftCount > 0 && (
                <span className="ml-1.5 text-amber-600 dark:text-amber-400">
                  ({draftCount} draft{draftCount === 1 ? '' : 's'})
                </span>
              )}
            </button>
            {/* Reviewers hold assign_roles too, so they get the tab; the row
                controls inside it are narrowed to what they may actually grant. */}
            {canAssignRoles && (
              <button
                onClick={() => setActiveTab('team')}
                className={`px-3 py-1.5 rounded-radius cursor-pointer text-xs md:text-sm font-medium ${
                  activeTab === 'team'
                    ? 'bg-card text-text-0 border border-green-500'
                    : 'text-text-1'
                }`}
              >
                Team
                {staffCount > 0 && (
                  <span className="ml-1.5 text-text-1">
                    ({staffCount} staff)
                  </span>
                )}
              </button>
            )}
            {/* manage_platform is admin-only, so the tab is hidden rather than
                offered and then refused with a 403. */}
            {canManagePlatform && (
              <button
                onClick={() => setActiveTab('jobs')}
                className={`px-3 py-1.5 rounded-radius cursor-pointer text-xs md:text-sm font-medium ${
                  activeTab === 'jobs'
                    ? 'bg-card text-text-0 border border-green-500'
                    : 'text-text-1'
                }`}
              >
                Jobs
                {/* The count is over whatever is currently loaded, so it is
                    only a platform total while the list is unfiltered. With a
                    filter applied it would silently report zero. */}
                {hiddenJobCount > 0 && !jobQuery && jobStatus === 'all' && (
                  <span className="ml-1.5 text-amber-600 dark:text-amber-400">
                    ({hiddenJobCount} hidden)
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {isMockMode && (
          <div className="flex items-start gap-2 p-3 rounded-radius border border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300 text-xs md:text-sm">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              Sample data mode: no backend is configured, so nothing here is
              real. Approvals and stamps apply to the in-memory bank only and
              are lost on reload.
            </span>
          </div>
        )}

        {notice && (
          <div
            role="status"
            className={`flex items-start gap-2 p-3 rounded-radius border text-xs md:text-sm ${
              notice.tone === 'error'
                ? 'border-rose-500/30 bg-rose-500/5 text-rose-700 dark:text-rose-300'
                : 'border-green-500/30 bg-green-500/5 text-green-700 dark:text-green-400'
            }`}
          >
            {notice.tone === 'error' ? (
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            ) : (
              <Check className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            )}
            <span>{notice.text}</span>
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'submissions' ? (
          <div className="space-y-4">
            <div className="text-xs md:text-sm text-text-1 max-w-md">
              Incoming proof submissions awaiting reviewer stamp or automated
              consensus:
            </div>
            {queueError ? (
              <div className="rounded-radius border border-rose-500/30 bg-rose-500/5 p-4 text-xs md:text-sm text-rose-700 dark:text-rose-300 flex items-center justify-between gap-3">
                <span>{queueError}</span>
                <button
                  onClick={() => void loadQueue()}
                  className="btn-outline py-1 px-2.5 shrink-0"
                >
                  Retry
                </button>
              </div>
            ) : queue === null ? (
              <div className="flex items-center gap-2 text-text-1 text-xs md:text-sm py-6">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>Loading review queue…</span>
              </div>
            ) : queue.length === 0 ? (
              <div className="rounded-radius border border-line bg-card/40 p-6 text-center text-text-1 text-xs md:text-sm">
                No submissions are awaiting review.
              </div>
            ) : (
              <div className="rounded-radius border border-line bg-card/40 divide-y divide-line overflow-hidden">
                {queue.map((sub) => {
                  const busy = queueBusy.has(sub.hash);
                  return (
                    <div
                      key={sub.hash}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs md:text-sm"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="commit-hash font-mono shrink-0">
                            #{sub.hash}
                          </span>
                          <span className="font-semibold text-text-0 break-words">
                            {sub.ideaTitle}
                          </span>
                          <span className="text-text-1 font-mono shrink-0">
                            by @{sub.authorUsername}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded border text-[10px] uppercase font-semibold ${
                              sub.status === 'verified'
                                ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400'
                                : sub.status === 'rejected'
                                ? 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                                : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {sub.status}
                          </span>
                        </div>
                        <p className="text-text-1 text-xs md:text-sm max-w-md line-clamp-1">
                          {sub.architectureNotes}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            aria-label={
                              sub.status === 'verified'
                                ? `Submission for ${sub.ideaTitle} is already stamped`
                                : `Stamp submission for ${sub.ideaTitle}`
                            }
                            onClick={() =>
                              setReviewTarget({ submission: sub, action: 'verify' })
                            }
                            disabled={busy || sub.status !== 'pending'}
                            className={`font-medium flex items-center gap-1 ${
                              busy
                                ? 'opacity-50 cursor-not-allowed'
                                : 'cursor-pointer hover:underline'
                            } ${
                              sub.status === 'verified'
                                ? 'text-green-700 dark:text-green-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>
                              {sub.status === 'verified' ? 'Stamped' : 'Stamp'}
                            </span>
                          </button>
                          <button
                            type="button"
                            aria-label={
                              sub.status === 'rejected'
                                ? `Submission for ${sub.ideaTitle} is already rejected`
                                : `Reject submission for ${sub.ideaTitle}`
                            }
                            onClick={() =>
                              setReviewTarget({ submission: sub, action: 'reject' })
                            }
                            disabled={busy || sub.status !== 'pending'}
                            className={`font-medium flex items-center gap-1 ${
                              busy
                                ? 'opacity-50 cursor-not-allowed'
                                : 'cursor-pointer hover:underline'
                            } ${
                              sub.status === 'rejected'
                                ? 'text-rose-700 dark:text-rose-400'
                                : 'text-text-1'
                            }`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>
                              {sub.status === 'rejected' ? 'Rejected' : 'Reject'}
                            </span>
                          </button>
                        </div>
                        <a
                          href={sub.repoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-outline text-xs md:text-sm py-1 px-2.5 flex items-center gap-1 font-mono"
                        >
                          <span>Inspect Code</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : activeTab === 'ideas' ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs md:text-sm text-text-1">
              <span>
                {canSeed
                  ? 'Every problem in the bank, published and draft. Only published problems are visible to developers.'
                  : 'Published problems. Publishing needs an admin account.'}
              </span>
              {canSeed && (
                <button
                  onClick={() => setSeedModalOpen(true)}
                  className="btn-brass text-xs md:text-sm py-1.5 px-3 cursor-pointer self-start sm:self-auto shrink-0"
                >
                  <Plus className="w-3 h-3" />
                  <span>Seed New Problem</span>
                </button>
              )}
            </div>

            {problemError ? (
              <div className="rounded-radius border border-rose-500/30 bg-rose-500/5 p-4 text-xs md:text-sm text-rose-700 dark:text-rose-300 flex items-center justify-between gap-3">
                <span>{problemError}</span>
                <button
                  onClick={() => void loadProblems()}
                  className="btn-outline py-1 px-2.5 shrink-0"
                >
                  Retry
                </button>
              </div>
            ) : problems === null ? (
              <div className="flex items-center gap-2 text-text-1 text-xs md:text-sm py-6">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>Loading problem bank…</span>
              </div>
            ) : problems.length === 0 ? (
              <div className="rounded-radius border border-line bg-card/40 p-6 text-center text-text-1 text-xs md:text-sm">
                The problem bank is empty. Seed a problem to get started.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {problems.map((idea) => {
                  const busy = pendingIds.has(idea.id);
                  const domainStyle = getDomainStyle(idea.domain);
                  const difficultyStyle = getDifficultyStyle(idea.difficulty);
                  return (
                    <div
                      key={idea.id}
                      className="p-4 rounded-radius border border-line bg-card/40 space-y-2 text-xs md:text-sm flex flex-col"
                    >
                      <div className="flex justify-between items-center gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded border text-[10px] uppercase font-semibold ${domainStyle.badge}`}
                          >
                            {domainStyle.name}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded border text-[10px] uppercase font-semibold ${difficultyStyle.badge}`}
                          >
                            {difficultyStyle.name}
                          </span>
                        </div>
                        <span
                          className={`px-1.5 py-0.5 rounded border text-[10px] uppercase font-semibold ${
                            idea.adminApproved
                              ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400'
                              : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          {idea.adminApproved ? 'Published' : 'Draft'}
                        </span>
                      </div>
                      <Link
                        href={`/ideas/${idea.id}`}
                        className="text-base font-semibold tracking-tight text-text-0 hover:text-green-400 hover:underline block break-words"
                      >
                        {idea.title}
                      </Link>
                      <p className="text-text-1 line-clamp-2 text-xs md:text-sm leading-relaxed flex-1">
                        {idea.tagline}
                      </p>
                      <div className="pt-2 border-t border-line flex items-center justify-between gap-2">
                        <span className="text-text-1 text-xs">
                          {idea.submissionCount} proofs ·{' '}
                          {idea.estimatedHours}h
                        </span>
                        {canSeed && (
                          <button
                            onClick={() =>
                              void handleApproval(idea.id, !idea.adminApproved)
                            }
                            disabled={busy}
                            className={`btn-outline py-1 px-2.5 shrink-0 ${
                              busy ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                            }`}
                          >
                            {idea.adminApproved ? (
                              <>
                                <EyeOff className="w-3 h-3" />
                                <span>Unpublish</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Publish</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : activeTab === 'team' ? (
          <TeamTab
            team={team}
            error={teamError}
            busy={teamBusy}
            query={teamQuery}
            canGrantAdmin={canManagePlatform}
            onQueryChange={setTeamQuery}
            onReload={() => void loadTeam(teamQuery)}
            onRoleChange={handleRoleChange}
          />
        ) : (
          <JobsTab
            jobs={jobs}
            error={jobError}
            busy={jobBusy}
            query={jobQuery}
            status={jobStatus}
            onQueryChange={setJobQuery}
            onStatusChange={setJobStatus}
            onReload={() => void loadJobs(jobQuery, jobStatus)}
            onSetActive={handleSetJobActive}
            onRequestDelete={setJobPendingDelete}
          />
        )}

        {seedModalOpen && (
          <SeedProblemModal
            onClose={() => setSeedModalOpen(false)}
            onPublished={(idea) => {
              setNotice({
                tone: 'ok',
                text: `"${idea.title}" is published and live in the Idea Bank.`,
              });
              // Reload rather than splice in the local copy: the server mints
              // the id and approval state, and the list must show what it
              // actually stored.
              void loadProblems();
            }}
          />
        )}

        {jobPendingDelete && (
          <ConfirmDeleteJobDialog
            job={jobPendingDelete}
            busy={jobBusy.has(jobPendingDelete.id)}
            onCancel={() => setJobPendingDelete(null)}
            onConfirm={() => void handleDeleteJob(jobPendingDelete)}
          />
        )}

        {reviewTarget && (
          <ReviewSubmissionDialog
            submission={reviewTarget.submission}
            action={reviewTarget.action}
            busy={queueBusy.has(reviewTarget.submission.hash)}
            onCancel={() => setReviewTarget(null)}
            onVerify={(input) =>
              void handleVerify(reviewTarget.submission.hash, input)
            }
            onReject={(notes) =>
              void handleReject(reviewTarget.submission.hash, notes)
            }
          />
        )}
      </div>
    </AuthGuard>
  );
}

/**
 * Collects what a reviewer is attesting to before a decision is recorded.
 *
 * The backend refuses to mint a certificate whose test total is zero, and
 * requires a reason to reject. Both are enforced here too, so the reviewer is
 * told what is missing before a round trip, and so the "Stamp" button cannot
 * silently post a body that the API will reject.
 *
 * Performance figures are opt-in and left blank unless the reviewer measured
 * them. There is no placeholder: an unmeasured value stays unmeasured, which is
 * what stops a fabricated 28ms from reaching a public portfolio.
 */
function ReviewSubmissionDialog({
  submission,
  action,
  busy,
  onCancel,
  onVerify,
  onReject,
}: {
  submission: SubmissionEntry;
  action: 'verify' | 'reject';
  busy: boolean;
  onCancel: () => void;
  onVerify: (input: VerifySubmissionInput) => void;
  onReject: (notes: string) => void;
}) {
  const [passed, setPassed] = useState('');
  const [total, setTotal] = useState('');
  const [suiteName, setSuiteName] = useState('');
  const [latencyP99, setLatencyP99] = useState('');
  const [throughput, setThroughput] = useState('');
  const [coverage, setCoverage] = useState('');
  const [notes, setNotes] = useState('');

  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel, busy]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const passedN = Number.parseInt(passed, 10);
  const totalN = Number.parseInt(total, 10);
  const countsParse =
    passed.trim() !== '' &&
    total.trim() !== '' &&
    Number.isInteger(passedN) &&
    Number.isInteger(totalN);
  // A total of zero is refused, and 0/0 is the shape the server rejects as a
  // vacuous pass, so the form will not let a reviewer submit it.
  const countsValid =
    countsParse && totalN > 0 && passedN >= 0 && passedN <= totalN;
  const countsComplete = countsParse && passedN === totalN;
  const notesValid = notes.trim().length > 0 && notes.trim().length <= 2000;

  const canConfirm =
    action === 'verify'
      ? countsValid && countsComplete
      : notesValid;

  const fieldClass =
    'w-full px-2.5 py-1.5 rounded-radius border border-line bg-card text-text-0 text-xs sm:text-sm font-mono focus:border-emerald focus:ring-1 focus:ring-emerald/30 outline-none';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-submission"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-0/70 backdrop-blur-sm overflow-y-auto"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-lg rounded-radius border border-line bg-card p-5 sm:p-6 space-y-4 my-auto outline-none"
      >
        <div className="flex items-start justify-between gap-3">
          <h2
            id="review-submission"
            className="text-base font-semibold text-text-0 tracking-tight"
          >
            {action === 'verify' ? 'Stamp this proof' : 'Reject this proof'}
          </h2>
          <button
            onClick={onCancel}
            disabled={busy}
            aria-label="Close"
            className="text-text-1 hover:text-text-0 cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1.5 text-xs md:text-sm text-text-1 leading-relaxed">
          <p className="text-text-0 font-medium break-words">
            {submission.ideaTitle}
          </p>
          <p className="font-mono text-[11px] break-all">
            {submission.repoUrl}
          </p>
        </div>

        {action === 'verify' ? (
          <>
            <p className="text-xs text-text-1 leading-relaxed">
              A stamp issues a 365-day certificate bound to these results.
              Record what you actually checked. There is no automated runner
              yet, so these counts are your own attestation and they are signed
              as such.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label
                  htmlFor="review-passed"
                  className="block text-[11px] font-mono uppercase tracking-wider text-text-1"
                >
                  Tests passed
                </label>
                <input
                  id="review-passed"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={passed}
                  onChange={(e) => setPassed(e.target.value)}
                  className={fieldClass}
                  aria-invalid={countsParse && !countsComplete}
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="review-total"
                  className="block text-[11px] font-mono uppercase tracking-wider text-text-1"
                >
                  Tests total
                </label>
                <input
                  id="review-total"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={total}
                  onChange={(e) => setTotal(e.target.value)}
                  className={fieldClass}
                  aria-invalid={countsParse && !countsComplete}
                />
              </div>
            </div>

            {countsParse && !countsComplete && (
              <p className="text-[11px] text-rose-700 dark:text-rose-300 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                <span>
                  {passedN > totalN
                    ? 'Passed cannot exceed total.'
                    : 'Every test must pass before a submission can be stamped.'}
                </span>
              </p>
            )}
            {countsParse && totalN === 0 && (
              <p className="text-[11px] text-rose-700 dark:text-rose-300 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                <span>
                  A certificate cannot be minted for a run of zero tests. If
                  nothing was run, reject the submission instead.
                </span>
              </p>
            )}

            <div className="space-y-1">
              <label
                htmlFor="review-suite"
                className="block text-[11px] font-mono uppercase tracking-wider text-text-1"
              >
                Suite name{' '}
                <span className="normal-case opacity-70">(optional)</span>
              </label>
              <input
                id="review-suite"
                type="text"
                value={suiteName}
                onChange={(e) => setSuiteName(e.target.value)}
                placeholder="Defaults to Manual Reviewer Audit"
                className={fieldClass}
              />
            </div>

            <details className="border border-line rounded-radius">
              <summary className="px-2.5 py-2 text-[11px] font-mono uppercase tracking-wider text-text-1 cursor-pointer select-none">
                Measured performance{' '}
                <span className="normal-case opacity-70">
                  (optional, leave blank if unmeasured)
                </span>
              </summary>
              <div className="px-2.5 pb-2.5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label
                      htmlFor="review-latency"
                      className="block text-[11px] font-mono uppercase tracking-wider text-text-1"
                    >
                      p99 latency
                    </label>
                    <input
                      id="review-latency"
                      type="text"
                      value={latencyP99}
                      onChange={(e) => setLatencyP99(e.target.value)}
                      placeholder="e.g. 28ms"
                      className={fieldClass}
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor="review-throughput"
                      className="block text-[11px] font-mono uppercase tracking-wider text-text-1"
                    >
                      Throughput
                    </label>
                    <input
                      id="review-throughput"
                      type="text"
                      value={throughput}
                      onChange={(e) => setThroughput(e.target.value)}
                      placeholder="e.g. 240 req/s"
                      className={fieldClass}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="review-coverage"
                    className="block text-[11px] font-mono uppercase tracking-wider text-text-1"
                  >
                    Coverage
                  </label>
                  <input
                    id="review-coverage"
                    type="text"
                    value={coverage}
                    onChange={(e) => setCoverage(e.target.value)}
                    placeholder="e.g. 96.4%"
                    className={fieldClass}
                  />
                </div>
                <p className="text-[11px] text-text-1 leading-relaxed">
                  These appear on the public portfolio and in generated CVs. Only
                  enter figures you measured. Anything left blank stays blank
                  rather than showing a placeholder.
                </p>
              </div>
            </details>

            <div className="space-y-1">
              <label
                htmlFor="review-notes-verify"
                className="block text-[11px] font-mono uppercase tracking-wider text-text-1"
              >
                Review notes{' '}
                <span className="normal-case opacity-70">(optional)</span>
              </label>
              <textarea
                id="review-notes-verify"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={2000}
                rows={2}
                className={`${fieldClass} resize-y`}
              />
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-text-1 leading-relaxed">
              The developer sees this reason on their submission, so say what
              did not hold up. A reason is required.
            </p>
            <div className="space-y-1">
              <label
                htmlFor="review-reason"
                className="block text-[11px] font-mono uppercase tracking-wider text-text-1"
              >
                Reason for rejection
              </label>
              <textarea
                id="review-reason"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={2000}
                rows={4}
                autoFocus
                className={`${fieldClass} resize-y`}
                aria-invalid={notes.trim() !== '' && !notesValid}
              />
              <p className="text-[11px] text-text-1">
                {notes.trim().length}/2000 characters
              </p>
            </div>
          </>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2 pt-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="btn-outline py-1.5 px-3 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (action === 'verify') {
                const metrics = {
                  ...(latencyP99.trim() ? { latencyP99: latencyP99.trim() } : {}),
                  ...(throughput.trim() ? { throughput: throughput.trim() } : {}),
                  ...(coverage.trim() ? { coverage: coverage.trim() } : {}),
                };
                onVerify({
                  testResults: {
                    passed: passedN,
                    total: totalN,
                    ...(suiteName.trim() ? { suiteName: suiteName.trim() } : {}),
                  },
                  // Omitted entirely when nothing was measured, rather than
                  // sent as three empty strings.
                  ...(Object.keys(metrics).length > 0 ? { metrics } : {}),
                  ...(notes.trim() ? { notes: notes.trim() } : {}),
                });
              } else {
                onReject(notes.trim());
              }
            }}
            disabled={busy || !canConfirm}
            className={`btn-brass py-1.5 px-3 inline-flex items-center gap-1.5 ${
              busy || !canConfirm
                ? 'opacity-50 cursor-not-allowed'
                : 'cursor-pointer'
            }`}
          >
            {busy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : action === 'verify' ? (
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>{action === 'verify' ? 'Stamp proof' : 'Reject proof'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

const GRANTABLE_ROLES: UserRole[] = ['user', 'reviewer', 'admin'];

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  user: 'Can submit solutions and build a portfolio',
  reviewer: 'Can stamp and reject proofs in the review queue',
  admin: 'Can also publish problems and grant roles',
};

/**
 * Role management. This is the only non-SQL path to a reviewer account:
 * public.profiles.role cannot be written by the Supabase anon/authenticated
 * roles (migration 0003) and no profile update path includes it, so without
 * this screen a reviewer could only be created by hand in the database.
 */
function TeamTab({
  team,
  error,
  busy,
  query,
  canGrantAdmin,
  onQueryChange,
  onReload,
  onRoleChange,
}: {
  team: PlatformUser[] | null;
  error: string | null;
  busy: ReadonlySet<string>;
  query: string;
  canGrantAdmin: boolean;
  onQueryChange: (next: string) => void;
  onReload: () => void;
  onRoleChange: (userId: string, role: UserRole) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs md:text-sm text-text-1">
        <span className="max-w-md leading-relaxed">
          {canGrantAdmin
            ? 'Grant or revoke reviewer and admin clearance. A promoted reviewer gets proof stamping on their next request; a revoked one loses it immediately.'
            : 'Grant or revoke reviewer clearance. Only an admin can grant or change the admin role.'}
        </span>
        <label className="flex items-center gap-2 shrink-0">
          <span className="sr-only">Search team</span>
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search by handle, name or email"
            className="bg-card border border-line rounded-radius px-3 py-1.5 text-xs md:text-sm text-text-0 placeholder:text-text-1 w-full sm:w-64"
          />
        </label>
      </div>

      {error ? (
        <div className="rounded-radius border border-rose-500/30 bg-rose-500/5 p-4 text-xs md:text-sm text-rose-700 dark:text-rose-300 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button onClick={onReload} className="btn-outline py-1 px-2.5 shrink-0">
            Retry
          </button>
        </div>
      ) : team === null ? (
        <div className="flex items-center gap-2 text-text-1 text-xs md:text-sm py-6">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          <span>Loading team…</span>
        </div>
      ) : team.length === 0 ? (
        <div className="rounded-radius border border-line bg-card/40 p-6 text-center text-text-1 text-xs md:text-sm">
          {query
            ? `No developer matches “${query}”.`
            : 'No developers have signed up yet.'}
        </div>
      ) : (
        <div className="rounded-radius border border-line divide-y divide-line">
          {team.map((member) => {
            const isBusy = busy.has(member.id);
            // A reviewer may not touch an admin, and may not mint one. Mirror
            // the backend's ordering rule here so the row does not offer a
            // button whose only outcome is a 403.
            const isLocked = !canGrantAdmin && member.role === 'admin';
            return (
              <div
                key={member.id}
                className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-text-0">
                      @{member.username}
                    </span>
                    <span
                      className={`text-xs font-mono px-1.5 py-0.5 rounded border ${
                        member.role === 'admin'
                          ? 'border-amber-500/40 text-amber-700 dark:text-amber-300'
                          : member.role === 'reviewer'
                          ? 'border-green-500/40 text-green-700 dark:text-green-400'
                          : 'border-line text-text-1'
                      }`}
                    >
                      {member.role}
                    </span>
                  </div>
                  <div className="text-xs text-text-1 mt-0.5 truncate">
                    {member.name}
                    {member.email ? ` · ${member.email}` : ''}
                  </div>
                  <div className="text-xs text-text-1 mt-0.5">
                    {ROLE_DESCRIPTIONS[member.role]}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {isLocked ? (
                    <span className="text-xs text-text-1 font-mono">
                      Admin only
                    </span>
                  ) : (
                    GRANTABLE_ROLES.filter(
                      (candidate) => canGrantAdmin || candidate !== 'admin'
                    ).map((candidate) => {
                      const isCurrent = candidate === member.role;
                      return (
                        <button
                          key={candidate}
                          onClick={() => onRoleChange(member.id, candidate)}
                          disabled={isCurrent || isBusy}
                          title={
                            isCurrent
                              ? 'Already assigned'
                              : `Set to ${candidate}: ${ROLE_DESCRIPTIONS[candidate]}`
                          }
                          className={`px-2.5 py-1 rounded text-xs font-mono cursor-pointer border transition-colors disabled:cursor-default ${
                            isCurrent
                              ? 'bg-card border-line text-text-0'
                              : 'text-text-1 border-line hover:border-text-1 hover:text-text-0'
                          }`}
                        >
                          {isBusy ? (
                            <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                          ) : (
                            candidate
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const JOB_STATUS_FILTERS: { id: NonNullable<AdminJobFilters['active']>; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'true', label: 'Live' },
  { id: 'false', label: 'Hidden' },
];

/** Formats the date a job was posted, falling back to when it was scraped. */
function jobPostedLabel(job: JobOpportunity): string {
  const raw = job.postedAt || job.scrapedAt;
  if (!raw) return 'Date unknown';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return 'Date unknown';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Job moderation: every listing in the bank, live and hidden.
 *
 * This reads the backend directly. jobService.getJobs deliberately falls back
 * to the sample bank when the API returns nothing, which is right for the
 * public board and fatal here: a moderation view that showed six invented jobs
 * while the real ones were all hidden would be worse than an error.
 */
function JobsTab({
  jobs,
  error,
  busy,
  query,
  status,
  onQueryChange,
  onStatusChange,
  onReload,
  onSetActive,
  onRequestDelete,
}: {
  jobs: JobOpportunity[] | null;
  error: string | null;
  busy: ReadonlySet<string>;
  query: string;
  status: AdminJobFilters['active'];
  onQueryChange: (next: string) => void;
  onStatusChange: (next: NonNullable<AdminJobFilters['active']>) => void;
  onReload: () => void;
  onSetActive: (job: JobOpportunity, active: boolean) => void;
  onRequestDelete: (job: JobOpportunity) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs md:text-sm text-text-1">
        <span className="max-w-md leading-relaxed">
          Every listing in the job bank, live and hidden. Hiding takes a role off
          the board and is reversible; removing it is a tombstone, so a later
          scrape cannot bring the listing back.
        </span>
        <label className="flex items-center gap-2 shrink-0">
          <span className="sr-only">Search jobs</span>
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search by role or company"
            className="bg-card border border-line rounded-radius px-3 py-1.5 text-xs md:text-sm text-text-0 placeholder:text-text-1 w-full sm:w-64"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {JOB_STATUS_FILTERS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onStatusChange(opt.id)}
            aria-pressed={status === opt.id}
            className={`px-3 py-1.5 rounded-radius font-medium transition-colors cursor-pointer text-xs shrink-0 whitespace-nowrap inline-flex items-center border ${
              status === opt.id
                ? 'bg-text-0 text-ink-0 font-semibold border-text-0'
                : 'bg-card border-line text-text-1 hover:text-text-0 hover:border-text-1'
            }`}
          >
            {opt.label}
          </button>
        ))}
        <button onClick={onReload} className="btn-outline py-1 px-2.5 ml-auto">
          Reload
        </button>
      </div>

      {error ? (
        <div className="rounded-radius border border-rose-500/30 bg-rose-500/5 p-4 text-xs md:text-sm text-rose-700 dark:text-rose-300 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button onClick={onReload} className="btn-outline py-1 px-2.5 shrink-0">
            Retry
          </button>
        </div>
      ) : jobs === null ? (
        <div className="flex items-center gap-2 text-text-1 text-xs md:text-sm py-6">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          <span>Loading job bank…</span>
        </div>
      ) : jobs.length === 0 ? (
        <div className="rounded-radius border border-line bg-card/40 p-6 text-center text-text-1 text-xs md:text-sm">
          {query || status !== 'all'
            ? 'No jobs match this filter.'
            : 'The job bank is empty.'}
        </div>
      ) : (
        <div className="rounded-radius border border-line bg-card/40 divide-y divide-line overflow-hidden">
          {jobs.map((job) => {
            const isBusy = busy.has(job.id);
            const removed = Boolean(job.deletedAt);
            return (
              <div
                key={job.id}
                className={`p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  removed ? 'opacity-60' : ''
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-text-0 break-words">
                      {job.title}
                    </span>
                    <span
                      className={`text-xs font-mono px-1.5 py-0.5 rounded border ${
                        removed
                          ? 'border-line text-text-1'
                          : job.isActive
                          ? 'border-green-500/40 text-green-700 dark:text-green-400'
                          : 'border-amber-500/40 text-amber-700 dark:text-amber-300'
                      }`}
                    >
                      {removed ? 'Removed' : job.isActive ? 'Live' : 'Hidden'}
                    </span>
                    {!job.adminApproved && !removed && (
                      <span className="text-xs font-mono px-1.5 py-0.5 rounded border border-line text-text-1">
                        Unpublished
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-text-1 mt-0.5 truncate">
                    {job.company}
                    {job.location ? ` · ${job.location}` : ''}
                    {job.level && job.level !== 'unspecified'
                      ? ` · ${job.level}`
                      : ''}
                    {` · posted ${jobPostedLabel(job)}`}
                  </div>
                  <div className="text-xs text-text-1 mt-0.5">
                    {job.tags?.length ?? 0} skill tags · {job.matchScore}% match score
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {removed ? (
                    // A tombstone has no transition back. The row stays only so
                    // an admin can see what was removed and when.
                    <span className="text-xs text-text-1 font-mono">
                      Removed {jobPostedLabel(job)}
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => onSetActive(job, !job.isActive)}
                        disabled={isBusy}
                        className={`btn-outline py-1 px-2.5 shrink-0 ${
                          isBusy ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                        }`}
                      >
                        {job.isActive ? (
                          <>
                            <EyeOff className="w-3 h-3" />
                            <span>Hide</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3" />
                            <span>Show</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => onRequestDelete(job)}
                        disabled={isBusy}
                        title={`Remove ${job.title} from the job board`}
                        className={`btn-outline py-1 px-2.5 shrink-0 text-rose-700 dark:text-rose-300 ${
                          isBusy ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                        }`}
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Removal is confirmed rather than one click away. It is a tombstone rather
 * than a row delete — the scraper upserts on source_url, so a hard delete would
 * reappear on the next run — but an admin pressing "Remove" should still have
 * said so on purpose.
 */
function ConfirmDeleteJobDialog({
  job,
  busy,
  onCancel,
  onConfirm,
}: {
  job: JobOpportunity;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-job"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-0/70 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-radius border border-line bg-card p-5 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <h2
            id="confirm-delete-job"
            className="text-base font-semibold text-text-0 tracking-tight"
          >
            Remove this role from the job board?
          </h2>
          <button
            onClick={onCancel}
            aria-label="Close"
            className="text-text-1 hover:text-text-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-2 text-xs md:text-sm text-text-1 leading-relaxed">
          <p className="text-text-0 font-medium break-words">
            {job.title} · {job.company}
          </p>
          <p>
            It disappears from the board and from the public API. The record is
            kept with a removal date rather than deleted, because the scraper
            re-inserts anything it still finds at the same source URL — a real
            delete would come back on the next run.
          </p>
          <p>
            Developers with the role open will see it as no longer available.
            Use <span className="font-mono">Hide</span> instead if the role is
            only filled and you want to bring it back.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2 pt-2">
          <button onClick={onCancel} className="btn-outline py-1.5 px-3">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`btn-brass py-1.5 px-3 inline-flex items-center gap-1.5 ${
              busy ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            }`}
          >
            {busy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>Remove role</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function SeedProblemModal({
  onClose,
  onPublished,
}: {
  onClose: () => void;
  onPublished: (idea: LaunchpadProblem) => void;
}) {
  const [title, setTitle] = useState('');
  const [tagline, setTagline] = useState('');
  const [domain, setDomain] = useState('infrastructure');
  const [difficulty, setDifficulty] = useState('intermediate');
  const [estimatedHours, setEstimatedHours] = useState(12);
  const [originStory, setOriginStory] = useState('');
  const [problemStatement, setProblemStatement] = useState('');
  const [techReqs, setTechReqs] = useState('');
  const [tags, setTags] = useState('Go, Redis, Distributed');
  const [sourceUrl, setSourceUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // The endpoint rejects an empty problem statement and an empty technical
    // requirement list, so catch that here rather than after a round trip.
    const requirements = splitLines(techReqs);
    if (!problemStatement.trim()) {
      setError('A problem statement is required.');
      return;
    }
    if (requirements.length === 0) {
      setError('Add at least one technical requirement, one per line.');
      return;
    }

    const draft: IdeaDraft = {
      title: title.trim(),
      tagline: tagline.trim(),
      domain,
      difficulty,
      estimatedHours,
      originStory: originStory.trim(),
      problemStatement: problemStatement.trim(),
      technicalRequirements: requirements,
      mockInfra: {
        baseUrl: '',
        starterRepoUrl: '',
        endpoints: [],
        curlExample: '',
        testCriteria: [],
      },
      tags: splitList(tags),
      // The backend falls back to tags when the stack is empty, so leaving
      // this blank still gives the matcher something to score against.
      suggestedStack: [],
      regionalHurdles: '',
      sourceUrl: sourceUrl.trim(),
    };

    setSaving(true);
    try {
      const created = await ideaService.publishIdea(draft);
      onPublished(created as LaunchpadProblem);
      onClose();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full px-3 py-1.5 rounded border border-line bg-card text-text-0 outline-none';
  const labelClass =
    'block text-xs md:text-sm uppercase tracking-wider text-text-1 font-semibold mb-1';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="seed-modal-title"
        className="w-full max-w-xl max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-radius border border-line bg-ink-0 p-5 sm:p-6 text-xs md:text-sm space-y-4 shadow-2xl"
      >
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <h2
            id="seed-modal-title"
            className="text-lg font-semibold tracking-tight text-text-0"
          >
            Seed New Real-World Problem Spec
          </h2>
          <button
            onClick={onClose}
            aria-label="Close problem seeder dialog"
            className="text-text-1 hover:text-text-0 p-1 cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 p-3 rounded-radius border border-rose-500/30 bg-rose-500/5 text-rose-700 dark:text-rose-300"
          >
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="seed-title" className={labelClass}>
              Problem Title *
            </label>
            <input
              id="seed-title"
              type="text"
              required
              minLength={5}
              maxLength={160}
              placeholder="e.g. Distributed Rate Limiter with Token Bucket"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`${inputClass} focus:border-brass`}
            />
          </div>
          <div>
            <label htmlFor="seed-tagline" className={labelClass}>
              Tagline / High-Level Thesis *
            </label>
            <input
              id="seed-tagline"
              type="text"
              required
              maxLength={300}
              placeholder="Sliding window counter with Redis clusters..."
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className={`${inputClass} focus:border-brass`}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="seed-domain" className={labelClass}>
                Domain *
              </label>
              <input
                id="seed-domain"
                type="text"
                required
                maxLength={40}
                list="seed-domain-options"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className={inputClass}
              />
              <datalist id="seed-domain-options">
                {DOMAIN_OPTIONS.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>
            <div>
              <label htmlFor="seed-difficulty" className={labelClass}>
                Difficulty *
              </label>
              <input
                id="seed-difficulty"
                type="text"
                required
                maxLength={40}
                list="seed-difficulty-options"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className={inputClass}
              />
              <datalist id="seed-difficulty-options">
                {DIFFICULTY_OPTIONS.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="seed-hours" className={labelClass}>
                Estimated Hours
              </label>
              <input
                id="seed-hours"
                type="number"
                min={1}
                max={500}
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(Number(e.target.value) || 1)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="seed-tags" className={labelClass}>
                Tags / Suggested Stack (comma separated)
              </label>
              <input
                id="seed-tags"
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label htmlFor="seed-origin" className={labelClass}>
              Origin Context / Quote
            </label>
            <input
              id="seed-origin"
              type="text"
              maxLength={5000}
              placeholder="Sourced from infrastructure leads..."
              value={originStory}
              onChange={(e) => setOriginStory(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="seed-source" className={labelClass}>
              Source URL
            </label>
            <input
              id="seed-source"
              type="url"
              placeholder="https://..."
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="seed-problem" className={labelClass}>
              Problem Description *
            </label>
            <textarea
              id="seed-problem"
              rows={3}
              required
              maxLength={20000}
              placeholder="Explain background constraints, concurrency requirements..."
              value={problemStatement}
              onChange={(e) => setProblemStatement(e.target.value)}
              className={`${inputClass} leading-relaxed`}
            />
          </div>
          <div>
            <label htmlFor="seed-tech-reqs" className={labelClass}>
              Technical Requirements (one per line) *
            </label>
            <textarea
              id="seed-tech-reqs"
              rows={3}
              required
              placeholder={'Atomic Lua scripts in Redis\nSub-millisecond latency check\nGraceful HTTP 429 response'}
              value={techReqs}
              onChange={(e) => setTechReqs(e.target.value)}
              className={`${inputClass} leading-relaxed`}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              className="btn-outline text-xs md:text-sm py-1.5 px-4"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`btn-brass text-xs md:text-sm py-1.5 px-4 ${
                saving ? 'opacity-60 cursor-not-allowed' : ''
              }`}
            >
              {saving ? 'Publishing…' : 'Publish to Idea Bank'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const DOMAIN_OPTIONS = [
  'fintech',
  'systems',
  'logistics',
  'ai',
  'security',
  'devtools',
  'infrastructure',
];

const DIFFICULTY_OPTIONS = [
  'foundational',
  'intermediate',
  'production-grade',
  'easy',
  'medium',
  'hard',
];
