<?php

namespace App\Service;

use App\Enum\InsightSeverity;
use App\Enum\InsightType;

/**
 * Mode de secours local (règles simples) utilisé quand le micro-service IA
 * est indisponible. Logique pure sur des structures de données, testable en TDD.
 */
class LocalPlanningAnalyzer
{
    private const MIN_HOTES_SIMULTANES = 1;

    /**
     * @param list<array{userId: int, workDate: string}> $plannings
     * @param list<array{userId: int}>                  $ongoingPauses
     *
     * @return list<array{type: string, severity: string, targetDate: string, message: string, payload?: array}>
     */
    public function analyze(
        \DateTimeImmutable $from,
        \DateTimeImmutable $to,
        array $plannings,
        array $ongoingPauses,
        ?\DateTimeImmutable $today = null,
    ): array {
        $insights = [];
        $today ??= new \DateTimeImmutable('today');

        $byDate = [];
        foreach ($plannings as $planning) {
            $byDate[$planning['workDate']][] = $planning;
        }

        $cursor = $from;
        while ($cursor <= $to) {
            $dateKey = $cursor->format('Y-m-d');
            $dayPlannings = $byDate[$dateKey] ?? [];
            $count = count(array_unique(array_map(static fn (array $p) => $p['userId'], $dayPlannings)));

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

        $todayKey = $today->format('Y-m-d');
        $plannedTodayIds = [];
        foreach ($plannings as $planning) {
            if ($planning['workDate'] === $todayKey) {
                $plannedTodayIds[$planning['userId']] = true;
            }
        }
        $plannedCount = count($plannedTodayIds);
        $pauseCount = count($ongoingPauses);

        if ($pauseCount > 0 && $plannedCount > 0 && $pauseCount === $plannedCount) {
            $pauseUserIds = array_unique(array_map(static fn (array $p) => $p['userId'], $ongoingPauses));
            $allOnBreak = count(array_diff(array_keys($plannedTodayIds), $pauseUserIds)) === 0;

            if ($allOnBreak) {
                $insights[] = [
                    'type' => InsightType::CONFLIT_PAUSE->value,
                    'severity' => InsightSeverity::CRITIQUE->value,
                    'targetDate' => $todayKey,
                    'message' => "Tous les hôtes/hôtesses planifié(e)s aujourd'hui sont actuellement en pause simultanément : l'accueil n'est plus couvert.",
                    'payload' => ['nbEnPause' => $pauseCount],
                ];
            }
        }

        return $insights;
    }
}
