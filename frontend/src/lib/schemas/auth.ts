/**
 * @file auth.ts
 * @description Zod schemas for authentication inputs and credentials.
 */

import { z } from 'zod';

export const EmailSignInSchema = z.object({
  email: z.string().email('Please enter a valid work or personal email'),
});

export const OnboardingSurveySchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain alphanumeric characters, underscores, and dashes'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  headline: z.string().min(5, 'Headline must be at least 5 characters'),
  skills: z.array(z.string()).min(1, 'Select at least one active skill'),
});
