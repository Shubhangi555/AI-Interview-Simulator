import type { ZodType } from 'zod';

export class ApiError extends Error {
  constructor(message: string, public status: number, public retryable: boolean) {
    super(message);
    this.name = 'ApiError';
  }
}

const TIMEOUT_MS = 60_000;

/** POST JSON, enforce a timeout, normalise errors, and validate the response shape. */
export async function postJson<T>(path: string, body: unknown, schema: ZodType<T>, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TIMEOUT_MS);
  // Propagate React Query cancellation into our controller
  signal?.addEventListener('abort', () => controller.abort(), { once: true });

  let res: Response;
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(timedOut ? 'The request took too long. Try again.' : 'Network error. Check your connection.', 0, true);
  } finally {
    clearTimeout(timer);
  }

  const payload: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const p = payload as { error?: string; retryable?: boolean } | null;
    throw new ApiError(p?.error ?? `Request failed (${res.status})`, res.status, p?.retryable ?? res.status >= 500);
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new ApiError('Received an unexpected response from the server.', 502, true);
  return parsed.data;
}
