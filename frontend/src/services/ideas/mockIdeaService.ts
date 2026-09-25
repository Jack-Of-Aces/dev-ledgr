/**
 * @file mockIdeaService.ts
 * @description Mock service for querying and seeding problems in the Idea Bank.
 */

import { IIdeaService, IdeaFilters } from './IIdeaService';
import { IdeaItem } from '@/types';
import { INITIAL_IDEAS } from '@/lib/mock-data';

export class MockIdeaService implements IIdeaService {
  private ideas: IdeaItem[] = [...INITIAL_IDEAS];

  async getIdeas(filters?: IdeaFilters): Promise<IdeaItem[]> {
    let result = [...this.ideas];

    if (filters?.domain) {
      result = result.filter((i) => i.domain === filters.domain);
    }
    if (filters?.difficulty) {
      result = result.filter((i) => i.difficulty === filters.difficulty);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.tagline.toLowerCase().includes(q) ||
          i.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return result;
  }

  async getIdeaById(id: string): Promise<IdeaItem | undefined> {
    return this.ideas.find((i) => i.id === id);
  }

  async seedIdea(idea: Omit<IdeaItem, 'submissionCount'>): Promise<IdeaItem> {
    const newIdea: IdeaItem = {
      ...idea,
      submissionCount: 0,
    };
    this.ideas = [newIdea, ...this.ideas];
    return newIdea;
  }
}

export const mockIdeaService = new MockIdeaService();
