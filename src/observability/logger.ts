/**
 * Structured logger with automatic trace ID injection
 * Replaces the old middleware/logger.ts with trace-aware logging
 */

import { getCurrentTrace } from './context.js';
import type { LogEntry, LoggingConfig } from './types.js';

/**
 * Log level enum - includes trace and fatal
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Logger configuration
 */
let loggerConfig: {
  enabled: boolean;
  level: LogLevel;
  format: 'json' | 'pretty';
  redactFields?: string[];
  includeStackTrace?: boolean;
} = {
  enabled: true,
  level: 'info',
  format: 'json',
  includeStackTrace: true,
};

/**
 * Initialize logger with configuration
 */
export function initializeLogger(config?: LoggingConfig): void {
  loggerConfig = {
    enabled: config?.enabled !== false,
    level: config?.level || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    format: config?.format || (process.env.NODE_ENV === 'production' ? 'json' : 'pretty'),
    redactFields: config?.redactFields || ['password', 'token', 'secret', 'authorization'],
    includeStackTrace: config?.includeStackTrace !== false,
  };

  if (loggerConfig.enabled) {
    console.log(`✅ Structured logging initialized (level: ${loggerConfig.level}, format: ${loggerConfig.format})`);
  }
}

/**
 * Log level priorities for filtering
 */
const LOG_LEVELS: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
};

/**
 * Check if log level should be logged
 */
function shouldLog(level: LogLevel): boolean {
  if (!loggerConfig.enabled) return false;

  const configLevel = loggerConfig.level || 'info';
  return LOG_LEVELS[level] >= LOG_LEVELS[configLevel];
}

/**
 * Redact sensitive fields from metadata
 */
function redactMetadata(metadata: Record<string, any>): Record<string, any> {
  if (!loggerConfig.redactFields || loggerConfig.redactFields.length === 0) {
    return metadata;
  }

  const redacted = { ...metadata };

  for (const field of loggerConfig.redactFields) {
    if (field in redacted) {
      redacted[field] = '[REDACTED]';
    }
  }

  return redacted;
}

/**
 * Format log entry
 */
function formatLog(entry: LogEntry): string {
  if (loggerConfig.format === 'pretty') {
    const trace = entry.traceId ? ` [trace:${entry.traceId.substring(0, 8)}]` : '';
    const meta = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : '';
    return `[${entry.timestamp}] ${entry.level.toUpperCase()}${trace}: ${entry.message}${meta}`;
  }

  // JSON format
  return JSON.stringify(entry);
}

/**
 * Create log entry with trace context
 */
function createLogEntry(
  level: LogLevel,
  message: string,
  metadata?: Record<string, any>
): LogEntry {
  const trace = getCurrentTrace();

  // Capture stack trace for errors if enabled
  let stack: string | undefined;
  if ((level === 'error' || level === 'fatal') && loggerConfig.includeStackTrace) {
    const error = new Error();
    stack = error.stack?.split('\n').slice(2).join('\n'); // Remove createLogEntry frames
  }

  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    traceId: trace?.traceId,
    spanId: trace?.spanId,
    protocol: trace?.protocol,
    operationName: trace?.operationName,
    metadata: metadata ? redactMetadata(metadata) : undefined,
    stack,
  };
}

/**
 * Write log to output
 */
function writeLog(entry: LogEntry): void {
  const formatted = formatLog(entry);

  switch (entry.level) {
    case 'trace':
    case 'debug':
    case 'info':
      console.log(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    case 'error':
    case 'fatal':
      console.error(formatted);
      break;
  }
}

/**
 * Trace log (ultra-verbose)
 */
export function trace(message: string, metadata?: Record<string, any>): void {
  if (!shouldLog('trace')) return;
  const entry = createLogEntry('trace', message, metadata);
  writeLog(entry);
}

/**
 * Debug log
 */
export function debug(message: string, metadata?: Record<string, any>): void {
  if (!shouldLog('debug')) return;
  const entry = createLogEntry('debug', message, metadata);
  writeLog(entry);
}

/**
 * Info log
 */
export function info(message: string, metadata?: Record<string, any>): void {
  if (!shouldLog('info')) return;
  const entry = createLogEntry('info', message, metadata);
  writeLog(entry);
}

/**
 * Warning log
 */
export function warn(message: string, metadata?: Record<string, any>): void {
  if (!shouldLog('warn')) return;
  const entry = createLogEntry('warn', message, metadata);
  writeLog(entry);
}

/**
 * Error log
 */
export function error(message: string, metadata?: Record<string, any>): void {
  if (!shouldLog('error')) return;
  const entry = createLogEntry('error', message, metadata);
  writeLog(entry);
}

/**
 * Fatal log (critical errors)
 */
export function fatal(message: string, metadata?: Record<string, any>): void {
  if (!shouldLog('fatal')) return;
  const entry = createLogEntry('fatal', message, metadata);
  writeLog(entry);
}

/**
 * Logger instance with all methods
 */
export const logger = {
  trace,
  debug,
  info,
  warn,
  error,
  fatal,
};
