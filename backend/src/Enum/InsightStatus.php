<?php

namespace App\Enum;

enum InsightStatus: string
{
    case NOUVELLE = 'NOUVELLE';
    case VUE = 'VUE';
    case TRAITEE = 'TRAITEE';
    case IGNOREE = 'IGNOREE';
}
