/**
 * @file ILaunchpadService.ts
 * @description Contract for Launchpad challenge claims, build state management, and collaboration.
 */

import {
  LaunchpadProblem,
  ProblemStatus,
  ProblemClaimStatus,
  ProblemRecommendation,
  ExperienceLevel,
} from '@/types';

export interface LaunchpadFilters {
  status?: ProblemStatus;
  domain?: string;
  difficulty?: string;
  search?: string;
  /**
   * Moderator-only visibility filter. `'all'` returns drafts and published
   * problems together and requires the `seed_ideas` permission; without it the
   * backend pins the response to published problems and ignores this value.
   */
  approved?: 'true' | 'false' | 'all';
}

export interface ILaunchpadService {
  getProblems(filters?: LaunchpadFilters): Promise<LaunchpadProblem[]>;
  getProblemById(id: string): Promise<LaunchpadProblem | undefined>;
  /**
   * Ranks the problem bank against a developer. Pass `skills`/`level` from an
   * in-progress onboarding draft: the saved profile has no skills until
   * onboarding completes, so without them the ranking has nothing to work with.
   */
  getRecommendedProblems(input?: {
    skills?: string[];
    level?: ExperienceLevel;
    limit?: number;
  }): Promise<ProblemRecommendation | null>;
  claimProblem(problemId: string): Promise<ProblemClaimStatus>;
  getMyClaims(status?: ProblemStatus): Promise<LaunchpadProblem[]>;
  updateStatus(problemId: string, status: ProblemStatus): Promise<ProblemClaimStatus>;
  getStatus(problemId: string): Promise<ProblemClaimStatus>;
  /**
   * Publishes or unpublishes a problem (admin). Unlike `getProblems` this
   * surfaces a failed call to the caller, so a moderation action is never
   * reported as having succeeded when it did not.
   */
  setProblemApproval(id: string, approved: boolean): Promise<LaunchpadProblem>;
}
