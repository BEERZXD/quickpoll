import { describe, expect, it } from "vitest";
import { shouldReceiveResultBroadcast } from "../worker/socket-policy";

describe("socket policy", () => {
  it("sends live result broadcasts only to host sockets", () => {
    expect(shouldReceiveResultBroadcast({ role: "host" })).toBe(true);
    expect(shouldReceiveResultBroadcast({ role: "voter" })).toBe(false);
  });
});
