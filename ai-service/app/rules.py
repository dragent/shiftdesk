"""
Moteur de supervision de planning — version "règles" (baseline).

Objectif : fournir dès aujourd'hui une valeur utile à la Direction
(détection de sous-effectif, surcharge, conflits de pauses) sans
dépendre d'un modèle ML entraîné.

Point d'extension futur : remplacer/compléter `analyze_planning()` par
un vrai modèle (ex. prévision d'affluence à partir d'un historique de
fréquentation, scoring d'anomalies, etc.) tout en conservant le même
contrat d'entrée/sortie (cf. schemas.py) afin que le reste du système
(Symfony + Next.js) n'ait rien à changer.
"""

from collections import defaultdict
from datetime import date, timedelta

from .schemas import AnalyzePlanningRequest, Insight

# Nombre minimum de personnes simultanément planifiées jugé acceptable.
MIN_EFFECTIF = 1

# Nombre de créneaux simultanés à partir duquel on considère qu'il y a
# potentiellement de la redondance / surcharge de planning sur un même
# poste (à affiner avec de vraies données de fréquentation).
SEUIL_SURCHARGE = 4


def analyze_planning(payload: AnalyzePlanningRequest) -> list[Insight]:
    insights: list[Insight] = []

    plannings_par_jour: dict[date, list] = defaultdict(list)
    for planning in payload.plannings:
        plannings_par_jour[planning.workDate].append(planning)

    cursor = payload.from_
    while cursor <= payload.to:
        jour = plannings_par_jour.get(cursor, [])
        effectif = len({p.userId for p in jour})

        if effectif == 0:
            insights.append(
                Insight(
                    type="SOUS_EFFECTIF",
                    severity="ATTENTION",
                    targetDate=cursor,
                    message=f"Aucun hôte/hôtesse d'accueil n'est planifié le {cursor.strftime('%d/%m/%Y')}.",
                    payload={"effectif": 0},
                )
            )
        elif effectif < MIN_EFFECTIF:
            insights.append(
                Insight(
                    type="SOUS_EFFECTIF",
                    severity="INFO",
                    targetDate=cursor,
                    message=f"Effectif réduit le {cursor.strftime('%d/%m/%Y')} ({effectif} personne(s) planifiée(s)).",
                    payload={"effectif": effectif},
                )
            )
        elif effectif >= SEUIL_SURCHARGE:
            insights.append(
                Insight(
                    type="SURCHARGE",
                    severity="INFO",
                    targetDate=cursor,
                    message=f"Effectif élevé le {cursor.strftime('%d/%m/%Y')} ({effectif} personnes planifiées) : à vérifier si justifié par l'affluence attendue.",
                    payload={"effectif": effectif},
                )
            )

        cursor += timedelta(days=1)

    # Conflit de pauses : tous les hôtes planifiés aujourd'hui sont en
    # pause simultanément => accueil non couvert.
    today = date.today()
    ids_planifies_aujourdhui = {p.userId for p in plannings_par_jour.get(today, [])}
    ids_en_pause = {p.userId for p in payload.ongoingPauses}

    if ids_planifies_aujourdhui and ids_planifies_aujourdhui <= ids_en_pause:
        insights.append(
            Insight(
                type="CONFLIT_PAUSE",
                severity="CRITIQUE",
                targetDate=today,
                message=(
                    "Tous les hôtes/hôtesses planifié(e)s aujourd'hui sont "
                    "actuellement en pause simultanément : l'accueil n'est plus couvert."
                ),
                payload={"nbEnPause": len(ids_en_pause)},
            )
        )

    return insights
