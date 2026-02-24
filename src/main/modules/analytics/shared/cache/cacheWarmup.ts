import config from 'config';
import { schedule, validate as validateCronExpression } from 'node-cron';
import type { ScheduledTask } from 'node-cron';

import { Logger } from '../../../logging';
import { snapshotStateRepository } from '../repositories';
import type { AnalyticsQueryOptions } from '../repositories/filters';
import { caseWorkerProfileService, courtVenueService, filterService, regionService } from '../services';

const logger = Logger.getLogger('analytics-cache-warmup');

const USER_OVERVIEW_QUERY_OPTIONS: AnalyticsQueryOptions = {
  excludeRoleCategories: ['Judicial'],
};

let scheduledTask: ScheduledTask | null = null;
let warmupInFlight: Promise<void> | null = null;

async function warmReferenceCaches(): Promise<void> {
  await Promise.all([
    regionService.fetchRegions(),
    courtVenueService.fetchCourtVenues(),
    caseWorkerProfileService.fetchCaseWorkerProfiles(),
  ]);
}

export async function runAnalyticsCacheWarmup(): Promise<void> {
  logger.info('analytics cache warm-up started');

  try {
    await warmReferenceCaches();
    const snapshot = await snapshotStateRepository.fetchPublishedSnapshot();
    if (!snapshot) {
      logger.info('analytics cache warm-up completed without published snapshot');
      return;
    }

    await Promise.all([
      filterService.fetchFilterOptions(snapshot.snapshotId),
      filterService.fetchFilterOptions(snapshot.snapshotId, USER_OVERVIEW_QUERY_OPTIONS),
    ]);

    logger.info('analytics cache warm-up completed', {
      snapshotId: snapshot.snapshotId,
      warmedFilterVariants: 2,
    });
  } catch (error) {
    logger.error('analytics cache warm-up failed', error);
  }
}

function triggerAnalyticsCacheWarmup(source: 'startup' | 'cron'): void {
  if (warmupInFlight) {
    logger.warn('analytics cache warm-up skipped because previous run is still in progress', {
      source,
    });
    return;
  }

  warmupInFlight = runAnalyticsCacheWarmup().finally(() => {
    warmupInFlight = null;
  });
}

export function startAnalyticsCacheWarmup(): void {
  if (scheduledTask) {
    return;
  }

  const enabled = config.get<boolean>('analytics.cacheWarmupEnabled');
  if (!enabled) {
    logger.info('analytics cache warm-up scheduler disabled by configuration');
    return;
  }

  const cacheWarmupSchedule = config.get<string>('analytics.cacheWarmupSchedule');
  if (!validateCronExpression(cacheWarmupSchedule)) {
    logger.error('analytics cache warm-up scheduler not started because cron expression is invalid', {
      cronExpression: cacheWarmupSchedule,
    });
    return;
  }

  scheduledTask = schedule(cacheWarmupSchedule, () => {
    triggerAnalyticsCacheWarmup('cron');
  });

  logger.info('analytics cache warm-up scheduler started', {
    cronExpression: cacheWarmupSchedule,
  });

  triggerAnalyticsCacheWarmup('startup');
}

export function stopAnalyticsCacheWarmup(): void {
  if (!scheduledTask) {
    return;
  }

  scheduledTask.stop();
  scheduledTask.destroy();
  scheduledTask = null;
  logger.info('analytics cache warm-up scheduler stopped');
}
