<?php

namespace App\Service;

/**
 * Validation du plan de caisse : numéro simple ou bascule (segments).
 * Logique pure, testable en TDD sans base de données.
 */
class RegisterAssignmentValidator
{
    public const MIN_REGISTER = -1;
    public const MAX_REGISTER = 8;
    public const MIN_SEGMENTS = 2;
    public const MAX_SEGMENTS = 3;

    public function validateRegisterNumber(mixed $registerNumber): ?string
    {
        if (null === $registerNumber) {
            return null;
        }

        $value = (int) $registerNumber;
        if ($value < self::MIN_REGISTER || $value > self::MAX_REGISTER) {
            return 'Le numéro de caisse doit être compris entre -1 (pauses/retour) et 8.';
        }

        return null;
    }

    /**
     * @return array{error: ?string, normalized: list<array{startTime: string, registerNumber: int}>}
     */
    public function validateSegments(mixed $segments, string $shiftStart, string $shiftEnd): array
    {
        if (!is_array($segments) || count($segments) < self::MIN_SEGMENTS || count($segments) > self::MAX_SEGMENTS) {
            return ['error' => 'Une bascule doit comporter 2 ou 3 tranches horaires.', 'normalized' => []];
        }

        $normalized = [];
        $previousTime = null;

        foreach (array_values($segments) as $index => $segment) {
            if (!is_array($segment) || !array_key_exists('startTime', $segment) || !array_key_exists('registerNumber', $segment)) {
                return ['error' => 'Chaque tranche doit avoir une heure de début et un numéro de caisse.', 'normalized' => []];
            }

            $startTime = (string) $segment['startTime'];
            if (!preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $startTime)) {
                return ['error' => 'Heure de bascule invalide.', 'normalized' => []];
            }

            $registerNumber = (int) $segment['registerNumber'];
            if ($registerNumber < 0 || $registerNumber > self::MAX_REGISTER) {
                return ['error' => 'Le numéro de caisse d\'une tranche doit être compris entre 0 (caisses automatiques) et 8.', 'normalized' => []];
            }

            if (0 === $index && $startTime !== $shiftStart) {
                return ['error' => 'La première tranche doit commencer à l\'heure de début du créneau.', 'normalized' => []];
            }
            if (null !== $previousTime && $startTime <= $previousTime) {
                return ['error' => 'Les heures de bascule doivent être strictement croissantes.', 'normalized' => []];
            }
            if ($startTime >= $shiftEnd) {
                return ['error' => 'Une heure de bascule doit être avant la fin du créneau.', 'normalized' => []];
            }

            $previousTime = $startTime;
            $normalized[] = ['startTime' => $startTime, 'registerNumber' => $registerNumber];
        }

        return ['error' => null, 'normalized' => $normalized];
    }
}
