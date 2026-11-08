import test from "node:test";
import assert from "node:assert/strict";
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || "re_test_key";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret";
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "test_jwt_refresh_secret";
const bcrypt = (await import("bcryptjs")).default;
const User = (await import("../models/User.js")).default;
const {
  resetPassword,
  verifyForgotOtp,
  login
} = await import("../controllers/authController.js");
const {
  createMockReqRes
} = await import("./helpers.js");
test("BE01 & Auth OTP Regression Tests", async t => {
  const originalFindOne = User.findOne;
  const originalFindOneAndUpdate = User.findOneAndUpdate;
  t.afterEach(() => {
    User.findOne = originalFindOne;
    User.findOneAndUpdate = originalFindOneAndUpdate;
  });
  await t.test("resetPassword fails when missing required fields", async () => {
    const {
      req,
      res
    } = createMockReqRes({
      body: {
        email: "test@example.com",
        otp: "123456"
      } // missing newPassword
    });
    await resetPassword(req, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.data.message, /bắt buộc/i);
  });
  await t.test("resetPassword fails when password is less than 6 chars", async () => {
    const {
      req,
      res
    } = createMockReqRes({
      body: {
        email: "test@example.com",
        otp: "123456",
        newPassword: "123"
      }
    });
    await resetPassword(req, res);
    assert.equal(res.statusCode, 400);
  });
  await t.test("resetPassword fails when OTP is not 6 numeric digits", async () => {
    const {
      req,
      res
    } = createMockReqRes({
      body: {
        email: "test@example.com",
        otp: "abc",
        newPassword: "validPassword123"
      }
    });
    await resetPassword(req, res);
    assert.equal(res.statusCode, 400);
  });
  await t.test("resetPassword rejects expired OTP or null expiry date", async () => {
    User.findOne = async () => ({
      _id: "user123",
      email: "test@example.com",
      active: true,
      status: "normal",
      otp: "123456",
      otpExpires: new Date(Date.now() - 5000),
      // expired 5 seconds ago
      password: "hashedPasswordOld"
    });
    const {
      req,
      res
    } = createMockReqRes({
      body: {
        email: "test@example.com",
        otp: "123456",
        newPassword: "newSecurePassword123"
      }
    });
    await resetPassword(req, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.data.message, /hết hạn/i);
  });
  await t.test("resetPassword rejects wrong OTP", async () => {
    User.findOne = async () => ({
      _id: "user123",
      email: "test@example.com",
      active: true,
      status: "normal",
      otp: "999999",
      // Different OTP in DB
      otpExpires: new Date(Date.now() + 60000),
      password: "hashedPasswordOld"
    });
    const {
      req,
      res
    } = createMockReqRes({
      body: {
        email: "test@example.com",
        otp: "123456",
        newPassword: "newSecurePassword123"
      }
    });
    await resetPassword(req, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.data.message, /không hợp lệ/i);
  });
  await t.test("resetPassword rejects banned user", async () => {
    User.findOne = async () => ({
      _id: "user123",
      email: "banned@example.com",
      active: true,
      status: "banned",
      otp: "123456",
      otpExpires: new Date(Date.now() + 60000)
    });
    const {
      req,
      res
    } = createMockReqRes({
      body: {
        email: "banned@example.com",
        otp: "123456",
        newPassword: "newSecurePassword123"
      }
    });
    await resetPassword(req, res);
    assert.equal(res.statusCode, 403);
    assert.match(res.data.message, /khóa/i);
  });
  await t.test("resetPassword succeeds and atomically consumes OTP using findOneAndUpdate with bcrypt hash", async () => {
    const dummyUser = {
      _id: "user123",
      email: "test@example.com",
      active: true,
      status: "normal",
      otp: "123456",
      otpExpires: new Date(Date.now() + 60000),
      password: "hashedOldPassword"
    };
    User.findOne = async () => dummyUser;
    let atomicQuery = null;
    let updateDoc = null;
    User.findOneAndUpdate = async (query, update) => {
      atomicQuery = query;
      updateDoc = update;
      return {
        _id: dummyUser._id,
        email: dummyUser.email
      };
    };
    const {
      req,
      res
    } = createMockReqRes({
      body: {
        email: "  TEST@example.com  ",
        // Test normalization
        otp: "123456",
        newPassword: "newSecurePassword123"
      }
    });
    await resetPassword(req, res);
    assert.equal(res.statusCode, 200);
    assert.match(res.data.message, /cập nhật thành công/i);

    // Verify atomic condition passed to findOneAndUpdate
    assert.equal(atomicQuery._id, "user123");
    assert.equal(atomicQuery.otp, "123456");
    assert.equal(atomicQuery.password, "hashedOldPassword");
    assert.equal(atomicQuery.active, true);
    assert.deepEqual(atomicQuery.status, {
      $ne: "banned"
    });

    // Verify OTP is cleared and password is manually hashed
    assert.equal(updateDoc.$set.otp, null);
    assert.equal(updateDoc.$set.otpExpires, null);
    const isNewPasswordHashed = await bcrypt.compare("newSecurePassword123", updateDoc.$set.password);
    assert.equal(isNewPasswordHashed, true);
  });
  await t.test("resetPassword replay fails if OTP was already consumed", async () => {
    User.findOne = async () => ({
      _id: "user123",
      email: "test@example.com",
      active: true,
      status: "normal",
      otp: "123456",
      otpExpires: new Date(Date.now() + 60000),
      password: "hashedOldPassword"
    });

    // Simulate concurrent consumption or replay: findOneAndUpdate returns null
    User.findOneAndUpdate = async () => null;
    const {
      req,
      res
    } = createMockReqRes({
      body: {
        email: "test@example.com",
        otp: "123456",
        newPassword: "newSecurePassword123"
      }
    });
    await resetPassword(req, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.data.message, /hết hạn/i);
  });
  await t.test("verifyForgotOtp validates without clearing OTP", async () => {
    let saved = false;
    const dummyUser = {
      _id: "user123",
      email: "test@example.com",
      active: true,
      status: "normal",
      otp: "123456",
      otpExpires: new Date(Date.now() + 60000),
      save: async () => {
        saved = true;
      }
    };
    User.findOne = async () => dummyUser;
    const {
      req,
      res
    } = createMockReqRes({
      body: {
        email: "test@example.com",
        otp: "123456"
      }
    });
    await verifyForgotOtp(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(saved, false); // verifyForgotOtp must NOT modify or save user
    assert.equal(dummyUser.otp, "123456"); // OTP preserved
  });
  await t.test("login escapes regex characters in email and username", async () => {
    let searchedQuery = null;
    User.findOne = async query => {
      searchedQuery = query;
      return null;
    };
    const maliciousEmail = "admin.*@test.com";
    const {
      req,
      res
    } = createMockReqRes({
      body: {
        email: maliciousEmail,
        password: "password123"
      }
    });
    await login(req, res);
    assert.equal(res.statusCode, 400);
    // Ensure regex was escaped, not raw .*
    const regexPattern = searchedQuery.$or[0].email.$regex.toString();
    assert.ok(regexPattern.includes("\\.\\*"), `Pattern should have escaped dots and asterisks: ${regexPattern}`);
  });
});
