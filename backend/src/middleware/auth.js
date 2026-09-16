const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const prisma = require("../config/db");

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1] || req.cookies?.token;

    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const decoded = jwt.verify(token, ACCESS_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true, avatar: true, leetcodeUsername: true, googleId: true, githubId: true },
    });

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Invalid token" });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired", code: "TOKEN_EXPIRED" });
    }
    next(error);
  }
};

const generateToken = (userId) => {
  return jwt.sign({ userId }, ACCESS_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

const generateAccessToken = (userId) => {
  return jwt.sign({ userId, type: "access" }, ACCESS_SECRET, {
    expiresIn: "15m",
  });
};

const generateRefreshToken = async (userId) => {
  const token = jwt.sign({ userId, type: "refresh" }, REFRESH_SECRET, {
    expiresIn: "30d",
  });

  await prisma.refreshToken.create({
    data: {
      userId,
      token,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  return token;
};

const refreshAccessToken = async (refreshToken) => {
  const decoded = jwt.verify(refreshToken, REFRESH_SECRET);

  if (decoded.type !== "refresh") {
    throw new Error("Invalid token type");
  }

  const stored = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
  });

  if (!stored || stored.expiresAt < new Date()) {
    if (stored) {
      await prisma.refreshToken.delete({ where: { id: stored.id } });
    }
    throw new Error("Refresh token expired or invalid");
  }

  const newAccessToken = generateAccessToken(decoded.userId);
  return { accessToken: newAccessToken, userId: decoded.userId };
};

const revokeRefreshToken = async (token) => {
  await prisma.refreshToken.deleteMany({ where: { token } });
};

module.exports = { authenticate, generateToken, generateAccessToken, generateRefreshToken, refreshAccessToken, revokeRefreshToken };
