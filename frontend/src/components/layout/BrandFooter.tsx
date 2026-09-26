import React from 'react';
import Link from 'next/link';
import { BrandMark } from '../brand/BrandMark';

export const BrandFooter: React.FC = () => {
  return (
    <footer className="mt-24 border-t border-line bg-card/40 text-text-1 text-xs md:text-sm font-sans">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand Column */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2.5">
              <BrandMark size={24} />
              <span className="font-sans text-lg font-semibold tracking-tight text-text-0">DevLedgr</span>
            </div>
            <p className="text-xs md:text-sm leading-relaxed max-w-md text-text-1">
              A ledger, not a resume. Every problem solved is an entry: timestamped, verifiable, and permanent.
            </p>
            <div className="pt-1 flex items-center gap-3 text-xs md:text-sm font-mono">
              <span className="inline-flex items-center gap-1.5 text-green-700 dark:text-green-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-green-600 dark:bg-green-500" />
                Consensus Online
              </span>
              <span>·</span>
              <span>Network v0.2.6</span>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="space-y-2">
            <div className="text-xs md:text-sm font-sans font-semibold text-text-0 mb-3">
              Ledger Core
            </div>
            <ul className="space-y-2 text-xs md:text-sm">
              <li>
                <Link href="/ideas" className="hover:text-text-0 transition-colors">
                  Idea Bank (Problems)
                </Link>
              </li>
              <li>
                <Link href="/jobs" className="hover:text-text-0 transition-colors">
                  Opportunities (Matched)
                </Link>
              </li>
              <li>
                <Link href="/coaching" className="hover:text-text-0 transition-colors">
                  Coaching Itineraries
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-text-0 transition-colors">
                  Developer Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* System & Access */}
          <div className="space-y-2">
            <div className="text-xs md:text-sm font-sans font-semibold text-text-0 mb-3">
              Platform
            </div>
            <ul className="space-y-2 text-xs md:text-sm">
              <li>
                <Link href="/about" className="hover:text-text-0 transition-colors">
                  Manifesto & About
                </Link>
              </li>
              <li>
                <Link href="/p/junior_dev" className="hover:text-text-0 transition-colors">
                  Sample Public Portfolio
                </Link>
              </li>
              <li>
                <Link href="/settings" className="hover:text-text-0 transition-colors">
                  Settings & BYOK Keys
                </Link>
              </li>
              <li>
                <Link href="/admin" className="hover:text-text-0 transition-colors">
                  Gated Review Panel
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 ledger-border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-xs md:text-sm text-text-1 text-center sm:text-left">
          <div>DevLedgr v0.2. Built for software engineers.</div>
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3 sm:gap-4">
            <a
              href="https://github.com/Jack-Of-Aces/dev-ledgr"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-text-0 transition-colors"
            >
              GitHub Repository
            </a>
            <span>·</span>
            <span>All entries cryptographically signed</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
