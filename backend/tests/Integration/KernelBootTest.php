<?php

namespace App\Tests\Integration;

use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

/**
 * Smoke test d'intégration : le kernel Symfony démarre correctement
 * en environnement de test (services autowirés, config valide).
 */
final class KernelBootTest extends KernelTestCase
{
    public function testKernelBoots(): void
    {
        self::bootKernel();

        self::assertTrue(self::$kernel->isDebug() || 'test' === self::$kernel->getEnvironment());
        self::assertSame('test', self::$kernel->getEnvironment());
    }

    public function testPlanningBreakRuleIsRegistered(): void
    {
        self::bootKernel();
        $container = static::getContainer();

        self::assertTrue($container->has(\App\Service\PlanningBreakRule::class));
        self::assertTrue($container->has(\App\Service\RegisterAssignmentValidator::class));
        self::assertTrue($container->has(\App\Service\LocalPlanningAnalyzer::class));
    }
}
