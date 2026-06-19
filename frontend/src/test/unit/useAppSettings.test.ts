import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { useAppSettings } from "../../hooks/useAppSettings";
import { DEFAULT_APP_SETTINGS } from "../../constants/settings";
import { mockFetch, errorResponse, type MockFetchResult } from "../helpers/fetch";

let fetchMock: MockFetchResult;

beforeEach(() => {
  useAppSettings.setState({
    appName: DEFAULT_APP_SETTINGS.appName,
    logoIcon: DEFAULT_APP_SETTINGS.logoIcon,
    isLoaded: false,
    isFetching: false,
    isSaving: false,
    error: null,
  });
});

afterEach(() => fetchMock?.restore());

describe("fetchSettings", () => {
  it("fetches settings from /api/settings and updates state on success", async () => {
    fetchMock = mockFetch({ appName: "Knit", logoIcon: "Rocket" });
    await useAppSettings.getState().fetchSettings();
    const state = useAppSettings.getState();
    expect(state.appName).toBe("Knit");
    expect(state.logoIcon).toBe("Rocket");
    expect(state.isLoaded).toBe(true);
    expect(state.isFetching).toBe(false);
    expect(state.error).toBeNull();
    expect(fetchMock.lastCall()).toMatchObject({ url: "/api/settings", method: "GET" });
  });

  it("sets error state and isLoaded on non-ok response", async () => {
    fetchMock = mockFetch(errorResponse(500, { error: "Server error" }));
    await useAppSettings.getState().fetchSettings();
    const state = useAppSettings.getState();
    expect(state.error).toBe("Failed to fetch settings");
    expect(state.isLoaded).toBe(true);
    expect(state.isFetching).toBe(false);
  });

  it("early-returns if already fetching (isFetching guard)", async () => {
    useAppSettings.setState({ isFetching: true });
    fetchMock = mockFetch({ appName: "X", logoIcon: "Star" });
    await useAppSettings.getState().fetchSettings();
    expect(fetchMock.calls).toHaveLength(0);
  });

  it("sets error on thrown error (network failure)", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = () => Promise.reject(new Error("Network failure"));
    await useAppSettings.getState().fetchSettings();
    globalThis.fetch = original;
    const state = useAppSettings.getState();
    expect(state.error).toBe("Network failure");
    expect(state.isLoaded).toBe(true);
    expect(state.isFetching).toBe(false);
  });

  it("falls back to defaults when server returns empty settings", async () => {
    fetchMock = mockFetch({});
    await useAppSettings.getState().fetchSettings();
    const state = useAppSettings.getState();
    expect(state.appName).toBe(DEFAULT_APP_SETTINGS.appName);
    expect(state.logoIcon).toBe(DEFAULT_APP_SETTINGS.logoIcon);
  });
});

describe("updateSettings", () => {
  it("sends a PUT to /api/settings and returns success", async () => {
    fetchMock = mockFetch({ appName: "New Name", logoIcon: "Zap" });
    const result = await useAppSettings.getState().updateSettings({ appName: "New Name" });
    expect(result.success).toBe(true);
    expect(useAppSettings.getState().appName).toBe("New Name");
    expect(useAppSettings.getState().isSaving).toBe(false);
    expect(fetchMock.lastCall()).toMatchObject({
      url: "/api/settings",
      method: "PUT",
    });
  });

  it("returns failure and sets error when response is not ok", async () => {
    fetchMock = mockFetch(errorResponse(422, { error: "Invalid icon" }));
    const result = await useAppSettings.getState().updateSettings({ logoIcon: "BadIcon" as never });
    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid icon");
    expect(useAppSettings.getState().error).toBe("Invalid icon");
    expect(useAppSettings.getState().isSaving).toBe(false);
  });

  it("uses fallback message when error response has no error field", async () => {
    fetchMock = mockFetch(errorResponse(500, {}));
    const result = await useAppSettings.getState().updateSettings({ appName: "X" });
    expect(result.success).toBe(false);
    expect(result.error).toBe("Failed to update settings");
  });

  it("returns failure on thrown error (network failure)", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = () => Promise.reject(new Error("Timeout"));
    const result = await useAppSettings.getState().updateSettings({ appName: "X" });
    globalThis.fetch = original;
    expect(result.success).toBe(false);
    expect(result.error).toBe("Timeout");
    expect(useAppSettings.getState().isSaving).toBe(false);
  });
});
