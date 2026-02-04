import { describe, it, expect } from "bun:test";
import { assertFfmpegAvailable, VIDEO_CONTENT_TYPES, MAX_VIDEO_DURATION } from "./video.js";

describe("video utilities", () => {
  it("should export VIDEO_CONTENT_TYPES", () => {
    expect(VIDEO_CONTENT_TYPES.has("video/mp4")).toBe(true);
    expect(VIDEO_CONTENT_TYPES.has("video/quicktime")).toBe(true);
    expect(VIDEO_CONTENT_TYPES.has("video/webm")).toBe(true);
    expect(VIDEO_CONTENT_TYPES.has("image/jpeg")).toBe(false);
  });

  it("should export MAX_VIDEO_DURATION as 30", () => {
    expect(MAX_VIDEO_DURATION).toBe(30);
  });

  it("should not throw if ffmpeg is available", () => {
    expect(() => assertFfmpegAvailable()).not.toThrow();
  });
});
