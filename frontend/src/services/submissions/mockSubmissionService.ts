/**
 * @file mockSubmissionService.ts
 * @description Mock service for managing cryptographically stamped submissions.
 */

import { ISubmissionService, CreateSubmissionInput } from './ISubmissionService';
import { SubmissionEntry } from '@/types';
import { INITIAL_SUBMISSIONS } from '@/lib/mock-data';

function generateCommitHash(): string {
  const chars = '0123456789abcdef';
  let hash = '';
  for (let i = 0; i < 7; i++) {
    hash += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return hash;
}

export class MockSubmissionService implements ISubmissionService {
  private submissions: SubmissionEntry[] = [...INITIAL_SUBMISSIONS];

  async getSubmissions(username?: string): Promise<SubmissionEntry[]> {
    if (!username) return this.submissions;
    return this.submissions.filter(
      (s) => s.authorUsername.toLowerCase() === username.toLowerCase()
    );
  }

  async getSubmissionByHash(hash: string): Promise<SubmissionEntry | undefined> {
    return this.submissions.find(
      (s) => s.hash.toLowerCase() === hash.toLowerCase()
    );
  }

  async submitSolution(input: CreateSubmissionInput): Promise<SubmissionEntry> {
    const hash = generateCommitHash();
    const newEntry: SubmissionEntry = {
      ...input,
      hash,
      timestamp: new Date().toISOString(),
      status: 'verified',
      testResults: {
        passed: 20,
        total: 20,
        suiteName: 'Automated CI & Contract Test Suite v2.0',
      },
      metrics: {
        latencyP99: '34ms',
        throughput: '260 req/s',
        coverage: '96.4%',
      },
    };

    this.submissions = [newEntry, ...this.submissions];
    return newEntry;
  }

  async verifySubmission(hash: string): Promise<SubmissionEntry> {
    const sub = this.submissions.find((s) => s.hash === hash);
    if (!sub) throw new Error(`Submission #${hash} not found`);

    sub.status = 'verified';
    return sub;
  }
}

export const mockSubmissionService = new MockSubmissionService();
