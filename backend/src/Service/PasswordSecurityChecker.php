<?php

namespace App\Service;

/**
 * Enforces a minimum password policy for personal passwords (first login
 * after recruitment, or voluntary rotation). Temporary recruitment passwords
 * are out of scope: they are short-lived and replaced immediately.
 */
class PasswordSecurityChecker
{
    public const MIN_LENGTH = 12;

    /**
     * Returns a French error message when the password is not secure enough,
     * or null when it may be hashed and stored.
     */
    public function validate(string $password): ?string
    {
        if (strlen($password) < self::MIN_LENGTH) {
            return sprintf(
                'Le mot de passe doit contenir au moins %d caractères.',
                self::MIN_LENGTH,
            );
        }

        if (!preg_match('/[a-z]/', $password)) {
            return 'Le mot de passe doit contenir au moins une lettre minuscule.';
        }
        if (!preg_match('/[A-Z]/', $password)) {
            return 'Le mot de passe doit contenir au moins une lettre majuscule.';
        }
        if (!preg_match('/[0-9]/', $password)) {
            return 'Le mot de passe doit contenir au moins un chiffre.';
        }
        if (!preg_match('/[^a-zA-Z0-9]/', $password)) {
            return 'Le mot de passe doit contenir au moins un caractère spécial (!@#$…).';
        }

        if ($this->isCommonPassword($password)) {
            return 'Ce mot de passe est trop courant. Choisissez-en un plus robuste.';
        }

        if (preg_match('/^(.)\1+$/', $password)) {
            return 'Le mot de passe ne doit pas être composé d\'un seul caractère répété.';
        }

        return null;
    }

    /**
     * Strength score used by tests / diagnostics: 0 (empty) … 4 (very strong).
     * Acceptance for storage requires score >= 3 (same rules as validate()).
     */
    public function score(string $password): int
    {
        if ($password === '') {
            return 0;
        }

        $score = 0;
        $length = strlen($password);

        if ($length >= 8) {
            ++$score;
        }
        if ($length >= self::MIN_LENGTH) {
            ++$score;
        }
        if ($length >= 16) {
            ++$score;
        }

        $classes = 0;
        if (preg_match('/[a-z]/', $password)) {
            ++$classes;
        }
        if (preg_match('/[A-Z]/', $password)) {
            ++$classes;
        }
        if (preg_match('/[0-9]/', $password)) {
            ++$classes;
        }
        if (preg_match('/[^a-zA-Z0-9]/', $password)) {
            ++$classes;
        }
        if ($classes >= 3) {
            ++$score;
        }
        if ($classes === 4) {
            ++$score;
        }

        // Cap at 4; a failed policy never counts as "fort".
        $score = min(4, $score);
        if ($this->validate($password) !== null) {
            return min(2, $score);
        }

        return max(3, $score);
    }

    private function isCommonPassword(string $password): bool
    {
        $normalized = strtolower($password);
        $common = [
            'password123!',
            'motdepasse123!',
            'azertyuiop12!',
            'qwertyuiop12!',
            'changeme1234!',
            'bienvenue123!',
            'carrefour123!',
            'shiftdesk123!',
            'adminadmin12!',
            'welcome1234!',
        ];

        return in_array($normalized, $common, true);
    }
}
