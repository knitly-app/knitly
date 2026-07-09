import { describe, it, expect } from "bun:test";
import { formatTimeAgo } from "../../utils/time";

function minutesAgo(n: number): string {
  return new Date(Date.now() - n * 60_000).toISOString();
}

function hoursAgo(n: number): string {
  return new Date(Date.now() - n * 60 * 60_000).toISOString();
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60_000).toISOString();
}

describe("formatTimeAgo", () => {
  describe("< 1 minute", () => {
    it("returns 'now' for 0 seconds ago", () => {
      expect(formatTimeAgo(new Date().toISOString())).toBe("now");
    });

    it("returns 'now' for 30 seconds ago", () => {
      const d = new Date(Date.now() - 30_000).toISOString();
      expect(formatTimeAgo(d)).toBe("now");
    });
  });

  describe("< 60 minutes", () => {
    it("returns minutes without 'ago' by default", () => {
      expect(formatTimeAgo(minutesAgo(5))).toBe("5m");
    });

    it("returns minutes with 'ago' when includeAgo is true", () => {
      expect(formatTimeAgo(minutesAgo(5), { includeAgo: true })).toBe("5m ago");
    });

    it("handles 59 minutes correctly", () => {
      expect(formatTimeAgo(minutesAgo(59))).toBe("59m");
    });
  });

  describe("< 24 hours", () => {
    it("returns hours without 'ago' by default", () => {
      expect(formatTimeAgo(hoursAgo(3))).toBe("3h");
    });

    it("returns hours with 'ago' when includeAgo is true", () => {
      expect(formatTimeAgo(hoursAgo(3), { includeAgo: true })).toBe("3h ago");
    });

    it("handles 23 hours correctly", () => {
      expect(formatTimeAgo(hoursAgo(23))).toBe("23h");
    });
  });

  describe(">= 24 hours (days)", () => {
    it("returns days without 'ago' by default", () => {
      expect(formatTimeAgo(daysAgo(2))).toBe("2d");
    });

    it("returns days with 'ago' when includeAgo is true", () => {
      expect(formatTimeAgo(daysAgo(2), { includeAgo: true })).toBe("2d ago");
    });
  });

  describe("maxDays boundary", () => {
    it("returns formatted date when diffDays >= maxDays", () => {
      const d = daysAgo(7);
      const result = formatTimeAgo(d, { maxDays: 7 });
      expect(result).toBe(new Date(d).toLocaleDateString());
    });

    it("returns formatted date when diffDays exceeds maxDays", () => {
      const d = daysAgo(30);
      const result = formatTimeAgo(d, { maxDays: 7 });
      expect(result).toBe(new Date(d).toLocaleDateString());
    });

    it("returns days string when diffDays is under maxDays", () => {
      expect(formatTimeAgo(daysAgo(3), { maxDays: 7 })).toBe("3d");
    });

    it("combines maxDays and includeAgo for under-threshold case", () => {
      expect(formatTimeAgo(daysAgo(3), { maxDays: 7, includeAgo: true })).toBe("3d ago");
    });
  });
});
