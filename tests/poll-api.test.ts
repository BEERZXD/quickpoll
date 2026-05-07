import { afterEach, describe, expect, it, vi } from "vitest";
import { realtimeHttpUrl } from "../src/lib/poll-api";

describe("poll-api", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the current browser hostname for the local realtime fallback", () => {
    vi.stubGlobal("window", {
      location: {
        hostname: "127.0.0.1",
        protocol: "http:",
      },
    });

    expect(realtimeHttpUrl("/polls")).toBe("http://127.0.0.1:8787/polls");
  });
});
