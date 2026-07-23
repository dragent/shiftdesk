<?php

namespace App\Tests\Unit\Service;

use App\Enum\InsightSeverity;
use App\Enum\InsightType;
use App\Service\LocalPlanningAnalyzer;
use PHPUnit\Framework\TestCase;

final class LocalPlanningAnalyzerTest extends TestCase
{
    private LocalPlanningAnalyzer $analyzer;

    protected function setUp(): void
    {
        $this->analyzer = new LocalPlanningAnalyzer();
    }

    public function testDetectsSousEffectifWhenNoPlanning(): void
    {
        $from = new \DateTimeImmutable('2026-07-20');
        $to = new \DateTimeImmutable('2026-07-21');

        $insights = $this->analyzer->analyze($from, $to, [], [], $from);

        self::assertCount(2, $insights);
        self::assertSame(InsightType::SOUS_EFFECTIF->value, $insights[0]['type']);
        self::assertSame(InsightSeverity::ATTENTION->value, $insights[0]['severity']);
        self::assertSame('2026-07-20', $insights[0]['targetDate']);
    }

    public function testNoSousEffectifWhenStaffed(): void
    {
        $from = new \DateTimeImmutable('2026-07-20');
        $to = new \DateTimeImmutable('2026-07-20');

        $insights = $this->analyzer->analyze($from, $to, [
            ['userId' => 1, 'workDate' => '2026-07-20'],
            ['userId' => 2, 'workDate' => '2026-07-20'],
        ], [], $from);

        $types = array_column($insights, 'type');
        self::assertNotContains(InsightType::SOUS_EFFECTIF->value, $types);
    }

    public function testDetectsConflitPauseWhenAllPlannedStaffOnBreak(): void
    {
        $today = new \DateTimeImmutable('2026-07-23');

        $insights = $this->analyzer->analyze(
            $today,
            $today,
            [
                ['userId' => 10, 'workDate' => '2026-07-23'],
                ['userId' => 11, 'workDate' => '2026-07-23'],
            ],
            [
                ['userId' => 10],
                ['userId' => 11],
            ],
            $today,
        );

        $conflits = array_values(array_filter(
            $insights,
            static fn (array $i) => $i['type'] === InsightType::CONFLIT_PAUSE->value,
        ));

        self::assertCount(1, $conflits);
        self::assertSame(InsightSeverity::CRITIQUE->value, $conflits[0]['severity']);
        self::assertSame(2, $conflits[0]['payload']['nbEnPause']);
    }

    public function testNoConflitPauseWhenAtLeastOneHostRemains(): void
    {
        $today = new \DateTimeImmutable('2026-07-23');

        $insights = $this->analyzer->analyze(
            $today,
            $today,
            [
                ['userId' => 10, 'workDate' => '2026-07-23'],
                ['userId' => 11, 'workDate' => '2026-07-23'],
            ],
            [
                ['userId' => 10],
            ],
            $today,
        );

        $types = array_column($insights, 'type');
        self::assertNotContains(InsightType::CONFLIT_PAUSE->value, $types);
    }
}
