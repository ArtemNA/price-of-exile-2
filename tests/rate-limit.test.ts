import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Cache } from '../src/lib/apt/web/price-check/trade/Cache';
import { RateLimiter } from '../src/lib/apt/web/price-check/trade/RateLimiter';
import {
  adjustRateLimits,
  preventQueueCreation,
  RATE_LIMIT_RULES_REVISION,
} from '../src/lib/apt/web/price-check/trade/common';
import { API_LATENCY_SECONDS } from '../src/app/constants';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('RateLimiter', () => {
  it('lets max requests through, then waits for the window', async () => {
    const limiter = new RateLimiter(1, 5);
    await limiter.wait();
    expect(limiter.isFullyUtilized).toBe(true);

    let second = false;
    limiter.wait().then(() => (second = true));
    await vi.advanceTimersByTimeAsync(4_999);
    expect(second).toBe(false);
    expect(limiter.queue()).toBe(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(second).toBe(true);
    expect(limiter.queue()).toBe(0);
  });

  it('bumps revision when the stack changes', async () => {
    const limiter = new RateLimiter(2, 1);
    const before = limiter.revision();
    await limiter.wait();
    expect(limiter.revision()).toBe(before + 1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(limiter.revision()).toBe(before + 2);
    expect(limiter.stack).toHaveLength(0);
  });

  it('estimates the time for a number of requests', () => {
    expect(RateLimiter.estimateTime(3, [new RateLimiter(1, 5)])).toBe(10_000);
    expect(RateLimiter.estimateTime(3, [new RateLimiter(3, 5)])).toBe(0);
  });
});

describe('adjustRateLimits', () => {
  // Headers as returned by POST /api/trade/search.
  const headers = new Headers({
    'x-rate-limit-rules': 'Ip',
    'x-rate-limit-ip': '8:10:60,15:60:300,60:300:1800',
    'x-rate-limit-ip-state': '1:10:0,2:60:0,3:300:0',
  });

  it('replaces client limits with the server rules and their state', () => {
    const limits = new Set([new RateLimiter(1, 5)]);
    const revision = RATE_LIMIT_RULES_REVISION();
    adjustRateLimits(limits, headers);

    const rules = [...limits].map((l) => [l.max, l.window, l.stack.length]);
    expect(rules).toEqual([
      [8, 10 + API_LATENCY_SECONDS, 1],
      [15, 60 + API_LATENCY_SECONDS, 2],
      [60, 300 + API_LATENCY_SECONDS, 3],
    ]);
    expect(RATE_LIMIT_RULES_REVISION()).toBeGreaterThan(revision);
  });

  it('ignores responses without rate limit headers', () => {
    const limits = new Set([new RateLimiter(1, 5)]);
    adjustRateLimits(limits, new Headers());
    expect([...limits].map((l) => [l.max, l.window])).toEqual([[1, 5]]);
  });
});

describe('preventQueueCreation', () => {
  it('throws when a request would have to wait for 1.5 s or more', async () => {
    const limiter = new RateLimiter(1, 5);
    await limiter.wait();
    expect(() => preventQueueCreation([{ count: 1, limiters: [limiter] }])).toThrow('Retry after 5 seconds');
  });

  it('passes when the limiter is free', () => {
    expect(() => preventQueueCreation([{ count: 1, limiters: [new RateLimiter(1, 5)] }])).not.toThrow();
  });
});

describe('Cache', () => {
  it('keys by value and expires after the TTL', () => {
    const cache = new Cache();
    cache.set({ query: 'a' }, 42, 300);
    expect(cache.get({ query: 'a' })).toBe(42);
    expect(cache.get({ query: 'b' })).toBeUndefined();
    vi.advanceTimersByTime(300_000);
    expect(cache.get({ query: 'a' })).toBeUndefined();
  });
});
