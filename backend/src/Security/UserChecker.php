<?php

namespace App\Security;

use App\Entity\User;
use Symfony\Component\Security\Core\Exception\DisabledException;
use Symfony\Component\Security\Core\User\UserCheckerInterface;
use Symfony\Component\Security\Core\User\UserInterface;

/**
 * Rejects deactivated / dismissed accounts at login and on each JWT request.
 * Without this, an 8h token keeps working after `active` is flipped to false.
 */
final class UserChecker implements UserCheckerInterface
{
    public function checkPreAuth(UserInterface $user): void
    {
        if (!$user instanceof User) {
            return;
        }

        if (!$user->isActive()) {
            throw new DisabledException('Ce compte est désactivé.');
        }
    }

    public function checkPostAuth(UserInterface $user): void
    {
    }
}
