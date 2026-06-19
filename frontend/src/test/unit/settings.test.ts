import { describe, it, expect } from "bun:test";
import {
  DEFAULT_APP_SETTINGS,
  LOGO_ICON_NAMES,
  normalizeAppSettings,
} from "../../constants/settings";

describe("DEFAULT_APP_SETTINGS", () => {
  it("has expected appName", () => {
    expect(DEFAULT_APP_SETTINGS.appName).toBe("Knitly");
  });

  it("has expected default logoIcon", () => {
    expect(DEFAULT_APP_SETTINGS.logoIcon).toBe("Zap");
  });
});

describe("LOGO_ICON_NAMES", () => {
  it("is a non-empty array", () => {
    expect(LOGO_ICON_NAMES.length).toBeGreaterThan(0);
  });

  it("contains known icon names", () => {
    expect(LOGO_ICON_NAMES).toContain("Zap");
    expect(LOGO_ICON_NAMES).toContain("Rocket");
    expect(LOGO_ICON_NAMES).toContain("Heart");
  });

  it("contains exactly 50 entries", () => {
    expect(LOGO_ICON_NAMES).toHaveLength(50);
  });
});

describe("normalizeAppSettings", () => {
  it("returns defaults when called with no arguments", () => {
    expect(normalizeAppSettings()).toEqual(DEFAULT_APP_SETTINGS);
  });

  it("returns defaults when called with empty object", () => {
    expect(normalizeAppSettings({})).toEqual(DEFAULT_APP_SETTINGS);
  });

  it("uses provided appName and falls back to default logoIcon", () => {
    const result = normalizeAppSettings({ appName: "MyApp" });
    expect(result.appName).toBe("MyApp");
    expect(result.logoIcon).toBe(DEFAULT_APP_SETTINGS.logoIcon);
  });

  it("uses provided logoIcon and falls back to default appName", () => {
    const result = normalizeAppSettings({ logoIcon: "Rocket" });
    expect(result.appName).toBe(DEFAULT_APP_SETTINGS.appName);
    expect(result.logoIcon).toBe("Rocket");
  });

  it("uses both provided values when both are given", () => {
    const result = normalizeAppSettings({ appName: "Foo", logoIcon: "Star" });
    expect(result).toEqual({ appName: "Foo", logoIcon: "Star" });
  });

  it("falls back to defaults when appName is empty string", () => {
    const result = normalizeAppSettings({ appName: "" });
    expect(result.appName).toBe(DEFAULT_APP_SETTINGS.appName);
  });
});
