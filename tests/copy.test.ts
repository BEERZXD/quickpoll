import { describe, expect, it } from "vitest";
import { appCopy, fontConfig } from "../src/lib/copy";

describe("Thai app copy", () => {
  it("uses Thai as the primary UI language", () => {
    expect(appCopy.language).toBe("th");
    expect(appCopy.home.createButton).toBe("สร้างโพล");
    expect(appCopy.home.joinTitle).toBe("เข้าร่วมโพล");
    expect(appCopy.host.stopPoll).toBe("หยุดโพล");
    expect(appCopy.voter.clearVote).toBe("ล้างคำตอบ");
  });

  it("uses a modern Thai sans font", () => {
    expect(fontConfig.sansName).toBe("Noto Sans Thai");
  });
});

