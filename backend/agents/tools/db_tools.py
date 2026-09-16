import asyncpg
from typing import Optional
from config import get_settings

settings = get_settings()

_pool: Optional[asyncpg.Pool] = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(settings.DATABASE_URL, min_size=2, max_size=10)
    return _pool


async def close_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


async def get_user_profile(user_id: str) -> dict:
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT id, email, name, leetcode_username FROM users WHERE id = $1",
        user_id,
    )
    if row:
        return dict(row)
    return None


async def get_weak_topics(user_id: str) -> list[dict]:
    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT topic, strength_score, problem_count
        FROM weak_topics
        WHERE user_id = $1
        ORDER BY strength_score ASC
        """,
        user_id,
    )
    return [dict(r) for r in rows]


async def compute_weak_topics(user_id: str) -> list[dict]:
    pool = await get_pool()
    rows = await pool.fetch(
        """
        WITH topic_stats AS (
            SELECT
                p.topic,
                COUNT(up.id) as solved_count
            FROM problems p
            LEFT JOIN user_problems up ON p.id = up.problem_id AND up.user_id = $1
            GROUP BY p.topic
        ),
        max_counts AS (
            SELECT MAX(solved_count) as max_solved FROM topic_stats
        )
        SELECT
            ts.topic,
            CASE
                WHEN mc.max_solved = 0 THEN 0
                ELSE ROUND((ts.solved_count::float / mc.max_solved) * 100, 1)
            END as strength_score,
            ts.solved_count as problem_count
        FROM topic_stats ts, max_counts mc
        ORDER BY strength_score ASC
        """,
        user_id,
    )
    return [dict(r) for r in rows]


async def get_solved_problems(user_id: str) -> list[dict]:
    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT
            p.id as problem_id,
            p.title,
            p.title_slug,
            p.difficulty,
            p.topic,
            up.solved_at
        FROM user_problems up
        JOIN problems p ON up.problem_id = p.id
        WHERE up.user_id = $1
        ORDER BY up.solved_at DESC
        """,
        user_id,
    )
    return [dict(r) for r in rows]


async def get_all_problems(topic: str = None, difficulty: str = None) -> list[dict]:
    pool = await get_pool()
    query = "SELECT id, title, title_slug, difficulty, topic, acceptance FROM problems WHERE 1=1"
    params = []
    param_idx = 1

    if topic:
        query += f" AND topic = ${param_idx}"
        params.append(topic)
        param_idx += 1

    if difficulty:
        query += f" AND difficulty = ${param_idx}"
        params.append(difficulty)
        param_idx += 1

    query += " ORDER BY title"

    rows = await pool.fetch(query, *params)
    return [dict(r) for r in rows]


async def get_problem_by_slug(slug: str) -> dict:
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT id, title, title_slug, difficulty, topic, acceptance FROM problems WHERE title_slug = $1",
        slug,
    )
    return dict(row) if row else None


async def get_unsolved_problems(user_id: str, topic: str = None) -> list[dict]:
    pool = await get_pool()
    query = """
        SELECT p.id, p.title, p.title_slug, p.difficulty, p.topic, p.acceptance
        FROM problems p
        WHERE p.id NOT IN (
            SELECT problem_id FROM user_problems WHERE user_id = $1
        )
    """
    params = [user_id]
    param_idx = 2

    if topic:
        query += f" AND p.topic = ${param_idx}"
        params.append(topic)
        param_idx += 1

    query += " ORDER BY p.difficulty, p.title LIMIT 50"

    rows = await pool.fetch(query, *params)
    return [dict(r) for r in rows]


async def get_topic_problem_counts() -> dict:
    pool = await get_pool()
    rows = await pool.fetch(
        "SELECT topic, COUNT(*) as count FROM problems GROUP BY topic ORDER BY count DESC"
    )
    return {r["topic"]: r["count"] for r in rows}


async def get_weekly_progress(user_id: str) -> dict:
    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT
            DATE_TRUNC('week', up.solved_at) as week,
            COUNT(*) as solved_count
        FROM user_problems up
        WHERE up.user_id = $1
          AND up.solved_at > NOW() - INTERVAL '12 weeks'
        GROUP BY week
        ORDER BY week
        """,
        user_id,
    )
    return {str(r["week"].date()): r["solved_count"] for r in rows}


async def get_monthly_progress(user_id: str) -> dict:
    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT
            DATE_TRUNC('month', up.solved_at) as month,
            COUNT(*) as solved_count
        FROM user_problems up
        WHERE up.user_id = $1
          AND up.solved_at > NOW() - INTERVAL '6 months'
        GROUP BY month
        ORDER BY month
        """,
        user_id,
    )
    return {str(r["month"].date()): r["solved_count"] for r in rows}


async def get_difficulty_distribution(user_id: str) -> dict:
    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT p.difficulty, COUNT(*) as count
        FROM user_problems up
        JOIN problems p ON up.problem_id = p.id
        WHERE up.user_id = $1
        GROUP BY p.difficulty
        """,
        user_id,
    )
    return {r["difficulty"]: r["count"] for r in rows}


async def get_total_solved(user_id: str) -> int:
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT COUNT(*) as count FROM user_problems WHERE user_id = $1",
        user_id,
    )
    return row["count"] if row else 0


async def get_active_days(user_id: str) -> int:
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        SELECT COUNT(DISTINCT DATE(solved_at)) as count
        FROM user_problems
        WHERE user_id = $1
        """,
        user_id,
    )
    return row["count"] if row else 0


async def get_daily_activity(user_id: str, days: int = 30) -> list[dict]:
    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT
            DATE(solved_at) as date,
            COUNT(*) as problems_solved,
            ARRAY_AGG(p.difficulty) as difficulties
        FROM user_problems up
        JOIN problems p ON up.problem_id = p.id
        WHERE up.user_id = $1
          AND up.solved_at > NOW() - INTERVAL '1 day' * $2
        GROUP BY DATE(solved_at)
        ORDER BY date
        """,
        user_id,
        days,
    )
    return [dict(r) for r in rows]


async def get_user_stats(user_id: str) -> dict:
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        SELECT
            COUNT(*) as total_solved,
            COUNT(DISTINCT DATE(up.solved_at)) as active_days
        FROM user_problems up
        WHERE up.user_id = $1
        """,
        user_id,
    )
    return dict(row) if row else {"total_solved": 0, "active_days": 0}


async def create_revision_plan(user_id: str, plan_type: str, items: list[dict]) -> dict:
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            plan = await conn.fetchrow(
                """
                INSERT INTO revision_plans (user_id, type, start_date, created_at)
                VALUES ($1, $2, NOW(), NOW())
                RETURNING id, user_id, type, start_date, created_at
                """,
                user_id,
                plan_type,
            )

            plan_dict = dict(plan)

            for item in items:
                await conn.execute(
                    """
                    INSERT INTO revision_items
                    (revision_plan_id, day, topic, problems, estimated_time, completed, created_at)
                    VALUES ($1, $2, $3, $4, $5, false, NOW())
                    """,
                    plan_dict["id"],
                    item["day"],
                    item["topic"],
                    item["problems"],
                    item["estimated_time"],
                )

            return plan_dict
