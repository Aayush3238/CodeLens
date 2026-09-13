import json
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END

from state.schemas import ProgressTrackerState
from tools.db_tools import (
    get_user_profile,
    get_solved_problems,
    compute_weak_topics,
    get_weekly_progress,
    get_monthly_progress,
    get_user_stats,
)
from prompts.progress_tracker import PROGRESS_TRACKER_PROMPT, NOTIFICATION_PROMPT
from config import get_settings

settings = get_settings()

llm = ChatGoogleGenerativeAI(
    model=settings.GEMINI_MODEL,
    google_api_key=settings.GEMINI_API_KEY,
    temperature=0.7,
)


async def fetch_progress_data(state: ProgressTrackerState) -> ProgressTrackerState:
    """Fetch all data needed for progress tracking."""
    user_id = state["user_id"]

    profile = await get_user_profile(user_id)
    if not profile:
        return {**state, "error": "User not found"}

    solved = await get_solved_problems(user_id)
    weak_topics = await compute_weak_topics(user_id)
    weekly = await get_weekly_progress(user_id)
    monthly = await get_monthly_progress(user_id)
    stats = await get_user_stats(user_id)

    topic_strength = {t["topic"]: t["strength_score"] for t in weak_topics}

    mastery_levels = {}
    for topic, score in topic_strength.items():
        if score >= 80:
            mastery_levels[topic] = "mastered"
        elif score >= 60:
            mastery_levels[topic] = "proficient"
        elif score >= 40:
            mastery_levels[topic] = "developing"
        else:
            mastery_levels[topic] = "beginner"

    return {
        **state,
        "user_profile": profile,
        "solved_problems": solved,
        "topic_strength": topic_strength,
        "weekly_progress": weekly,
        "monthly_progress": monthly,
        "mastery_levels": mastery_levels,
    }


async def generate_report(state: ProgressTrackerState) -> ProgressTrackerState:
    """Use Gemini to generate a progress report."""
    if state.get("error"):
        return state

    profile = state.get("user_profile", {})
    solved = state.get("solved_problems", [])
    topic_str = "\n".join(
        [f"- {t}: {s}%" for t, s in list(state.get("topic_strength", {}).items())[:10]]
    )
    weekly_str = "\n".join(
        [f"- Week of {w}: {c} solved" for w, c in list(state.get("weekly_progress", {}).items())[-12:]]
    )
    monthly_str = "\n".join(
        [f"- {m}: {c} solved" for m, c in list(state.get("monthly_progress", {}).items())[-6:]]
    )
    recent = "\n".join(
        [f"- {p['title']} ({p['difficulty']})" for p in solved[:5]]
    ) or "No recent problems"

    prompt = PROGRESS_TRACKER_PROMPT.format(
        name=profile.get("name", "Student"),
        total_solved=len(solved),
        active_days=len(set(p.get("solved_at", "")[:10] for p in solved)),
        current_streak=0,
        topic_strength=topic_str or "No data",
        weekly_progress=weekly_str or "No data",
        monthly_progress=monthly_str or "No data",
        recent_problems=recent,
    )

    response = await llm.ainvoke([
        SystemMessage(content="You are an expert progress analyst. Return only valid JSON."),
        HumanMessage(content=prompt),
    ])

    try:
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]

        report = json.loads(content.strip())
        return {**state, "report": report}
    except (json.JSONDecodeError, KeyError) as e:
        return {**state, "error": f"Failed to parse report: {str(e)}"}


async def generate_notifications(state: ProgressTrackerState) -> ProgressTrackerState:
    """Generate personalized notifications."""
    if state.get("error"):
        return state

    profile = state.get("user_profile", {})
    weak = [t for t, s in state.get("topic_strength", {}).items() if s < 40][:3]

    prompt = NOTIFICATION_PROMPT.format(
        total_solved=len(state.get("solved_problems", [])),
        current_streak=0,
        weak_topics=", ".join(weak) or "None",
        last_active="Today",
    )

    response = await llm.ainvoke([
        SystemMessage(content="You are a helpful learning assistant. Return only valid JSON."),
        HumanMessage(content=prompt),
    ])

    try:
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]

        notifications = json.loads(content.strip())
        return {**state, "notifications": notifications}
    except (json.JSONDecodeError, KeyError):
        return {**state, "notifications": []}


def should_continue(state: ProgressTrackerState) -> str:
    if state.get("error"):
        return "end"
    return "continue"


def create_progress_tracker_graph() -> StateGraph:
    workflow = StateGraph(ProgressTrackerState)

    workflow.add_node("fetch_data", fetch_progress_data)
    workflow.add_node("report", generate_report)
    workflow.add_node("notifications", generate_notifications)

    workflow.set_entry_point("fetch_data")

    workflow.add_conditional_edges(
        "fetch_data",
        should_continue,
        {"continue": "report", "end": END},
    )

    workflow.add_conditional_edges(
        "report",
        should_continue,
        {"continue": "notifications", "end": END},
    )

    workflow.add_edge("notifications", END)

    return workflow.compile()


progress_tracker_graph = create_progress_tracker_graph()


async def run_progress_tracker_agent(user_id: str) -> dict:
    initial_state: ProgressTrackerState = {
        "user_id": user_id,
        "user_profile": None,
        "solved_problems": [],
        "topic_strength": {},
        "weekly_progress": {},
        "monthly_progress": {},
        "mastery_levels": {},
        "report": None,
        "notifications": [],
        "error": None,
    }

    result = await progress_tracker_graph.ainvoke(initial_state)

    return {
        "report": result.get("report"),
        "notifications": result.get("notifications", []),
        "mastery_levels": result.get("mastery_levels", {}),
        "error": result.get("error"),
    }
