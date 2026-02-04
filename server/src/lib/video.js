import { execSync, spawn } from "child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import crypto from "crypto";

export const VIDEO_CONTENT_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
]);

export const MAX_VIDEO_DURATION = 30;
export const MAX_VIDEO_FILE_SIZE = 50 * 1024 * 1024;
export const VIDEO_OUTPUT_HEIGHT = 720;

export function assertFfmpegAvailable() {
  try {
    execSync("ffmpeg -version", { stdio: "ignore" });
    execSync("ffprobe -version", { stdio: "ignore" });
  } catch {
    throw new Error("ffmpeg/ffprobe not found. Install ffmpeg.");
  }
}

export async function getVideoMetadata(filePath) {
  return new Promise((resolve, reject) => {
    const args = [
      "-v", "quiet",
      "-print_format", "json",
      "-show_format",
      "-show_streams",
      filePath,
    ];

    const proc = spawn("ffprobe", args, { timeout: 10000 });
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => { stdout += data; });
    proc.stderr.on("data", (data) => { stderr += data; });

    proc.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`ffprobe failed: ${stderr || "unknown error"}`));
      }

      try {
        const data = JSON.parse(stdout);
        const videoStream = data.streams?.find((s) => s.codec_type === "video");

        if (!videoStream) {
          return reject(new Error("No video stream found"));
        }

        const duration = parseFloat(data.format?.duration || videoStream.duration || "0");
        const width = videoStream.width || 0;
        const height = videoStream.height || 0;
        const codec = videoStream.codec_name || "unknown";

        resolve({ duration, width, height, codec });
      } catch (err) {
        reject(new Error(`Failed to parse ffprobe output: ${err.message}`));
      }
    });

    proc.on("error", (err) => reject(err));
  });
}

export async function validateVideo(filePath) {
  try {
    const meta = await getVideoMetadata(filePath);

    if (meta.duration > MAX_VIDEO_DURATION) {
      return {
        valid: false,
        error: "duration_exceeded",
        duration: meta.duration,
        maxDuration: MAX_VIDEO_DURATION,
      };
    }

    return {
      valid: true,
      duration: meta.duration,
      width: meta.width,
      height: meta.height,
      codec: meta.codec,
    };
  } catch (err) {
    console.warn("[VIDEO] Validation failed:", err.message);
    return { valid: false, error: "invalid_video" };
  }
}
