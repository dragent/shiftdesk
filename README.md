# ShiftDesk — Gestion de l'accueil

Application de gestion d'un site Carrefour : **plannings** (équipe et
individuel), **pauses** et **demandes** d'accueil, **employés** (Direction),
**notes** de consigne, et une brique **IA de supervision de planning**
(architecture prête, extensible avec de vrais modèles ML).

## Stack technique

| Composant | Techno |
|---|---|
| Frontend | Next.js 16 (App Router, TypeScript, Tailwind CSS) |
| Backend | Symfony 7.2 (API JSON, Doctrine ORM, JWT) |
| Base de données | MySQL 8 |
| Module IA | FastAPI (Python), micro-service isolé (`ai-service/`) |

## Structure du repo

```
shiftdesk/
├── .github/         # Workflows CI (GitHub Actions)
├── backend/         # API Symfony (métier, auth, base de données)
├── frontend/        # Application Next.js (UI)
├── ai-service/      # Micro-service IA — supervision de planning
├── doc/             # Audits (sécurité, filet développeur seul)
├── docker-compose.yml
├── CONTRIBUTING.md  # Règles de contribution, branches, TDD
└── README.md
```

## Fonctionnalités

### Accueil (rôle `ROLE_HOTE`)
- Démarrer/terminer ses pauses en temps réel (courte, déjeuner, autre).
- Enregistrer une demande/interaction, classée via un menu déroulant de
  catégories entièrement configurable par un administrateur (ex.
  *Caroline*, *Siebel*, *Menu Carrefour*).
- Consulter son planning, le plan de caisse, et les notes Direction → Accueil.

### Équipe magasin (`ROLE_CAISSIER`, `ROLE_LAD`, `ROLE_RAYON`, `ROLE_SECURITE`)
- Consulter son planning et son profil (email / téléphone modifiables).

### Direction (rôle `ROLE_DIRECTION`)
- Créer et gérer les plannings (créneaux de travail) de toute l'équipe,
  vue par semaine, avec impression (signatures de présence).
