"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { LedgerEntryRow } from "@/components/ui/LedgerEntryRow";
import { LedgerFeedSkeleton } from "@/components/ui/skeletons";
import { useAppStore } from "@/lib/store";
import {
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Terminal,
  Cpu,
  FileText,
  Check,
  Copy,
} from "lucide-react";

export default function HomePage() {
  const { submissions, isLoggedIn } = useAppStore();
  const [copiedHash, setCopiedHash] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCopyHash = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText("c118e07");
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 md:py-16 space-y-16 sm:space-y-24">
      {/* ========================================================= */}
      {/* SECTION 1: HIGH-IMPACT HERO & LIVE PROOF SPECIMEN         */}
      {/* ========================================================= */}
      <section className="space-y-8 md:space-y-10">
        <div className="space-y-5 max-w-3xl">
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-semibold tracking-tight text-text-0 leading-[1.05]">
            Proof of work, <br className="hidden sm:inline" />
            <span className="text-text-1">not tutorial clones.</span>
          </h1>

          <p className="text-lg sm:text-xl text-text-1 leading-relaxed max-w-xl font-normal">
            Real production challenges. Automated CI test harnesses. Permanent cryptographic proof that gets you hired.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {isLoggedIn ? (
              <>
                <Link href="/dashboard" className="btn-brass min-h-[44px] text-xs sm:text-sm px-5 inline-flex items-center justify-center gap-2">
                  <span>Go to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="/ideas" className="btn-outline min-h-[44px] text-xs sm:text-sm px-5 inline-flex items-center justify-center gap-2">
                  <span>Browse 20+ Specs</span>
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="btn-brass min-h-[44px] text-xs sm:text-sm px-5 inline-flex items-center justify-center gap-2">
                  <span>Start Building Proof</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="/ideas" className="btn-outline min-h-[44px] text-xs sm:text-sm px-5 inline-flex items-center justify-center gap-2">
                  <span>Browse 20+ Specs</span>
                </Link>
              </>
            )}
          </div>

          <p className="text-xs text-text-1 font-mono">
            Free 1-year cryptographic ledger certificate · Open-source friendly
          </p>
        </div>

        {/* Live Interactive Specimen Card: "The Anatomy of a DevLedgr Proof" */}
        <div className="rounded-radius border border-line bg-card shadow-sm overflow-hidden">
          {/* Terminal Titlebar */}
          <div className="px-4 py-2.5 bg-ink-0 border-b border-line flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald shrink-0" />
              <span className="text-text-0 font-medium">DevLedgr CI Attestation Engine v2.4</span>
              <span className="text-line">/</span>
              <span className="text-emerald-text font-semibold">100% CI HARNESS PASSED</span>
            </div>
            <div className="text-text-1 text-[11px]">
              SHA-256 Stamped · 365-Day Guarantee
            </div>
          </div>

          {/* Proof Body */}
          <div className="p-4 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-line">
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                  <span className="font-bold text-text-0">#c118e07</span>
                  <button
                    onClick={handleCopyHash}
                    className="text-text-1 hover:text-text-0 p-1 cursor-pointer transition-colors"
                    title="Copy commit hash"
                    aria-label="Copy commit hash"
                  >
                    {copiedHash ? (
                      <Check className="w-3.5 h-3.5 text-emerald-text" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <span className="text-line">·</span>
                  <span className="text-emerald-text font-medium">SHA-256 Signed</span>
                  <span className="text-line">·</span>
                  <span className="text-text-1">Production Proof</span>
                </div>
                <h3 className="text-base sm:text-lg md:text-xl font-semibold tracking-tight text-text-0 break-words">
                  Webhook Deduplication &amp; Distributed Idempotency Engine
                </h3>
              </div>

              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                <Link
                  href="/p/junior_dev"
                  className="btn-outline min-h-[44px] text-xs py-2 px-3.5 w-full sm:w-auto inline-flex items-center justify-center gap-1.5 font-mono"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Inspect Proof</span>
                </Link>
              </div>
            </div>

            {/* Micro-Telemetry Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
              <div className="p-3 rounded border border-line/60 bg-ink-0/40">
                <div className="text-[11px] text-text-1 uppercase">P99 Latency</div>
                <div className="text-base font-semibold text-text-0 mt-0.5">28ms</div>
              </div>
              <div className="p-3 rounded border border-line/60 bg-ink-0/40">
                <div className="text-[11px] text-text-1 uppercase">Throughput</div>
                <div className="text-base font-semibold text-text-0 mt-0.5">220 req/s</div>
              </div>
              <div className="p-3 rounded border border-line/60 bg-ink-0/40">
                <div className="text-[11px] text-text-1 uppercase">Test Vectors</div>
                <div className="text-base font-semibold text-emerald-text mt-0.5">500/500 passed</div>
              </div>
              <div className="p-3 rounded border border-line/60 bg-ink-0/40">
                <div className="text-[11px] text-text-1 uppercase">Recruiter Export</div>
                <div className="text-base font-semibold text-text-0 mt-0.5">ATS-Ready .md</div>
              </div>
            </div>

            {/* Permanent Proof Badge */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono text-text-1">
              <span>
                Permanent Verification URL:{' '}
                <Link href="/p/junior_dev" className="text-emerald-text font-semibold hover:underline">
                  alex.devledgr.io
                </Link>
              </span>
              <span className="text-[11px]">Valid through Sep 2027</span>
            </div>
          </div>
        </div>
      </section>

      <hr className="rule" />

      {/* ========================================================= */}
      {/* SECTION 2: THE 4 CORE PILLARS (SHORTEST WAY POSSIBLE)      */}
      {/* ========================================================= */}
      <section className="space-y-8">
        <div className="space-y-2 max-w-2xl">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-0">
            Everything you need to prove engineering capability
          </h2>
          <p className="text-xs sm:text-sm lg:text-base text-text-1 leading-relaxed">
            DevLedgr replaces ambiguous claims with verifiable engineering proof.
            Here is how you turn problem-solving into job offers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Pillar 1 */}
          <div className="p-6 rounded-radius border border-line bg-card space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-radius border border-line bg-ink-0 flex items-center justify-center text-text-0">
                <Terminal className="w-5 h-5 text-emerald-text" />
              </div>
              <h3 className="text-lg font-semibold text-text-0">
                1. Real Failure Mode Challenges
              </h3>
              <p className="text-xs sm:text-sm text-text-1 leading-relaxed">
                No LeetCode toys. Tackle distributed race conditions, offline sync partitions, high-frequency state reconciliation, and zero-downtime schemas.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/ideas"
                className="text-xs sm:text-sm text-emerald-text font-mono font-medium hover:underline inline-flex items-center gap-1.5"
              >
                <span>Browse Operational Specs</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Pillar 2 */}
          <div className="p-6 rounded-radius border border-line bg-card space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-radius border border-line bg-ink-0 flex items-center justify-center text-text-0">
                <Cpu className="w-5 h-5 text-emerald-text" />
              </div>
              <h3 className="text-lg font-semibold text-text-0">
                2. Automated CI Stress Harnesses
              </h3>
              <p className="text-xs sm:text-sm text-text-1 leading-relaxed">
                Solutions undergo synthetic traffic bursts, chaos injection, and latency SLA checks. Pass the harness to earn an immutable SHA-256 commit stamp.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/ideas/webhook-idempotency-engine"
                className="text-xs sm:text-sm text-emerald-text font-mono font-medium hover:underline inline-flex items-center gap-1.5"
              >
                <span>Inspect Test Vector Specs</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Pillar 3 */}
          <div className="p-6 rounded-radius border border-line bg-card space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-radius border border-line bg-ink-0 flex items-center justify-center text-text-0">
                <ShieldCheck className="w-5 h-5 text-emerald-text" />
              </div>
              <h3 className="text-lg font-semibold text-text-0">
                3. Verifiable Public Portfolio
              </h3>
              <p className="text-xs sm:text-sm text-text-1 leading-relaxed">
                Your permanent domain (<code className="text-text-0 font-mono">you.devledgr.io</code>) featuring cryptographic certs, telemetry cards, and interactive architecture diffs.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/p/junior_dev"
                className="text-xs sm:text-sm text-emerald-text font-mono font-medium hover:underline inline-flex items-center gap-1.5"
              >
                <span>View Live Verified Portfolio</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Pillar 4 */}
          <div className="p-6 rounded-radius border border-line bg-card space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-radius border border-line bg-ink-0 flex items-center justify-center text-text-0">
                <FileText className="w-5 h-5 text-emerald-text" />
              </div>
              <h3 className="text-lg font-semibold text-text-0">
                4. Recruiter Proofs &amp; Job Match
              </h3>
              <p className="text-xs sm:text-sm text-text-1 leading-relaxed">
                1-click ATS-ready markdown for CVs and outreach. Our engine maps your verified proofs against live roles to pinpoint exact gaps to solve.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/jobs"
                className="text-xs sm:text-sm text-emerald-text font-mono font-medium hover:underline inline-flex items-center gap-1.5"
              >
                <span>View Matched Engineering Roles</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <hr className="rule" />

      {/* ========================================================= */}
      {/* SECTION 3: LIVE VERIFIED LEDGER FEED                      */}
      {/* ========================================================= */}
      <section className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-text-0">
            Live Verified Ledger Entries
          </h2>
          <p className="text-xs sm:text-sm lg:text-base text-text-1 max-w-sm">
            Real developers passing automated CI test harnesses and stamping permanent proofs.
          </p>
        </div>

        {!mounted ? (
          <LedgerFeedSkeleton count={3} />
        ) : (
          <div className="border border-line bg-card/30 overflow-hidden divide-y divide-line">
            {submissions.slice(0, 3).map((entry) => (
              <LedgerEntryRow key={entry.hash} entry={entry} />
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs md:text-sm pt-1">
          <span className="text-text-1">
            All entries signed with SHA-256 and verified through automated CI test harnesses.
          </span>
          <Link
            href="/p/junior_dev"
            className="text-emerald-text hover:underline font-medium flex items-center gap-1 font-mono"
          >
            <span>Inspect sample 1-year public portfolio</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </section>

      {/* Bottom CTA Block */}
      <section className="p-6 sm:p-12 border border-line bg-card text-center space-y-6">
        <BrandMark size={36} className="mx-auto" />
        <div className="max-w-xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-0">
            Ready to build real proof?
          </h2>
          <p className="text-sm sm:text-base text-text-1 leading-relaxed max-w-lg mx-auto">
            Solve production failure modes. Pass automated CI. Stamp your permanent public ledger.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
          <Link
            href="/ideas"
            className="btn-brass min-h-[44px] text-xs sm:text-sm py-2 px-5 inline-flex items-center justify-center"
          >
            Pick a Problem to Solve
          </Link>
          <Link
            href="/about"
            className="btn-outline min-h-[44px] text-xs sm:text-sm py-2 px-5 inline-flex items-center justify-center"
          >
            Read the Manifesto
          </Link>
        </div>
      </section>
    </div>
  );
}
