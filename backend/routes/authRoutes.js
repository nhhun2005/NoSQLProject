import express from "express";
import * as authController from "../controllers/authController.js";
import { verifyToken } from "../middlewares/verifyToken.js";
import { createRateLimiter } from "../utils/rateLimiter.js";
const router = express.Router();

// Bound rate limiters for auth endpoints
const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Quá nhiều lượt đăng nhập, vui lòng thử lại sau."
});
const otpRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Quá nhiều yêu cầu OTP, vui lòng thử lại sau."
});
router.post("/login", loginRateLimiter, authController.login);
router.post("/refresh", authController.refresh);
router.get("/me", verifyToken, authController.checkToken);
router.post("/register", otpRateLimiter, authController.register);
router.post("/verify-otp", otpRateLimiter, authController.verifyOTP);
router.post("/forgot-password", otpRateLimiter, authController.forgotPassword);
router.post("/verify-forgot-otp", otpRateLimiter, authController.verifyForgotOtp);
router.post("/reset-password", otpRateLimiter, authController.resetPassword);
export default router;
