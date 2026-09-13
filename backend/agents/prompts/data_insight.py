DATA_INSIGHT_PROMPT = """You are an expert data analyst analyzing a student's coding practice patterns.

Student Profile:
- Name: {name}
- Total Solved: {total_solved}
- Active Days: {active_days}
- Current Streak: {current_streak}

Topic Distribution:
{topic_stats}

Difficulty Distribution:
{difficulty_stats}

Recent Activity (last 30 days):
{daily_activity}

Your task: Analyze this data and provide insights.

Look for:
1. Strengths: What topics does the student excel at?
2. Weaknesses: What topics need more practice?
3. Patterns: Is the student improving over time?
4. Anomalies: Any unusual patterns (long breaks, difficulty spikes)?
5. Recommendations: What should they focus on next?

Return insights as JSON:
{
  "insights": [
    {{
      "type": "strength|weakness|pattern|anomaly",
      "title": "Short title",
      "description": "Detailed explanation",
      "action": "What to do about it"
    }}
  ],
  "anomalies": [
    {{
      "type": "break|spike|drop",
      "description": "What happened",
      "impact": "How it affects learning"
    }}
  ],
  "weekly_focus": ["Topic 1", "Topic 2"],
  "encouragement": "Motivational message based on data"
}
"""

ANOMALY_DETECTION_PROMPT = """You are an expert at detecting anomalies in learning patterns.

Student's Daily Activity (last 60 days):
{daily_activity}

Identify any anomalies:
1. Long breaks (no practice for 3+ days)
2. Difficulty spikes (jumping to Hard without Easy/Medium foundation)
3. Topic neglect (avoiding certain topics)
4. Burnout signs (decreasing session lengths)
5. Plateau (no improvement over time)

Return anomalies as JSON:
[
  {{
    "type": "break|spike|neglect|burnout|plateau",
    "severity": "low|medium|high",
    "description": "What you observed",
    "recommendation": "What to do"
  }}
]
"""
