const realLeetcode = require("../services/leetcode/realLeetcode");
const prisma = require("../config/db");
const { createNotification } = require("./notificationController");
const { logAudit } = require("../utils/audit");
const { invalidateUserCache } = require("../utils/cache");

const getProfile = async (req, res, next) => {
  try {
    const { username } = req.params;
    const profile = await realLeetcode.getProfile(username);

    if (!profile) {
      return res.status(404).json({ message: "LeetCode user not found" });
    }

    res.json({ profile });
  } catch (error) {
    next(error);
  }
};

const getStatus = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { leetcodeUsername: true, lastSyncedAt: true },
    });

    res.json({
      connected: !!user.leetcodeUsername,
      username: user.leetcodeUsername,
      lastSyncedAt: user.lastSyncedAt,
    });
  } catch (error) {
    next(error);
  }
};

const connect = async (req, res, next) => {
  try {
    const { username } = req.body;

    if (!username || typeof username !== "string") {
      return res.status(400).json({ message: "LeetCode username is required" });
    }

    const trimmed = username.trim();
    if (trimmed.length < 1 || trimmed.length > 50) {
      return res.status(400).json({ message: "Invalid username length" });
    }

    const existing = await prisma.user.findFirst({
      where: { leetcodeUsername: trimmed, NOT: { id: req.user.id } },
    });
    if (existing) {
      return res.status(409).json({ message: "This LeetCode account is already linked to another user" });
    }

    const profile = await realLeetcode.getProfile(trimmed);
    if (!profile) {
      return res.status(404).json({ message: "LeetCode user not found. Check the username and try again." });
    }

    const result = await realLeetcode.syncToDatabase(req.user.id, trimmed);

    await prisma.user.update({
      where: { id: req.user.id },
      data: { lastSyncedAt: new Date() },
    });

    await invalidateUserCache(req.user.id);
    await logAudit(req.user.id, "LEETCODE_CONNECTED", `Connected as ${trimmed}`, req.ip);

    res.json({
      message: "LeetCode account connected and synced",
      profile: result.profile,
      syncedCount: result.syncedCount,
    });
  } catch (error) {
    next(error);
  }
};

const sync = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { leetcodeUsername: true },
    });

    if (!user.leetcodeUsername) {
      return res.status(400).json({ message: "No LeetCode account connected. Connect one first." });
    }

    const result = await realLeetcode.syncToDatabase(req.user.id, user.leetcodeUsername);

    await prisma.user.update({
      where: { id: req.user.id },
      data: { lastSyncedAt: new Date() },
    });

    await invalidateUserCache(req.user.id);

    const scopeLabel = result.source === "full" ? "full history" : "recent activity";
    await createNotification(
      req.user.id,
      "sync",
      "LeetCode Sync Complete",
      `Synced ${result.syncedCount} new problems (${scopeLabel}). LeetCode shows ${result.totalSolvedOnLeetcode} solved in total.`
    );

    res.json({
      message: "LeetCode data synced",
      profile: result.profile,
      syncedCount: result.syncedCount,
      source: result.source,
      totalSolvedOnLeetcode: result.totalSolvedOnLeetcode,
    });
  } catch (error) {
    next(error);
  }
};

const disconnect = async (req, res, next) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { leetcodeUsername: null, leetcodeSession: null },
    });

    await logAudit(req.user.id, "LEETCODE_DISCONNECTED", "LeetCode account disconnected", req.ip);

    res.json({ message: "LeetCode account disconnected" });
  } catch (error) {
    next(error);
  }
};

const saveSession = async (req, res, next) => {
  try {
    const { session } = req.body;
    if (!session || typeof session !== "string") {
      return res.status(400).json({ message: "Session cookie is required" });
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: { leetcodeSession: session.trim() },
    });

    await logAudit(req.user.id, "LEETCODE_SESSION_SAVED", "Deep sync session cookie updated", req.ip);

    res.json({ message: "LeetCode session saved. Deep sync enabled." });
  } catch (error) {
    next(error);
  }
};

const getSessionStatus = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { leetcodeSession: true },
    });

    res.json({ hasSession: !!user.leetcodeSession });
  } catch (error) {
    next(error);
  }
};

module.exports = { getProfile, getStatus, connect, sync, disconnect, saveSession, getSessionStatus };
