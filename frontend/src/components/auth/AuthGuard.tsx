/**
 * @file AuthGuard.tsx
 * @description Client-side UI guard for wrapping protected sections or pages.
 * Works hand-in-hand with Edge middleware.ts for multi-layered security.
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { UserRole } from '@/types/auth';
import { ShieldAlert, LogIn, ArrowRight } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
  requireRole?: UserRole;
  fallbackMessage?: string;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({
  children,
  requireRole,
  fallbackMessage,
}) => {
  const { isLoggedIn, role, switchRole } = useAuth();

  if (!isLoggedIn) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 rounded-radius border border-line bg-card text-center space-y-4 font-mono text-xs">
        <LogIn className="w-8 h-8 text-brass mx-auto" />
        <h3 className="text-base font-semibold text-text-0 font-sans">
          Authentication Required
        </h3>
        <p className="text-text-1 leading-relaxed">
          {fallbackMessage || 'You must be signed in to perform this action or view this section.'}
        </p>
        <Link
          href="/login"
          className="btn-brass text-xs py-2 px-4 inline-flex items-center gap-1.5"
        >
          <span>Sign In to Continue</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    );
  }

  if (requireRole && role !== requireRole && role !== 'admin') {
    return (
      <div className="max-w-md mx-auto my-12 p-6 rounded-radius border border-rose-500/30 bg-card text-center space-y-4 font-mono text-xs">
        <ShieldAlert className="w-8 h-8 text-rose-700 dark:text-rose-400 mx-auto" />
        <h3 className="text-base font-semibold text-text-0 font-sans">
          Role Clearance Required
        </h3>
        <p className="text-text-1 leading-relaxed">
          This feature requires <strong>{requireRole.toUpperCase()}</strong> clearance. You are currently signed in as <strong>{role.toUpperCase()}</strong>.
        </p>
        <button
          onClick={() => switchRole(requireRole)}
          className="btn-brass text-xs py-2 px-4 cursor-pointer"
        >
          Switch to {requireRole.toUpperCase()} Persona (Sandbox)
        </button>
      </div>
    );
  }

  return <>{children}</>;
};
