'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { BrandMark } from '@/components/brand/BrandMark';
import { useAuth } from '@/hooks/useAuth';
import { envConfig } from '@/lib/config';
import { getSupabase } from '@/lib/supabase';
import { setAuthCookies } from '@/lib/cookies';
import { ArrowLeft, Sparkles, AlertCircle } from 'lucide-react';

const GithubIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
    />
  </svg>
);

const GoogleIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
    />
  </svg>
);

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const authError = searchParams.get('error');
  const { isLoggedIn, loginWithGitHub, loginWithGoogle, switchRole } = useAuth();

  const [loadingProvider, setLoadingProvider] = useState<'github' | 'google' | null>(null);
  const [showSandbox, setShowSandbox] = useState(false);
  const [isProcessingHash, setIsProcessingHash] = useState(false);

  // Handle Supabase implicit flow: when the server-side PKCE route receives
  // no ?code= param, it redirects here and the browser preserves the
  // #access_token hash fragment. Parse it client-side and establish the session.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (!hash.includes('access_token=')) return;

    setIsProcessingHash(true);
    const params = new URLSearchParams(hash.slice(1)); // strip leading '#'
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (!accessToken || !refreshToken) {
      setIsProcessingHash(false);
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setIsProcessingHash(false);
      return;
    }

    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ data, error }) => {
        if (error || !data.session) {
          console.error('[Login] setSession from hash failed:', error?.message);
          setIsProcessingHash(false);
          return;
        }
        // Set DevLedgr cookies so server-side guards recognise the session
        setAuthCookies(data.session.access_token, 'user');
        // Clear the hash from the URL and navigate to dashboard
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        router.replace('/dashboard');
      })
      .catch(() => {
        setIsProcessingHash(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      router.replace(callbackUrl);
    }
  }, [isLoggedIn, callbackUrl, router]);

  const handleGitHubAuth = async () => {
    setLoadingProvider('github');
    try {
      await loginWithGitHub();
      if (!envConfig.hasSupabase) {
        router.push(callbackUrl);
      }
    } catch {
      setLoadingProvider(null);
    }
  };

  const handleGoogleAuth = async () => {
    setLoadingProvider('google');
    try {
      await loginWithGoogle();
      if (!envConfig.hasSupabase) {
        router.push(callbackUrl);
      }
    } catch {
      setLoadingProvider(null);
    }
  };

  const handleQuickPersona = async (role: 'user' | 'admin') => {
    setLoadingProvider('github');
    await switchRole(role);
    router.push(role === 'admin' ? '/admin' : callbackUrl);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 font-sans">
      <div className="w-full max-w-md rounded-radius border border-line bg-card p-6 sm:p-8 space-y-6 shadow-sm">
        {/* Header */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-block hover:opacity-80 transition-opacity">
            <BrandMark size={40} className="mx-auto" />
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-text-0">
            Sign In to DevLedgr
          </h1>
          <p className="text-xs md:text-sm text-text-1 max-w-xs mx-auto leading-relaxed">
            Anchor your verified problem-solving proof directly to your developer identity.
          </p>
        </div>

        {/* Notice: Processing or Error */}
        {isProcessingHash ? (
          <div className="p-3 rounded border border-emerald-border bg-emerald-tint text-emerald-text text-xs md:text-sm flex items-center gap-2 font-mono">
            <div className="w-4 h-4 border-2 border-emerald-text border-t-transparent rounded-full animate-spin shrink-0" />
            <span>Verifying session and redirecting to dashboard...</span>
          </div>
        ) : (
          authError && (
            <div className="p-3 rounded border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs md:text-sm flex items-center gap-2 font-mono">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Authentication was interrupted or canceled. Please try again.</span>
            </div>
          )
        )}

        {/* OAuth Providers: GitHub & Google Only */}
        <div className="space-y-3">
          {/* GitHub OAuth Button */}
          <button
            onClick={handleGitHubAuth}
            disabled={loadingProvider !== null}
            className="w-full btn-brass min-h-[44px] text-xs md:text-sm py-2.5 flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
          >
            <GithubIcon className="w-4 h-4" />
            <span>
              {loadingProvider === 'github' ? 'Redirecting to GitHub...' : 'Continue with GitHub'}
            </span>
          </button>

          {/* Google OAuth Button */}
          <button
            onClick={handleGoogleAuth}
            disabled={loadingProvider !== null}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-radius border border-line bg-card hover:bg-ink-1 text-text-0 text-xs md:text-sm font-medium flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <GoogleIcon className="w-4 h-4" />
            <span>
              {loadingProvider === 'google' ? 'Redirecting to Google...' : 'Continue with Google'}
            </span>
          </button>

          <div className="flex items-center justify-between text-xs md:text-sm text-text-1 font-mono px-1 pt-1">
            <span>Identity Provider:</span>
            <span className="text-text-0 font-medium">
              {envConfig.hasSupabase
                ? 'Supabase OAuth (GitHub & Google)'
                : 'Local Developer Sandbox'}
            </span>
          </div>

          <p className="text-xs text-text-1 text-center font-mono pt-1">
            By signing in, you agree to our{' '}
            <Link href="/terms" className="text-text-0 underline hover:text-emerald-text">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-text-0 underline hover:text-emerald-text">
              Privacy Policy
            </Link>
            .
          </p>
        </div>

        {/* Optional Sandbox Evaluation Accordion */}
        <div className="pt-3 border-t border-line space-y-2 text-xs md:text-sm">
          <button
            type="button"
            onClick={() => setShowSandbox(!showSandbox)}
            aria-expanded={showSandbox}
            aria-controls="sandbox-persona-list"
            className="w-full min-h-[44px] flex items-center justify-between text-text-1 hover:text-text-0 font-mono text-xs md:text-sm py-1 cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-emerald-text" />
              <span>Sandbox Evaluation Personas</span>
            </span>
            <span>{showSandbox ? '▲ Hide' : '▼ View demo accounts'}</span>
          </button>

          {showSandbox && (
            <div id="sandbox-persona-list" className="space-y-2 animate-in fade-in duration-150 pt-1 font-mono">
              <p className="text-xs md:text-sm text-text-1 leading-relaxed">
                Skip OAuth connection during local evaluation to test candidate or auditor modes:
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs md:text-sm">
                <button
                  type="button"
                  onClick={() => handleQuickPersona('user')}
                  className="p-2 rounded border border-line hover:bg-ink-1 text-left transition-colors cursor-pointer"
                >
                  <div className="font-semibold text-text-0">@junior_dev</div>
                  <div className="text-xs md:text-sm text-text-1">Candidate (User)</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickPersona('admin')}
                  className="p-2 rounded border border-line hover:bg-ink-1 text-left transition-colors cursor-pointer"
                >
                  <div className="font-semibold text-text-0">@lead_auditor</div>
                  <div className="text-xs md:text-sm text-text-1 font-medium">Platform Auditor (Admin)</div>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 text-center text-xs md:text-sm font-mono text-text-1">
          <Link href="/" className="inline-flex items-center gap-1 hover:text-text-0">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Explorer</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
