import { describe, expect, it } from "vitest";
import { appCopy, fontConfig } from "../src/lib/copy";

describe("Thai app copy", () => {
  it("uses Thai as the primary UI language", () => {
    expect(appCopy.language).toBe("th");
    expect(appCopy.home.subtitle).toBe("โหวตสดทันที");
    expect(appCopy.home.createButton).toBe("สร้างโพล");
    expect(appCopy.home.joinTitle).toBe("เข้าร่วมโพล");
    expect(appCopy.host.stopPoll).toBe("หยุดโพล");
    expect(appCopy.host.copyJoinLink).toBe("คัดลอกลิงก์เข้าร่วม");
    expect(appCopy.host.linkCopied).toBe("คัดลอกลิงก์แล้ว");
    expect(appCopy.voter.clearVote).toBe("ล้างคำตอบ");
    expect((appCopy.voter as typeof appCopy.voter & { winnerLabel?: string }).winnerLabel).toBe(appCopy.host.winnerLabel);
  });

  it("uses a modern Thai sans font", () => {
    expect(fontConfig.sansName).toBe("Noto Sans Thai");
  });

  it("does not expose a host show-results action", () => {
    expect(Object.hasOwn(appCopy.host, "showResults")).toBe(false);
  });
});
