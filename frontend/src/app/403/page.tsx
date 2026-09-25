'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldAlert, ArrowLeft, Terminal } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { ADMIN_USER } from '@/lib/mock-data';
import { setAuthCookies } from '@/lib/cookies';

export default function AccessDeniedPage() {
  const router = useRouter();
  const { user, setUser } = useAppStore();

  const handleSwitchToAdmin = () => {
    setUser({ ...ADMIN_USER });
    setAuthCookies(`mock_admin_token_${Date.now()}`, 'admin');
    router.push('/admin');
  };


  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-lg w-full rounded-radius border border-line bg-card p-8 text-center space-y-6 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-700 dark:text-rose-400">
          <ShieldAlert className="w-6 h-6" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <div className="text-xs uppercase font-mono font-bold text-rose-700 dark:text-rose-400 tracking-wider">
            HTTP 403 · Access Restricted
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-0">
            Reviewer Clearance Required
          </h1>
          <p className="text-xs text-text-1 leading-relaxed">
            The Ledger Review console and Problem Seeder are restricted to verified platform auditors
            and system administrators. Your current session (<strong>@{user.username}</strong>) has the <strong>{user.role || 'user'}</strong> role.
          </p>
        </div>

        <div className="pt-4 border-t border-line text-left font-mono text-xs space-y-2">
          <div className="flex items-center gap-1.5 text-text-0 font-semibold">
            <Terminal className="w-3.5 h-3.5 text-text-0" />
            <span>Developer Sandbox Action</span>
          </div>
          <p className="text-xs text-text-1 leading-relaxed">
            Evaluating platform administration? You can instantly switch to the <strong>@lead_auditor</strong> persona below to test review stamping and problem seeding.
          </p>
          <button
            onClick={handleSwitchToAdmin}
            className="w-full btn-brass text-xs py-2 mt-2 cursor-pointer"
          >
            Switch to @lead_auditor (Admin Persona)
          </button>
        </div>

        <div className="pt-2 flex items-center justify-center gap-4 text-xs font-mono">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-text-1 hover:text-text-0 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Ledger Home</span>
          </Link>
          <span className="text-line">|</span>
          <Link
            href="/dashboard"
            className="text-brass hover:underline"
          >
            Developer Dashboard →
          </Link>
        </div>
      </div>
    </div>
  );
}
