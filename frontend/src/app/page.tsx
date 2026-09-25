'use client';

import React from 'react';
import Link from 'next/link';
import { BrandMark } from '@/components/brand/BrandMark';
import { LedgerEntryRow } from '@/components/ui/LedgerEntryRow';
import { useAppStore } from '@/lib/store';
import { ArrowRight, ExternalLink } from 'lucide-react';

export default function HomePage() {
  const { submissions, openAuthModal } = useAppStore();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 md:py-20 space-y-20">
      {/* Modern Developer Hero Header */}
      <section className="space-y-6">
        <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight text-text-0 leading-[1.08]">
          Proof of work, <br className="hidden sm:inline" />
          <span className="text-text-1">not another tutorial clone.</span>
        </h1>

        <p className="text-base sm:text-lg text-text-1 max-w-2xl leading-relaxed">
          DevLedgr is a ledger, not a resume. Every solved engineering problem earns a verified commit hash, real CI test telemetry, and a guaranteed 1-year public portfolio URL.
        </p>

        <div className="pt-2 flex flex-wrap items-center gap-3">
          <Link href="/ideas" className="btn-brass">
            <span>Explore Problems</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link href="/dashboard" className="btn-outline">
            <span>Open Dashboard</span>
          </Link>
          <button
            onClick={openAuthModal}
            className="text-xs font-mono text-green-700 dark:text-green-400 hover:underline px-3 py-2 cursor-pointer flex items-center gap-1.5 transition-colors"
          >
            <span>Connect GitHub</span>
            <span>→</span>
          </button>
        </div>
      </section>

      <hr className="rule" />

      {/* In Use: The Live Ledger Entry Section */}
      <section className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-text-0">
            Live Verified Ledger Entries
          </h2>
          <p className="text-xs sm:text-sm text-text-1 max-w-sm">
            Every submission earns a commit-style hash and <br className="hidden sm:inline" />
            a permanent portfolio URL, guaranteed for one year.
          </p>
        </div>

        <div className="border border-line bg-card/30 overflow-hidden divide-y divide-line">
          {submissions.slice(0, 3).map((entry) => (
            <LedgerEntryRow key={entry.hash} entry={entry} />
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
          <span className="text-text-1">
            All entries signed with SHA-256 and verified through automated CI test harnesses.
          </span>
          <Link href="/p/junior_dev" className="text-green-700 dark:text-green-400 hover:underline font-medium flex items-center gap-1 font-mono">
            <span>Inspect sample 1-year public portfolio</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </section>

      <hr className="rule" />

      {/* The Core Shift: Why Resumes Fail Early-Career Engineers */}
      <section className="space-y-8">
        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-0">
            The problem with the portfolio project
          </h2>
          <p className="text-sm sm:text-base text-text-1 max-w-2xl leading-relaxed">
            Junior developers learn the fundamentals, then build indistinguishable Netflix or Spotify clones following video guides. Recruiters discard them because copy-pasted apps prove neither architectural intuition nor the ability to handle production failure modes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-text-0">
              Operational Realism
            </h3>
            <p className="text-xs sm:text-sm text-text-1 leading-relaxed">
              Every challenge on DevLedgr originates from real production teams: webhook deduplication under concurrency, offline-first sync with packet loss, and zero-downtime database migrations.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-semibold text-text-0">
              Deterministic Verification
            </h3>
            <p className="text-xs sm:text-sm text-text-1 leading-relaxed">
              Solutions run against automated synthetic traffic harnesses measuring p99 latency, memory allocations, and edge failure recovery. Passing yields an immutable ledger entry.
            </p>
          </div>
        </div>
      </section>

      <hr className="rule" />

      {/* The Protocol: Problem → Proof → Opportunity */}
      <section className="space-y-8">
        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-0">
            The Protocol
          </h2>
          <p className="text-xs sm:text-sm text-text-1 max-w-sm">
            Three phases connecting engineering capability <br className="hidden sm:inline" />
            directly to employment opportunity.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 border-y border-line md:divide-x divide-line">
          {/* Phase 1 */}
          <div className="py-6 md:px-6 first:pl-0 last:pr-0 space-y-3">
            <h3 className="text-lg font-semibold text-text-0">
              Idea Bank
            </h3>
            <p className="text-xs sm:text-sm text-text-1 leading-relaxed">
              Operational challenges sourced from active companies, translated into formal engineering specs with live mock servers.
            </p>
            <div className="pt-1">
              <Link href="/ideas" className="text-xs text-green-700 dark:text-green-400 hover:underline inline-flex items-center gap-1 font-medium font-mono">
                Browse Problems →
              </Link>
            </div>
          </div>

          {/* Phase 2 */}
          <div className="py-6 md:px-6 first:pl-0 last:pr-0 space-y-3">
            <h3 className="text-lg font-semibold text-text-0">
              Cryptographic Ledger
            </h3>
            <p className="text-xs sm:text-sm text-text-1 leading-relaxed">
              Submit code and architecture notes. Passing automated CI test harnesses generates a permanent commit hash and a 1-year verified portfolio URL.
            </p>
            <div className="pt-1">
              <Link href="/p/junior_dev" className="text-xs text-green-700 dark:text-green-400 hover:underline inline-flex items-center gap-1 font-medium font-mono">
                Inspect Public Proof →
              </Link>
            </div>
          </div>

          {/* Phase 3 */}
          <div className="py-6 md:px-6 first:pl-0 last:pr-0 space-y-3">
            <h3 className="text-lg font-semibold text-text-0">
              AI Scrutiny & Matching
            </h3>
            <p className="text-xs sm:text-sm text-text-1 leading-relaxed">
              Our scrutiny engine audits your verified proofs against live job requirements. If ready, it generates an ATS-safe package; if not, it identifies the exact missing problem.
            </p>
            <div className="pt-1">
              <Link href="/jobs" className="text-xs text-green-700 dark:text-green-400 hover:underline inline-flex items-center gap-1 font-medium font-mono">
                View Matched Roles →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <hr className="rule" />

      {/* Telemetry & Verification Engine */}
      <section className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-text-0">
            Verification Specifications
          </h2>
          <p className="text-xs sm:text-sm text-text-1 max-w-sm">
            How proof is generated, verified, and sealed <br className="hidden sm:inline" />
            for high-signal engineering hiring.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 pt-2">
          <div className="space-y-1.5">
            <div className="font-semibold text-text-0 text-sm">
              SHA-256 Commit
            </div>
            <p className="text-text-1 text-xs leading-relaxed">
              Every accepted solution receives an immutable commit hash signed against the DevLedgr consensus network.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="font-semibold text-text-0 text-sm">
              Synthetic Load Fleet
            </div>
            <p className="text-text-1 text-xs leading-relaxed">
              Tested against synthetic high-load endpoints simulating real-world packet loss, concurrency, and rate limits.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="font-semibold text-text-0 text-sm">
              Deterministic SLA
            </div>
            <p className="text-text-1 text-xs leading-relaxed">
              Measures p99 latency, memory allocations, and error rates across 500 test batches to verify production readiness.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="font-semibold text-text-0 text-sm">
              1-Year Guarantee
            </div>
            <p className="text-text-1 text-xs leading-relaxed">
              Your public portfolio URL is cryptographically guaranteed for 365 days, proving your skills stay active.
            </p>
          </div>
        </div>
      </section>

      {/* Bottom CTA Block */}
      <section className="p-8 sm:p-12 border border-line bg-card text-center space-y-6">
        <BrandMark size={36} className="mx-auto" />
        <div className="max-w-xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-0">
            Build proof.
          </h2>
          <p className="text-xs sm:text-sm text-text-1 leading-relaxed">
            Pick a real-world problem from the Idea Bank, build against the provided mock infrastructure, and earn your verified 1-year portfolio URL today.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/ideas" className="btn-brass text-xs py-2 px-5">
            Pick a Problem to Solve
          </Link>
          <Link href="/about" className="btn-outline text-xs py-2 px-5">
            Read the Manifesto
          </Link>
        </div>
      </section>
    </div>
  );
}
