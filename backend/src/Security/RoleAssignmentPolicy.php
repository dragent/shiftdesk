<?php

namespace App\Security;

use App\Entity\User;
use App\Enum\UserRole;

/**
 * Who may grant which business role. Frontend RoleGuard is not a boundary:
 * this policy is what the API must enforce.
 */
final class RoleAssignmentPolicy
{
    public function parse(string $role): UserRole
    {
        $role = strtoupper($role);

        return UserRole::tryFrom('ROLE_'.$role) ?? UserRole::tryFrom($role) ?? UserRole::HOTE;
    }

    public function canAssign(User $actor, UserRole $target): bool
    {
        if ($actor->hasRole(UserRole::ADMIN)) {
            return true;
        }

        if ($actor->hasRole(UserRole::DIRECTION)) {
            return $target !== UserRole::ADMIN;
        }

        return false;
    }
}
