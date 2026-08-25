<?php

namespace App\Enum;

/**
 * Operational priority for a direction dashboard note.
 * Urgent notes are highlighted in the UI and sorted first among open notes.
 */
enum DirectionNotePriority: string
{
    case NORMAL = 'NORMAL';
    case URGENT = 'URGENT';
}
