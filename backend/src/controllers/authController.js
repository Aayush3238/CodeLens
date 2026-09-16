const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const path = require("path");
const prisma = require("../config/db");
const { generateToken, generateRefreshToken } = require("../middleware/auth");
const { signupSchema, loginSchema, updateProfileSchema } = require("../validators/auth");
const { logAudit } = require("../utils/audit");
const { hashToken } = require("../utils/encryption");
const logger = require("../utils/logger");

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

const userSelect = {
  id: true,
  name: true,
  email: true,
  avatar: true,
  leetcodeUsername: true,
  googleId: true,
  githubId: true,
  createdAt: true,
};

const signup = async (req, res, next) => {
  try {
    const data = signupSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      if (!existing.password) {
        return res.status(409).json({
          message: "An account with this email exists via social login. Please sign in with Google or GitHub, then set a password in Settings.",
        });
      }
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: { ...data, password: hashedPassword },
      select: userSelect,
    });

    const token = generateToken(user.id);
    const refreshToken = await generateRefreshToken(user.id);

    await logAudit(user.id, "ACCOUNT_CREATED", "Email/password signup", req.ip);

    res.status(201).json({ user, token, refreshToken });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.lockedUntil - new Date()) / 60000);
      return res.status(423).json({
        message: `Account is locked due to too many failed attempts. Try again in ${remainingMinutes} minutes.`,
      });
    }

    if (user.lockedUntil && user.lockedUntil <= new Date()) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    if (!user.password) {
      const methods = [];
      if (user.googleId) methods.push("Google");
      if (user.githubId) methods.push("GitHub");
      const methodStr = methods.length > 0 ? methods.join(" or ") : "social login";
      return res.status(401).json({ message: `This account uses ${methodStr}. Please sign in with your connected provider.` });
    }

    const isValidPassword = await bcrypt.compare(data.password, user.password);
    if (!isValidPassword) {
      const newAttempts = user.failedLoginAttempts + 1;
      const updateData = { failedLoginAttempts: newAttempts };

      if (newAttempts >= MAX_FAILED_ATTEMPTS) {
        updateData.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        await logAudit(user.id, "ACCOUNT_LOCKED", `Locked after ${newAttempts} failed attempts`, req.ip);
      }

      await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (user.failedLoginAttempts > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    const token = generateToken(user.id);
    const refreshToken = await generateRefreshToken(user.id);
    const { password: _, ...userWithoutPassword } = user;

    await logAudit(user.id, "LOGIN", "Email/password login", req.ip);

    res.json({ user: userWithoutPassword, token, refreshToken });
  } catch (error) {
    next(error);
  }
};

const setPassword = async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password || typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword },
    });

    await logAudit(req.user.id, "PASSWORD_SET", "Password set for OAuth account", req.ip);

    res.json({ message: "Password set successfully" });
  } catch (error) {
    next(error);
  }
};

const googleCallback = async (req, res) => {
  try {
    const token = generateToken(req.user.id);
    const refreshToken = await generateRefreshToken(req.user.id);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    res.redirect(`${frontendUrl}/oauth/callback?token=${token}&refreshToken=${refreshToken}`);
  } catch (error) {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    res.redirect(`${frontendUrl}/login?error=auth_failed`);
  }
};

const githubCallback = async (req, res) => {
  try {
    const token = generateToken(req.user.id);
    const refreshToken = await generateRefreshToken(req.user.id);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    res.redirect(`${frontendUrl}/oauth/callback?token=${token}&refreshToken=${refreshToken}`);
  } catch (error) {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    res.redirect(`${frontendUrl}/login?error=auth_failed`);
  }
};

const getProfile = async (req, res) => {
  res.json({ user: req.user });
};

const updateProfile = async (req, res, next) => {
  try {
    const data = updateProfileSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: userSelect,
    });

    await logAudit(req.user.id, "PROFILE_UPDATED", JSON.stringify(Object.keys(data)), req.ip);

    res.json({ user });
  } catch (error) {
    next(error);
  }
};

const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { avatar: avatarUrl },
      select: userSelect,
    });

    res.json({ user, avatar: avatarUrl });
  } catch (error) {
    next(error);
  }
};

const deleteAccount = async (req, res, next) => {
  try {
    await logAudit(req.user.id, "ACCOUNT_DELETED", "User initiated account deletion", req.ip);
    await prisma.user.delete({ where: { id: req.user.id } });
    res.json({ message: "Account deleted" });
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.json({ message: "If an account exists, a reset link has been sent." });
    }

    if (!user.password) {
      return res.json({ message: "If an account exists, a reset link has been sent." });
    }

    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, used: false } });

    const resetToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(resetToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: { userId: user.id, token: tokenHash, expiresAt },
    });

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    if (process.env.NODE_ENV !== "production") {
      logger.info(`[Password Reset] ${user.email}: ${resetUrl}`);
    } else {
      logger.info(`[Password Reset] Reset token generated for user ${user.id}`);
    }

    await logAudit(user.id, "PASSWORD_RESET_REQUESTED", "Password reset requested", req.ip);

    res.json({ message: "If an account exists, a reset link has been sent." });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || typeof token !== "string") {
      return res.status(400).json({ message: "Token is required" });
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const tokenHash = hashToken(token);
    const resetToken = await prisma.passwordResetToken.findUnique({ where: { token: tokenHash } });
    if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    await prisma.user.update({ where: { id: resetToken.userId }, data: { password: hashedPassword } });
    await prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { used: true } });

    await logAudit(resetToken.userId, "PASSWORD_RESET", "Password reset via email", req.ip);

    res.json({ message: "Password reset successful" });
  } catch (error) {
    next(error);
  }
};

module.exports = { signup, login, setPassword, googleCallback, githubCallback, getProfile, updateProfile, uploadAvatar, deleteAccount, forgotPassword, resetPassword };
