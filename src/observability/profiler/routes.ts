/**
 * Profile API endpoints
 * Provides REST API for accessing profiling data
 */

import type { Router } from '../../core/router.js';
import type { Context } from '../../core/types.js';
import { profileStorage } from './storage.js';
import { formatProfile, formatStats, formatProfileList } from './formatter.js';
import { detectPatterns } from './detector.js';

/**
 * Register profile routes on a router
 */
export function registerProfileRoutes(router: Router): void {
  // Register specific routes FIRST (before parameterized routes)

  // GET /profile/slow - Get slowest requests
  router.get('/profile/slow', async (ctx: Context) => {
    const limit = parseInt(((ctx.query as any)?.limit as string) || '10', 10);
    const format = ((ctx.query as any)?.format as string) || 'list';

    const slowProfiles = profileStorage.getSlowest(limit);

    if (format === 'json') {
      ctx.json(slowProfiles);
    } else {
      const visual = formatProfileList(slowProfiles, `Top ${limit} Slowest Requests`);
      ctx.res.setHeader('Content-Type', 'text/plain');
      ctx.text(visual);
    }
  });

  // GET /profile/budgets - Get budget violations
  router.get('/profile/budgets', async (ctx: Context) => {
    const limit = parseInt(((ctx.query as any)?.limit as string) || '20', 10);
    const format = ((ctx.query as any)?.format as string) || 'list';

    const violations = profileStorage.getBudgetViolations(limit);

    if (format === 'json') {
      ctx.json(violations);
    } else {
      const visual = formatProfileList(violations, 'Performance Budget Violations');
      ctx.res.setHeader('Content-Type', 'text/plain');
      ctx.text(visual);
    }
  });

  // GET /profile/stats - Get profiling statistics
  router.get('/profile/stats', async (ctx: Context) => {
    const format = ((ctx.query as any)?.format as string) || 'visual';
    const stats = profileStorage.getStats();

    if (format === 'json') {
      ctx.json(stats);
    } else {
      const visual = formatStats(stats);
      ctx.res.setHeader('Content-Type', 'text/plain');
      ctx.text(visual);
    }
  });

  // GET /profile/patterns - Detect patterns across profiles
  router.get('/profile/patterns', async (ctx: Context) => {
    const limit = parseInt(((ctx.query as any)?.limit as string) || '50', 10);
    const profiles = profileStorage.query({ limit });

    const { patterns, recommendations } = detectPatterns(profiles);

    ctx.json({
      totalProfilesAnalyzed: profiles.length,
      patterns,
      recommendations,
    });
  });

  // GET /profile/list - List all profiles with filtering
  router.get('/profile/list', async (ctx: Context) => {
    const {
      limit,
      offset,
      slow,
      method,
      path,
      minDuration,
      maxDuration,
      format,
    } = ctx.query as any;

    const profiles = profileStorage.query({
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      slow: slow === 'true' ? true : slow === 'false' ? false : undefined,
      method,
      path,
      minDuration: minDuration ? parseFloat(minDuration) : undefined,
      maxDuration: maxDuration ? parseFloat(maxDuration) : undefined,
    });

    if (format === 'json') {
      ctx.json(profiles);
    } else {
      const visual = formatProfileList(profiles, 'Request Profiles');
      ctx.res.setHeader('Content-Type', 'text/plain');
      ctx.text(visual);
    }
  });

  // DELETE /profile/clear - Clear all profiles
  router.delete('/profile/clear', async (ctx: Context) => {
    const count = profileStorage.count();
    profileStorage.clear();

    ctx.json({
      message: 'Profiles cleared',
      cleared: count,
    });
  });

  // GET /profile/:traceId - Get detailed profile for a specific trace
  // NOTE: This MUST be registered LAST so specific routes match first
  router.get('/profile/:traceId', async (ctx: Context) => {
    const { traceId } = (ctx.params as any);
    const format = ((ctx.query as any)?.format as string) || 'visual';

    const profile = profileStorage.get(traceId);

    if (!profile) {
      ctx.status(404);
      ctx.json({ error: 'Profile not found', traceId });
      return;
    }

    if (format === 'json') {
      ctx.json(profile);
    } else {
      // Visual ASCII format
      const visual = formatProfile(profile);
      ctx.res.setHeader('Content-Type', 'text/plain');
      ctx.text(visual);
    }
  });
}
