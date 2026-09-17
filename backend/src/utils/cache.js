let redis;
try {
  redis = require("../config/redis");
} catch {
  redis = null;
}

async function getCache(key) {
  if (!redis) return null;
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

async function setCache(key, value, ttlSeconds = 300) {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // silently fail
  }
}

async function invalidateCache(pattern) {
  if (!redis) return;
  try {
    let cursor = "0";
    const keysToDelete = [];

    do {
      const [newCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = newCursor;
      keysToDelete.push(...keys);
    } while (cursor !== "0");

    if (keysToDelete.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < keysToDelete.length; i += batchSize) {
        const batch = keysToDelete.slice(i, i + batchSize);
        await redis.del(...batch);
      }
    }
  } catch (error) {
    console.error("[Cache Invalidation Error]", error.message);
  }
}

async function invalidateUserCache(userId) {
  await invalidateCache(`user:${userId}:*`);
  await invalidateCache(`submissions:${userId}:*`);
  await invalidateCache(`dashboard:${userId}:*`);
}

async function invalidateProblemCache() {
  await invalidateCache(`problems:*`);
  await invalidateCache(`topics:*`);
}

module.exports = { invalidateCache, invalidateUserCache, invalidateProblemCache };
