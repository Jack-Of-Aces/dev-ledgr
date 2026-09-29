/**
 * @file jobService.ts
 * @description Primary Job Board & ATS Resume Audit Service connecting to Go backend (/api/jobBoard/* and /api/v1/jobs).
 * Adheres to ADR-001: Graceful fallback on read; strict error propagation on write.
 */

import { IJobService } from './IJobService';
import { mockJobService } from './mockJobService';
import { JobOpportunity, JobFilters, AdminJobFilters, CVAudit, RunCVAuditRequest } from '@/types';
import { envConfig } from '@/lib/config';
import { ApiError } from '@/types/api';
import { defaultHttpClient } from '../api/httpClient';

export class JobService implements IJobService {
  private mock = mockJobService;
  private http = defaultHttpClient;

  async getJobs(filters?: JobFilters): Promise<JobOpportunity[]> {
    if (envConfig.useMocks) {
      return this.mock.getJobs(filters);
    }

    try {
      // First try the specialized /api/jobBoard/jobs endpoint which provides personalized skill ranking
      const res = await this.http.get<{ jobs: JobOpportunity[] } | JobOpportunity[]>(
        '/api/jobBoard/jobs',
        {
          params: {
            level: filters?.level,
            search: filters?.search,
            limit: filters?.limit ?? 50,
            offset: filters?.offset,
          },
        }
      );

      if (res && 'jobs' in res && Array.isArray(res.jobs)) {
        return res.jobs.length > 0 ? res.jobs : this.mock.getJobs(filters);
      }

      if (Array.isArray(res) && res.length > 0) {
        return res;
      }

      // Secondary fallback to /api/v1/jobs
      const v1Res = await this.http.get<JobOpportunity[]>('/api/v1/jobs');
      if (Array.isArray(v1Res) && v1Res.length > 0) {
        return v1Res;
      }

      return this.mock.getJobs(filters);
    } catch {
      return this.mock.getJobs(filters);
    }
  }

  async getJobById(id: string): Promise<JobOpportunity | undefined> {
    if (envConfig.useMocks) {
      return this.mock.getJobById(id);
    }

    try {
      return await this.http.get<JobOpportunity>(`/api/jobBoard/jobs/${encodeURIComponent(id)}`);
    } catch {
      try {
        return await this.http.get<JobOpportunity>(`/api/v1/jobs/${encodeURIComponent(id)}`);
      } catch {
        return this.mock.getJobById(id);
      }
    }
  }

  async runCVAudit(request: RunCVAuditRequest): Promise<CVAudit> {
    if (envConfig.useMocks) {
      return this.mock.runCVAudit(request);
    }

    try {
      return await this.http.post<CVAudit>('/api/ai/audit-cv', {
        cvText: request.cvText,
        jobId: request.jobId || undefined,
      });
    } catch {
      return await this.http.post<CVAudit>('/api/jobBoard/audit', {
        cvText: request.cvText,
        jobId: request.jobId || undefined,
      });
    }
  }

  async getAuditHistory(): Promise<CVAudit[]> {
    if (envConfig.useMocks) {
      return this.mock.getAuditHistory();
    }

    try {
      const res = await this.http.get<CVAudit[]>('/api/jobBoard/audit');
      return Array.isArray(res) ? res : [];
    } catch {
      return this.mock.getAuditHistory();
    }
  }

  async getAuditById(id: string): Promise<CVAudit | undefined> {
    if (envConfig.useMocks) {
      return this.mock.getAuditById(id);
    }

    try {
      return await this.http.get<CVAudit>(`/api/jobBoard/audit/${encodeURIComponent(id)}`);
    } catch {
      return this.mock.getAuditById(id);
    }
  }

  // Job moderation deliberately has no mock path. The sample bank has no notion
  // of a hidden or removed listing, so a fallback would render fabricated jobs
  // to an admin who is trying to reason about the real ones. This mirrors the
  // roster methods in userService, which the persona switcher taught the same
  // lesson.
  private requireLiveBackend(): void {
    if (envConfig.useMocks) {
      throw new ApiError({
        message: 'Job management needs a connected backend',
        statusCode: 0,
        code: 'MOCK_MODE_UNSUPPORTED',
      });
    }
  }

  async listAllJobs(filters?: AdminJobFilters): Promise<JobOpportunity[]> {
    this.requireLiveBackend();
    const res = await this.http.get<JobOpportunity[]>('/api/v1/admin/jobs', {
      params: {
        active: filters?.active,
        level: filters?.level,
        search: filters?.search,
        limit: filters?.limit,
      },
    });
    return Array.isArray(res) ? res : [];
  }

  async setJobActive(id: string, active: boolean): Promise<JobOpportunity> {
    this.requireLiveBackend();
    return this.http.post<JobOpportunity>(
      `/api/v1/jobs/${encodeURIComponent(id)}/active`,
      { active }
    );
  }

  async deleteJob(id: string): Promise<void> {
    this.requireLiveBackend();
    await this.http.delete<void>(`/api/v1/jobs/${encodeURIComponent(id)}`);
  }
}

export const jobService = new JobService();
