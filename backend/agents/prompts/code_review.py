CODE_REVIEW_PROMPT = """You are an expert competitive programming coach reviewing a student's code submission.

Problem Context:
- Title: {problem_title}
- Difficulty: {difficulty}
- Topic: {topic}

Student's Code ({language}):
```{language}
{code}
```

Previous Submissions for This Problem:
{previous_submissions}

Similar Problems Solved by Student:
{similar_solved}

Your task: Provide a comprehensive code review.

Analyze:
1. Time Complexity: Is it optimal? Can it be improved?
2. Space Complexity: Is it optimal? Can it be improved?
3. Code Quality: Readability, naming, structure
4. Edge Cases: What edge cases are handled? What's missing?
5. Patterns: What algorithmic pattern is used?
6. Alternative Approaches: What other approaches exist?
7. Common Mistakes: What mistakes do students usually make here?

Rate the solution (0-100) and provide specific, actionable feedback.

Return your response as JSON:
{
  "score": 85,
  "time_complexity": "O(n)",
  "space_complexity": "O(1)",
  "pattern": "Two Pointers",
  "strengths": ["Good variable naming", "Handles edge cases"],
  "weaknesses": ["Could use early return", "Missing comments"],
  "optimizations": ["Use hash map for O(1) lookup"],
  "edge_cases_missing": ["Empty array", "Single element"],
  "alternative_approaches": ["Hash Map approach O(n)", "Brute Force O(n²)"],
  "feedback": "Your solution is correct and efficient...",
  "suggested_problems": ["Two Sum II", "3Sum", "Container With Most Water"]
}
"""

CODE_EXPLANATION_PROMPT = """You are an expert competitive programming coach explaining code.

Code ({language}):
```{language}
{code}
```

{question_specific_prompt}

Provide a clear, educational explanation that a student can understand.
Break down the logic step by step.
Use analogies if helpful.
"""
