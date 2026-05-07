import { describe, expect, it } from "vitest";
import {
  buildFollowUpPollPayload,
  buildPollPayload,
  canSubmitPollForm,
  formatDefaultPollTitle,
  removePollOptionAt,
} from "../src/lib/poll-form";

describe("poll form helpers", () => {
  it("formats the fallback poll title from the local date and time", () => {
    expect(formatDefaultPollTitle(new Date(2026, 4, 7, 8, 9))).toBe("Poll 07/05/2026 : 08:09");
  });

  it("allows creating a poll without typing a title", () => {
    expect(
      canSubmitPollForm({
        title: "",
        question: "Ship it?",
        options: ["Yes", "No"],
      }),
    ).toBe(true);
  });

  it("requires a question and at least two filled option fields", () => {
    expect(canSubmitPollForm({ title: "", question: "", options: ["Yes", "No"] })).toBe(false);
    expect(canSubmitPollForm({ title: "", question: "Ship it?", options: ["Yes", ""] })).toBe(false);
    expect(canSubmitPollForm({ title: "", question: "Ship it?", options: ["Yes"] })).toBe(false);
  });

  it("builds a trimmed payload with a generated title when the title is blank", () => {
    expect(
      buildPollPayload({
        title: " ",
        question: " Ship it? ",
        options: [" Yes ", " No "],
        now: new Date(2026, 4, 7, 8, 9),
      }),
    ).toEqual({
      title: "Poll 07/05/2026 : 08:09",
      question: "Ship it?",
      options: ["Yes", "No"],
    });
  });

  it("builds a follow-up poll with the existing title and new question/options", () => {
    expect(
      buildFollowUpPollPayload({
        currentTitle: " Weekly Standup ",
        question: " Next priority? ",
        options: [" Feature A ", " Feature B "],
      }),
    ).toEqual({
      title: "Weekly Standup",
      question: "Next priority?",
      options: ["Feature A", "Feature B"],
    });
  });

  it("removes any chosen option while keeping at least two fields", () => {
    expect(removePollOptionAt(["A", "B", "C", "D"], 1)).toEqual(["A", "C", "D"]);
    expect(removePollOptionAt(["A", "B"], 0)).toEqual(["A", "B"]);
    expect(removePollOptionAt(["A", "B", "C"], 99)).toEqual(["A", "B", "C"]);
  });
});
