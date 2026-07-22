<?php

namespace App\Enum;

enum DemandeStatus: string
{
    case NOUVELLE = 'NOUVELLE';
    case EN_COURS = 'EN_COURS';
    case TRAITEE = 'TRAITEE';
    case ANNULEE = 'ANNULEE';
}
