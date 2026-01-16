import { CacheKeys, getCache, setCache } from '../cache/cache';
import { courtVenueRepository } from '../repositories';
import type { CourtVenueRow } from '../repositories';
import { buildDescriptionMap } from '../utils';

class CourtVenueService {
  async fetchCourtVenues(): Promise<CourtVenueRow[]> {
    const cached = getCache<CourtVenueRow[]>(CacheKeys.courtVenues);
    if (cached) {
      return cached;
    }
    const venues = await courtVenueRepository.getAll();
    setCache(CacheKeys.courtVenues, venues);
    const descriptionMap = buildDescriptionMap(
      venues,
      venue => venue.epimms_id,
      venue => venue.site_name
    );
    setCache(CacheKeys.courtVenueDescriptions, descriptionMap);
    return venues;
  }

  async fetchCourtVenueDescriptions(): Promise<Record<string, string>> {
    const cached = getCache<Record<string, string>>(CacheKeys.courtVenueDescriptions);
    if (cached) {
      return cached;
    }
    await this.fetchCourtVenues();
    return getCache<Record<string, string>>(CacheKeys.courtVenueDescriptions) ?? {};
  }

  async fetchCourtVenueDescription(epimmsId: string): Promise<string | undefined> {
    const descriptions = await this.fetchCourtVenueDescriptions();
    return descriptions[epimmsId];
  }
}

export const courtVenueService = new CourtVenueService();
