/**
 * @file profile.ts
 * @description Zod schema for validating user profile updates.
 * Guarantees data integrity before mutation calls reach the service layer.
 */

import { z } from 'zod';

export const UserProfileUpdateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(60, 'Name must be under 60 characters'),
  headline: z.string().min(3, 'Headline must be at least 3 characters').max(120, 'Headline must be under 120 characters'),
  bio: z.string().max(500, 'Bio must be under 500 characters').optional().default(''),
  avatarUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  githubUrl: z.string().url('Must be a valid GitHub URL').optional().or(z.literal('')),
  email: z.string().email('Must be a valid email').optional().or(z.literal('')),
  plan: z.enum(['free', 'full-service', 'byok']),
  apiKey: z.string().optional(),
  statedSkills: z.array(z.string()).min(1, 'Please select at least one skill tag'),
});

export type UserProfileUpdateInput = z.infer<typeof UserProfileUpdateSchema>;
