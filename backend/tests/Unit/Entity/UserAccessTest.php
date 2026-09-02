<?php

namespace App\Tests\Unit\Entity;

use App\Entity\User;
use App\Enum\UserRole;
use PHPUnit\Framework\TestCase;

final class UserAccessTest extends TestCase
{
    public function testHasAccessFollowsHierarchyWithoutChangingTheStoredJob(): void
    {
        $directeur = $this->user(UserRole::DIRECTEUR);

        self::assertTrue($directeur->hasRole(UserRole::DIRECTEUR));
        self::assertFalse($directeur->hasRole(UserRole::DIRECTION));
        self::assertTrue($directeur->hasAccess(UserRole::DIRECTION));
        self::assertTrue($directeur->hasAccess(UserRole::HOTE));
        self::assertFalse($directeur->hasAccess(UserRole::ADMIN));
    }

    public function testDirectionDoesNotGainDirecteurAccess(): void
    {
        $direction = $this->user(UserRole::DIRECTION);

        self::assertTrue($direction->hasAccess(UserRole::CAISSIER));
        self::assertFalse($direction->hasAccess(UserRole::DIRECTEUR));
        self::assertFalse($direction->hasRole(UserRole::CAISSIER));
    }

    private function user(UserRole $role): User
    {
        $user = new User();
        $user->setEmail(strtolower($role->name).'@test.local');
        $user->setFirstName('Test');
        $user->setLastName($role->name);
        $user->setPassword('x');
        $user->setRoles([$role->value]);

        return $user;
    }
}
