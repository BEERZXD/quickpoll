import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("page overflow layout", () => {
  it("keeps the host title and sidebar from being squeezed or stretched", () => {
    const source = readFileSync("src/app/host/[roomCode]/HostDashboard.tsx", "utf8");

    expect(source).toContain("inline-flex whitespace-nowrap");
    expect(source).toContain("poll-text-wrap w-full text-3xl");
    expect(source).toContain("poll-text-wrap mt-3 w-full");
    expect(source).toContain('aside className="grid auto-rows-max content-start gap-5"');
    expect(source).toContain("status-pill");
    expect(source).toContain("{statusPill}");
    expect(source).toContain("host-action-controls");
    expect(source).toContain('aria-label={copy.downloadResultImage}');
    expect(source).toContain("icon-button");
    expect(source).toContain("<Download");
  });

  it("keeps the voter status and long result labels inside the panel", () => {
    const source = readFileSync("src/app/poll/[roomCode]/VoteClient.tsx", "utf8");

    expect(source).toContain('section className="stage-grid grid min-h-[calc(100dvh-96px)] content-center"');
    expect(source).toContain('div className="glass-panel overflow-hidden rounded-lg p-5 sm:p-7"');
    expect(source).toContain('span className="shrink-0 whitespace-nowrap rounded-md');
    expect(source).toContain("mb-2 grid grid-cols-[minmax(0,1fr)_auto]");
    expect(source).toContain('div className="shrink-0 font-mono');
    expect(source).not.toContain("downloadResultImage");
    expect(source).not.toContain("status-pill");
  });
});
