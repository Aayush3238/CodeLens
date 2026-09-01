import json
from typing import Literal
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END

from state.schemas import LearningPathState, RevisionDay
from tools.db_tools import (
    get_user_profile,
    compute_weak_topics,
    get_solved_problems,
    get_unsolved_problems,
    get_topic_problem_counts,
    create_revision_plan,
)
from prompts.learning_path import ANALYSIS_PROMPT, PLAN_PROMPT, RECOMMENDATION_PROMPT
from config import get_settings

settings = get_settings()

llm = ChatOpenAI(
    model=settings.OPENAI_MODEL,
    temperature=0.7,
    api_key=settings.OPENAI_API_KEY,
)


async def fetch_user_data(state: LearningPathState) -> LearningPathState:
    """Fetch all user data from the database."""
    user_id = state["user_id"]

    profile = await get_user_profile(user_id)
    if not profile:
        return {**state, "error": "User not found"}

    weak_topics = await compute_weak_topics(user_id)
    solved = await get_solved_problems(user_id)
    topic_counts = await get_topic_problem_counts()

    return {
        **state,
        "user_profile": profile,
        "weak_topics": weak_topics,
        "solved_problems": solved,
        "topic_distribution": topic_counts,
    }


async def analyze_weaknesses(state: LearningPathState) -> LearningPathState:
    """Use LLM to analyze the student's weak areas."""
    if state.get("error"):
        return state

    weak_topics = state.get("weak_topics", [])
    solved = state.get("solved_problems", [])

    weak_topics_table = "\n".join(
        [f"- {t['topic']}: {t['strength_score']}% ({t['problem_count']} solved)" for t in weak_topics[:10]]
    )

    recent = solved[:10]
    recent_submissions = "\n".join(
        [f"- {p['title']} ({p['difficulty']}, {p['topic']})" for p in recent]
    ) if recent else "No recent submissions"

    prompt = ANALYSIS_PROMPT.format(
        name=state["user_profile"]["name"],
        total_solved=len(solved),
        weak_topics_table=weak_topics_table or "No topic data available",
        recent_submissions=recent_submissions,
    )

    response = await llm.ainvoke([
        SystemMessage(content="You are an expert competitive programming coach."),
        HumanMessage(content=prompt),
    ])

    return {**state, "analysis": response.content}


async def generate_plan(state: LearningPathState) -> LearningPathState:
    """Generate the revision plan using LLM."""
    if state.get("error"):
        return state

    plan_type = state["plan_type"]
    plan_days = {"7day": 7, "30day": 30, "60day": 60}
    total_days = plan_days.get(plan_type, 30)

    weak_topics = state.get("weak_topics", [])
    weak_topics_table = "\n".join(
        [f"- {t['topic']}: {t['strength_score']}%" for t in weak_topics[:8]]
    )

    unsolved_by_topic = {}
    for topic in [t["topic"] for t in weak_topics[:5]]:
        problems = await get_unsolved_problems(state["user_id"], topic)
        unsolved_by_topic[topic] = [
            {"id": p["id"], "title": p["title"], "difficulty": p["difficulty"]}
            for p in problems[:15]
        ]

    available_problems = "\n".join(
        [f"\n{topic}:\n" + "\n".join(
            [f"  - {p['title']} ({p['difficulty']})" for p in probs]
        ) for topic, probs in unsolved_by_topic.items()]
    ) or "No unsolved problems available"

    prompt = PLAN_PROMPT.format(
        analysis=state.get("analysis", "No analysis available"),
        weak_topics_table=weak_topics_table or "No weak topics",
        available_problems=available_problems,
        plan_type=plan_type,
        total_days=total_days,
    )

    response = await llm.ainvoke([
        SystemMessage(content="You are an expert competitive programming coach. Return only valid JSON."),
        HumanMessage(content=prompt),
    ])

    try:
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]

        plan_data = json.loads(content.strip())
        plan = [
            RevisionDay(
                day=item["day"],
                date="",
                topic=item["topic"],
                problems=item["problems"],
                estimated_time=item.get("estimated_time", 90),
                focus_area=item.get("focus_area", ""),
            )
            for item in plan_data
        ]
        return {**state, "plan": plan}
    except (json.JSONDecodeError, KeyError) as e:
        return {**state, "error": f"Failed to parse plan: {str(e)}"}


