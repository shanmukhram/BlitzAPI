import type { IncomingMessage, ServerResponse } from 'http';
import type { Context, HTTPMethod } from './types.js';
import { parseURL, parseQuery } from '../utils/url.js';

/**
 * Creates a context object for request handling
 * This is the core abstraction that handlers and middleware interact with
 */
export function createContext(
  req: IncomingMessage,
  res: ServerResponse
): Context {
  const url = req.url || '/';
  const { pathname, query } = parseURL(url);
  const method = req.method as HTTPMethod;

  // Parse headers into a simple object
  const headers: Record<string, string | string[] | undefined> = {};
  if (req.headers) {
    Object.entries(req.headers).forEach(([key, value]) => {
      headers[key.toLowerCase()] = value;
    });
  }

  let responseSent = false;

  const ctx: Context = {
    req,
    res,
    method,
    url,
    path: pathname,
    query: parseQuery(query),
    params: {},
    body: undefined,
    headers,
    state: {},
    user: undefined,

    // Response helper: send JSON
    json(data: unknown, status = 200) {
      if (responseSent) {
        throw new Error('Response already sent');
      }
      responseSent = true;

      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
    },

    // Response helper: send plain text
    text(data: string, status = 200) {
      if (responseSent) {
        throw new Error('Response already sent');
      }
      responseSent = true;

      res.statusCode = status;
      res.setHeader('Content-Type', 'text/plain');
      res.end(data);
    },

    // Response helper: set status code
    status(code: number) {
      res.statusCode = code;
      return ctx;
    },

    // Response helper: set header
    setHeader(key: string, value: string) {
      res.setHeader(key, value);
      return ctx;
    },
  };

  return ctx;
}

/**
 * Parses request body based on Content-Type
 */
export async function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const buffer = Buffer.concat(chunks);
        const body = buffer.toString('utf-8');

        if (!body) {
          resolve(undefined);
          return;
        }

        // Parse JSON
        if (contentType.includes('application/json')) {
          resolve(JSON.parse(body));
          return;
        }

        // Parse URL-encoded
        if (contentType.includes('application/x-www-form-urlencoded')) {
          const params = new URLSearchParams(body);
          const result: Record<string, string> = {};
          params.forEach((value, key) => {
            result[key] = value;
          });
          resolve(result);
          return;
        }

        // Default: return raw string
        resolve(body);
      } catch (error) {
        reject(new Error('Failed to parse request body'));
      }
    });

    req.on('error', reject);
  });
}
