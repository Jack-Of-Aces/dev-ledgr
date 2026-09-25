/**
 * @file mockUserService.ts
 * @description Mock user service managing profile persistence and updates in sandbox mode.
 */

import { IUserService } from './IUserService';
import { UserProfile } from '@/types';
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
      email: data.email || this.profile.email,
      plan: data.plan,
      apiKey: data.apiKey,
      statedSkills: data.statedSkills,
      updatedAt: new Date().toISOString(),
    };
    return this.profile;
  }

  async checkUsernameAvailable(username: string): Promise<boolean> {
    return username.toLowerCase() !== 'admin' && username.toLowerCase() !== 'root';
  }
}

export const mockUserService = new MockUserService();
