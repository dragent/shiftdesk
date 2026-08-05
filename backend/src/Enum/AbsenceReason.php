<?php

namespace App\Enum;

enum AbsenceReason: string
{
    case ARRET_TRAVAIL = 'ARRET_TRAVAIL';
    case CONGE = 'CONGE';

    public function label(): string
    {
        return match ($this) {
            self::ARRET_TRAVAIL => 'Arrêt de travail',
            self::CONGE => 'Congé',
        };
    }
}
