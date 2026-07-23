"""Tests d'intégration HTTP du micro-service IA (FastAPI TestClient)."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_ok():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_analyze_planning_endpoint_returns_insights():
    response = client.post(
        "/analyze-planning",
        json={
            "from": "2026-07-20",
            "to": "2026-07-20",
            "plannings": [],
            "ongoingPauses": [],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert "insights" in body
    assert body["insights"][0]["type"] == "SOUS_EFFECTIF"
