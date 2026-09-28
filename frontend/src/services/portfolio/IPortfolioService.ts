/**
 * @file IPortfolioService.ts
 * @description Contract for developer portfolio retrieval and profile mutation.
 */

import { DevPortfolio, UserProfile } from '@/types';

export interface IPortfolioService {
  getPortfolio(username?: string): Promise<DevPortfolio>;
  getProfile(): Promise<UserProfile>;
  updateProfile(updates: Partial<UserProfile>): Promise<UserProfile>;
}
