<?php

namespace App\Enum;

/**
 * Business roles of the application (distinct from the Symfony ROLE_*
 * roles, but used to generate them).
 */
enum UserRole: string
{
    case ADMIN = 'ROLE_ADMIN';
    case DIRECTEUR = 'ROLE_DIRECTEUR';
    case DIRECTION = 'ROLE_DIRECTION';
    case HOTE = 'ROLE_HOTE';
    case CAISSIER = 'ROLE_CAISSIER';
    case LAD = 'ROLE_LAD';
    case RAYON = 'ROLE_RAYON';
    case SECURITE = 'ROLE_SECURITE';

    public function label(): string
    {
        return match ($this) {
            self::ADMIN => 'Administrateur',
            self::DIRECTEUR => 'Directeur/rice',
            self::DIRECTION => 'Direction',
            self::HOTE => "Hôte(sse) d'accueil",
            self::CAISSIER => 'Caissier(ère)',
            self::LAD => 'LAD',
            self::RAYON => 'Rayon',
            self::SECURITE => 'Sécurité',
        };
    }

    /**
     * Roles automatically held alongside this one. A job grants the role of
     * its category: « Directeur/rice » is a job of the « Direction »
     * category, and therefore carries every permission of that category.
     *
     * Mirrored by `role_hierarchy` in security.yaml so that the firewall and
     * {@see \App\Entity\User::hasRole()} agree on the same set of roles.
     *
     * @return list<self>
     */
    public function impliedRoles(): array
    {
        return match ($this) {
            self::DIRECTEUR => [self::DIRECTION],
            default => [],
        };
    }

    /**
     * Jobs that cannot be removed from an employee once granted, nor deleted
     * from the job list.
     */
    public function isProtected(): bool
    {
        return $this === self::DIRECTEUR;
    }

    /**
     * Store hierarchy: Directeur/rice above Direction, Direction above every
     * other business job. Admin sits above Directeur/rice.
     *
     * @return list<self>
     */
    public function reachableRoles(): array
    {
        $operational = [
            self::HOTE,
            self::CAISSIER,
            self::LAD,
            self::RAYON,
            self::SECURITE,
        ];

        return match ($this) {
            self::ADMIN => self::cases(),
            self::DIRECTEUR => [self::DIRECTEUR, self::DIRECTION, ...$operational],
            self::DIRECTION => [self::DIRECTION, ...$operational],
            default => [$this],
        };
    }

    public function grants(UserRole $other): bool
    {
        return \in_array($other, $this->reachableRoles(), true);
    }
}
