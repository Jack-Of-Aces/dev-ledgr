/**
 * @file ILaunchpadService.ts
 * @description Contract for Launchpad challenge claims, build state management, and collaboration.
 */

import {
  LaunchpadProblem,
  ProblemStatus,
  ProblemClaimStatus,
} from '@/types';

export interface LaunchpadFilters {
  status?: ProblemStatus;
  domain?: string;
  difficulty?: string;
  search?: string;
}

export interface ILaunchpadService {
  getProblems(filters?: LaunchpadFilters): Promise<LaunchpadProblem[]>;
  getProblemById(id: string): Promise<LaunchpadProblem | undefined>;
  claimProblem(problemId: string): Promise<ProblemClaimStatus>;
  getMyClaims(status?: ProblemStatus): Promise<LaunchpadProblem[]>;
  updateStatus(problemId: string, status: ProblemStatus): Promise<ProblemClaimStatus>;
  getStatus(problemId: string): Promise<ProblemClaimStatus>;
}
