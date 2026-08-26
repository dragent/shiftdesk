# Sécurité — filet solo (humain + IA)

Développeur seul : pas de pair review humaine. Le `RoleGuard` frontend
n’est **pas** une barrière. L’API (`security.yaml` + contrôleurs) est la
seule source de vérité.

Les angles morts partagés humain+IA (permissions trop larges, PATCH
fourre-tout) ne se voient pas dans la session qui a écrit le code.

## Pratique obligatoire

Après tout changement d’auth / rôles / JWT :

1. **Tests négatifs** — un rôle qui gagne trop d’accès doit faire échouer
   la CI :
   - champs sensibles : `backend/tests/Integration/AuthorizationBoundaryApiTest.php`
   - matrice des routes : `backend/tests/Integration/PermissionAccessApiTest.php`
2. **Second regard indépendant** — `/review-security` (autre agent, sans
   l’historique de la session qui a produit le changement).
3. **Audit à froid** — relire le code de sécurité dans une **session
   neuve**, pas dans celle qui a écrit le correctif.

Règle agent : `.cursor/rules/security-cold-audit.mdc`.

### Points à revérifier à froid

- Un rôle peut-il s’attribuer un rôle plus élevé (Direction → Admin) ?
- Un `PATCH` trop large permet-il mot de passe / `active` / email hors UI ?
- Un JWT reste-t-il valable après désactivation (`UserChecker`) ?
- Un accès par id (notes, users, caissiers) ignore-t-il le site ?

## Audit à froid du 26 août 2026

Session neuve + revue sécurité indépendante. Constat : plusieurs
permissions n’étaient appliquées que dans l’UI.

### Corrigé (HIGH / JWT)

| Trou | Correctif |
|---|---|
| Direction peut créer ou promouvoir un `ROLE_ADMIN` | `RoleAssignmentPolicy` : seul l’admin attribue `ADMIN` |
| Direction peut poser un mot de passe via `PATCH /api/users` | Champ `password` refusé (changement via le profil) |
| Accueil peut désactiver un caissier ou lui poser un mot de passe | `PATCH /api/caissiers` : l’accueil ne touche qu’au n° caissier |
| Compte désactivé : JWT encore valable 8 h | `UserChecker` au login et sur chaque requête API |

UI alignée : page Caissiers, l’accueil ne voit plus Désactiver / site /
suppression.

### Encore ouvert (MEDIUM)

À traiter dans un prochain audit à froid, pas dans la session qui a
écrit les correctifs ci-dessus :

- **IDOR multi-sites** sur les notes direction (actions par id hors
  filtre site).
- **`GET /api/absences`** lisible par tous les rôles authentifiés
  (congés / maladie de toute l’équipe).
- **`?caissiersOnly=` / `?ladOnly=`** sur `GET /api/plannings` : tout
  rôle autorisé à lire le planning peut voir tous les créneaux caisse/LAD.
- **`GET /api/users`** : pas de filtrage par site pour la Direction.

## Commandes

```bash
cd backend && php bin/phpunit tests/Integration/AuthorizationBoundaryApiTest.php tests/Integration/PermissionAccessApiTest.php tests/Unit/Security
cd frontend && npm test && npm run lint
```
