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
  /**
   * The HEAD commit the proof refers to, when GitHub inspection found one.
   * Sent to the backend so a review can be pinned to a specific commit. The
   * server validates the hex format and stores it; the certificate signs it.
   */
  commitHash?: string;
  architectureNotes: string;
}

/**
 * What a reviewer attests to when stamping a submission.
 *
 * The backend refuses a certificate whose test total is zero, so these counts
 * are the reviewer's own record of what they checked. An automated replay
 * runner will populate the same fields from a real run.
 */
export interface VerifySubmissionInput {
  testResults: {
    passed: number;
    total: number;
    suiteName?: string;
  };
  metrics?: {
    latencyP99?: string;
    throughput?: string;
    coverage?: string;
  };
  notes?: string;
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
  /**
   * Stamps a submission. `input.testResults` is required: the backend will not
   * mint a certificate without recorded test results, and rejects any total of
   * zero rather than reading 0/0 as a pass.
   */
  verifySubmission(hash: string, input: VerifySubmissionInput): Promise<SubmissionEntry>;
  /** Rejects a submission. `notes` is required by the backend, not optional. */
  rejectSubmission(hash: string, notes: string): Promise<SubmissionEntry>;
  getCertificate(hash: string): Promise<{ hash: string; issuedAt: string; validUntil: string; valid: boolean }>;
}
