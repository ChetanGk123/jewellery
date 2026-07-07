import { describe, expect, test } from "bun:test";
import { pendingAge } from "./order-aging";

const NOW = Date.parse("2026-07-07T12:00:00Z");
const hoursAgo = (h: number) =>
  new Date(NOW - h * 3_600_000).toISOString();

describe("pendingAge", () => {
  test("returns null under 12 hours", () => {
    expect(pendingAge(hoursAgo(0), NOW)).toBeNull();
    expect(pendingAge(hoursAgo(11.9), NOW)).toBeNull();
  });

  test("flags 12–24 hours as amber 12h+", () => {
    expect(pendingAge(hoursAgo(12), NOW)).toEqual({
      label: "12h+",
      tone: "amber",
    });
    expect(pendingAge(hoursAgo(23.9), NOW)).toEqual({
      label: "12h+",
      tone: "amber",
    });
  });

  test("flags beyond 24 hours as red 24h+", () => {
    expect(pendingAge(hoursAgo(24), NOW)).toEqual({
      label: "24h+",
      tone: "red",
    });
    expect(pendingAge(hoursAgo(72), NOW)).toEqual({
      label: "24h+",
      tone: "red",
    });
  });

  test("returns null for unparseable dates", () => {
    expect(pendingAge("not-a-date", NOW)).toBeNull();
  });
});
