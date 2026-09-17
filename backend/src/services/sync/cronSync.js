const cron = require("node-cron");
const prisma = require("../../config/db");
const realLeetcode = require("../leetcode/realLeetcode");
const logger = require("../../utils/logger");

const SYNC_COOLDOWN_MS = 60 * 60 * 1000;

async function syncUser(user) {
  try {
    logger.info(`[AutoSync] Syncing LeetCode for user ${user.id} (${user.leetcodeUsername})`);
    await realLeetcode.syncToDatabase(user.id, user.leetcodeUsername);
    await prisma.user.update({
      where: { id: user.id },
      data: { lastSyncedAt: new Date() },
    });
    logger.info(`[AutoSync] Completed sync for user ${user.id}`);
  } catch (error) {
    logger.error(`[AutoSync] Failed to sync user ${user.id}: ${error.message}`);
  }
}

async function runAutoSync() {
  try {
    const cutoff = new Date(Date.now() - SYNC_COOLDOWN_MS);
    const users = await prisma.user.findMany({
      where: {
        leetcodeUsername: { not: null },
        OR: [
          { lastSyncedAt: null },
          { lastSyncedAt: { lt: cutoff } },
        ],
      },
      select: { id: true, leetcodeUsername: true },
    });

    if (users.length === 0) {
      logger.info("[AutoSync] No users need syncing");
      return;
    }

    logger.info(`[AutoSync] Found ${users.length} users to sync`);

    const CONCURRENCY = 5;
    for (let i = 0; i < users.length; i += CONCURRENCY) {
      const batch = users.slice(i, i + CONCURRENCY);
      await Promise.allSettled(batch.map((user) => syncUser(user)));
      if (i + CONCURRENCY < users.length) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  } catch (error) {
    logger.error(`[AutoSync] Error: ${error.message}`);
  }
}

function startCronSync() {
  cron.schedule("0 */6 * * *", runAutoSync);
  logger.info("[AutoSync] Cron scheduled: every 6 hours");
}

module.exports = { startCronSync, runAutoSync };
