/**
 * @file ICoachingService.ts
 * @description Contract for coaching itineraries and milestone curricula.
 */

import { CoachingItinerary } from '@/types';

export interface ICoachingService {
  getItineraries(): Promise<CoachingItinerary[]>;
  getItineraryById(id: string): Promise<CoachingItinerary | undefined>;
}
