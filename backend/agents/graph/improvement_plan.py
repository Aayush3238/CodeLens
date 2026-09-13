import json
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END

from state.schemas import ImprovementPlanState
from tools.db_tools import (
    get_user_profile,
    get_solved_problems,
    compute_weak_topics,
    get_difficulty_distribution,
    get_user_stats,
)
from prompts.improvement_plan import (
    IMPROVEMENT_PLAN_PROMPT,
    DAILY_TARGET_PROMPT,
    WEEKLY_MILESTONE_PROMPT,
)
from config import get_settings

settings = get_settings()

llm = ChatGoogleGenerativeAI(
    model=settings.GEMINI_MODEL,
    google_api_key=settings.GEMINI_API_KEY,
    temperature=0.7,
)


async def fetch_improvement_data(state: ImprovementPlanState) -> ImprovementPlanState:
    """Fetch data needed for improvement plan."""
    user_id = state["user_id"]

    profile = await get_user_profile(user_id)
    if not profile:
        return {**state, "error": "User not found"}

    solved = await get_solved_problems(user_id)
    weak_topics = await compute_weak_topics(user_id)
    difficulty = await get_difficulty_distribution(user_id)
    stats = await get_user_stats(user_id)

    topic_analysis = {t["topic"]: t["strength_score"] for t in weak_topics}

    target_role = state.get("target_role", "Full-Stack Developer")
    role_requirements = {
        "Full-Stack Developer": {"Arrays": 70, "Strings": 70, "Trees": 60, "Dynamic Programming": 50, "Graphs": 40},
        "Backend Developer": {"Arrays": 60, "Trees": 70, "Graphs": 60, "Dynamic Programming": 60, "System Design": 80},
        "Frontend Developer": {"Arrays": 60, "Strings": 60, "Trees": 50, "Dynamic Programming": 40, "Recursion": 50},
        "ML Engineer": {"Arrays": 70, "Math": 80, "Dynamic Programming": 70, "Trees": 60, "Graphs": 50},
    }

    requirements = role_requirements.get(target_role, role_requirements["Full-Stack Developer"])
    comparison = {}
    for topic, req_score in requirements.items():
        current = topic_analysis.get(topic, 0)
        comparison[topic] = {"current": current, "required": req_score, "gap": max(0, req_score - current)}

    return {
        **state,
        "user_profile": profile,
        "leetcode_stats": stats,
        "topic_analysis": topic_analysis,
        "difficulty_analysis": difficulty,
        "comparison_with_target": comparison,
    }


async def generate_plan(state: ImprovementPlanState) -> ImprovementPlanState:
    """Generate the improvement plan using Gemini."""
    if state.get("error"):
        return state

    profile = state.get("user_profile", {})
    target = state.get("target_role", "Full-Stack Developer")

    topic_str = "\n".join(
        [f"- {t}: {s}%" for t, s in list(state.get("topic_analysis", {}).items())[:10]]
    )
    difficulty_str = "\n".join(
        [f"- {d}: {c}" for d, c in state.get("difficulty_analysis", {}).items()]
    )
    comparison_str = "\n".join(
        [f"- {t}: current={d['current']}%, required={d['required']}%, gap={d['gap']}%"
         for t, d in state.get("comparison_with_target", {}).items()]
    )

    prompt = IMPROVEMENT_PLAN_PROMPT.format(
        name=profile.get("name", "Student"),
        total_solved=len(state.get("solved_problems", [])),
        active_days=state.get("leetcode_stats", {}).get("active_days", 0),
        target_role=target,
        difficulty_analysis=difficulty_str or "No data",
        topic_analysis=topic_str or "No data",
        comparison=comparison_str or "No data",
    )

    response = await llm.ainvoke([
        SystemMessage(content="You are an expert career coach. Return only valid JSON."),
        HumanMessage(content=prompt),
    ])

    try:
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]

        plan = json.loads(content.strip())
        return {**state, "improvement_plan": plan}
    except (json.JSONDecodeError, KeyError) as e:
        return {**state, "error": f"Failed to parse plan: {str(e)}"}


async def generate_daily_targets(state: ImprovementPlanState) -> ImprovementPlanState:
    """Generate daily targets based on the plan."""
    if state.get("error") or not state.get("improvement_plan"):
        return state

    plan_str = json.dumps(state["improvement_plan"], indent=2)

    prompt = DAILY_TARGET_PROMPT.format(
        plan=plan_str,
        weekday_hours=2,
        weekend_hours=4,
    )

    response = await llm.ainvoke([
        SystemMessage(content="You are an expert schedule planner. Return only valid JSON."),
        HumanMessage(content=prompt),
    ])

    try:
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]

        targets = json.loads(content.strip())
        return {**state, "daily_targets": targets}
    except (json.JSONDecodeError, KeyError):
        return {**state, "daily_targets": []}


async def generate_weekly_milestones(state: ImprovementPlanState) -> ImprovementPlanState:
    """Generate weekly milestones."""
    if state.get("error") or not state.get("improvement_plan"):
        return state

    plan_str = json.dumps(state["improvement_plan"], indent=2)
    weak = [t for t, s in state.get("topic_analysis", {}).items() if s < 50][:5]

    prompt = WEEKLY_MILESTONE_PROMPT.format(
        plan=plan_str,
        total_solved=len(state.get("solved_problems", [])),
        weak_topics=", ".join(weak) or "None",
    )

    response = await llm.ainvoke([
        SystemMessage(content="You are an expert milestone planner. Return only valid JSON."),
        HumanMessage(content=prompt),
    ])

    try:
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]

        milestones = json.loads(content.strip())
        return {**state, "weekly_milestones": milestones}
    except (json.JSONDecodeError, KeyError):
        return {**state, "weekly_milestones": []}


def should_continue(state: ImprovementPlanState) -> str:
    if state.get("error"):
        return "end"
    return "continue"


def create_improvement_plan_graph() -> StateGraph:
    workflow = StateGraph(ImprovementPlanState)

    workflow.add_node("fetch_data", fetch_improvement_data)
    workflow.add_node("plan", generate_plan)
    workflow.add_node("daily_targets", generate_daily_targets)
    workflow.add_node("milestones", generate_weekly_milestones)

    workflow.set_entry_point("fetch_data")

    workflow.add_conditional_edges(
        "fetch_data",
        should_continue,
        {"continue": "plan", "end": END},
    )

    workflow.add_conditional_edges(
        "plan",
        should_continue,
        {"continue": "daily_targets", "end": END},
    )

    workflow.add_conditional_edges(
        "daily_targets",
        should_continue,
        {"continue": "milestones", "end": END},
    )

    workflow.add_edge("milestones", END)

    return workflow.compile()


improvement_plan_graph = create_improvement_plan_graph()


async def run_improvement_plan_agent(user_id: str, target_role: str = "Full-Stack Developer") -> dict:
    initial_state: ImprovementPlanState = {
        "user_id": user_id,
        "target_role": target_role,
        "user_profile": None,
        "leetcode_stats": {},
        "topic_analysis": {},
        "difficulty_analysis": {},
        "comparison_with_target": {},
        "gaps_identified": [],
        "improvement_plan": None,
        "daily_targets": [],
        "weekly_milestones": [],
        "error": None,
    }

    result = await improvement_plan_graph.ainvoke(initial_state)

    return {
        "improvement_plan": result.get("improvement_plan"),
        "daily_targets": result.get("daily_targets", []),
        "weekly_milestones": result.get("weekly_milestones", []),
        "error": result.get("error"),
    }
