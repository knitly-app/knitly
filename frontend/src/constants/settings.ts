export const LOGO_ICON_NAMES = [
  "Zap", "Rocket", "Sparkles", "Bot", "Cpu", "Terminal", "Code", "Braces",
  "MessageSquare", "MessagesSquare", "Send", "Mail", "AtSign", "Circle",
  "Square", "Triangle", "Hexagon", "Star", "Heart", "Diamond", "Flame",
  "Sun", "Moon", "Cloud", "Leaf", "Mountain", "Ghost", "Smile", "Trophy",
  "ChessKnight", "ChessQueen", "Atom", "BadgeDollarSign", "Bookmark",
  "Cat", "Dog", "Fish", "Coffee", "Pizza", "IceCream", "Gem", "Command",
  "Hash", "Flag", "Pin", "Home", "Library", "Cherry", "Sprout", "Sword"
] as const;

export type LogoIconName = typeof LOGO_ICON_NAMES[number];

export const DEFAULT_APP_SETTINGS = {
  appName: "Knitly",
  logoIcon: "Zap" as LogoIconName,
};

export interface AppSettings {
  appName: string;
  logoIcon: LogoIconName;
}

export const normalizeAppSettings = (settings: Partial<AppSettings> = {}): AppSettings => ({
  appName: settings.appName || DEFAULT_APP_SETTINGS.appName,
  logoIcon: settings.logoIcon || DEFAULT_APP_SETTINGS.logoIcon,
});
