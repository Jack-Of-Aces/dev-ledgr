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
  getSubmissionByHash(hash: string): Promise<SubmissionEntry | undefined>;
  submitSolution(input: CreateSubmissionInput): Promise<SubmissionEntry>;
  verifySubmission(hash: string): Promise<SubmissionEntry>;
}
