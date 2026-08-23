<?php

namespace App\Tests\Unit\Service;

use App\Service\PasswordSecurityChecker;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class PasswordSecurityCheckerTest extends TestCase
{
    private PasswordSecurityChecker $checker;

    protected function setUp(): void
    {
        $this->checker = new PasswordSecurityChecker();
    }

    public function testSecurePasswordIsAccepted(): void
    {
        self::assertNull($this->checker->validate('MonMdpPerso1!'));
        self::assertGreaterThanOrEqual(3, $this->checker->score('MonMdpPerso1!'));
    }

    #[DataProvider('insecurePasswordProvider')]
    public function testInsecurePasswordsAreRejected(string $password): void
    {
        self::assertNotNull($this->checker->validate($password));
        self::assertLessThan(3, $this->checker->score($password));
    }

    public static function insecurePasswordProvider(): iterable
    {
        yield 'too_short' => ['Abcdef1!'];
        yield 'no_upper' => ['monmdpperso1!'];
        yield 'no_lower' => ['MONMDPPERSO1!'];
        yield 'no_digit' => ['MonMdpPerso!!'];
        yield 'no_special' => ['MonMdpPerso12'];
        yield 'common' => ['Password123!'];
        yield 'repeated' => ['!!!!!!!!!!!!'];
    }
}
