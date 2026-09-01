ANALYSIS_PROMPT = """You are an expert competitive programming coach analyzing a student's learning progress.

Student Profile:
- Name: {name}
- Total Problems Solved: {total_solved}

Topic Strength Scores (0-100, lower = weaker):
{weak_topics_table}

Recent Submissions (last 10):
{recent_submissions}

Your task: Analyze this student's weak areas and learning patterns.

Consider:
1. Which topics need the most attention?
2. What's the student's current level (beginner/intermediate/advanced)?
3. Are there any patterns in their solving approach?
4. What difficulty levels should they focus on?

Provide a concise analysis (3-5 sentences) of their current state and what they should focus on.
"""

PLAN_PROMPT = """You are an expert competitive programming coach creating a personalized study plan.

Student Analysis:
{analysis}

Weak Topics (need most work):
{weak_topics_table}

Available Unsolved Problems by Topic:
{available_problems}

Plan Type: {plan_type} ({total_days} days)

Create a detailed {plan_type} study plan. For each day, specify:
1. The topic to focus on
2. Specific problems to solve (mix of difficulties: 40% Easy, 40% Medium, 20% Hard)
3. Estimated time in minutes
4. Focus area explanation

Rules:
- Start with weakest topics, gradually move to stronger ones
- Include review days every 7 days
- Vary difficulty within each day
- Be realistic about daily time commitment (60-120 minutes)
- Each problem should be from the available unsolved problems list

Return your plan as a JSON array with this exact format:
[
  {{
    "day": 1,
    "topic": "Dynamic Programming",
    "problems": [{{"id": "...", "title": "...", "difficulty": "Easy"}}],
    "estimated_time": 90,
    "focus_area": "Introduction to 1D DP patterns"
  }}
]
"""

RECOMMENDATION_PROMPT = """You are an expert competitive programming coach giving targeted recommendations.

Student's Weakest Topics:
{weak_topics}

Student's Strongest Topics:
{strong_topics}

Recent Activity:
{recent_activity}

Provide 3-5 specific, actionable recommendations to improve their algorithm skills.
Each recommendation should be:
1. Specific (not generic advice)
2. Actionable (what to do today)
3. Measurable (how to track progress)

Format as a JSON array:
[
  {{"recommendation": "...", "topic": "...", "priority": "high/medium/low"}}
]
"""
