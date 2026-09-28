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

export interface LaunchpadProblem extends IdeaItem {
  status: ProblemStatus;
  claimedBy?: DevRef;
  claimedAt?: string;
  statusUpdatedAt: string;
  completedAt?: string;
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
