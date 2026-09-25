/**
 * @file IUserService.ts
 * @description Contract for user profile queries and mutations.
 * Implementations: HttpUserService (REST backend), MockUserService (localStorage fallback).
 */

import { UserProfile } from '@/types';
import { UserProfileUpdateInput } from '@/lib/schemas/profile';

export interface IUserService {
  /**
   * Fetches public profile by username/slug.
   */
  getProfile(username: string): Promise<UserProfile>;

  /**
   * Updates the authenticated user's profile.
   */
  updateProfile(data: UserProfileUpdateInput): Promise<UserProfile>;

  /**
   * Checks if a handle/username is available for registration.
   */
  checkUsernameAvailable(username: string): Promise<boolean>;
}
