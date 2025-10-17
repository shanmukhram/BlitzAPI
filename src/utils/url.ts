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

// Cache for split paths to avoid repeated splitting
const pathCache = new Map<string, string[]>();

function splitPath(path: string): string[] {
  let parts = pathCache.get(path);
  if (!parts) {
    // Optimized splitting - avoid filter() overhead
    parts = [];
    let start = path[0] === '/' ? 1 : 0;
    for (let i = start; i <= path.length; i++) {
      if (i === path.length || path[i] === '/') {
        if (i > start) {
          parts.push(path.slice(start, i));
        }
        start = i + 1;
      }
    }
    // Limit cache size to prevent memory leaks
    if (pathCache.size < 1000) {
      pathCache.set(path, parts);
    }
  }
  return parts;
}

/**
 * Match a route pattern against a path
 * Supports dynamic segments like /users/:id
 */
export function matchPath(
  pattern: string,
  path: string
): { matches: boolean; params: Record<string, string> } {
  // Fast path for exact match (most common case)
  if (pattern === path) {
    return { matches: true, params: {} };
  }

  const patternParts = splitPath(pattern);
  const pathParts = splitPath(path);

  if (patternParts.length !== pathParts.length) {
    return { matches: false, params: {} };
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];

    // Dynamic segment (e.g., :id, :userId)
    if (patternPart.charCodeAt(0) === 58) { // ':' character - faster than startsWith
      params[patternPart.slice(1)] = pathPart;
      continue;
    }

    // Static segment must match exactly
    if (patternPart !== pathPart) {
      return { matches: false, params: {} };
    }
  }

  return { matches: true, params };
}
