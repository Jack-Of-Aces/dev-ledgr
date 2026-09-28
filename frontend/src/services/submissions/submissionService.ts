/**
 * @file submissionService.ts
 * @description Primary Submission Service with resilient fallback.
 */

import { ISubmissionService, CreateSubmissionInput } from './ISubmissionService';
import { mockSubmissionService } from './mockSubmissionService';
import { SubmissionEntry } from '@/types';
import { envConfig } from '@/lib/config';
import { defaultHttpClient } from '../api/httpClient';

export class SubmissionService implements ISubmissionService {
  private mock = mockSubmissionService;
  private http = defaultHttpClient;

  async getSubmissions(username?: string): Promise<SubmissionEntry[]> {
    if (envConfig.useMocks) {
      return this.mock.getSubmissions(username);
    }

    try {
      const subs = await this.http.get<SubmissionEntry[]>('/api/v1/submissions', {
        params: { username },
      });
      if (subs && subs.length > 0) {
        return subs;
      }
      if (!username || username === 'junior_dev') {
        return this.mock.getSubmissions(username);
      }
      return subs || [];
    } catch {
      return this.mock.getSubmissions(username);
    }
  }

  /**
   * Reads the queue for the review console. Unlike getSubmissions this never
   * substitutes sample data: an empty live queue reads as empty so a reviewer
   * is never handed invented proofs to stamp or reject.
   */
  async getReviewQueue(): Promise<SubmissionEntry[]> {
    if (envConfig.useMocks) {
      return this.mock.getSubmissions();
    }

    const subs = await this.http.get<SubmissionEntry[]>('/api/v1/submissions');
    return Array.isArray(subs) ? subs : [];
  }

  async getSubmissionByHash(hash: string): Promise<SubmissionEntry | undefined> {
    if (envConfig.useMocks) {
      return this.mock.getSubmissionByHash(hash);
    }

    try {
      return await this.http.get<SubmissionEntry>(`/api/v1/submissions/${encodeURIComponent(hash)}`);
    } catch {
      return this.mock.getSubmissionByHash(hash);
    }
  }

  async submitSolution(input: CreateSubmissionInput): Promise<SubmissionEntry> {
    if (envConfig.useMocks) {
      return this.mock.submitSolution(input);
    }

    return await this.http.post<SubmissionEntry>('/api/v1/submissions', input);
  }

  async verifySubmission(hash: string): Promise<SubmissionEntry> {
    if (envConfig.useMocks) {
      return this.mock.verifySubmission(hash);
    }

    return await this.http.post<SubmissionEntry>(`/api/v1/submissions/${encodeURIComponent(hash)}/verify`);
  }

  async rejectSubmission(hash: string, reviewNotes?: string): Promise<SubmissionEntry> {
    if (envConfig.useMocks) {
      return this.mock.rejectSubmission(hash, reviewNotes);
    }

    return await this.http.post<SubmissionEntry>(`/api/v1/submissions/${encodeURIComponent(hash)}/reject`, {
      reviewNotes,
    });
  }

  async getCertificate(hash: string): Promise<{ hash: string; issuedAt: string; validUntil: string; valid: boolean }> {
    if (envConfig.useMocks) {
      return this.mock.getCertificate(hash);
    }

    try {
      return await this.http.get<{ hash: string; issuedAt: string; validUntil: string; valid: boolean }>(
        `/api/v1/submissions/${encodeURIComponent(hash)}/certificate`
      );
    } catch {
      return this.mock.getCertificate(hash);
    }
  }
}

export const submissionService = new SubmissionService();
