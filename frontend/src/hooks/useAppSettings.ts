import { create } from "zustand";
import { DEFAULT_APP_SETTINGS, normalizeAppSettings } from "../constants/settings";
import type { AppSettings } from "../constants/settings";

interface AppSettingsState extends AppSettings {
  isLoaded: boolean;
  isFetching: boolean;
  isSaving: boolean;
  error: string | null;
  fetchSettings: () => Promise<void>;
  updateSettings: (updates: Partial<AppSettings>) => Promise<{ success: boolean; error?: string }>;
}

export const useAppSettings = create<AppSettingsState>((set, get) => ({
  appName: DEFAULT_APP_SETTINGS.appName,
  logoIcon: DEFAULT_APP_SETTINGS.logoIcon,
  isLoaded: false,
  isFetching: false,
  isSaving: false,
  error: null,

  fetchSettings: async () => {
    if (get().isFetching) return;

    set({ isFetching: true, error: null });
    try {
      const response = await fetch("/api/settings");
      if (!response.ok) throw new Error("Failed to fetch settings");

      const data = (await response.json()) as Partial<AppSettings>;
      set({
        ...normalizeAppSettings(data),
        isLoaded: true,
        isFetching: false,
      });
    } catch (error) {
      console.error("Failed to fetch app settings:", error);
      set({
        error: error instanceof Error ? error.message : "Unknown error",
        isLoaded: true,
        isFetching: false,
      });
    }
  },

  updateSettings: async (updates) => {
    set({ isSaving: true, error: null });
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData.error || "Failed to update settings");
      }

      const data = (await response.json()) as Partial<AppSettings>;
      set({
        ...normalizeAppSettings(data),
        isLoaded: true,
        isSaving: false,
      });
      return { success: true };
    } catch (error) {
      console.error("Failed to update app settings:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      set({ error: message, isSaving: false });
      return { success: false, error: message };
    }
  },
}));
