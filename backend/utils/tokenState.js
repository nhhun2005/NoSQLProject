import crypto from "crypto";
import jwt from "jsonwebtoken";

/**
 * Derives an HMAC fingerprint of the stored password hash using JWT_SECRET.
 * This ensures that whenever the password changes (or is reset), prior tokens
 * will have a mismatched credentialVersion and be invalidated.
 */
export const getCredentialVersion = passwordHash => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required");
  return crypto.createHmac("sha256", secret).update(passwordHash || "").digest("hex").slice(0, 16);
};

/**
 * Generates access and refresh tokens containing the credentialVersion claim.
 */
export const generateTokens = user => {
  const credentialVersion = getCredentialVersion(user.password);
  const payload = {
    id: user._id.toString(),
    role: user.role,
    credentialVersion
  };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "3h"
  });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "7d"
  });
  return {
    accessToken,
    refreshToken,
    credentialVersion
  };
};
