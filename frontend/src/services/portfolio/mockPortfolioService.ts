/**
 * @file mockPortfolioService.ts
 * @description Deterministic portfolio mock provider adhering to ADR-001.
 */

import { IPortfolioService } from './IPortfolioService';
import { DevPortfolio, UserProfile } from '@/types';
import { DEFAULT_USER, INITIAL_IDEAS, INITIAL_SUBMISSIONS } from '@/lib/mock-data';

export class MockPortfolioService implements IPortfolioService {
  async getPortfolio(username?: string): Promise<DevPortfolio> {
    const dev: UserProfile = {
      ...DEFAULT_USER,
      username: username || DEFAULT_USER.username,
      name: username ? (username === 'junior_dev' ? 'Candidate Engineer' : username) : DEFAULT_USER.name,
    };

    const userSubs = INITIAL_SUBMISSIONS.filter(
      (s) => s.authorUsername.toLowerCase() === dev.username.toLowerCase()
    );

    return {
      dev,
      isOwner: true,
      skills: dev.statedSkills,
      provenSkills: ['Go', 'PostgreSQL', 'Redis', 'Docker'],
      stats: {
        verifiedProofs: userSubs.filter((s) => s.status === 'verified').length,
        pendingSubmissions: userSubs.filter((s) => s.status === 'pending').length,
        activeBuilds: 1,
        completedProblems: userSubs.filter((s) => s.status === 'verified').length,
        portfolioValidUntil: dev.portfolioValidUntil,
      },
      activeBuilds: [INITIAL_IDEAS[0]],
      completedProblems: INITIAL_IDEAS.slice(1, 3),
      ledger: userSubs.length > 0 ? userSubs : INITIAL_SUBMISSIONS.slice(0, 2),
    };
  }

  async getProfile(): Promise<UserProfile> {
    return { ...DEFAULT_USER };
  }

  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    return { ...DEFAULT_USER, ...updates, updatedAt: new Date().toISOString() };
  }
}

export const mockPortfolioService = new MockPortfolioService();
