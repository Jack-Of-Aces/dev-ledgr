/**
 * @file IIdeaService.ts
 * @description Contract for Idea Bank queries and problem seeding.
 */

import { IdeaItem, Domain, Difficulty, MockInfraSpec } from '@/types';

export interface IdeaFilters {
  domain?: Domain;
  difficulty?: Difficulty;
  search?: string;
}

/**
 * The fields POST /api/v1/ideas accepts. Server-owned fields are deliberately
 * absent: the backend decodes strictly and rejects unknown keys with a 400, so
 * sending a whole IdeaItem (which carries `id` and `submissionCount`) never
 * succeeds. The id is also minted server-side, so a client-supplied one is
 * discarded rather than honoured.
 */
export interface IdeaDraft {
  title: string;
  tagline: string;
  domain: string;
  difficulty: string;
  estimatedHours: number;
  originStory: string;
  problemStatement: string;
  technicalRequirements: string[];
  mockInfra: MockInfraSpec;
  tags: string[];
  suggestedStack: string[];
  regionalHurdles: string;
  sourceUrl: string;
}

export interface IIdeaService {
  getIdeas(filters?: IdeaFilters): Promise<IdeaItem[]>;
  getIdeaById(id: string): Promise<IdeaItem | undefined>;
  /**
   * Publishes a problem. Errors propagate: a failed publish must be reported,
   * not swallowed, or the console reports a success that never reached the
   * database.
   */
  publishIdea(draft: IdeaDraft): Promise<IdeaItem>;
}
