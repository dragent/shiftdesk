# Module IA — Supervision de planning

Micro-service **FastAPI** isolé, dédié à la brique IA de l'accueil : la
**supervision de planning** demandée par la Direction (détection de
sous-effectif, surcharge, conflits de pauses, etc.).

## Pourquoi un service séparé ?

- Permet de faire évoluer la partie IA (ajout de modèles ML, librairies
  data-science, historisation de fréquentation, etc.) **sans toucher**
  au backend Symfony ni au frontend Next.js.
- Le backend Symfony (`PlanningSupervisorService`) appelle ce service
  via HTTP (`POST /analyze-planning`). S'il est indisponible (pas encore
  démarré, en cours de développement...), Symfony bascule automatiquement
  sur un mode de secours basé sur des règles simples, afin que la
  fonctionnalité "Supervision IA" reste toujours utilisable dans l'app.

## État actuel

Implémentation **v0 : moteur de règles** (`app/rules.py`) :
- Sous-effectif : aucun (ou trop peu de) hôte/hôtesse planifié un jour donné.
- Surcharge : effectif anormalement élevé un jour donné (seuil à ajuster).
- Conflit de pause : tous les hôtes planifiés aujourd'hui sont en pause
  simultanément → l'accueil n'est plus couvert.

## Évolutions futures envisageables

- Prédiction d'affluence (historique de fréquentation → prévision par
  créneau horaire) pour dimensionner le planning en amont.
- Détection d'anomalies plus fine (ex. apprentissage sur les plannings
  passés + incidents réels).
- Suggestions automatiques de réorganisation de planning.

Pour les ajouter : créer un nouveau module (ex. `app/ml_model.py`),
l'appeler depuis `main.py` en plus ou à la place de `analyze_planning()`,
en conservant le même contrat de réponse (`schemas.Insight`).

## Lancer en local

```bash
cd ai-service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

Documentation interactive : http://127.0.0.1:8001/docs

## Lancer via Docker

Décommenter le service `ai-service` dans `docker-compose.yml` à la racine,
puis :

```bash
docker compose up -d ai-service
```

Le backend Symfony pointera vers lui via la variable d'environnement
`AI_SERVICE_URL` (voir `backend/.env`).

## Contrat d'API

### `POST /analyze-planning`

```json
{
  "from": "2026-07-22",
  "to": "2026-07-28",
  "siteId": 1,
  "plannings": [
    { "userId": 3, "workDate": "2026-07-22", "startTime": "08:00", "endTime": "16:00", "status": "PLANIFIE" }
  ],
  "ongoingPauses": [
    { "userId": 3, "type": "COURTE", "startedAt": "2026-07-22T10:15:00+02:00" }
  ]
}
```

Réponse :

```json
{
  "insights": [
    {
      "type": "SOUS_EFFECTIF",
      "severity": "ATTENTION",
      "targetDate": "2026-07-23",
      "message": "Aucun hôte/hôtesse d'accueil n'est planifié le 23/07/2026.",
      "payload": { "effectif": 0 }
    }
  ]
}
```

Ce contrat est partagé avec `backend/src/Service/PlanningSupervisorService.php` :
toute modification doit être répercutée des deux côtés.
