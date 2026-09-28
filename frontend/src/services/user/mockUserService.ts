/**
 * @file mockUserService.ts
 * @description Mock user service managing profile persistence and updates in sandbox mode.
 */

import { IUserService, PlatformUser } from './IUserService';
import { UserProfile } from '@/types';
import { UserRole } from '@/types/auth';
import { ApiError } from '@/types/api';
import { DEFAULT_USER } from '@/lib/mock-data';
import { UserProfileUpdateInput } from '@/lib/schemas/profile';

export class MockUserService implements IUserService {
  private profile: UserProfile = { ...DEFAULT_USER };

  async getProfile(username: string): Promise<UserProfile> {
    if (username.toLowerCase() === this.profile.username.toLowerCase()) {
      return this.profile;
    }
    // Return a synthetic profile for other users
    return {
      ...DEFAULT_USER,
      username,
      name: username.replace(/_/g, ' '),
    };
  }

  async updateProfile(data: UserProfileUpdateInput): Promise<UserProfile> {
    this.profile = {
      ...this.profile,
      name: data.name,
      headline: data.headline,
      bio: data.bio || '',
      avatarUrl: data.avatarUrl || this.profile.avatarUrl,
      githubUrl: data.githubUrl || this.profile.githubUrl,
      contactEmail: data.contactEmail ?? this.profile.contactEmail,
      plan: data.plan,
      hasApiKey: data.plan === 'byok' && (Boolean(data.apiKey?.trim()) || Boolean(this.profile.hasApiKey)),
      statedSkills: data.statedSkills,
      // The onboarding fields are part of the same save. Dropping them here
      // made mock mode disagree with the API about what a profile holds.
      engineeringTrack: data.engineeringTrack ?? this.profile.engineeringTrack,
      targetRole: data.targetRole ?? this.profile.targetRole,
      experienceLevel: data.experienceLevel ?? this.profile.experienceLevel,
      githubUsername: data.githubUsername ?? this.profile.githubUsername,
      githubConnected: data.githubConnected ?? this.profile.githubConnected,
      updatedAt: new Date().toISOString(),
    };
    return this.profile;
  }

  async checkUsernameAvailable(username: string): Promise<boolean> {
    const taken = ['admin', 'root', 'me', 'available', this.profile.username.toLowerCase()];
    return !taken.includes(username.toLowerCase());
  }

  async updateUsername(username: string): Promise<UserProfile> {
    this.profile = { ...this.profile, username, updatedAt: new Date().toISOString() };
    return this.profile;
  }

  // Roles are not mocked. The persona switcher that used to stand in for this
  // only rewrote a cookie, so returning a synthetic roster here would show an
  // admin reviewers who hold no real role. UserService rejects first.

  async listPlatformUsers(): Promise<PlatformUser[]> {
    throw new ApiError({
      message: 'Role management needs a connected backend',
      statusCode: 0,
      code: 'MOCK_MODE_UNSUPPORTED',
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by IUserService
  async setUserRole(_userId: string, _role: UserRole): Promise<UserProfile> {
    throw new ApiError({
      message: 'Role management needs a connected backend',
      statusCode: 0,
      code: 'MOCK_MODE_UNSUPPORTED',
    });
  }
}

export const mockUserService = new MockUserService();
