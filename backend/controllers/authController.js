// backend/controllers/authController.js
import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { sendVerificationEmail } from "../api/sendEmail.js";
import { generateTokens, getCredentialVersion } from "../utils/tokenState.js";

/**
 * Escapes regex special characters to prevent ReDoS or injection attacks.
 */
const isEmail = value => typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) && value.trim().length <= 254;
const validExpiry = value => value && Number.isFinite(new Date(value).getTime()) && new Date(value).getTime() > Date.now();
const escapeRegex = string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// -------------------------
// LOGIN
// -------------------------
export const login = async (req, res) => {
  try {
    const {
      username,
      email,
      password
    } = req.body || {};
    if (username !== undefined && typeof username !== "string" || email !== undefined && typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({
        message: "Dữ liệu đăng nhập không hợp lệ"
      });
    }
    const searchEmail = (email || "").toLowerCase().trim();
    const searchUsername = (username || "").toLowerCase().trim();
    if (!(searchEmail || searchUsername) || !password) {
      return res.status(400).json({
        message: "Vui lòng gửi email/tên đăng nhập và mật khẩu"
      });
    }
    const orConditions = [];
    if (searchEmail) {
      orConditions.push({
        email: {
          $regex: new RegExp("^" + escapeRegex(searchEmail) + "$", "i")
        }
      });
    }
    if (searchUsername) {
      orConditions.push({
        username: {
          $regex: new RegExp("^" + escapeRegex(searchUsername) + "$", "i")
        }
      });
      orConditions.push({
        email: {
          $regex: new RegExp("^" + escapeRegex(searchUsername) + "$", "i")
        }
      });
    }
    const user = await User.findOne({
      $or: orConditions
    });
    if (!user) {
      return res.status(400).json({
        message: "Tài khoản không tồn tại"
      });
    }
    if (!user.active) {
      return res.status(400).json({
        message: "Tài khoản chưa xác thực email"
      });
    }
    if (user.status === "banned") {
      return res.status(403).json({
        message: "Tài khoản đã bị khóa",
        status: "banned"
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        message: "Sai mật khẩu"
      });
    }
    const {
      accessToken,
      refreshToken
    } = generateTokens(user);
    return res.status(200).json({
      message: "Đăng nhập thành công",
      accessToken,
      refreshToken,
      role: user.role,
      email: user.email,
      name: user.username,
      id: user._id,
      active: user.active
    });
  } catch (_err) {
    return res.status(500).json({
      message: "Lỗi Server Nội bộ"
    });
  }
};

// -------------------------
// REFRESH TOKEN
// -------------------------
export const refresh = async (req, res) => {
  try {
    const {
      refreshToken
    } = req.body || {};
    if (!refreshToken || typeof refreshToken !== "string") {
      return res.status(401).json({
        message: "Không có refresh token hoặc không hợp lệ"
      });
    }
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (_err) {
      return res.status(401).json({
        message: "Refresh token không hợp lệ hoặc đã hết hạn"
      });
    }
    if (!decoded || !decoded.credentialVersion || !decoded.id) {
      return res.status(401).json({
        message: "Token thiếu credentialVersion"
      });
    }
    const user = await User.findById(decoded.id);
    if (!user || !user.active || user.status === "banned") {
      return res.status(401).json({
        message: "Tài khoản không hợp lệ hoặc đã bị khóa"
      });
    }
    const currentVersion = getCredentialVersion(user.password);
    if (decoded.credentialVersion !== currentVersion) {
      return res.status(401).json({
        message: "Phiên đăng nhập đã hết hạn do thay đổi thông tin"
      });
    }

    // Issue new accessToken with current DB role and credentialVersion
    const newAccessToken = jwt.sign({
      id: user._id.toString(),
      role: user.role,
      credentialVersion: currentVersion
    }, process.env.JWT_SECRET, {
      expiresIn: "3h"
    });
    return res.status(200).json({
      accessToken: newAccessToken
    });
  } catch (_err) {
    return res.status(500).json({
      message: "Lỗi khi refresh token"
    });
  }
};

// -------------------------
// CHECK TOKEN / ME
// -------------------------
export const checkToken = (req, res) => {
  // get /me returns sanitized user data without sensitive fields
  return res.status(200).json({
    message: "Token hợp lệ",
    user: {
      id: req.user.id,
      email: req.user.email,
      username: req.user.username,
      role: req.user.role
    }
  });
};

// -------------------------
// REGISTER + SEND OTP
// -------------------------
export const register = async (req, res) => {
  try {
    const {
      email,
      password
    } = req.body || {};
    if (!isEmail(email) || typeof password !== "string" || password.length < 6) {
      return res.status(400).json({
        message: "Email hợp lệ và mật khẩu ít nhất 6 ký tự là bắt buộc"
      });
    }
    const normalizedEmail = email.toLowerCase().trim();

    // Use crypto.randomInt for cryptographically secure OTP generation
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    const existingUser = await User.findOne({
      email: normalizedEmail
    });
    if (existingUser) {
      if (existingUser.active) {
        return res.status(400).json({
          message: "Email đã tồn tại"
        });
      }

      // Re-send OTP for inactive account
      existingUser.otp = otp;
      existingUser.otpExpires = otpExpiry;
      await existingUser.save();
      await sendVerificationEmail(normalizedEmail, otp);
      return res.status(200).json({
        message: "Email chưa xác thực. Mã OTP mới đã được gửi.",
        email: normalizedEmail
      });
    }
    const newUser = new User({
      email: normalizedEmail,
      username: normalizedEmail,
      password: password,
      role: "User",
      active: false,
      status: "normal",
      otp,
      otpExpires: otpExpiry
    });
    await newUser.save();
    await sendVerificationEmail(normalizedEmail, otp);
    return res.status(200).json({
      message: "Đã gửi mã OTP xác thực tới email của bạn.",
      email: normalizedEmail
    });
  } catch (_error) {
    return res.status(500).json({
      message: "Lỗi đăng ký"
    });
  }
};

