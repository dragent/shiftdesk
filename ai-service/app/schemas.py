"""
Schémas Pydantic partagés par le micro-service IA de supervision de
planning. Le contrat d'entrée/sortie ci-dessous DOIT rester synchronisé
avec `PlanningSupervisorService::callRemoteAiService()` côté Symfony
(backend/src/Service/PlanningSupervisorService.php).
"""

from datetime import date, datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class PlanningEntry(BaseModel):
    userId: int
    workDate: date
    startTime: str  # format "HH:MM"
    endTime: str  # format "HH:MM"
    status: str


class OngoingPause(BaseModel):
    userId: int
    type: str
    startedAt: datetime


class AnalyzePlanningRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    # "from" est un mot réservé en Python, on le mappe vers "from_".
    from_: date = Field(alias="from")
    to: date
    siteId: Optional[int] = None
    plannings: list[PlanningEntry] = []
    ongoingPauses: list[OngoingPause] = []


InsightType = Literal[
    "SOUS_EFFECTIF",
    "SURCHARGE",
    "CONFLIT_PAUSE",
    "ANOMALIE_PLANNING",
    "AUTRE",
]
InsightSeverity = Literal["INFO", "ATTENTION", "CRITIQUE"]


class Insight(BaseModel):
    type: InsightType
    severity: InsightSeverity
    targetDate: date
    message: str
    payload: Optional[dict[str, Any]] = None


class AnalyzePlanningResponse(BaseModel):
    insights: list[Insight]
