<?php

namespace App\Tests\Integration;

use App\Enum\UserRole;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * Matrice d'accès négative : un rôle qui gagne trop de droits fait échouer
 * le test (403 attendu). Un rôle légitime qui se retrouve bloqué (403) échoue
 * aussi, pour que l'allow-list reste le contrat explicite de security.yaml.
 *
 * Tout nouveau {@see UserRole} est exercé automatiquement. L'ajouter dans
 * security.yaml sans mettre à jour {@see self::operations()} casse la suite.
 */
final class PermissionAccessApiTest extends WebTestCase
{
    use ApiTestTrait;

    public function testRolesCannotExceedTheirAccess(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();

        $emails = [];
        foreach (UserRole::cases() as $role) {
            $emails[$role->value] = strtolower($role->name).'@deny.test';
            $this->createUser($emails[$role->value], $role, $site, firstName: $role->name, lastName: 'Deny');
        }

        $tokens = [];
        foreach (UserRole::cases() as $role) {
            $tokens[$role->value] = $this->login($client, $emails[$role->value]);
        }

        $failures = [];
        foreach (self::operations() as [$method, $path, $allowed]) {
            foreach (UserRole::cases() as $role) {
                $client->request(
                    $method,
                    $path,
                    server: $this->authHeaders($tokens[$role->value]),
                    content: self::needsBody($method) ? '{}' : '',
                );
                $status = $client->getResponse()->getStatusCode();
                $mayAccess = \in_array($role, $allowed, true);

                if ($mayAccess && \in_array($status, [401, 403], true)) {
                    $failures[] = sprintf(
                        '%s %s as %s: got %d, this role should have access',
                        $method,
                        $path,
                        $role->value,
                        $status,
                    );
                } elseif ($mayAccess && $status >= 500) {
                    $failures[] = sprintf(
                        '%s %s as %s: got %d, allowed role must not hit a server error',
                        $method,
                        $path,
                        $role->value,
                        $status,
                    );
                } elseif (!$mayAccess && 403 !== $status) {
                    $failures[] = sprintf(
                        '%s %s as %s: got %d, expected 403 (role has too much access)',
                        $method,
                        $path,
                        $role->value,
                        $status,
                    );
                }
            }
        }

        self::assertSame([], $failures, implode("\n", $failures));
    }

    /**
     * Contrat dérivé de config/packages/security.yaml. Les rôles listés sont
     * autorisés ; tous les autres cas métier doivent rester en 403.
     *
     * @return list<array{0: string, 1: string, 2: list<UserRole>}>
     */
    private static function operations(): array
    {
        $admin = [UserRole::ADMIN];
        $management = [UserRole::ADMIN, UserRole::DIRECTION];
        $accueil = [UserRole::ADMIN, UserRole::DIRECTION, UserRole::HOTE];
        $authenticated = UserRole::cases();
        // Ids that must not match fixtures, so allowed DELETE/PATCH never
        // destroy accounts or the site used by later requests.
        $id = 999999;

        return [
            ['GET', '/api/categories', $accueil],
            ['POST', '/api/categories', $admin],
            ['PUT', '/api/categories/'.$id, $admin],
            ['DELETE', '/api/categories/'.$id, $admin],

            ['GET', '/api/sites', $accueil],
            ['POST', '/api/sites', $admin],
            ['PUT', '/api/sites/'.$id, $admin],
            ['DELETE', '/api/sites/'.$id, $admin],

            ['GET', '/api/users', $management],
            ['GET', '/api/users/'.$id, $management],
            ['POST', '/api/users', $management],
            ['PATCH', '/api/users/'.$id, $management],
            ['DELETE', '/api/users/'.$id, $management],

            ['GET', '/api/caissiers', $accueil],
            ['POST', '/api/caissiers', $management],
            ['PATCH', '/api/caissiers/'.$id, $accueil],
            ['DELETE', '/api/caissiers/'.$id, $management],

            ['GET', '/api/plannings', $authenticated],
            ['POST', '/api/plannings', $management],
            ['PATCH', '/api/plannings/'.$id, $management],
            ['PATCH', '/api/plannings/'.$id.'/register-number', $accueil],
            ['DELETE', '/api/plannings/'.$id, $management],

            ['GET', '/api/absences', $authenticated],
            ['POST', '/api/absences', $management],
            ['DELETE', '/api/absences/'.$id, $management],

            ['GET', '/api/store-closures', $authenticated],
            ['POST', '/api/store-closures', $management],
            ['DELETE', '/api/store-closures/'.$id, $management],

            ['GET', '/api/pauses', $accueil],
            ['POST', '/api/pauses/start', $accueil],

            ['GET', '/api/requests', $accueil],
            ['POST', '/api/requests', $accueil],

            ['GET', '/api/direction-notes', $accueil],
            ['POST', '/api/direction-notes', $management],
            ['PATCH', '/api/direction-notes/'.$id, $management],
            ['PATCH', '/api/direction-notes/'.$id.'/close', $management],
            ['GET', '/api/direction-notes/'.$id.'/readers', $management],
            ['POST', '/api/direction-notes/'.$id.'/seen', $accueil],
            ['DELETE', '/api/direction-notes/'.$id, $management],

            ['GET', '/api/ai/insights', $management],
            ['POST', '/api/ai/analyze', $management],
            ['PATCH', '/api/ai/insights/'.$id, $management],

            ['GET', '/api/me', $authenticated],
            ['PATCH', '/api/me', $authenticated],
        ];
    }

    private static function needsBody(string $method): bool
    {
        return \in_array($method, ['POST', 'PUT', 'PATCH'], true);
    }
}
