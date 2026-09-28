/**
 * @file userService.ts
 * @description Primary User Service with explicit fallback strategy.
 * Handles profile fetching, updates, and username availability.
 */

import { IUserService, PlatformUser } from './IUserService';
import { mockUserService } from './mockUserService';
import { UserProfile } from '@/types';
import { UserRole } from '@/types/auth';
import { ApiError } from '@/types/api';
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
    if (sanitizedData.contactEmail === '') {
      delete sanitizedData.contactEmail;
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

  /**
   * updateUsername changes the dev's handle. The backend derives the first one
   * from the OAuth metadata or the email local part and appends a random suffix
   * on conflict, so an account created that way is stuck with e.g.
   * "michojekunle_1a3f" until it sets a handle here.
   */
  async updateUsername(username: string): Promise<UserProfile> {
    const clean = username.replace(/^@/, '').trim();
    if (envConfig.useMocks) {
      return this.mock.updateUsername(clean);
    }
    return this.http.patch<UserProfile>('/api/v1/users/me/username', { username: clean });
  }

  // Role management deliberately has no mock path. The persona switcher that
  // used to stand in for it only rewrote a cookie, so a fallback here would
  // show an admin a roster of reviewers who hold no real role.
  async listPlatformUsers(query = ''): Promise<PlatformUser[]> {
    if (envConfig.useMocks) {
      throw new ApiError({
        message: 'Role management needs a connected backend',
        statusCode: 0,
        code: 'MOCK_MODE_UNSUPPORTED',
      });
    }
    return this.http.get<PlatformUser[]>('/api/v1/admin/users', { params: { q: query } });
  }

  async setUserRole(userId: string, role: UserRole): Promise<UserProfile> {
    if (envConfig.useMocks) {
      throw new ApiError({
        message: 'Role management needs a connected backend',
        statusCode: 0,
        code: 'MOCK_MODE_UNSUPPORTED',
      });
    }
    return this.http.patch<UserProfile>(
      `/api/v1/admin/users/${encodeURIComponent(userId)}/role`,
      { role }
    );
  }
}

export const userService = new UserService();
