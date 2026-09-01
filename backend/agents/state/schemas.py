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
