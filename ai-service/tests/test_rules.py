"""Tests unitaires du moteur de règles IA (TDD)."""

from datetime import date, datetime, timezone

from app.rules import SEUIL_SURCHARGE, analyze_planning
from app.schemas import AnalyzePlanningRequest, OngoingPause, PlanningEntry


def _request(*, from_: date, to: date, plannings=None, pauses=None) -> AnalyzePlanningRequest:
    return AnalyzePlanningRequest.model_validate(
        {
            "from": from_,
            "to": to,
            "plannings": plannings or [],
            "ongoingPauses": pauses or [],
        }
    )


def test_detecte_sous_effectif_si_aucun_planning():
    day = date(2026, 7, 20)
    insights = analyze_planning(_request(from_=day, to=day))

    assert len(insights) == 1
    assert insights[0].type == "SOUS_EFFECTIF"
    assert insights[0].severity == "ATTENTION"
    assert insights[0].payload == {"effectif": 0}


def test_detecte_surcharge_au_seuil():
    day = date(2026, 7, 20)
    plannings = [
        PlanningEntry(
            userId=i,
            workDate=day,
            startTime="07:30",
            endTime="14:00",
            status="PLANIFIE",
        )
        for i in range(1, SEUIL_SURCHARGE + 1)
    ]

    insights = analyze_planning(_request(from_=day, to=day, plannings=plannings))
    types = [i.type for i in insights]

    assert "SURCHARGE" in types
    assert "SOUS_EFFECTIF" not in types


def test_detecte_conflit_pause_si_tous_en_pause(monkeypatch):
    today = date.today()

    plannings = [
        PlanningEntry(userId=1, workDate=today, startTime="07:30", endTime="14:00", status="PLANIFIE"),
        PlanningEntry(userId=2, workDate=today, startTime="07:30", endTime="14:00", status="PLANIFIE"),
    ]
    pauses = [
        OngoingPause(userId=1, type="COURTE", startedAt=datetime.now(timezone.utc)),
        OngoingPause(userId=2, type="COURTE", startedAt=datetime.now(timezone.utc)),
    ]

    insights = analyze_planning(_request(from_=today, to=today, plannings=plannings, pauses=pauses))
    conflits = [i for i in insights if i.type == "CONFLIT_PAUSE"]

    assert len(conflits) == 1
    assert conflits[0].severity == "CRITIQUE"


def test_pas_de_conflit_si_un_hote_reste_disponible():
    today = date.today()

    plannings = [
        PlanningEntry(userId=1, workDate=today, startTime="07:30", endTime="14:00", status="PLANIFIE"),
        PlanningEntry(userId=2, workDate=today, startTime="07:30", endTime="14:00", status="PLANIFIE"),
    ]
    pauses = [
        OngoingPause(userId=1, type="COURTE", startedAt=datetime.now(timezone.utc)),
    ]

    insights = analyze_planning(_request(from_=today, to=today, plannings=plannings, pauses=pauses))
    types = [i.type for i in insights]

    assert "CONFLIT_PAUSE" not in types
