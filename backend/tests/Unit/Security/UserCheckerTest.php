<?php

namespace App\Tests\Unit\Security;

use App\Entity\User;
use App\Security\UserChecker;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Security\Core\Exception\DisabledException;
use Symfony\Component\Security\Core\User\InMemoryUser;

final class UserCheckerTest extends TestCase
{
    public function testActiveUserIsAccepted(): void
    {
        $user = $this->user(true);
        (new UserChecker())->checkPreAuth($user);
        $this->addToAssertionCount(1);
    }

    public function testInactiveUserIsRejected(): void
    {
        $this->expectException(DisabledException::class);

        (new UserChecker())->checkPreAuth($this->user(false));
    }

    public function testNonAppUsersAreIgnored(): void
    {
        (new UserChecker())->checkPreAuth(new InMemoryUser('anon', null));
        $this->addToAssertionCount(1);
    }

    private function user(bool $active): User
    {
        $user = new User();
        $user->setEmail('user@test.local');
        $user->setFirstName('Test');
        $user->setLastName('User');
        $user->setPassword('hash');
        $user->setActive($active);

        return $user;
    }
}
