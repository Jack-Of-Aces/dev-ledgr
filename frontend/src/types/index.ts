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
}

export interface JobOpportunity {
  id: string;
  title: string;
  company: string;
  location: string;
  type: 'Full-time' | 'Contract' | 'Remote';
  salary: string;
  tags: string[];
  matchScore: number;
  matchedIdeaIds: string[];
  requiredSkills: string[];
  description: string;
  gapIdeaId?: string; // If not ready, target problem to route user back to
  gapReason?: string;
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

import { UserRole } from './auth';

export * from './auth';
export * from './api';

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
}

