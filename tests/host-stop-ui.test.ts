import { describe, expect, it } from "vitest";
import {
  getWinningOptionIds,
  hostHeaderLayoutClasses,
  shouldShowHostNewQuestionForm,
  shouldShowHostResults,
  type HostStoppedView,
} from "../src/lib/host-stop-ui";

describe("host stopped poll UI", () => {
  it("keeps live poll results visible while the poll is active", () => {
    expect(shouldShowHostResults({ active: true, stoppedView: null })).toBe(true);
    expect(shouldShowHostNewQuestionForm({ active: true, stoppedView: "newQuestion" })).toBe(false);
  });

  it("keeps stopped poll results visible until the host asks a new question", () => {
    const views: (HostStoppedView | null)[] = [null, "newQuestion"];

    expect(views.map((stoppedView) => shouldShowHostResults({ active: false, stoppedView }))).toEqual([true, false]);
  });

  it("shows the new question form only after the host chooses the new-question view", () => {
    expect(shouldShowHostNewQuestionForm({ active: false, stoppedView: "newQuestion" })).toBe(true);
    expect(shouldShowHostNewQuestionForm({ active: false, stoppedView: null })).toBe(false);
  });

  it("stacks stopped host header content on mobile so the title keeps full width", () => {
    const layout = hostHeaderLayoutClasses({ active: false, hasState: true });

    expect(layout.header).toContain("flex-col");
    expect(layout.header).toContain("sm:flex-row");
    expect(layout.titleArea).toContain("w-full");
    expect(layout.actions).toContain("w-full");
    expect(layout.actions).toContain("sm:w-auto");
  });

  it("highlights only the highest stopped-poll choices when votes exist", () => {
    expect(
      getWinningOptionIds([
        { optionId: "option-1", count: 1 },
        { optionId: "option-2", count: 3 },
        { optionId: "option-3", count: 2 },
      ]),
    ).toEqual(["option-2"]);

    expect(
      getWinningOptionIds([
        { optionId: "option-1", count: 4 },
        { optionId: "option-2", count: 4 },
        { optionId: "option-3", count: 1 },
      ]),
    ).toEqual(["option-1", "option-2"]);

    expect(
      getWinningOptionIds([
        { optionId: "option-1", count: 0 },
        { optionId: "option-2", count: 0 },
      ]),
    ).toEqual([]);
  });
});
