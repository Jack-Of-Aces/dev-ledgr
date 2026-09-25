'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { useAppStore } from '@/lib/store';
import {
  User,
  Settings,
  LayoutDashboard,
  ShieldCheck,
  LogOut,
  ChevronDown,
} from 'lucide-react';

export const UserMenu: React.FC = () => {
  const { user, isAdmin, logout } = useAuth();
  const { submissions } = useAppStore();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const userSubmissions = submissions.filter(
    (s) => s.authorUsername.toLowerCase() === user.username.toLowerCase()
  );

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) setOpen(false);
    };
    if (open) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [open]);

  return (
    <div className="relative font-mono text-xs" ref={menuRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-radius border border-line bg-card hover:border-zinc-500 transition-colors text-xs text-text-0 cursor-pointer"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="User navigation menu"
      >
        {user.avatarUrl ? (
          <div className="relative w-4 h-4 rounded-full overflow-hidden shrink-0 border border-line">
            <Image
              src={user.avatarUrl}
              alt=""
              fill
              sizes="16px"
              className="object-cover"
              unoptimized
            />
          </div>
        ) : (
          <span className="w-2 h-2 rounded-full bg-diff-green block" aria-hidden="true" />
        )}

        <span className="font-semibold max-w-20 sm:max-w-none truncate">@{user.username}</span>

        <span className="hidden sm:inline text-xs text-text-1 bg-card px-2 py-0.5 rounded border border-line font-medium">
          {userSubmissions.length} proofs
        </span>

        <ChevronDown className="w-3 h-3 text-text-1" />
      </button>

      {/* Dropdown Card */}
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-radius border border-line bg-card p-2 shadow-md z-50 space-y-1 font-mono text-xs animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {/* User Identity Header */}
          <div className="px-3 py-2.5 border-b border-line space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-text-0 truncate">{user.name}</span>
              <span
                className={`text-xs uppercase px-2 py-0.5 rounded font-medium border border-line ${
                  isAdmin
                    ? 'text-text-0'
                    : 'text-text-1'
                }`}
              >
                {isAdmin ? 'Admin / Auditor' : 'Developer'}
              </span>
            </div>
            <div className="text-xs text-text-1 truncate">@{user.username}</div>
          </div>

          {/* Navigation Links */}
          <div className="py-1 space-y-0.5">
            <Link
              href={`/p/${user.username}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-radius text-text-0 hover:bg-ink-1 transition-colors"
              role="menuitem"
            >
              <User className="w-3.5 h-3.5 text-text-1" />
              <span>Public Portfolio</span>
            </Link>

            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-radius text-text-0 hover:bg-ink-1 transition-colors"
              role="menuitem"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-text-1" />
              <span>Developer Dashboard</span>
            </Link>

            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-radius text-text-0 hover:bg-ink-1 transition-colors"
              role="menuitem"
            >
              <Settings className="w-3.5 h-3.5 text-text-1" />
              <span>Settings & Profile Edit</span>
            </Link>

            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-radius text-text-0 hover:bg-ink-1 transition-colors font-medium"
                role="menuitem"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Admin Review Console</span>
              </Link>
            )}
          </div>

          <div className="border-t border-line pt-1">
            <button
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-radius text-rose-700 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer text-left"
              role="menuitem"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
