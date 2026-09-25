/**
 * @file IAIService.ts
 * @description Contract for AI intelligence: ATS CV scrutiny, portfolio auditing,
 * and socratic coaching guidance. Supports streaming logs and fallback generation.
 */

import { JobOpportunity, SubmissionEntry, UserProfile } from '@/types';

export interface ScrutinyParams {
  job: JobOpportunity;
  user: UserProfile;
  userSubmissions: SubmissionEntry[];
  forceGap?: boolean;
}

export interface ScrutinyResult {
  status: 'ready' | 'gap';
  scanLogs: string[];
  cvMarkdown: string;
  coverLetter: string;
  gapReason?: string;
  gapIdeaId?: string;
}

export interface CoachPromptParams {
  itineraryTitle: string;
  milestoneTitle: string;
  prompt: string;
  apiKey?: string;
}

export interface IAIService {
  /**
   * Evaluates candidate verified commits against target job criteria.
   * Calls onLog callback as audit steps complete.
   */
  runScrutinyAudit(
    params: ScrutinyParams,
    onLog?: (log: string) => void
  ): Promise<ScrutinyResult>;

  /**
   * Generates architecture guidance for a milestone prompt.
   */
  getCoachingAdvice(params: CoachPromptParams): Promise<string>;
}
