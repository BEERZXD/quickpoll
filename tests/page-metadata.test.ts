import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { appCopy } from "../src/lib/copy";
import { createPageMetadata, hostPageMetadata, voterPageMetadata } from "../src/lib/page-metadata";

describe("page metadata", () => {
  it("uses a custom title for the create page", () => {
    const metadata = createPageMetadata();

    expect(metadata.title).toBe(appCopy.metadata.createTitle);
    expect(metadata.title).not.toBe(appCopy.metadata.title);
  });

  it("uses the same simple room-code tab title for creator and voter pages", () => {
    const hostMetadata = hostPageMetadata("440340");
    const voterMetadata = voterPageMetadata("440340");

    expect(hostMetadata.title).toBe("Room | 440340");
    expect(voterMetadata.title).toBe("Room | 440340");
    expect(hostMetadata.title).toBe(voterMetadata.title);
    expect(hostMetadata.title).not.toBe(appCopy.metadata.title);
    expect(voterMetadata.title).not.toBe(appCopy.metadata.title);
  });

  it("wires custom metadata into the create, creator, and voter routes", () => {
    expect(readFileSync("src/app/create/page.tsx", "utf8")).toContain("export const metadata = createPageMetadata()");
    expect(readFileSync("src/app/host/[roomCode]/page.tsx", "utf8")).toContain("hostPageMetadata(roomCode)");
    expect(readFileSync("src/app/poll/[roomCode]/page.tsx", "utf8")).toContain("voterPageMetadata(roomCode)");
  });
});
