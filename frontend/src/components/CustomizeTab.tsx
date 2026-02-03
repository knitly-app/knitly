import { useState } from "preact/hooks";
import * as LucideIcons from "lucide-preact";
import { Check, ChevronRight, RotateCcw, Zap } from "lucide-preact";
import { useAppSettings } from "../hooks/useAppSettings";
import { LOGO_ICON_NAMES, type LogoIconName } from "../constants/settings";
import { Spinner } from "./Spinner";

const LOGO_ICONS: Record<string, typeof Zap> = LOGO_ICON_NAMES.reduce((acc, name) => {
  acc[name] = (LucideIcons as unknown as Record<string, typeof Zap>)[name];
  return acc;
}, {} as Record<string, typeof Zap>);

const APP_NAME_MAX_LENGTH = 50;
const SUCCESS_MESSAGE_DURATION_MS = 2000;

export function CustomizeTab() {
  const appName = useAppSettings((s) => s.appName);
  const logoIcon = useAppSettings((s) => s.logoIcon);
  const isFetching = useAppSettings((s) => s.isFetching);
  const isSaving = useAppSettings((s) => s.isSaving);
  const updateSettings = useAppSettings((s) => s.updateSettings);

  const [localAppName, setLocalAppName] = useState(() => appName);
  const [localLogoIcon, setLocalLogoIcon] = useState<LogoIconName>(() => logoIcon);
  const [saveStatus, setSaveStatus] = useState<"success" | "error" | null>(null);

  const hasUnsavedChanges = localAppName !== appName || localLogoIcon !== logoIcon;

  const handleSave = async () => {
    setSaveStatus(null);
    const result = await updateSettings({ appName: localAppName, logoIcon: localLogoIcon });
    if (result.success) {
      setSaveStatus("success");
      setTimeout(() => setSaveStatus(null), SUCCESS_MESSAGE_DURATION_MS);
    } else {
      setSaveStatus("error");
    }
  };

  const handleReset = () => {
    setLocalAppName(appName);
    setLocalLogoIcon(logoIcon);
    setSaveStatus(null);
  };

  const SelectedIcon = LOGO_ICONS[localLogoIcon] || Zap;

  return (
    <div className="bg-white rounded-4xl shadow-sm border border-gray-50 overflow-hidden">
      <div className="p-6 border-b border-gray-100">
        <h2 className="text-lg font-bold text-gray-900">Customize</h2>
        <p className="text-sm text-gray-400 mt-1">Customize how your application appears to users.</p>
      </div>

      <div className="p-6 space-y-6">
        <div>
          <label htmlFor="appName" className="block text-sm font-semibold text-gray-700 mb-2">
            Application Name
          </label>
          <input
            id="appName"
            type="text"
            value={localAppName}
            onInput={(e) => setLocalAppName((e.target as HTMLInputElement).value)}
            placeholder="Knitly"
            maxLength={APP_NAME_MAX_LENGTH}
            className="w-full max-w-md rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-4 focus:ring-accent-50 transition-all"
          />
          <p className="text-xs text-gray-400 mt-2">
            This name appears in the header and browser tab.
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Logo Icon</label>
          <div className="mb-4 flex items-center gap-3">
            <div className="w-12 h-12 bg-accent-500 rounded-2xl flex items-center justify-center shadow-lg">
              <SelectedIcon className="w-6 h-6 text-white" />
            </div>
            <div className="flex items-center gap-1 text-sm text-gray-400">
              <ChevronRight size={16} />
              <span>Select an icon below</span>
            </div>
          </div>
          <div className="grid grid-cols-10 gap-2 max-w-xl">
            {LOGO_ICON_NAMES.map((iconName) => {
              const Icon = LOGO_ICONS[iconName];
              const isSelected = localLogoIcon === iconName;
              return (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => setLocalLogoIcon(iconName)}
                  title={iconName}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-all ${
                    isSelected
                      ? "border-accent-500 bg-accent-50 text-accent-500"
                      : "border-gray-100 bg-gray-50 text-gray-400 hover:border-accent-200 hover:text-gray-600"
                  }`}
                >
                  <Icon size={20} />
                </button>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            This icon appears in the header.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
          <button
            onClick={handleSave}
            disabled={!hasUnsavedChanges || isSaving || isFetching}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent-500 text-white rounded-full text-sm font-bold shadow-sm hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <Spinner size="sm" />
                Saving...
              </>
            ) : saveStatus === "success" ? (
              <>
                <Check size={16} />
                Saved
              </>
            ) : (
              "Save Changes"
            )}
          </button>

          {hasUnsavedChanges && (
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-600 rounded-full text-sm font-semibold hover:bg-gray-200 transition-colors"
            >
              <RotateCcw size={16} />
              Reset
            </button>
          )}

          {saveStatus === "error" && (
            <span className="text-sm text-red-500">Failed to save. Please try again.</span>
          )}
        </div>
      </div>
    </div>
  );
}
