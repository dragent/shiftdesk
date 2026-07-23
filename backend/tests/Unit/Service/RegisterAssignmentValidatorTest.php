<?php

namespace App\Tests\Unit\Service;

use App\Service\RegisterAssignmentValidator;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class RegisterAssignmentValidatorTest extends TestCase
{
    private RegisterAssignmentValidator $validator;

    protected function setUp(): void
    {
        $this->validator = new RegisterAssignmentValidator();
    }

    #[DataProvider('validRegisterProvider')]
    public function testValidRegisterNumbers(int $registerNumber): void
    {
        self::assertNull($this->validator->validateRegisterNumber($registerNumber));
    }

    public static function validRegisterProvider(): iterable
    {
        yield 'pauses_retour' => [-1];
        yield 'auto' => [0];
        yield 'caisse_1' => [1];
        yield 'caisse_8' => [8];
    }

    public function testNullRegisterNumberIsAllowed(): void
    {
        self::assertNull($this->validator->validateRegisterNumber(null));
    }

    public function testInvalidRegisterNumbersAreRejected(): void
    {
        self::assertNotNull($this->validator->validateRegisterNumber(-2));
        self::assertNotNull($this->validator->validateRegisterNumber(9));
    }

    public function testValidTwoSegmentSplit(): void
    {
        $result = $this->validator->validateSegments(
            [
                ['startTime' => '07:30', 'registerNumber' => 2],
                ['startTime' => '11:00', 'registerNumber' => 0],
            ],
            '07:30',
            '14:00',
        );

        self::assertNull($result['error']);
        self::assertCount(2, $result['normalized']);
        self::assertSame(0, $result['normalized'][1]['registerNumber']);
    }

    public function testRejectsPausesRetourInSplit(): void
    {
        $result = $this->validator->validateSegments(
            [
                ['startTime' => '07:30', 'registerNumber' => -1],
                ['startTime' => '11:00', 'registerNumber' => 1],
            ],
            '07:30',
            '14:00',
        );

        self::assertNotNull($result['error']);
        self::assertStringContainsString('0 (caisses automatiques)', $result['error']);
    }

    public function testRejectsNonIncreasingSwitchTimes(): void
    {
        $result = $this->validator->validateSegments(
            [
                ['startTime' => '07:30', 'registerNumber' => 1],
                ['startTime' => '07:30', 'registerNumber' => 2],
            ],
            '07:30',
            '14:00',
        );

        self::assertNotNull($result['error']);
        self::assertStringContainsString('strictement croissantes', $result['error']);
    }

    public function testRejectsWrongFirstSegmentStart(): void
    {
        $result = $this->validator->validateSegments(
            [
                ['startTime' => '08:00', 'registerNumber' => 1],
                ['startTime' => '11:00', 'registerNumber' => 2],
            ],
            '07:30',
            '14:00',
        );

        self::assertNotNull($result['error']);
        self::assertStringContainsString('première tranche', $result['error']);
    }

    public function testRejectsWrongSegmentCount(): void
    {
        $result = $this->validator->validateSegments(
            [['startTime' => '07:30', 'registerNumber' => 1]],
            '07:30',
            '14:00',
        );

        self::assertSame('Une bascule doit comporter 2 ou 3 tranches horaires.', $result['error']);
    }
}
