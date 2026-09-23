/**
 * ApiClient — Centralized HTTP client
 *
 * Handles:
 *   - Base URL configuration
 *   - Attaching Authorization: Bearer <token> to every request
 *   - Automatic token refresh on 401 (single retry)
 *   - Consistent error shape from the Node.js API
 *   - Request timeout
 *
 * Usage:
 *   import api from './apiClient';
 *   const data = await api.get('/tenants');
 *   const result = await api.post('/auth/login', { email, password });
 */
import { getAccessToken, getRefreshToken, saveTokens, clearTokens } from './tokenStorage';

// ─── Config ───────────────────────────────────────────────────────────────────

// For local dev: your Mac's IP address so physical devices can reach it.
// Android emulator uses 10.0.2.2, iOS simulator can use localhost.
const BASE_URL = 'http://localhost:3000/api/v1';
const TIMEOUT_MS = 15000;

// ─── API Error class ──────────────────────────────────────────────────────────

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

// ─── Internal fetch wrapper ───────────────────────────────────────────────────

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError(408, 'TIMEOUT', 'Request timed out. Please check your connection.');
    }
    throw new ApiError(0, 'NETWORK_ERROR', 'Network error. Please check your connection.');
  } finally {
    clearTimeout(timer);
  }
}

// ─── Token refresh logic ──────────────────────────────────────────────────────

let _isRefreshing = false;
let _refreshQueue: Array<(token: string | null) => void> = [];

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) { return null; }

  try {
    const res = await fetchWithTimeout(`${BASE_URL}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      await clearTokens();
      return null;
    }

    const json = await res.json() as { success: boolean; data: { accessToken: string; refreshToken: string } };
    if (!json.success) { await clearTokens(); return null; }

    await saveTokens(json.data.accessToken, json.data.refreshToken);
    return json.data.accessToken;
  } catch {
    await clearTokens();
    return null;
  }
}

// ─── Core request function ────────────────────────────────────────────────────

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  isRetry = false,
): Promise<T> {
  const accessToken = await getAccessToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const options: RequestInit = {
    method,
    headers,
    ...(body !== undefined && { body: JSON.stringify(body) }),
  };

  const res = await fetchWithTimeout(`${BASE_URL}${path}`, options);

  // ── 401 → attempt token refresh once ─────────────────────────────────────
  if (res.status === 401 && !isRetry) {
    if (_isRefreshing) {
      // Queue this request until the in-flight refresh completes
      return new Promise<T>((resolve, reject) => {
        _refreshQueue.push(async (newToken) => {
          if (!newToken) {
            reject(new ApiError(401, 'UNAUTHORIZED', 'Session expired. Please log in again.'));
            return;
          }
          try {
            resolve(await request<T>(method, path, body, true));
          } catch (e) {
            reject(e);
          }
        });
      });
    }

    _isRefreshing = true;
    const newToken = await refreshAccessToken();
    _isRefreshing = false;

    // Flush the queue
    _refreshQueue.forEach(cb => cb(newToken));
    _refreshQueue = [];

    if (!newToken) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Session expired. Please log in again.');
    }

    return request<T>(method, path, body, true);
  }

  // ── Parse response ────────────────────────────────────────────────────────
  let json: unknown;
  try {
    json = await res.json();
    console.log(`[apiClient] Response for ${method} ${path}:`, JSON.stringify(json, null, 2));
  } catch (err) {
    console.error(`[apiClient] Failed to parse JSON for ${method} ${path}:`, err);
    throw new ApiError(res.status, 'PARSE_ERROR', 'Invalid response from server.');
  }

  const parsed = json as { success: boolean; data?: T; error?: { code: string; message: string; details?: unknown } };

  if (!parsed.success) {
    const err = parsed.error;
    console.error(`[apiClient] API error for ${method} ${path}:`, err);
    throw new ApiError(
      res.status,
      err?.code ?? 'API_ERROR',
      err?.message ?? 'Something went wrong.',
      err?.details,
    );
  }

  // Check if data is missing even though success is true
  if (parsed.data === undefined || parsed.data === null) {
    console.error(`[apiClient] Missing data in successful response for ${method} ${path}`);
    throw new ApiError(res.status, 'INVALID_RESPONSE', 'Server returned success but no data.');
  }

  console.log(`[apiClient] Returning data for ${method} ${path}:`, parsed.data);
  return parsed.data as T;
}

// ─── Public API ───────────────────────────────────────────────────────────────

const api = {
  get:    <T>(path: string)                     => request<T>('GET',    path),
  post:   <T>(path: string, body?: unknown)      => request<T>('POST',   path, body),
  put:    <T>(path: string, body?: unknown)      => request<T>('PUT',    path, body),
  patch:  <T>(path: string, body?: unknown)      => request<T>('PATCH',  path, body),
  delete: <T>(path: string)                     => request<T>('DELETE', path),
};

export default api;
export { BASE_URL };
