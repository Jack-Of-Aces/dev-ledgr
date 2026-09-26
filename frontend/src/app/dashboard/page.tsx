'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { getDomainStyle } from '@/lib/colors';
import { INITIAL_COACHING } from '@/lib/mock-data';
import {
  ShieldCheck,
  ExternalLink,
  Plus,
  Bell,
  ArrowRight,
  Check,
  Copy,
  Briefcase,
  GraduationCap,
  Activity,
  Layers,
  Search,
  Sparkles,
  Building2,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
  RotateCcw,
  ChevronRight,
} from 'lucide-react';

type DashboardTab = 'ledger' | 'opportunities' | 'coaching' | 'activity';

interface NotificationItem {
  id: number;
  title: string;
  time: string;
  desc: string;
  type: 'success' | 'info' | 'system';
  read: boolean;
}

export default function DashboardPage() {
  const { user, submissions, jobs, ideas, getJobMatchDetails } = useAppStore();

  const [activeTab, setActiveTab] = useState<DashboardTab>('ledger');
  const [proofSearch, setProofSearch] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'latency' | 'throughput'>('recent');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 1,
      title: 'Commit Stamped & CI Attestation Verified',
      time: '2 hours ago',
      desc: 'Automated CI test suite completed with 100% pass rate for commit #c118e07.',
      type: 'success',
      read: false,
    },
    {
      id: 2,
      title: 'High-Match Opportunity: Moniepoint (94%)',
      time: 'Yesterday',
      desc: 'Your verified deduplication engine meets 100% of the platform switch requirements.',
      type: 'info',
      read: false,
    },
    {
      id: 3,
      title: '1-Year Cryptographic Guarantee Active',
      time: '3 days ago',
      desc: 'Public ledger URL is sealed and certified through September 2027.',
      type: 'system',
      read: true,
    },
  ]);

  const notificationRef = useRef<HTMLDivElement>(null);

  // Close notifications popover on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target as Node)
      ) {
        setShowNotificationMenu(false);
      }
    };
    if (showNotificationMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showNotificationMenu]);

  // Close popover on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showNotificationMenu) {
        setShowNotificationMenu(false);
      }
    };
    if (showNotificationMenu) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [showNotificationMenu]);

  const userSubmissions = submissions.filter(
    (s) => s.authorUsername.toLowerCase() === user.username.toLowerCase()
  );

  // Filtered submissions based on search and domain
  const filteredSubmissions = userSubmissions.filter((entry) => {
    const idea = ideas.find((i) => i.id === entry.ideaId);
    const domain = idea?.domain || 'fintech';

    const matchesDomain =
      selectedDomain === 'all' || domain.toLowerCase() === selectedDomain.toLowerCase();

    const searchLower = proofSearch.toLowerCase();
    const matchesSearch =
      !proofSearch ||
      entry.ideaTitle.toLowerCase().includes(searchLower) ||
      entry.hash.toLowerCase().includes(searchLower) ||
      entry.architectureNotes.toLowerCase().includes(searchLower) ||
      domain.toLowerCase().includes(searchLower);

    return matchesDomain && matchesSearch;
  });

  const sortedSubmissions = [...filteredSubmissions].sort((a, b) => {
    if (sortBy === 'latency') {
      const latA = parseInt(a.metrics?.latencyP99?.replace(/[^0-9]/g, '') || '999', 10);
      const latB = parseInt(b.metrics?.latencyP99?.replace(/[^0-9]/g, '') || '999', 10);
      return latA - latB;
    }
    if (sortBy === 'throughput') {
      const tpA = parseInt(a.metrics?.throughput?.replace(/[^0-9]/g, '') || '0', 10);
      const tpB = parseInt(b.metrics?.throughput?.replace(/[^0-9]/g, '') || '0', 10);
      return tpB - tpA;
    }
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  const unreadNotificationCount = notifications.filter((n) => !n.read).length;

  const handleCopyHash = (hash: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleCopyPublicUrl = (e: React.MouseEvent) => {
    e.preventDefault();
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/p/${user.username}`;
      navigator.clipboard.writeText(url);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  // Target job gap analysis for next action recommendation
  const primaryJobWithGap = (() => {
    for (const job of jobs) {
      const details = getJobMatchDetails(job);
      if (details.hasGap && details.gapProblem) {
        return { job, details, gapProblem: details.gapProblem };
      }
    }
    return null;
  })();

  // Coaching itinerary reference
  const activeCoaching = INITIAL_COACHING[0];
  const userSolvedIdeaIds = new Set(userSubmissions.map((s) => s.ideaId));

  return (
    <AuthGuard fallbackMessage="Please sign in to access your developer portfolio dashboard.">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-12 space-y-8 font-sans">
        
        {/* ========================================================= */}
        {/* 1. EXECUTIVE COMMAND HEADER & IDENTITY                    */}
        {/* ========================================================= */}
        <section className="space-y-5 pb-6 border-b border-line">
          {/* System status ribbon */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-text-1">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald" />
              </span>
              <span className="font-semibold text-text-0 uppercase tracking-wider">
                DevLedgr CI Attestation Node v2.4
              </span>
              <span className="text-line">/</span>
              <span className="text-emerald-text">State Stamped & Synced</span>
            </div>

            <div className="flex items-center gap-4">
              <span>
                Domain:{' '}
                <span className="text-text-0 font-medium">
                  {user.username}.devledgr.xyz
                </span>
              </span>
              <span className="hidden sm:inline text-line">/</span>
              <span className="hidden sm:inline">
                Tier:{' '}
                <span className="text-text-0 font-medium capitalize">
                  {user.plan || 'Free / BYOK'}
                </span>
              </span>
            </div>
          </div>

          {/* Identity & Actions Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="relative shrink-0">
                {/* Avatar with status border */}
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-radius border-2 border-line bg-card overflow-hidden flex items-center justify-center font-mono text-lg font-bold text-text-0 shadow-xs">
                  {user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.avatarUrl}
                      alt={user.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    user.name.slice(0, 2).toUpperCase()
                  )}
                </div>
                <span
                  title="Cryptographically Verified Identity"
                  className="absolute -bottom-1 -right-1 bg-emerald text-white p-1 rounded-full border-2 border-ink-0"
                >
                  <ShieldCheck className="w-3 h-3" />
                </span>
              </div>

              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-0">
                    {user.name}
                  </h1>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-radius bg-card border border-line text-text-1 font-medium">
                    @{user.username}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-tint border border-emerald-border text-emerald-text text-xs font-mono font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald" />
                    Verified Proof Holder
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-text-1 leading-relaxed max-w-2xl">
                  {user.headline || 'Software Engineer · Verified Engineering Ledger'}
                </p>

                {/* Stated stack pills */}
                {user.statedSkills && user.statedSkills.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {user.statedSkills.slice(0, 5).map((skill) => (
                      <span
                        key={skill}
                        className="text-xs font-mono px-2 py-0.5 rounded bg-card/60 border border-line/80 text-text-1"
                      >
                        {skill}
                      </span>
                    ))}
                    {user.statedSkills.length > 5 && (
                      <span className="text-xs font-mono text-text-1">
                        +{user.statedSkills.length - 5} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Action Toolbar */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start md:self-center">
              {/* Alerts popover trigger */}
              <div className="relative" ref={notificationRef}>
                <button
                  onClick={() => setShowNotificationMenu(!showNotificationMenu)}
                  aria-label="View system alerts"
                  aria-expanded={showNotificationMenu}
                  className="flex items-center gap-2 px-3 py-2 rounded-radius border border-line bg-card hover:border-text-1 transition-colors cursor-pointer text-xs md:text-sm"
                >
                  <Bell className="w-4 h-4 text-emerald-text" />
                  <span className="font-medium text-text-0">Alerts</span>
                  {unreadNotificationCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-emerald text-white text-xs font-mono font-bold">
                      {unreadNotificationCount}
                    </span>
                  )}
                </button>

                {/* Notification Dropdown Popover */}
                {showNotificationMenu && (
                  <div
                    role="dialog"
                    aria-label="Notifications"
                    className="absolute right-0 mt-2 w-80 sm:w-96 rounded-radius border border-line bg-card shadow-xl z-50 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-line text-xs">
                      <div className="font-semibold text-text-0">
                        System & Verification Alerts
                      </div>
                      {unreadNotificationCount > 0 ? (
                        <button
                          onClick={markAllNotificationsRead}
                          className="text-emerald-text hover:underline font-mono cursor-pointer"
                        >
                          Mark all as read
                        </button>
                      ) : (
                        <span className="text-text-1 font-mono">All read</span>
                      )}
                    </div>

                    <div className="space-y-2 max-h-72 overflow-y-auto divide-y divide-line/40">
                      {notifications.map((item) => (
                        <div
                          key={item.id}
                          className={`pt-2 first:pt-0 space-y-1 text-xs ${
                            !item.read ? 'opacity-100' : 'opacity-70'
                          }`}
                        >
                          <div className="flex items-center justify-between font-mono text-text-1">
                            <span
                              className={`uppercase text-xs font-semibold ${
                                item.type === 'success'
                                  ? 'text-emerald-text'
                                  : item.type === 'info'
                                  ? 'text-blue-600 dark:text-blue-400'
                                  : 'text-text-1'
                              }`}
                            >
                              {item.type}
                            </span>
                            <span>{item.time}</span>
                          </div>
                          <div className="font-medium text-text-0">{item.title}</div>
                          <p className="text-text-1 leading-relaxed">{item.desc}</p>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-line flex items-center justify-between text-xs">
                      <button
                        onClick={() => {
                          setActiveTab('activity');
                          setShowNotificationMenu(false);
                        }}
                        className="text-emerald-text hover:underline font-medium inline-flex items-center gap-1 cursor-pointer font-mono"
                      >
                        <span>Audit Log view</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setShowNotificationMenu(false)}
                        className="text-text-1 hover:text-text-0 cursor-pointer"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Public URL button */}
              <Link
                href={`/p/${user.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline text-xs md:text-sm py-2 px-3 inline-flex items-center gap-1.5"
                title="View your public verified portfolio"
              >
                <span>Public Portfolio</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </Link>

              {/* Primary Action */}
              <Link
                href="/ideas"
                className="btn-brass text-xs md:text-sm py-2 px-4 inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Record New Proof</span>
              </Link>
            </div>
          </div>

          {/* Guarantee summary bar */}
          <div className="p-3.5 rounded-radius border border-line bg-card/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-text shrink-0" />
              <div>
                <span className="font-medium text-text-0">
                  1-Year Proof Guarantee Active:
                </span>{' '}
                <span className="text-text-1">
                  Signed commit hashes are cryptographically sealed and publicly verifiable through{' '}
                  <span className="font-medium text-text-0 font-mono">
                    September 2027
                  </span>{' '}
                  (364 days remaining).
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleCopyPublicUrl}
                className="text-emerald-text hover:underline font-mono inline-flex items-center gap-1 cursor-pointer"
                title="Copy public link"
              >
                {copiedUrl ? (
                  <>
                    <Check className="w-3 h-3 text-emerald" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Share URL</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 2. EXECUTIVE KPI TILES (SCANNABLE METRICS)                 */}
        {/* ========================================================= */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Verified Proofs */}
          <button
            onClick={() => setActiveTab('ledger')}
            className={`p-4 rounded-radius border text-left transition-all cursor-pointer ${
              activeTab === 'ledger'
                ? 'border-emerald bg-card shadow-xs ring-1 ring-emerald/30'
                : 'border-line bg-card/60 hover:border-text-1/60 hover:bg-card'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-text-1 font-mono">
              <span>Verified Proofs</span>
              <ShieldCheck className="w-4 h-4 text-emerald-text" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-text-0">
              {userSubmissions.length}
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-emerald-text font-medium font-mono">
                100% CI pass rate
              </span>
              <span className="text-text-1">View ledger →</span>
            </div>
          </button>

          {/* Card 2: Matched Roles */}
          <button
            onClick={() => setActiveTab('opportunities')}
            className={`p-4 rounded-radius border text-left transition-all cursor-pointer ${
              activeTab === 'opportunities'
                ? 'border-emerald bg-card shadow-xs ring-1 ring-emerald/30'
                : 'border-line bg-card/60 hover:border-text-1/60 hover:bg-card'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-text-1 font-mono">
              <span>Matched Roles</span>
              <Briefcase className="w-4 h-4 text-emerald-text" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-text-0">
              {jobs.length} Active
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-emerald-text font-medium font-mono">
                Top: Moniepoint 94%
              </span>
              <span className="text-text-1">Inspect matches →</span>
            </div>
          </button>

          {/* Card 3: Telemetry Benchmark */}
          <div className="p-4 rounded-radius border border-line bg-card/60 text-left">
            <div className="flex items-center justify-between text-xs text-text-1 font-mono">
              <span>Average Latency</span>
              <Activity className="w-4 h-4 text-emerald-text" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-text-0">
              28ms
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-text-1 font-mono">
                p99 latency (4.8k req/s)
              </span>
              <span className="text-emerald-text font-mono font-medium">
                Deterministic
              </span>
            </div>
          </div>

          {/* Card 4: Career Track Progress */}
          <button
            onClick={() => setActiveTab('coaching')}
            className={`p-4 rounded-radius border text-left transition-all cursor-pointer ${
              activeTab === 'coaching'
                ? 'border-emerald bg-card shadow-xs ring-1 ring-emerald/30'
                : 'border-line bg-card/60 hover:border-text-1/60 hover:bg-card'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-text-1 font-mono">
              <span>Coaching Track</span>
              <GraduationCap className="w-4 h-4 text-emerald-text" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-text-0">
              50% Complete
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-text-1">2 of 4 milestones</span>
              <span className="text-emerald-text font-mono font-medium">
                Week 3 Active →
              </span>
            </div>
          </button>
        </section>

        {/* ========================================================= */}
        {/* 3. STRATEGIC CAREER ACCELERATOR BANNER                    */}
        {/* ========================================================= */}
        {primaryJobWithGap && (
          <section className="p-4 rounded-radius border border-emerald-border bg-emerald-tint flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded bg-emerald/10 text-emerald-text shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xs sm:text-sm font-semibold text-text-0">
                  Targeted Skill Gap Recommendation
                </h3>
                <p className="text-xs sm:text-sm text-text-0 font-medium">
                  Solve <span className="font-bold underline">{primaryJobWithGap.gapProblem.title}</span> to
                  boost your <span className="font-bold">{primaryJobWithGap.job.company}</span>{' '}
                  ({primaryJobWithGap.job.title}) match score from{' '}
                  <span className="font-mono text-amber-700 dark:text-amber-400 font-bold">
                    {primaryJobWithGap.details.score}%
                  </span>{' '}
                  to <span className="font-mono text-emerald-text font-bold">94%+</span>.
                </p>
                <p className="text-xs text-text-1">
                  {primaryJobWithGap.job.gapReason}
                </p>
              </div>
            </div>

            <Link
              href={`/ideas/${primaryJobWithGap.gapProblem.id}`}
              className="btn-brass text-xs py-2 px-3.5 self-start md:self-center shrink-0 inline-flex items-center gap-1.5"
            >
              <span>Solve Problem Spec</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </section>
        )}

        {/* ========================================================= */}
        {/* 4. IA TAB NAVIGATION                                      */}
        {/* ========================================================= */}
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-line">
            <div
              role="tablist"
              aria-label="Dashboard views"
              onKeyDown={(e) => {
                const tabs: DashboardTab[] = ['ledger', 'opportunities', 'coaching', 'activity'];
                const currentIndex = tabs.indexOf(activeTab);
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                  e.preventDefault();
                  const nextTab = tabs[(currentIndex + 1) % tabs.length];
                  setActiveTab(nextTab);
                  document.getElementById(`tab-${nextTab}`)?.focus();
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  const prevTab = tabs[(currentIndex - 1 + tabs.length) % tabs.length];
                  setActiveTab(prevTab);
                  document.getElementById(`tab-${prevTab}`)?.focus();
                } else if (e.key === 'Home') {
                  e.preventDefault();
                  setActiveTab(tabs[0]);
                  document.getElementById(`tab-${tabs[0]}`)?.focus();
                } else if (e.key === 'End') {
                  e.preventDefault();
                  setActiveTab(tabs[tabs.length - 1]);
                  document.getElementById(`tab-${tabs[tabs.length - 1]}`)?.focus();
                }
              }}
              className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-sans"
            >
              <button
                role="tab"
                id="tab-ledger"
                tabIndex={activeTab === 'ledger' ? 0 : -1}
                aria-selected={activeTab === 'ledger'}
                aria-controls="panel-ledger"
                onClick={() => setActiveTab('ledger')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-radius font-medium transition-colors cursor-pointer ${
                  activeTab === 'ledger'
                    ? 'bg-card text-text-0 border border-line shadow-xs font-semibold'
                    : 'text-text-1 hover:text-text-0 hover:bg-card/50'
                }`}
              >
                <Layers className="w-4 h-4 text-emerald-text" />
                <span>Verified Proofs</span>
                <span className="px-1.5 py-0.2 rounded-full bg-card/80 border border-line text-xs font-mono text-text-1">
                  {userSubmissions.length}
                </span>
              </button>

              <button
                role="tab"
                id="tab-opportunities"
                tabIndex={activeTab === 'opportunities' ? 0 : -1}
                aria-selected={activeTab === 'opportunities'}
                aria-controls="panel-opportunities"
                onClick={() => setActiveTab('opportunities')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-radius font-medium transition-colors cursor-pointer ${
                  activeTab === 'opportunities'
                    ? 'bg-card text-text-0 border border-line shadow-xs font-semibold'
                    : 'text-text-1 hover:text-text-0 hover:bg-card/50'
                }`}
              >
                <Briefcase className="w-4 h-4 text-emerald-text" />
                <span>Matched Roles</span>
                <span className="px-1.5 py-0.2 rounded-full bg-card/80 border border-line text-xs font-mono text-text-1">
                  {jobs.length}
                </span>
              </button>

              <button
                role="tab"
                id="tab-coaching"
                tabIndex={activeTab === 'coaching' ? 0 : -1}
                aria-selected={activeTab === 'coaching'}
                aria-controls="panel-coaching"
                onClick={() => setActiveTab('coaching')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-radius font-medium transition-colors cursor-pointer ${
                  activeTab === 'coaching'
                    ? 'bg-card text-text-0 border border-line shadow-xs font-semibold'
                    : 'text-text-1 hover:text-text-0 hover:bg-card/50'
                }`}
              >
                <GraduationCap className="w-4 h-4 text-emerald-text" />
                <span>Coaching Roadmap</span>
              </button>

              <button
                role="tab"
                id="tab-activity"
                tabIndex={activeTab === 'activity' ? 0 : -1}
                aria-selected={activeTab === 'activity'}
                aria-controls="panel-activity"
                onClick={() => setActiveTab('activity')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-radius font-medium transition-colors cursor-pointer ${
                  activeTab === 'activity'
                    ? 'bg-card text-text-0 border border-line shadow-xs font-semibold'
                    : 'text-text-1 hover:text-text-0 hover:bg-card/50'
                }`}
              >
                <Clock className="w-4 h-4 text-emerald-text" />
                <span className="hidden sm:inline">Audit Trail & Alerts</span>
                <span className="sm:hidden">Alerts</span>
              </button>
            </div>

            {/* Quick action in tab strip */}
            {activeTab === 'ledger' && (
              <Link
                href="/ideas"
                className="text-xs text-emerald-text hover:underline inline-flex items-center gap-1 font-mono font-medium"
              >
                <span>Browse Idea Bank</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
            {activeTab === 'opportunities' && (
              <Link
                href="/jobs"
                className="text-xs text-emerald-text hover:underline inline-flex items-center gap-1 font-mono font-medium"
              >
                <span>Explore all opportunities</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
            {activeTab === 'coaching' && (
              <Link
                href="/coaching"
                className="text-xs text-emerald-text hover:underline inline-flex items-center gap-1 font-mono font-medium"
              >
                <span>All coaching tracks</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          {/* ========================================================= */}
          {/* TAB 1: VERIFIED PROOFS (PROVENANCE LEDGER)               */}
          {/* ========================================================= */}
          {activeTab === 'ledger' && (
            <div
              role="tabpanel"
              id="panel-ledger"
              aria-labelledby="tab-ledger"
              className="space-y-4"
            >
              {/* Search & Domain Filter Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-1" />
                  <input
                    type="text"
                    value={proofSearch}
                    onChange={(e) => setProofSearch(e.target.value)}
                    placeholder="Search proofs by title, hash, notes..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-radius border border-line bg-card text-text-0 placeholder:text-text-1 focus:border-emerald focus:outline-none font-mono"
                  />
                  {proofSearch && (
                    <button
                      onClick={() => setProofSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-1 hover:text-text-0"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-text-1 font-mono mr-1">Domain:</span>
                    {['all', 'logistics', 'fintech', 'systems', 'devtools'].map((domain) => (
                      <button
                        key={domain}
                        onClick={() => setSelectedDomain(domain)}
                        className={`px-2.5 py-1 rounded-radius text-xs capitalize transition-colors font-mono cursor-pointer ${
                          selectedDomain === domain
                            ? 'bg-text-0 text-ink-0 font-medium'
                            : 'bg-card border border-line text-text-1 hover:text-text-0 hover:border-text-1'
                        }`}
                      >
                        {domain}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5 pl-2 border-l border-line/60">
                    <span className="text-text-1 font-mono">Sort:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as 'recent' | 'latency' | 'throughput')}
                      aria-label="Sort verified proofs"
                      className="px-2 py-1 rounded-radius bg-card border border-line text-text-0 font-mono text-xs focus:border-emerald outline-none cursor-pointer"
                    >
                      <option value="recent">Most Recent</option>
                      <option value="latency">Lowest Latency (p99)</option>
                      <option value="throughput">Highest Throughput</option>
                    </select>
                  </div>

                  {(proofSearch || selectedDomain !== 'all' || sortBy !== 'recent') && (
                    <button
                      onClick={() => {
                        setProofSearch('');
                        setSelectedDomain('all');
                        setSortBy('recent');
                      }}
                      className="text-text-1 hover:text-text-0 p-1 ml-1"
                      title="Reset filters and sorting"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Submissions List Container */}
              {sortedSubmissions.length > 0 ? (
                <div className="rounded-radius border border-line bg-card/30 divide-y divide-line overflow-hidden">
                  {sortedSubmissions.map((entry) => {
                    const idea = ideas.find((i) => i.id === entry.ideaId);
                    const domainStyle = idea
                      ? getDomainStyle(idea.domain)
                      : getDomainStyle('fintech');
                    const isCopied = copiedHash === entry.hash;

                    return (
                      <div
                        key={entry.hash}
                        className="p-4 sm:p-5 hover:bg-card/70 transition-colors space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Commit Hash button */}
                            <button
                              onClick={(e) => handleCopyHash(entry.hash, e)}
                              className="font-mono text-xs px-2 py-0.5 rounded border border-line bg-ink-0 text-text-0 hover:border-emerald transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                              title="Click to copy commit hash"
                            >
                              <span>#{entry.hash}</span>
                              {isCopied ? (
                                <Check className="w-3 h-3 text-emerald" />
                              ) : (
                                <Copy className="w-2.5 h-2.5 opacity-50" />
                              )}
                            </button>

                            {/* Title */}
                            <Link
                              href={`/ideas/${entry.ideaId}`}
                              className="font-semibold text-sm sm:text-base text-text-0 hover:text-emerald-text hover:underline transition-colors"
                            >
                              {entry.ideaTitle}
                            </Link>

                            {/* Domain Badge */}
                            {idea && (
                              <span
                                className={`text-xs px-2 py-0.5 rounded border font-mono font-medium ${domainStyle.badge}`}
                              >
                                {domainStyle.name}
                              </span>
                            )}

                            {/* Verified Status */}
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-tint border border-emerald-border text-emerald-text text-xs font-mono font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald" />
                              CI Verified
                            </span>
                          </div>

                          <div className="text-xs font-mono text-text-1">
                            {new Date(entry.timestamp).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </div>
                        </div>

                        {/* Architecture Notes */}
                        <p className="text-xs sm:text-sm text-text-1 leading-relaxed max-w-3xl">
                          {entry.architectureNotes}
                        </p>

                        {/* Telemetry and Links Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-line/40 text-xs font-mono">
                          {/* Metrics chips */}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-text-1">
                            {entry.metrics?.latencyP99 && (
                              <span>
                                Latency p99:{' '}
                                <strong className="text-text-0 font-semibold">
                                  {entry.metrics.latencyP99}
                                </strong>
                              </span>
                            )}
                            {entry.metrics?.throughput && (
                              <span>
                                Throughput:{' '}
                                <strong className="text-text-0 font-semibold">
                                  {entry.metrics.throughput}
                                </strong>
                              </span>
                            )}
                            {entry.metrics?.coverage && (
                              <span>
                                Coverage:{' '}
                                <strong className="text-text-0 font-semibold">
                                  {entry.metrics.coverage}
                                </strong>
                              </span>
                            )}
                            <span className="text-emerald-text font-medium">
                              ✓ {entry.testResults.passed}/{entry.testResults.total} tests passed
                            </span>
                          </div>

                          {/* Action Links */}
                          <div className="flex items-center gap-3 shrink-0">
                            {entry.repoUrl && (
                              <a
                                href={entry.repoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-text-1 hover:text-text-0 hover:underline inline-flex items-center gap-1"
                              >
                                <span>Code Repo</span>
                                <ExternalLink className="w-3 h-3 opacity-60" />
                              </a>
                            )}
                            {entry.demoUrl && (
                              <a
                                href={entry.demoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-text hover:underline inline-flex items-center gap-1"
                              >
                                <span>Live Demo</span>
                                <ExternalLink className="w-3 h-3 opacity-60" />
                              </a>
                            )}
                            <Link
                              href={`/ideas/${entry.ideaId}`}
                              className="text-text-0 hover:text-emerald-text hover:underline font-medium inline-flex items-center gap-1"
                            >
                              <span>View Spec</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Empty state */
                <div className="p-10 rounded-radius border border-dashed border-line bg-card/20 text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-card border border-line flex items-center justify-center mx-auto text-text-1">
                    <Search className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-text-0">
                      No proofs match your criteria
                    </h3>
                    <p className="text-xs text-text-1 max-w-sm mx-auto">
                      {proofSearch || selectedDomain !== 'all'
                        ? 'Try clearing the keyword search or selecting a different technical domain.'
                        : 'You haven’t stamped any solutions on your ledger yet. Choose a problem from the Idea Bank to start.'}
                    </p>
                  </div>
                  {proofSearch || selectedDomain !== 'all' ? (
                    <button
                      onClick={() => {
                        setProofSearch('');
                        setSelectedDomain('all');
                      }}
                      className="btn-outline text-xs py-1.5 px-3"
                    >
                      Reset filters
                    </button>
                  ) : (
                    <Link href="/ideas" className="btn-brass text-xs py-1.5 px-3">
                      Browse Idea Bank
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: MATCHED OPPORTUNITIES                              */}
          {/* ========================================================= */}
          {activeTab === 'opportunities' && (
            <div
              role="tabpanel"
              id="panel-opportunities"
              aria-labelledby="tab-opportunities"
              className="space-y-4"
            >
              <div className="p-3.5 rounded-radius border border-line bg-card/40 text-xs text-text-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="font-semibold text-text-0">
                    High-Signal Algorithmic Matching:
                  </span>{' '}
                  Roles are scored directly against your verified codebase test results, not self-reported resume claims.
                </div>
                <Link
                  href="/jobs"
                  className="text-emerald-text hover:underline font-mono inline-flex items-center gap-1 shrink-0"
                >
                  <span>Browse full jobs index</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="space-y-4">
                {jobs.map((job) => {
                  const match = getJobMatchDetails(job);
                  const isHighMatch = !match.hasGap && match.score >= 80;

                  return (
                    <div
                      key={job.id}
                      className="p-5 rounded-radius border border-line bg-card hover:border-zinc-500/50 transition-all space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs font-mono text-emerald-text font-medium">
                            <Building2 className="w-3.5 h-3.5" />
                            <span>{job.company}</span>
                            <span className="text-text-1">·</span>
                            <span className="text-text-1 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {job.location}
                            </span>
                            <span className="text-text-1">·</span>
                            <span className="text-text-1">{job.type}</span>
                          </div>
                          <h2 className="text-lg font-semibold tracking-tight text-text-0 font-sans">
                            {job.title}
                          </h2>
                          <div className="text-xs font-mono text-text-1">
                            Comp: <span className="text-text-0 font-medium">{job.salary}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                          <div className="text-left sm:text-right font-mono">
                            <div
                              className={`text-lg font-bold ${
                                isHighMatch
                                  ? 'text-emerald-text'
                                  : 'text-amber-700 dark:text-amber-400'
                              }`}
                            >
                              {match.score}% Match
                            </div>
                            <div className="text-xs font-medium">
                              {isHighMatch ? (
                                <span className="text-emerald-text">Ready to apply</span>
                              ) : (
                                <span className="text-amber-700 dark:text-amber-400">
                                  1 Skill gap detected
                                </span>
                              )}
                            </div>
                          </div>

                          <Link
                            href={`/jobs/${job.id}/apply`}
                            className="btn-brass text-xs py-2 px-3.5 shrink-0 inline-flex items-center gap-1.5"
                          >
                            <span>Run AI Scrutiny</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>

                      {/* Description excerpt */}
                      <p className="text-xs sm:text-sm text-text-1 leading-relaxed max-w-3xl">
                        {job.description}
                      </p>

                      {/* Matched proofs vs gaps */}
                      <div className="space-y-2 pt-2 border-t border-line/40 text-xs font-mono">
                        <div className="text-text-1 font-semibold uppercase tracking-wider text-xs">
                          Proof-of-Work Verification Analysis:
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {match.solvedProofTitles.map((title) => (
                            <span
                              key={title}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-tint border border-emerald-border text-emerald-text font-medium"
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald" />
                              <span>{title}</span>
                            </span>
                          ))}

                          {match.hasGap && match.gapProblem && (
                            <Link
                              href={`/ideas/${match.gapProblem.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-400 hover:border-amber-500/50 transition-colors font-medium"
                            >
                              <AlertCircle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                              <span>Missing: {match.gapProblem.title} (Solve to unlock →)</span>
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: COACHING ROADMAP                                   */}
          {/* ========================================================= */}
          {activeTab === 'coaching' && (
            <div
              role="tabpanel"
              id="panel-coaching"
              aria-labelledby="tab-coaching"
              className="space-y-6"
            >
              {/* Program header card */}
              <div className="p-5 rounded-radius border border-line bg-card space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
                  <div>
                    <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-text-0">
                      {activeCoaching.title}
                    </h2>
                    <p className="text-xs text-text-1 mt-1 max-w-2xl leading-relaxed">
                      {activeCoaching.subtitle}
                    </p>
                  </div>

                  <Link
                    href={`/coaching/${activeCoaching.id}`}
                    className="btn-brass text-xs py-2 px-3.5 self-start sm:self-auto shrink-0 inline-flex items-center gap-1.5"
                  >
                    <span>Open AI Coaching Session</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-text-1">Curriculum Completion</span>
                    <span className="text-emerald-text font-semibold">
                      2 of 4 Milestones Stamped (50%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-line overflow-hidden">
                    <div
                      className="h-full bg-emerald transition-all duration-300"
                      style={{ width: '50%' }}
                    />
                  </div>
                </div>
              </div>

              {/* Milestones timeline */}
              <div className="space-y-3">
                <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-text-1">
                  Milestone Sequence
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeCoaching.milestones.map((m) => {
                    const isSolved = m.ideaIdRef ? userSolvedIdeaIds.has(m.ideaIdRef) : false;
                    const isCurrent = m.week === 3;

                    return (
                      <div
                        key={m.week}
                        className={`p-4 rounded-radius border transition-all space-y-3 ${
                          isSolved
                            ? 'border-emerald-border bg-emerald-tint/40'
                            : isCurrent
                            ? 'border-emerald bg-card ring-1 ring-emerald/30'
                            : 'border-line bg-card/40 opacity-75'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="font-semibold text-text-1">
                            WEEK 0{m.week}
                          </span>
                          {isSolved ? (
                            <span className="inline-flex items-center gap-1 text-emerald-text font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Verified in Ledger</span>
                            </span>
                          ) : isCurrent ? (
                            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium">
                              <Zap className="w-3.5 h-3.5" />
                              <span>Active Target</span>
                            </span>
                          ) : (
                            <span className="text-text-1">Upcoming</span>
                          )}
                        </div>

                        <div>
                          <div className="font-semibold text-sm text-text-0">
                            {m.title}
                          </div>
                          <p className="text-xs text-text-1 mt-1 leading-relaxed">
                            {m.deliverable}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-line/40 flex items-center justify-between text-xs">
                          {m.ideaIdRef ? (
                            <Link
                              href={`/ideas/${m.ideaIdRef}`}
                              className="text-emerald-text hover:underline font-mono inline-flex items-center gap-1"
                            >
                              <span>{isSolved ? 'Review Spec' : 'Solve Spec →'}</span>
                              <ChevronRight className="w-3 h-3" />
                            </Link>
                          ) : (
                            <span className="text-text-1 font-mono">Theoretical review</span>
                          )}

                          <Link
                            href={`/coaching/${activeCoaching.id}`}
                            className="text-text-1 hover:text-text-0 font-mono"
                          >
                            AI Prompts →
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 4: AUDIT TRAIL & NOTIFICATIONS                        */}
          {/* ========================================================= */}
          {activeTab === 'activity' && (
            <div
              role="tabpanel"
              id="panel-activity"
              aria-labelledby="tab-activity"
              className="space-y-4"
            >
              <div className="flex items-center justify-between text-xs font-mono text-text-1 pb-2 border-b border-line">
                <span>Cryptographic Attestation & Recruiter Activity Stream</span>
                {unreadNotificationCount > 0 && (
                  <button
                    onClick={markAllNotificationsRead}
                    className="text-emerald-text hover:underline cursor-pointer"
                  >
                    Mark all as read
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-4 rounded-radius border bg-card space-y-1.5 text-xs transition-colors ${
                      !n.read
                        ? 'border-emerald/40 bg-emerald-tint/20 ring-1 ring-emerald/20'
                        : 'border-line bg-card/60'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono text-text-1">
                      <div className="flex items-center gap-2">
                        {!n.read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald shrink-0" title="Unread notification" />
                        )}
                        <span
                          className={`font-semibold uppercase tracking-wider ${
                            n.type === 'success'
                              ? 'text-emerald-text'
                              : n.type === 'info'
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-text-1'
                          }`}
                        >
                          {n.type}
                        </span>
                      </div>
                      <span>{n.time}</span>
                    </div>
                    <div className="font-semibold text-sm text-text-0 font-sans">
                      {n.title}
                    </div>
                    <p className="text-text-1 leading-relaxed sm:text-xs">
                      {n.desc}
                    </p>
                  </div>
                ))}

                {/* Additional platform verification log items */}
                <div className="p-4 rounded-radius border border-line bg-card/40 space-y-1 text-xs opacity-75">
                  <div className="flex items-center justify-between font-mono text-text-1">
                    <span className="uppercase tracking-wider">CONSENSUS</span>
                    <span>4 days ago</span>
                  </div>
                  <div className="font-semibold text-text-0">
                    ED25519 Root Key Rollover Completed
                  </div>
                  <p className="text-text-1 leading-relaxed">
                    Identity public key signature refreshed across 12 independent auditing peers.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </AuthGuard>
  );
}
