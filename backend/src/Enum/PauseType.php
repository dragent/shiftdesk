<?php

namespace App\Enum;

enum PauseType: string
{
    case COURTE = 'COURTE';
    case DEJEUNER = 'DEJEUNER';
    case AUTRE = 'AUTRE';

    public function label(): string
    {
        return match ($this) {
            self::COURTE => 'Pause courte',
            self::DEJEUNER => 'Pause déjeuner',
            self::AUTRE => 'Autre',
        };
    }
}
