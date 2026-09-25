'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { BrandMark } from '../brand/BrandMark';
import { X, ArrowRight, Shield } from 'lucide-react';

const GithubIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
    />
  </svg>
);

import { useAuth } from '@/hooks/useAuth';
import { setAuthCookies } from '@/lib/cookies';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, completeOnboarding, user } = useAppStore();
  // useAuth used for cookie sync on completion - login flow is handled by onboarding step
  useAuth();

  const [step, setStep] = useState<'oauth' | 'onboarding'>('oauth');
  const [username, setUsername] = useState(user.username || 'junior_dev');
  const [name, setName] = useState(user.name || 'Alex Okafor');

  const [selectedTrack, setSelectedTrack] = useState('Backend & Distributed Systems');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([
    'Go',
    'PostgreSQL',
    'Redis',
    'TypeScript',
  ]);
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAuthModalOpen) {
        closeAuthModal();
      }
    };
    if (isAuthModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isAuthModalOpen, closeAuthModal]);

  // Trap focus inside modal
  useEffect(() => {
    if (!isAuthModalOpen || !modalRef.current) return;
    const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }
  }, [isAuthModalOpen, step]);

  if (!isAuthModalOpen) return null;

  const availableSkills = [
    'Go',
    'PostgreSQL',
    'Redis',
    'TypeScript',
    'FastAPI',
    'Python',
    'Docker',
    'CRDT',
    'Distributed Systems',
    'Node.js',
  ];

  const handleToggleSkill = (skill: string) => {
    if (selectedSkills.includes(skill)) {
      setSelectedSkills(selectedSkills.filter((s) => s !== skill));
    } else {
      setSelectedSkills([...selectedSkills, skill]);
    }
  };

  const handleOAuthConnect = () => {
    setStep('onboarding');
  };

  const handleFinishOnboarding = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.replace('@', '').trim() || 'junior_dev';
    const cleanName = name.trim() || 'Developer';
    completeOnboarding({
      username: cleanUsername,
      name: cleanName,
      headline: `Junior Engineer · ${selectedTrack}`,
      skills: selectedSkills,
    });
    setAuthCookies(`mock_token_${Date.now()}_${cleanUsername}`, 'user');
    setStep('oauth');
  };


  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeAuthModal();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={step === 'oauth' ? 'auth-modal-title-oauth' : 'auth-modal-title-onboarding'}
        className="relative w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-radius border border-brass bg-ink-0 shadow-lg p-6 font-mono text-xs space-y-6"
      >
        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          aria-label="Close authentication modal"
          className="absolute top-4 right-4 text-text-1 hover:text-text-0 transition-colors p-1"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>

        {step === 'oauth' ? (
          /* Step 1: GitHub OAuth Simulation */
          <div className="space-y-6 text-center py-2">
            <BrandMark size={44} className="mx-auto" />
            <div className="space-y-1">
              <h2 id="auth-modal-title-oauth" className="font-serif text-2xl font-medium text-text-0">
                Connect with GitHub
              </h2>
              <p className="text-text-1 text-xs leading-relaxed">
                DevLedgr anchors your verified proof directly to your cryptographic GitHub commit identity.
              </p>
            </div>

            <div className="p-4 rounded-radius border border-line bg-card/50 text-left space-y-2 text-xs text-text-1">
              <div className="flex items-center gap-2 text-text-0 font-semibold">
                <Shield className="w-3.5 h-3.5 text-brass" aria-hidden="true" />
                <span>Requested Permissions</span>
              </div>
              <ul className="space-y-1 pl-4 list-disc text-xs">
                <li>Read public repository trees for test verification</li>
                <li>Verify commit email & PGP signing identity</li>
                <li>Issue cryptographically valid 1-year portfolio URLs</li>
              </ul>
            </div>

            <button
              onClick={handleOAuthConnect}
              className="w-full btn-brass text-xs py-2.5 flex items-center justify-center gap-2 cursor-pointer"
            >
              <GithubIcon className="w-4 h-4" />
              <span>Authorize with GitHub</span>
            </button>

            <div className="text-xs text-text-1">
              No write access to private repositories is requested.
            </div>
          </div>
        ) : (
          /* Step 2: Onboarding Survey */
          <form onSubmit={handleFinishOnboarding} className="space-y-5">
            <div className="space-y-1">
              <span className="text-xs text-brass uppercase font-semibold">
                Step 2 of 2 · Onboarding
              </span>
              <h2 id="auth-modal-title-onboarding" className="font-serif text-2xl font-medium text-text-0">
                Tailor Your Match Engine
              </h2>
              <p className="text-text-1 text-xs">
                Tell us your current target stack so we can surface matched Idea Bank problems and company opportunities.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="auth-full-name" className="block text-xs uppercase tracking-wider text-text-1 font-semibold mb-1">
                  Your Full Name
                </label>
                <input
                  id="auth-full-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-radius border border-line bg-card text-text-0 outline-none focus:border-brass"
                />
              </div>

              <div>
                <label htmlFor="auth-github-handle" className="block text-xs uppercase tracking-wider text-text-1 font-semibold mb-1">
                  GitHub Handle
                </label>
                <input
                  id="auth-github-handle"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-radius border border-line bg-card text-text-0 outline-none focus:border-brass"
                />
              </div>

              <div>
                <label htmlFor="auth-target-track" className="block text-xs uppercase tracking-wider text-text-1 font-semibold mb-1">
                  Target Track
                </label>
                <select
                  id="auth-target-track"
                  value={selectedTrack}
                  onChange={(e) => setSelectedTrack(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-radius border border-line bg-card text-text-0 outline-none focus:border-brass"
                >
                  <option>Backend & Distributed Systems</option>
                  <option>Fintech Infrastructure & Microservices</option>
                  <option>Full-Stack Systems & API Design</option>
                  <option>DevOps & Tooling Engineering</option>
                </select>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-text-1 font-semibold mb-1.5">
                  Select Your Active Stacks (Used for Job Matching)
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1">
                  {availableSkills.map((s) => {
                    const active = selectedSkills.includes(s);
                    return (
                      <button
                        type="button"
                        key={s}
                        aria-pressed={active}
                        onClick={() => handleToggleSkill(s)}
                        className={`px-2.5 py-1 rounded-radius border text-xs cursor-pointer transition-colors ${
                          active
                            ? 'border-brass bg-brass text-ink-0 font-semibold'
                            : 'border-line bg-card text-text-1'
                        }`}
                      >
                        {active ? '✓ ' : '+ '}
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full btn-brass text-xs py-2.5 flex items-center justify-center gap-2 cursor-pointer mt-4"
            >
              <span>Initialize Ledger Session</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
