/**
 * @file mockIdeaService.ts
 * @description Mock service for querying and seeding problems in the Idea Bank.
 */

import { IIdeaService, IdeaFilters, IdeaDraft } from './IIdeaService';
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

  async publishIdea(draft: IdeaDraft): Promise<IdeaItem> {
    // The live backend mints a UUID and discards any client id, so the mock
    // does the same: handing back a slug would let the console display an id
    // that does not exist server-side.
    const newIdea: IdeaItem = {
      ...draft,
      id: crypto.randomUUID(),
      submissionCount: 0,
    };
    this.ideas = [newIdea, ...this.ideas];
    return newIdea;
  }
}

export const mockIdeaService = new MockIdeaService();
