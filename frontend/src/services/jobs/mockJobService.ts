/**
 * @file mockJobService.ts
 * @description Mock Job Board & ATS audit service adhering to ADR-001.
 */

import { IJobService } from './IJobService';
import { JobOpportunity, JobFilters, CVAudit, RunCVAuditRequest } from '@/types';
import { ApiError } from '@/types/api';
import { INITIAL_JOBS, DEFAULT_USER } from '@/lib/mock-data';

export class MockJobService implements IJobService {
  private audits: CVAudit[] = [];

  async getJobs(filters?: JobFilters): Promise<JobOpportunity[]> {
    let result = [...INITIAL_JOBS];

    if (filters?.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          j.company.toLowerCase().includes(q) ||
          j.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    if (filters?.offset) {
      result = result.slice(filters.offset);
    }
    if (filters?.limit) {
      result = result.slice(0, filters.limit);
    }

    return result;
  }

  async getJobById(id: string): Promise<JobOpportunity | undefined> {
    return INITIAL_JOBS.find((j) => j.id === id);
  }

  async runCVAudit(request: RunCVAuditRequest): Promise<CVAudit> {
    const targetJob = request.jobId ? INITIAL_JOBS.find((j) => j.id === request.jobId) : undefined;
    const score = Math.floor(Math.random() * 20) + 75; // 75 - 95

    const audit: CVAudit = {
      id: `audit_${Date.now()}`,
      devUsername: DEFAULT_USER.username,
      jobId: request.jobId,
      score,
      summary: `Your profile demonstrates strong proficiency in ${(DEFAULT_USER.statedSkills.length ? DEFAULT_USER.statedSkills : ['Go', 'TypeScript', 'PostgreSQL']).slice(0, 3).join(', ')}. Aligning quantifiable metrics with the requirements of ${targetJob?.company || 'target roles'} will maximize recruitment throughput.`,
      breakdown: [
        { category: 'Technical Keywords', score: 88, notes: 'Core languages and distributed system primitives match.' },
        { category: 'Impact & Metrics', score: 72, notes: 'Include latency (p99) and SLA recovery metrics in project descriptions.' },
        { category: 'ATS Architecture', score: 92, notes: 'Standard heading structure and parsing cleanliness.' },
      ],
      recommendations: [
        {
          category: 'Metrics',
          priority: 'high',
          issue: 'Missing p99 latency figures in API project descriptions.',
          suggestion: 'Explicitly state: "Engineered zero-loss idempotency layer sustaining 10,000 req/s at <35ms p99 latency".',
        },
        {
          category: 'Skills',
          priority: 'medium',
          issue: 'Proof references not directly hyperlinked.',
          suggestion: 'Embed your permanent DevLedgr verification link (e.g. dev.devledgr.xyz) at the header.',
        },
      ],
      matchedKeywords: DEFAULT_USER.statedSkills.length ? DEFAULT_USER.statedSkills : ['Go', 'TypeScript'],
      missingKeywords: targetJob ? targetJob.requiredSkills.filter((s) => !DEFAULT_USER.statedSkills.includes(s)) : ['Docker Swarm', 'Kafka'],
      engine: 'heuristic',
      model: 'heuristic-rules-v2',
      cvChars: request.cvText.length,
      createdAt: new Date().toISOString(),
    };

    this.audits.unshift(audit);
    return audit;
  }

  async getAuditHistory(): Promise<CVAudit[]> {
    return [...this.audits];
  }

  async getAuditById(id: string): Promise<CVAudit | undefined> {
    return this.audits.find((a) => a.id === id);
  }

  // The moderation methods take no parameters on purpose: the sample bank has
  // no hidden or removed listings to model, and the arguments would only be
  // ignored. Declaring no parameters still satisfies IJobService.
  async listAllJobs(): Promise<JobOpportunity[]> {
    throw new ApiError({
      message: 'Job management needs a connected backend',
      statusCode: 0,
      code: 'MOCK_MODE_UNSUPPORTED',
    });
  }

  async setJobActive(): Promise<JobOpportunity> {
    throw new ApiError({
      message: 'Job management needs a connected backend',
      statusCode: 0,
      code: 'MOCK_MODE_UNSUPPORTED',
    });
  }

  async deleteJob(): Promise<void> {
    throw new ApiError({
      message: 'Job management needs a connected backend',
      statusCode: 0,
      code: 'MOCK_MODE_UNSUPPORTED',
    });
  }
}

export const mockJobService = new MockJobService();
