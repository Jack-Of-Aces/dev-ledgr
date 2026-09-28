/**
 * @file portfolioService.ts
 * @description Primary Developer Portfolio & Profile Service connecting to Go backend (/api/dev/*).
 * Adheres to ADR-001: Graceful fallback on read; strict error propagation on write.
 */

import { IPortfolioService } from './IPortfolioService';
import { mockPortfolioService } from './mockPortfolioService';
import { DevPortfolio, UserProfile } from '@/types';
import { envConfig } from '@/lib/config';
import { defaultHttpClient } from '../api/httpClient';

export class PortfolioService implements IPortfolioService {
  private mock = mockPortfolioService;
  private http = defaultHttpClient;

  async getPortfolio(username?: string): Promise<DevPortfolio> {
    if (envConfig.useMocks) {
      return this.mock.getPortfolio(username);
    }

    try {
      const endpoint = username
        ? `/api/dev/portfolio/${encodeURIComponent(username)}`
        : '/api/dev/portfolio';
      return await this.http.get<DevPortfolio>(endpoint);
    } catch {
      // Fallback on read per ADR-001 so public profiles never crash
      return this.mock.getPortfolio(username);
    }
  }

  async getProfile(): Promise<UserProfile> {
    if (envConfig.useMocks) {
      return this.mock.getProfile();
    }

    try {
      return await this.http.get<UserProfile>('/api/dev/profile');
    } catch {
      return this.mock.getProfile();
    }
  }

  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    if (envConfig.useMocks) {
      return this.mock.updateProfile(updates);
    }

    // Per ADR-001: Failed writes never silently fall back; they throw
    return await this.http.patch<UserProfile>('/api/dev/profile', updates);
  }
}

export const portfolioService = new PortfolioService();
