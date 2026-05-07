import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResultBroadcastBatcher } from "../worker/result-batcher";

describe("ResultBroadcastBatcher", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("coalesces many result changes into one delayed flush", () => {
    const flush = vi.fn();
    const batcher = new ResultBroadcastBatcher(flush, 1_000);

    batcher.schedule();
    batcher.schedule();
    batcher.schedule();

    expect(flush).not.toHaveBeenCalled();

    vi.advanceTimersByTime(999);
    expect(flush).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("can schedule another flush after the previous flush runs", () => {
    const flush = vi.fn();
    const batcher = new ResultBroadcastBatcher(flush, 1_000);

    batcher.schedule();
    vi.advanceTimersByTime(1_000);
    batcher.schedule();
    vi.advanceTimersByTime(1_000);

    expect(flush).toHaveBeenCalledTimes(2);
  });

  it("cancels a pending flush when the room closes", () => {
    const flush = vi.fn();
    const batcher = new ResultBroadcastBatcher(flush, 1_000);

    batcher.schedule();
    batcher.cancel();
    vi.advanceTimersByTime(1_000);

    expect(flush).not.toHaveBeenCalled();
  });
});
