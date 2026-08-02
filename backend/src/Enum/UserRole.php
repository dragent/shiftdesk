<?php

namespace App\Enum;

/**
 * Rôles métier de l'application (distincts des rôles Symfony ROLE_*,
 * mais utilisés pour générer ces derniers).
 */
enum UserRole: string
{
    case ADMIN = 'ROLE_ADMIN';
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
            self::DIRECTION => 'Direction',
            self::HOTE => "Hôte(sse) d'accueil",
            self::CAISSIER => 'Caissier(ère)',
            self::LAD => 'LAD',
            self::RAYON => 'Rayon',
            self::SECURITE => 'Sécurité',
        };
    }
}
