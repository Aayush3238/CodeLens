import json
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END

from state.schemas import CodeReviewState
from tools.db_tools import (
    get_solved_problems,
    get_unsolved_problems,
    get_problem_by_slug,
)
from prompts.code_review import CODE_REVIEW_PROMPT, CODE_EXPLANATION_PROMPT
from config import get_settings

settings = get_settings()

llm = ChatGoogleGenerativeAI(
    model=settings.GEMINI_MODEL,
    google_api_key=settings.GEMINI_API_KEY,
    temperature=0.7,
)


async def fetch_problem_context(state: CodeReviewState) -> CodeReviewState:
    """Fetch problem details and user's history for context."""
    if state.get("error"):
        return state

    problem = await get_problem_by_slug(state["problem_slug"])
    if not problem:
        return {**state, "error": "Problem not found"}

    user_history = await get_solved_problems(state["user_id"])

    similar_solved = [
        p for p in user_history
        if p["topic"] == problem["topic"] and p["problem_id"] != problem["id"]
    ][:5]

    return {
        **state,
        "problem": problem,
        "user_history": user_history,
        "similar_solved": similar_solved,
    }


async def review_code(state: CodeReviewState) -> CodeReviewState:
    """Use Gemini to review the code submission."""
    if state.get("error"):
        return state

    problem = state.get("problem", {})
    similar = state.get("similar_solved", [])

    similar_text = "\n".join(
        [f"- {p['title']} ({p['difficulty']})" for p in similar]
    ) or "None"

    prompt = CODE_REVIEW_PROMPT.format(
        problem_title=problem.get("title", "Unknown"),
        difficulty=problem.get("difficulty", "Unknown"),
        topic=problem.get("topic", "Unknown"),
        language=state["language"],
        code=state["code"],
        previous_submissions=state.get("previous_submissions", "None"),
        similar_solved=similar_text,
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

        review = json.loads(content.strip())
        return {**state, "review": review}
    except (json.JSONDecodeError, KeyError) as e:
        return {**state, "error": f"Failed to parse review: {str(e)}"}


def should_continue(state: CodeReviewState) -> str:
    if state.get("error"):
        return "end"
    return "continue"


def create_code_review_graph() -> StateGraph:
    workflow = StateGraph(CodeReviewState)

    workflow.add_node("fetch_context", fetch_problem_context)
    workflow.add_node("review", review_code)

    workflow.set_entry_point("fetch_context")

    workflow.add_conditional_edges(
        "fetch_context",
        should_continue,
        {"continue": "review", "end": END},
    )

    workflow.add_edge("review", END)

    return workflow.compile()


code_review_graph = create_code_review_graph()


async def run_code_review_agent(user_id: str, code: str, language: str, problem_slug: str) -> dict:
    initial_state: CodeReviewState = {
        "user_id": user_id,
        "code": code,
        "language": language,
        "problem_slug": problem_slug,
        "problem": None,
        "user_history": [],
        "similar_solved": [],
        "previous_submissions": None,
        "review": None,
        "error": None,
    }

    result = await code_review_graph.ainvoke(initial_state)

    return {
        "review": result.get("review"),
        "error": result.get("error"),
    }
