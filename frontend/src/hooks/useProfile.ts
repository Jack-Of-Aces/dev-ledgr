/**
 * @file useProfile.ts
 * @description Application hook managing user profile mutations with Zod validation,
 * optimistic updates, and automatic rollback on failure.
 */

'use client';

import { useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { userService } from '@/services/user/userService';
import { UserProfileUpdateSchema, UserProfileUpdateInput } from '@/lib/schemas/profile';
import { UserProfile } from '@/types';

export function useProfile() {
  const { user, setUser, showToast } = useAppStore();
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateProfile = useCallback(
    async (input: UserProfileUpdateInput): Promise<{ success: boolean; profile?: UserProfile }> => {
      setErrors({});

      // 1. Zod runtime validation
      const validation = UserProfileUpdateSchema.safeParse(input);
      if (!validation.success) {
        const fieldErrors: Record<string, string> = {};
        validation.error.issues.forEach((issue) => {
          const path = issue.path[0];
          if (path) fieldErrors[String(path)] = issue.message;
        });
        setErrors(fieldErrors);
        showToast({
          title: 'Validation Error',
          message: 'Please review highlighted fields before saving.',
        });
        return { success: false };
      }

      setIsSaving(true);
      const previousState = { ...user };

      // 2. Optimistic Update (Immediate UI response)
      setUser({
        name: input.name,
        headline: input.headline,
        bio: input.bio,
        avatarUrl: input.avatarUrl || user.avatarUrl,
        githubUrl: input.githubUrl || user.githubUrl,
        email: input.email || user.email,
        plan: input.plan,
        apiKey: input.apiKey || undefined,
        statedSkills: input.statedSkills,
        updatedAt: new Date().toISOString(),
      });

      try {
        // 3. Network Mutation Call
        const updated = await userService.updateProfile(input);

        // Sync with verified backend response
        setUser({ ...updated });

        showToast({
          title: 'Identity Stamped',
          message: 'Your developer ledger profile has been successfully updated.',
        });

        setIsSaving(false);
        return { success: true, profile: updated };
      } catch (err: unknown) {
        // 4. Rollback on Network Failure (prevents phantom state)
        setUser(previousState);
        setIsSaving(false);

        const errorMessage = err instanceof Error ? err.message : 'Failed to synchronize profile update.';
        showToast({
          title: 'Sync Failed · Rolled Back',
          message: errorMessage,
        });

        return { success: false };
      }
    },
    [user, setUser, showToast]
  );

  return {
    user,
    isSaving,
    errors,
    updateProfile,
  };
}
