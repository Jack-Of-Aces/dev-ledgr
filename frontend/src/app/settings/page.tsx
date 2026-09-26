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
  ShieldCheck,
  Eye,
  EyeOff,
  Sparkles,
  Lock,
  Plus,
  X,
  Copy,
  RotateCcw,
} from 'lucide-react';

type SettingsTab = 'profile' | 'skills' | 'compute' | 'consensus';

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
  'Solidity',
  'Next.js',
];

export default function SettingsPage() {
  const { user, isSaving, errors, updateProfile } = useProfile();

  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  // Form states initialized from user profile
  const [name, setName] = useState(user.name);
  const [headline, setHeadline] = useState(user.headline);
  const [bio, setBio] = useState(user.bio);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || '');
  const [githubUrl, setGithubUrl] = useState(user.githubUrl || '');
  const [email, setEmail] = useState(user.email || '');
  const [plan, setPlan] = useState<'free' | 'full-service' | 'byok'>(user.plan);
  const [apiKey, setApiKey] = useState(user.apiKey || '');
  const [statedSkills, setStatedSkills] = useState<string[]>(user.statedSkills || []);

  // UI state
  const [showApiKey, setShowApiKey] = useState(false);
  const [customSkillInput, setCustomSkillInput] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCert, setCopiedCert] = useState(false);

  // Skill management
  const handleToggleSkill = (skill: string) => {
    if (statedSkills.includes(skill)) {
      setStatedSkills(statedSkills.filter((s) => s !== skill));
    } else {
      setStatedSkills([...statedSkills, skill]);
    }
  };

  const handleAddCustomSkill = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customSkillInput.trim();
    if (trimmed && !statedSkills.includes(trimmed)) {
      setStatedSkills([...statedSkills, trimmed]);
      setCustomSkillInput('');
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setStatedSkills(statedSkills.filter((s) => s !== skillToRemove));
  };

  // Reset to initial values
  const handleReset = () => {
    setName(user.name);
    setHeadline(user.headline);
    setBio(user.bio);
    setAvatarUrl(user.avatarUrl || '');
    setGithubUrl(user.githubUrl || '');
    setEmail(user.email || '');
    setPlan(user.plan);
    setApiKey(user.apiKey || '');
    setStatedSkills(user.statedSkills || []);
  };

  // API Key provider detection helper
  const detectApiKeyProvider = (key: string) => {
    if (!key) return null;
    if (key.startsWith('AIza')) return { name: 'Google Gemini API Key', valid: true };
    if (key.startsWith('sk-')) return { name: 'OpenAI API Key', valid: true };
    return { name: 'Custom Key Provider', valid: true };
  };

  const detectedProvider = detectApiKeyProvider(apiKey);

  const handleCopyPublicUrl = (e: React.MouseEvent) => {
    e.preventDefault();
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/p/${user.username}`;
      navigator.clipboard.writeText(url);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const handleCopyCertMetadata = () => {
    const certData = {
      protocol: 'DevLedgr Consensus v2.4',
      handle: user.username,
      guaranteedDomain: `${user.username}.devledgr.io`,
      validThrough: user.portfolioValidUntil,
      stampedSkills: statedSkills,
      rootAlgorithm: 'Ed25519-SHA256',
      status: 'Active · Online & Tamper-Evident',
    };
    navigator.clipboard.writeText(JSON.stringify(certData, null, 2));
    setCopiedCert(true);
    setTimeout(() => setCopiedCert(false), 2000);
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-12 space-y-8 font-sans">
        
        {/* ========================================================= */}
        {/* 1. SETTINGS HEADER & NAVIGATION                           */}
        {/* ========================================================= */}
        <section className="space-y-4 pb-6 border-b border-line">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-text-1">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald" />
              </span>
              <span className="font-semibold text-text-0 uppercase tracking-wider">
                Ledger Settings // {user.username}.devledgr.io
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleCopyPublicUrl}
                className="text-emerald-text hover:underline inline-flex items-center gap-1 cursor-pointer"
                title="Copy public link"
              >
                {copiedUrl ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald" />
                    <span>Copied URL</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Public URL</span>
                  </>
                )}
              </button>
              <span className="text-line">|</span>
              <Link
                href={`/p/${user.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-text-0 inline-flex items-center gap-1"
              >
                <span>Live View</span>
                <ExternalLink className="w-3 h-3 opacity-70" />
              </Link>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-0">
                Ledger & Account Settings
              </h1>
              <p className="text-xs sm:text-sm text-text-1 mt-1 max-w-2xl leading-relaxed">
                Configure your verified developer profile, technical skills index, AI compute tier, and cryptographic certificate guarantees.
              </p>
            </div>

            {/* Quick save button in header */}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="btn-brass text-xs py-2 px-4 cursor-pointer inline-flex items-center gap-2 font-mono shrink-0 self-start sm:self-auto"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Stamping Updates...</span>
                </>
              ) : savedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald" />
                  <span>Settings Saved</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save All Changes</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 2. MAIN LAYOUT: IA TABS & LIVE PREVIEW                    */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Main Form Content Column (8 cols on lg) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Tabs Navigation Strip */}
            <div
              role="tablist"
              aria-label="Settings categories"
              className="flex flex-wrap items-center gap-1 sm:gap-2 p-1 rounded-radius bg-card/60 border border-line text-xs sm:text-sm"
            >
              <button
                role="tab"
                id="settings-tab-profile"
                aria-selected={activeTab === 'profile'}
                aria-controls="settings-panel-profile"
                onClick={() => setActiveTab('profile')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-radius font-medium transition-colors cursor-pointer ${
                  activeTab === 'profile'
                    ? 'bg-card text-text-0 border border-line shadow-xs font-semibold'
                    : 'text-text-1 hover:text-text-0 hover:bg-card/50'
                }`}
              >
                <User className="w-4 h-4 text-emerald-text" />
                <span>Identity & Bio</span>
              </button>

              <button
                role="tab"
                id="settings-tab-skills"
                aria-selected={activeTab === 'skills'}
                aria-controls="settings-panel-skills"
                onClick={() => setActiveTab('skills')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-radius font-medium transition-colors cursor-pointer ${
                  activeTab === 'skills'
                    ? 'bg-card text-text-0 border border-line shadow-xs font-semibold'
                    : 'text-text-1 hover:text-text-0 hover:bg-card/50'
                }`}
              >
                <Code2 className="w-4 h-4 text-emerald-text" />
                <span>Technical Stack</span>
                <span className="px-1.5 py-0.2 rounded-full bg-card/80 border border-line text-xs font-mono text-text-1">
                  {statedSkills.length}
                </span>
              </button>

              <button
                role="tab"
                id="settings-tab-compute"
                aria-selected={activeTab === 'compute'}
                aria-controls="settings-panel-compute"
                onClick={() => setActiveTab('compute')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-radius font-medium transition-colors cursor-pointer ${
                  activeTab === 'compute'
                    ? 'bg-card text-text-0 border border-line shadow-xs font-semibold'
                    : 'text-text-1 hover:text-text-0 hover:bg-card/50'
                }`}
              >
                <Key className="w-4 h-4 text-emerald-text" />
                <span>AI Compute & Keys</span>
              </button>

              <button
                role="tab"
                id="settings-tab-consensus"
                aria-selected={activeTab === 'consensus'}
                aria-controls="settings-panel-consensus"
                onClick={() => setActiveTab('consensus')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-radius font-medium transition-colors cursor-pointer ${
                  activeTab === 'consensus'
                    ? 'bg-card text-text-0 border border-line shadow-xs font-semibold'
                    : 'text-text-1 hover:text-text-0 hover:bg-card/50'
                }`}
              >
                <CreditCard className="w-4 h-4 text-emerald-text" />
                <span>Guarantee & Security</span>
              </button>
            </div>

            {/* TAB PANELS */}
            <form onSubmit={handleSave} className="space-y-6">
              
              {/* ===================================================== */}
              {/* TAB 1: IDENTITY & BIO                                 */}
              {/* ===================================================== */}
              {activeTab === 'profile' && (
                <div
                  role="tabpanel"
                  id="settings-panel-profile"
                  aria-labelledby="settings-tab-profile"
                  className="space-y-6"
                >
                  <div className="p-5 sm:p-6 rounded-radius border border-line bg-card space-y-5">
                    <div className="flex items-center justify-between pb-3 border-b border-line">
                      <div className="space-y-0.5">
                        <h2 className="text-base font-semibold text-text-0">
                          Developer Ledger Identity
                        </h2>
                        <p className="text-xs text-text-1">
                          This public information appears on your signed engineering certificate and recruiter scrutiny packages.
                        </p>
                      </div>
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-tint border border-emerald-border text-emerald-text font-medium">
                        Publicly Signed
                      </span>
                    </div>

                    {/* Basic Info: Name & Handle */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="settings-full-name"
                          className="block text-xs font-mono text-text-1 mb-1 font-semibold"
                        >
                          FULL NAME *
                        </label>
                        <input
                          id="settings-full-name"
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g. Alex Okafor"
                          className="w-full px-3 py-2 rounded-radius border border-line bg-ink-0 text-text-0 focus:border-emerald outline-none text-xs sm:text-sm font-sans"
                        />
                        {errors.name && (
                          <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-mono">
                            {errors.name}
                          </p>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label
                            htmlFor="settings-handle"
                            className="block text-xs font-mono text-text-1 font-semibold"
                          >
                            HANDLE (IMMUTABLE CANONICAL URL)
                          </label>
                          <Lock className="w-3 h-3 text-text-1" />
                        </div>
                        <input
                          id="settings-handle"
                          type="text"
                          disabled
                          value={`@${user.username}`}
                          className="w-full px-3 py-2 rounded-radius border border-line bg-card/60 text-text-1 cursor-not-allowed font-mono text-xs sm:text-sm"
                        />
                        <span className="text-xs text-text-1 mt-1 block font-mono">
                          Permanently anchored to your cryptographic root key.
                        </span>
                      </div>
                    </div>

                    {/* Headline */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label
                          htmlFor="settings-headline"
                          className="block text-xs font-mono text-text-1 font-semibold"
                        >
                          PROFESSIONAL HEADLINE *
                        </label>
                        <span className="text-xs font-mono text-text-1">
                          {headline.length}/120
                        </span>
                      </div>
                      <input
                        id="settings-headline"
                        type="text"
                        required
                        maxLength={120}
                        value={headline}
                        onChange={(e) => setHeadline(e.target.value)}
                        placeholder="e.g. Junior Backend Engineer · 2 Verified Proofs"
                        className="w-full px-3 py-2 rounded-radius border border-line bg-ink-0 text-text-0 focus:border-emerald outline-none text-xs sm:text-sm"
                      />
                      {errors.headline && (
                        <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-mono">
                          {errors.headline}
                        </p>
                      )}
                    </div>

                    {/* Bio */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label
                          htmlFor="settings-bio"
                          className="block text-xs font-mono text-text-1 font-semibold"
                        >
                          BIOGRAPHY & TARGET ARCHITECTURES
                        </label>
                        <span className="text-xs font-mono text-text-1">
                          {bio.length}/500
                        </span>
                      </div>
                      <textarea
                        id="settings-bio"
                        rows={3}
                        maxLength={500}
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Describe your technical background, specific interest in distributed backends, idempotency, or systems engineering..."
                        className="w-full px-3 py-2 rounded-radius border border-line bg-ink-0 text-text-0 focus:border-emerald outline-none text-xs sm:text-sm leading-relaxed"
                      />
                      {errors.bio && (
                        <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-mono">
                          {errors.bio}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Connected Links & Social Identity */}
                  <div className="p-5 sm:p-6 rounded-radius border border-line bg-card space-y-4">
                    <h3 className="text-sm font-semibold text-text-0 pb-2 border-b border-line">
                      Online Presence & Verification Links
                    </h3>

                    <div className="space-y-4">
                      {/* Avatar URL */}
                      <div>
                        <label
                          htmlFor="settings-avatar-url"
                          className="block text-xs font-mono text-text-1 mb-1 font-semibold"
                        >
                          AVATAR IMAGE URL
                        </label>
                        <div className="flex items-center gap-3">
                          <div className="relative flex-1">
                            <ImageIcon className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-1" />
                            <input
                              id="settings-avatar-url"
                              type="url"
                              placeholder="https://images.unsplash.com/..."
                              value={avatarUrl}
                              onChange={(e) => setAvatarUrl(e.target.value)}
                              className="w-full pl-9 pr-3 py-2 rounded-radius border border-line bg-ink-0 text-text-0 focus:border-emerald outline-none text-xs sm:text-sm font-mono"
                            />
                          </div>
                          {avatarUrl && (
                            <div className="relative w-9 h-9 rounded-radius border border-line shrink-0 overflow-hidden bg-card">
                              <Image
                                src={avatarUrl}
                                alt="Avatar preview"
                                fill
                                sizes="36px"
                                className="object-cover"
                                unoptimized
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            </div>
                          )}
                        </div>
                        {errors.avatarUrl && (
                          <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-mono">
                            {errors.avatarUrl}
                          </p>
                        )}
                      </div>

                      {/* GitHub Profile URL */}
                      <div>
                        <label
                          htmlFor="settings-github-url"
                          className="block text-xs font-mono text-text-1 mb-1 font-semibold"
                        >
                          GITHUB REPOSITORY / PROFILE URL
                        </label>
                        <div className="relative">
                          <Code2 className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-1" />
                          <input
                            id="settings-github-url"
                            type="url"
                            placeholder="https://github.com/alexokafor"
                            value={githubUrl}
                            onChange={(e) => setGithubUrl(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 rounded-radius border border-line bg-ink-0 text-text-0 focus:border-emerald outline-none text-xs sm:text-sm font-mono"
                          />
                        </div>
                        {errors.githubUrl && (
                          <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-mono">
                            {errors.githubUrl}
                          </p>
                        )}
                      </div>

                      {/* Contact Email */}
                      <div>
                        <label
                          htmlFor="settings-email"
                          className="block text-xs font-mono text-text-1 mb-1 font-semibold"
                        >
                          VERIFIED RECRUITER CONTACT EMAIL
                        </label>
                        <div className="relative">
                          <Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-1" />
                          <input
                            id="settings-email"
                            type="email"
                            placeholder="alex@devledgr.me"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 rounded-radius border border-line bg-ink-0 text-text-0 focus:border-emerald outline-none text-xs sm:text-sm font-mono"
                          />
                        </div>
                        <span className="text-xs text-text-1 mt-1 block">
                          Used exclusively for receiving high-signal match inquiries from hiring managers.
                        </span>
                        {errors.email && (
                          <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-mono">
                            {errors.email}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ===================================================== */}
              {/* TAB 2: TECHNICAL STACK & INDEX                        */}
              {/* ===================================================== */}
              {activeTab === 'skills' && (
                <div
                  role="tabpanel"
                  id="settings-panel-skills"
                  aria-labelledby="settings-tab-skills"
                  className="space-y-6"
                >
                  <div className="p-5 sm:p-6 rounded-radius border border-line bg-card space-y-5">
                    <div className="flex items-center justify-between pb-3 border-b border-line">
                      <div className="space-y-0.5">
                        <h2 className="text-base font-semibold text-text-0">
                          Active Technical Stacks
                        </h2>
                        <p className="text-xs text-text-1">
                          Skills indexed in your cryptographic profile. These directly calibrate algorithmic match scores across company job requisitions.
                        </p>
                      </div>
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-card border border-line text-text-0 font-medium">
                        {statedSkills.length} Selected
                      </span>
                    </div>

                    {/* Active Selected Skills Cloud */}
                    <div className="space-y-2">
                      <div className="text-xs font-mono uppercase tracking-wider text-text-1 font-semibold">
                        Your Stamped Skills:
                      </div>
                      {statedSkills.length > 0 ? (
                        <div className="flex flex-wrap gap-2 p-3 rounded-radius border border-line bg-ink-0/60 min-h-12 items-center">
                          {statedSkills.map((skill) => (
                            <span
                              key={skill}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-card border border-emerald/40 text-text-0 text-xs font-mono font-medium shadow-xs"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald" />
                              <span>{skill}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveSkill(skill)}
                                className="text-text-1 hover:text-rose-600 p-0.5 cursor-pointer ml-1"
                                aria-label={`Remove skill ${skill}`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 rounded-radius border border-dashed border-line text-center text-xs text-text-1">
                          No skills selected yet. Choose from the catalog below or add a custom skill.
                        </div>
                      )}
                      {errors.statedSkills && (
                        <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-mono">
                          {errors.statedSkills}
                        </p>
                      )}
                    </div>

                    {/* Add Custom Skill Input */}
                    <div className="pt-2 border-t border-line/60">
                      <label
                        htmlFor="settings-custom-skill"
                        className="block text-xs font-mono text-text-1 mb-1 font-semibold uppercase tracking-wider"
                      >
                        Add Custom Skill or Tooling
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          id="settings-custom-skill"
                          type="text"
                          value={customSkillInput}
                          onChange={(e) => setCustomSkillInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddCustomSkill(e);
                            }
                          }}
                          placeholder="e.g. Apache Flink, WebAssembly, ClickHouse, Elixir..."
                          className="flex-1 px-3 py-2 rounded-radius border border-line bg-ink-0 text-text-0 focus:border-emerald outline-none text-xs sm:text-sm font-mono"
                        />
                        <button
                          type="button"
                          onClick={handleAddCustomSkill}
                          className="btn-brass text-xs py-2 px-3.5 inline-flex items-center gap-1.5 cursor-pointer shrink-0 font-mono"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Skill</span>
                        </button>
                      </div>
                    </div>

                    {/* Quick Popular Catalog */}
                    <div className="space-y-2 pt-2 border-t border-line/60">
                      <div className="text-xs font-mono uppercase tracking-wider text-text-1 font-semibold">
                        Core Platform Stacks (Click to Toggle):
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {POPULAR_SKILLS.map((skill) => {
                          const isSelected = statedSkills.includes(skill);
                          return (
                            <button
                              type="button"
                              key={skill}
                              onClick={() => handleToggleSkill(skill)}
                              className={`px-2.5 py-1 rounded-radius border text-xs font-mono transition-colors cursor-pointer ${
                                isSelected
                                  ? 'border-emerald bg-emerald-tint text-emerald-text font-semibold'
                                  : 'border-line bg-card/60 text-text-1 hover:text-text-0 hover:border-text-1'
                              }`}
                            >
                              {isSelected ? '✓ ' : '+ '}
                              {skill}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ===================================================== */}
              {/* TAB 3: AI COMPUTE & API KEYS                          */}
              {/* ===================================================== */}
              {activeTab === 'compute' && (
                <div
                  role="tabpanel"
                  id="settings-panel-compute"
                  aria-labelledby="settings-tab-compute"
                  className="space-y-6"
                >
                  <div className="p-5 sm:p-6 rounded-radius border border-line bg-card space-y-5">
                    <div className="flex items-center justify-between pb-3 border-b border-line">
                      <div className="space-y-0.5">
                        <h2 className="text-base font-semibold text-text-0">
                          AI Model & Compute Tier
                        </h2>
                        <p className="text-xs text-text-1">
                          Configure how code scrutiny, architectural analysis, and coaching prompts are executed.
                        </p>
                      </div>
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-card border border-line text-text-0 font-medium">
                        BYOK & Local Privacy
                      </span>
                    </div>

                    {/* Radio Tier Selection */}
                    <div
                      role="radiogroup"
                      aria-label="AI compute model tier"
                      className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                    >
                      {/* BYOK Tier */}
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
                        className={`p-4 rounded-radius border cursor-pointer transition-all space-y-2 ${
                          plan === 'byok'
                            ? 'border-emerald bg-ink-0 shadow-xs ring-1 ring-emerald/30'
                            : 'border-line bg-card/60 hover:border-text-1/60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-text-0 text-sm">BYOK Plan</span>
                          <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-emerald-tint text-emerald-text border border-emerald-border">
                            Free / Self-Hosted
                          </span>
                        </div>
                        <p className="text-xs text-text-1 leading-relaxed">
                          Provide your own Google Gemini or OpenAI API key. Scrutiny prompts are run at raw provider cost.
                        </p>
                      </div>

                      {/* Full-Service Tier */}
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
                        className={`p-4 rounded-radius border cursor-pointer transition-all space-y-2 ${
                          plan === 'full-service'
                            ? 'border-emerald bg-ink-0 shadow-xs ring-1 ring-emerald/30'
                            : 'border-line bg-card/60 hover:border-text-1/60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-text-0 text-sm">Full-Service</span>
                          <span className="text-xs font-mono font-semibold text-text-1">
                            ~₦5,000 / mo
                          </span>
                        </div>
                        <p className="text-xs text-text-1 leading-relaxed">
                          DevLedgr manages automated CI test runner instances, AI analysis clusters, and uninterrupted portfolio uptime.
                        </p>
                      </div>
                    </div>

                    {/* API Key Input Field (When BYOK is active) */}
                    {plan === 'byok' && (
                      <div className="space-y-3 pt-3 border-t border-line/60">
                        <div className="flex items-center justify-between">
                          <label
                            htmlFor="settings-api-key"
                            className="block text-xs font-mono uppercase tracking-wider text-text-1 font-semibold"
                          >
                            YOUR GEMINI / OPENAI API KEY
                          </label>
                          {detectedProvider && (
                            <span className="text-xs font-mono text-emerald-text font-medium">
                              Detected: {detectedProvider.name}
                            </span>
                          )}
                        </div>

                        <div className="relative">
                          <input
                            id="settings-api-key"
                            type={showApiKey ? 'text' : 'password'}
                            placeholder="AIzaSy... or sk-proj-..."
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            className="w-full pl-3 pr-10 py-2 rounded-radius border border-line bg-ink-0 text-text-0 focus:border-emerald outline-none font-mono text-xs sm:text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-1 hover:text-text-0 p-1 cursor-pointer"
                            aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                          >
                            {showApiKey ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        <div className="flex items-start gap-2 p-3 rounded-radius border border-line bg-ink-0/60 text-xs text-text-1 font-mono">
                          <ShieldCheck className="w-4 h-4 text-emerald-text shrink-0 mt-0.5" />
                          <span>
                            Keys are stored securely in your private browser sandbox and never committed to public consensus ledgers.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ===================================================== */}
              {/* TAB 4: CONSENSUS CERTIFICATE & SECURITY               */}
              {/* ===================================================== */}
              {activeTab === 'consensus' && (
                <div
                  role="tabpanel"
                  id="settings-panel-consensus"
                  aria-labelledby="settings-tab-consensus"
                  className="space-y-6"
                >
                  <div className="p-5 sm:p-6 rounded-radius border border-line bg-card space-y-5">
                    <div className="flex items-center justify-between pb-3 border-b border-line">
                      <div className="space-y-0.5">
                        <h2 className="text-base font-semibold text-text-0">
                          Consensus Membership & Guarantee
                        </h2>
                        <p className="text-xs text-text-1">
                          Proof-of-work guarantees verified on the DevLedgr consensus network.
                        </p>
                      </div>
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-tint border border-emerald-border text-emerald-text font-medium">
                        Active Node Certificate
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                      <div className="p-3.5 rounded-radius border border-line bg-ink-0/60 space-y-1">
                        <div className="text-text-1">PORTFOLIO GUARANTEE EXPIRY</div>
                        <div className="text-sm font-bold text-text-0">
                          {new Date(user.portfolioValidUntil).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </div>
                        <div className="text-emerald-text font-medium">
                          364 Days Remaining
                        </div>
                      </div>

                      <div className="p-3.5 rounded-radius border border-line bg-ink-0/60 space-y-1">
                        <div className="text-text-1">ROOT SIGNING ALGORITHM</div>
                        <div className="text-sm font-bold text-text-0">
                          Ed25519 · SHA-256
                        </div>
                        <div className="text-text-1">
                          Decentralized Peer Network
                        </div>
                      </div>
                    </div>

                    {/* Certificate Action Strip */}
                    <div className="pt-3 border-t border-line/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="text-text-1">
                        Export cryptographic identity certificate for third-party auditing:
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCopyCertMetadata}
                          className="btn-outline text-xs py-1.5 px-3 inline-flex items-center gap-1.5 font-mono cursor-pointer"
                        >
                          {copiedCert ? (
                            <>
                              <Check className="w-3 h-3 text-emerald" />
                              <span>Copied JSON</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy Certificate JSON</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Sticky Action Strip */}
              <div className="p-4 rounded-radius border border-line bg-card/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="text-text-1 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald" />
                  <span>Unsaved changes will update your public cryptographic certificate.</span>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="btn-outline text-xs py-2 px-3 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="btn-brass text-xs py-2 px-5 cursor-pointer inline-flex items-center gap-2 font-mono"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Stamping...</span>
                      </>
                    ) : savedSuccess ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald" />
                        <span>Changes Stamped</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Profile Updates</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Right Column: Live Public Portfolio Card Preview (4 cols on lg) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="sticky top-24 space-y-4">
              <div className="flex items-center justify-between text-xs font-mono text-text-1">
                <span className="uppercase tracking-wider font-semibold">
                  Live Public Preview
                </span>
                <span className="text-emerald-text font-medium flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Instant Sync
                </span>
              </div>

              {/* Mini Card Preview simulating the public portfolio view */}
              <div className="rounded-radius border border-line bg-card p-5 space-y-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-radius border border-line overflow-hidden relative shrink-0 bg-ink-0 flex items-center justify-center font-mono font-bold text-text-0">
                    {avatarUrl ? (
                      <Image
                        src={avatarUrl}
                        alt="Avatar preview"
                        fill
                        sizes="48px"
                        className="object-cover"
                        unoptimized
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      name.slice(0, 2).toUpperCase()
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="font-semibold text-text-0 text-sm truncate">
                      {name || 'Developer Name'}
                    </div>
                    <div className="text-xs font-mono text-emerald-text truncate">
                      @{user.username}
                    </div>
                  </div>
                </div>

                <p className="text-xs text-text-1 line-clamp-2 leading-relaxed">
                  {headline || 'Professional Headline will appear here...'}
                </p>

                {/* Stated skills badges */}
                <div className="pt-2 border-t border-line/60">
                  <div className="text-xs font-mono text-text-1 mb-1.5 uppercase">
                    Active Stack ({statedSkills.length}):
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {statedSkills.slice(0, 6).map((skill) => (
                      <span
                        key={skill}
                        className="text-xs font-mono px-2 py-0.5 rounded bg-card/80 border border-line text-text-0"
                      >
                        {skill}
                      </span>
                    ))}
                    {statedSkills.length > 6 && (
                      <span className="text-xs font-mono text-text-1 px-1 py-0.5">
                        +{statedSkills.length - 6} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Proof Guarantee Notice */}
                <div className="pt-2 border-t border-line/60 flex items-center justify-between text-xs font-mono text-text-1">
                  <span className="flex items-center gap-1 text-emerald-text">
                    <ShieldCheck className="w-3 h-3" />
                    Verified Guarantee
                  </span>
                  <span>Sep 2027</span>
                </div>
              </div>

              {/* Helpful Tips Card */}
              <div className="p-4 rounded-radius border border-line/60 bg-card/30 space-y-2 text-xs text-text-1">
                <div className="font-semibold text-text-0 font-mono">
                  Why keep your stack updated?
                </div>
                <p className="leading-relaxed">
                  DevLedgr indexes your stated skills against real-world engineering job requisitions. Matched proofs unlock automated ATS-safe application package generation.
                </p>
              </div>
            </div>
          </div>

        </div>

      </div>
    </AuthGuard>
  );
}
