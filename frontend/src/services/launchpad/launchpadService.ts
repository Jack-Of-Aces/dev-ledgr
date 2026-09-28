/**
 * @file launchpadService.ts
 * @description Primary Launchpad Service connecting to Go backend (/api/launchpad/*).
 * Adheres to ADR-001: Graceful fallback on read; strict error propagation on write.
 */

import { ILaunchpadService, LaunchpadFilters } from './ILaunchpadService';
import { mockLaunchpadService } from './mockLaunchpadService';
import {
  LaunchpadProblem,
  ProblemStatus,
  ProblemClaimStatus,
  ProblemRecommendation,
  ExperienceLevel,
} from '@/types';
import { envConfig } from '@/lib/config';
import { defaultHttpClient } from '../api/httpClient';

export class LaunchpadService implements ILaunchpadService {
  private mock = mockLaunchpadService;
  private http = defaultHttpClient;

  async getProblems(filters?: LaunchpadFilters): Promise<LaunchpadProblem[]> {
    if (envConfig.useMocks) {
      return this.mock.getProblems(filters);
    }

    try {
      const res = await this.http.get<LaunchpadProblem[]>('/api/launchpad/problems', {
        params: {
          status: filters?.status,
          domain: filters?.domain,
          difficulty: filters?.difficulty,
          search: filters?.search,
        },
      });

      // If backend returns empty array because database has not been seeded yet,
      // fallback to mock items so the UI is never completely blank.
      if (Array.isArray(res) && res.length === 0) {
        return this.mock.getProblems(filters);
      }

      return res;
    } catch {
      return this.mock.getProblems(filters);
    }
  }

  /**
   * Fetches the backend's ranked problem bank. Unlike getProblems this has no
   * mock fallback: a null return tells the caller the ranking is unavailable so
   * it can show an honest unranked pick instead of a fabricated match score.
   */
  async getRecommendedProblems(input?: {
    skills?: string[];
    level?: ExperienceLevel;
    limit?: number;
  }): Promise<ProblemRecommendation | null> {
    if (envConfig.useMocks) {
      return this.mock.getRecommendedProblems(input);
    }

    try {
      const res = await this.http.get<ProblemRecommendation>(
        '/api/launchpad/problems/recommended',
        {
          params: {
            skills: input?.skills?.length ? input.skills.join(',') : undefined,
            level: input?.level,
            limit: input?.limit,
          },
        }
      );
      return Array.isArray(res?.problems) ? res : null;
    } catch {
      return null;
    }
  }

  async getProblemById(id: string): Promise<LaunchpadProblem | undefined> {
    if (envConfig.useMocks) {
      return this.mock.getProblemById(id);
    }

    try {
      return await this.http.get<LaunchpadProblem>(`/api/launchpad/problems/${encodeURIComponent(id)}`);
    } catch {
      return this.mock.getProblemById(id);
    }
  }

  async claimProblem(problemId: string): Promise<ProblemClaimStatus> {
    if (envConfig.useMocks) {
      return this.mock.claimProblem(problemId);
    }

    // Per ADR-001: Mutation never silently falls back
    return await this.http.post<ProblemClaimStatus>(`/api/launchpad/claim/${encodeURIComponent(problemId)}`);
  }

  async getMyClaims(status?: ProblemStatus): Promise<LaunchpadProblem[]> {
    if (envConfig.useMocks) {
      return this.mock.getMyClaims(status);
    }

    try {
      return await this.http.get<LaunchpadProblem[]>('/api/launchpad/claims', {
        params: { status },
      });
    } catch {
      return this.mock.getMyClaims(status);
    }
  }

  async updateStatus(
    problemId: string,
    status: ProblemStatus
  ): Promise<ProblemClaimStatus> {
    if (envConfig.useMocks) {
      return this.mock.updateStatus(problemId, status);
    }

    // Per ADR-001: Mutation never silently falls back
    return await this.http.post<ProblemClaimStatus>('/api/launchpad/status', {
      problemId,
      status,
    });
  }

  async getStatus(problemId: string): Promise<ProblemClaimStatus> {
    if (envConfig.useMocks) {
      return this.mock.getStatus(problemId);
    }

    try {
      return await this.http.get<ProblemClaimStatus>(`/api/launchpad/status/${encodeURIComponent(problemId)}`);
    } catch {
      return this.mock.getStatus(problemId);
    }
  }
}

export const launchpadService = new LaunchpadService();
