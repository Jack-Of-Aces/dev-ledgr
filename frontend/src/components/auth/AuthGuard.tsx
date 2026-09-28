/**
 * @file AuthGuard.tsx
 * @description Client-side UI guard for wrapping protected sections or pages.
 * Works hand-in-hand with Edge middleware.ts for multi-layered security.
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { UserRole } from '@/types/auth';
import { ShieldAlert, LogIn, ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeletons';

interface AuthGuardProps {
  children: React.ReactNode;
  requireRole?: UserRole;
  allowedRoles?: UserRole[];
  fallbackMessage?: string;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({
  children,
  requireRole,
  allowedRoles,
  fallbackMessage,
}) => {
  const { isLoggedIn, role } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 rounded-radius border border-line bg-card/40 space-y-4 text-center">
        <Skeleton variant="circular" className="w-10 h-10 mx-auto" />
        <Skeleton variant="text" className="w-48 h-6 mx-auto" />
        <Skeleton variant="text" className="w-64 h-4 mx-auto" />
        <Skeleton variant="rectangular" className="w-36 h-9 mx-auto rounded-radius" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 rounded-radius border border-line bg-card text-center space-y-4 font-mono text-xs md:text-sm">
        <LogIn className="w-8 h-8 text-brass mx-auto" />
        <h3 className="text-base font-semibold text-text-0 font-sans">
          Authentication Required
        </h3>
        <p className="text-text-1 leading-relaxed">
          {fallbackMessage || 'You must be signed in to perform this action or view this section.'}
        </p>
        <Link
          href="/login"
          className="btn-brass text-xs md:text-sm py-2 px-4 inline-flex items-center gap-1.5"
        >
          <span>Sign In to Continue</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    );
  }

  const isAuthorized = allowedRoles
    ? allowedRoles.includes(role) || role === 'admin'
    : requireRole
    ? role === requireRole || role === 'admin'
    : true;

  if (!isAuthorized) {
    const requiredDisplay = allowedRoles
      ? allowedRoles.map((r) => r.toUpperCase()).join(' or ')
      : requireRole?.toUpperCase() || 'ELEVATED';

    return (
      <div className="max-w-md mx-auto my-12 p-6 rounded-radius border border-rose-500/30 bg-card text-center space-y-4 font-mono text-xs md:text-sm">
        <ShieldAlert className="w-8 h-8 text-rose-700 dark:text-rose-400 mx-auto" />
        <h3 className="text-base font-semibold text-text-0 font-sans">
          Role Clearance Required
        </h3>
        <p className="text-text-1 leading-relaxed">
          This feature requires <strong>{requiredDisplay}</strong> clearance. You are currently signed in as <strong>{role.toUpperCase()}</strong>.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};
