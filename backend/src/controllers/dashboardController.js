const prisma = require("../config/db");
const { getCache, setCache } = require("../utils/cache");

const DASHBOARD_CACHE_TTL = 5 * 60;

const getDashboard = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const cacheKey = `dashboard:${userId}`;

    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

    const [difficultyCounts, topicCounts, totalSubmissions, recentProblems] = await Promise.all([
      prisma.$queryRaw`
        SELECT p.difficulty, COUNT(*)::int as count
        FROM user_problems up
        JOIN problems p ON up.problem_id = p.id
        WHERE up.user_id = ${userId}
        GROUP BY p.difficulty
      `,
      prisma.$queryRaw`
        SELECT p.topic, COUNT(*)::int as count
        FROM user_problems up
        JOIN problems p ON up.problem_id = p.id
        WHERE up.user_id = ${userId}
        GROUP BY p.topic
        ORDER BY count DESC
      `,
      prisma.submission.count({ where: { userId } }),
      prisma.userProblem.findMany({
        where: { userId },
        include: { problem: true },
        orderBy: { solvedAt: "desc" },
        take: 5,
      }),
    ]);

    const easy = difficultyCounts.find((d) => d.difficulty === "Easy")?.count || 0;
    const medium = difficultyCounts.find((d) => d.difficulty === "Medium")?.count || 0;
    const hard = difficultyCounts.find((d) => d.difficulty === "Hard")?.count || 0;
    const totalSolved = easy + medium + hard;

    const dailyActivity = await prisma.$queryRaw`
      SELECT DATE(submission_time) as date, COUNT(*)::int as count
      FROM submissions
      WHERE user_id = ${userId}
        AND submission_time > NOW() - INTERVAL '365 days'
      GROUP BY DATE(submission_time)
      ORDER BY date
    `;

    const result = {
      user: req.user,
      stats: {
        totalSolved,
        easy,
        medium,
        hard,
        totalSubmissions,
        acceptanceRate: totalSubmissions > 0 ? Math.round((totalSolved / totalSubmissions) * 100) : 0,
      },
      topicDistribution: topicCounts,
      dailyActivity: dailyActivity.map((d) => ({
        date: d.date instanceof Date ? d.date.toISOString().split("T")[0] : String(d.date),
        count: d.count,
      })),
      recentProblems: recentProblems.map((rp) => rp.problem),
    };

    await setCache(cacheKey, result, DASHBOARD_CACHE_TTL);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const getAnalytics = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const cacheKey = `analytics:${userId}`;

    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

    const [topicCounts, difficultyCounts, weeklyProgress, monthlyProgress, hourlyActivity] = await Promise.all([
      prisma.$queryRaw`
        SELECT p.topic, COUNT(*)::int as count
        FROM user_problems up
        JOIN problems p ON up.problem_id = p.id
        WHERE up.user_id = ${userId}
        GROUP BY p.topic
        ORDER BY count DESC
      `,
      prisma.$queryRaw`
        SELECT p.difficulty, COUNT(*)::int as count
        FROM user_problems up
        JOIN problems p ON up.problem_id = p.id
        WHERE up.user_id = ${userId}
        GROUP BY p.difficulty
      `,
      prisma.$queryRaw`
        SELECT
          CASE
            WHEN submission_time >= DATE_TRUNC('week', NOW()) THEN 'This Week'
            WHEN submission_time >= DATE_TRUNC('week', NOW() - INTERVAL '7 days') THEN 'Week -1'
            WHEN submission_time >= DATE_TRUNC('week', NOW() - INTERVAL '14 days') THEN 'Week -2'
            ELSE 'Week -3'
          END as week,
          COUNT(*)::int as solved
        FROM submissions
        WHERE user_id = ${userId}
          AND submission_time > NOW() - INTERVAL '28 days'
        GROUP BY week
        ORDER BY MIN(submission_time)
      `,
      prisma.$queryRaw`
        SELECT
          TO_CHAR(DATE_TRUNC('month', submission_time), 'Mon') as month,
          COUNT(*)::int as solved
        FROM submissions
        WHERE user_id = ${userId}
          AND submission_time > NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', submission_time)
        ORDER BY DATE_TRUNC('month', submission_time)
      `,
      prisma.$queryRaw`
        SELECT EXTRACT(HOUR FROM submission_time)::int as hour, COUNT(*)::int as count
        FROM submissions
        WHERE user_id = ${userId}
        GROUP BY hour
        ORDER BY hour
      `,
    ]);

    const easy = difficultyCounts.find((d) => d.difficulty === "Easy")?.count || 0;
    const medium = difficultyCounts.find((d) => d.difficulty === "Medium")?.count || 0;
    const hard = difficultyCounts.find((d) => d.difficulty === "Hard")?.count || 0;

    const hourMap = {};
    hourlyActivity.forEach((h) => { hourMap[h.hour] = h.count; });
    const submissionFrequency = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}:00`,
      count: hourMap[i] || 0,
    }));

    const result = {
      topicDistribution: topicCounts,
      difficultyDistribution: { easy, medium, hard },
      weeklyProgress: weeklyProgress.map((w) => ({ week: w.week, solved: w.solved })),
      monthlyProgress: monthlyProgress.map((m) => ({ month: m.month, solved: m.solved })),
      submissionFrequency,
    };

    await setCache(cacheKey, result, DASHBOARD_CACHE_TTL);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const getDifficultyProgress = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const days = Number(req.query.days) || 30;

    const dayMap = await prisma.$queryRaw`
      SELECT DATE(up.solved_at) as date,
        SUM(CASE WHEN p.difficulty = 'Easy' THEN 1 ELSE 0 END)::int as easy,
        SUM(CASE WHEN p.difficulty = 'Medium' THEN 1 ELSE 0 END)::int as medium,
        SUM(CASE WHEN p.difficulty = 'Hard' THEN 1 ELSE 0 END)::int as hard
      FROM user_problems up
      JOIN problems p ON up.problem_id = p.id
      WHERE up.user_id = ${userId}
        AND up.solved_at > NOW() - INTERVAL '1 day' * ${days + 1}
      GROUP BY DATE(up.solved_at)
    `;

    const dayMs = 24 * 60 * 60 * 1000;
    const now = new Date();
    const lookup = {};
    dayMap.forEach((d) => {
      const key = d.date instanceof Date ? d.date.toISOString().split("T")[0] : String(d.date);
      lookup[key] = { easy: d.easy, medium: d.medium, hard: d.hard };
    });

    const progress = [];
    let easyCount = 0, mediumCount = 0, hardCount = 0;

    for (let i = days; i >= 0; i--) {
      const date = new Date(now.getTime() - i * dayMs);
      const dayStr = date.toISOString().split("T")[0];
      const dayData = lookup[dayStr] || { easy: 0, medium: 0, hard: 0 };
      easyCount += dayData.easy;
      mediumCount += dayData.medium;
      hardCount += dayData.hard;
      progress.push({
        date: dayStr,
        easy: easyCount,
        medium: mediumCount,
        hard: hardCount,
        total: easyCount + mediumCount + hardCount,
      });
    }

    res.json({ progress });
  } catch (error) {
    next(error);
  }
};

const getWeakTopics = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const topics = await prisma.$queryRaw`
      SELECT
        p.topic,
        COUNT(*)::int as "problemCount"
      FROM user_problems up
      JOIN problems p ON up.problem_id = p.id
      WHERE up.user_id = ${userId}
      GROUP BY p.topic
    `;

    const maxCount = Math.max(...topics.map((t) => t.problemCount), 1);

    const enriched = topics
      .map((t) => ({
        topic: t.topic,
        strengthScore: Math.round((t.problemCount / maxCount) * 100),
        problemCount: t.problemCount,
      }))
      .sort((a, b) => a.strengthScore - b.strengthScore);

    const weakTopics = enriched.slice(0, 5);
    const strongTopics = enriched.slice(-5).reverse();
    const overallStrength = enriched.length > 0
      ? Math.round(enriched.reduce((acc, t) => acc + t.strengthScore, 0) / enriched.length)
      : 0;

    res.json({ weakTopics, strongTopics, overallStrength, topics: enriched });
  } catch (error) {
    next(error);
  }
};

module.exports = { getDashboard, getAnalytics, getWeakTopics, getDifficultyProgress };
