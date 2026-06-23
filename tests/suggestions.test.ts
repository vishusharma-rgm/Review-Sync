import { describe, expect, it } from "vitest";
import { countSearchMatches, replaceLineRange } from "@/lib/suggestions";

describe("suggestion helpers", () => {
  it("replaces an inclusive line range", () => {
    const content = ["one", "two", "three", "four"].join("\n");

    expect(replaceLineRange(content, 2, 3, "deux\ntrois")).toBe(["one", "deux", "trois", "four"].join("\n"));
  });

  it("counts case-insensitive search matches", () => {
    expect(countSearchMatches("Review review REVIEW", "review")).toBe(3);
    expect(countSearchMatches("Review", "")).toBe(0);
  });
});
