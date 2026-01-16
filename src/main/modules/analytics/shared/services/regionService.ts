import { CacheKeys, getCache, setCache } from '../cache/cache';
import { regionRepository } from '../repositories';
import type { RegionRow } from '../repositories';
import { buildDescriptionMap } from '../utils';

class RegionService {
  async fetchRegions(): Promise<RegionRow[]> {
    const cached = getCache<RegionRow[]>(CacheKeys.regions);
    if (cached) {
      return cached;
    }
    const regions = await regionRepository.getAll();
    setCache(CacheKeys.regions, regions);
    const descriptionMap = buildDescriptionMap(
      regions,
      region => region.region_id,
      region => region.description
    );
    setCache(CacheKeys.regionDescriptions, descriptionMap);
    return regions;
  }

  async fetchRegionDescriptions(): Promise<Record<string, string>> {
    const cached = getCache<Record<string, string>>(CacheKeys.regionDescriptions);
    if (cached) {
      return cached;
    }
    await this.fetchRegions();
    return getCache<Record<string, string>>(CacheKeys.regionDescriptions) ?? {};
  }

  async fetchRegionDescription(regionId: string): Promise<string | undefined> {
    const descriptions = await this.fetchRegionDescriptions();
    return descriptions[regionId];
  }
}

export const regionService = new RegionService();
