/**
 * @file ISubmissionService.ts
 * @description Contract for code submissions and ledger review audits.
 */

import { SubmissionEntry } from '@/types';

export interface CreateSubmissionInput {
  ideaId: string;
  ideaTitle: string;
  authorUsername: string;
  authorName: string;
  authorAvatar?: string;
  repoUrl: string;
  demoUrl?: string;
  architectureNotes: string;
}

export interface ISubmissionService {
  getSubmissions(username?: string): Promise<SubmissionEntry[]>;
  /**
   * Reads the whole queue for the review console, with no mock fallback. An
   * empty live queue must read as empty: backfilling it with sample proofs
   * would put invented rows in front of a reviewer, who would then be stamping
   * or rejecting things that were never submitted.
   */
  getReviewQueue(): Promise<SubmissionEntry[]>;
  getSubmissionByHash(hash: string): Promise<SubmissionEntry | undefined>;
  submitSolution(input: CreateSubmissionInput): Promise<SubmissionEntry>;
  verifySubmission(hash: string): Promise<SubmissionEntry>;
  rejectSubmission(hash: string, reviewNotes?: string): Promise<SubmissionEntry>;
  getCertificate(hash: string): Promise<{ hash: string; issuedAt: string; validUntil: string; valid: boolean }>;
}
