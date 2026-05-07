import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("app favicon", () => {
  it("provides a Quick Poll SVG tab icon", () => {
    const icon = readFileSync("src/app/icon.svg", "utf8");
    const layout = readFileSync("src/app/layout.tsx", "utf8");

    expect(icon).toContain("<title>Quick Poll</title>");
    expect(icon).toContain("#22d3ee");
    expect(icon).toContain("#ffcc30");
    expect(layout).toContain('icon: "/icon.svg"');
  });
});
