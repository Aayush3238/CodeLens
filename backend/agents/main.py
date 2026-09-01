from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Literal, Optional
import uvicorn

from config import get_settings
from tools.db_tools import get_pool, close_pool
from graph.learning_path import run_learning_path_agent

settings = get_settings()

app = FastAPI(
    title="LeetCoach AI Agents",
    description="Python agents for intelligent learning path generation",
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


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.AGENT_PORT,
        reload=True,
    )
