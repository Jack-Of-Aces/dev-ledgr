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
  /**
   * Generate the package even when a proof gap is detected. The dev is choosing
   * to apply without closing the gap; the audit still logs the gap, it just
   * stops short-circuiting before generation.
   */
  overrideGap?: boolean;
}

export interface ScrutinyResult {
  status: 'ready' | 'gap';
  scanLogs: string[];
  cvMarkdown: string;
  coverLetter: string;
  gapReason?: string;
  gapIdeaId?: string;
}

export interface CoachMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CoachPromptParams {
  itineraryTitle: string;
  milestoneTitle: string;
  prompt: string;
  messages?: CoachMessage[];
  candidateContext?: {
    username: string;
    name: string;
    headline?: string;
    statedSkills?: string[];
    verifiedProofCount: number;
    solvedIdeaTitles: string[];
  };
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
  getCoachingAdvice(
    params: CoachPromptParams
  ): Promise<{ advice: string; provider?: string; model?: string; attempts?: unknown[] }>;
}
