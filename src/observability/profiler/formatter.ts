/**
 * Visual formatter for request profiles
 * Creates ASCII timeline visualization
 */

import type { RequestProfile, StageTiming, ProfileStats } from './types.js';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',

  // Colors
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

/**
 * Format duration with color based on severity
 */
function formatDuration(ms: number, threshold: number = 1000): string {
  const formatted = `${ms.toFixed(2)}ms`;

  if (ms < threshold * 0.5) {
    return `${colors.green}${formatted}${colors.reset}`;
  } else if (ms < threshold) {
    return `${colors.yellow}${formatted}${colors.reset}`;
  } else {
    return `${colors.red}${formatted}${colors.reset}`;
  }
}

/**
 * Create a percentage bar
 */
function createBar(percentage: number, width: number = 20): string {
  const filled = Math.floor((percentage / 100) * width);
  const empty = width - filled;

  let bar = '▓'.repeat(filled) + '░'.repeat(empty);

  // Color based on percentage
  if (percentage > 50) {
    bar = `${colors.red}${bar}${colors.reset}`;
  } else if (percentage > 20) {
    bar = `${colors.yellow}${bar}${colors.reset}`;
  } else {
    bar = `${colors.green}${bar}${colors.reset}`;
  }

  return bar;
}

/**
 * Format a single stage line
 */
function formatStage(stage: StageTiming, total: number, isLast: boolean = false): string {
  const percentage = (stage.duration / total) * 100;
  const bar = createBar(percentage, 16);
  const duration = formatDuration(stage.duration);
  const pct = `${percentage.toFixed(1)}%`;

  const prefix = isLast ? '└─' : '├─';
  const warning = percentage > 50 ? ` ${colors.red}⚠️  SLOW${colors.reset}` : '';

  return `${prefix} ${colors.bold}${stage.name.padEnd(18)}${colors.reset} ${bar} ${duration.padEnd(15)} (${pct})${warning}`;
}

/**
 * Format memory delta
 */
function formatMemoryDelta(delta: number): string {
  const abs = Math.abs(delta);
  const mb = (abs / 1024 / 1024).toFixed(2);

  if (delta > 0) {
    return `${colors.red}+${mb}MB${colors.reset}`;
  } else if (delta < 0) {
    return `${colors.green}-${mb}MB${colors.reset}`;
  } else {
    return `${colors.gray}0MB${colors.reset}`;
  }
}

/**
 * Format request profile as ASCII timeline
 */
export function formatProfile(profile: RequestProfile): string {
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push(`${colors.bold}${colors.cyan}Request Profile${colors.reset}`);
  lines.push(`${colors.gray}═══════════════════════════════════════════════════════════════${colors.reset}`);
  lines.push('');

  // Metadata
  lines.push(`${colors.bold}Trace ID:${colors.reset}      ${profile.traceId}`);
  lines.push(`${colors.bold}Operation:${colors.reset}     ${profile.method} ${profile.path}`);
  lines.push(`${colors.bold}Total Time:${colors.reset}    ${formatDuration(profile.stages.total)}`);

  if (profile.slow) {
    lines.push(`${colors.red}${colors.bold}Status:${colors.reset}        ${colors.red}SLOW ⚠️${colors.reset}`);
  } else {
    lines.push(`${colors.bold}Status:${colors.reset}        ${colors.green}OK ✓${colors.reset}`);
  }

  lines.push('');

  // Timeline
  lines.push(`${colors.bold}Timeline (${profile.stages.total.toFixed(2)}ms total):${colors.reset}`);

  profile.breakdown.forEach((stage, index) => {
    const isLast = index === profile.breakdown.length - 1;
    lines.push(formatStage(stage, profile.stages.total, isLast));
  });

  // Memory (if available)
  if (profile.memory) {
    lines.push('');
    lines.push(`${colors.bold}Memory:${colors.reset}`);
    lines.push(`  Heap Delta: ${formatMemoryDelta(profile.memory.delta.heapUsed)}`);
    lines.push(`  RSS Delta:  ${formatMemoryDelta(profile.memory.delta.rss)}`);
  }

  // Bottlenecks
  if (profile.bottlenecks.length > 0) {
    lines.push('');
    lines.push(`${colors.bold}${colors.red}Bottlenecks:${colors.reset}`);
    profile.bottlenecks.forEach(bottleneck => {
      lines.push(`  ${colors.red}•${colors.reset} ${bottleneck}`);
    });
  }

  lines.push('');
  lines.push(`${colors.gray}═══════════════════════════════════════════════════════════════${colors.reset}`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Format profile statistics
 */
export function formatStats(stats: ProfileStats): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(`${colors.bold}${colors.cyan}Profile Statistics${colors.reset}`);
  lines.push(`${colors.gray}═══════════════════════════════════════════════════════════════${colors.reset}`);
  lines.push('');

  lines.push(`${colors.bold}Total Profiles:${colors.reset}      ${stats.totalProfiles}`);
  lines.push(`${colors.bold}Slow Requests:${colors.reset}       ${stats.slowRequests} (${((stats.slowRequests / stats.totalProfiles) * 100).toFixed(1)}%)`);
  lines.push(`${colors.bold}Budget Violations:${colors.reset}   ${stats.budgetViolations}`);
  lines.push(`${colors.bold}Bottlenecks Found:${colors.reset}   ${stats.bottlenecksDetected}`);
  lines.push('');

  lines.push(`${colors.bold}Latency:${colors.reset}`);
  lines.push(`  Average: ${formatDuration(stats.averageDuration)}`);
  lines.push(`  P50:     ${formatDuration(stats.p50Duration)}`);
  lines.push(`  P95:     ${formatDuration(stats.p95Duration)}`);
  lines.push(`  P99:     ${formatDuration(stats.p99Duration)}`);
  lines.push('');

  lines.push(`${colors.gray}═══════════════════════════════════════════════════════════════${colors.reset}`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Format profile list
 */
export function formatProfileList(profiles: RequestProfile[], title: string = 'Profiles'): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(`${colors.bold}${colors.cyan}${title}${colors.reset}`);
  lines.push(`${colors.gray}═══════════════════════════════════════════════════════════════${colors.reset}`);
  lines.push('');

  if (profiles.length === 0) {
    lines.push(`${colors.gray}No profiles found${colors.reset}`);
  } else {
    profiles.forEach((profile, index) => {
      const num = `${index + 1}.`.padEnd(4);
      const duration = formatDuration(profile.stages.total);
      const method = profile.method.padEnd(6);
      const path = profile.path.padEnd(30);
      const slow = profile.slow ? ` ${colors.red}⚠️${colors.reset}` : '';

      lines.push(`${colors.gray}${num}${colors.reset} ${duration.padEnd(20)} ${method} ${path}${slow}`);
    });
  }

  lines.push('');
  lines.push(`${colors.gray}═══════════════════════════════════════════════════════════════${colors.reset}`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Format for JSON output (no colors)
 */
export function formatProfileJSON(profile: RequestProfile): string {
  return JSON.stringify(profile, null, 2);
}
