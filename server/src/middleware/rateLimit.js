const rateLimitStore = new Map();

const CLEANUP_INTERVAL = 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now - entry.windowStart >= 60 * 1000) {
      rateLimitStore.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

function getClientIP(c) {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.header("x-real-ip") ||
    c.req.raw?.socket?.remoteAddress ||
    "unknown"
  );
}

export function clearRateLimitStore() {
  rateLimitStore.clear();
}

function createRateLimiter(name, maxRequests, windowMs = 60 * 1000) {
  return async (c, next) => {
    const ip = getClientIP(c);
    const key = `${ip}:${name}`;
    const now = Date.now();

    let entry = rateLimitStore.get(key);

    if (!entry || now - entry.windowStart >= windowMs) {
      entry = { count: 0, windowStart: now };
    }

    entry.count++;
    rateLimitStore.set(key, entry);

    const remaining = Math.max(0, maxRequests - entry.count);
    const resetTime = Math.ceil((entry.windowStart + windowMs - now) / 1000);

    c.header("X-RateLimit-Limit", String(maxRequests));
    c.header("X-RateLimit-Remaining", String(remaining));
    c.header("X-RateLimit-Reset", String(resetTime));

    if (entry.count > maxRequests) {
      return c.json(
        { error: "Too many requests. Please try again later." },
        429
      );
    }

    await next();
  };
}

export const authRateLimit = createRateLimiter("auth", 5);
export const forgotPasswordRateLimit = createRateLimiter("forgot-password", 3, 60 * 60 * 1000);
export const searchRateLimit = createRateLimiter("search", 20);
export const generalRateLimit = createRateLimiter("general", 100);
export const apiKeyRateLimit = createRateLimiter("api-key", 30);
