// backend/middlewares/verifyToken.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { getCredentialVersion } from "../utils/tokenState.js";

// ✅ Kiểm tra token hợp lệ và xác thực trạng thái người dùng trong DB
export const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Không có token hoặc token không hợp lệ"
    });
  }
  const token = authHeader.split(" ")[1];
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (_err) {
    return res.status(401).json({
      message: "Token không hợp lệ hoặc đã hết hạn"
    });
  }

  // Reject legacy tokens missing credentialVersion
  if (!decoded || !decoded.credentialVersion) {
    return res.status(401).json({
      message: "Token thiếu thông tin xác thực, vui lòng đăng nhập lại"
    });
  }
  try {
    const user = await User.findById(decoded.id);

    // Deleted, disabled or banned users are rejected with 401
    if (!user) {
      return res.status(401).json({
        message: "Tài khoản không tồn tại"
      });
    }
    if (!user.active) {
      return res.status(401).json({
        message: "Tài khoản chưa được kích hoạt"
      });
    }
    if (user.status === "banned") {
      return res.status(401).json({
        message: "Tài khoản đã bị khóa"
      });
    }

    // Check if password has been changed / reset
    const currentVersion = getCredentialVersion(user.password);
    if (decoded.credentialVersion !== currentVersion) {
      return res.status(401).json({
        message: "Phiên đăng nhập đã hết hạn do thay đổi thông tin"
      });
    }

    // Assign current role and information directly from DB, never trusting stale token role
    req.user = {
      id: user._id.toString(),
      role: user.role,
      email: user.email,
      username: user.username
    };
    next();
  } catch (_dbErr) {
    return res.status(500).json({
      message: "Lỗi xác thực người dùng"
    });
  }
};

// ✅ Kiểm tra quyền Admin
export const verifyAdmin = (req, res, next) => {
  return verifyToken(req, res, () => {
    if (req.user && req.user.role === "Admin") {
      next();
    } else {
      return res.status(403).json({
        message: "Không có quyền truy cập (chỉ Admin)"
      });
    }
  });
};
