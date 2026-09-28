/**
 * @file userService.ts
 * @description Primary User Service with explicit fallback strategy.
 * Handles profile fetching, updates, and username availability.
 */

import { IUserService } from './IUserService';
import { mockUserService } from './mockUserService';
import { UserProfile } from '@/types';
import { UserProfileUpdateInput } from '@/lib/schemas/profile';
import { envConfig } from '@/lib/config';
import { defaultHttpClient } from '../api/httpClient';

export class UserService implements IUserService {
  private mock = mockUserService;
  private http = defaultHttpClient;

  async getProfile(username: string): Promise<UserProfile> {
    if (envConfig.useMocks) {
      return this.mock.getProfile(username);
    }

    try {
      return await this.http.get<UserProfile>(`/api/v1/users/${encodeURIComponent(username)}`);
    } catch {
      // Graceful read fallback
      return this.mock.getProfile(username);
    }
  }

  async updateProfile(data: UserProfileUpdateInput): Promise<UserProfile> {
    if (envConfig.useMocks) {
      return this.mock.updateProfile(data);
    }

    // Sanitize payload for backend compatibility
    const sanitizedData: Record<string, unknown> = { ...data };

    // 1. Omit avatarUrl if it's a data URI (backend requires http/https URL)
    if (typeof sanitizedData.avatarUrl === 'string' && sanitizedData.avatarUrl.startsWith('data:')) {
      delete sanitizedData.avatarUrl;
    }

    // 2. Omit empty string URLs (backend rejects "" for http URL fields)
    if (sanitizedData.githubUrl === '') {
      delete sanitizedData.githubUrl;
    }
    if (sanitizedData.email === '') {
      delete sanitizedData.email;
    }

    // 3. Omit empty statedSkills
    if (Array.isArray(sanitizedData.statedSkills) && sanitizedData.statedSkills.length === 0) {
      delete sanitizedData.statedSkills;
    }

    // Call the backend user profile API endpoint
    return await this.http.patch<UserProfile>('/api/v1/users/me', sanitizedData as UserProfileUpdateInput);
  }

  async checkUsernameAvailable(username: string): Promise<boolean> {
    if (envConfig.useMocks) {
      return this.mock.checkUsernameAvailable(username);
    }

    try {
      const res = await this.http.get<{ available: boolean }>(
        `/api/v1/users/available?username=${encodeURIComponent(username)}`
      );
      return res.available;
    } catch {
      return this.mock.checkUsernameAvailable(username);
    }
  }
}

export const userService = new UserService();
