const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_BASE_MS = 200;
const DEFAULT_RETRY_MAX_MS = 2000;
const DEFAULT_RETRY_JITTER_MS = 150;

type FetchJsonOptions = RequestInit & {
  timeoutMs?: number;
  retries?: number;
  retryBaseMs?: number;
  retryMaxMs?: number;
  retryJitterMs?: number;
};

export async function fetchJsonWithRetry(url: string, options: FetchJsonOptions = {}): Promise<unknown> {
  const maxRetries = options.retries ?? DEFAULT_MAX_RETRIES;
  const backoff = {
    baseMs: options.retryBaseMs ?? DEFAULT_RETRY_BASE_MS,
    maxMs: options.retryMaxMs ?? DEFAULT_RETRY_MAX_MS,
    jitterMs: options.retryJitterMs ?? DEFAULT_RETRY_JITTER_MS
  };

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await fetchJsonWithTimeout(url, options);
    } catch (error) {
      lastError = error;

      if (!shouldRetry(error) || attempt === maxRetries) {
        throw error;
      }

      const delay = computeBackoff(attempt, backoff);
      if (delay > 0) {
        await sleep(delay);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("request failed");
}

async function fetchJsonWithTimeout(url: string, options: FetchJsonOptions): Promise<unknown> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries: _retries,
    retryBaseMs: _retryBaseMs,
    retryMaxMs: _retryMaxMs,
    retryJitterMs: _retryJitterMs,
    ...init
  } = options;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal
    });

    if (!res.ok) {
      throw new HttpError(res.status);
    }

    if (res.status === 204) {
      return {};
    }

    return await res.json() as unknown;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function shouldRetry(error: unknown): boolean {
  if (error instanceof HttpError) {
    return error.status === 429 || error.status >= 500;
  }
  return true;
}

function computeBackoff(attemptIdx: number, options: { baseMs: number; maxMs: number; jitterMs: number }): number {
  const exponential = options.baseMs * 2 ** attemptIdx;
  const capped = options.maxMs > 0 ? Math.min(options.maxMs, exponential) : exponential;
  const jitter = options.jitterMs > 0 ? Math.floor(Math.random() * options.jitterMs) : 0;
  return capped + jitter;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export class HttpError extends Error {
  constructor(public readonly status: number) {
    super(`request failed with status ${status}`);
  }
}
