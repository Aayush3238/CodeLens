const prisma = require("../../config/db");
const { mapTagToTopic } = require("../../utils/topicMapper");
let redis;
try {
  redis = require("../../config/redis");
} catch {
  redis = null;
}

const LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql";
const CACHE_TTL = 600;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

const HEADERS = {
  "Content-Type": "application/json",
  "Referer": "https://leetcode.com",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
};

async function getCached(key) {
  if (!redis) return null;
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

async function setCache(key, data, ttl = CACHE_TTL) {
  if (!redis) return;
  try {
    await redis.setex(key, ttl, JSON.stringify(data));
  } catch {}
}

async function graphqlQuery(query, variables = {}, sessionCookie = null) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const headers = { ...HEADERS };
      if (sessionCookie) {
        headers["Cookie"] = `LEETCODE_SESSION=${sessionCookie}`;
      }

      const res = await fetch(LEETCODE_GRAPHQL_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({ query, variables }),
      });

      if (res.status === 429) {
        const delay = RETRY_DELAY_MS * attempt * 2;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      if (!res.ok) {
        throw new Error(`LeetCode API error: ${res.status}`);
      }

      const json = await res.json();
      if (json.errors) {
        throw new Error(json.errors[0]?.message || "LeetCode GraphQL error");
      }
      return json.data;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
      }
    }
  }
  throw lastError;
}

async function fetchUserProfile(username, sessionCookie = null) {
  const cacheKey = `lc:profile:${username}`;
  const cached = await getCached(cacheKey);
  if (cached) return cached;

  const query = `
    query userPublicProfile($username: String!) {
      matchedUser(username: $username) {
        username
        profile {
          realName
          userAvatar
          aboutMe
        }
        submitStats {
          acSubmissionNum {
            difficulty
            count
            submissions
          }
        }
      }
    }
  `;

  const data = await graphqlQuery(query, { username }, sessionCookie);
  const result = data?.matchedUser;
  if (result) await setCache(cacheKey, result, 300);
  return result;
}

async function fetchUserSolvedProblems(username) {
  const cacheKey = `lc:solved:${username}`;
  const cached = await getCached(cacheKey);
  if (cached) return cached;

  const query = `
    query userSolvedProblems($username: String!) {
      allQuestionsCount {
        difficulty
        count
      }
      matchedUser(username: $username) {
        problemsSolvedBeatsStats {
          difficulty
          percentage
        }
        submitStats {
          acSubmissionNum {
            difficulty
            count
            submissions
          }
        }
      }
    }
  `;

  const data = await graphqlQuery(query, { username });
  if (data) await setCache(cacheKey, data, 300);
  return data;
}

async function fetchRecentSubmissions(username, limit = 20, sessionCookie = null) {
  const cacheKey = `lc:recent:${username}:${limit}`;
  const cached = await getCached(cacheKey);
  if (cached) return cached;

  const query = `
    query recentSubmissions($username: String!, $limit: Int!) {
      recentAcSubmissionList(username: $username, limit: $limit) {
        id
        title
        titleSlug
        timestamp
        lang
      }
    }
  `;

  const data = await graphqlQuery(query, { username, limit }, sessionCookie);
  const result = data?.recentAcSubmissionList || [];
  if (result.length > 0) await setCache(cacheKey, result, 120);
  return result;
}

async function fetchAllSolvedWithSession(sessionCookie) {
  const cacheKey = `lc:all-solved:${hashCookie(sessionCookie)}`;
  const cached = await getCached(cacheKey);
  if (cached) return cached;

  const res = await fetch("https://leetcode.com/api/problems/all/", {
    headers: {
      "User-Agent": HEADERS["User-Agent"],
      "Referer": "https://leetcode.com",
      "Cookie": `LEETCODE_SESSION=${sessionCookie}`,
    },
  });
  if (!res.ok) throw new Error(`LeetCode API error: ${res.status}`);
  const json = await res.json();
  const solved = (json.stat_status_pairs || [])
    .filter((p) => p.status === "ac")
    .map((p) => ({
      titleSlug: p.stat.question__title_slug,
      title: p.stat.question__title,
      leetcodeId: p.stat.question__id,
      difficulty: p.difficulty === 1 ? "Easy" : p.difficulty === 2 ? "Medium" : "Hard",
      tags: (p.topic_tags || []),
    }));
  if (solved.length > 0) await setCache(cacheKey, solved, 600);
  return solved;
}

function hashCookie(cookie) {
  return require("crypto").createHash("sha1").update(cookie).digest("hex").slice(0, 16);
}

