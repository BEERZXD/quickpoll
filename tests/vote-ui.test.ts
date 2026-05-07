import { describe, expect, it } from "vitest";
import { canClearVote, canPickChoice } from "../src/lib/vote-ui";

describe("voter UI state", () => {
  it("does not allow resetting a selected choice after the poll closes", () => {
    expect(canClearVote({ selectedOptionId: "option-1", status: "closed" })).toBe(false);
  });

  it("allows resetting a selected choice only while live", () => {
    expect(canClearVote({ selectedOptionId: "option-1", status: "live" })).toBe(true);
    expect(canClearVote({ selectedOptionId: null, status: "live" })).toBe(false);
  });

  it("only allows picking choices while live", () => {
    expect(canPickChoice("live")).toBe(true);
    expect(canPickChoice("loading")).toBe(false);
    expect(canPickChoice("closed")).toBe(false);
  });
});

