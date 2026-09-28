/**
 * @file IJobService.ts
 * @description Contract for Job Board listings, skill matching, and ATS resume audits.
 */

import { JobOpportunity, JobFilters, CVAudit, RunCVAuditRequest } from '@/types';

export interface IJobService {
  getJobs(filters?: JobFilters): Promise<JobOpportunity[]>;
  getJobById(id: string): Promise<JobOpportunity | undefined>;
  runCVAudit(request: RunCVAuditRequest): Promise<CVAudit>;
  getAuditHistory(): Promise<CVAudit[]>;
  getAuditById(id: string): Promise<CVAudit | undefined>;
}
