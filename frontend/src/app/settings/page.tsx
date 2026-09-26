'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useProfile } from '@/hooks/useProfile';
import { AuthGuard } from '@/components/auth/AuthGuard';
import {
  Key,
  User,
  CreditCard,
  Check,
  Save,
  ExternalLink,
  Code2,
  Mail,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';

const POPULAR_SKILLS = [
  'Go',
  'PostgreSQL',
  'Redis',
  'TypeScript',
  'Python',
  'FastAPI',
  'Docker',
  'Distributed Systems',
  'CRDT',
  'Linux',
  'Kafka',
  'Kubernetes',
  'Rust',
  'GraphQL',
];

export default function SettingsPage() {
  const { user, isSaving, errors, updateProfile } = useProfile();

  const [name, setName] = useState(user.name);
  const [headline, setHeadline] = useState(user.headline);
  const [bio, setBio] = useState(user.bio);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || '');
  const [githubUrl, setGithubUrl] = useState(user.githubUrl || '');
  const [email, setEmail] = useState(user.email || '');
  const [plan, setPlan] = useState<'free' | 'full-service' | 'byok'>(user.plan);
  const [apiKey, setApiKey] = useState(user.apiKey || '');
  const [statedSkills, setStatedSkills] = useState<string[]>(user.statedSkills || []);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleToggleSkill = (skill: string) => {
    if (statedSkills.includes(skill)) {
      setStatedSkills(statedSkills.filter((s) => s !== skill));
    } else {
      setStatedSkills([...statedSkills, skill]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(false);

    const result = await updateProfile({
      name,
      headline,
      bio,
      avatarUrl: avatarUrl.trim() || undefined,
      githubUrl: githubUrl.trim() || undefined,
      email: email.trim() || undefined,
      plan,
      apiKey: apiKey.trim() || undefined,
      statedSkills,
    });

    if (result.success) {
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    }
  };

  return (
    <AuthGuard fallbackMessage="Please sign in to access your ledger identity and compute settings.">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 md:py-16 space-y-10 text-sm lg:text-base font-sans">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight text-text-0">
              Account & Ledger Settings
            </h1>
            <p className="text-text-1 text-xs md:text-sm sm:text-sm lg:text-base">
              Manage your verified developer profile, AI compute model (Full-Service vs BYOK), and API keys.
            </p>
          </div>

          <Link
            href={`/p/${user.username}`}
            className="btn-outline text-xs md:text-sm py-1.5 px-3 font-mono flex items-center gap-1.5 self-start sm:self-auto"
          >
            <span>View Public Ledger</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        <form onSubmit={handleSave} className="space-y-8">
          {/* Section 1: Developer Ledger Identity */}
          <section className="p-5 sm:p-6 rounded-radius border border-line bg-card/40 space-y-5">
            <div className="flex items-center gap-2 text-base font-semibold text-text-0 pb-2 border-b border-line">
              <User className="w-4 h-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
              <span>Developer Ledger Identity</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="settings-full-name" className="block text-xs md:text-sm font-mono text-text-1 mb-1 font-medium">
                  Full Name *
                </label>
                <input
                  id="settings-full-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-radius border border-line bg-ink-0 text-text-0 focus:border-emerald-500 outline-none text-xs md:text-sm"
                />
                {errors.name && (
                  <p className="text-xs md:text-sm text-rose-700 dark:text-rose-400 mt-1">{errors.name}</p>
                )}
              </div>

              <div>
                <label htmlFor="settings-handle" className="block text-xs md:text-sm uppercase tracking-wider text-text-1 mb-1 font-semibold">
                  Handle (Immutable URL)
                </label>
                <input
                  id="settings-handle"
                  type="text"
                  disabled
                  value={`@${user.username}`}
                  className="w-full px-3 py-2 rounded-radius border border-line bg-card text-text-1 cursor-not-allowed font-mono text-xs md:text-sm"
                />
              </div>

              <div>
                <label htmlFor="settings-headline" className="block text-xs md:text-sm uppercase tracking-wider text-text-1 mb-1 font-semibold">
                  Headline *
                </label>
                <input
                  id="settings-headline"
                  type="text"
                  required
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  className="w-full px-3 py-2 rounded-radius border border-line bg-ink-0 text-text-0 focus:border-brass outline-none text-xs md:text-sm"
                />
                {errors.headline && (
                  <p className="text-xs md:text-sm text-rose-700 dark:text-rose-400 mt-1">{errors.headline}</p>
                )}
              </div>

              <div>
                <label htmlFor="settings-bio" className="block text-xs md:text-sm uppercase tracking-wider text-text-1 mb-1 font-semibold">
                  Biography & Target Systems
                </label>
                <textarea
                  id="settings-bio"
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-3 py-2 rounded-radius border border-line bg-ink-0 text-text-0 focus:border-brass outline-none text-xs md:text-sm leading-relaxed"
                />
                {errors.bio && (
                  <p className="text-xs md:text-sm text-rose-700 dark:text-rose-400 mt-1">{errors.bio}</p>
                )}
              </div>

              {/* Avatar & Social Links */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label htmlFor="settings-avatar-url" className="text-xs md:text-sm font-mono text-text-1 mb-1 font-medium flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                    <span>Avatar Image URL</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      id="settings-avatar-url"
                      type="url"
                      placeholder="https://..."
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      className="w-full px-3 py-2 rounded-radius border border-line bg-ink-0 text-text-0 focus:border-emerald-500 outline-none text-xs md:text-sm font-mono"
                    />
                    {avatarUrl ? (
                      <div className="relative w-8 h-8 rounded-full border border-line shrink-0 overflow-hidden">
                        <Image
                          src={avatarUrl}
                          alt="Avatar preview"
                          fill
                          sizes="32px"
                          className="object-cover"
                          unoptimized
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                  {errors.avatarUrl && (
                    <p className="text-xs md:text-sm text-rose-700 dark:text-rose-400 mt-1">{errors.avatarUrl}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="settings-github-url" className="text-xs md:text-sm font-mono text-text-1 mb-1 font-medium flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                    <span>GitHub Profile URL</span>
                  </label>
                  <input
                    id="settings-github-url"
                    type="url"
                    placeholder="https://github.com/..."
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-radius border border-line bg-ink-0 text-text-0 focus:border-emerald-500 outline-none text-xs md:text-sm font-mono"
                  />
                  {errors.githubUrl && (
                    <p className="text-xs md:text-sm text-rose-700 dark:text-rose-400 mt-1">{errors.githubUrl}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="settings-email" className="text-xs md:text-sm font-mono text-text-1 mb-1 font-medium flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                    <span>Contact Email (For Recruiter Verification)</span>
                  </label>
                  <input
                    id="settings-email"
                    type="email"
                    placeholder="dev@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-radius border border-line bg-ink-0 text-text-0 focus:border-emerald-500 outline-none text-xs md:text-sm font-mono"
                  />
                  {errors.email && (
                    <p className="text-xs md:text-sm text-rose-700 dark:text-rose-400 mt-1">{errors.email}</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Verified Technical Stack (Skills) */}
          <section className="p-5 sm:p-6 rounded-radius border border-line bg-card/40 space-y-4">
            <div className="flex items-center gap-2 text-base font-semibold text-text-0 pb-2 border-b border-line">
              <Code2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
              <span>Verified Technical Stack</span>
            </div>

            <p className="text-xs md:text-sm text-text-1">
              Select the active stacks and technologies you solve problems with. These directly index your match score against job opportunities.
            </p>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {POPULAR_SKILLS.map((skill) => {
                const active = statedSkills.includes(skill);
                return (
                  <button
                    type="button"
                    key={skill}
                    onClick={() => handleToggleSkill(skill)}
                    className={`px-3 py-1 rounded-radius border text-xs md:text-sm cursor-pointer transition-colors font-mono ${
                      active
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold'
                        : 'border-line bg-card text-text-1 hover:text-text-0'
                    }`}
                  >
                    {active ? '✓ ' : '+ '}
                    {skill}
                  </button>
                );
              })}
            </div>
            {errors.statedSkills && (
              <p className="text-xs md:text-sm text-rose-700 dark:text-rose-400 mt-1">{errors.statedSkills}</p>
            )}
          </section>

          {/* Section 3: AI Compute Model: Full-Service vs BYOK */}
          <section className="p-5 sm:p-6 rounded-radius border border-line bg-card space-y-4">
            <div className="flex items-center gap-2 text-base font-semibold text-text-0 pb-2 border-b border-line">
              <Key className="w-4 h-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
              <span>AI Model & Compute Tier</span>
            </div>

            <div role="radiogroup" aria-label="AI compute model tier" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                role="radio"
                aria-checked={plan === 'byok'}
                tabIndex={0}
                onClick={() => setPlan('byok')}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    setPlan('byok');
                  }
                }}
                className={`p-4 rounded-radius border cursor-pointer transition-colors space-y-2 ${
                  plan === 'byok'
                    ? 'border-emerald-500 bg-ink-0'
                    : 'border-line bg-card/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-text-0 text-sm lg:text-base">BYOK Plan</span>
                  <span className="text-xs md:text-sm text-emerald-700 dark:text-emerald-400 uppercase font-mono font-semibold">
                    Free / Self-Hosted
                  </span>
                </div>
                <p className="text-xs md:text-sm text-text-1 leading-relaxed">
                  Supply your own Google Gemini or OpenAI API key. Run AI Scrutiny and Coaching prompts at raw API cost.
                </p>
              </div>

              <div
                role="radio"
                aria-checked={plan === 'full-service'}
                tabIndex={0}
                onClick={() => setPlan('full-service')}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    setPlan('full-service');
                  }
                }}
                className={`p-4 rounded-radius border cursor-pointer transition-colors space-y-2 ${
                  plan === 'full-service'
                    ? 'border-emerald-500 bg-ink-0'
                    : 'border-line bg-card/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-text-0 text-sm lg:text-base">Full-Service</span>
                  <span className="text-xs md:text-sm text-emerald-700 dark:text-emerald-400 uppercase font-mono font-semibold">
                    ~₦5,000 / mo
                  </span>
                </div>
                <p className="text-xs md:text-sm text-text-1 leading-relaxed">
                  Platform provides all AI coach compute, extended portfolio validity, and automated CI test runs end-to-end.
                </p>
              </div>
            </div>

            {plan === 'byok' && (
              <div className="space-y-2 pt-2">
                <label htmlFor="settings-api-key" className="block text-xs md:text-sm uppercase tracking-wider text-text-1 font-semibold font-mono">
                  Your Gemini / OpenAI API Key
                </label>
                <input
                  id="settings-api-key"
                  type="password"
                  placeholder="AIzaSy... or sk-proj-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full px-3 py-2 rounded-radius border border-line bg-ink-0 text-text-0 focus:border-brass outline-none font-mono text-xs md:text-sm"
                />
                <span className="text-xs md:text-sm text-text-1 block font-mono">
                  Keys are stored in your private browser sandbox and never recorded on public ledgers.
                </span>
              </div>
            )}
          </section>

          {/* Section 4: Subscription Mock */}
          <section className="p-5 sm:p-6 rounded-radius border border-line bg-card/40 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-line">
              <div className="flex items-center gap-2 text-base font-semibold text-text-0">
                <CreditCard className="w-4 h-4 text-text-1" aria-hidden="true" />
                <span>Consensus Membership & Guarantee</span>
              </div>
              <span className="text-xs md:text-sm text-text-0 border border-line px-2.5 py-1 rounded font-mono font-medium">
                Active Certificate
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs md:text-sm text-text-1 font-mono">
              <span>Ledger Guarantee Expiry:</span>
              <span className="text-text-0 font-semibold">
                {new Date(user.portfolioValidUntil).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>
          </section>

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
            <button
              type="submit"
              disabled={isSaving}
              className="btn-brass text-xs md:text-sm py-2 px-6 cursor-pointer flex items-center justify-center gap-2 font-mono w-full sm:w-auto"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Stamping Identity...</span>
                </>
              ) : savedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                  <span>Identity Stamped</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Profile Updates</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </AuthGuard>
  );
}
