const DEFAULT_TIMEOUT_MS = 15000;

type FetchJsonOptions = RequestInit & {
  timeoutMs?: number;
  retries?: number;
};

export async function fetchJsonWithRetry(url: string, options: FetchJsonOptions = {}): Promise<unknown> {
  const retries = options.retries ?? 1;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchJsonWithTimeout(url, options);
    } catch (error) {
      lastError = error;

      if (!shouldRetry(error) || attempt === retries) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("request failed");
}

async function fetchJsonWithTimeout(url: string, options: FetchJsonOptions): Promise<unknown> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, retries: _retries, ...init } = options;
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
    return [502, 503, 504].includes(error.status);
  }

  return true;
}

export class HttpError extends Error {
  constructor(public readonly status: number) {
    super(`request failed with status ${status}`);
  }
}
