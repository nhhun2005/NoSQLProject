import crypto from "node:crypto";
/**
 * In-memory rate limiter middleware with zero external dependencies.
 * Automatically evicts old records to prevent unbounded memory growth.
 */
export const createRateLimiter = ({
  windowMs = 15 * 60 * 1000,
  max = 10,
  message = "Quá nhiều yêu cầu, vui lòng thử lại sau.",
  maxEntries = 5000
} = {}) => {
  const hits = new Map();
  const cleanup = () => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      if (now > record.resetTime) {
        hits.delete(key);
      }
    }
  };
  return (req, res, next) => {
    const now = Date.now();
    const clientIp = req.ip || req.socket?.remoteAddress || "unknown-ip";
    const identity = String(req.body?.email || req.body?.username || "").trim().toLowerCase();
    const digest = crypto.createHash("sha256").update(identity).digest("hex");
    const key = `${clientIp}:${req.path}:${digest}`;
    if (hits.size >= maxEntries) {
      cleanup();
      // If still over capacity, remove oldest entry
      if (hits.size >= maxEntries) {
        const firstKey = hits.keys().next().value;
        if (firstKey) hits.delete(firstKey);
      }
    }
    const currentRecord = hits.get(key);
    if (!currentRecord || now > currentRecord.resetTime) {
      hits.set(key, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }
    if (currentRecord.count >= max) {
      res.setHeader?.("Retry-After", String(Math.ceil((currentRecord.resetTime - now) / 1000)));
      return res.status(429).json({
        message
      });
    }
    currentRecord.count += 1;
    return next();
  };
};
