export type Domain = 'fintech' | 'systems' | 'logistics' | 'ai' | 'security' | 'devtools';
export type Difficulty = 'foundational' | 'intermediate' | 'production-grade';

export interface MockEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  responseSample: Record<string, unknown> | Array<unknown>;
}

export interface MockInfraSpec {
  baseUrl: string;
  starterRepoUrl: string;
  endpoints: MockEndpoint[];
  curlExample: string;
  testCriteria: string[];
}

export interface IdeaItem {
  id: string;
  title: string;
  tagline: string;
  domain: Domain;
  difficulty: Difficulty;
  estimatedHours: number;
  originStory: string;
  problemStatement: string;
  technicalRequirements: string[];
  mockInfra: MockInfraSpec;
  tags: string[];
  submissionCount: number;
}

export interface SubmissionEntry {
  hash: string;
  ideaId: string;
  ideaTitle: string;
  authorUsername: string;
  authorName: string;
  authorAvatar?: string;
  repoUrl: string;
  demoUrl?: string;
  architectureNotes: string;
  timestamp: string;
  status: 'verified' | 'pending' | 'rejected';
  testResults: {
    passed: number;
    total: number;
    suiteName: string;
  };
  metrics?: {
    latencyP99?: string;
    throughput?: string;
    coverage?: string;
  };
  proofSignature?: string;
}

export interface JobOpportunity {
  id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  salary: string;
  tags: string[];
  matchScore: number;
  matchedIdeaIds: string[];
  requiredSkills: string[];
  description: string;
  gapIdeaId?: string; // If not ready, target problem to route user back to
  gapReason?: string;
  level?: string;
  applyUrl?: string;
  sourceUrl?: string;
  scrapedAt?: string;
  adminApproved?: boolean;
  isActive?: boolean;
  match?: {
    score: number;
    matchedSkills: string[];
    missingSkills: string[];
  };
}

export interface CoachingItinerary {
  id: string;
  title: string;
  subtitle: string;
  targetRole: string;
  durationWeeks: number;
  milestones: {
    week: number;
    title: string;
    deliverable: string;
    ideaIdRef?: string;
    prompts: string[];
  }[];
}

export type EngineeringTrack =
  | 'devops-infra'
  | 'backend-systems'
  | 'frontend-ui'
  | 'fullstack'
  | 'product-design'
  | 'ai-ml'
  | 'mobile';

export type ExperienceLevel = 'junior' | 'mid' | 'senior' | 'lead';
export type AuthProvider = 'github' | 'google' | 'mock';

export interface TrackDefinition {
  id: EngineeringTrack;
  title: string;
  shortTitle: string;
  tagline: string;
  description: string;
  targetRoles: string[];
  defaultSkills: string[];
  recommendedIdeaIds: string[];
  inferredKeywords: string[];
}

import { UserRole } from './auth';

export * from './auth';
export * from './api';
export * from './launchpad';
export * from './jobs';
export * from './portfolio';

export interface UserProfile {
  username: string;
  name: string;
  avatarUrl: string;
  headline: string;
  bio: string;
  githubUrl: string;
  portfolioValidUntil: string;
  plan: 'free' | 'full-service' | 'byok';
  apiKey?: string;
  statedSkills: string[];
  role: UserRole;
  email?: string;
  updatedAt?: string;

  // Personalized Onboarding & Role Tracking
  engineeringTrack?: EngineeringTrack;
  targetRole?: string;
  experienceLevel?: ExperienceLevel;
  onboardingCompleted?: boolean;
  githubConnected?: boolean;
  githubUsername?: string;
  authProvider?: AuthProvider;
  githubVerifiedAt?: string;
}

