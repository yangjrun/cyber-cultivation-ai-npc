export type LlmErrorKind = "timeout" | "http_5xx" | "http_429" | "http_4xx" | "network" | "parse" | "other";

export type LlmApiFormat = "claude" | "openai" | "mock";

export type LlmCallRecord = {
  callSite: string;
  apiFormat: LlmApiFormat;
  durationMs: number;
  success: boolean;
  errorKind?: LlmErrorKind;
  retries: number;
  tokensIn?: number;
  tokensOut?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  timestamp: number;
};

export type PerCallSiteMetrics = {
  callSite: string;
  totalCalls: number;
  successCount: number;
  errorCount: number;
  mockHitCount: number;
  errorBreakdown: Record<LlmErrorKind, number>;
  retryCount: number;
  latency: { p50: number; p95: number; max: number; mean: number };
  tokens: {
    inTotal: number;
    outTotal: number;
    cacheReadTotal: number;
    cacheCreationTotal: number;
    cacheHitRatio: number;
  };
};

export type MetricsSnapshot = {
  startedAt: number;
  uptimeSec: number;
  bufferSize: number;
  totals: { calls: number; errors: number; mockHits: number; arbiterFallbacks: number };
  perCallSite: PerCallSiteMetrics[];
};

const DEFAULT_BUFFER_SIZE = 1000;

type State = {
  startedAt: number;
  buffer: LlmCallRecord[];
  totals: { calls: number; errors: number; mockHits: number; arbiterFallbacks: number };
};

function createState(): State {
  return {
    startedAt: Date.now(),
    buffer: [],
    totals: { calls: 0, errors: 0, mockHits: 0, arbiterFallbacks: 0 }
  };
}

let state: State = createState();

function getBufferSize(): number {
  const raw = process.env.OBSERVABILITY_BUFFER_SIZE;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_BUFFER_SIZE;
}

export function recordLlmCall(record: LlmCallRecord): void {
  state.totals.calls += 1;

  if (!record.success) {
    state.totals.errors += 1;
  }

  if (record.apiFormat === "mock") {
    state.totals.mockHits += 1;
  }

  state.buffer.push(record);

  const limit = getBufferSize();
  if (state.buffer.length > limit) {
    state.buffer.splice(0, state.buffer.length - limit);
  }
}

export function recordArbiterFallback(_reason: string): void {
  state.totals.arbiterFallbacks += 1;
}

export function getMetricsSnapshot(): MetricsSnapshot {
  const now = Date.now();
  const byCallSite = new Map<string, LlmCallRecord[]>();

  for (const record of state.buffer) {
    const existing = byCallSite.get(record.callSite);
    if (existing) {
      existing.push(record);
    } else {
      byCallSite.set(record.callSite, [record]);
    }
  }

  const perCallSite: PerCallSiteMetrics[] = Array.from(byCallSite.entries())
    .map(([callSite, records]) => aggregateCallSite(callSite, records))
    .sort((a, b) => b.totalCalls - a.totalCalls);

  return {
    startedAt: state.startedAt,
    uptimeSec: Math.floor((now - state.startedAt) / 1000),
    bufferSize: state.buffer.length,
    totals: { ...state.totals },
    perCallSite
  };
}

export function resetMetricsForTests(): void {
  state = createState();
}

function aggregateCallSite(callSite: string, records: LlmCallRecord[]): PerCallSiteMetrics {
  const errorBreakdown: Record<LlmErrorKind, number> = {
    timeout: 0,
    http_5xx: 0,
    http_429: 0,
    http_4xx: 0,
    network: 0,
    parse: 0,
    other: 0
  };

  let successCount = 0;
  let errorCount = 0;
  let mockHitCount = 0;
  let retryCount = 0;
  let inTotal = 0;
  let outTotal = 0;
  let cacheReadTotal = 0;
  let cacheCreationTotal = 0;
  const latencies: number[] = [];

  for (const record of records) {
    if (record.success) {
      successCount += 1;
    } else {
      errorCount += 1;
      if (record.errorKind) {
        errorBreakdown[record.errorKind] += 1;
      }
    }

    if (record.apiFormat === "mock") {
      mockHitCount += 1;
    }

    retryCount += record.retries;
    latencies.push(record.durationMs);

    if (typeof record.tokensIn === "number") inTotal += record.tokensIn;
    if (typeof record.tokensOut === "number") outTotal += record.tokensOut;
    if (typeof record.cacheReadTokens === "number") cacheReadTotal += record.cacheReadTokens;
    if (typeof record.cacheCreationTokens === "number") cacheCreationTotal += record.cacheCreationTokens;
  }

  const cacheDenominator = cacheReadTotal + cacheCreationTotal + inTotal;
  const cacheHitRatio = cacheDenominator > 0 ? cacheReadTotal / cacheDenominator : 0;

  return {
    callSite,
    totalCalls: records.length,
    successCount,
    errorCount,
    mockHitCount,
    errorBreakdown,
    retryCount,
    latency: computeLatencyStats(latencies),
    tokens: {
      inTotal,
      outTotal,
      cacheReadTotal,
      cacheCreationTotal,
      cacheHitRatio: round(cacheHitRatio, 4)
    }
  };
}

function computeLatencyStats(samples: number[]): PerCallSiteMetrics["latency"] {
  if (samples.length === 0) {
    return { p50: 0, p95: 0, max: 0, mean: 0 };
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, value) => acc + value, 0);

  return {
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    max: sorted[sorted.length - 1] ?? 0,
    mean: round(sum / sorted.length, 2)
  };
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const rank = (p / 100) * (sortedAsc.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) {
    return sortedAsc[lower] ?? 0;
  }
  const lowerValue = sortedAsc[lower] ?? 0;
  const upperValue = sortedAsc[upper] ?? 0;
  const fraction = rank - lower;
  return round(lowerValue + (upperValue - lowerValue) * fraction, 2);
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
