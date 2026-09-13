from typing import TypedDict, Optional, Literal
from pydantic import BaseModel


class UserProfile(BaseModel):
    id: str
    email: str
    name: str
    leetcode_username: Optional[str] = None


class WeakTopic(BaseModel):
    topic: str
    strength_score: float
    problem_count: int


class SolvedProblem(BaseModel):
    problem_id: str
    title: str
    title_slug: str
    difficulty: str
    topic: str
    solved_at: str


class RevisionPlanInput(BaseModel):
    user_id: str
    plan_type: Literal["7day", "30day", "60day"]
    custom_topics: list[str] | None = None


class RevisionDay(BaseModel):
    day: int
    date: str
    topic: str
    problems: list[dict]
    estimated_time: int
    focus_area: str


class LearningPathState(TypedDict):
    user_id: str
    plan_type: str
    user_profile: Optional[UserProfile]
    weak_topics: list[WeakTopic]
    solved_problems: list[SolvedProblem]
    all_problems: list[dict]
    topic_distribution: dict[str, int]
    analysis: str
    plan: list[RevisionDay]
    recommendations: list[dict]
    error: Optional[str]


class CodeReviewState(TypedDict):
    user_id: str
    code: str
    language: str
    problem_slug: str
    problem: Optional[dict]
    user_history: list[dict]
    similar_solved: list[dict]
    previous_submissions: Optional[str]
    review: Optional[dict]
    error: Optional[str]


class StudySessionState(TypedDict):
    user_id: str
    conversation_id: str
    user_message: str
    user_profile: Optional[dict]
    current_problem: Optional[dict]
    weak_topics: list[dict]
    conversation_history: list[dict]
    ai_response: str
    hints: list[str]
    quiz_questions: list[dict]
    error: Optional[str]


class DataInsightState(TypedDict):
    user_id: str
    insight_type: str
    user_profile: Optional[dict]
    submission_stats: dict
    topic_stats: dict
    daily_activity: list[dict]
    streak_data: dict
    insights: list[dict]
    anomalies: list[dict]
    recommendations: list[dict]
    error: Optional[str]


class ProgressTrackerState(TypedDict):
    user_id: str
    user_profile: Optional[dict]
    solved_problems: list[dict]
    topic_strength: dict[str, float]
    weekly_progress: dict
    monthly_progress: dict
    mastery_levels: dict[str, str]
    report: Optional[dict]
    notifications: list[dict]
    error: Optional[str]


class ImprovementPlanState(TypedDict):
    user_id: str
    target_role: Optional[str]
    user_profile: Optional[dict]
    leetcode_stats: dict
    topic_analysis: dict
    difficulty_analysis: dict
    comparison_with_target: dict
    gaps_identified: list[dict]
    improvement_plan: Optional[dict]
    daily_targets: list[dict]
    weekly_milestones: list[dict]
    error: Optional[str]
