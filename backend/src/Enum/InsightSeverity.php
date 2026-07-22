<?php

namespace App\Enum;

enum InsightSeverity: string
{
    case INFO = 'INFO';
    case ATTENTION = 'ATTENTION';
    case CRITIQUE = 'CRITIQUE';
}
