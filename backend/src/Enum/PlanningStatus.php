<?php

namespace App\Enum;

enum PlanningStatus: string
{
    case PLANIFIE = 'PLANIFIE';
    case CONFIRME = 'CONFIRME';
    case ANNULE = 'ANNULE';
}
