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

        // Only a director appoints another director; holding the category
        // role (ROLE_DIRECTION) is not enough.
        if ($target === UserRole::DIRECTEUR) {
            return $actor->hasRole(UserRole::DIRECTEUR);
        }

        if ($actor->hasRole(UserRole::DIRECTION)) {
            return $target !== UserRole::ADMIN;
        }

        return false;
    }

    /**
     * A protected job can never be taken away: once appointed, a director
     * keeps the role whoever asks, administrator included.
     */
    public function canReplaceRole(User $target, UserRole $newRole): bool
    {
        foreach (UserRole::cases() as $role) {
            if ($role->isProtected() && $target->hasRole($role) && $newRole !== $role) {
                return false;
            }
        }

        return true;
    }
}
