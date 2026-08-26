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
| Frontend Next.js | `frontend/src/**/*.test.ts` (Vitest) | — | `cd frontend && npm test` puis `npm run lint` |
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

## Frontend — ESLint obligatoire

La CI exécute `npm run lint` dans `frontend/` (ESLint Next). Toute
évolution frontend **doit** laisser cette commande verte (0 erreur, pas de
nouveau warning) avant merge. Corriger la règle, pas la masquer avec
`eslint-disable` (sauf motif déjà accepté, ex. impression).

Règle agent Cursor : `.cursor/rules/frontend-eslint.mdc` (applique
automatiquement sur les fichiers `frontend/**/*.{tsx,ts,mjs}`).

## Commits

Messages clairs, style conventionnel :

- `feat(scope): …` — nouvelle fonctionnalité
- `fix(scope): …` — correction
- `chore(scope): …` — outillage, CI, deps
- `test(scope): …` — ajout / renforcement de tests
- `docs: …` — documentation

Un commit = une intention. Éviter les commits fourre-tout.

## Sécurité — développeur seul

Le `RoleGuard` frontend **n’est pas** une barrière : l’API doit refuser
toute action qu’un rôle n’a pas le droit de faire. Les tests positifs
(« X peut faire Y ») ne suffisent pas ; il faut des **tests négatifs**
(« X ne peut pas faire Z ») qui cassent si un rôle gagne trop d’accès.

Après tout changement d’auth / permissions / rôles :

1. Ajouter ou étendre un test d’intégration négatif
   (`AuthorizationBoundaryApiTest` pour les champs sensibles,
   `PermissionAccessApiTest` pour la matrice des routes).
2. Lancer une **revue sécurité indépendante** (`/review-security`) — autre
   agent, sans le contexte de la session qui a écrit le code.
3. Faire un **audit à froid** : relire le code de sécurité dans une
   **session neuve**, pas dans celle qui a produit le changement.

Ne pas merger / ne pas clôturer tant que ces trois filets n’ont pas été
passés. Compte rendu et backlog : [doc/audit-securite.md](doc/audit-securite.md).
Règle agent : `.cursor/rules/security-cold-audit.mdc`.
