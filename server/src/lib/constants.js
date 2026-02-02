export const COOKIE_NAME = "session";

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 7 * 24 * 60 * 60,
  path: "/",
};

export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
