/**
 * @file config.ts
 * @description Centralized application environment configuration.
 * Adheres to KISS and prevents scattered process.env references.
 */

export const envConfig = {
  /**
   * Base URL of the backend API (Go/FastAPI/Node).
   * Default: empty string (routes to local Next.js API or mock layer).
   */
  apiUrl: process.env.NEXT_PUBLIC_API_URL || '',

  /**
   * Dedicated AI Gateway endpoint (if separate from primary API).
   */
  aiGatewayUrl: process.env.NEXT_PUBLIC_AI_GATEWAY_URL || '',

  /**
   * Explicit flag to force mock adapters for development and offline testing.
   * Defaults to 'true' if no NEXT_PUBLIC_API_URL is configured.
   */
  useMocks:
    process.env.NEXT_PUBLIC_USE_MOCKS === 'true' ||
    !process.env.NEXT_PUBLIC_API_URL,

  /**
   * Public GitHub OAuth App Client ID (if live OAuth is configured).
   */
  githubClientId: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID || '',

  /**
   * Request timeout in milliseconds for network calls.
   */
  requestTimeoutMs: 12000,
} as const;
