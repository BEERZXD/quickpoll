import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StorageWriteBatcher } from "../worker/storage-batcher";

describe("StorageWriteBatcher", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("coalesces pending writes and persists only the latest state", async () => {
    const persist = vi.fn(async () => {});
    const batcher = new StorageWriteBatcher(persist, 500);

    batcher.schedule("first");
    batcher.schedule("latest");

    expect(persist).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);

    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith("latest");
  });

  it("force flushes the pending state and cancels the delayed write", async () => {
    const persist = vi.fn(async () => {});
    const batcher = new StorageWriteBatcher(persist, 500);

    batcher.schedule("state");
    await batcher.flush();
    await vi.advanceTimersByTimeAsync(500);

    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith("state");
  });

  it("cancels pending writes", async () => {
    const persist = vi.fn(async () => {});
    const batcher = new StorageWriteBatcher(persist, 500);

    batcher.schedule("state");
    batcher.cancel();
    await vi.advanceTimersByTimeAsync(500);

    expect(persist).not.toHaveBeenCalled();
  });
});
