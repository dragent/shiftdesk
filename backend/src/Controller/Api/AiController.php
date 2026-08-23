<?php

namespace App\Controller\Api;

use App\Enum\InsightStatus;
use App\Repository\PlanningInsightRepository;
use App\Service\PlanningSupervisorService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Serializer\SerializerInterface;

/**
 * AI module — schedule supervision.
 *
 * Reserved for the AI component assisting Management: automatic detection of
 * schedule anomalies (understaffing, overload, break conflicts, etc.). The
 * actual computation is delegated to PlanningSupervisorService, which queries
 * the ai-service/ micro-service (still to be developed/extended) and falls
 * back to simple rules when it is unavailable.
 */
#[Route('/api/ai')]
class AiController extends AbstractApiController
{
    public function __construct(
        SerializerInterface $serializer,
        private readonly PlanningInsightRepository $insightRepository,
        private readonly PlanningSupervisorService $supervisor,
        private readonly EntityManagerInterface $em,
    ) {
        parent::__construct($serializer);
    }

    #[Route('/insights', name: 'api_ai_insights_list', methods: ['GET'])]
    public function list(Request $request): JsonResponse
    {
        $siteId = $request->query->get('siteId');

        return $this->respond(
            $this->insightRepository->findActive($siteId ? (int) $siteId : null),
            200,
            ['insight:read', 'site:read']
        );
    }

    #[Route('/analyze', name: 'api_ai_analyze', methods: ['POST'])]
    public function analyze(Request $request): JsonResponse
    {
        $data = $this->decode($request->getContent());

        $from = !empty($data['from']) ? new \DateTimeImmutable($data['from']) : new \DateTimeImmutable('monday this week');
        $to = !empty($data['to']) ? new \DateTimeImmutable($data['to']) : $from->modify('+6 days');
        $siteId = isset($data['siteId']) ? (int) $data['siteId'] : null;

        $insights = $this->supervisor->analyze($from, $to, $siteId);

        return $this->respond($insights, 201, ['insight:read', 'site:read']);
    }

    #[Route('/insights/{id}', name: 'api_ai_insight_update', methods: ['PATCH'])]
    public function updateStatus(int $id, Request $request): JsonResponse
    {
        $insight = $this->insightRepository->find($id);
        if (!$insight) {
            return $this->respondError('Alerte introuvable', 404);
        }

        $data = $this->decode($request->getContent());
        $status = InsightStatus::tryFrom($data['status'] ?? '');
        if (!$status) {
            return $this->respondError('Statut invalide.', 422);
        }

        $insight->setStatus($status);
        $this->em->flush();

        return $this->respond($insight, 200, ['insight:read', 'site:read']);
    }
}
