/**
 * @file mockLaunchpadService.ts
 * @description Mock Launchpad service provider adhering to ADR-001.
 */

import { ILaunchpadService, LaunchpadFilters } from './ILaunchpadService';
import {
  LaunchpadProblem,
  ProblemStatus,
  ProblemClaimStatus,
  ProblemRecommendation,
  ExperienceLevel,
} from '@/types';
import { INITIAL_IDEAS, DEFAULT_USER } from '@/lib/mock-data';
import { rankLocally } from './localRanking';

export class MockLaunchpadService implements ILaunchpadService {
  private problems: LaunchpadProblem[] = INITIAL_IDEAS.map((idea, idx) => ({
    ...idea,
    status: idx === 0 ? 'in_progress' : idx === 1 ? 'seeking_contributors' : 'open',
    // One draft, so the moderation view has something to publish or unpublish
    // without needing a live backend.
    adminApproved: idx !== 2,
    claimedBy:
      idx === 0
        ? {
            username: DEFAULT_USER.username,
            name: DEFAULT_USER.name,
            avatarUrl: DEFAULT_USER.avatarUrl,
          }
        : undefined,
    statusUpdatedAt: new Date().toISOString(),
  }));

  async getProblems(filters?: LaunchpadFilters): Promise<LaunchpadProblem[]> {
    let result = [...this.problems];

    // Mirrors the backend: 'all' returns drafts and published problems,
    // otherwise the response is pinned to what is published.
    if (filters?.approved === 'all') {
      // no narrowing
    } else if (filters?.approved === 'true' || !filters?.approved) {
      result = result.filter((p) => p.adminApproved);
    } else if (filters?.approved === 'false') {
      result = result.filter((p) => !p.adminApproved);
    }

    if (filters?.status) {
      result = result.filter((p) => p.status === filters.status);
    }
    if (filters?.domain && filters.domain !== 'all') {
      result = result.filter((p) => p.domain === filters.domain);
    }
    if (filters?.difficulty && filters.difficulty !== 'all') {
      result = result.filter((p) => p.difficulty === filters.difficulty);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.tagline.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return result;
  }

  async getRecommendedProblems(input?: {
    skills?: string[];
    level?: ExperienceLevel;
  }): Promise<ProblemRecommendation> {
    return rankLocally(this.problems, input?.skills, input?.level);
  }

  async getProblemById(id: string): Promise<LaunchpadProblem | undefined> {
    return this.problems.find((p) => p.id === id);
  }

  async claimProblem(problemId: string): Promise<ProblemClaimStatus> {
    const p = this.problems.find((item) => item.id === problemId);
    if (p) {
      p.status = 'in_progress';
      p.claimedBy = {
        username: DEFAULT_USER.username,
        name: DEFAULT_USER.name,
        avatarUrl: DEFAULT_USER.avatarUrl,
      };
      p.claimedAt = new Date().toISOString();
      p.statusUpdatedAt = new Date().toISOString();
    }

    return {
      problemId,
      status: 'in_progress',
      claimedBy: p?.claimedBy,
      claimedAt: p?.claimedAt,
      statusUpdatedAt: new Date().toISOString(),
    };
  }

  async getMyClaims(status?: ProblemStatus): Promise<LaunchpadProblem[]> {
    return this.problems.filter(
      (p) =>
        p.claimedBy?.username.toLowerCase() === DEFAULT_USER.username.toLowerCase() &&
        (!status || p.status === status)
    );
  }

  async updateStatus(
    problemId: string,
    status: ProblemStatus
  ): Promise<ProblemClaimStatus> {
    const p = this.problems.find((item) => item.id === problemId);
    if (p) {
      p.status = status;
      p.statusUpdatedAt = new Date().toISOString();
      if (status === 'complete') {
        p.completedAt = new Date().toISOString();
      } else if (status === 'open') {
        p.claimedBy = undefined;
        p.claimedAt = undefined;
      }
    }

    return {
      problemId,
      status,
      claimedBy: p?.claimedBy,
      statusUpdatedAt: new Date().toISOString(),
    };
  }

  async getStatus(problemId: string): Promise<ProblemClaimStatus> {
    const p = this.problems.find((item) => item.id === problemId);
    return {
      problemId,
      status: p?.status || 'open',
      claimedBy: p?.claimedBy,
      statusUpdatedAt: p?.statusUpdatedAt || new Date().toISOString(),
    };
  }

  async setProblemApproval(id: string, approved: boolean): Promise<LaunchpadProblem> {
    const problem = this.problems.find((item) => item.id === id);
    if (!problem) {
      throw new Error(`Problem ${id} not found`);
    }
    problem.adminApproved = approved;
    return problem;
  }
}

export const mockLaunchpadService = new MockLaunchpadService();
