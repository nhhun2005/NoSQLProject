import crypto from "crypto";

/**
 * In-memory attempt store for quiz attempts.
 *
 * NOTE: Attempts are stored in-memory and will be lost on server restart or
 * process termination. This store does not provide multi-instance durability
 * across clustered deployments; instances maintain their own local state.
 */

const MAX_TOTAL_ATTEMPTS = 5000;
const MAX_USER_ATTEMPTS = 10;

// Map: attemptId -> attemptData
const attempts = new Map();

/**
 * Remove expired attempts from memory.
 */
const pruneExpired = () => {
  const now = Date.now();
  for (const [id, attempt] of attempts.entries()) {
    // Keep completed attempts slightly longer for idempotency, or prune expired ones
    const expiry = new Date(attempt.expiresAt).getTime();
    if (now > expiry + 60 * 1000) {
      attempts.delete(id);
    }
  }
};

/**
 * Count active (non-expired) attempts for a specific user.
 */
const countUserAttempts = userId => {
  const now = Date.now();
  let count = 0;
  for (const attempt of attempts.values()) {
    if (String(attempt.userId) === String(userId)) {
      if (!attempt.result && now <= new Date(attempt.expiresAt).getTime()) {
        count++;
      }
    }
  }
  return count;
};

/**
 * Create a new quiz attempt.
 */
export const createAttempt = ({
  quizId,
  userId,
  scoreMode,
  timeLimitMinutes,
  questions
}) => {
  pruneExpired();
  if (scoreMode && attempts.size >= MAX_TOTAL_ATTEMPTS) {
    return {
      error: "CAPACITY_EXCEEDED"
    };
  }
  const userActiveCount = countUserAttempts(userId);
  if (scoreMode && userActiveCount >= MAX_USER_ATTEMPTS) {
    return {
      error: "USER_LIMIT_EXCEEDED"
    };
  }
  const attemptId = crypto.randomUUID();
  const startTime = new Date();

  // If scoreMode is true, calculate expiration based on timeLimitMinutes + 30s grace.
  // If scoreMode is false (practice), default to 2 hours TTL for memory safety.
  let expiresAt;
  if (scoreMode) {
    const durationMs = timeLimitMinutes * 60 * 1000 + 30 * 1000; // 30s grace
    expiresAt = new Date(startTime.getTime() + durationMs);
  } else {
    expiresAt = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);
  }

  // Create immutable question snapshot
  const questionSnapshot = questions.map(q => {
    const qObj = typeof q.toObject === "function" ? q.toObject() : {
      ...q
    };
    return {
      _id: String(qObj._id),
      question: qObj.question,
      options: Array.isArray(qObj.options) ? [...qObj.options] : [],
      answer: qObj.answer,
      explain: qObj.explain,
      image: qObj.image
    };
  });
  const attempt = {
    attemptId,
    quizId: String(quizId),
    userId: String(userId),
    scoreMode: Boolean(scoreMode),
    startTime,
    expiresAt,
    questions: questionSnapshot,
    claimed: false,
    inFlight: false,
    result: null
  };

  // Practice is graded in the UI and never submitted; do not retain its snapshot.
  if (scoreMode) attempts.set(attemptId, attempt);
  return {
    attempt
  };
};

/**
 * Get an attempt by ID.
 */
export const getAttempt = attemptId => {
  return attempts.get(attemptId) || null;
};

/**
 * Atomically claim an attempt synchronously to prevent concurrent double writes.
 * Returns true if claimed successfully, false if already in flight or claimed.
 */
export const claimAttempt = (attemptId, userId) => {
  const attempt = attempts.get(attemptId);
  if (!attempt) return false;
  if (String(attempt.userId) !== String(userId)) return false;
  if (attempt.claimed || attempt.inFlight) {
    return false;
  }
  attempt.claimed = true;
  attempt.inFlight = true;
  return true;
};

/**
 * Release claim if persistence fails so user may retry.
 */
export const releaseClaim = attemptId => {
  const attempt = attempts.get(attemptId);
  if (attempt) {
    attempt.claimed = false;
    attempt.inFlight = false;
  }
};

/**
 * Cache successful result in attempt for idempotent repeat.
 */
export const setAttemptResult = (attemptId, result) => {
  const attempt = attempts.get(attemptId);
  if (attempt) {
    attempt.inFlight = false;
    attempt.result = result;
  }
};

/**
 * Clear all attempts (for testing).
 */
export const clearAllAttempts = () => {
  attempts.clear();
};