// -------------------------
// VERIFY OTP (REGISTRATION)
// -------------------------
export const verifyOTP = async (req, res) => {
  try {
    const {
      email,
      otp
    } = req.body || {};
    if (!isEmail(email) || typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        message: "Email và mã OTP 6 số là bắt buộc"
      });
    }
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({
      email: normalizedEmail
    });
    if (!user) {
      return res.status(400).json({
        message: "Không tìm thấy tài khoản"
      });
    }
    if (user.active) {
      return res.status(400).json({
        message: "Tài khoản đã được kích hoạt"
      });
    }
    if (!user.otp || !user.otpExpires || user.otp !== otp || !validExpiry(user.otpExpires)) {
      return res.status(400).json({
        message: "Mã OTP không hợp lệ hoặc đã hết hạn"
      });
    }
    user.otp = null;
    user.otpExpires = null;
    user.active = true;
    await user.save();
    return res.status(200).json({
      message: "Xác thực thành công! Tài khoản đã được kích hoạt."
    });
  } catch (_error) {
    return res.status(500).json({
      message: "Lỗi xác thực OTP"
    });
  }
};

// -------------------------
// FORGOT PASSWORD
// -------------------------
export const forgotPassword = async (req, res) => {
  try {
    const {
      email
    } = req.body || {};
    if (!isEmail(email)) {
      return res.status(400).json({
        message: "Email là bắt buộc"
      });
    }
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({
      email: normalizedEmail
    });
    if (!user) {
      return res.status(400).json({
        message: "Email không tồn tại"
      });
    }
    if (user.status === "banned") {
      return res.status(403).json({
        message: "Tài khoản đã bị khóa",
        status: "banned"
      });
    }
    if (!user.active) {
      return res.status(400).json({
        message: "Tài khoản chưa xác thực email"
      });
    }

    // Cryptographically secure OTP
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    user.otp = otp;
    user.otpExpires = otpExpiry;
    await user.save();
    await sendVerificationEmail(normalizedEmail, otp);
    return res.status(200).json({
      message: "Mã OTP đã được gửi đến email."
    });
  } catch (_err) {
    return res.status(500).json({
      message: "Lỗi server"
    });
  }
};

// -------------------------
// VERIFY FORGOT-PASSWORD OTP (VALIDATION ONLY)
// -------------------------
export const verifyForgotOtp = async (req, res) => {
  try {
    const {
      email,
      otp
    } = req.body || {};
    if (!isEmail(email) || typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        message: "Email và mã OTP 6 số là bắt buộc"
      });
    }
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({
      email: normalizedEmail
    });
    if (!user) {
      return res.status(400).json({
        message: "Email không tồn tại"
      });
    }
    if (user.status === "banned") {
      return res.status(403).json({
        message: "Tài khoản đã bị khóa",
        status: "banned"
      });
    }
    if (!user.active) {
      return res.status(400).json({
        message: "Tài khoản chưa xác thực email"
      });
    }
    if (!user.otp || !user.otpExpires || user.otp !== otp || !validExpiry(user.otpExpires)) {
      return res.status(400).json({
        message: "Mã OTP không hợp lệ hoặc đã hết hạn"
      });
    }

    // verifyForgotOtp remains validation only: does not alter OTP
    return res.status(200).json({
      message: "OTP hợp lệ, bạn có thể đặt lại mật khẩu"
    });
  } catch (_err) {
    return res.status(500).json({
      message: "Lỗi server"
    });
  }
};

// -------------------------
// RESET PASSWORD (ATOMIC OTP CONSUMPTION)
// -------------------------
export const resetPassword = async (req, res) => {
  try {
    const {
      email,
      otp,
      newPassword
    } = req.body || {};
    if (!isEmail(email) || typeof otp !== "string" || !/^\d{6}$/.test(otp) || typeof newPassword !== "string" || newPassword.length < 6) {
      return res.status(400).json({
        message: "Email, mã OTP 6 số và mật khẩu mới (ít nhất 6 ký tự) là bắt buộc"
      });
    }
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({
      email: normalizedEmail
    });
    if (!user) {
      return res.status(400).json({
        message: "Email không tồn tại"
      });
    }
    if (user.status === "banned") {
      return res.status(403).json({
        message: "Tài khoản đã bị khóa",
        status: "banned"
      });
    }
    if (!user.active) {
      return res.status(400).json({
        message: "Tài khoản chưa xác thực email"
      });
    }

    // Verify OTP again before consuming
    if (!user.otp || !user.otpExpires || user.otp !== otp || !validExpiry(user.otpExpires)) {
      return res.status(400).json({
        message: "OTP không hợp lệ hoặc đã hết hạn"
      });
    }

    // Manually hash newPassword since findOneAndUpdate bypasses Mongoose pre-save hook
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Atomically consume OTP and update password
    const updatedUser = await User.findOneAndUpdate({
      _id: user._id,
      otp: otp,
      password: user.password,
      otpExpires: {
        $gt: new Date()
      },
      active: true,
      status: {
        $ne: "banned"
      }
    }, {
      $set: {
        password: hashedPassword,
        otp: null,
        otpExpires: null
      }
    }, {
      new: true
    });
    if (!updatedUser) {
      return res.status(400).json({
        message: "OTP không hợp lệ hoặc đã hết hạn"
      });
    }
    return res.status(200).json({
      message: "Mật khẩu đã được cập nhật thành công."
    });
  } catch (_err) {
    return res.status(500).json({
      message: "Lỗi server"
    });
  }
};
