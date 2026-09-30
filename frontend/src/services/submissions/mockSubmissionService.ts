/**
 * @file mockSubmissionService.ts
 * @description Mock service for managing cryptographically stamped submissions.
 */

import {
  ISubmissionService,
  CreateSubmissionInput,
  VerifySubmissionInput,
} from './ISubmissionService';
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

  async getReviewQueue(): Promise<SubmissionEntry[]> {
    return this.submissions;
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
      // A new submission is pending and unmeasured, exactly as the backend
      // creates it. It used to be born 'verified' carrying 20/20 and
      // 34ms/260 req/s, which is how unmeasured proof reached the portfolio.
      status: 'pending',
      testResults: { passed: 0, total: 0, suiteName: 'Not yet verified' },
    };

    this.submissions = [newEntry, ...this.submissions];
    return newEntry;
  }

  async verifySubmission(hash: string, input: VerifySubmissionInput): Promise<SubmissionEntry> {
    const sub = this.submissions.find((s) => s.hash === hash);
    if (!sub) throw new Error(`Submission #${hash} not found`);

    // Mirror the backend gate so the mock cannot be a kinder contract than the
    // real thing: a zero total is refused rather than read as a pass.
    if (input.testResults.total <= 0) {
      throw new Error(
        'A certificate cannot be minted without recorded test results: total must be greater than zero'
      );
    }
    if (input.testResults.passed !== input.testResults.total) {
      throw new Error('All tests must pass before a submission can be stamped');
    }

    sub.status = 'verified';
    sub.testResults = {
      passed: input.testResults.passed,
      total: input.testResults.total,
      suiteName: input.testResults.suiteName || 'Manual Reviewer Audit',
    };
    if (input.metrics && Object.values(input.metrics).some(Boolean)) {
      sub.metrics = input.metrics;
    }
    return sub;
  }

  async rejectSubmission(hash: string, notes: string): Promise<SubmissionEntry> {
    const sub = this.submissions.find((s) => s.hash === hash);
    if (!sub) throw new Error(`Submission #${hash} not found`);

    sub.status = 'rejected';
    if (notes) {
      sub.architectureNotes = `${sub.architectureNotes}\n\n[Reviewer Feedback]: ${notes}`;
    }
    return sub;
  }

  async getCertificate(hash: string): Promise<{ hash: string; issuedAt: string; validUntil: string; valid: boolean }> {
    const issuedAt = new Date().toISOString();
    const validUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    return {
      hash,
      issuedAt,
      validUntil,
      valid: true,
    };
  }
}

export const mockSubmissionService = new MockSubmissionService();
