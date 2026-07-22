<?php

namespace App\Controller\Api;

use App\Entity\Planning;
use App\Entity\User;
use App\Enum\PlanningStatus;
use App\Repository\PlanningRepository;
use App\Repository\SiteRepository;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Serializer\SerializerInterface;

/**
 * Plannings créés par la Direction pour les hôtes/hôtesses d'accueil.
 * Un hôte/hôtesse ne voit/modifie que son propre planning (cf. filtre
 * "mine=1"), la Direction/Admin gère tout (cf. security.yaml).
 */
#[Route('/api/plannings')]
class PlanningController extends AbstractApiController
{
    public function __construct(
        SerializerInterface $serializer,
        private readonly PlanningRepository $planningRepository,
        private readonly UserRepository $userRepository,
        private readonly SiteRepository $siteRepository,
        private readonly EntityManagerInterface $em,
    ) {
        parent::__construct($serializer);
    }

    #[Route('', name: 'api_plannings_list', methods: ['GET'])]
    public function list(Request $request, #[CurrentUser] User $currentUser): JsonResponse
    {
        $from = $request->query->get('from');
        $to = $request->query->get('to');
        $siteId = $request->query->get('siteId');
        $mine = $request->query->getBoolean('mine', false);

        $from = $from ? new \DateTimeImmutable($from) : new \DateTimeImmutable('monday this week');
        $to = $to ? new \DateTimeImmutable($to) : $from->modify('+6 days');

        $plannings = $this->planningRepository->findBetweenDates($from, $to, $siteId ? (int) $siteId : null);

        if ($mine || $this->isGranted('ROLE_HOTE') && !$this->isGranted('ROLE_DIRECTION') && !$this->isGranted('ROLE_ADMIN')) {
            $plannings = array_values(array_filter($plannings, static fn (Planning $p) => $p->getUser()->getId() === $currentUser->getId()));
        }

        return $this->respond($plannings, 200, ['planning:read', 'user:read', 'site:read']);
    }

    #[Route('', name: 'api_plannings_create', methods: ['POST'])]
    public function create(Request $request, #[CurrentUser] User $currentUser): JsonResponse
    {
        $data = $this->decode($request->getContent());

        $user = $this->userRepository->find($data['userId'] ?? 0);
        if (!$user) {
            return $this->respondError("L'hôte/hôtesse sélectionné(e) est introuvable.", 404);
        }

        if (empty($data['workDate']) || empty($data['startTime']) || empty($data['endTime'])) {
            return $this->respondError('workDate, startTime et endTime sont obligatoires.', 422);
        }

        $planning = new Planning();
        $planning->setUser($user);
        $planning->setWorkDate(new \DateTimeImmutable($data['workDate']));
        $planning->setStartTime(new \DateTimeImmutable($data['startTime']));
        $planning->setEndTime(new \DateTimeImmutable($data['endTime']));
        $planning->setNote($data['note'] ?? null);
        $planning->setCreatedBy($currentUser);

        if (!empty($data['siteId'])) {
            $site = $this->siteRepository->find($data['siteId']);
            if ($site) {
                $planning->setSite($site);
            }
        } elseif ($user->getSite()) {
            $planning->setSite($user->getSite());
        }

        $this->em->persist($planning);
        $this->em->flush();

        return $this->respond($planning, 201, ['planning:read', 'user:read', 'site:read']);
    }

    #[Route('/{id}', name: 'api_plannings_update', methods: ['PUT', 'PATCH'])]
    public function update(int $id, Request $request): JsonResponse
    {
        $planning = $this->planningRepository->find($id);
        if (!$planning) {
            return $this->respondError('Planning introuvable', 404);
        }

        $data = $this->decode($request->getContent());

        if (array_key_exists('workDate', $data)) {
            $planning->setWorkDate(new \DateTimeImmutable($data['workDate']));
        }
        if (array_key_exists('startTime', $data)) {
            $planning->setStartTime(new \DateTimeImmutable($data['startTime']));
        }
        if (array_key_exists('endTime', $data)) {
            $planning->setEndTime(new \DateTimeImmutable($data['endTime']));
        }
        if (array_key_exists('note', $data)) {
            $planning->setNote($data['note']);
        }
        if (array_key_exists('status', $data)) {
            $status = PlanningStatus::tryFrom($data['status']);
            if (!$status) {
                return $this->respondError('Statut de planning invalide.', 422);
            }
            $planning->setStatus($status);
        }
        if (array_key_exists('siteId', $data)) {
            $site = $data['siteId'] ? $this->siteRepository->find($data['siteId']) : null;
            $planning->setSite($site);
        }

        $planning->touch();
        $this->em->flush();

        return $this->respond($planning, 200, ['planning:read', 'user:read', 'site:read']);
    }

    #[Route('/{id}', name: 'api_plannings_delete', methods: ['DELETE'])]
    public function delete(int $id): JsonResponse
    {
        $planning = $this->planningRepository->find($id);
        if (!$planning) {
            return $this->respondError('Planning introuvable', 404);
        }

        $this->em->remove($planning);
        $this->em->flush();

        return new JsonResponse(null, 204);
    }
}
