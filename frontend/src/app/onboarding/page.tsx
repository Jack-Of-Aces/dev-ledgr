'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { BrandMark } from '@/components/brand/BrandMark';
import {
  ENGINEERING_TRACKS,
  getAllTracks,
  getTrackById,
  InferredTrackResult,
} from '@/lib/tracks';
import { EngineeringTrack, ExperienceLevel } from '@/types';
import {
  Sparkles,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Cpu,
  Layers,
  Palette,
  Workflow,
  Smartphone,
  Server,
  Lock,
} from 'lucide-react';

const GithubIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
    />
  </svg>
);

const TRACK_ICONS: Record<EngineeringTrack, React.ReactNode> = {
  'devops-infra': <Server className="w-5 h-5 text-brass" />,
  'backend-systems': <Cpu className="w-5 h-5 text-emerald-text" />,
  'frontend-ui': <Layers className="w-5 h-5 text-sky-500" />,
  'fullstack': <Workflow className="w-5 h-5 text-amber-500" />,
  'product-design': <Palette className="w-5 h-5 text-rose-500" />,
  'ai-ml': <Sparkles className="w-5 h-5 text-purple-500" />,
  'mobile': <Smartphone className="w-5 h-5 text-emerald-500" />,
};

const STEP_LABELS = [
  { step: 1, title: 'Discipline', subtitle: 'Track & Role' },
  { step: 2, title: 'Stack', subtitle: 'Seniority & Tools' },
  { step: 3, title: 'Identity', subtitle: 'GitHub Anchor' },
  { step: 4, title: 'Launch', subtitle: 'Console Ready' },
];

