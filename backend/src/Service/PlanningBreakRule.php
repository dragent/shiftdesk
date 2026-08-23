<?php

namespace App\Service;

/**
 * Business rule: minimum lunch break between two slots of the same
 * employee on the same day. Pure logic, testable in TDD without a database.
 */
class PlanningBreakRule
{
    public const MIN_BREAK_MINUTES = 60;

    public function gapMinutes(int $start1, int $end1, int $start2, int $end2): int
    {
        if ($start1 < $end2 && $start2 < $end1) {
            return 0;
        }

        return $start1 >= $end2 ? $start1 - $end2 : $start2 - $end1;
    }

    public function timeToMinutes(\DateTimeImmutable $time): int
    {
        return ((int) $time->format('H')) * 60 + (int) $time->format('i');
    }

    /**
     * @param list<array{startTime: \DateTimeImmutable, endTime: \DateTimeImmutable}> $otherSlots
     */
    public function validateAgainstSlots(
        \DateTimeImmutable $startTime,
        \DateTimeImmutable $endTime,
        array $otherSlots,
    ): ?string {
        $start = $this->timeToMinutes($startTime);
        $end = $this->timeToMinutes($endTime);

        foreach ($otherSlots as $other) {
            $otherStart = $this->timeToMinutes($other['startTime']);
            $otherEnd = $this->timeToMinutes($other['endTime']);

            if ($this->gapMinutes($start, $end, $otherStart, $otherEnd) < self::MIN_BREAK_MINUTES) {
                return sprintf(
                    "La coupure avec le créneau %s-%s du même jour doit être d'au moins 1h (pause déjeuner).",
                    $other['startTime']->format('H:i'),
                    $other['endTime']->format('H:i'),
                );
            }
        }

        return null;
    }
}
