import json
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END

from state.schemas import StudySessionState
from tools.db_tools import (
    get_user_profile,
    compute_weak_topics,
    get_solved_problems,
    get_problem_by_slug,
)
from prompts.study_session import STUDY_SESSION_PROMPT, HINT_PROMPT, QUIZ_PROMPT
from config import get_settings

settings = get_settings()

llm = ChatGoogleGenerativeAI(
    model=settings.GEMINI_MODEL,
    google_api_key=settings.GEMINI_API_KEY,
    temperature=0.7,
)


async def fetch_user_context(state: StudySessionState) -> StudySessionState:
    """Fetch user profile, weak topics, and current problem context."""
    if state.get("error"):
        return state

    profile = await get_user_profile(state["user_id"])
    weak_topics = await compute_weak_topics(state["user_id"])
    solved = await get_solved_problems(state["user_id"])

    return {
        **state,
        "user_profile": profile,
        "weak_topics": weak_topics,
        "solved_count": len(solved),
    }


async def generate_response(state: StudySessionState) -> StudySessionState:
    """Generate AI response based on context."""
    if state.get("error"):
        return state

    profile = state.get("user_profile", {})
    weak = state.get("weak_topics", [])
    history = state.get("conversation_history", [])

    weak_text = ", ".join([t["topic"] for t in weak[:5]]) or "None"
    history_text = "\n".join(
        [f"{'User' if m['role'] == 'user' else 'AI'}: {m['content']}" for m in history[-10:]]
    ) or "No previous messages"

    prompt = STUDY_SESSION_PROMPT.format(
        name=profile.get("name", "Student"),
        total_solved=state.get("solved_count", 0),
        weak_topics=weak_text,
        level="Intermediate" if state.get("solved_count", 0) > 50 else "Beginner",
        current_problem="Not specified",
        conversation_history=history_text,
        user_message=state["user_message"],
    )

    response = await llm.ainvoke([
        SystemMessage(content="You are LeetCoach AI, an expert competitive programming coach."),
        HumanMessage(content=prompt),
    ])

    return {**state, "ai_response": response.content}


async def generate_hints(state: StudySessionState) -> StudySessionState:
    """Generate progressive hints if student is stuck."""
    if state.get("error") or not state.get("current_problem"):
        return state

    problem = state["current_problem"]

    hints = []
    for level in [1, 2, 3]:
        prompt = HINT_PROMPT.format(
            problem_title=problem.get("title", "Unknown"),
            difficulty=problem.get("difficulty", "Unknown"),
            topic=problem.get("topic", "Unknown"),
            language=state.get("language", "python"),
            current_code=state.get("current_code", "# No code yet"),
            hint_level=level,
        )

        response = await llm.ainvoke([
            SystemMessage(content="You are LeetCoach AI giving progressive hints."),
            HumanMessage(content=prompt),
        ])
        hints.append(response.content)

    return {**state, "hints": hints}


async def generate_quiz(state: StudySessionState) -> StudySessionState:
    """Generate quiz questions based on weak topics."""
    if state.get("error"):
        return state

    weak = state.get("weak_topics", [])
    weak_text = ", ".join([t["topic"] for t in weak[:5]]) or "General algorithms"

    prompt = QUIZ_PROMPT.format(
        weak_topics=weak_text,
        recent_topics="Array, String, Hash Map",
    )

    response = await llm.ainvoke([
        SystemMessage(content="You are LeetCoach AI. Return only valid JSON."),
        HumanMessage(content=prompt),
    ])

    try:
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]

        quiz = json.loads(content.strip())
        return {**state, "quiz_questions": quiz}
    except (json.JSONDecodeError, KeyError):
        return {**state, "quiz_questions": []}


def should_continue(state: StudySessionState) -> str:
    if state.get("error"):
        return "end"
    return "continue"


def create_study_session_graph() -> StateGraph:
    workflow = StateGraph(StudySessionState)

    workflow.add_node("fetch_context", fetch_user_context)
    workflow.add_node("respond", generate_response)
    workflow.add_node("hints", generate_hints)
    workflow.add_node("quiz", generate_quiz)

    workflow.set_entry_point("fetch_context")

    workflow.add_conditional_edges(
        "fetch_context",
        should_continue,
        {"continue": "respond", "end": END},
    )

    workflow.add_edge("respond", END)
    workflow.add_edge("hints", END)
    workflow.add_edge("quiz", END)

    return workflow.compile()


study_session_graph = create_study_session_graph()


async def run_study_session_agent(
    user_id: str,
    conversation_id: str,
    user_message: str,
    current_problem: dict = None,
    conversation_history: list = None,
) -> dict:
    initial_state: StudySessionState = {
        "user_id": user_id,
        "conversation_id": conversation_id,
        "user_message": user_message,
        "user_profile": None,
        "current_problem": current_problem,
        "weak_topics": [],
        "conversation_history": conversation_history or [],
        "ai_response": "",
        "hints": [],
        "quiz_questions": [],
        "error": None,
    }

    result = await study_session_graph.ainvoke(initial_state)

    return {
        "response": result.get("ai_response", ""),
        "hints": result.get("hints", []),
        "error": result.get("error"),
    }
