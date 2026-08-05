# Contribution — ShiftDesk

Ce document formalise les **règles de contribution** définies lors de la
création du dépôt GitHub, ainsi que la démarche **TDD** attendue.

## Branches et Pull Requests

| Branche | Rôle |
|---|---|
| `main` | Production / version stable. **Jamais de push direct.** |
| `dev` | Intégration continue des fonctionnalités. |
| `feature/*`, `chore/*`, `fix/*` | Travail unitaire, toujours créé depuis `dev`. |

Flux obligatoire :

1. Créer une branche annexe depuis `dev` (`feature/…`, `chore/…`, `fix/…`).
2. Ouvrir une **Pull Request vers `dev`**.
3. Attendre que le workflow GitHub Actions **CI** soit vert.
4. Merger dans `dev` (squash recommandé).
5. Promouvoir vers `main` **uniquement via une PR `dev → main`**
   (branche `main` protégée : PR obligatoire, pas de force-push).

## Tests & TDD

Toute évolution métier suit le cycle **Red → Green → Refactor** :

1. **Red** : écrire un test unitaire (ou d'intégration) qui échoue.
2. **Green** : implémenter le minimum pour faire passer le test.
3. **Refactor** : nettoyer sans casser la suite.

### Suites

| Zone | Unitaire | Intégration | Commande |
|---|---|---|---|
| Backend Symfony | `backend/tests/Unit` | `backend/tests/Integration` | `cd backend && php bin/phpunit` |
| Frontend Next.js | `frontend/src/**/*.test.ts` (Vitest) | — | `cd frontend && npm test` |
| AI service | `ai-service/tests/test_rules.py` | `ai-service/tests/test_api_integration.py` | `cd ai-service && pytest` |

Le workflow `.github/workflows/ci.yml` exécute ces suites sur chaque PR
vers `dev` ou `main`. Un PR ne doit être mergé que si le CI est vert.

## Frontend — responsive obligatoire

Tout changement UI dans `frontend/` **doit** être vérifié en responsive
avant merge :

| Viewport | Largeur |
|---|---|
| Mobile | ~375px |
| Tablette | ~768px |
| Desktop | ≥1024px |

Contrôler au minimum : pas de débordement horizontal parasite, navigation
mobile/desktop, tableaux/grilles planning, formulaires, lisibilité.

Règle agent Cursor : `.cursor/rules/frontend-responsive.mdc` (applique
automatiquement sur les fichiers `frontend/**/*.{tsx,ts,css}`).

## Commits

Messages clairs, style conventionnel :

- `feat(scope): …` — nouvelle fonctionnalité
- `fix(scope): …` — correction
- `chore(scope): …` — outillage, CI, deps
- `test(scope): …` — ajout / renforcement de tests
- `docs: …` — documentation

Un commit = une intention. Éviter les commits fourre-tout.
