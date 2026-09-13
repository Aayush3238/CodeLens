PROGRESS_TRACKER_PROMPT = """You are an expert progress tracker analyzing a student's coding practice journey.

Student Profile:
- Name: {name}
- Total Solved: {total_solved}
- Active Days: {active_days}
- Current Streak: {current_streak}

Topic Strength Levels:
{topic_strength}

Weekly Progress (last 12 weeks):
{weekly_progress}

Monthly Progress (last 6 months):
{monthly_progress}

Recent Solved Problems:
{recent_problems}

Your task: Generate a comprehensive progress report.

Return report as JSON:
{{
  "overall_score": 0-100,
  "summary": "2-3 sentence overall summary",
  "highlights": ["highlight 1", "highlight 2"],
  "concerns": ["concern 1"],
  "topic_mastery": {{
    "mastered": ["topic1", "topic2"],
    "proficient": ["topic3"],
    "developing": ["topic4"],
    "beginner": ["topic5"]
  }},
  "streak_info": {{
    "current": {current_streak},
    "best": 0,
    "trend": "improving|stable|declining"
  }},
  "next_milestone": "What to aim for next",
  "encouragement": "Motivational message"
}}
"""

NOTIFICATION_PROMPT = """You are generating personalized notifications for a coding student.

Current Status:
- Solved: {total_solved} problems
- Streak: {current_streak} days
- Weakest topics: {weak_topics}
- Last active: {last_active}

Generate 2-3 timely, actionable notifications.

Return as JSON:
[
  {{
    "type": "reminder|challenge|milestone|warning",
    "title": "Short title",
    "message": "Detailed message",
    "priority": "low|medium|high"
  }}
]
"""
