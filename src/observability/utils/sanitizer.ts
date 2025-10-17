/**
 * PII redaction and data sanitization utilities
 * Prevents sensitive data from being logged or traced
 */

/**
 * Default headers to redact
 */
const REDACTED_HEADERS = [
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
  'x-csrf-token',
  'api-key',
  'apikey',
];

/**
 * Default fields to redact in JSON bodies
 */
const REDACTED_FIELDS = [
  'password',
  'token',
  'secret',
  'apiKey',
  'accessToken',
  'refreshToken',
  'creditCard',
  'ssn',
  'privateKey',
];

/**
 * Sanitize HTTP headers
 */
export function sanitizeHeaders(
  headers: Record<string, any>,
  additionalRedact?: string[]
): Record<string, any> {
  const sanitized = { ...headers };
  const toRedact = [...REDACTED_HEADERS, ...(additionalRedact || [])];

  for (const header of toRedact) {
    const key = Object.keys(sanitized).find(
      k => k.toLowerCase() === header.toLowerCase()
    );

    if (key) {
      sanitized[key] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Sanitize JSON body (recursive)
 */
export function sanitizeBody(
  body: any,
  additionalRedact?: string[]
): any {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const toRedact = [...REDACTED_FIELDS, ...(additionalRedact || [])];

  if (Array.isArray(body)) {
    return body.map(item => sanitizeBody(item, additionalRedact));
  }

  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(body)) {
    if (toRedact.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeBody(value, additionalRedact);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Redact email addresses
 */
export function redactEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '[REDACTED]';

  const visibleChars = Math.min(3, Math.floor(local.length / 2));
  const redacted = local.substring(0, visibleChars) + '***';

  return `${redacted}@${domain}`;
}

/**
 * Redact credit card numbers
 */
export function redactCreditCard(card: string): string {
  const digits = card.replace(/\D/g, '');
  if (digits.length < 13) return '[REDACTED]';

  return `****-****-****-${digits.slice(-4)}`;
}

/**
 * Sanitize URL query parameters
 */
export function sanitizeUrl(url: string, redactParams?: string[]): string {
  try {
    const urlObj = new URL(url, 'http://dummy.com');
    const toRedact = redactParams || ['token', 'apiKey', 'secret', 'password'];

    for (const param of toRedact) {
      if (urlObj.searchParams.has(param)) {
        urlObj.searchParams.set(param, '[REDACTED]');
      }
    }

    return urlObj.pathname + urlObj.search;
  } catch {
    return url;
  }
}
