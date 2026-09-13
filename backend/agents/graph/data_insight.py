import json
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END

from state.schemas import DataInsightState
from tools.db_tools import (
    get_user_profile,
    get_solved_problems,
    compute_weak_topics,
)
from prompts.data_insight import DATA_INSIGHT_PROMPT, ANOMALY_DETECTION_PROMPT
from config import get_settings

settings = get_settings()

llm = ChatGoogleGenerativeAI(
    model=settings.GEMINI_MODEL,
    google_api_key=settings.GEMINI_API_KEY,
    temperature=0.7,
)


async def fetch_analytics_data(state: DataInsightState) -> DataInsightState:
    """Fetch all analytics data for the user."""
    if state.get("error"):
        return state

    profile = await get_user_profile(state["user_id"])
    solved = await get_solved_problems(state["user_id"])
    weak_topics = await compute_weak_topics(state["user_id"])

    topic_stats = {}
    difficulty_stats = {"Easy": 0, "Medium": 0, "Hard": 0}
    daily_activity = {}

    for p in solved:
        topic = p.get("topic", "Unknown")
        topic_stats[topic] = topic_stats.get(topic, 0) + 1

        diff = p.get("difficulty", "Medium")
        if diff in difficulty_stats:
            difficulty_stats[diff] += 1

        day = p.get("solved_at", "")[:10]
        if day:
            daily_activity[day] = daily_activity.get(day, 0) + 1

    activity_list = [{"date": k, "count": v} for k, v in sorted(daily_activity.items())]

    return {
        **state,
        "user_profile": profile,
        "solved_problems": solved,
        "topic_stats": topic_stats,
        "difficulty_stats": difficulty_stats,
        "daily_activity": activity_list,
        "weak_topics": weak_topics,
    }


async def analyze_patterns(state: DataInsightState) -> DataInsightState:
    """Use Gemini to analyze patterns and generate insights."""
    if state.get("error"):
        return state

    profile = state.get("user_profile", {})
    topic_stats = state.get("topic_stats", {})
    difficulty_stats = state.get("difficulty_stats", {})
    activity = state.get("daily_activity", [])

    topic_text = "\n".join([f"- {k}: {v}" for k, v in topic_stats.items()])
    activity_text = "\n".join([f"- {a['date']}: {a['count']} problems" for a in activity[-30:]])

    streak = 0
    for a in reversed(activity):
        if a["count"] > 0:
            streak += 1
        else:
            break

    prompt = DATA_INSIGHT_PROMPT.format(
        name=profile.get("name", "Student"),
        total_solved=len(state.get("solved_problems", [])),
        active_days=len(activity),
        current_streak=streak,
        topic_stats=topic_text or "No data",
        difficulty_stats=json.dumps(difficulty_stats),
        daily_activity=activity_text or "No activity",
    )

    response = await llm.ainvoke([
        SystemMessage(content="You are an expert data analyst. Return only valid JSON."),
        HumanMessage(content=prompt),
    ])

    try:
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]

        result = json.loads(content.strip())
        return {
            **state,
            "insights": result.get("insights", []),
            "anomalies": result.get("anomalies", []),
            "recommendations": result.get("weekly_focus", []),
        }
    except (json.JSONDecodeError, KeyError):
        return {**state, "insights": [], "anomalies": [], "recommendations": []}


def should_continue(state: DataInsightState) -> str:
    if state.get("error"):
        return "end"
    return "continue"


def create_data_insight_graph() -> StateGraph:
    workflow = StateGraph(DataInsightState)

    workflow.add_node("fetch_data", fetch_analytics_data)
    workflow.add_node("analyze", analyze_patterns)

    workflow.set_entry_point("fetch_data")

    workflow.add_conditional_edges(
        "fetch_data",
        should_continue,
        {"continue": "analyze", "end": END},
    )

    workflow.add_edge("analyze", END)

    return workflow.compile()


data_insight_graph = create_data_insight_graph()


async def run_data_insight_agent(user_id: str, insight_type: str = "general") -> dict:
    initial_state: DataInsightState = {
        "user_id": user_id,
        "insight_type": insight_type,
        "user_profile": None,
        "submission_stats": {},
        "topic_stats": {},
        "daily_activity": [],
        "streak_data": {},
        "insights": [],
        "anomalies": [],
        "recommendations": [],
        "error": None,
    }

    result = await data_insight_graph.ainvoke(initial_state)

    return {
        "insights": result.get("insights", []),
        "anomalies": result.get("anomalies", []),
        "recommendations": result.get("recommendations", []),
        "error": result.get("error"),
    }
