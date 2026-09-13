const Redis = require("ioredis");

let redis;

if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL, { // redis connection
    maxRetriesPerRequest: 3, //try 3 times before failing
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

  redis.on("error", (err) => {
    console.error("Redis connection error:", err.message);
  });

  redis.on("connect", () => {
    console.log("Redis connected");
  });
} else {
  redis = {
    get: async () => null,
    set: async () => {},
    del: async () => {},
    expire: async () => {},
  };
}

module.exports = redis;
