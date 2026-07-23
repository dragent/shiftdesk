<?php

namespace App\Controller\Api;

use App\Entity\Pause;
use App\Entity\User;
use App\Enum\PauseType;
use App\Enum\UserRole;
use App\Repository\PauseRepository;
use App\Repository\PlanningRepository;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Serializer\SerializerInterface;

/**
 * Gestion des pauses des caissiers/caissières, saisies en temps réel par
 * l'accueil (hôte/hôtesse) ou la direction.
 * - GET  /api/pauses          : pauses de TOUS les caissiers pour une
 *                                journée donnée (par défaut aujourd'hui).
 *                                Utiliser ?date=YYYY-MM-DD pour un autre jour.
 * - POST /api/pauses/start    : démarre la pause d'un caissier (caissierId)
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
        private readonly UserRepository $userRepository,
        private readonly EntityManagerInterface $em,
    ) {
        parent::__construct($serializer);
    }

    private const GROUPS = ['pause:read', 'user:read', 'site:read'];

    #[Route('', name: 'api_pauses_list', methods: ['GET'])]
    public function list(Request $request): JsonResponse
    {
        $dateParam = $request->query->get('date');
        $date = $dateParam ? new \DateTimeImmutable($dateParam) : new \DateTimeImmutable('today');
        $pauses = $this->pauseRepository->findForDate($date);

        return $this->respond($pauses, 200, self::GROUPS);
    }

    #[Route('/ongoing', name: 'api_pauses_ongoing', methods: ['GET'])]
    public function ongoing(): JsonResponse
    {
        return $this->respond($this->pauseRepository->findOngoing(), 200, self::GROUPS);
    }

    #[Route('/start', name: 'api_pauses_start', methods: ['POST'])]
    public function start(Request $request, #[CurrentUser] User $currentUser): JsonResponse
    {
        $data = $this->decode($request->getContent());

        $caissierId = $data['caissierId'] ?? null;
        if (!$caissierId) {
            return $this->respondError('Le caissier est obligatoire.', 422);
        }

        $caissier = $this->userRepository->find($caissierId);
        if (!$caissier || !$caissier->hasRole(UserRole::CAISSIER)) {
            return $this->respondError('Caissier introuvable.', 404);
        }

        if ($this->pauseRepository->findOngoingForUser($caissier)) {
            return $this->respondError('Ce caissier est déjà en pause.', 409);
        }

        $type = PauseType::tryFrom($data['type'] ?? 'COURTE') ?? PauseType::COURTE;

        $pause = new Pause();
        $pause->setUser($caissier);
        $pause->setDeclaredBy($currentUser);
        $pause->setType($type);

        if (!empty($data['planningId'])) {
            $planning = $this->planningRepository->find($data['planningId']);
            if ($planning) {
                $pause->setPlanning($planning);
            }
        }

        $this->em->persist($pause);
        $this->em->flush();

        return $this->respond($pause, 201, self::GROUPS);
    }

    #[Route('/{id}/end', name: 'api_pauses_end', methods: ['POST'])]
    public function end(int $id): JsonResponse
    {
        $pause = $this->pauseRepository->find($id);
        if (!$pause) {
            return $this->respondError('Pause introuvable', 404);
        }

        if (null !== $pause->getEndedAt()) {
            return $this->respondError('Cette pause est déjà terminée.', 409);
        }

        $pause->end();
        $this->em->flush();

        return $this->respond($pause, 200, self::GROUPS);
    }
}
