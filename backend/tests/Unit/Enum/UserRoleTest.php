<?php

namespace App\Tests\Unit\Enum;

use App\Enum\UserRole;
use PHPUnit\Framework\TestCase;

final class UserRoleTest extends TestCase
{
    public function testAllRolesHaveFrenchLabels(): void
    {
        self::assertSame('Administrateur', UserRole::ADMIN->label());
        self::assertSame('Direction', UserRole::DIRECTION->label());
        self::assertSame("Hôte(sse) d'accueil", UserRole::HOTE->label());
        self::assertSame('Caissier(ère)', UserRole::CAISSIER->label());
        self::assertSame('Rayon', UserRole::RAYON->label());
        self::assertSame('Sécurité', UserRole::SECURITE->label());
    }

    public function testRoleValuesMatchSymfonyConvention(): void
    {
        foreach (UserRole::cases() as $role) {
            self::assertStringStartsWith('ROLE_', $role->value);
        }
    }
}
