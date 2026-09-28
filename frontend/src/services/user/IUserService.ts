/**
 * @file IUserService.ts
 * @description Contract for user profile queries and mutations.
 * Implementations: HttpUserService (REST backend), MockUserService (localStorage fallback).
 */

import { UserProfile } from '@/types';
import { UserRole } from '@/types/auth';
import { UserProfileUpdateInput } from '@/lib/schemas/profile';

/**
 * Roster entry for role management. Carries the profile id, which
 * UserProfile omits from every payload because managing a role is addressed
 * by id. Mirrors model.PlatformUser in the backend.
 */
export interface PlatformUser {
  id: string;
  username: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: UserRole;
  updatedAt: string;
}

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

  /**
   * Changes the caller's handle. The backend derives the first one from the
   * OAuth metadata or the email local part and appends a random suffix on
   * conflict, so an account created that way is stuck with a padded handle
   * until it sets one here. Rejects with a per-field message when the handle is
   * taken or reserved.
   */
  updateUsername(username: string): Promise<UserProfile>;

  /**
   * Lists devs for role management, optionally filtered by a substring of
   * their username, name or email. Admin-only; rejects rather than falling
   * back, since a mock roster would show roles that do not exist.
   */
  listPlatformUsers(query?: string): Promise<PlatformUser[]>;

  /**
   * Grants or revokes a role. Admin-only, and the backend refuses to change
   * the caller's own role.
   */
  setUserRole(userId: string, role: UserRole): Promise<UserProfile>;
}
