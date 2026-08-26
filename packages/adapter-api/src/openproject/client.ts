/**
 * OpenProject HTTP Client
 *
 * Base client for communicating with the OpenProject REST API (v3).
 * Handles authentication via API token, query-string encoding,
 * JSON serialisation and structured HTTP error propagation.
 */

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

/**
 * Thrown whenever the OpenProject API responds with a 4xx or 5xx status code.
 *
 * @property status  - HTTP status code returned by the server.
 * @property detail  - Human-readable error message extracted from the body.
 */
export class OpenProjectError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
  ) {
    super(`OpenProject API error ${status}: ${detail}`);
    this.name = 'OpenProjectError';
    // Restore prototype chain (needed when extending built-in classes in TS)
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Supported HTTP verbs for OpenProject API requests. */
export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/** Optional parameters accepted by {@link OpenProjectClient.request}. */
export interface RequestOptions {
  /** HTTP method. Defaults to `'GET'`. */
  method?: HttpMethod;
  /**
   * Query-string parameters.
   * `undefined` values are ignored (they won't be appended to the URL).
   */
  query?: Record<string, string | number | boolean | undefined>;
  /** Request body — will be JSON-serialised automatically. */
  body?: unknown;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/**
 * Thin, fetch-based client for the OpenProject REST API.
 *
 * @example
 * ```ts
 * const client = new OpenProjectClient(
 *   'https://openproject.example.com/api/v3',
 *   process.env.OPENPROJECT_API_TOKEN,
 * );
 *
 * const projects = await client.request<{ _embedded: { elements: unknown[] } }>('/projects');
 * ```
 */
export class OpenProjectClient {
  /** Pre-computed `Authorization: Basic …` header value. */
  private readonly authHeader: string;

  /**
   * @param baseUrl   - Root URL of the OpenProject API, e.g.
   *                    `https://openproject.example.com/api/v3`.
   *                    A trailing slash is handled automatically.
   * @param apiToken  - Personal API token obtained from the OpenProject
   *                    user profile page. Used as the password in HTTP
   *                    Basic authentication with username `apikey`.
   */
  constructor(
    private readonly baseUrl: string,
    apiToken: string,
  ) {
    // OpenProject expects:  Authorization: Basic base64("apikey:<token>")
    const credentials = Buffer.from(`apikey:${apiToken}`).toString('base64');
    this.authHeader = `Basic ${credentials}`;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Perform an authenticated HTTP request against the OpenProject API.
   *
   * @param path     - API path relative to `baseUrl`, e.g. `/projects` or
   *                   `/work_packages/42`. A leading slash is optional.
   * @param options  - Method, query parameters and request body.
   * @returns        Parsed JSON response body cast to `T`.
   * @throws         {@link OpenProjectError} on 4xx / 5xx responses.
   */
  async request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', query, body } = options;

    const url = this.buildUrl(path, query);

    const headers: Record<string, string> = {
      Authorization: this.authHeader,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    const fetchInit: RequestInit = { method, headers };

    if (body !== undefined && method !== 'GET') {
      fetchInit.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchInit);

    if (!response.ok) {
      const detail = await this.extractErrorDetail(response);
      throw new OpenProjectError(response.status, detail);
    }

    // 204 No Content — nothing to parse
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Combine `baseUrl` + `path` and append serialised query parameters.
   *
   * Both "base with trailing slash" and "path with leading slash" variants
   * are normalised so the resulting URL is always well-formed.
   */
  private buildUrl(
    path: string,
    query?: Record<string, string | number | boolean | undefined>,
  ): string {
    const base = this.baseUrl.replace(/\/+$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${base}${normalizedPath}`);

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    return url.toString();
  }

  /**
   * Attempt to extract a meaningful error message from the response body.
   *
   * OpenProject v3 error payloads follow the HAL format:
   * ```json
   * { "_type": "Error", "message": "The requested resource could not be found." }
   * ```
   * Falls back to the HTTP status text when parsing fails.
   */
  private async extractErrorDetail(response: Response): Promise<string> {
    const fallback = `${response.status} ${response.statusText}`;
    try {
      const body = (await response.json()) as Record<string, unknown>;
      // Check common OpenProject error field names
      const detail =
        (body.message as string | undefined) ??
        (body.detail as string | undefined) ??
        (body.error_description as string | undefined);
      return detail ?? fallback;
    } catch {
      return fallback;
    }
  }
}
