'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { LedgerEntryRow } from '@/components/ui/LedgerEntryRow';
import { AuthGuard } from '@/components/auth/AuthGuard';
import {
  ShieldCheck,
  ExternalLink,
  Plus,
  Bell,
  ArrowRight,
} from 'lucide-react';

export default function DashboardPage() {
  const { user, submissions, jobs } = useAppStore();
  const [showNotificationOverlay, setShowNotificationOverlay] = useState(false);
  const [countdown, setCountdown] = useState({ days: 364, hours: 19, minutes: 42, seconds: 18 });

  // Escape key closes notification drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showNotificationOverlay) {
        setShowNotificationOverlay(false);
      }
    };
    if (showNotificationOverlay) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [showNotificationOverlay]);

  // Live countdown ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: 59, seconds: 59 };
        if (prev.hours > 0) return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return { ...prev, days: prev.days - 1, hours: 23, minutes: 59, seconds: 59 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const userSubmissions = submissions.filter(
    (s) => s.authorUsername.toLowerCase() === user.username.toLowerCase()
  );

  const notifications = [
    {
      id: 1,
      title: 'Commit Stamped & Verified',
      time: '2 hours ago',
      desc: 'Automated CI test suite completed successfully for #a3f9d21.',
      type: 'success',
    },
    {
      id: 2,
      title: 'New High-Match Job Surfaced',
      time: 'Yesterday',
      desc: 'Moniepoint opened a Junior Platform Backend role matching 94% of your verified portfolio.',
      type: 'info',
    },
    {
      id: 3,
      title: '1-Year Portfolio URL Renewed',
      time: '3 days ago',
      desc: 'Your public portfolio URL is cryptographically guaranteed through September 2027.',
      type: 'info',
    },
  ];

  return (
    <AuthGuard fallbackMessage="Please sign in to access your developer portfolio dashboard.">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 md:py-16 space-y-8 text-sm font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-line">
        <div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-text-0">
            Welcome, {user.name}
          </h1>
          <p className="text-text-1 mt-1 text-xs">
            @{user.username} · {user.headline}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowNotificationOverlay(!showNotificationOverlay)}
            className="flex items-center gap-2 px-3 py-2 rounded-radius border border-line bg-card hover:border-zinc-500 transition-colors cursor-pointer text-xs"
          >
            <Bell className="w-3.5 h-3.5 text-green-700 dark:text-green-400" />
            <span>Alerts</span>
            <span className="w-1.5 h-1.5 rounded-full bg-green-600 dark:bg-green-500" />
          </button>

          <Link
            href={`/p/${user.username}`}
            className="btn-outline text-xs py-2 px-3.5 inline-flex items-center gap-1.5"
          >
            <span>Public URL</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </Link>

          <Link
            href="/ideas"
            className="btn-brass text-xs py-2 px-4 inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Solve Problem</span>
          </Link>
        </div>
      </div>

      {/* 365-Day Validity Countdown Ticker */}
      <div className="p-4 rounded-radius border border-line bg-card/40 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
        <div className="flex items-start sm:items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-green-700 dark:text-green-400 shrink-0 mt-0.5 sm:mt-0" />
          <div>
            <div className="font-medium text-text-0 flex flex-wrap items-center gap-2">
              <span>Public Portfolio Guarantee</span>
              <span className="text-xs text-green-700 dark:text-green-400 bg-green-500/10 px-2.5 py-1 rounded border border-green-500/20 font-mono font-medium">
                verified online
              </span>
            </div>
            <div className="text-xs text-text-1 mt-0.5 font-mono break-all sm:break-normal">
              {user.username}.devledgr.io · Valid through Sep 2027
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono text-text-0">
          <span className="text-text-1">Valid for:</span>
          <span className="text-green-700 dark:text-green-400 font-semibold tabular">
            {countdown.days}d {countdown.hours.toString().padStart(2, '0')}h {countdown.minutes.toString().padStart(2, '0')}m {countdown.seconds.toString().padStart(2, '0')}s
          </span>
        </div>
      </div>

      {/* Telemetry Status Strip */}
      <div className="flex flex-wrap items-center justify-between gap-y-3 gap-x-8 py-3.5 px-4 border border-line bg-card/20 rounded-radius text-xs">
        <div className="flex items-center gap-2">
          <span className="text-text-1">Verified Proofs:</span>
          <span className="font-semibold text-text-0">{userSubmissions.length}</span>
          <span className="text-green-700 dark:text-green-400 text-xs font-mono font-medium">(100% CI pass)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-text-1">Matched Roles:</span>
          <span className="font-semibold text-text-0">{jobs.length} active</span>
          <span className="text-green-700 dark:text-green-400 text-xs font-mono font-medium">(Top: Moniepoint 94%)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-text-1">Average Latency:</span>
          <span className="font-mono font-semibold text-text-0">28ms p99</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-text-1">Compute Tier:</span>
          <span className="text-text-0 font-medium">Free / BYOK</span>
          <Link href="/settings" className="text-green-700 dark:text-green-400 hover:underline text-xs ml-1 font-mono font-medium">
            Keys →
          </Link>
        </div>
      </div>

      {/* Personal Provenance Ledger History */}
      <section className="space-y-4 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-line">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-text-0">
            Recorded Entries ({userSubmissions.length})
          </h2>
          <Link
            href="/ideas"
            className="text-xs text-green-700 dark:text-green-400 hover:underline inline-flex items-center gap-1 font-medium font-mono"
          >
            <span>Record New Proof</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="border border-line bg-card/30 divide-y divide-line overflow-hidden">
          {userSubmissions.map((entry) => (
            <LedgerEntryRow key={entry.hash} entry={entry} />
          ))}
        </div>
      </section>

      {/* Slide-over Notification Overlay */}
      {showNotificationOverlay && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowNotificationOverlay(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-notifications-title"
            className="w-full max-w-sm h-full bg-ink-0 border-l border-line p-6 space-y-5 overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h2 id="dashboard-notifications-title" className="text-base font-semibold text-text-0">
                Notifications
              </h2>
              <button
                onClick={() => setShowNotificationOverlay(false)}
                aria-label="Close notifications panel"
                className="text-xs text-text-1 hover:text-text-0 p-1 cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            <div className="space-y-3">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className="p-3.5 rounded-radius border border-line bg-card/50 space-y-1 text-xs"
                >
                  <div className="flex justify-between items-center text-xs text-text-1">
                    <span className="font-semibold text-green-700 dark:text-green-400 uppercase font-mono">{n.type}</span>
                    <span className="font-mono">{n.time}</span>
                  </div>
                  <div className="font-semibold text-text-0">{n.title}</div>
                  <p className="text-text-1 text-xs leading-relaxed">{n.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      </div>
    </AuthGuard>
  );
}
