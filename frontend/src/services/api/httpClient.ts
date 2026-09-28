/**
 * @file httpClient.ts
 * @description Resilient, typed HTTP client wrapper around the native Fetch API.
 * Adheres to SRP: handles request serialization, headers, timeouts, and error normalization.
 */

import { ApiError } from '@/types/api';
import { envConfig } from '@/lib/config';
import { getClientCookie, AUTH_COOKIE_NAME } from '@/lib/cookies';
import { getSupabase } from '@/lib/supabase';

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  params?: Record<string, string | number | boolean | undefined>;
}

export class HttpClient {
  private baseUrl: string;

  constructor(baseUrl: string = envConfig.apiUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private buildUrl(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>
  ): string {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    // In the browser, use same-origin relative URLs (/api/...) so Next.js rewrites
    // proxy calls server-side, preventing browser CORS preflight blocks.
    const isBrowser = typeof window !== 'undefined';
    const fullUrl = isBrowser
      ? cleanEndpoint
      : (this.baseUrl ? `${this.baseUrl}${cleanEndpoint}` : cleanEndpoint);

    if (!params) return fullUrl;

    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        query.append(key, String(value));
      }
    });

    const queryString = query.toString();
    return queryString ? `${fullUrl}?${queryString}` : fullUrl;
  }

  /**
   * Resolves the bearer token for a request.
   *
   * A live Supabase session wins over the devledgr_session cookie. That ordering
   * is the whole point: the cookie is written once at sign-in and kept for seven
   * days, while the access token inside it is only valid for an hour. Preferring
   * the cookie meant that after the first hour every call carried a dead token
   * and came back 401 INVALID_TOKEN, with no refresh in sight — which is exactly
   * what broke saving onboarding. Supabase's client keeps its token current, so
   * reading from the session first makes the cookie a fallback rather than the
   * source of truth.
   */
  private async getAuthHeader(): Promise<Record<string, string>> {
    let token: string | null = null;

    if (typeof window !== 'undefined') {
      const supabase = getSupabase();
      if (supabase) {
        try {
          const { data } = await supabase.auth.getSession();
          token = data.session?.access_token ?? null;
        } catch {
          // Fall through to the cookie below.
        }
      }
    }

    if (!token) {
      token = getClientCookie(AUTH_COOKIE_NAME);
    }

    // Last resort: a session in localStorage that the Supabase client is not
    // managing, e.g. a Supabase version that stored it under a different key.
    if (!token && typeof window !== 'undefined' && window.localStorage) {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes('auth-token') || key.startsWith('sb-'))) {
            const raw = localStorage.getItem(key);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed?.access_token) {
                token = parsed.access_token;
                break;
              }
            }
          }
        }
      } catch {
        // ignore storage access errors
      }
    }

    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * Forces Supabase to mint a new access token, so a request that was rejected
   * with INVALID_TOKEN can be retried once instead of failing outright.
   */
  private async refreshAccessToken(): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    const supabase = getSupabase();
    if (!supabase) return null;
    try {
      const { data, error } = await supabase.auth.refreshSession();
      return error ? null : (data.session?.access_token ?? null);
    } catch {
      return null;
    }
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    return this.send<T>(endpoint, options, true);
  }

  /**
   * send issues the request, retrying once after a forced token refresh when the
   * API rejects an expired token.
   *
   * `canRetry` is threaded through rather than looped, so a genuinely
   * unauthorized request fails once instead of hammering the auth endpoint.
   */
  private async send<T>(
    endpoint: string,
    options: RequestOptions,
    canRetry: boolean
  ): Promise<T> {
    const { timeoutMs = envConfig.requestTimeoutMs, params, headers, ...customConfig } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const url = this.buildUrl(endpoint, params);

    const authHeader = await this.getAuthHeader();
    // A caller-supplied Authorization header wins; some routes pass a token
    // explicitly.
    const mergedHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...authHeader,
      ...headers,
    };

    try {
      const response = await fetch(url, {
        ...customConfig,
        headers: mergedHeaders,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle non-JSON or empty responses (e.g. 204 No Content)
      if (response.status === 204) {
        return {} as T;
      }

      const contentType = response.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');
      const data = isJson ? await response.json() : await response.text();

      if (!response.ok) {
        const code = typeof data === 'object' ? data?.code : undefined;
        if (canRetry && response.status === 401 && code === 'INVALID_TOKEN') {
          const refreshed = await this.refreshAccessToken();
          if (refreshed) {
            return this.send<T>(endpoint, { ...options, headers: { ...headers, Authorization: `Bearer ${refreshed}` } }, false);
          }
        }
        throw new ApiError({
          message:
            (typeof data === 'object' && data?.message) ||
            `HTTP ${response.status}: ${response.statusText}`,
          statusCode: response.status,
          code,
          errors: typeof data === 'object' ? data?.errors : undefined,
        });
      }

      return data as T;
    } catch (error: unknown) {
      clearTimeout(timeoutId);

      if (error instanceof ApiError) {
        throw error;
      }

      // Check if it was an abort/timeout
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ApiError({
          message: `Network request timed out after ${timeoutMs}ms`,
          statusCode: 408,
          code: 'REQUEST_TIMEOUT',
        });
      }

      throw new ApiError({
        message: error instanceof Error ? error.message : 'Unknown network error',
        statusCode: 0,
        code: 'NETWORK_ERROR',
      });
    }
  }

  get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  put<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  patch<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const defaultHttpClient = new HttpClient();
