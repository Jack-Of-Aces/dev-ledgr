/**
 * @file IIdeaService.ts
 * @description Contract for Idea Bank queries and problem seeding.
 */

import { IdeaItem, Domain, Difficulty } from '@/types';

export interface IdeaFilters {
  domain?: Domain;
  difficulty?: Difficulty;
  search?: string;
}

export interface IIdeaService {
  getIdeas(filters?: IdeaFilters): Promise<IdeaItem[]>;
  getIdeaById(id: string): Promise<IdeaItem | undefined>;
  seedIdea(idea: Omit<IdeaItem, 'submissionCount'>): Promise<IdeaItem>;
}
