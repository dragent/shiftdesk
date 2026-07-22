<?php

namespace App\Enum;

/**
 * Types d'alertes générées par le module IA de supervision de planning.
 */
enum InsightType: string
{
    case SOUS_EFFECTIF = 'SOUS_EFFECTIF';
    case SURCHARGE = 'SURCHARGE';
    case CONFLIT_PAUSE = 'CONFLIT_PAUSE';
    case ANOMALIE_PLANNING = 'ANOMALIE_PLANNING';
    case AUTRE = 'AUTRE';
}
