import User from "../models/User.js";

// Helper function to sanitize user object and exclude sensitive fields
const sanitizeUser = user => {
  if (!user) return null;
  const userObj = typeof user.toObject === "function" ? user.toObject() : {
    ...user
  };
  delete userObj.password;
  delete userObj.otp;
  delete userObj.otpExpires;
  return userObj;
};

// Lấy tất cả user
export const getUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password -otp -otpExpires");
    const sanitizedUsers = users.map(sanitizeUser);
    res.json(sanitizedUsers);
  } catch (_err) {
    res.status(500).json({
      message: "Lỗi khi lấy danh sách người dùng"
    });
  }
};

// Thêm user mới
export const createUser = async (req, res) => {
  try {
    const userData = {
      ...req.body
    };
    if (!userData.status) userData.status = "normal";
    const user = new User(userData);
    await user.save();
    res.status(201).json(sanitizeUser(user));
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({
        message: "Email đã tồn tại"
      });
    }
    res.status(400).json({
      message: "Dữ liệu tạo người dùng không hợp lệ"
    });
  }
};

// Chuyển trạng thái banned <-> normal
export const toggleUserStatus = async (req, res) => {
  try {
    if (String(req.user.id) === String(req.params.id)) {
      return res.status(403).json({
        message: "Không thể vô hiệu hóa chính tài khoản của bạn."
      });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({
      message: "User not found"
    });
    user.status = user.status === "normal" ? "banned" : "normal";
    await user.save();
    res.json(sanitizeUser(user));
  } catch (_err) {
    res.status(500).json({
      message: "Lỗi khi chuyển trạng thái người dùng"
    });
  }
};

// Cập nhật user
export const updateUser = async (req, res) => {
  try {
    const targetId = req.params.id;
    if (String(req.user.id) === String(targetId)) {
      return res.status(403).json({
        message: "Không thể thay đổi role, status hoặc email của chính bạn."
      });
    }
    const {
      username,
      email,
      role,
      status
    } = req.body;
    const updateData = {};
    if (username !== undefined) updateData.username = username;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (status !== undefined) updateData.status = status;
    const user = await User.findByIdAndUpdate(targetId, updateData, {
      new: true,
      runValidators: true
    }).select("-password -otp -otpExpires");
    if (!user) return res.status(404).json({
      message: "Không tìm thấy user"
    });
    res.json(sanitizeUser(user));
  } catch (_err) {
    res.status(500).json({
      message: "Lỗi khi cập nhật user"
    });
  }
};

// Xóa user hẳn nếu cần
export const deleteUser = async (req, res) => {
  try {
    if (String(req.user.id) === String(req.params.id)) {
      return res.status(403).json({
        message: "Không thể xóa chính tài khoản của bạn."
      });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({
      message: "User not found"
    });
    res.json({
      message: "User deleted successfully"
    });
  } catch (_err) {
    res.status(500).json({
      message: "Lỗi khi xóa người dùng"
    });
  }
};