async def generate_recommendations(state: LearningPathState) -> LearningPathState:
    """Generate personalized recommendations."""
    if state.get("error"):
        return state

    weak_topics = state.get("weak_topics", [])
    solved = state.get("solved_problems", [])

    weak_str = "\n".join([f"- {t['topic']}: {t['strength_score']}%" for t in weak_topics[:5]])
    strong_str = "\n".join([f"- {t['topic']}: {t['strength_score']}%" for t in weak_topics[-3:]])
    recent = "\n".join([f"- {p['title']} ({p['topic']})" for p in solved[:5]])

    prompt = RECOMMENDATION_PROMPT.format(
        weak_topics=weak_str or "None",
        strong_topics=strong_str or "None",
        recent_activity=recent or "No recent activity",
    )

    response = await llm.ainvoke([
        SystemMessage(content="You are an expert competitive programming coach. Return only valid JSON."),
        HumanMessage(content=prompt),
    ])

    try:
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]

        recommendations = json.loads(content.strip())
        return {**state, "recommendations": recommendations}
    except (json.JSONDecodeError, KeyError):
        return {**state, "recommendations": []}


async def save_plan(state: LearningPathState) -> LearningPathState:
    """Save the generated plan to the database."""
    if state.get("error") or not state.get("plan"):
        return state

    try:
        items = [
            {
                "day": day.day,
                "topic": day.topic,
                "problems": json.dumps([p.get("title", "") for p in day.problems]),
                "estimated_time": day.estimated_time,
            }
            for day in state["plan"]
        ]

        await create_revision_plan(state["user_id"], state["plan_type"], items)
        return state
    except Exception as e:
        return {**state, "error": f"Failed to save plan: {str(e)}"}


def should_continue(state: LearningPathState) -> str:
    """Determine if we should continue or end."""
    if state.get("error"):
        return "end"
    return "continue"


def create_learning_path_graph() -> StateGraph:
    """Create the LangGraph workflow for learning path generation."""
    workflow = StateGraph(LearningPathState)

    workflow.add_node("fetch_data", fetch_user_data)
    workflow.add_node("analyze", analyze_weaknesses)
    workflow.add_node("generate_plan", generate_plan)
    workflow.add_node("recommend", generate_recommendations)
    workflow.add_node("save", save_plan)

    workflow.set_entry_point("fetch_data")

    workflow.add_conditional_edges(
        "fetch_data",
        should_continue,
        {"continue": "analyze", "end": END},
    )

    workflow.add_conditional_edges(
        "analyze",
        should_continue,
        {"continue": "generate_plan", "end": END},
    )

    workflow.add_conditional_edges(
        "generate_plan",
        should_continue,
        {"continue": "recommend", "end": END},
    )

    workflow.add_conditional_edges(
        "recommend",
        should_continue,
        {"continue": "save", "end": END},
    )

    workflow.add_edge("save", END)

    return workflow.compile()


learning_path_graph = create_learning_path_graph()


async def run_learning_path_agent(user_id: str, plan_type: str) -> dict:
    """Run the learning path agent for a user."""
    initial_state: LearningPathState = {
        "user_id": user_id,
        "plan_type": plan_type,
        "user_profile": None,
        "weak_topics": [],
        "solved_problems": [],
        "all_problems": [],
        "topic_distribution": {},
        "analysis": "",
        "plan": [],
        "recommendations": [],
        "error": None,
    }

    result = await learning_path_graph.ainvoke(initial_state)

    return {
        "analysis": result.get("analysis", ""),
        "plan": [day.dict() for day in result.get("plan", [])],
        "recommendations": result.get("recommendations", []),
        "error": result.get("error"),
    }
