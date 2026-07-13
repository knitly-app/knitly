import { db } from "./core.js";

export const settingsQueries = {
  getSetting(key) {
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
    return row ? row.value : null;
  },

  setSetting(key, value) {
    db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, value);
  },

  getAllSettings() {
    const appName = this.getSetting("appName") || "Knitly";
    const logoIcon = this.getSetting("logoIcon") || "Zap";
    const circlesEnabled = this.getSetting("circlesEnabled") !== "false";
    return { appName, logoIcon, circlesEnabled };
  },

  setSettings(updates) {
    const tx = db.transaction((data) => {
      if (data.appName !== undefined) this.setSetting("appName", data.appName);
      if (data.logoIcon !== undefined) this.setSetting("logoIcon", data.logoIcon);
      if (data.circlesEnabled !== undefined) this.setSetting("circlesEnabled", String(data.circlesEnabled));
    });
    tx(updates);
  },
};
