/**
 * @file jobs.ts
 * @description Types for Job Board opportunities, skill matching telemetry,
 * and ATS Resume compliance audits powered by Claude / heuristic engines.
 * Aligns with backend/internal/model/model.go.
 */

import { JobOpportunity } from './index';

export interface JobMatch {
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
}

export interface ATSBreakdownItem {
  category: string;
  score: number;
  notes: string;
}

export interface ATSRecommendation {
  category: string;
  priority: 'high' | 'medium' | 'low';
  issue: string;
  suggestion: string;
}

export interface CVAudit {
  id: string;
  devUsername: string;
  jobId?: string;
  score: number;
  summary: string;
  breakdown: ATSBreakdownItem[];
  recommendations: ATSRecommendation[];
  matchedKeywords: string[];
  missingKeywords: string[];
  engine: 'claude' | 'heuristic';
  model?: string;
  cvChars: number;
  createdAt: string;
}

export interface RunCVAuditRequest {
  cvText: string;
  jobId?: string;
}

export interface JobBoardResponse {
  jobs: (JobOpportunity & { match?: JobMatch })[];
}

export interface JobFilters {
  level?: 'intern' | 'junior' | 'mid' | 'senior' | 'lead' | 'unspecified';
  search?: string;
  limit?: number;
  offset?: number;
}
