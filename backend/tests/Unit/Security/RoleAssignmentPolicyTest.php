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

    public function testOnlyADirecteurAppointsAnotherDirecteur(): void
    {
        self::assertTrue(
            $this->policy->canAssign($this->user(UserRole::DIRECTEUR), UserRole::DIRECTEUR),
        );
        self::assertTrue(
            $this->policy->canAssign($this->user(UserRole::ADMIN), UserRole::DIRECTEUR),
        );
        // Holding the category role is not enough to appoint a director.
        self::assertFalse(
            $this->policy->canAssign($this->user(UserRole::DIRECTION), UserRole::DIRECTEUR),
        );
        self::assertFalse(
            $this->policy->canAssign($this->user(UserRole::HOTE), UserRole::DIRECTEUR),
        );
    }

    public function testDirecteurKeepsEveryRightOfTheDirectionCategory(): void
    {
        $directeur = $this->user(UserRole::DIRECTEUR);

        self::assertTrue($directeur->hasRole(UserRole::DIRECTION));
        self::assertTrue($this->policy->canAssign($directeur, UserRole::CAISSIER));
        self::assertFalse($this->policy->canAssign($directeur, UserRole::ADMIN));
    }

    public function testTheDirecteurRoleCanNeverBeTakenAway(): void
    {
        $directeur = $this->user(UserRole::DIRECTEUR);

        self::assertFalse($this->policy->canReplaceRole($directeur, UserRole::HOTE));
        self::assertFalse($this->policy->canReplaceRole($directeur, UserRole::DIRECTION));
        self::assertFalse($this->policy->canReplaceRole($directeur, UserRole::ADMIN));
        // Re-applying the same job stays a no-op, not a removal.
        self::assertTrue($this->policy->canReplaceRole($directeur, UserRole::DIRECTEUR));
    }

    public function testOtherJobsRemainInterchangeable(): void
    {
        $cashier = $this->user(UserRole::CAISSIER);

        self::assertTrue($this->policy->canReplaceRole($cashier, UserRole::LAD));
        self::assertTrue($this->policy->canReplaceRole($cashier, UserRole::DIRECTEUR));
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