- Gérer les employés (recrutement, licenciement, fiches) et les absences.
- **Notes de consigne** (canal interne Direction, ou partagé avec l'accueil).
- **Supervision IA du planning** : détection automatique de
  sous-effectifs, surcharges et conflits de pauses, avec possibilité de
  lancer une analyse à la demande et de traiter les alertes.

### Administration (rôle `ROLE_ADMIN`)
- Gestion des comptes utilisateurs (tous les rôles).
- Gestion des sites.
- Gestion des catégories de demandes (le contenu du dropdown côté
  accueil), sans redéploiement.
- Seul rôle autorisé à attribuer `ROLE_ADMIN`.

Le `RoleGuard` frontend n'est **pas** une barrière : l'API refuse les
actions hors rôle. Voir [doc/audit-securite.md](doc/audit-securite.md).

## Module IA — Supervision de planning

Le backend Symfony ne contient **aucune logique IA en dur** : il délègue
l'analyse à un micro-service dédié (`ai-service/`, FastAPI) via
`PlanningSupervisorService` (`backend/src/Service/PlanningSupervisorService.php`).

- Si `ai-service` est disponible, il est interrogé (`POST /analyze-planning`).
- S'il est indisponible (pas démarré, en cours de dev...), un **mode de
  secours basé sur des règles simples** prend le relais côté Symfony, afin
  que la fonctionnalité reste toujours utilisable.

Cette séparation permet de faire évoluer la partie IA (modèles ML,
prévision d'affluence, etc.) **indépendamment** du reste de l'application.
Voir `ai-service/README.md` pour le détail du contrat d'API et les pistes
d'évolution.

## Lancer le projet en local (sans Docker pour l'app, MySQL en Docker)

C'est le mode utilisé pendant le développement (testé de bout en bout).

### 1. Base de données

```bash
docker compose up -d mysql adminer
```

MySQL est exposé sur `127.0.0.1:3307` (pour éviter un conflit avec un
MySQL déjà installé localement sur le port 3306 par défaut). Adminer est
disponible sur http://localhost:8080 (serveur `mysql`, utilisateur
`shiftdesk`, mot de passe `shiftdesk`, base `shiftdesk`).

> Si vous n'avez pas de MySQL local sur le port 3306, vous pouvez changer
> le mapping de port dans `docker-compose.yml` (`"3306:3306"`) et adapter
> `backend/.env` en conséquence.

### 2. Backend Symfony

```bash
cd backend
composer install
php bin/console doctrine:migrations:migrate   # crée les tables
php bin/console app:seed-demo                  # comptes + catégories de démo
symfony server:start --no-tls --port=8000
# ou : php -S 127.0.0.1:8000 -t public
```

Génération des clés JWT (une seule fois, si `config/jwt/*.pem` n'existent
pas) :

```bash
php bin/console lexik:jwt:generate-keypair
```

> **Windows** : si vous obtenez une erreur OpenSSL du type
> `error:80000003:system library::No such process`, définissez la
> variable d'environnement `OPENSSL_CONF` vers le fichier `openssl.cnf`
> livré avec votre installation PHP (ex. `.../php/extras/ssl/openssl.cnf`).

### 3. Frontend Next.js

```bash
cd frontend
npm install
npm run dev
```

L'app est disponible sur http://localhost:3000 et appelle l'API via
`NEXT_PUBLIC_API_URL` (voir `frontend/.env.local`, par défaut
`http://127.0.0.1:8000`).

### 4. (Optionnel) Module IA

```bash
cd ai-service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

Sans cette étape, l'application fonctionne quand même : Symfony utilise
son mode de secours basé sur des règles simples (voir plus haut).

### Comptes de démonstration

Créés par `php bin/console app:seed-demo` :

| Email | Rôle |
|---|---|
| `admin@carrefour-accueil.local` | Administrateur |
| `directeur@carrefour-accueil.local` | Directeur/rice |
| `direction@carrefour-accueil.local` | Direction |
| `hote@carrefour-accueil.local` | Hôte/hôtesse d'accueil |
| `lad@carrefour-accueil.local` | LAD |
| `rayon@carrefour-accueil.local` | Rayon |
| `securite@carrefour-accueil.local` | Sécurité |
| `sophie.durand@caissier.carrefour-accueil.local` | Caissier(ère) |

Mot de passe : `Password123!` (identique pour tous, y compris les autres
caissiers de démo `julie.martin@…` et `karim.benali@…`).

## Lancer le projet entièrement via Docker

Un `docker-compose.yml` complet est fourni (MySQL, Adminer, backend,
frontend, ai-service) :

```bash
docker compose up -d --build
```

- Frontend : http://localhost:3000
- Backend : http://localhost:8000
- Module IA : http://localhost:8001/docs
- Adminer : http://localhost:8080

Le conteneur backend génère automatiquement ses clés JWT au premier
démarrage, applique les migrations Doctrine et initialise les données de
démonstration (`docker/entrypoint.sh`).

> Le workflow local (section précédente) reste recommandé en phase de
> développement actif (rechargement à chaud plus rapide côté Symfony/Next.js).

## Modèle de données (résumé)

- **Site** : un point d'accueil (magasin/site).
- **User** : compte rattaché à un site, avec un rôle métier
  (`ROLE_ADMIN`, `ROLE_DIRECTION`, `ROLE_HOTE`, `ROLE_CAISSIER`,
  `ROLE_LAD`, `ROLE_RAYON`, `ROLE_SECURITE`).
- **Planning** : créneau de travail (date, heure début/fin, n° de caisse
  éventuel), créé par la Direction pour un employé.
- **Absence** : congé / maladie / autre, saisie par la Direction.
- **Pause** : pause démarrée/terminée en temps réel par l'accueil,
  éventuellement rattachée à un planning.
- **RequestCategory** : catégorie affichée dans le dropdown de saisie des
  demandes (ex. Caroline, Siebel, Menu Carrefour), gérée par l'admin.
- **AccueilRequest** : une demande/interaction traitée à l'accueil,
  classée par catégorie.
- **DirectionNote** : consigne Direction (canal interne ou Accueil),
  avec lecteurs et clôture.
- **PlanningInsight** : une alerte générée par le module IA de
  supervision de planning (sous-effectif, surcharge, conflit de pause...).

## Contribution & workflow Git

Voir [CONTRIBUTING.md](CONTRIBUTING.md) pour le détail. En résumé :

1. Branches de travail (`feature/*`, `chore/*`, `fix/*`) créées **depuis `dev`**.
2. Pull Request **vers `dev`** (pas de merge direct).
3. Promotion **`dev` → `main` uniquement via PR**.
4. Branche `main` protégée (PR obligatoire, pas de force-push).
5. Tout changement UI frontend doit être **vérifié en responsive**
   (mobile / tablette / desktop) — voir `.cursor/rules/frontend-responsive.mdc`.
6. Tout changement d’auth / permissions doit passer un **audit à froid**
   (session neuve + `/review-security`) — voir
   [doc/audit-securite.md](doc/audit-securite.md).

## Tests

Les règles métier critiques sont extraites en services testables
(`PlanningBreakRule`, `RegisterAssignmentValidator`, `LocalPlanningAnalyzer`)
afin de pouvoir les couvrir en TDD sans base de données.

Les permissions API sont couvertes par des **tests négatifs** (échec si un
rôle gagne trop d'accès) : `PermissionAccessApiTest` (matrice des routes)
et `AuthorizationBoundaryApiTest` (champs sensibles, JWT désactivé).

| Zone | Commande |
|---|---|
| Backend (Unit + Integration) | `cd backend && php bin/phpunit` |
| Frontend (Vitest + ESLint) | `cd frontend && npm test` puis `npm run lint` |
| AI service (pytest) | `cd ai-service && pytest` |

Le workflow GitHub Actions (`.github/workflows/ci.yml`) exécute ces suites
sur chaque push/PR vers `dev` ou `main`.

## Prochaines étapes possibles

- Enrichir le module IA avec un vrai modèle de prévision d'affluence
  (historique de fréquentation → dimensionnement du planning).
- Notifications temps réel (ex. Mercure) lors d'une alerte IA critique
  ou d'une nouvelle demande urgente.
- Durcir le multi-sites (IDOR notes, `GET /api/users` / absences /
  planning filtrés par site) — backlog dans
  [doc/audit-securite.md](doc/audit-securite.md).

## Impression du planning (Direction)

Sur l'écran `Direction > Planning`, une carte **Imprimer le planning**
(sous le tableau) permet de :

- Imprimer **tout le planning** de la semaine affichée : une ligne vierge
  est alors ajoutée sous les horaires de chaque employé, destinée à la
  **signature de présence** de chaque demi-journée.
- Ou imprimer **le planning d'une seule personne**, sélectionnée dans la
  liste déroulante (sans ligne de signature).

L'impression réutilise les données déjà chargées à l'écran (même semaine),
via une vue imprimable dédiée (masquée à l'écran, affichée uniquement au
moment de l'impression grâce aux media queries `print`).
