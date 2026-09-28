/**
 * @file portfolio.ts
 * @description Types for Developer Portfolio payload, live cryptographic ledger,
 * proven skills, and HMAC-signed certificates. Aligns with backend/internal/api/portfolio.go.
 */

import { UserProfile, IdeaItem, SubmissionEntry } from './index';

export interface PortfolioStats {
  verifiedProofs: number;
  pendingSubmissions: number;
  activeBuilds: number;
  completedProblems: number;
  portfolioValidUntil?: string;
}

export interface LedgerCertificate {
  hash: string;
  issuedAt: string;
  validUntil: string;
  valid?: boolean;
}

export interface DevPortfolio {
  dev: UserProfile;
  isOwner: boolean;
  skills: string[];
  provenSkills: string[];
  stats: PortfolioStats;
  activeBuilds: IdeaItem[];
  completedProblems: IdeaItem[];
  ledger: SubmissionEntry[];
}
