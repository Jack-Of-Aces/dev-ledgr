/**
 * @file httpClient.ts
 * @description Resilient, typed HTTP client wrapper around the native Fetch API.
 * Adheres to SRP: handles request serialization, headers, timeouts, and error normalization.
 */

import { ApiError } from '@/types/api';
import { envConfig } from '@/lib/config';
import { getClientCookie, AUTH_COOKIE_NAME } from '@/lib/cookies';

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
    const fullUrl = this.baseUrl ? `${this.baseUrl}${cleanEndpoint}` : cleanEndpoint;

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

  private getAuthHeader(): Record<string, string> {
    const token = getClientCookie(AUTH_COOKIE_NAME);
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { timeoutMs = envConfig.requestTimeoutMs, params, headers, ...customConfig } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const url = this.buildUrl(endpoint, params);

    const mergedHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...this.getAuthHeader(),
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
        throw new ApiError({
          message:
            (typeof data === 'object' && data?.message) ||
            `HTTP ${response.status}: ${response.statusText}`,
          statusCode: response.status,
          code: typeof data === 'object' ? data?.code : undefined,
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
