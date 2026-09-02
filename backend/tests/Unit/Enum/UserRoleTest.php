<?php

namespace App\Tests\Unit\Enum;

use App\Enum\UserRole;
use PHPUnit\Framework\TestCase;

final class UserRoleTest extends TestCase
{
    public function testAllRolesHaveFrenchLabels(): void
    {
        self::assertSame('Administrateur', UserRole::ADMIN->label());
        self::assertSame('Directeur/rice', UserRole::DIRECTEUR->label());
        self::assertSame('Direction', UserRole::DIRECTION->label());
        self::assertSame("Hôte(sse) d'accueil", UserRole::HOTE->label());
        self::assertSame('Caissier(ère)', UserRole::CAISSIER->label());
        self::assertSame('LAD', UserRole::LAD->label());
        self::assertSame('Rayon', UserRole::RAYON->label());
        self::assertSame('Sécurité', UserRole::SECURITE->label());
    }

    public function testDirecteurCarriesTheRolesOfTheDirectionCategory(): void
    {
        self::assertSame([UserRole::DIRECTION], UserRole::DIRECTEUR->impliedRoles());
        self::assertSame([], UserRole::DIRECTION->impliedRoles());
        self::assertSame([], UserRole::CAISSIER->impliedRoles());
    }

    public function testOnlyDirecteurIsProtected(): void
    {
        self::assertTrue(UserRole::DIRECTEUR->isProtected());

        foreach (UserRole::cases() as $role) {
            if ($role !== UserRole::DIRECTEUR) {
                self::assertFalse($role->isProtected(), $role->value);
            }
        }
    }

    public function testRoleValuesMatchSymfonyConvention(): void
    {
        foreach (UserRole::cases() as $role) {
            self::assertStringStartsWith('ROLE_', $role->value);
        }
    }

    public function testDirecteurSitsAboveDirectionWhichSitsAboveOtherJobs(): void
    {
        self::assertTrue(UserRole::DIRECTEUR->grants(UserRole::DIRECTION));
        self::assertTrue(UserRole::DIRECTEUR->grants(UserRole::HOTE));
        self::assertFalse(UserRole::DIRECTION->grants(UserRole::DIRECTEUR));
        self::assertTrue(UserRole::DIRECTION->grants(UserRole::CAISSIER));
        self::assertFalse(UserRole::HOTE->grants(UserRole::DIRECTION));
        self::assertTrue(UserRole::ADMIN->grants(UserRole::DIRECTEUR));
        self::assertFalse(UserRole::DIRECTEUR->grants(UserRole::ADMIN));
    }
}
