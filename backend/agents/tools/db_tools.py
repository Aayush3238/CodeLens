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
