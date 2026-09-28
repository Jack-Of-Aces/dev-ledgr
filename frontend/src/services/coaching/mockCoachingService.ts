/**
 * @file mockCoachingService.ts
 * @description Mock Coaching service adhering to ADR-001.
 */

import { ICoachingService } from './ICoachingService';
import { CoachingItinerary } from '@/types';
import { INITIAL_COACHING } from '@/lib/mock-data';

export class MockCoachingService implements ICoachingService {
  async getItineraries(): Promise<CoachingItinerary[]> {
    return [...INITIAL_COACHING];
  }

  async getItineraryById(id: string): Promise<CoachingItinerary | undefined> {
    return INITIAL_COACHING.find((c) => c.id === id);
  }
}

export const mockCoachingService = new MockCoachingService();
