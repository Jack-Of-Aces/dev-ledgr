/**
 * @file launchpad.ts
 * @description Types for Launchpad challenge claims, build statuses, and collaboration.
 * Aligns with backend/internal/model/model.go Launchpad contracts.
 */

import { IdeaItem } from './index';

export type ProblemStatus =
  | 'open'
  | 'in_progress'
  | 'seeking_contributors'
  | 'complete';

export interface DevRef {
  username: string;
  name: string;
  avatarUrl: string;
}

/**
 * How well a problem fits a developer, as scored by the backend. `score` is
 * skill overlap (0-100); `difficultyFit` (0-10) is the seniority-vs-difficulty
 * nudge and is only meaningful for ranking.
 */
export interface IdeaMatch {
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
  difficultyFit: number;
}

export interface LaunchpadProblem extends IdeaItem {
  status: ProblemStatus;
  suggestedStack?: string[];
  regionalHurdles?: string;
  sourceUrl?: string;
  adminApproved?: boolean;
  createdAt?: string;
  /** Present on /api/launchpad/problems/recommended, absent on the plain list. */
  match?: IdeaMatch;
  claimedBy?: DevRef;
  claimedAt?: string;
  statusUpdatedAt: string;
  completedAt?: string;
}

/** One entry of GET /api/launchpad/problems/recommended. */
export interface ProblemRecommendation {
  problems: LaunchpadProblem[];
  total: number;
  personalized: boolean;
  devSkills: string[];
}

export interface ProblemClaimStatus {
  problemId: string;
  status: ProblemStatus;
  claimedBy?: DevRef;
  claimedAt?: string;
  statusUpdatedAt: string;
  completedAt?: string;
}

export interface ClaimProblemRequest {
  problemId: string;
}

export interface UpdateProblemStatusRequest {
  problemId: string;
  status: ProblemStatus;
}
