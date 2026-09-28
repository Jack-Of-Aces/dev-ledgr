/**
 * @file coachingService.ts
 * @description Primary Coaching Service connecting to Go backend (/api/v1/coaching).
 * Adheres to ADR-001: Graceful fallback on read.
 */

import { ICoachingService } from './ICoachingService';
import { mockCoachingService } from './mockCoachingService';
import { CoachingItinerary } from '@/types';
import { envConfig } from '@/lib/config';
import { defaultHttpClient } from '../api/httpClient';

export class CoachingService implements ICoachingService {
  private mock = mockCoachingService;
  private http = defaultHttpClient;

  async getItineraries(): Promise<CoachingItinerary[]> {
    if (envConfig.useMocks) {
      return this.mock.getItineraries();
    }

    try {
      const res = await this.http.get<CoachingItinerary[]>('/api/v1/coaching');
      if (Array.isArray(res) && res.length > 0) {
        return res;
      }
      return this.mock.getItineraries();
    } catch {
      return this.mock.getItineraries();
    }
  }

  async getItineraryById(id: string): Promise<CoachingItinerary | undefined> {
    if (envConfig.useMocks) {
      return this.mock.getItineraryById(id);
    }

    try {
      return await this.http.get<CoachingItinerary>(`/api/v1/coaching/${encodeURIComponent(id)}`);
    } catch {
      return this.mock.getItineraryById(id);
    }
  }
}

export const coachingService = new CoachingService();
