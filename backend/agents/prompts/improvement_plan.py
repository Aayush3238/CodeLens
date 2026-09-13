IMPROVEMENT_PLAN_PROMPT = """You are an expert career coach creating a targeted improvement plan for a coding student.

Student Profile:
- Name: {name}
- Total Solved: {total_solved}
- Active Days: {active_days}

Target Role: {target_role}

Current Difficulty Distribution:
{difficulty_analysis}

Topic Analysis:
{topic_analysis}

Comparison with Role Requirements:
{comparison}

Your task: Create a detailed improvement plan.

Return plan as JSON:
{{
  "gap_summary": "Overall assessment of gaps",
  "priority_areas": [
    {{
      "area": "Topic or skill area",
      "current_level": "beginner|intermediate|advanced",
      "target_level": "intermediate|advanced|expert",
      "importance": "high|medium|low",
      "effort_needed": "low|medium|high"
    }}
  ],
  "weekly_schedule": {{
    "focus_topics": ["topic1", "topic2"],
    "target_problems_per_week": 0,
    "difficulty_split": {{
      "easy": 0,
      "medium": 0,
      "hard": 0
    }}
  }},
  "learning_resources": [
    {{
      "topic": "topic name",
      "resource_type": "concept|practice|project",
      "description": "What to study or practice"
    }}
  ],
  "milestones": [
    {{
      "week": 1,
      "goal": "Specific goal",
      "metrics": "How to measure success"
    }}
  ],
  "timeline_weeks": 12,
  "estimated_hours_per_week": 0
}}
"""

DAILY_TARGET_PROMPT = """Based on the improvement plan below, generate specific daily targets for the next 7 days.

Improvement Plan:
{plan}

Student's Available Time:
- Weekdays: {weekday_hours} hours/day
- Weekends: {weekend_hours} hours/day

Return daily targets as JSON:
[
  {{
    "day": "Monday",
    "date": "YYYY-MM-DD",
    "topics": ["topic1"],
    "problems": [
      {{
        "title": "Problem Title",
        "difficulty": "Easy|Medium|Hard",
        "estimated_minutes": 30
      }}
    ],
    "total_minutes": 60,
    "focus": "What to focus on today"
  }}
]
"""

WEEKLY_MILESTONE_PROMPT = """Based on the improvement plan, generate weekly milestones for the next 4 weeks.

Improvement Plan:
{plan}

Current Level:
- Solved: {total_solved}
- Weak topics: {weak_topics}

Return milestones as JSON:
[
  {{
    "week": 1,
    "theme": "What this week focuses on",
    "goals": ["goal1", "goal2"],
    "target_problems": 0,
    "target_topics": ["topic1"],
    "success_criteria": "How to know you succeeded"
  }}
]
"""
