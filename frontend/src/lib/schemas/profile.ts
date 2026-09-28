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
  avatarUrl: z
    .string()
    .refine(
      (val) => !val || val.startsWith('data:image/') || z.string().url().safeParse(val).success,
      { message: 'Must be a valid image URL or uploaded image' }
    )
    .optional()
    .or(z.literal('')),
  githubUrl: z.string().url('Must be a valid GitHub URL').optional().or(z.literal('')),
  // The recruiter contact address. The account's own address is not editable
  // here: it belongs to the auth provider and is what verifies GitHub ownership.
  contactEmail: z.string().email('Must be a valid email').optional().or(z.literal('')),
  plan: z.enum(['free', 'full-service', 'byok']),
  apiKey: z.string().optional(),
  statedSkills: z.array(z.string()).min(1, 'Please select at least one skill tag'),
  engineeringTrack: z
    .enum([
      'devops-infra',
      'backend-systems',
      'frontend-ui',
      'fullstack',
      'product-design',
      'ai-ml',
      'mobile',
    ])
    .optional(),
  targetRole: z.string().max(80).optional(),
  experienceLevel: z.enum(['junior', 'mid', 'senior', 'lead']).optional(),
  githubConnected: z.boolean().optional(),
  githubUsername: z.string().optional(),
  onboardingCompleted: z.boolean().optional(),
});

export type UserProfileUpdateInput = z.infer<typeof UserProfileUpdateSchema>;
