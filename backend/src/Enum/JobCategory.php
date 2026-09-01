<?php

namespace App\Enum;

/**
 * Fixed job categories shown in Gestion Jobs, recruitment and the schedule.
 * Jobs (métiers) live inside a category; the category itself is not editable.
 */
enum JobCategory: string
{
    case DIRECTION = 'DIRECTION';
    case ACCUEIL_CAISSE = 'ACCUEIL_CAISSE';
    case SECURITE = 'SECURITE';
    case RAYON = 'RAYON';

    public function label(): string
    {
        return match ($this) {
            self::DIRECTION => 'Direction',
            self::ACCUEIL_CAISSE => 'Accueil / Caisse',
            self::SECURITE => 'Sécurité',
            self::RAYON => 'Rayon',
        };
    }

    /**
     * Permission role granted to a newly created job in this category.
     * The protected « Directeur/rice » job is the exception: it grants
     * ROLE_DIRECTEUR, which itself implies ROLE_DIRECTION.
     */
    public function defaultGrantsRole(): UserRole
    {
        return match ($this) {
            self::DIRECTION => UserRole::DIRECTION,
            self::ACCUEIL_CAISSE => UserRole::CAISSIER,
            self::SECURITE => UserRole::SECURITE,
            self::RAYON => UserRole::RAYON,
        };
    }
}
