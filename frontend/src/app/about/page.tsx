import React from 'react';
import type { Metadata } from 'next';
import { BrandMark } from '@/components/brand/BrandMark';
import { Mail } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Manifesto & About',
  description:
    'A ledger, not a resume. Why DevLedgr exists to solve the junior developer portfolio trap and tutorial purgatory.',
  alternates: {
    canonical: '/about',
  },
};

export default function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 md:py-20 space-y-12 text-sm lg:text-base font-sans">
      <div className="space-y-4">
        <BrandMark size={36} />
        <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-text-0">
          The DevLedgr Manifesto
        </h1>
        <p className="text-lg sm:text-xl text-green-700 dark:text-green-400 font-medium">
          A ledger, not a resume. Proof, recorded.
        </p>
      </div>

      <div className="space-y-6 text-sm lg:text-base sm:text-base text-text-0 leading-relaxed max-w-xl">
        <p>
          Engineers learn the core syntax, build a few practice apps, and then hit an immediate wall: <b>&ldquo;I know the basics. What do I build next?&rdquo;</b>
        </p>

        <p className="text-text-1">
          Hiring teams routinely ignore portfolio projects. A cloned streaming service or mock store built from a video guide proves neither architectural discipline nor the ability to handle broken production networks.
        </p>

        <blockquote className="p-5 sm:p-6 rounded-radius border border-green-500/20 bg-green-500/5 space-y-3">
          <p className="text-base sm:text-lg font-medium text-text-0 leading-snug">
            &ldquo;Every problem solved is a permanent ledger entry: timestamped, verified, and inspectable by any technical team.&rdquo;
          </p>
          <p className="text-xs md:text-sm sm:text-sm lg:text-base text-text-1 leading-relaxed">
            We provide operational challenges designed around realistic failure modes: packet loss, lock contention, and network partitions. Solutions run against live test harnesses and earn a 365-day cryptographic portfolio guarantee.
          </p>
        </blockquote>

        <h2 className="text-2xl font-semibold tracking-tight text-text-0 pt-4">
          Core Operating Principles
        </h2>
        <ul className="space-y-2 text-xs md:text-sm sm:text-sm lg:text-base text-text-1 list-disc pl-5">
          <li>No video courses or passive quizzes. You build and debug against actual test harnesses.</li>
          <li>No generic job listings. Roles surface only when your verified telemetry matches production constraints.</li>
          <li>No unverified resume claims. Every highlighted competency links directly to committed code and test logs.</li>
        </ul>
      </div>

      <div className="p-5 sm:p-6 rounded-radius border border-line bg-card space-y-3 max-w-prose">
        <div className="flex items-center gap-2 text-lg font-semibold text-text-0">
          <Mail className="w-4 h-4 text-green-700 dark:text-green-400" />
          <span>Contact & Operator Partnerships</span>
        </div>
        <p className="text-xs md:text-sm sm:text-sm lg:text-base text-text-1 leading-relaxed">
          Are you an engineering leader with real operational problems (fintech, logistics, distributed systems)? Submit a spec to our Idea Bank to receive pre-vetted, proof-proven candidate solutions.
        </p>
        <div className="pt-1 text-xs md:text-sm font-mono break-all">
          Email: <a href="mailto:partners@devledgr.xyz" className="text-green-700 dark:text-green-400 hover:underline font-semibold">partners@devledgr.xyz</a>
        </div>
      </div>
    </div>
  );
}
