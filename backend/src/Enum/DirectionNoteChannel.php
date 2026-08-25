<?php

namespace App\Enum;

enum DirectionNoteChannel: string
{
    case DIRECTION_DIRECTION = 'DIRECTION_DIRECTION';
    case DIRECTION_ACCUEIL = 'DIRECTION_ACCUEIL';

    public function label(): string
    {
        return match ($this) {
            self::DIRECTION_DIRECTION => 'Direction envers Direction',
            self::DIRECTION_ACCUEIL => 'Direction envers Accueil',
        };
    }
}
