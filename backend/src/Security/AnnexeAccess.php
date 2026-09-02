<?php

namespace App\Security;

use App\Entity\Site;
use App\Entity\User;
use App\Enum\UserRole;

/**
 * Shared helpers for annex resources: store scope and allowed job roles.
 */
final class AnnexeAccess
{
    /**
     * Business jobs that Direction may grant access to a website.
     * Admin is omitted: administrators always see every website.
     *
     * @return list<UserRole>
     */
    public static function assignableWebsiteRoles(): array
    {
        return array_values(array_filter(
            UserRole::cases(),
            static fn (UserRole $role): bool => $role !== UserRole::ADMIN,
        ));
    }

    /**
     * @return list<string>|null  Role values, or null when the payload is invalid
     */
    public static function parseAllowedRoles(mixed $raw): ?array
    {
        if (!\is_array($raw) || $raw === []) {
            return null;
        }

        $assignable = [];
        foreach (self::assignableWebsiteRoles() as $role) {
            $assignable[$role->value] = $role;
            $assignable[$role->name] = $role;
        }

        $parsed = [];
        foreach ($raw as $item) {
            if (!\is_string($item) || $item === '') {
                return null;
            }
            $key = strtoupper($item);
            $role = $assignable[$key] ?? null;
            if (!$role) {
                return null;
            }
            $parsed[] = $role->value;
        }

        $parsed = array_values(array_unique($parsed));

        return $parsed === [] ? null : $parsed;
    }

    public static function isInSiteScope(?Site $resourceSite, User $user): bool
    {
        $userSiteId = $user->getSite()?->getId();
        if ($userSiteId === null) {
            return $resourceSite === null;
        }

        return $resourceSite === null || $resourceSite->getId() === $userSiteId;
    }

    public static function isDirectionOrAdmin(User $user): bool
    {
        return $user->hasAccess(UserRole::DIRECTION);
    }

    public static function canManageFiles(User $user): bool
    {
        return self::isDirectionOrAdmin($user) || $user->hasRole(UserRole::HOTE);
    }
}
