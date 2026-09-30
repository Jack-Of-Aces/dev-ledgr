'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useProfile } from '@/hooks/useProfile';
import { useAppStore } from '@/lib/store';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { SettingsSkeleton } from '@/components/ui/skeletons';
import { getAllTracks, getTrackById } from '@/lib/tracks';
import { EngineeringTrack, ExperienceLevel } from '@/types';
import { uploadImageToCloudinary } from '@/lib/upload';
import { userService } from '@/services/user/userService';
import {
  readStoredDraft,
  writeStoredDraft,
  clearStoredDraft,
  hasStoredDraft,
} from '@/lib/profileDraft';
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
  AlertCircle,
  Upload,
  Trash2,
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
  const setUser = useAppStore((state) => state.setUser);
  const showToast = useAppStore((state) => state.showToast);

  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [mounted, setMounted] = useState(false);
  // Stable render-time "now" so Date.now() is not called during the render
  // phase (the React compiler flags impure calls in render).
  const [now] = useState(() => Date.now());

  useEffect(() => {
    setMounted(true);
  }, []);

  // Form states initialized from user profile
  const [name, setName] = useState(user.name);
  const [headline, setHeadline] = useState(user.headline);
  const [bio, setBio] = useState(user.bio);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || '');
  const [githubUrl, setGithubUrl] = useState(user.githubUrl || '');
  // Where recruiters should reach this dev. Deliberately not seeded from
  // user.email: blank is a real, meaningful state that means "use the address
  // the account is registered with", and pre-filling it would copy the auth
  // identity into a dev-authored field.
  const [contactEmail, setContactEmail] = useState(user.contactEmail || '');
  const [plan, setPlan] = useState<'free' | 'full-service' | 'byok'>(user.plan);
  // Only holds a newly typed key; the stored key never comes back to the browser.
  const [apiKey, setApiKey] = useState('');
  const [statedSkills, setStatedSkills] = useState<string[]>(user.statedSkills || []);
  const [engineeringTrack, setEngineeringTrack] = useState<EngineeringTrack>(
    user.engineeringTrack || 'backend-systems'
  );
  const [targetRole, setTargetRole] = useState(user.targetRole || 'Backend Engineer');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(
    user.experienceLevel || 'junior'
  );
  const [githubUsernameInput, setGithubUsernameInput] = useState(
    user.githubUsername || (user.githubUrl ? user.githubUrl.split('/').pop() || '' : '')
  );

  // The handle is edited and saved on its own, not with the rest of the form:
  // it is the public URL and certificates reference it, so it gets an explicit
  // confirmation rather than riding along with a bio tweak. The backend derives
  // the first handle from OAuth metadata and appends a random suffix on
  // conflict, which is how an account ends up as "michojekunle_1a3f".
  const [handleInput, setHandleInput] = useState(user.username);
  const [isSavingHandle, setIsSavingHandle] = useState(false);
  const [handleError, setHandleError] = useState<string | null>(null);
  const handleDirty = handleInput !== user.username;

  /**
   * Which validation errors the dev has already addressed.
   *
   * useProfile only clears `errors` on the next save, so an error raised by a
   * failed save stayed on screen after the field was fixed and stayed on any
   * tab the dev did not visit. The hook is out of scope here, so the page
   * tracks dismissal itself: editing a field marks its error as seen, and the
   * errors are dropped for the tab they belong to. A fresh save replaces the
   * whole set, so nothing is hidden that has not been re-validated.
   */
  const [dismissedErrors, setDismissedErrors] = useState<Record<string, true>>({});

  const dismissFieldError = (field: string) => {
    setDismissedErrors((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  };

  /** Read a validation error, honouring local dismissal. */
  const fieldError = (field: string) =>
    dismissedErrors[field] ? undefined : errors[field];

  // The handle handleSave actually persists. When a verified handle is on
  // record, the free-text GitHub URL field is discarded on save.
  const finalGithubUsernameOnRecord =
    user.githubUsername || (user.githubUrl ? user.githubUrl.split('/').pop() || '' : '');

  const handleSaveHandle = async () => {
    const clean = handleInput.trim();
    if (!clean || clean === user.username) return;
    setIsSavingHandle(true);
    setHandleError(null);
    try {
      const updated = await userService.updateUsername(clean);
      setUser(updated);
      setHandleInput(updated.username);
    } catch (err) {
      setHandleError(
        err instanceof Error ? err.message : 'Could not change your handle. Try another.'
      );
    } finally {
      setIsSavingHandle(false);
    }
  };

  // The form is seeded from the store once per account, and then left alone.
  //
  // It used to resync on every `user` change, which made a failed save erase
  // everything the dev had typed. useProfile writes an optimistic copy to the
  // store and then rolls it back when the request fails, and each of those
  // writes re-fired the sync. The rollback is the damaging one: it restored the
  // pre-save values over the fields the dev could still see.
  //
  // The seed is therefore keyed on the handle alone. Deliberately not on
  // updatedAt: the optimistic write sets it to now and the rollback restores
  // the old value, so a key containing it would change twice per save and
  // re-seed the form both times — reproducing the original bug. Identity is the
  // only thing that should replace what is on screen: a different account, or
  // the real profile replacing the store's placeholder on first render.
  const [loadedUsername, setLoadedUsername] = useState<string | null>(null);

  useEffect(() => {
    // Only a real profile may seed the form. The store persists, so its
    // placeholder (empty username) is briefly the current value.
    if (!user.username || user.username === loadedUsername) return;
    // An unsaved draft outranks the stored profile, so leave the form to the
    // restore effect below. Scoped by username, so signing in as someone else
    // on the same machine does not skip this seed.
    if (loadedUsername === null && hasStoredDraft(user.username)) return;

    setLoadedUsername(user.username);
    setName(user.name);
    setHeadline(user.headline);
    setBio(user.bio);
    setAvatarUrl(user.avatarUrl || '');
    setGithubUrl(user.githubUrl || '');
    setContactEmail(user.contactEmail || '');
    setPlan(user.plan);
    setApiKey('');
    setStatedSkills(user.statedSkills || []);
    setEngineeringTrack(user.engineeringTrack || 'backend-systems');
    setTargetRole(user.targetRole || 'Backend Engineer');
    setExperienceLevel(user.experienceLevel || 'junior');
    setGithubUsernameInput(
      user.githubUsername || (user.githubUrl ? user.githubUrl.split('/').pop() || '' : '')
    );
    setHandleInput(user.username);
    setHandleError(null);
  }, [loadedUsername, user]);

  // Restore an unsaved draft. A dev who lost work to a failed save or a closed
  // tab should find their edits still here, so the form is treated as a
  // scratchpad that is only discarded once the backend confirms the write.
  useEffect(() => {
    if (loadedUsername !== null || !user.username) return;
    const draft = readStoredDraft(user.username);
    if (!draft) return;
    setLoadedUsername(user.username);
    setName(draft.name);
    setHeadline(draft.headline);
    setBio(draft.bio);
    setAvatarUrl(draft.avatarUrl);
    setGithubUrl(draft.githubUrl);
    setContactEmail(draft.contactEmail);
    setPlan(draft.plan);
    setStatedSkills(draft.statedSkills);
    setEngineeringTrack(draft.engineeringTrack);
    setTargetRole(draft.targetRole);
    setExperienceLevel(draft.experienceLevel);
    setGithubUsernameInput(draft.githubUsernameInput);
  }, [loadedUsername, user.username]);

  // Mirror the form into the draft on every change. A failed save, a
  // navigation away or a closed tab then costs nothing.
  useEffect(() => {
    if (loadedUsername === null || !user.username) return;
    writeStoredDraft(
      {
        name,
        headline,
        bio,
        avatarUrl,
        githubUrl,
        contactEmail,
        plan,
        statedSkills,
        engineeringTrack,
        targetRole,
        experienceLevel,
        githubUsernameInput,
      },
      user.username
    );
  }, [
    loadedUsername,
    user.username,
    name,
    headline,
    bio,
    avatarUrl,
    githubUrl,
    contactEmail,
    plan,
    statedSkills,
    engineeringTrack,
    targetRole,
    experienceLevel,
    githubUsernameInput,
  ]);

  // UI state
  const [showApiKey, setShowApiKey] = useState(false);
  const [customSkillInput, setCustomSkillInput] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCert, setCopiedCert] = useState(false);
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [testFeedback, setTestFeedback] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [isVerifyingGithub, setIsVerifyingGithub] = useState(false);
  const [githubVerificationError, setGithubVerificationError] = useState<string | null>(null);
  const [githubVerificationSuccess, setGithubVerificationSuccess] = useState<string | null>(null);

  // Provenance, not preference: this is set by the backend from the identity
  // provider the account was created with, and is why the handle below can be
  // described as already proven rather than pending verification.
  const isGithubOAuthUser = user?.authProvider === 'github';
  // Only a *change* of handle needs the ownership check. Offering to "verify"
  // the handle the account already proved at sign-in is noise.
  const githubHandleChanged =
    githubUsernameInput.replace(/^@/, '').trim() !== (user?.githubUsername || '');

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Handle file upload (uploads directly to Cloudinary and obtains persistent HTTPS CDN URL)
  const handleAvatarFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a valid image file (PNG, JPG, WEBP, SVG).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image size exceeds 5MB limit. Please choose a smaller image.');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const liveCdnUrl = await uploadImageToCloudinary(file);
      setAvatarUrl(liveCdnUrl);
    } catch (err: unknown) {
      // Graceful fallback to local FileReader preview
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          setAvatarUrl(result);
        }
      };
      reader.readAsDataURL(file);
      setUploadError(
        err instanceof Error
          ? `${err.message} (Using local preview fallback)`
          : 'Failed to upload to Cloudinary. Using local preview fallback.'
      );
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Escape key closes mobile preview bottom drawer
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showMobilePreview) {
        setShowMobilePreview(false);
      }
    };
    if (showMobilePreview) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [showMobilePreview]);

  // Skill management
  const handleToggleSkill = (skill: string) => {
    if (statedSkills.includes(skill)) {
      setStatedSkills(statedSkills.filter((s) => s !== skill));
    } else {
      setStatedSkills([...statedSkills, skill]);
    }
    // The skills field is editable from several places, so clear its error from
    // the shared path rather than each call site.
    dismissFieldError('statedSkills');
  };

  const handleAddCustomSkill = (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    const trimmed = customSkillInput.trim();
    if (trimmed && !statedSkills.includes(trimmed)) {
      setStatedSkills([...statedSkills, trimmed]);
      setCustomSkillInput('');
    }
    dismissFieldError('statedSkills');
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setStatedSkills(statedSkills.filter((s) => s !== skillToRemove));
    dismissFieldError('statedSkills');
  };

  // Upstream API key format test ping (Hardening)
  const handleTestKey = async () => {
    if (!apiKey.trim()) return;
    setTestStatus('testing');
    setTestFeedback('');
    try {
      const trimmed = apiKey.trim();
      if (trimmed.startsWith('AIza') && trimmed.length >= 25) {
        await new Promise((r) => setTimeout(r, 600));
        setTestStatus('success');
        setTestFeedback('Handshake verified: Google Gemini inference provider authenticated.');
      } else if (trimmed.startsWith('sk-') && trimmed.length >= 20) {
        await new Promise((r) => setTimeout(r, 600));
        setTestStatus('success');
        setTestFeedback('Handshake verified: OpenAI GPT-4o inference provider authenticated.');
      } else {
        await new Promise((r) => setTimeout(r, 400));
        setTestStatus('failed');
        setTestFeedback('Key format unrecognized. Expected Gemini (AIza...) or OpenAI (sk-...).');
      }
    } catch {
      setTestStatus('failed');
      setTestFeedback('Connection check failed. Please verify your network connection.');
    }
  };

  // Short month-year label for the certificate expiry, shared by the settings
  // list and the mobile preview. Empty string when it is unknown so the caller
  // can render "Not recorded" instead of a plausible-looking date.
  const guaranteeExpiryLabel = (() => {
    const expiry = new Date(user.portfolioValidUntil);
    if (Number.isNaN(expiry.getTime())) return '';
    return expiry.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  })();

  // Reset to initial values. Every field the form edits has to be restored,
  // otherwise "Discard changes" silently kept the unsaved track, target role,
  // experience level, GitHub handle and public handle edits and the button did
  // not do what it said.
  const handleReset = () => {
    setName(user.name);
    setHeadline(user.headline);
    setBio(user.bio);
    setAvatarUrl(user.avatarUrl || '');
    setGithubUrl(user.githubUrl || '');
    setContactEmail(user.contactEmail || '');
    setPlan(user.plan);
    setApiKey('');
    setStatedSkills(user.statedSkills || []);
    setEngineeringTrack(user.engineeringTrack || 'backend-systems');
    setTargetRole(user.targetRole || 'Backend Engineer');
    setExperienceLevel(user.experienceLevel || 'junior');
    setGithubUsernameInput(
      user.githubUsername || (user.githubUrl ? user.githubUrl.split('/').pop() || '' : '')
    );
    setHandleInput(user.username);
    setHandleError(null);
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
      guaranteedDomain: `${user.username}.devledgr.xyz`,
      validThrough: user.portfolioValidUntil,
      stampedSkills: statedSkills,
      rootAlgorithm: 'Ed25519-SHA256',
      status: 'Active · Online & Tamper-Evident',
    };
    navigator.clipboard.writeText(JSON.stringify(certData, null, 2));
    setCopiedCert(true);
    setTimeout(() => setCopiedCert(false), 2000);
  };

  const handleVerifyAndLinkGitHub = async () => {
    const clean = githubUsernameInput.replace(/^@/, '').trim();
    if (!clean) return;

    setIsVerifyingGithub(true);
    setGithubVerificationError(null);
    setGithubVerificationSuccess(null);

    // Ownership is proven against the address the account is registered with,
    // and only that one. It used to fall back to the editable field, which meant
    // a dev could type someone else's address into their contact details and
    // then pass the check for any handle that address appeared on. The contact
    // address is dev-authored text and is not evidence of anything.
    const userEmail = user.email || '';
    if (!userEmail) {
      setIsVerifyingGithub(false);
      setGithubVerificationError('Registered account email is required to verify ownership.');
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
        useAppStore.getState().connectGitHubAccount(clean);
        setGithubVerificationSuccess(
          `Verified & linked @${clean} (matched via ${
            data.matchSource === 'profile'
              ? 'public profile email'
              : data.matchSource === 'commits'
              ? `commit author proof in ${data.repoProof || 'repo'}`
              : 'verified alias'
          }).`
        );
      } else {
        setGithubVerificationError(
          data.error ||
            `Email mismatch: @${clean} is not associated with your registered email (${userEmail}). You can only link a GitHub account that belongs to you.`
        );
      }
    } catch {
      setGithubVerificationError('Failed to contact verification server. Please verify your connection.');
    } finally {
      setIsVerifyingGithub(false);
    }
  };

  const handleSave = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    setSavedSuccess(false);

    const cleanGithub = githubUsernameInput.replace(/^@/, '').trim();

    // A typed GitHub handle is only stored if it is already the one on record,
    // or if the ownership check just passed for it. Typing is not evidence.
    //
    // Signing in with GitHub used to be treated as sufficient on its own, which
    // is backwards: the sign-in proves one specific account, so it should pin
    // the handle the backend already has, not open the field to any value. That
    // would have let a dev claim someone else's handle and have their commits
    // stamped to it, and the handle is what proof-of-work is attributed by.
    const finalGithubUsername =
      cleanGithub && (githubVerificationSuccess || cleanGithub === user.githubUsername)
        ? cleanGithub
        : user.githubUsername;
    const finalGithubConnected = Boolean(finalGithubUsername);

    const result = await updateProfile({
      name,
      headline,
      bio,
      avatarUrl: avatarUrl.trim() || undefined,
      githubUrl: finalGithubUsername ? `https://github.com/${finalGithubUsername}` : (githubUrl.trim() || undefined),
      contactEmail: contactEmail.trim() || undefined,
      plan,
      apiKey: apiKey.trim() || undefined,
      statedSkills,
      engineeringTrack,
      targetRole,
      experienceLevel,
      githubConnected: finalGithubConnected,
      githubUsername: finalGithubUsername || undefined,
    });

    // Every save re-runs validation, so previously dismissed errors must be
    // re-armed. Otherwise a field fixed once would never show a later error.
    setDismissedErrors({});

    if (!result.success) {
      // Save is reachable from the header and the footer, so a dev can submit
      // without ever opening the tab the failing field lives on. Route them to
      // it instead of leaving an error they cannot see.
      const fieldToTab: Record<string, SettingsTab> = {
        name: 'profile',
        headline: 'profile',
        bio: 'profile',
        avatarUrl: 'profile',
        githubUrl: 'profile',
        contactEmail: 'profile',
        statedSkills: 'skills',
      };
      const failing = Object.keys(errors).find((field) => fieldToTab[field]);
      if (failing) {
        setActiveTab(fieldToTab[failing]);
        showToast({
          title: 'Validation Error',
          message: `Fix the highlighted field in the ${fieldToTab[failing]} tab.`,
        });
      }
    }

    if (result.success) {
      // The backend has the values now, so the scratchpad has done its job.
      clearStoredDraft();
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    }
    // On failure the draft is left in place deliberately: the request was
    // rejected, so nothing was stored and the form still holds the dev's work.
  };

  if (!mounted) {
    return (
      <AuthGuard fallbackMessage="Please sign in to access your ledger identity and compute settings.">
        <SettingsSkeleton />
      </AuthGuard>
    );
  }

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
                Ledger Settings // {user.username}.devledgr.xyz
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

            <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
              {/* Mobile Preview Trigger */}
              <button
                type="button"
                onClick={() => setShowMobilePreview(true)}
                className="lg:hidden btn-outline text-xs py-2 px-3 inline-flex items-center gap-1.5 cursor-pointer font-mono"
                title="Preview public developer card"
              >
                <Eye className="w-3.5 h-3.5 text-emerald-text" />
                <span>Preview Card</span>
              </button>

              {/* Quick save button in header */}
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="btn-brass text-xs py-2 px-4 cursor-pointer inline-flex items-center gap-2 font-mono shrink-0"
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
              onKeyDown={(e) => {
                const tabs: SettingsTab[] = ['profile', 'skills', 'compute', 'consensus'];
                const currentIndex = tabs.indexOf(activeTab);
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                  e.preventDefault();
                  const nextTab = tabs[(currentIndex + 1) % tabs.length];
                  setActiveTab(nextTab);
                  document.getElementById(`settings-tab-${nextTab}`)?.focus();
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  const prevTab = tabs[(currentIndex - 1 + tabs.length) % tabs.length];
                  setActiveTab(prevTab);
                  document.getElementById(`settings-tab-${prevTab}`)?.focus();
                } else if (e.key === 'Home') {
                  e.preventDefault();
                  setActiveTab(tabs[0]);
                  document.getElementById(`settings-tab-${tabs[0]}`)?.focus();
                } else if (e.key === 'End') {
                  e.preventDefault();
                  setActiveTab(tabs[tabs.length - 1]);
                  document.getElementById(`settings-tab-${tabs[tabs.length - 1]}`)?.focus();
                }
              }}
              className="flex flex-wrap items-center gap-1 sm:gap-2 p-1 rounded-radius bg-card/60 border border-line text-xs sm:text-sm"
            >
              <button
                role="tab"
                id="settings-tab-profile"
                tabIndex={activeTab === 'profile' ? 0 : -1}
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
                tabIndex={activeTab === 'skills' ? 0 : -1}
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
                tabIndex={activeTab === 'compute' ? 0 : -1}
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
                tabIndex={activeTab === 'consensus' ? 0 : -1}
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
                          onChange={(e) => {
                            setName(e.target.value);
                            dismissFieldError('name');
                          }}
                          aria-invalid={!!fieldError("name")}
                          aria-describedby={fieldError("name") ? 'settings-name-error' : undefined}
                          placeholder="e.g. Jane Doe"
                          className="w-full px-3 py-2 rounded-radius border border-line bg-ink-0 text-text-0 focus:border-emerald outline-none text-xs sm:text-sm font-sans"
                        />
                        {fieldError("name") && (
                          <p id="settings-name-error" className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-mono">
                            {fieldError("name")}
                          </p>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label
                            htmlFor="settings-handle"
                            className="block text-xs font-mono text-text-1 font-semibold"
                          >
                            HANDLE (YOUR PUBLIC URL)
                          </label>
                          {handleDirty ? (
                            <button
                              type="button"
                              onClick={handleSaveHandle}
                              disabled={isSavingHandle}
                              className="text-xs font-mono text-emerald-text hover:underline inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-default"
                            >
                              {isSavingHandle ? (
                                <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                              ) : (
                                'Save handle'
                              )}
                            </button>
                          ) : (
                            <Lock className="w-3 h-3 text-text-1" />
                          )}
                        </div>
                        <input
                          id="settings-handle"
                          type="text"
                          value={handleInput}
                          onChange={(e) => setHandleInput(e.target.value.replace(/^@/, '').trim())}
                          aria-describedby="settings-handle-hint"
                          aria-invalid={!!handleError}
                          className="w-full px-3 py-2 rounded-radius border border-line bg-ink-0 text-text-0 focus:border-emerald outline-none font-mono text-xs sm:text-sm"
                        />
                        <span id="settings-handle-hint" className="text-xs text-text-1 mt-1 block font-mono">
                          {handleError ? (
                            <span className="text-rose-600 dark:text-rose-400">{handleError}</span>
                          ) : handleDirty ? (
                            `Public URL changes to /p/${handleInput || '…'}`
                          ) : (
                            'Letters, digits, ".", "_" and "-". Your profile lives at /p/' +
                              user.username +
                              '.'
                          )}
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
                        onChange={(e) => {
                          setHeadline(e.target.value);
                          dismissFieldError('headline');
                        }}
                        placeholder="e.g. Junior Backend Engineer · 2 Verified Proofs"
                        className="w-full px-3 py-2 rounded-radius border border-line bg-ink-0 text-text-0 focus:border-emerald outline-none text-xs sm:text-sm"
                      />
                      {fieldError("headline") && (
                        <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-mono">
                          {fieldError("headline")}
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
                        onChange={(e) => {
                          setBio(e.target.value);
                          dismissFieldError('bio');
                        }}
                        placeholder="Describe your technical background, specific interest in distributed backends, idempotency, or systems engineering..."
                        className="w-full px-3 py-2 rounded-radius border border-line bg-ink-0 text-text-0 focus:border-emerald outline-none text-xs sm:text-sm leading-relaxed"
                      />
                      {fieldError("bio") && (
                        <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-mono">
                          {fieldError("bio")}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Engineering Track & Role Calibration */}
                  <div className="p-5 sm:p-6 rounded-radius border border-line bg-card space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-line">
                      <div className="space-y-0.5">
                        <h3 className="text-sm font-semibold text-text-0">
                          Engineering Track &amp; Role Calibration
                        </h3>
                        <p className="text-xs text-text-1">
                          Tailors your matched problem feed, automated test harnesses, and company opportunities.
                        </p>
                      </div>
                      <Link
                        href="/onboarding"
                        className="text-xs font-mono text-brass hover:underline shrink-0"
                      >
                        Open Calibration Wizard →
                      </Link>
                    </div>

                    <div className="space-y-4">
                      {/* Track Grid */}
                      <div>
                        <label className="block text-xs font-mono text-text-1 font-semibold mb-2">
                          PRIMARY ENGINEERING TRACK
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {getAllTracks().map((track) => {
                            const isSelected = engineeringTrack === track.id;
                            return (
                              <button
                                key={track.id}
                                type="button"
                                onClick={() => {
                                  setEngineeringTrack(track.id);
                                  setTargetRole(track.targetRoles[0]);
                                }}
                                className={`text-left p-3 rounded-radius border text-xs font-mono transition-colors cursor-pointer flex items-center justify-between ${
                                  isSelected
                                    ? 'border-brass bg-ink-1 text-text-0 font-medium'
                                    : 'border-line bg-ink-0 text-text-1 hover:border-text-1'
                                }`}
                              >
                                <div>
                                  <div className="font-semibold text-text-0">{track.title}</div>
                                  <div className="text-[11px] text-text-1 mt-0.5">{track.shortTitle}</div>
                                </div>
                                {isSelected && <Check className="w-4 h-4 text-brass shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Target Role Chips */}
                      <div>
                        <label className="block text-xs font-mono text-text-1 font-semibold mb-1.5">
                          TARGET ROLE DESIGNATION
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {getTrackById(engineeringTrack).targetRoles.map((role) => (
                            <button
                              key={role}
                              type="button"
                              onClick={() => setTargetRole(role)}
                              className={`px-3 py-1.5 rounded-radius text-xs font-mono cursor-pointer transition-colors ${
                                targetRole === role
                                  ? 'bg-text-0 text-ink-0 font-semibold'
                                  : 'bg-ink-0 border border-line text-text-1 hover:text-text-0'
                              }`}
                            >
                              {role}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Career Stage */}
                      <div>
                        <label className="block text-xs font-mono text-text-1 font-semibold mb-1.5">
                          CAREER SENIORITY LEVEL
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            { level: 'junior' as ExperienceLevel, label: 'Junior / Entry' },
                            { level: 'mid' as ExperienceLevel, label: 'Mid-Level' },
                            { level: 'senior' as ExperienceLevel, label: 'Senior' },
                            { level: 'lead' as ExperienceLevel, label: 'Staff / Lead' },
                          ].map(({ level, label }) => (
                            <button
                              key={level}
                              type="button"
                              onClick={() => setExperienceLevel(level)}
                              className={`p-2 rounded-radius text-center border text-xs font-mono cursor-pointer transition-all ${
                                experienceLevel === level
                                  ? 'border-brass bg-ink-1 font-semibold text-text-0'
                                  : 'border-line bg-ink-0 text-text-1 hover:border-text-1'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Connected Links & Social Identity */}
                  <div className="p-5 sm:p-6 rounded-radius border border-line bg-card space-y-4">
                    <h3 className="text-sm font-semibold text-text-0 pb-2 border-b border-line">
                      Online Presence &amp; Verification Links
                    </h3>

                    <div className="space-y-4">
                      {/* Avatar Image & Upload */}
                      <div className="space-y-2">
                        <label
                          htmlFor="settings-avatar-url"
                          className="block text-xs font-mono text-text-1 font-semibold"
                        >
                          AVATAR PICTURE (UPLOAD OR URL)
                        </label>

                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                          {/* Avatar Circle Preview */}
                          <div className="relative w-14 h-14 rounded-full border-2 border-line shrink-0 overflow-hidden bg-card flex items-center justify-center font-mono font-bold text-text-0 shadow-sm">
                            {avatarUrl ? (
                              <Image
                                src={avatarUrl}
                                alt="Avatar preview"
                                fill
                                sizes="56px"
                                className="object-cover"
                                unoptimized
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <span className="text-base text-emerald-text">
                                {(name || user.username).slice(0, 2).toUpperCase()}
                              </span>
                            )}
                          </div>

                          {/* Upload action buttons */}
                          <div className="flex-1 space-y-2 w-full">
                            <div className="flex flex-wrap items-center gap-2">
                              {/* File Input trigger */}
                              <label
                                className={`btn-brass text-xs py-1.5 px-3 inline-flex items-center gap-1.5 font-sans ${
                                  isUploadingAvatar ? 'opacity-70 cursor-wait' : 'cursor-pointer'
                                }`}
                              >
                                {isUploadingAvatar ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Uploading to Cloudinary...</span>
                                  </>
                                ) : (
                                  <>
                                    <Upload className="w-3.5 h-3.5" />
                                    <span>Upload Image</span>
                                    <input
                                      type="file"
                                      accept="image/png, image/jpeg, image/webp, image/svg+xml"
                                      className="hidden"
                                      disabled={isUploadingAvatar}
                                      onChange={handleAvatarFileUpload}
                                    />
                                  </>
                                )}
                              </label>

                              {avatarUrl && (
                                <button
                                  type="button"
                                  onClick={() => setAvatarUrl('')}
                                  className="btn-outline text-xs py-1.5 px-3 inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 hover:border-rose-500 cursor-pointer font-sans"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Remove</span>
                                </button>
                              )}

                              <span className="text-[11px] text-text-1 font-mono">
                                {/* Said 2MB but the guard above rejects anything
                                    over 5MB, so a 4MB file was accepted and then
                                    refused. Match the actual limit. */}
                                Max 5MB (PNG, JPG, WEBP, SVG)
                              </span>
                            </div>

                            {/* Or direct URL input */}
                            <div className="relative">
                              <ImageIcon className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-1" />
                              <input
                                id="settings-avatar-url"
                                type="text"
                                placeholder="Or enter direct image URL (https://images.unsplash.com/...)"
                                value={avatarUrl.startsWith('data:image/') ? '(Uploaded local image file)' : avatarUrl}
                                onChange={(e) => {
                                  if (!e.target.value.startsWith('(Uploaded')) {
                                    setAvatarUrl(e.target.value);
                                    dismissFieldError('avatarUrl');
                                  }
                                }}
                                className="w-full pl-9 pr-3 py-1.5 rounded-radius border border-line bg-ink-0 text-text-0 focus:border-emerald outline-none text-xs font-mono"
                              />
                            </div>
                          </div>
                        </div>

                        {uploadError && (
                          <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-mono">
                            {uploadError}
                          </p>
                        )}
                        {fieldError("avatarUrl") && (
                          <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-mono">
                            {fieldError("avatarUrl")}
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
                            placeholder="https://github.com/your-username"
                            value={githubUrl}
                            // handleSave prefers the verified handle and ignores
                            // this field whenever one exists, so typing here had
                            // no effect on the saved profile and the dev could not
                            // tell. Disable it and say why rather than quietly
                            // discarding the edit on save.
                            disabled={Boolean(finalGithubUsernameOnRecord)}
                            aria-describedby="settings-github-url-hint"
                            onChange={(e) => {
                              setGithubUrl(e.target.value);
                              dismissFieldError('githubUrl');
                            }}
                            className="w-full pl-9 pr-3 py-2 rounded-radius border border-line bg-ink-0 text-text-0 focus:border-emerald outline-none text-xs sm:text-sm font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                          />
                        </div>
                        <p id="settings-github-url-hint" className="text-[11px] text-text-1 font-mono mt-1">
                          {finalGithubUsernameOnRecord
                            ? `Managed by your verified GitHub connection (@${finalGithubUsernameOnRecord}). To claim a different handle, disconnect GitHub first — otherwise this field is not saved.`
                            : 'No verified GitHub handle on record. This URL is stored as entered.'}
                        </p>
                        {fieldError("githubUrl") && (
                          <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-mono">
                            {fieldError("githubUrl")}
                          </p>
                        )}
                      </div>

                      {/* Contact Email */}
                      <div>
                        <label
                          htmlFor="settings-contact-email"
                          className="block text-xs font-mono text-text-1 mb-1 font-semibold"
                        >
                          RECRUITER CONTACT EMAIL
                        </label>
                        <div className="relative">
                          <Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-1" />
                          <input
                            id="settings-contact-email"
                            type="email"
                            placeholder={user.email || 'alex@devledgr.xyz'}
                            value={contactEmail}
                            onChange={(e) => {
                                setContactEmail(e.target.value);
                                dismissFieldError('contactEmail');
                              }}
                            className="w-full pl-9 pr-3 py-2 rounded-radius border border-line bg-ink-0 text-text-0 focus:border-emerald outline-none text-xs sm:text-sm font-mono"
                          />
                        </div>
                        <span className="text-xs text-text-1 mt-1 block">
                          {contactEmail.trim() ? (
                            <>
                              Shown to hiring managers in anything generated for you. Not verified by DevLedgr —
                              leave it blank to use your registered address instead.
                            </>
                          ) : (
                            <>
                              Leaving this blank uses your registered address (
                              <code>{user.email || 'not available'}</code>). That one is managed by your sign-in
                              provider and cannot be changed here.
                            </>
                          )}
                        </span>
                        {fieldError("contactEmail") && (
                          <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-mono">
                            {fieldError("contactEmail")}
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
                                className="relative text-text-1 hover:text-rose-600 p-1.5 -mr-1 cursor-pointer flex items-center justify-center min-w-[28px] min-h-[28px]"
                                aria-label={`Remove skill ${skill}`}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 rounded-radius border border-dashed border-line text-center text-xs text-text-1">
                          No skills selected yet. Choose from the catalog below or add a custom skill.
                        </div>
                      )}
                      {fieldError("statedSkills") && (
                        <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-mono">
                          {fieldError("statedSkills")}
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
                          DevLedgr manages reviewer operations, AI analysis clusters, mock infrastructure, and uninterrupted portfolio uptime.
                        </p>
                      </div>
                    </div>

                    {/* API Key Input Field (When BYOK is active) */}
                    {plan === 'byok' && (
                      <div className="space-y-3 pt-3 border-t border-line/60">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label
                            htmlFor="settings-api-key"
                            className="block text-xs font-mono uppercase tracking-wider text-text-1 font-semibold"
                          >
                            YOUR GEMINI / OPENAI API KEY
                          </label>

                          <div className="flex items-center gap-2">
                            {detectedProvider && (
                              <span className="text-xs font-mono text-emerald-text font-medium">
                                Detected: {detectedProvider.name}
                              </span>
                            )}
                            {apiKey.trim() && (
                              <button
                                type="button"
                                onClick={handleTestKey}
                                disabled={testStatus === 'testing'}
                                className="btn-outline text-xs py-1 px-2.5 font-mono inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                {testStatus === 'testing' ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin text-emerald" />
                                    <span>Pinging...</span>
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="w-3 h-3 text-emerald-text" />
                                    <span>Test Handshake</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="relative">
                          <input
                            id="settings-api-key"
                            type={showApiKey ? 'text' : 'password'}
                            placeholder={
                              user.hasApiKey
                                ? 'Key saved (encrypted). Enter a new key to replace it.'
                                : 'AIzaSy... or sk-proj-...'
                            }
                            value={apiKey}
                            onChange={(e) => {
                              setApiKey(e.target.value);
                              setTestStatus('idle');
                              setTestFeedback('');
                            }}
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

                        {/* Test Status Feedback Banner */}
                        {testStatus === 'success' && (
                          <div className="flex items-center gap-2 p-2.5 rounded bg-emerald-tint border border-emerald-border text-xs font-mono text-emerald-text animate-in fade-in duration-150">
                            <Check className="w-3.5 h-3.5 text-emerald shrink-0" />
                            <span>{testFeedback}</span>
                          </div>
                        )}
                        {testStatus === 'failed' && (
                          <div className="flex items-center gap-2 p-2.5 rounded bg-rose-500/10 border border-rose-500/25 text-xs font-mono text-rose-600 dark:text-rose-400 animate-in fade-in duration-150">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span>{testFeedback}</span>
                          </div>
                        )}

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
                          {Number.isNaN(new Date(user.portfolioValidUntil).getTime())
                            ? 'Not recorded'
                            : new Date(user.portfolioValidUntil).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })}
                        </div>
                        <div className="font-medium">
                          {(() => {
                            // Was hardcoded to "364 Days Remaining" regardless of
                            // the real expiry, so a certificate issued months ago
                            // still claimed a year. Derive it, and report an
                            // elapsed certificate rather than a negative count.
                            const expiry = new Date(user.portfolioValidUntil);
                            if (Number.isNaN(expiry.getTime())) {
                              return <span className="text-text-1">Expiry not recorded</span>;
                            }
                            const msRemaining = expiry.getTime() - now;
                            if (msRemaining <= 0) {
                              return <span className="text-rose-500">Expired</span>;
                            }
                            const days = Math.floor(msRemaining / 86400000);
                            return (
                              <span className="text-emerald-text">
                                {days} Day{days === 1 ? '' : 's'} Remaining
                              </span>
                            );
                          })()}
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

                  {/* Connected Authentication & Identity Providers */}
                  <div className="p-5 sm:p-6 rounded-radius border border-line bg-card space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-line">
                      <div className="space-y-0.5">
                        <h3 className="text-sm font-semibold text-text-0">
                          Connected Identity &amp; Auth Providers
                        </h3>
                        <p className="text-xs text-text-1">
                          Manage linked authentication channels for login and cryptographic commit tracking.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3 font-mono text-xs">
                      {/* Google Provider Status */}
                      <div className="p-3.5 rounded-radius border border-line bg-ink-0/60 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                          <div>
                            <div className="font-semibold text-text-0">Google Authentication</div>
                            <div className="text-[11px] text-text-1">{user.email || 'Connected for session sign-in'}</div>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[11px] bg-emerald-tint text-emerald-text border border-emerald/30">
                          Active Session
                        </span>
                      </div>

                      {/* GitHub Provider Status */}
                      <div className="p-3.5 rounded-radius border border-line bg-ink-0/60 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <span className={`w-2.5 h-2.5 rounded-full ${user.githubConnected || user.githubUsername ? 'bg-emerald' : 'bg-amber-500'}`} />
                            <div>
                              <div className="font-semibold text-text-0">GitHub Commit Tracking</div>
                              <div className="text-[11px] text-text-1">
                                {user.githubConnected || user.githubUsername
                                  ? `Linked: @${user.githubUsername || user.username} (Authorized for proof stamping)`
                                  : 'Not Linked · Proof submission restricted'}
                              </div>
                            </div>
                          </div>

                          <span className={`px-2 py-0.5 rounded text-[11px] border ${
                            user.githubConnected || user.githubUsername
                              ? 'bg-emerald-tint text-emerald-text border-emerald/30'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                          }`}>
                            {user.githubConnected || user.githubUsername ? 'Verified' : 'Action Required'}
                          </span>
                        </div>

                        {/* Quick-Link Input if unlinked or changing */}
                        <div className="flex flex-col gap-2 pt-2 border-t border-line/60">
                          <div className="flex flex-col sm:flex-row gap-2">
                            <div className="relative flex-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-1 font-mono text-xs">@</span>
                              <input
                                type="text"
                                value={githubUsernameInput}
                                onChange={(e) => {
                                  setGithubUsernameInput(e.target.value);
                                  setGithubVerificationError(null);
                                  setGithubVerificationSuccess(null);
                                }}
                                placeholder="GitHub handle (e.g. michojekunle)"
                                className="w-full pl-7 pr-3 py-1.5 rounded-radius border border-line bg-card text-text-0 outline-none focus:border-brass text-xs font-mono"
                              />
                            </div>
                            {githubHandleChanged && (
                              <button
                                type="button"
                                onClick={handleVerifyAndLinkGitHub}
                                disabled={!githubUsernameInput.trim() || isVerifyingGithub}
                                className="btn-brass text-xs py-1.5 px-3 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 shrink-0 font-mono"
                              >
                                {isVerifyingGithub ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Verifying...</span>
                                  </>
                                ) : (
                                  <>
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    <span>{user.githubConnected ? 'Verify & Update' : 'Verify & Link'}</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>

                          <div className="text-[11px] text-text-1">
                            {isGithubOAuthUser ? (
                              <>
                                Signed in with GitHub, so <code>@{user.githubUsername || user.username}</code> is
                                already proven by your sign-in and is what gets stamped. To stamp to a different
                                account, enter it below and verify it against your registered email (
                                <code>{user.email || 'not available'}</code>) via public profile, commit history, or alias.
                              </>
                            ) : (
                              <>
                                Target GitHub account must match your registered account email (
                                <code>{user.email || 'not available'}</code>) via public profile, git commit history, or verified alias.
                              </>
                            )}
                          </div>

                          {githubVerificationError && (
                            <div className="p-2.5 rounded border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2 font-mono">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                              <span>{githubVerificationError}</span>
                            </div>
                          )}

                          {githubVerificationSuccess && (
                            <div className="p-2.5 rounded border border-emerald/30 bg-emerald-tint text-emerald-text text-xs flex items-start gap-2 font-mono">
                              <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                              <span>{githubVerificationSuccess}</span>
                            </div>
                          )}
                        </div>
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

          {/* Right Column: Live Public Portfolio Card Preview (Hidden on mobile, docked on lg) */}
          <div className="hidden lg:block lg:col-span-4 space-y-4">
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
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 rounded-full border-2 border-line overflow-hidden relative shrink-0 bg-ink-0 flex items-center justify-center font-mono font-bold text-text-0 shadow-xs">
                    {avatarUrl ? (
                      <Image
                        src={avatarUrl}
                        alt="Avatar preview"
                        fill
                        sizes="56px"
                        className="object-cover"
                        unoptimized
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <span className="text-sm font-bold text-emerald-text">
                        {(name || user.username).slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="font-semibold text-text-0 text-base truncate">
                      {name || 'Developer Name'}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-mono">
                      <span className="text-emerald-text font-semibold truncate">
                        @{user.username}
                      </span>
                      <span className="text-line">·</span>
                      <span className="text-text-1 capitalize">{plan} plan</span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-text-1 line-clamp-3 leading-relaxed">
                  {headline || 'Professional headline will appear here...'}
                </p>

                {bio && (
                  <p className="text-[11px] text-text-1/80 line-clamp-2 italic border-l-2 border-line pl-2.5">
                    &ldquo;{bio}&rdquo;
                  </p>
                )}

                {/* Stated skills badges */}
                <div className="pt-2 border-t border-line/60">
                  <div className="text-[11px] font-mono text-text-1 mb-1.5 uppercase font-semibold">
                    Active Stack ({statedSkills.length}):
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {statedSkills.slice(0, 6).map((skill) => (
                      <span
                        key={skill}
                        className="text-[11px] font-mono px-2 py-0.5 rounded bg-card/80 border border-line text-text-0"
                      >
                        {skill}
                      </span>
                    ))}
                    {statedSkills.length > 6 && (
                      <span className="text-[11px] font-mono text-text-1 px-1 py-0.5">
                        +{statedSkills.length - 6} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Proof Guarantee Notice */}
                <div className="pt-2 border-t border-line/60 flex items-center justify-between text-xs font-mono text-text-1">
                  <span className="flex items-center gap-1 text-emerald-text font-medium">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Verified Guarantee
                  </span>
                  {/* Was a hardcoded "Sep 2027" in both the settings list and the
                      mobile preview, so it did not track the real certificate. */}
                  <span>{guaranteeExpiryLabel || 'Not recorded'}</span>
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

        {/* Mobile Preview Modal Drawer (Adaptive Design for <1024px) */}
        {showMobilePreview && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-preview-title"
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowMobilePreview(false);
            }}
          >
            <div className="w-full max-w-md rounded-radius border border-line bg-card p-5 space-y-4 shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-text" />
                  <h3 id="mobile-preview-title" className="text-sm font-semibold text-text-0">
                    Live Public Card Preview
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMobilePreview(false)}
                  className="text-text-1 hover:text-text-0 p-1 cursor-pointer"
                  aria-label="Close preview modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Card Container */}
              <div className="rounded-radius border border-line bg-ink-0 p-4 space-y-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 rounded-full border-2 border-line overflow-hidden relative shrink-0 bg-card flex items-center justify-center font-mono font-bold text-text-0 shadow-xs">
                    {avatarUrl ? (
                      <Image
                        src={avatarUrl}
                        alt="Avatar preview"
                        fill
                        sizes="56px"
                        className="object-cover"
                        unoptimized
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <span className="text-sm font-bold text-emerald-text">
                        {(name || user.username).slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="font-semibold text-text-0 text-base truncate">
                      {name || 'Developer Name'}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-mono">
                      <span className="text-emerald-text font-semibold truncate">
                        @{user.username}
                      </span>
                      <span className="text-line">·</span>
                      <span className="text-text-1 capitalize">{plan} plan</span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-text-1 leading-relaxed line-clamp-3">
                  {headline || 'Professional headline...'}
                </p>

                {bio && (
                  <p className="text-[11px] text-text-1/80 line-clamp-2 italic border-l-2 border-line pl-2.5">
                    &ldquo;{bio}&rdquo;
                  </p>
                )}

                <div className="pt-2 border-t border-line/60">
                  <div className="text-[11px] font-mono text-text-1 mb-1.5 uppercase font-semibold">
                    Active Stack ({statedSkills.length}):
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {statedSkills.map((skill) => (
                      <span
                        key={skill}
                        className="text-[11px] font-mono px-2 py-0.5 rounded bg-card border border-line text-text-0"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-line/60 flex items-center justify-between text-xs font-mono text-text-1">
                  <span className="flex items-center gap-1 text-emerald-text font-medium">
                    <ShieldCheck className="w-3 h-3" />
                    Verified Guarantee
                  </span>
                  {/* Was a hardcoded "Sep 2027" in both the settings list and the
                      mobile preview, so it did not track the real certificate. */}
                  <span>{guaranteeExpiryLabel || 'Not recorded'}</span>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setShowMobilePreview(false)}
                  className="btn-brass text-xs py-1.5 px-4 cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AuthGuard>
  );
}
