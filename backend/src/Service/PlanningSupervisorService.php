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
 * Point d'intégration entre le back Symfony et le module IA de
 * "supervision de planning".
 *
 * Fonctionnement :
 *  1. On tente d'appeler le micro-service IA (ai-service/, cf. AI_SERVICE_URL)
 *     en lui envoyant les plannings + pauses de la période demandée.
 *  2. Si le micro-service est indisponible (pas encore développé, en cours
 *     de dev, etc.), on retombe sur des règles simples locales
 *     (fallbackAnalyze) afin que la fonctionnalité reste utilisable et que
 *     l'UI "Supervision IA" ait toujours un contenu pertinent.
 *
 * Quand la vraie brique IA (ML, prévision d'affluence, etc.) sera prête,
 * il suffira de l'exposer via ai-service/ : aucun changement nécessaire
 * côté front ni côté contrôleur.
 */
class PlanningSupervisorService
{
    private const MIN_HOTES_SIMULTANES = 1;

    public function __construct(
        private readonly HttpClientInterface $httpClient,
        private readonly PlanningRepository $planningRepository,
        private readonly PauseRepository $pauseRepository,
        private readonly SiteRepository $siteRepository,
        private readonly EntityManagerInterface $em,
        private readonly LoggerInterface $logger,
        private readonly string $aiServiceUrl,
    ) {
    }

    /**
     * Analyse la période [from, to] (et éventuellement un site) et persiste
     * les PlanningInsight détectés. Retourne la liste des insights créés.
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
     * Tente d'appeler le micro-service IA. Retourne null en cas
     * d'indisponibilité (pour déclencher le fallback local).
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
     * Règles simples locales utilisées quand le micro-service IA n'est pas
     * disponible : détection de sous-effectif (aucun hôte planifié un jour
     * donné) et de conflits (toutes les hôtes en pause simultanément).
     *
     * @param Planning[] $plannings
     * @param Pause[]    $ongoingPauses
     *
     * @return array<int, array{type: string, severity: string, targetDate: string, message: string, payload?: array}>
     */
    private function fallbackAnalyze(\DateTimeImmutable $from, \DateTimeImmutable $to, array $plannings, array $ongoingPauses): array
    {
        $insights = [];

        $byDate = [];
        foreach ($plannings as $planning) {
            $byDate[$planning->getWorkDate()->format('Y-m-d')][] = $planning;
        }

        $cursor = $from;
        while ($cursor <= $to) {
            $dateKey = $cursor->format('Y-m-d');
            $count = count($byDate[$dateKey] ?? []);

            if (0 === $count) {
                $insights[] = [
                    'type' => InsightType::SOUS_EFFECTIF->value,
                    'severity' => InsightSeverity::ATTENTION->value,
                    'targetDate' => $dateKey,
                    'message' => sprintf("Aucun hôte/hôtesse d'accueil n'est planifié le %s.", $cursor->format('d/m/Y')),
                    'payload' => ['effectif' => 0],
                ];
            } elseif ($count < self::MIN_HOTES_SIMULTANES) {
                $insights[] = [
                    'type' => InsightType::SOUS_EFFECTIF->value,
                    'severity' => InsightSeverity::INFO->value,
                    'targetDate' => $dateKey,
                    'message' => sprintf('Effectif réduit le %s (%d personne(s) planifiée(s)).', $cursor->format('d/m/Y'), $count),
                    'payload' => ['effectif' => $count],
                ];
            }

            $cursor = $cursor->modify('+1 day');
        }

        if (count($ongoingPauses) > 0 && count($ongoingPauses) === $this->countDistinctUsersPlannedToday($plannings)) {
            $insights[] = [
                'type' => InsightType::CONFLIT_PAUSE->value,
                'severity' => InsightSeverity::CRITIQUE->value,
                'targetDate' => (new \DateTimeImmutable())->format('Y-m-d'),
                'message' => "Tous les hôtes/hôtesses planifié(e)s aujourd'hui sont actuellement en pause simultanément : l'accueil n'est plus couvert.",
                'payload' => ['nbEnPause' => count($ongoingPauses)],
            ];
        }

        return $insights;
    }

    /**
     * @param Planning[] $plannings
     */
    private function countDistinctUsersPlannedToday(array $plannings): int
    {
        $today = (new \DateTimeImmutable())->format('Y-m-d');
        $ids = [];
        foreach ($plannings as $planning) {
            if ($planning->getWorkDate()->format('Y-m-d') === $today) {
                $ids[$planning->getUser()->getId()] = true;
            }
        }

        return count($ids);
    }
}
