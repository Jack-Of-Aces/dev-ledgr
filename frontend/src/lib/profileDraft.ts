/**
 * @file profileDraft.ts
 * @description Durable scratchpad for the settings form.
 *
 * The form is a long edit — name, headline, bio, skills, track, seniority,
 * GitHub handle — and every save is a single all-or-nothing request. When the
 * backend rejected one field, the whole save failed and the dev lost the lot.
 * The draft keeps their input in localStorage so a failed save, an accidental
 * navigation or a closed tab does not discard it.
 *
 * The draft is keyed by username so two accounts on one machine never read each
 * other's edits, and it is only cleared once the backend has confirmed the
 * write. It is deliberately not part of the zustand store: that store holds the
 * authoritative profile, and mirroring a draft into it is what made a rollback
 * overwrite the form in the first place.
 */

import type { EngineeringTrack, ExperienceLevel } from '@/types';

const DRAFT_KEY = 'devledgr_profile_draft_v1';

export interface ProfileDraft {
  name: string;
  headline: string;
  bio: string;
  avatarUrl: string;
  githubUrl: string;
  /** Recruiter contact address. Not the account's registered address. */
  contactEmail: string;
  plan: 'free' | 'full-service' | 'byok';
  statedSkills: string[];
  engineeringTrack: EngineeringTrack;
  targetRole: string;
  experienceLevel: ExperienceLevel;
  githubUsernameInput: string;
}

interface StoredDraft extends ProfileDraft {
  /** Handle the draft belongs to. Guards against a shared machine. */
  username: string;
}

function storage(): Storage | null {
  // Private browsing and some embedded webviews throw on access rather than
  // returning null, so the lookup itself is guarded.
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** readStoredDraft returns the draft for username, or null if there is none. */
export function readStoredDraft(username?: string): ProfileDraft | null {
  const store = storage();
  if (!store) return null;

  let parsed: StoredDraft;
  try {
    const raw = store.getItem(DRAFT_KEY);
    if (!raw) return null;
    parsed = JSON.parse(raw) as StoredDraft;
  } catch {
    // A corrupt or hand-edited entry is discarded rather than thrown on: the
    // form still works from the stored profile.
    store.removeItem(DRAFT_KEY);
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  if (username && parsed.username !== username) return null;
  if (typeof parsed.name !== 'string' || typeof parsed.headline !== 'string') {
    return null;
  }
  if (!Array.isArray(parsed.statedSkills)) return null;

  return {
    name: parsed.name,
    headline: parsed.headline,
    bio: typeof parsed.bio === 'string' ? parsed.bio : '',
    avatarUrl: typeof parsed.avatarUrl === 'string' ? parsed.avatarUrl : '',
    githubUrl: typeof parsed.githubUrl === 'string' ? parsed.githubUrl : '',
    contactEmail: typeof parsed.contactEmail === 'string' ? parsed.contactEmail : '',
    plan: parsed.plan ?? 'free',
    statedSkills: parsed.statedSkills.filter((s): s is string => typeof s === 'string'),
    engineeringTrack: parsed.engineeringTrack ?? 'backend-systems',
    targetRole: typeof parsed.targetRole === 'string' ? parsed.targetRole : '',
    experienceLevel: parsed.experienceLevel ?? 'junior',
    githubUsernameInput: typeof parsed.githubUsernameInput === 'string' ? parsed.githubUsernameInput : '',
  };
}

/**
 * hasStoredDraft reports whether a draft exists for username, without parsing
 * it. Pass the handle so a second account on the same machine does not read the
 * first one's edits.
 */
export function hasStoredDraft(username?: string): boolean {
  const store = storage();
  if (!store) return false;
  const raw = store.getItem(DRAFT_KEY);
  if (raw == null) return false;
  if (!username) return true;
  try {
    return (JSON.parse(raw) as StoredDraft).username === username;
  } catch {
    return false;
  }
}

/**
 * writeStoredDraft saves the form. Called on every change so the scratchpad
 * cannot fall behind the inputs.
 */
export function writeStoredDraft(draft: ProfileDraft, username: string): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(DRAFT_KEY, JSON.stringify({ ...draft, username } satisfies StoredDraft));
  } catch {
    // A full or disabled quota must not break typing.
  }
}

/** clearStoredDraft is called only after the backend confirms the save. */
export function clearStoredDraft(): void {
  try {
    storage()?.removeItem(DRAFT_KEY);
  } catch {
    // Nothing to do: the draft is best-effort.
  }
}
