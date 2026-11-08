import test from "node:test";
import assert from "node:assert/strict";
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || "re_test_key";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret";
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "test_jwt_refresh_secret";
const jwt = (await import("jsonwebtoken")).default;
const User = (await import("../models/User.js")).default;
const {
  verifyToken,
  verifyAdmin
} = await import("../middlewares/verifyToken.js");
const {
  verifyToken: authMwToken,
  verifyAdmin: authMwAdmin
} = await import("../middlewares/authMiddleware.js");
const {
  refresh,
  checkToken
} = await import("../controllers/authController.js");
const {
  getUsers
} = await import("../controllers/userController.js");
const {
  getCredentialVersion
} = await import("../utils/tokenState.js");
const {
  createMockReqRes
} = await import("./helpers.js");
test("BE05 & Token / Route Guard Regression Tests", async t => {
  const originalFindById = User.findById;
  const originalFind = User.find;
  const originalFindByIdAndUpdate = User.findByIdAndUpdate;
  t.afterEach(() => {
    User.findById = originalFindById;
    User.find = originalFind;
    User.findByIdAndUpdate = originalFindByIdAndUpdate;
  });
  await t.test("authMiddleware re-exports verifyToken and verifyAdmin identically", () => {
    assert.equal(authMwToken, verifyToken);
    assert.equal(authMwAdmin, verifyAdmin);
  });
  await t.test("verifyToken rejects requests without Bearer header (401)", async () => {
    const {
      req,
      res
    } = createMockReqRes({
      headers: {}
    });
    let nextCalled = false;
    await verifyToken(req, res, () => {
      nextCalled = true;
    });
    assert.equal(res.statusCode, 401);
    assert.equal(nextCalled, false);
    assert.match(res.data.message, /không có token/i);
  });
  await t.test("verifyToken rejects invalid or expired token signature with 401", async () => {
    const {
      req,
      res
    } = createMockReqRes({
      headers: {
        authorization: "Bearer invalid.jwt.token"
      }
    });
    let nextCalled = false;
    await verifyToken(req, res, () => {
      nextCalled = true;
    });
    assert.equal(res.statusCode, 401);
    assert.equal(nextCalled, false);
    assert.match(res.data.message, /hết hạn/i);
  });
  await t.test("verifyToken rejects legacy tokens lacking credentialVersion with 401", async () => {
    // Generate legacy token without credentialVersion
    const legacyToken = jwt.sign({
      id: "user123",
      role: "User"
    }, process.env.JWT_SECRET);
    const {
      req,
      res
    } = createMockReqRes({
      headers: {
        authorization: `Bearer ${legacyToken}`
      }
    });
    let nextCalled = false;
    await verifyToken(req, res, () => {
      nextCalled = true;
    });
    assert.equal(res.statusCode, 401);
    assert.equal(nextCalled, false);
    assert.match(res.data.message, /credentialVersion|xác thực/i);
  });
  await t.test("verifyToken rejects deleted user (401)", async () => {
    const validToken = jwt.sign({
      id: "deleted123",
      role: "User",
      credentialVersion: "v1"
    }, process.env.JWT_SECRET);
    User.findById = async () => null;
    const {
      req,
      res
    } = createMockReqRes({
      headers: {
        authorization: `Bearer ${validToken}`
      }
    });
    let nextCalled = false;
    await verifyToken(req, res, () => {
      nextCalled = true;
    });
    assert.equal(res.statusCode, 401);
    assert.equal(nextCalled, false);
    assert.match(res.data.message, /không tồn tại/i);
  });
  await t.test("verifyToken rejects inactive user (401)", async () => {
    const passwordHash = "$2a$10$abcdefghijklmnopqrstuvwxyz123456";
    const credVer = getCredentialVersion(passwordHash);
    const token = jwt.sign({
      id: "user123",
      role: "User",
      credentialVersion: credVer
    }, process.env.JWT_SECRET);
    User.findById = async () => ({
      _id: "user123",
      active: false,
      // inactive
      status: "normal",
      password: passwordHash,
      role: "User"
    });
    const {
      req,
      res
    } = createMockReqRes({
      headers: {
        authorization: `Bearer ${token}`
      }
    });
    let nextCalled = false;
    await verifyToken(req, res, () => {
      nextCalled = true;
    });
    assert.equal(res.statusCode, 401);
    assert.equal(nextCalled, false);
    assert.match(res.data.message, /chưa được kích hoạt/i);
  });
  await t.test("verifyToken rejects banned user (401)", async () => {
    const passwordHash = "$2a$10$abcdefghijklmnopqrstuvwxyz123456";
    const credVer = getCredentialVersion(passwordHash);
    const token = jwt.sign({
      id: "user123",
      role: "User",
      credentialVersion: credVer
    }, process.env.JWT_SECRET);
    User.findById = async () => ({
      _id: "user123",
      active: true,
      status: "banned",
      // banned
      password: passwordHash,
      role: "User"
    });
    const {
      req,
      res
    } = createMockReqRes({
      headers: {
        authorization: `Bearer ${token}`
      }
    });
    let nextCalled = false;
    await verifyToken(req, res, () => {
      nextCalled = true;
    });
    assert.equal(res.statusCode, 401);
    assert.equal(nextCalled, false);
    assert.match(res.data.message, /khóa/i);
  });
  await t.test("verifyToken invalidates token if password was changed (401)", async () => {
    const oldPasswordHash = "$2a$10$oldpasswordhash1234567890abcdef";
    const newPasswordHash = "$2a$10$newpasswordhash9876543210fedcba";

    // Token issued with old password
    const oldCredVer = getCredentialVersion(oldPasswordHash);
    const token = jwt.sign({
      id: "user123",
      role: "User",
      credentialVersion: oldCredVer
    }, process.env.JWT_SECRET);

    // DB now has new password
    User.findById = async () => ({
      _id: "user123",
      active: true,
      status: "normal",
      password: newPasswordHash,
      role: "User"
    });
    const {
      req,
      res
    } = createMockReqRes({
      headers: {
        authorization: `Bearer ${token}`
      }
    });
    let nextCalled = false;
    await verifyToken(req, res, () => {
      nextCalled = true;
    });
    assert.equal(res.statusCode, 401);
    assert.equal(nextCalled, false);
    assert.match(res.data.message, /thay đổi/i);
  });
  await t.test("verifyToken pulls role from DB, ignoring stale token role", async () => {
    const passwordHash = "$2a$10$samepasswordhash1234567890abc";
    const credVer = getCredentialVersion(passwordHash);

    // Stale token claims role is "Admin"
    const staleToken = jwt.sign({
      id: "user123",
      role: "Admin",
      credentialVersion: credVer
    }, process.env.JWT_SECRET);

    // But DB currently has role "User" (demoted)
    User.findById = async () => ({
      _id: "user123",
      active: true,
      status: "normal",
      password: passwordHash,
      role: "User",
      email: "test@example.com",
      username: "testuser"
    });
    const {
      req,
      res
    } = createMockReqRes({
      headers: {
        authorization: `Bearer ${staleToken}`
      }
    });
    let nextCalled = false;
    await verifyToken(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    assert.equal(req.user.role, "User"); // Overridden from DB
  });
  await t.test("verifyAdmin allows Admin and rejects normal User with 403", async () => {
    const passwordHash = "$2a$10$samepasswordhash1234567890abc";
    const credVer = getCredentialVersion(passwordHash);
    const token = jwt.sign({
      id: "user123",
      role: "User",
      credentialVersion: credVer
    }, process.env.JWT_SECRET);
    User.findById = async () => ({
      _id: "user123",
      active: true,
      status: "normal",
      password: passwordHash,
      role: "User" // not Admin
    });
    const {
      req,
      res
    } = createMockReqRes({
      headers: {
        authorization: `Bearer ${token}`
      }
    });
    let nextCalled = false;
    await verifyAdmin(req, res, () => {
      nextCalled = true;
    });
    assert.equal(res.statusCode, 403);
    assert.equal(nextCalled, false);
    assert.match(res.data.message, /chỉ Admin/i);
  });
  await t.test("refresh token checks current DB status and password version", async () => {
    const oldPassword = "$2a$10$oldhash";
    const newPassword = "$2a$10$newhash";
    const oldVersion = getCredentialVersion(oldPassword);
    const refreshToken = jwt.sign({
      id: "user123",
      role: "User",
      credentialVersion: oldVersion
    }, process.env.JWT_REFRESH_SECRET);

    // Password changed in DB
    User.findById = async () => ({
      _id: "user123",
      active: true,
      status: "normal",
      password: newPassword,
      role: "User"
    });
    const {
      req,
      res
    } = createMockReqRes({
      body: {
        refreshToken
      }
    });
    await refresh(req, res);
    assert.equal(res.statusCode, 401);
  });
  await t.test("refresh token succeeds with current DB role and fingerprint", async () => {
    const password = "$2a$10$currenthash";
    const version = getCredentialVersion(password);
    const refreshToken = jwt.sign({
      id: "user123",
      role: "User",
      credentialVersion: version
    }, process.env.JWT_REFRESH_SECRET);
    User.findById = async () => ({
      _id: "user123",
      active: true,
      status: "normal",
      password,
      role: "Admin" // Role upgraded in DB
    });
    const {
      req,
      res
    } = createMockReqRes({
      body: {
        refreshToken
      }
    });
    await refresh(req, res);
    assert.equal(res.statusCode, 200);
    assert.ok(res.data.accessToken);
    const decoded = jwt.verify(res.data.accessToken, process.env.JWT_SECRET);
    assert.equal(decoded.role, "Admin");
    assert.equal(decoded.credentialVersion, version);
  });
  await t.test("checkToken /me returns no sensitive fields (password, otp, otpExpires)", () => {
    const {
      req,
      res
    } = createMockReqRes({
      user: {
        id: "user123",
        email: "test@example.com",
        username: "testuser",
        role: "User",
        password: "secretPassword",
        // Should NOT be included
        otp: "123456",
        otpExpires: new Date()
      }
    });
    checkToken(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.data.user.password, undefined);
    assert.equal(res.data.user.otp, undefined);
    assert.equal(res.data.user.otpExpires, undefined);
    assert.equal(res.data.user.id, "user123");
    assert.equal(res.data.user.email, "test@example.com");
  });
  await t.test("userController methods sanitize output, excluding password/otp/otpExpires", async () => {
    const mockUserDoc = {
      _id: "u1",
      username: "user1",
      email: "u1@test.com",
      password: "hashedPassword",
      otp: "123456",
      otpExpires: new Date(),
      toObject() {
        return {
          ...this
        };
      }
    };
    User.find = () => ({
      select: () => [mockUserDoc]
    });
    const {
      req,
      res
    } = createMockReqRes();
    await getUsers(req, res);
    assert.equal(res.statusCode, 200);
    const users = res.data;
    assert.equal(users.length, 1);
    assert.equal(users[0].password, undefined);
    assert.equal(users[0].otp, undefined);
    assert.equal(users[0].otpExpires, undefined);
  });
});
