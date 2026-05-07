import { describe, expect, it } from "vitest";
import { homeModePath } from "../src/lib/home-mode";

describe("home-mode", () => {
  it("maps home modes to route-backed paths", () => {
    expect(homeModePath("start")).toBe("/");
    expect(homeModePath("create")).toBe("/create");
    expect(homeModePath("join")).toBe("/join");
  });
});
