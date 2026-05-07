import { describe, expect, it } from "vitest";
import { canClearVote, canPickChoice, getVoterWinningOptionIds, shouldShowResults } from "../src/lib/vote-ui";

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

  it("shows results after the poll stops", () => {
    expect(shouldShowResults({ active: false, resultCount: 2 })).toBe(true);
    expect(shouldShowResults({ active: true, resultCount: 2 })).toBe(false);
    expect(shouldShowResults({ active: false, resultCount: 0 })).toBe(false);
  });

  it("highlights stopped-poll winners only when votes exist", () => {
    expect(
      getVoterWinningOptionIds({
        active: false,
        results: [
          { optionId: "option-1", count: 1 },
          { optionId: "option-2", count: 3 },
          { optionId: "option-3", count: 2 },
        ],
      }),
    ).toEqual(["option-2"]);
    expect(
      getVoterWinningOptionIds({
        active: false,
        results: [
          { optionId: "option-1", count: 4 },
          { optionId: "option-2", count: 4 },
        ],
      }),
    ).toEqual(["option-1", "option-2"]);
    expect(getVoterWinningOptionIds({ active: true, results: [{ optionId: "option-1", count: 4 }] })).toEqual([]);
    expect(getVoterWinningOptionIds({ active: false, results: [{ optionId: "option-1", count: 0 }] })).toEqual([]);
  });
});
