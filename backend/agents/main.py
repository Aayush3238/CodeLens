from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Literal, Optional
import uvicorn

from config import get_settings
from tools.db_tools import get_pool, close_pool
from graph.learning_path import run_learning_path_agent
from graph.code_review import run_code_review_agent
from graph.study_session import run_study_session_agent
from graph.data_insight import run_data_insight_agent
from graph.progress_tracker import run_progress_tracker_agent
from graph.improvement_plan import run_improvement_plan_agent

settings = get_settings()

app = FastAPI(
    title="LeetCoach AI Agents",
    description="Python agents for intelligent learning and career guidance",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class LearningPathRequest(BaseModel):
    user_id: str
    plan_type: Literal["7day", "30day", "60day"]


class LearningPathResponse(BaseModel):
    analysis: str
    plan: list[dict]
    recommendations: list[dict]
    error: Optional[str] = None


class CodeReviewRequest(BaseModel):
    user_id: str
    code: str
    language: str
    problem_slug: str


class StudySessionRequest(BaseModel):
    user_id: str
    conversation_id: str
    user_message: str
    problem_slug: Optional[str] = None


class DataInsightRequest(BaseModel):
    user_id: str
    insight_type: str = "overview"


class ImprovementPlanRequest(BaseModel):
    user_id: str
    target_role: Optional[str] = "Full-Stack Developer"


async def verify_secret(authorization: str = Header(None)):
    if not authorization or authorization != f"Bearer {settings.AGENT_SECRET}":
        raise HTTPException(status_code=401, detail="Invalid agent secret")


@app.on_event("startup")
async def startup():
    await get_pool()


@app.on_event("shutdown")
async def shutdown():
    await close_pool()


@app.get("/health")
async def health():
    return {"status": "ok", "service": "leetcoach-agents"}


@app.post("/api/agents/learning-path", response_model=LearningPathResponse)
async def create_learning_path(
    request: LearningPathRequest,
    _: str = Depends(verify_secret),
):
    try:
        result = await run_learning_path_agent(request.user_id, request.plan_type)

        if result.get("error"):
            raise HTTPException(status_code=500, detail=result["error"])

        return LearningPathResponse(
            analysis=result.get("analysis", ""),
            plan=result.get("plan", []),
            recommendations=result.get("recommendations", []),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/agents/code-review")
async def code_review(
    request: CodeReviewRequest,
    _: str = Depends(verify_secret),
):
    try:
        result = await run_code_review_agent(
            user_id=request.user_id,
            code=request.code,
            language=request.language,
            problem_slug=request.problem_slug,
        )

        if result.get("error"):
            raise HTTPException(status_code=500, detail=result["error"])

        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/agents/study-session")
async def study_session(
    request: StudySessionRequest,
    _: str = Depends(verify_secret),
):
    try:
        result = await run_study_session_agent(
            user_id=request.user_id,
            conversation_id=request.conversation_id,
            user_message=request.user_message,
            problem_slug=request.problem_slug,
        )

        if result.get("error"):
            raise HTTPException(status_code=500, detail=result["error"])

        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/agents/data-insight")
async def data_insight(
    request: DataInsightRequest,
    _: str = Depends(verify_secret),
):
    try:
        result = await run_data_insight_agent(
            user_id=request.user_id,
            insight_type=request.insight_type,
        )

        if result.get("error"):
            raise HTTPException(status_code=500, detail=result["error"])

        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/agents/progress-tracker")
async def progress_tracker(
    request: DataInsightRequest,
    _: str = Depends(verify_secret),
):
    try:
        result = await run_progress_tracker_agent(user_id=request.user_id)

        if result.get("error"):
            raise HTTPException(status_code=500, detail=result["error"])

        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/agents/improvement-plan")
async def improvement_plan(
    request: ImprovementPlanRequest,
    _: str = Depends(verify_secret),
):
    try:
        result = await run_improvement_plan_agent(
            user_id=request.user_id,
            target_role=request.target_role or "Full-Stack Developer",
        )

        if result.get("error"):
            raise HTTPException(status_code=500, detail=result["error"])

        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.AGENT_PORT,
        reload=True,
    )
