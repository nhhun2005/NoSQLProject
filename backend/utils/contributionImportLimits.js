// In-flight concurrency lock and bounded per-user rate limiting / cooldown for PDF/CSV imports.

const inFlightUsers = new Set();
const userHistory = new Map();

const MAX_MAP_ENTRIES = 1000;
const COOLDOWN_MS = 5000; // 5 seconds between imports
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_IMPORTS_PER_WINDOW = 10;

/**
 * Prunes expired history records to prevent unbounded memory growth.
 */
function pruneHistory() {
  const now = Date.now();
  for (const [userId, record] of userHistory.entries()) {
    record.timestamps = record.timestamps.filter((ts) => now - ts < WINDOW_MS);
    if (record.timestamps.length === 0 && now - record.lastCompletedAt > WINDOW_MS) {
      userHistory.delete(userId);
    }
  }

  // If map still exceeds safety cap, evict oldest entries
  if (userHistory.size > MAX_MAP_ENTRIES) {
    const keysToRemove = Array.from(userHistory.keys()).slice(
      0,
      userHistory.size - MAX_MAP_ENTRIES
    );
    for (const key of keysToRemove) {
      userHistory.delete(key);
    }
  }
}

/**
 * Attempts to acquire an import slot for a given user.
 * @param {string} userId
 * @returns {{ allowed: boolean, message?: string, status?: number }}
 */
export function acquireImportSlot(userId) {
  if (!userId) {
    return {
      allowed: false,
      message: "Yêu cầu không hợp lệ: Thiếu định danh người dùng.",
      status: 401
    };
  }

  // 1. In-flight concurrency check
  if (inFlightUsers.has(userId)) {
    return {
      allowed: false,
      message: "Hệ thống đang xử lý tài liệu trước đó của bạn. Vui lòng chờ hoàn tất!",
      status: 429
    };
  }

  // 2. Cooldown and window limit check
  const now = Date.now();
  const record = userHistory.get(userId);

  if (record) {
    if (now - record.lastCompletedAt < COOLDOWN_MS) {
      const waitSeconds = Math.ceil((COOLDOWN_MS - (now - record.lastCompletedAt)) / 1000);
      return {
        allowed: false,
        message: `Vui lòng chờ ${waitSeconds} giây trước khi gửi yêu cầu xử lý tiếp theo.`,
        status: 429
      };
    }

    record.timestamps = record.timestamps.filter((ts) => now - ts < WINDOW_MS);
    if (record.timestamps.length >= MAX_IMPORTS_PER_WINDOW) {
      return {
        allowed: false,
        message: "Bạn đã đạt giới hạn số lần xử lý tài liệu trong 10 phút. Vui lòng thử lại sau!",
        status: 429
      };
    }
  }

  // Prune periodically when history grows
  if (userHistory.size > 200) {
    pruneHistory();
  }

  inFlightUsers.add(userId);
  return { allowed: true };
}

/**
 * Releases the in-flight slot for a given user and records completion time.
 * MUST be called in a finally block!
 * @param {string} userId
 */
export function releaseImportSlot(userId) {
  if (!userId) return;
  inFlightUsers.delete(userId);

  const now = Date.now();
  let record = userHistory.get(userId);
  if (!record) {
    record = { lastCompletedAt: now, timestamps: [] };
    userHistory.set(userId, record);
  }
  record.lastCompletedAt = now;
  record.timestamps.push(now);
}

/**
 * Resets limits state. Intended for testing only.
 */
export function _resetImportLimitsForTesting() {
  inFlightUsers.clear();
  userHistory.clear();
}
