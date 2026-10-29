import { describe, expect, it } from "vitest";
import { activeModeration } from "@/lib/moderation";
describe("Timed host moderation", () => {
  it("restricts a specific person until the chosen timeout ends", () => {
    const now = Date.parse("2026-10-29T22:48:00Z");
    const person = { moderation_action: "timeout", moderation_until: "2026-10-29T22:53:00Z", moderation_reason: "" };
    expect(activeModeration(person, now)).toBe("timeout");
    expect(activeModeration(person, now + 300000)).toBe("none");
  });
  it("allows no punishment", () => {
    expect(activeModeration({ moderation_action: "none", moderation_until: null, moderation_reason: "" }, Date.now())).toBe("none");
  });
});