"""
Micro-service IA — Supervision de planning (Carrefour Accueil).

Ce service est volontairement isolé du backend Symfony afin de pouvoir
faire évoluer la brique IA (modèles ML, librairies data-science type
pandas/scikit-learn/etc.) indépendamment du reste de l'application,
sans jamais impacter le front Next.js ni l'API Symfony : le contrat
HTTP ci-dessous (POST /analyze-planning) est le seul point de couplage.

Démarrage local :
    pip install -r requirements.txt
    uvicorn app.main:app --reload --port 8001

Démarrage via Docker :
    docker compose up ai-service
"""

from fastapi import FastAPI

from .rules import analyze_planning
from .schemas import AnalyzePlanningRequest, AnalyzePlanningResponse

app = FastAPI(
    title="Carrefour Accueil — IA Supervision de planning",
    description=(
        "Analyse les plannings et pauses de l'accueil pour détecter "
        "sous-effectifs, surcharges et conflits, et proposer des alertes "
        "à la Direction. Implémentation actuelle : moteur de règles "
        "(cf. app/rules.py), remplaçable par un modèle ML sans changer "
        "le contrat d'API."
    ),
    version="0.1.0",
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/analyze-planning", response_model=AnalyzePlanningResponse)
def analyze_planning_endpoint(payload: AnalyzePlanningRequest) -> AnalyzePlanningResponse:
    insights = analyze_planning(payload)

    return AnalyzePlanningResponse(insights=insights)
