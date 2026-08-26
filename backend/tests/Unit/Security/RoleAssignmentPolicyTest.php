<?php

namespace App\Tests\Unit\Security;

use App\Entity\User;
use App\Enum\UserRole;
use App\Security\RoleAssignmentPolicy;
use PHPUnit\Framework\TestCase;

final class RoleAssignmentPolicyTest extends TestCase
{
    private RoleAssignmentPolicy $policy;

    protected function setUp(): void
    {
        $this->policy = new RoleAssignmentPolicy();
    }

    public function testAdminCanAssignEveryRoleIncludingAdmin(): void
    {
        $admin = $this->user(UserRole::ADMIN);

        foreach (UserRole::cases() as $role) {
            self::assertTrue($this->policy->canAssign($admin, $role), $role->value);
        }
    }

    public function testDirectionCannotPromoteAnyoneToAdmin(): void
    {
        $direction = $this->user(UserRole::DIRECTION);

        self::assertFalse($this->policy->canAssign($direction, UserRole::ADMIN));
        self::assertTrue($this->policy->canAssign($direction, UserRole::HOTE));
        self::assertTrue($this->policy->canAssign($direction, UserRole::DIRECTION));
        self::assertTrue($this->policy->canAssign($direction, UserRole::CAISSIER));
    }

    public function testReceptionCannotAssignRoles(): void
    {
        $hote = $this->user(UserRole::HOTE);

        self::assertFalse($this->policy->canAssign($hote, UserRole::HOTE));
        self::assertFalse($this->policy->canAssign($hote, UserRole::CAISSIER));
    }

    public function testParseAcceptsShortAndSymfonyNames(): void
    {
        self::assertSame(UserRole::ADMIN, $this->policy->parse('ADMIN'));
        self::assertSame(UserRole::ADMIN, $this->policy->parse('ROLE_ADMIN'));
        self::assertSame(UserRole::HOTE, $this->policy->parse('not-a-role'));
    }

    private function user(UserRole $role): User
    {
        $user = new User();
        $user->setEmail($role->value.'@test.local');
        $user->setFirstName('Test');
        $user->setLastName('User');
        $user->setPassword('hash');
        $user->setRoles([$role->value]);

        return $user;
    }
}
