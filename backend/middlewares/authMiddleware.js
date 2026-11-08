// backend/middlewares/authMiddleware.js
// Re-export the same middleware from verifyToken.js to avoid duplicate policy
export { verifyToken, verifyAdmin } from "./verifyToken.js";
