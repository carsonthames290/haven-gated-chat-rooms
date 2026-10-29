import { describe, expect, it } from "vitest";
import { challenges, validateChallenge, replayChess, memorySequence } from "@/lib/challenges";
describe("Built-in playful punishments", () => {
  it("includes at least 25 unique playable options", () => { expect(challenges.length).toBeGreaterThanOrEqual(25); expect(new Set(challenges.map((c) => c.key)).size).toBe(challenges.length); });
  it("checks puzzle answers instead of accepting any submission", () => { expect(validateChallenge("riddle", "id", { answer: "piano" })).toBe(true); expect(validateChallenge("riddle", "id", { answer: "banana" })).toBe(false); });
  it("requires a win against the chess bot", () => { expect(validateChallenge("chess", "id", { moves: [] })).toBe(false); expect(replayChess(["illegal"])).toBe(null); expect(replayChess(["e4"])?.get("a5")).toEqual({ type: "p", color: "b" }); });
  it("requires the fractions exit answer", () => { expect(validateChallenge("video", "id", { answer: "1/6" })).toBe(true); expect(validateChallenge("video", "id", { answer: "2" })).toBe(false); });
  it("verifies interactive puzzle solutions", () => {
    expect(validateChallenge("slide", "id", { steps: [7,8] })).toBe(true); expect(validateChallenge("slide", "id", { steps: [] })).toBe(false);
    expect(validateChallenge("lights", "id", { steps: [0,4,8] })).toBe(true); expect(validateChallenge("lights", "id", { steps: [] })).toBe(false);
    expect(validateChallenge("memory", "id", { steps: memorySequence("id") })).toBe(true); expect(validateChallenge("memory", "id", { steps: [] })).toBe(false);
    expect(validateChallenge("maze", "id", { moves: ["R","R","R","R","D","D","D","D"] })).toBe(true); expect(validateChallenge("maze", "id", { moves: [] })).toBe(false);
  });
});