async function fetchProblemDetails(titleSlug) {
  const cacheKey = `lc:problem:${titleSlug}`;
  const cached = await getCached(cacheKey);
  if (cached) return cached;

  const query = `
    query questionData($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        questionId
        title
        titleSlug
        difficulty
        topicTags {
          name
        }
        stats
        acRate
      }
    }
  `;

  const data = await graphqlQuery(query, { titleSlug });
  const result = data?.question;
  if (result) await setCache(cacheKey, result, 86400);
  return result;
}

class LeetCodeService {
  async getProfile(username, sessionCookie = null) {
    const user = await fetchUserProfile(username, sessionCookie);
    if (!user) return null;

    const stats = user.submitStats?.acSubmissionNum || [];
    const findCount = (diff) => stats.find((s) => s.difficulty === diff)?.count || 0;

    return {
      username: user.username,
      name: user.profile?.realName,
      avatar: user.profile?.userAvatar,
      about: user.profile?.aboutMe,
      totalSolved: findCount("All"),
      easy: findCount("Easy"),
      medium: findCount("Medium"),
      hard: findCount("Hard"),
    };
  }

  async getSolvedProblems(username) {
    const data = await fetchUserSolvedProblems(username);
    if (!data) return null;

    const stats = data.matchedUser?.submitStats?.acSubmissionNum || [];
    const findCount = (diff) => stats.find((s) => s.difficulty === diff)?.count || 0;
    const total = data.allQuestionsCount || [];

    return {
      totalQuestions: total.find((q) => q.difficulty === "All")?.count || 0,
      totalSolved: findCount("All"),
      easy: findCount("Easy"),
      medium: findCount("Medium"),
      hard: findCount("Hard"),
      beatsStats: data.matchedUser?.problemsSolvedBeatsStats || [],
    };
  }

  async getRecentSubmissions(username, limit = 20, sessionCookie = null) {
    return fetchRecentSubmissions(username, limit, sessionCookie);
  }

  async syncToDatabase(userId, username) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { leetcodeSession: true } });
    const sessionCookie = user?.leetcodeSession || null;

    const profile = await this.getProfile(username, sessionCookie);
    if (!profile) throw new Error("LeetCode user not found");

    let solvedList = [];
    let source = "recent";
    if (sessionCookie) {
      try {
        solvedList = await fetchAllSolvedWithSession(sessionCookie);
        source = "full";
      } catch {
        solvedList = [];
      }
    }
    if (solvedList.length === 0) {
      const recentSubs = await this.getRecentSubmissions(username, 50, sessionCookie);
      solvedList = recentSubs.map((s) => ({ titleSlug: s.titleSlug, title: s.title, tags: [], difficulty: null, lang: s.lang, timestamp: s.timestamp, id: s.id }));
    }

    let syncedCount = 0;
    for (const item of solvedList) {
      let problem = await prisma.problem.findUnique({
        where: { titleSlug: item.titleSlug },
      });

      if (!problem) {
        let tags = item.tags || [];
        let difficulty = item.difficulty;
        if (tags.length === 0 || !difficulty) {
          try {
            const details = await fetchProblemDetails(item.titleSlug);
            tags = details?.topicTags?.map((t) => t.name) || tags;
            difficulty = details?.difficulty || difficulty || "Medium";
          } catch {}
        }
        const topic = mapTagToTopic(tags);

        problem = await prisma.problem.upsert({
          where: { titleSlug: item.titleSlug },
          update: {},
          create: {
            leetcodeId: item.leetcodeId || parseInt(item.id || "0") || 0,
            title: item.title,
            titleSlug: item.titleSlug,
            difficulty: difficulty || "Medium",
            topic,
            tags,
          },
        });
      }

      if (item.id) {
        const subId = String(item.id);
        const existingSub = await prisma.submission.findUnique({
          where: { leetcodeSubmissionId: subId },
        });
        if (!existingSub) {
          await prisma.submission.create({
            data: {
              userId,
              problemId: problem.id,
              code: `leetcode-sync-${subId}`,
              language: item.lang || "unknown",
              status: "Accepted",
              leetcodeSubmissionId: subId,
              submissionTime: item.timestamp ? new Date(parseInt(item.timestamp) * 1000) : new Date(),
            },
          });
        }
      }

      const existingUP = await prisma.userProblem.findUnique({
        where: { userId_problemId: { userId, problemId: problem.id } },
      });

      if (!existingUP) {
        await prisma.userProblem.create({
          data: { userId, problemId: problem.id },
        });
        syncedCount++;
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: { leetcodeUsername: username },
    });

    return {
      profile,
      syncedCount,
      source,
      totalSolvedOnLeetcode: profile.totalSolved,
      problems: solvedList.map((s) => s.titleSlug),
    };
  }
}

module.exports = new LeetCodeService();