export default function OnboardingPage() {
  const { user, completeOnboarding, ideas, jobs } = useAppStore();

  const [mounted, setMounted] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Track & Role
  const [selectedTrack, setSelectedTrack] = useState<EngineeringTrack>(
    user.engineeringTrack || 'backend-systems'
  );
  const [targetRole, setTargetRole] = useState<string>(
    user.targetRole || ENGINEERING_TRACKS['backend-systems'].targetRoles[0]
  );

  // Step 2: Experience & Skills
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(
    user.experienceLevel || 'junior'
  );
  const [skills, setSkills] = useState<string[]>(
    user.statedSkills && user.statedSkills.length > 0
      ? user.statedSkills
      : ENGINEERING_TRACKS['backend-systems'].defaultSkills
  );
  const [customSkillInput, setCustomSkillInput] = useState('');

  // Step 3: GitHub Connection Enforcement
  const isGithubOAuthUser = user.authProvider === 'github';
  const [githubUsernameInput, setGithubUsernameInput] = useState(
    isGithubOAuthUser ? (user.githubUsername || user.username || '') : ''
  );
  const [isVerifyingGithub, setIsVerifyingGithub] = useState(false);
  const [githubVerified, setGithubVerified] = useState<boolean>(isGithubOAuthUser);
  const [githubVerificationError, setGithubVerificationError] = useState<string | null>(null);
  const [githubMatchDetails, setGithubMatchDetails] = useState<{
    source?: string;
    repo?: string;
    email?: string;
  } | null>(null);

  // Smart Inference State
  const [isInferring, setIsInferring] = useState(false);
  const [inferredResult, setInferredResult] = useState<InferredTrackResult | null>(null);
  const hasUserSelectedTrackRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // When track changes, update available roles and default skills
  const handleSelectTrack = (trackId: EngineeringTrack) => {
    hasUserSelectedTrackRef.current = true;
    setSelectedTrack(trackId);
    const trackDef = getTrackById(trackId);
    setTargetRole(trackDef.targetRoles[0]);
    setSkills(trackDef.defaultSkills);
  };

  // Run Smart-Inference ONLY when authenticated via GitHub OAuth or when GitHub is explicitly verified
  useEffect(() => {
    const candidateUsername = isGithubOAuthUser
      ? (user.githubUsername || user.username)
      : (githubVerified ? githubUsernameInput.replace(/^@/, '').trim() : '');

    // Strict guard: NEVER fetch repositories if unlinked, empty, or generic fallback
    if (
      !candidateUsername ||
      candidateUsername === 'developer' ||
      candidateUsername === 'junior_dev'
    ) {
      return;
    }

    let active = true;
    const analyzeGitHub = async () => {
      setIsInferring(true);
      try {
        const res = await fetch('/api/github/infer-track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: candidateUsername }),
        });
        const data = await res.json();
        if (active && data.success && data.track) {
          setInferredResult(data);
          // If candidate hasn't manually clicked a track yet, auto-select the inferred track
          if (!hasUserSelectedTrackRef.current && !user.engineeringTrack) {
            setSelectedTrack(data.inferredTrack);
            const trackDef = getTrackById(data.inferredTrack);
            setTargetRole(trackDef.targetRoles[0]);
            setSkills(trackDef.defaultSkills);
          }
        }
      } catch {
        // Silently fall back to manual selection
      } finally {
        if (active) setIsInferring(false);
      }
    };

    analyzeGitHub();
    return () => {
      active = false;
    };
  }, [isGithubOAuthUser, user.githubUsername, user.username, user.engineeringTrack, githubVerified, githubUsernameInput]);

  const handleToggleSkill = (skill: string) => {
    if (skills.includes(skill)) {
      setSkills(skills.filter((s) => s !== skill));
    } else {
      setSkills([...skills, skill]);
    }
  };

  const handleAddCustomSkill = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customSkillInput.trim();
    if (!clean || skills.includes(clean)) return;
    setSkills([...skills, clean]);
    setCustomSkillInput('');
  };

  const handleVerifyGitHubAccount = async () => {
    const clean = githubUsernameInput.replace(/^@/, '').trim();
    if (!clean) return;

    setIsVerifyingGithub(true);
    setGithubVerificationError(null);
    setGithubMatchDetails(null);

    const userEmail = user.email || '';
    if (!userEmail) {
      setIsVerifyingGithub(false);
      setGithubVerificationError('A registered email is required to verify account ownership.');
      return;
    }

    try {
      const res = await fetch('/api/github/verify-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: clean, userEmail }),
      });
      const data = await res.json();
      if (res.ok && data.matched) {
        setGithubVerified(true);
        setGithubVerificationError(null);
        setGithubMatchDetails({
          source: data.matchSource,
          repo: data.repoProof,
          email: data.matchedEmail,
        });
      } else {
        setGithubVerified(false);
        setGithubVerificationError(
          data.error ||
            `Email mismatch: @${clean} is not associated with your registered email (${userEmail}). You can only link a GitHub account that belongs to you.`
        );
      }
    } catch {
      setGithubVerified(false);
      setGithubVerificationError('Unable to connect to verification server. Please verify your connection.');
    } finally {
      setIsVerifyingGithub(false);
    }
  };

  const handleFinishOnboarding = () => {
    const cleanGithub =
      githubUsernameInput.replace(/^@/, '').trim() ||
      (isGithubOAuthUser ? (user.githubUsername || user.username) : '');

    // Strict identity gate: non-GitHub OAuth accounts must verify their matching GitHub profile
    if (!isGithubOAuthUser && !githubVerified) {
      setCurrentStep(3);
      setGithubVerificationError(
        `You must verify a GitHub account matching ${user.email} before proceeding.`
      );
      return;
    }

    const displayName = user.name || user.username || 'Developer';

    completeOnboarding({
      username: user.username || cleanGithub || 'developer',
      name: displayName,
      headline: `${experienceLevel.charAt(0).toUpperCase() + experienceLevel.slice(1)} ${targetRole} · Verified Ledger`,
      skills,
      engineeringTrack: selectedTrack,
      targetRole,
      experienceLevel,
      githubConnected: true,
      githubUsername: cleanGithub || user.username,
    });

    window.location.replace('/dashboard');
  };

  if (!mounted) {
    return null;
  }

  const currentTrackDef = getTrackById(selectedTrack);
  const tailoredProblem =
    ideas.find((i) => currentTrackDef.recommendedIdeaIds.includes(i.id)) || ideas[0];
  const tailoredJob =
    jobs.find((j) => j.tags.some((t) => currentTrackDef.defaultSkills.includes(t))) || jobs[0];

  const candidateDisplayName = user.name || user.username || 'Developer';

  return (
    <div className="min-h-screen w-full flex flex-col justify-between px-3 sm:px-6 md:px-8 py-4 sm:py-8 font-sans max-w-7xl mx-auto">
      <div className="w-full space-y-6 sm:space-y-8 flex-1">
        
        {/* ─── Minimal Tactile Header & Stepper ─────────────────────────── */}
        <div className="space-y-4 pb-4 sm:pb-6 border-b border-line">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <BrandMark size={32} className="shrink-0 sm:w-9 sm:h-9" />
              <div>
                <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-widest text-brass font-bold block">
                  Developer Calibration · Step {currentStep} of 4
                </span>
                <h1 className="text-lg sm:text-2xl md:text-3xl font-bold tracking-tight text-text-0">
                  {currentStep === 1 && 'Select Your Discipline'}
                  {currentStep === 2 && 'Experience & Tech Stack'}
                  {currentStep === 3 && 'GitHub Identity Anchor'}
                  {currentStep === 4 && 'Console Readiness Overview'}
                </h1>
              </div>
            </div>

            {/* Candidate Identity Pill */}
            <div className="flex items-center gap-2 self-start sm:self-auto px-2.5 py-1 rounded-full border border-line bg-ink-0 text-[11px] sm:text-xs font-mono text-text-1">
              <div className="w-2 h-2 rounded-full bg-emerald animate-pulse shrink-0" />
              <span className="text-text-0 font-medium truncate max-w-[140px] sm:max-w-none">{candidateDisplayName}</span>
              {user.email && (
                <span className="hidden md:inline text-text-1">({user.email})</span>
              )}
            </div>
          </div>

          {/* Stepper Navigation Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 pt-2">
            {STEP_LABELS.map(({ step, title, subtitle }) => {
              const isPast = currentStep > step;
              const isCurrent = currentStep === step;
              const isAccessible = isPast || isCurrent || (step === 4 && (githubVerified || isGithubOAuthUser));

              return (
                <button
                  key={step}
                  type="button"
                  onClick={() => {
                    if (isAccessible) setCurrentStep(step as 1 | 2 | 3 | 4);
                  }}
                  disabled={!isAccessible}
                  className={`text-left p-2 rounded transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-ink-1 border border-brass/50'
                      : isPast
                      ? 'hover:bg-ink-1/50 border border-transparent'
                      : 'opacity-40 border border-transparent cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-mono">
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        isPast
                          ? 'bg-emerald text-ink-0'
                          : isCurrent
                          ? 'bg-brass text-ink-0'
                          : 'bg-card border border-line text-text-1'
                      }`}
                    >
                      {isPast ? '✓' : step}
                    </span>
                    <span className={`font-semibold text-[11px] sm:text-xs truncate ${isCurrent ? 'text-text-0' : 'text-text-1'}`}>
                      {title}
                    </span>
                  </div>
                  <div className="text-[10px] text-text-1 hidden md:block pl-5 truncate">
                    {subtitle}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── STEP 1: Engineering Discipline (Track & Role) ────────────── */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Context Header */}
            <div className="space-y-1">
              <p className="text-xs md:text-sm text-text-1 leading-relaxed">
                Choose your primary focus. DevLedgr calibrates failure-mode scenarios, automated test gates, and recruiter discovery to your core stack.
              </p>
            </div>

            {/* GitHub Auto-Calibration Badge (Only shown if genuinely inferred) */}
            {isInferring && (
              <div className="flex items-center gap-2 p-3 rounded-radius border border-line bg-card/60 text-xs font-mono text-text-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-brass shrink-0" />
                <span>Inspecting public commit patterns for automatic calibration...</span>
              </div>
            )}

            {inferredResult && !isInferring && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-radius border border-emerald/30 bg-emerald-tint text-xs font-mono">
                <div className="flex items-center gap-2 text-emerald-text">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>
                    Auto-calibrated from public git trees: <strong>{inferredResult.track.title}</strong> ({Math.round(inferredResult.confidence * 100)}% match)
                  </span>
                </div>
                {selectedTrack !== inferredResult.track.id && (
                  <button
                    type="button"
                    onClick={() => handleSelectTrack(inferredResult.track.id)}
                    className="btn-brass text-[11px] py-1 px-3 shrink-0 cursor-pointer"
                  >
                    Select Recommended
                  </button>
                )}
              </div>
            )}

            {/* Responsive Track Selection List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
              {getAllTracks().map((track) => {
                const isSelected = selectedTrack === track.id;
                return (
                  <button
                    key={track.id}
                    type="button"
                    onClick={() => handleSelectTrack(track.id)}
                    className={`text-left p-3 sm:p-4 rounded-radius border transition-all cursor-pointer flex flex-col justify-between space-y-2 relative ${
                      isSelected
                        ? 'border-brass bg-ink-1 ring-1 ring-brass/40'
                        : 'border-line/70 bg-ink-0/30 hover:border-text-1/30 hover:bg-ink-1/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-1.5 rounded bg-ink-0 border border-line shrink-0">
                          {TRACK_ICONS[track.id]}
                        </div>
                        <span className="font-semibold text-text-0 text-xs sm:text-sm truncate">
                          {track.title}
                        </span>
                      </div>
                      {isSelected ? (
                        <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-brass flex items-center justify-center text-ink-0 shrink-0">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-line shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] sm:text-xs text-text-1 leading-relaxed">
                      {track.tagline}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Specialized Role Chips */}
            <div className="space-y-2 pt-3 border-t border-line">
              <label className="block text-xs font-mono uppercase tracking-wider text-text-1 font-semibold">
                Target Role Designation ({currentTrackDef.shortTitle}):
              </label>
              <div className="flex flex-wrap gap-2">
                {currentTrackDef.targetRoles.map((role) => {
                  const isRoleActive = targetRole === role;
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setTargetRole(role)}
                      className={`px-3 py-1.5 rounded text-xs font-mono transition-all cursor-pointer ${
                        isRoleActive
                          ? 'bg-text-0 text-ink-0 font-bold shadow-xs'
                          : 'bg-card border border-line text-text-1 hover:text-text-0 hover:border-text-1/40'
                      }`}
                    >
                      {role}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Navigation Bar */}
            <div className="flex items-center justify-end pt-4 border-t border-line">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="btn-brass text-xs md:text-sm py-2 px-5 flex items-center gap-2 cursor-pointer"
              >
                <span>Continue to Tech Stack</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 2: Experience & Focus Stack ─────────────────────────── */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <p className="text-xs md:text-sm text-text-1 leading-relaxed">
                Tuning difficulty vectors and test benchmarks for{' '}
                <strong className="text-text-0">{targetRole}</strong> in the{' '}
                <strong className="text-text-0">{currentTrackDef.title}</strong> track.
              </p>
            </div>

            {/* Experience Level Segmented Control */}
            <div className="space-y-2">
              <label className="block text-xs font-mono uppercase tracking-wider text-text-1 font-semibold">
                Seniority / Career Horizon:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { level: 'junior' as ExperienceLevel, label: 'Junior / Entry', tenure: '0 - 2 yrs' },
                  { level: 'mid' as ExperienceLevel, label: 'Mid-Level', tenure: '2 - 5 yrs' },
                  { level: 'senior' as ExperienceLevel, label: 'Senior', tenure: '5 - 8 yrs' },
                  { level: 'lead' as ExperienceLevel, label: 'Staff / Lead', tenure: '8+ yrs' },
                ].map(({ level, label, tenure }) => {
                  const isActive = experienceLevel === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setExperienceLevel(level)}
                      className={`p-3 rounded-radius text-center border cursor-pointer transition-all ${
                        isActive
                          ? 'border-brass bg-ink-1 font-semibold text-text-0 ring-1 ring-brass/40 shadow-xs'
                          : 'border-line bg-card/60 text-text-1 hover:border-text-1/30 hover:text-text-0'
                      }`}
                    >
                      <div className="text-xs sm:text-sm">{label}</div>
                      <div className="text-[11px] font-mono text-text-1 mt-0.5">{tenure}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stack Selection Pills */}
            <div className="space-y-3 pt-3 border-t border-line">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-mono uppercase tracking-wider text-text-1 font-semibold">
                  Core Technologies &amp; Protocols ({skills.length} selected):
                </label>
                <span className="text-xs text-text-1 font-mono">Toggle to add or remove</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {currentTrackDef.defaultSkills.map((skill) => {
                  const active = skills.includes(skill);
                  return (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => handleToggleSkill(skill)}
                      className={`px-3 py-1.5 rounded-full text-xs font-mono transition-all cursor-pointer ${
                        active
                          ? 'bg-text-0 text-ink-0 font-bold shadow-xs'
                          : 'bg-card border border-line text-text-1 hover:border-text-1/40 hover:text-text-0'
                      }`}
                    >
                      {active ? `✓ ${skill}` : `+ ${skill}`}
                    </button>
                  );
                })}
                {/* Render any added custom skills */}
                {skills
                  .filter((s) => !currentTrackDef.defaultSkills.includes(s))
                  .map((customSkill) => (
                    <button
                      key={customSkill}
                      type="button"
                      onClick={() => handleToggleSkill(customSkill)}
                      className="px-3 py-1.5 rounded-full text-xs font-mono bg-text-0 text-ink-0 font-bold shadow-xs cursor-pointer"
                    >
                      ✓ {customSkill}
                    </button>
                  ))}
              </div>

              {/* Add Custom Skill */}
              <form onSubmit={handleAddCustomSkill} className="flex gap-2 pt-1 max-w-md">
                <input
                  type="text"
                  value={customSkillInput}
                  onChange={(e) => setCustomSkillInput(e.target.value)}
                  placeholder="Add custom skill (e.g. Istio, ClickHouse, WebGL)..."
                  className="px-3 py-1.5 rounded-radius border border-line bg-ink-0 text-xs sm:text-sm text-text-0 flex-1 focus:border-brass outline-none font-mono"
                />
                <button
                  type="submit"
                  disabled={!customSkillInput.trim()}
                  className="btn-outline text-xs py-1.5 px-3 cursor-pointer disabled:opacity-40 shrink-0 font-mono"
                >
                  Add
                </button>
              </form>
            </div>

            {/* Navigation Bar */}
            <div className="flex items-center justify-between pt-4 border-t border-line">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="btn-outline text-xs md:text-sm py-2 px-4 flex items-center gap-1.5 cursor-pointer text-text-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="btn-brass text-xs md:text-sm py-2 px-5 flex items-center gap-2 cursor-pointer"
              >
                <span>Continue to GitHub Anchor</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 3: Identity & GitHub Verification ───────────────────── */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <p className="text-xs md:text-sm text-text-1 leading-relaxed">
                DevLedgr anchors all test runner executions, commit diffs, and proof certificates to a verified GitHub developer identity.
              </p>
            </div>

            {/* GitHub OAuth Mode (Already Verified) */}
            {isGithubOAuthUser ? (
              <div className="p-5 rounded-radius border border-emerald/30 bg-emerald-tint/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-emerald-tint border border-emerald/40 flex items-center justify-center text-emerald-text">
                      <GithubIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-text-0">
                          @{user.githubUsername || user.username}
                        </span>
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-tint text-emerald-text font-bold border border-emerald/30">
                          OAuth Verified
                        </span>
                      </div>
                      <p className="text-xs text-text-1 mt-0.5 font-mono">
                        Bound to: {user.email || 'GitHub Primary Account'}
                      </p>
                    </div>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-emerald-text shrink-0" />
                </div>
                <p className="text-xs text-text-1 leading-relaxed border-t border-emerald/20 pt-3">
                  Your GitHub identity is cryptographically anchored via OAuth. Solutions you submit will automatically verify commit SHAs against this profile.
                </p>
              </div>
            ) : (
              <div className="space-y-4 pt-2">
              {/* Registered Email Banner */}
              <div className="p-3 rounded-radius border border-line/80 bg-ink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="space-y-0.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-text-1 font-semibold">
                    Registered DevLedgr Email:
                  </div>
                  <div className="font-mono text-xs sm:text-sm font-semibold text-text-0 truncate max-w-full">
                    {user.email || 'Email missing'}
                  </div>
                </div>
                <div className="text-[11px] font-mono text-brass border border-brass/30 bg-brass/10 px-2 py-0.5 rounded inline-flex items-center gap-1 self-start sm:self-auto shrink-0">
                  <Lock className="w-3 h-3" />
                  <span>Ownership check required</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="github-username-input"
                  className="block text-xs font-mono uppercase tracking-wider text-text-1 font-semibold"
                >
                  GitHub Username or Handle:
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-1 font-mono text-xs">
                      @
                    </span>
                    <input
                      id="github-username-input"
                      type="text"
                      value={githubUsernameInput}
                      onChange={(e) => {
                        setGithubUsernameInput(e.target.value);
                        setGithubVerified(false);
                        setGithubVerificationError(null);
                      }}
                      placeholder="your-github-username"
                      className="w-full pl-7 pr-3 py-2 rounded-radius border border-line bg-ink-0 text-text-0 text-xs sm:text-sm font-mono focus:border-brass outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleVerifyGitHubAccount}
                    disabled={!githubUsernameInput.trim() || isVerifyingGithub}
                    className="btn-brass text-xs py-2 px-4 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shrink-0 font-mono w-full sm:w-auto"
                  >
                    {isVerifyingGithub ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <GithubIcon className="w-3.5 h-3.5" />
                        <span>Verify &amp; Link</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-text-1 leading-relaxed">
                  We match the GitHub account against your registered email (<code>{user.email}</code>) via public profile, git commit author history, or verified alias.
                </p>
              </div>

              {/* Status Banners */}
              {githubVerificationError && (
                <div className="p-3 rounded border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2.5 font-mono">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="font-semibold">Identity Verification Failed</div>
                    <div className="text-[11px] mt-0.5 leading-relaxed break-words">{githubVerificationError}</div>
                  </div>
                </div>
              )}

              {githubVerified ? (
                <div className="p-3 sm:p-3.5 rounded border border-emerald/30 bg-emerald-tint text-emerald-text text-xs space-y-1 font-mono">
                  <div className="flex items-center gap-2 font-semibold text-xs sm:text-sm">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span className="truncate">Verified GitHub Identity: @{githubUsernameInput.replace(/^@/, '')}</span>
                  </div>
                  <div className="text-[11px] pl-6 text-emerald-text/80 space-y-0.5">
                    <div>
                      ✓ Proof: {githubMatchDetails?.source === 'profile' ? 'Public Profile Match' : githubMatchDetails?.source === 'commits' ? `Commit Author History (${githubMatchDetails.repo ? `repo: ${githubMatchDetails.repo}` : 'public commits'})` : 'GitHub Verified Alias'}
                    </div>
                    <div>✓ Matched Email: {githubMatchDetails?.email || user.email}</div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-text-1 font-mono flex items-center gap-1.5 p-2 rounded bg-ink-0 border border-line">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                  <span>Verification required before entering the dashboard.</span>
                </div>
              )}
            </div>
          )}

          {/* Navigation Bar */}
          <div className="flex items-center justify-between pt-4 border-t border-line">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="btn-outline text-xs sm:text-sm py-2 px-3.5 sm:px-4 flex items-center gap-1.5 cursor-pointer text-text-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!isGithubOAuthUser && !githubVerified) {
                  setGithubVerificationError(`Please verify ownership of your GitHub account matching ${user.email} before continuing.`);
                  return;
                }
                setCurrentStep(4);
              }}
              disabled={!isGithubOAuthUser && !githubVerified}
              className="btn-brass text-xs sm:text-sm py-2 px-4 sm:px-5 flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>Continue to Summary</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ─── STEP 4: Readiness & First Challenge Preview ─────────────── */}
      {currentStep === 4 && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header */}
          <div className="text-center space-y-2 py-1">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-emerald-tint border border-emerald/30 mx-auto flex items-center justify-center text-emerald-text">
              <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-text-0">
              Ready to Build, {candidateDisplayName}!
            </h2>
            <p className="text-xs sm:text-sm text-text-1 max-w-md mx-auto leading-relaxed">
              Your workspace is calibrated for <strong className="text-text-0">{targetRole}</strong> in the{' '}
              <strong className="text-text-0">{currentTrackDef.title}</strong> track.
            </p>
          </div>

          {/* Overview Matrix */}
          <div className="p-3.5 sm:p-4 rounded-radius border border-line bg-ink-0/30 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-xs font-mono">
            <div>
              <span className="text-text-1 uppercase block text-[10px]">Track</span>
              <span className="font-semibold text-text-0 truncate block mt-0.5">
                {currentTrackDef.shortTitle}
              </span>
            </div>
            <div>
              <span className="text-text-1 uppercase block text-[10px]">Target Role</span>
              <span className="font-semibold text-text-0 truncate block mt-0.5">
                {targetRole}
              </span>
            </div>
            <div>
              <span className="text-text-1 uppercase block text-[10px]">Seniority</span>
              <span className="font-semibold text-text-0 capitalize block mt-0.5">
                {experienceLevel}
              </span>
            </div>
            <div>
              <span className="text-text-1 uppercase block text-[10px]">GitHub Identity</span>
              <span className="font-semibold text-emerald-text block mt-0.5 truncate">
                @{githubUsernameInput.replace(/^@/, '') || user.username || 'Linked'}
              </span>
            </div>
          </div>

          {/* Recommended Challenge Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono uppercase text-text-1">
              <span>Recommended First Challenge:</span>
              <span className="text-brass font-bold">Priority Dispatch</span>
            </div>
            <div className="p-3.5 sm:p-4 rounded-radius border border-brass/30 bg-ink-0/20 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-[11px] font-mono text-emerald-text uppercase font-semibold">
                  {tailoredProblem.domain} · {tailoredProblem.difficulty} · ~{tailoredProblem.estimatedHours} hrs
                </span>
                <span className="text-xs text-text-1 font-mono">
                  {tailoredProblem.submissionCount} proofs stamped
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-text-0">
                {tailoredProblem.title}
              </h3>
              <p className="text-xs sm:text-sm text-text-1 leading-relaxed">
                {tailoredProblem.tagline}
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tailoredProblem.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded text-[11px] font-mono bg-ink-0 text-text-1 border border-line"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Matched Job Opportunity */}
          <div className="p-3.5 rounded-radius border border-line bg-ink-0/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm">
            <div className="space-y-0.5">
              <span className="font-semibold text-text-0 block sm:inline">
                Target Match: {tailoredJob.title} at {tailoredJob.company}
              </span>
              <p className="text-text-1 text-xs font-mono">
                Comp: {tailoredJob.salary} · Verified Proofs Bypass Resume Filters
              </p>
            </div>
            <span className="text-emerald-text font-bold font-mono shrink-0">
              {tailoredJob.matchScore}% Match
            </span>
          </div>

            {/* Action Strip */}
            <div className="pt-4 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="btn-outline text-xs md:text-sm py-2 px-4 cursor-pointer text-text-1 w-full sm:w-auto font-mono"
              >
                ← Back to GitHub Link
              </button>

              <button
                type="button"
                onClick={handleFinishOnboarding}
                className="btn-brass text-xs md:text-sm py-2.5 px-6 flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto font-semibold font-mono"
              >
                <span>Launch DevLedgr Console</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
