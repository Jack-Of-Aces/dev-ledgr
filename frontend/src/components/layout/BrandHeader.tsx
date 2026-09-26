'use client';

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandMark } from '../brand/BrandMark';
import { useAppStore } from '@/lib/store';
import { UserMenu } from '@/components/layout/UserMenu';
import {
  Sun,
  Moon,
  Menu,
  X,
  LogIn,
} from 'lucide-react';

const emptySubscribe = () => () => {};
const useMounted = () => useSyncExternalStore(emptySubscribe, () => true, () => false);

export const BrandHeader: React.FC = () => {
  const pathname = usePathname();
  // UserMenu handles all user-specific rendering; BrandHeader only needs minimal auth state.
  const { theme, toggleTheme, user, isLoggedIn, openAuthModal } = useAppStore();
  const mounted = useMounted();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);

  // Close mobile menu on route change without needing a useEffect
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMobileMenuOpen(false);
  }

  useEffect(() => {
    const savedTheme = localStorage.getItem('devledgr_storage_v1');
    if (savedTheme) {
      try {
        const parsed = JSON.parse(savedTheme);
        if (parsed.state?.theme) {
          document.documentElement.setAttribute('data-theme', parsed.state.theme);
          if (parsed.state.theme === 'dark') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
      } catch {
        // ignore malformed storage
      }
    }
  }, []);

  const navItems = [
    { label: 'Idea Bank', href: '/ideas' },
    { label: 'Opportunities', href: '/jobs' },
    { label: 'Coaching', href: '/coaching' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-ink-0/90 backdrop-blur-md ledger-border-b">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo & Wordmark */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <BrandMark size={28} />
            <span className="font-semibold text-lg tracking-tight text-text-0 font-sans">
              DevLedgr
            </span>
          </Link>
        </div>

        {/* Center Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1 text-xs font-sans">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-radius transition-colors ${
                  isActive
                    ? 'text-text-0 bg-card font-medium border border-line'
                    : 'text-text-1 hover:text-text-0 hover:bg-card/50'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3 text-xs">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            aria-label={mounted && theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-radius border border-line bg-card text-text-0 hover:border-text-1 transition-colors cursor-pointer font-mono"
            title="Toggle ledger theme"
          >
            {mounted && theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-green-700 dark:text-green-400" aria-hidden="true" />
                <span className="hidden sm:inline">light</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-text-1" aria-hidden="true" />
                <span className="hidden sm:inline">dark</span>
              </>
            )}
          </button>

          {/*
           * BUSINESS LOGIC:
           * Authenticated users get the full UserMenu dropdown (portfolio, settings, admin, sign out).
           * Unauthenticated users get the "Connect" CTA which opens the AuthModal.
           * UserMenu encapsulates all post-auth navigation - BrandHeader stays thin.
           */}
          {isLoggedIn ? (
            <UserMenu />
          ) : (
            <button
              onClick={openAuthModal}
              className="btn-brass text-xs py-1.5 px-3 cursor-pointer inline-flex items-center gap-1.5 font-sans"
            >
              <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Connect</span>
            </button>
          )}

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-radius border border-line bg-card text-text-0 hover:border-brass transition-colors cursor-pointer"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-drawer"
          >
            {mobileMenuOpen ? (
              <X className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Menu className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div
          id="mobile-nav-drawer"
          className="md:hidden border-b border-line bg-ink-0 p-4 space-y-3 font-mono text-xs animate-in slide-in-from-top-2 duration-200"
        >
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block px-3 py-2 rounded-radius ${
                    isActive
                      ? 'bg-card text-text-0 font-semibold border border-line'
                      : 'text-text-1 hover:text-text-0'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Mobile bottom row: profile quick links if signed in, auth CTA if not */}
          <div className="pt-2 border-t border-line flex items-center justify-between text-xs">
            {isLoggedIn ? (
              <>
                <Link href={`/p/${user.username}`} className="text-brass font-semibold hover:underline">
                  @{user.username} →
                </Link>
                <Link href="/settings" className="text-text-1 hover:text-text-0 underline">
                  Settings
                </Link>
              </>
            ) : (
              <button
                onClick={openAuthModal}
                className="text-brass font-semibold hover:underline cursor-pointer"
              >
                Sign In / Connect →
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
