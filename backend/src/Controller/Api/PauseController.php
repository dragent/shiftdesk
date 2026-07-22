<?php

namespace App\Controller\Api;

use App\Entity\Pause;
use App\Entity\User;
use App\Enum\PauseType;
use App\Repository\PauseRepository;
use App\Repository\PlanningRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Serializer\SerializerInterface;

/**
 * Gestion des pauses en temps réel par les hôtes/hôtesses d'accueil.
 * - POST /api/pauses/start  : démarre une pause pour l'utilisateur courant
 * - POST /api/pauses/{id}/end : termine une pause en cours
 * - GET  /api/pauses/ongoing  : liste des pauses en cours (vue Direction)
 */
#[Route('/api/pauses')]
class PauseController extends AbstractApiController
{
    public function __construct(
        SerializerInterface $serializer,
        private readonly PauseRepository $pauseRepository,
        private readonly PlanningRepository $planningRepository,
        private readonly EntityManagerInterface $em,
    ) {
        parent::__construct($serializer);
    }

    #[Route('', name: 'api_pauses_list', methods: ['GET'])]
    public function list(Request $request, #[CurrentUser] User $currentUser): JsonResponse
    {
        $mine = $request->query->getBoolean('mine', false);
        $criteria = ($mine || $this->isHoteOnly($currentUser)) ? ['user' => $currentUser] : [];

        $pauses = $this->pauseRepository->findBy($criteria, ['startedAt' => 'DESC'], 100);

        return $this->respond($pauses, 200, ['pause:read', 'user:read', 'site:read']);
    }

    #[Route('/ongoing', name: 'api_pauses_ongoing', methods: ['GET'])]
    public function ongoing(): JsonResponse
    {
        return $this->respond($this->pauseRepository->findOngoing(), 200, ['pause:read', 'user:read', 'site:read']);
    }

    #[Route('/start', name: 'api_pauses_start', methods: ['POST'])]
    public function start(Request $request, #[CurrentUser] User $currentUser): JsonResponse
    {
        if ($this->pauseRepository->findOngoingForUser($currentUser)) {
            return $this->respondError('Une pause est déjà en cours.', 409);
        }

        $data = $this->decode($request->getContent());
        $type = PauseType::tryFrom($data['type'] ?? 'COURTE') ?? PauseType::COURTE;

        $pause = new Pause();
        $pause->setUser($currentUser);
        $pause->setType($type);

        if (!empty($data['planningId'])) {
            $planning = $this->planningRepository->find($data['planningId']);
            if ($planning) {
                $pause->setPlanning($planning);
            }
        }

        $this->em->persist($pause);
        $this->em->flush();

        return $this->respond($pause, 201, ['pause:read', 'user:read', 'site:read']);
    }

    #[Route('/{id}/end', name: 'api_pauses_end', methods: ['POST'])]
    public function end(int $id, #[CurrentUser] User $currentUser): JsonResponse
    {
        $pause = $this->pauseRepository->find($id);
        if (!$pause) {
            return $this->respondError('Pause introuvable', 404);
        }

        if ($pause->getUser()->getId() !== $currentUser->getId() && !$this->isGranted('ROLE_DIRECTION') && !$this->isGranted('ROLE_ADMIN')) {
            return $this->respondError("Vous ne pouvez terminer que vos propres pauses.", 403);
        }

        $pause->end();
        $this->em->flush();

        return $this->respond($pause, 200, ['pause:read', 'user:read', 'site:read']);
    }

    private function isHoteOnly(User $user): bool
    {
        return in_array('ROLE_HOTE', $user->getRoles(), true)
            && !in_array('ROLE_DIRECTION', $user->getRoles(), true)
            && !in_array('ROLE_ADMIN', $user->getRoles(), true);
    }
}
