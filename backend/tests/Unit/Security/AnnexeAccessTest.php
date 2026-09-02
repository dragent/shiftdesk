<?php

namespace App\Tests\Unit\Security;

use App\Entity\Site;
use App\Entity\User;
use App\Enum\UserRole;
use App\Security\AnnexeAccess;
use PHPUnit\Framework\TestCase;

final class AnnexeAccessTest extends TestCase
{
    public function testParseAllowedRolesAcceptsRoleConstantsAndShortNames(): void
    {
        $parsed = AnnexeAccess::parseAllowedRoles(['ROLE_CAISSIER', 'hote']);

        self::assertSame([UserRole::CAISSIER->value, UserRole::HOTE->value], $parsed);
    }

    public function testParseAllowedRolesRejectsAdminAndUnknown(): void
    {
        self::assertNull(AnnexeAccess::parseAllowedRoles(['ROLE_ADMIN']));
        self::assertNull(AnnexeAccess::parseAllowedRoles(['ROLE_INCONNU']));
        self::assertNull(AnnexeAccess::parseAllowedRoles([]));
        self::assertNull(AnnexeAccess::parseAllowedRoles(null));
    }

    public function testAssignableWebsiteRolesExcludeAdmin(): void
    {
        $values = array_map(static fn (UserRole $role): string => $role->value, AnnexeAccess::assignableWebsiteRoles());

        self::assertNotContains(UserRole::ADMIN->value, $values);
        self::assertContains(UserRole::HOTE->value, $values);
        self::assertContains(UserRole::CAISSIER->value, $values);
    }

    public function testSiteScopeMatchesUserStoreOrUnscoped(): void
    {
        $site = new Site();
        $site->setName('A');
        $ref = new \ReflectionProperty(Site::class, 'id');
        $ref->setAccessible(true);
        $ref->setValue($site, 4);

        $user = $this->user(UserRole::DIRECTION, $site);
        $other = new Site();
        $other->setName('B');
        $ref->setValue($other, 9);

        self::assertTrue(AnnexeAccess::isInSiteScope($site, $user));
        self::assertTrue(AnnexeAccess::isInSiteScope(null, $user));
        self::assertFalse(AnnexeAccess::isInSiteScope($other, $user));

        $noSite = $this->user(UserRole::DIRECTION, null);
        self::assertTrue(AnnexeAccess::isInSiteScope(null, $noSite));
        self::assertFalse(AnnexeAccess::isInSiteScope($site, $noSite));
    }

    public function testFileManagersAreDirectionAdminAndHote(): void
    {
        $site = new Site();
        $site->setName('A');

        self::assertTrue(AnnexeAccess::canManageFiles($this->user(UserRole::DIRECTION, $site)));
        self::assertTrue(AnnexeAccess::canManageFiles($this->user(UserRole::HOTE, $site)));
        self::assertTrue(AnnexeAccess::canManageFiles($this->user(UserRole::ADMIN, $site)));
        self::assertFalse(AnnexeAccess::canManageFiles($this->user(UserRole::CAISSIER, $site)));
    }

    private function user(UserRole $role, ?Site $site): User
    {
        $user = new User();
        $user->setEmail(strtolower($role->name).'@test.local');
        $user->setFirstName('Test');
        $user->setLastName($role->name);
        $user->setPassword('x');
        $user->setRoles([$role->value]);
        $user->setSite($site);

        return $user;
    }
}
