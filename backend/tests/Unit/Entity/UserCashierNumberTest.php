<?php

namespace App\Tests\Unit\Entity;

use App\Entity\User;
use PHPUnit\Framework\TestCase;

final class UserCashierNumberTest extends TestCase
{
    public function testCashierNumberDefaultsToNull(): void
    {
        $user = new User();
        self::assertNull($user->getCashierNumber());
    }

    public function testSetCashierNumberStoresTrimmedValue(): void
    {
        $user = new User();
        $user->setCashierNumber('  101  ');
        self::assertSame('101', $user->getCashierNumber());
    }

    public function testEmptyCashierNumberBecomesNull(): void
    {
        $user = new User();
        $user->setCashierNumber('101');
        $user->setCashierNumber('   ');
        self::assertNull($user->getCashierNumber());

        $user->setCashierNumber(null);
        self::assertNull($user->getCashierNumber());
    }
}
