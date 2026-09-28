/**
 * @file ideaService.ts
 * @description Primary Idea Bank service with fallback support.
 */

import { IIdeaService, IdeaFilters, IdeaDraft } from './IIdeaService';
import { mockIdeaService } from './mockIdeaService';
import { IdeaItem } from '@/types';
import { envConfig } from '@/lib/config';
import { defaultHttpClient } from '../api/httpClient';

export class IdeaService implements IIdeaService {
  private mock = mockIdeaService;
  private http = defaultHttpClient;

  async getIdeas(filters?: IdeaFilters): Promise<IdeaItem[]> {
    if (envConfig.useMocks) {
      return this.mock.getIdeas(filters);
    }

    try {
      return await this.http.get<IdeaItem[]>('/api/v1/ideas', {
        params: {
          domain: filters?.domain,
          difficulty: filters?.difficulty,
          search: filters?.search,
        },
      });
    } catch {
      return this.mock.getIdeas(filters);
    }
  }

  async getIdeaById(id: string): Promise<IdeaItem | undefined> {
    if (envConfig.useMocks) {
      return this.mock.getIdeaById(id);
    }

    try {
      return await this.http.get<IdeaItem>(`/api/v1/ideas/${encodeURIComponent(id)}`);
    } catch {
      return this.mock.getIdeaById(id);
    }
  }

  /**
   * Publishes a problem. Sends exactly the fields the endpoint accepts: the
   * backend decodes with DisallowUnknownFields, so any extra key is a 400.
   */
  async publishIdea(draft: IdeaDraft): Promise<IdeaItem> {
    if (envConfig.useMocks) {
      return this.mock.publishIdea(draft);
    }

    return await this.http.post<IdeaItem>('/api/v1/ideas', draft);
  }
}

export const ideaService = new IdeaService();
