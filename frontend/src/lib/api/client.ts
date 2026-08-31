/**
 * HTTP client and runtime configuration.
 *
 * Every network call in the frontend goes through here, which gives us one place
 * to attach the bearer token, one place to normalise errors, and one place to
 * decide between the live FastAPI backend and the self-contained demo data layer.
 *
 * Security note (spec §43): this client sends only what an endpoint needs and
 * stores only the opaque session token. Face embeddings, model configuration,
 * database credentials and password hashes never cross this boundary — if a
 * response ever contains them, that is a backend defect, not something the
 * frontend should start rendering.
 */

import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios';

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

export const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  'http://localhost:8000';

export const API_TIMEOUT = Number(
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_TIMEOUT) ?? 30_000
);

export const DEMO_MODE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEMO_MODE) === 'true';

/** Simulated per-request latency in demo mode, so loading states are real. */
export const DEMO_LATENCY = {
  fast: 180,
  normal: 420,
  slow: 900,
} as const;

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/* -------------------------------------------------------------------------- */
/* Session token                                                              */
/* -------------------------------------------------------------------------- */

const TOKEN_STORAGE_KEY = 'veriguard.session.token';

let authToken: string | null = null;

function hasStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function setAuthToken(token: string | null): void {
  authToken = token;
  if (!hasStorage()) return;
  try {
    if (token) window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Storage may be unavailable (private mode); the in-memory token still works.
  }
}

export function getAuthToken(): string | null {
  if (authToken) return authToken;
  if (!hasStorage()) return null;
  try {
    authToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    authToken = null;
  }
  return authToken;
}

export function clearAuthToken(): void {
  setAuthToken(null);
}

/* -------------------------------------------------------------------------- */
/* Errors                                                                     */
/* -------------------------------------------------------------------------- */

export type ApiErrorKind =
  | 'NETWORK'
  | 'TIMEOUT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'RATE_LIMIT'
  | 'SERVER'
  | 'NOT_IMPLEMENTED'
  | 'UNKNOWN';

/** A normalised, officer-safe error. Server stack traces never reach the UI. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  /** Whether retrying the same request could plausibly succeed. */
  readonly retryable: boolean;

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.retryable = kind === 'NETWORK' || kind === 'TIMEOUT' || kind === 'SERVER';
  }
}

const KIND_MESSAGES: Record<ApiErrorKind, string> = {
  NETWORK: 'Could not reach the VeriGuard service. Check the connection and try again.',
  TIMEOUT: 'The service did not respond in time. The analysis may be incomplete.',
  UNAUTHORIZED: 'Your session has expired. Sign in again to continue.',
  FORBIDDEN: 'Your role does not permit this action.',
  NOT_FOUND: 'The requested record could not be found.',
  VALIDATION: 'The request was rejected as invalid.',
  RATE_LIMIT: 'Too many requests. Wait a moment and try again.',
  SERVER: 'The service reported an internal error.',
  NOT_IMPLEMENTED: 'This analysis service is not available on the connected backend.',
  UNKNOWN: 'An unexpected error occurred.',
};

function kindFromStatus(status: number): ApiErrorKind {
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 422 || status === 400) return 'VALIDATION';
  if (status === 429) return 'RATE_LIMIT';
  if (status === 501) return 'NOT_IMPLEMENTED';
  if (status >= 500) return 'SERVER';
  return 'UNKNOWN';
}

/**
 * Extracts a safe message from a FastAPI error body.
 * Only `detail` strings are surfaced; anything structured falls back to the
 * generic per-kind copy so internal field names are not leaked to an officer.
 */
function safeDetail(data: unknown): string | undefined {
  if (typeof data === 'string' && data.length < 240) return data;
  if (data && typeof data === 'object' && 'detail' in data) {
    const detail = (data as { detail: unknown }).detail;
    if (typeof detail === 'string' && detail.length < 240) return detail;
  }
  return undefined;
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
      return new ApiError('TIMEOUT', KIND_MESSAGES.TIMEOUT);
    }
    if (!axiosError.response) {
      return new ApiError('NETWORK', KIND_MESSAGES.NETWORK);
    }
    const status = axiosError.response.status;
    const kind = kindFromStatus(status);
    return new ApiError(kind, safeDetail(axiosError.response.data) ?? KIND_MESSAGES[kind], status);
  }

  return new ApiError('UNKNOWN', KIND_MESSAGES.UNKNOWN);
}

/** Thrown for spec endpoints the connected backend has not implemented. */
export function notImplemented(endpoint: string): ApiError {
  return new ApiError(
    'NOT_IMPLEMENTED',
    `${KIND_MESSAGES.NOT_IMPLEMENTED} (${endpoint})`,
    501,
  );
}

/* -------------------------------------------------------------------------- */
/* Axios instance                                                             */
/* -------------------------------------------------------------------------- */

export const http: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: { Accept: 'application/json' },
});

http.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let unauthorizedHandler: (() => void) | null = null;

/** Lets the auth provider tear down the session when the API rejects the token. */
export function onUnauthorized(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const apiError = toApiError(error);
    if (apiError.kind === 'UNAUTHORIZED') {
      clearAuthToken();
      unauthorizedHandler?.();
    }
    return Promise.reject(apiError);
  },
);

/* -------------------------------------------------------------------------- */
/* Request helpers                                                            */
/* -------------------------------------------------------------------------- */

export async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await http.get<T>(url, config);
  return response.data;
}

export async function apiPost<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await http.post<T>(url, body, config);
  return response.data;
}

/**
 * Rewrites a backend-relative asset path onto the Next.js proxy.
 * The backend serves processed images from `/static/...`; `next.config.mjs`
 * proxies `/backend-static/...` to it so the browser stays same-origin.
 */
export function resolveAssetUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/^(https?:|data:|blob:)/.test(url)) return url;
  const path = url.replace(/^\/?static\//, '').replace(/^\//, '');
  return `/backend-static/${path}`;
}

/* -------------------------------------------------------------------------- */
/* Key normalisation                                                          */
/* -------------------------------------------------------------------------- */

function toCamel(key: string): string {
  return key.replace(/[_-]([a-z0-9])/g, (_, ch: string) => ch.toUpperCase());
}

/**
 * Deep-converts `snake_case` keys to `camelCase`.
 *
 * FastAPI conventionally serialises snake_case while the frontend types in
 * `lib/types` are camelCase. Normalising once here means every endpoint works
 * whichever convention the backend settles on, instead of each API module
 * hand-mapping field names it can only guess at today.
 */
export function camelize<T>(value: unknown): T {
  if (Array.isArray(value)) {
    return value.map((item) => camelize(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(source)) {
      output[toCamel(key)] = camelize(source[key]);
    }
    return output as T;
  }
  return value as T;
}
