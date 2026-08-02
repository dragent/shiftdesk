<?php

namespace App\Enum;

enum HalfDay: string
{
    case MATIN = 'MATIN';
    case APRES_MIDI = 'APRES_MIDI';

    public function label(): string
    {
        return match ($this) {
            self::MATIN => 'Matin',
            self::APRES_MIDI => 'Après-midi',
        };
    }
}
