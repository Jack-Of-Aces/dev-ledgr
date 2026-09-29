/**
 * @file IJobService.ts
 * @description Contract for Job Board listings, skill matching, and ATS resume audits.
 */

import { JobOpportunity, JobFilters, AdminJobFilters, CVAudit, RunCVAuditRequest } from '@/types';

export interface IJobService {
  getJobs(filters?: JobFilters): Promise<JobOpportunity[]>;
  getJobById(id: string): Promise<JobOpportunity | undefined>;
  runCVAudit(request: RunCVAuditRequest): Promise<CVAudit>;
  getAuditHistory(): Promise<CVAudit[]>;
  getAuditById(id: string): Promise<CVAudit | undefined>;

  // Moderation. These have no mock path: the mock bank cannot model a hidden
  // or removed listing, so a fallback would show an admin fabricated jobs.
  listAllJobs(filters?: AdminJobFilters): Promise<JobOpportunity[]>;
  setJobActive(id: string, active: boolean): Promise<JobOpportunity>;
  deleteJob(id: string): Promise<void>;
}
