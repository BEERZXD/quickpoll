import { describe, expect, it } from "vitest";
import { siteFooter } from "../src/lib/site-footer";

describe("site footer", () => {
  it("links the visible Instagram handle to the requested profile", () => {
    expect(siteFooter.text).toBe("Made with");
    expect(siteFooter.heart).toBe("❤️");
    expect(siteFooter.handle).toBe("_bxxr.t");
    expect(siteFooter.href).toBe("https://www.instagram.com/_bxxr.t/");
  });
});
