import { describe, expect, it } from "vitest";
import { validatePoll } from "../worker/index";

describe("worker poll validation", () => {
  it("generates a default title when the incoming title is blank", () => {
    const result = validatePoll(
      {
        title: " ",
        question: "Ship it?",
        options: ["Yes", "No"],
      },
      () => new Date(2026, 4, 7, 8, 9),
    );

    expect(result).toEqual({
      ok: true,
      poll: {
        title: "Poll 07/05/2026 : 08:09",
        question: "Ship it?",
        options: [
          { id: "option-1", text: "Yes" },
          { id: "option-2", text: "No" },
        ],
      },
    });
  });

  it("rejects polls without a question or at least two options", () => {
    expect(validatePoll({ title: "", question: "", options: ["Yes", "No"] })).toMatchObject({
      ok: false,
    });
    expect(validatePoll({ title: "", question: "Ship it?", options: ["Yes"] })).toMatchObject({
      ok: false,
    });
  });
});
