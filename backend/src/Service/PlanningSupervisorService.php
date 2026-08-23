<?php

namespace App\Service;

use App\Entity\Pause;
use App\Entity\Planning;
use App\Entity\PlanningInsight;
use App\Entity\Site;
use App\Enum\InsightSeverity;
use App\Enum\InsightType;
use App\Enum\PauseStatus;
use App\Repository\PauseRepository;
use App\Repository\PlanningRepository;
use App\Repository\SiteRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * Integration point between the Symfony backend and the "schedule
 * supervision" AI module.
 *
 * Behaviour:
 *  1. The AI micro-service (ai-service/, see AI_SERVICE_URL) is called first,
 *     with the schedules and breaks of the requested period.
 *  2. If the micro-service is unavailable (not developed yet, work in
 *     progress, etc.), simple local rules are used instead
 *     (fallbackAnalyze) so that the feature stays usable and the
 *     "AI supervision" UI always has relevant content.
 *
 * Once the real AI component (ML, footfall forecasting, etc.) is ready, it
 * only has to be exposed through ai-service/: no change is required on the
 * frontend or in the controller.
 */
class PlanningSupervisorService
{
    public function __construct(
        private readonly HttpClientInterface $httpClient,
        private readonly PlanningRepository $planningRepository,
        private readonly PauseRepository $pauseRepository,
        private readonly SiteRepository $siteRepository,
        private readonly EntityManagerInterface $em,
        private readonly LoggerInterface $logger,
        private readonly LocalPlanningAnalyzer $localPlanningAnalyzer,
        private readonly string $aiServiceUrl,
    ) {
    }

    /**
     * Analyzes the [from, to] period (optionally restricted to a site) and
     * persists the detected PlanningInsight entries. Returns the created insights.
     *
     * @return PlanningInsight[]
     */
    public function analyze(\DateTimeImmutable $from, \DateTimeImmutable $to, ?int $siteId = null): array
    {
        $plannings = $this->planningRepository->findBetweenDates($from, $to, $siteId);
        $pauses = $this->pauseRepository->findBy(['status' => PauseStatus::EN_COURS]);
        $site = $siteId ? $this->siteRepository->find($siteId) : null;

        $remoteResult = $this->callRemoteAiService($from, $to, $plannings, $pauses, $siteId);

        $insightsData = $remoteResult ?? $this->fallbackAnalyze($from, $to, $plannings, $pauses);

        $created = [];
        foreach ($insightsData as $item) {
            $insight = new PlanningInsight(
                InsightType::tryFrom($item['type']) ?? InsightType::AUTRE,
                InsightSeverity::tryFrom($item['severity']) ?? InsightSeverity::INFO,
                new \DateTimeImmutable($item['targetDate']),
                $item['message'],
            );
            $insight->setPayload($item['payload'] ?? null);
            if ($site instanceof Site) {
                $insight->setSite($site);
            }
            $this->em->persist($insight);
            $created[] = $insight;
        }

        if ($created) {
            $this->em->flush();
        }

        return $created;
    }

    /**
     * Attempts to call the AI micro-service. Returns null when it is
     * unavailable, so that the local fallback is triggered.
     *
     * @param Planning[] $plannings
     * @param Pause[]    $pauses
     *
     * @return array<int, array{type: string, severity: string, targetDate: string, message: string, payload?: array}>|null
     */
    private function callRemoteAiService(
        \DateTimeImmutable $from,
        \DateTimeImmutable $to,
        array $plannings,
        array $pauses,
        ?int $siteId,
    ): ?array {
        try {
            $response = $this->httpClient->request('POST', rtrim($this->aiServiceUrl, '/').'/analyze-planning', [
                'json' => [
                    'from' => $from->format('Y-m-d'),
                    'to' => $to->format('Y-m-d'),
                    'siteId' => $siteId,
                    'plannings' => array_map(static fn (Planning $p) => [
                        'userId' => $p->getUser()->getId(),
                        'workDate' => $p->getWorkDate()->format('Y-m-d'),
                        'startTime' => $p->getStartTime()->format('H:i'),
                        'endTime' => $p->getEndTime()->format('H:i'),
                        'status' => $p->getStatus()->value,
                    ], $plannings),
                    'ongoingPauses' => array_map(static fn (Pause $pause) => [
                        'userId' => $pause->getUser()->getId(),
                        'type' => $pause->getType()->value,
                        'startedAt' => $pause->getStartedAt()->format(DATE_ATOM),
                    ], $pauses),
                ],
                'timeout' => 3.0,
            ]);

            if (200 !== $response->getStatusCode()) {
                return null;
            }

            $data = $response->toArray(false);

            return $data['insights'] ?? null;
        } catch (\Throwable $e) {
            $this->logger->info('Micro-service IA indisponible, utilisation du fallback local.', [
                'exception' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Simple local rules used when the AI micro-service is not available
     * (delegates to {@see LocalPlanningAnalyzer}).
     *
     * @param Planning[] $plannings
     * @param Pause[]    $ongoingPauses
     *
     * @return array<int, array{type: string, severity: string, targetDate: string, message: string, payload?: array}>
     */
    private function fallbackAnalyze(\DateTimeImmutable $from, \DateTimeImmutable $to, array $plannings, array $ongoingPauses): array
    {
        return $this->localPlanningAnalyzer->analyze(
            $from,
            $to,
            array_map(static fn (Planning $p) => [
                'userId' => (int) $p->getUser()->getId(),
                'workDate' => $p->getWorkDate()->format('Y-m-d'),
            ], $plannings),
            array_map(static fn (Pause $pause) => [
                'userId' => (int) $pause->getUser()->getId(),
            ], $ongoingPauses),
        );
    }
}
