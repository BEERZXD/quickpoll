import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { appCopy } from "../src/lib/copy";
import {
  createPageMetadata,
  fetchVoterPageMetadata,
  hostPageMetadata,
  voterPageMetadata,
} from "../src/lib/page-metadata";

describe("page metadata", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses a custom title for the create page", () => {
    const metadata = createPageMetadata();

    expect(metadata.title).toBe(appCopy.metadata.createTitle);
    expect(metadata.title).not.toBe(appCopy.metadata.title);
  });

  it("keeps creator tabs simple while voter tabs use the share title", () => {
    const hostMetadata = hostPageMetadata("440340");
    const voterMetadata = voterPageMetadata({ roomCode: "440340", pollTitle: "Lunch Vote" });

    expect(hostMetadata.title).toBe("Room | 440340");
    expect(voterMetadata.title).toBe("Quick Poll | 440340");
    expect(hostMetadata.title).not.toBe(voterMetadata.title);
    expect(hostMetadata.title).not.toBe(appCopy.metadata.title);
    expect(voterMetadata.title).not.toBe(appCopy.metadata.title);
  });

  it("uses the poll title as voter share metadata description", () => {
    const metadata = voterPageMetadata({ roomCode: "440340", pollTitle: "Lunch Vote" });

    expect(metadata.description).toBe("Lunch Vote");
    expect(metadata.openGraph).toMatchObject({
      title: "Quick Poll | 440340",
      description: "Lunch Vote",
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary",
      title: "Quick Poll | 440340",
      description: "Lunch Vote",
    });
  });

  it("falls back to an invite description when the voter poll title is unavailable", () => {
    const metadata = voterPageMetadata({ roomCode: "440340", pollTitle: "" });

    expect(metadata.title).toBe("Quick Poll | 440340");
    expect(metadata.description).toBe(appCopy.metadata.voterFallbackDescription("440340"));
    expect(metadata.openGraph).toMatchObject({
      title: "Quick Poll | 440340",
      description: appCopy.metadata.voterFallbackDescription("440340"),
    });
  });

  it("fetches public room state for voter share metadata", async () => {
    vi.stubEnv("NEXT_PUBLIC_REALTIME_URL", "https://worker.example");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        active: true,
        poll: {
          title: "Lunch Vote",
          question: "What should we eat?",
          options: [],
        },
        results: [],
        voterCount: 0,
        hostConnected: false,
        hostGraceDeleteAt: null,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const metadata = await fetchVoterPageMetadata("440340");

    expect(fetchMock).toHaveBeenCalledWith("https://worker.example/polls/440340", { cache: "no-store" });
    expect(metadata.description).toBe("Lunch Vote");
  });

  it("uses fallback voter share metadata when public room state cannot be fetched", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "not found" }),
      }),
    );

    const metadata = await fetchVoterPageMetadata("440340");

    expect(metadata.title).toBe("Quick Poll | 440340");
    expect(metadata.description).toBe(appCopy.metadata.voterFallbackDescription("440340"));
  });

  it("wires custom metadata into the create, creator, and voter routes", () => {
    expect(readFileSync("src/app/create/page.tsx", "utf8")).toContain("export const metadata = createPageMetadata()");
    expect(readFileSync("src/app/host/[roomCode]/page.tsx", "utf8")).toContain("hostPageMetadata(roomCode)");
    expect(readFileSync("src/app/poll/[roomCode]/page.tsx", "utf8")).toContain("fetchVoterPageMetadata(roomCode)");
  });
});
