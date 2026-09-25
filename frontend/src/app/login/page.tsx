'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { BrandMark } from '@/components/brand/BrandMark';
import { useAuth } from '@/hooks/useAuth';
import { envConfig } from '@/lib/config';
import { EmailSignInSchema } from '@/lib/schemas/auth';
import { ArrowLeft, ArrowRight, Mail, Sparkles, Check } from 'lucide-react';


const GithubIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
    />
  </svg>
);

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const { loginWithGitHub, loginWithEmail, switchRole } = useAuth();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleGitHubAuth = async () => {
    setLoading(true);
    await loginWithGitHub('junior_dev', 'Alex Okafor');
    router.push(callbackUrl);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);

    const validation = EmailSignInSchema.safeParse({ email });
    if (!validation.success) {
      setEmailError(validation.error.issues[0]?.message || 'Invalid email address');
      return;
    }

    setLoading(true);
    await loginWithEmail(email);
    setEmailSent(true);
    setLoading(false);
  };

  const handleQuickPersona = async (role: 'user' | 'admin') => {
    setLoading(true);
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
          <p className="text-xs text-text-1 max-w-xs mx-auto leading-relaxed">
            Anchor your verified problem-solving proof directly to your developer identity.
          </p>
        </div>

        {/* Primary Action: GitHub OAuth */}
        <div className="space-y-2">
          <button
            onClick={handleGitHubAuth}
            disabled={loading}
            className="w-full btn-brass text-xs py-2.5 flex items-center justify-center gap-2 cursor-pointer"
          >
            <GithubIcon className="w-4 h-4" />
            <span>Continue with GitHub</span>
          </button>

          <div className="flex items-center justify-between text-xs text-text-1 font-mono px-1">
            <span>Identity Provider:</span>
            <span className="text-text-0 font-medium">
              {envConfig.githubClientId ? 'Live GitHub OAuth App' : 'Instant Sandbox Provider'}
            </span>
          </div>
        </div>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-line w-full" />
          <span className="bg-card px-3 text-xs uppercase tracking-wider text-text-1 font-mono">
            Or Work Email
          </span>
        </div>

        {/* Secondary: Email Magic Link */}
        <form onSubmit={handleEmailSubmit} className="space-y-3">
          <div>
            <label htmlFor="login-email" className="block text-xs uppercase tracking-wider text-text-1 font-semibold mb-1">
              Email Address
            </label>
            <div className="relative">
              <input
                id="login-email"
                type="email"
                placeholder="alex@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 pl-9 rounded-radius border border-line bg-ink-0 text-xs text-text-0 outline-none focus:border-text-0 font-mono"
              />
              <Mail className="w-4 h-4 text-text-1 absolute left-2.5 top-2.5 pointer-events-none" />
            </div>
            {emailError && (
              <p className="text-xs text-rose-700 dark:text-rose-400 mt-1">{emailError}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-outline text-xs py-2 flex items-center justify-center gap-2 cursor-pointer font-sans"
          >
            {emailSent ? (
              <>
                <Check className="w-3.5 h-3.5 text-text-0" />
                <span>Link Dispatched</span>
              </>
            ) : (
              <>
                <span>Send Magic Link</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Sandbox Quick Personas for Evaluation */}
        <div className="pt-4 border-t border-line space-y-3 text-xs">
          <div className="flex items-center gap-1.5 text-text-0 font-semibold font-mono text-xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Developer Evaluation Personas</span>
          </div>
          <p className="text-xs text-text-1 leading-relaxed">
            Test platform capabilities immediately with preset accounts:
          </p>

          <div className="grid grid-cols-2 gap-2 font-mono text-xs">
            <button
              type="button"
              onClick={() => handleQuickPersona('user')}
              className="p-2.5 rounded border border-line hover:bg-ink-1 text-left transition-colors cursor-pointer"
            >
              <div className="font-semibold text-text-0">@junior_dev</div>
              <div className="text-xs text-text-1">Candidate (User)</div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickPersona('admin')}
              className="p-2.5 rounded border border-line hover:bg-ink-1 text-left transition-colors cursor-pointer"
            >
              <div className="font-semibold text-text-0">@lead_auditor</div>
              <div className="text-xs text-text-1 font-medium">Admin / Verifier</div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 text-center text-xs font-mono text-text-1">
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
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-mono text-xs text-text-1">Loading authentication...</div>}>
      <LoginForm />
    </Suspense>
  );
}
