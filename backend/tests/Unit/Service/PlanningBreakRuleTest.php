<?php

namespace App\Tests\Unit\Service;

use App\Service\PlanningBreakRule;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class PlanningBreakRuleTest extends TestCase
{
    private PlanningBreakRule $rule;

    protected function setUp(): void
    {
        $this->rule = new PlanningBreakRule();
    }

    #[DataProvider('gapProvider')]
    public function testGapMinutes(int $s1, int $e1, int $s2, int $e2, int $expected): void
    {
        self::assertSame($expected, $this->rule->gapMinutes($s1, $e1, $s2, $e2));
    }

    public static function gapProvider(): iterable
    {
        // Chevauchement total
        yield 'overlap' => [7 * 60 + 30, 14 * 60, 10 * 60, 16 * 60, 0];
        // Coupure exacte 60 min
        yield 'exactly_60' => [7 * 60 + 30, 14 * 60, 15 * 60, 20 * 60 + 15, 60];
        // Coupure insuffisante 30 min
        yield 'gap_30' => [7 * 60 + 30, 14 * 60, 14 * 60 + 30, 20 * 60 + 15, 30];
        // Second créneau avant le premier
        yield 'before' => [15 * 60, 20 * 60, 7 * 60 + 30, 14 * 60, 60];
    }

    public function testValidateRejectsBreakShorterThanOneHour(): void
    {
        $error = $this->rule->validateAgainstSlots(
            new \DateTimeImmutable('15:00'),
            new \DateTimeImmutable('20:15'),
            [[
                'startTime' => new \DateTimeImmutable('07:30'),
                'endTime' => new \DateTimeImmutable('14:30'),
            ]],
        );

        self::assertNotNull($error);
        self::assertStringContainsString('au moins 1h', $error);
        self::assertStringContainsString('07:30-14:30', $error);
    }

    public function testValidateAcceptsBreakOfExactlyOneHour(): void
    {
        $error = $this->rule->validateAgainstSlots(
            new \DateTimeImmutable('15:00'),
            new \DateTimeImmutable('20:15'),
            [[
                'startTime' => new \DateTimeImmutable('07:30'),
                'endTime' => new \DateTimeImmutable('14:00'),
            ]],
        );

        self::assertNull($error);
    }

    public function testValidateAcceptsWhenNoOtherSlots(): void
    {
        self::assertNull($this->rule->validateAgainstSlots(
            new \DateTimeImmutable('07:30'),
            new \DateTimeImmutable('14:00'),
            [],
        ));
    }

    public function testTimeToMinutes(): void
    {
        self::assertSame(7 * 60 + 30, $this->rule->timeToMinutes(new \DateTimeImmutable('07:30')));
        self::assertSame(20 * 60 + 15, $this->rule->timeToMinutes(new \DateTimeImmutable('20:15')));
    }
}
