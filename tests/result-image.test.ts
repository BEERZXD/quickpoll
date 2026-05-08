import { describe, expect, it } from "vitest";
import {
  buildResultImageModel,
  resultImageFaviconShapes,
  resultImageBrandName,
  resultImageHeaderLayout,
  resultImageRowLayout,
  resultImageTimestampLabel,
  resultImageFilename,
  wrapResultImageText,
} from "../src/lib/result-image";
import type { PollState } from "../src/lib/types";

const stoppedState: PollState = {
  active: false,
  poll: {
    title: "Lunch Vote",
    question: "What should we eat today?",
    options: [
      { id: "option-1", text: "Noodles" },
      { id: "option-2", text: "Rice" },
      { id: "option-3", text: "Soup" },
    ],
  },
  results: [
    { optionId: "option-1", count: 2 },
    { optionId: "option-2", count: 3 },
    { optionId: "option-3", count: 0 },
  ],
  voterCount: 5,
  hostConnected: true,
  hostGraceDeleteAt: null,
};

describe("result image helpers", () => {
  it("builds rows with counts, percentages, total votes, and winners", () => {
    const model = buildResultImageModel(stoppedState);

    expect(model.totalVotes).toBe(5);
    expect(model.rows).toEqual([
      expect.objectContaining({ text: "Noodles", count: 2, percent: 40, isWinner: false }),
      expect.objectContaining({ text: "Rice", count: 3, percent: 60, isWinner: true }),
      expect.objectContaining({ text: "Soup", count: 0, percent: 0, isWinner: false }),
    ]);
  });

  it("does not mark a winner when a stopped poll has zero votes", () => {
    const model = buildResultImageModel({
      ...stoppedState,
      results: stoppedState.results.map((result) => ({ ...result, count: 0 })),
    });

    expect(model.totalVotes).toBe(0);
    expect(model.rows.every((row) => row.percent === 0 && !row.isWinner)).toBe(true);
  });

  it("uses a filesystem-safe local timestamp in the download filename", () => {
    expect(resultImageFilename("123456", new Date(2026, 4, 8, 14, 30, 59))).toBe(
      "bquickpoll-123456-2026-05-08-1430.png",
    );
  });

  it("uses the export brand name in the generated image", () => {
    expect(resultImageBrandName).toBe("bquickpoll");
  });

  it("formats the visible export timestamp for the result card", () => {
    expect(resultImageTimestampLabel(new Date(2026, 4, 8, 23, 27, 12))).toBe("2026-05-08 23:27");
  });

  it("keeps the title safely below the timestamp in the result card header", () => {
    const layout = resultImageHeaderLayout({ top: 72 });

    expect(layout.titleFirstBaselineY - layout.timestampBaselineY).toBeGreaterThanOrEqual(60);
  });

  it("describes the bquickpoll favicon shapes for canvas export", () => {
    const shapes = resultImageFaviconShapes({ x: 10, y: 20, size: 64 });

    expect(shapes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "roundRect", fill: "#101114" }),
        expect.objectContaining({ kind: "circle", fill: "#ffcc30" }),
        expect.objectContaining({ kind: "roundRect", fill: "#22d3ee" }),
        expect.objectContaining({ kind: "circle", fill: "#fff8e8" }),
      ]),
    );
  });

  it("wraps long unbroken text for the result card", () => {
    const lines = wrapResultImageText("SuperLongChoiceWithoutSpaces", (text) => text.length * 10, 80);

    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((line) => line.length <= 8)).toBe(true);
  });

  it("keeps a winning label above the result bar even for short choices", () => {
    const layout = resultImageRowLayout({ lineCount: 1, isWinner: true });

    expect(layout.winnerLabelBottomY).toBeLessThanOrEqual(layout.barY - 18);
  });
});
