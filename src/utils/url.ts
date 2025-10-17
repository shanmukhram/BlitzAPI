/**
 * URL parsing utilities
 */

export interface ParsedURL {
  pathname: string;
  query: string;
}

/**
 * Parse URL into pathname and query string
 */
export function parseURL(url: string): ParsedURL {
  const questionMarkIndex = url.indexOf('?');

  if (questionMarkIndex === -1) {
    return {
      pathname: url,
      query: '',
    };
  }

  return {
    pathname: url.slice(0, questionMarkIndex),
    query: url.slice(questionMarkIndex + 1),
  };
}

/**
 * Parse query string into object
 */
export function parseQuery(queryString: string): Record<string, string | string[]> {
  if (!queryString) {
    return {};
  }

  const params = new URLSearchParams(queryString);
  const result: Record<string, string | string[]> = {};

  params.forEach((value, key) => {
    const existing = result[key];

    if (existing) {
      // Convert to array if multiple values
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        result[key] = [existing, value];
      }
    } else {
      result[key] = value;
    }
  });

  return result;
}

/**
 * Match a route pattern against a path
 * Supports dynamic segments like /users/:id
 */
export function matchPath(
  pattern: string,
  path: string
): { matches: boolean; params: Record<string, string> } {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);

  if (patternParts.length !== pathParts.length) {
    return { matches: false, params: {} };
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];

    // Dynamic segment (e.g., :id, :userId)
    if (patternPart.startsWith(':')) {
      const paramName = patternPart.slice(1);
      params[paramName] = pathPart;
      continue;
    }

    // Static segment must match exactly
    if (patternPart !== pathPart) {
      return { matches: false, params: {} };
    }
  }

  return { matches: true, params };
}
