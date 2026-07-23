<?php

namespace App\Controller\Api;

use App\Entity\Planning;
use App\Entity\User;
use App\Enum\PlanningStatus;
use App\Enum\UserRole;
use App\Repository\PlanningRepository;
use App\Repository\SiteRepository;
use App\Repository\UserRepository;
use App\Service\PlanningBreakRule;
use App\Service\RegisterAssignmentValidator;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Serializer\SerializerInterface;

/**
 * Planning hebdomadaire créé par la Direction pour tous les employés
 * (hôtes/hôtesses d'accueil et caissiers/caissières). Seule la Direction
 * (et l'Admin) peut créer/modifier/supprimer des créneaux (cf.
 * security.yaml pour l'écriture). En lecture, chaque employé (hôte ou
 * caissier) ne voit que son propre planning personnel — la Direction/Admin
 * voit tout le monde.
 *
 * Le "plan de caisse" (numéro de caisse attribué à un créneau de caissier)
 * est une exception à cette règle d'écriture : il est modifiable par
 * l'accueil (hôte/hôtesse) en plus de la Direction/Admin, via l'endpoint
 * dédié {@see self::setRegisterNumber()}.
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
        private readonly PlanningBreakRule $planningBreakRule,
        private readonly RegisterAssignmentValidator $registerAssignmentValidator,
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
        // Vue "plan de caisse" : l'accueil (hôte) a besoin de voir les
        // créneaux de tous les caissiers/caissières (pas seulement les siens)
        // pour pouvoir leur attribuer un numéro de caisse.
        $caissiersOnly = $request->query->getBoolean('caissiersOnly', false);

        $from = $from ? new \DateTimeImmutable($from) : new \DateTimeImmutable('monday this week');
        $to = $to ? new \DateTimeImmutable($to) : $from->modify('+6 days');

        $plannings = $this->planningRepository->findBetweenDates($from, $to, $siteId ? (int) $siteId : null);

        $isDirectionOrAdmin = $this->isGranted('ROLE_DIRECTION') || $this->isGranted('ROLE_ADMIN');

        if ($caissiersOnly) {
            $plannings = array_values(array_filter($plannings, static fn (Planning $p) => $p->getUser()->hasRole(UserRole::CAISSIER)));
        } elseif ($mine || !$isDirectionOrAdmin) {
            // Seule la Direction/Admin voit le planning de tout le monde. Tout
            // autre employé (hôte ou caissier) ne voit que son planning
            // personnel, même sans le paramètre "mine".
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

        $workDate = new \DateTimeImmutable($data['workDate']);
        $startTime = new \DateTimeImmutable($data['startTime']);
        $endTime = new \DateTimeImmutable($data['endTime']);

        $breakError = $this->checkMinimumBreak($user, $workDate, $startTime, $endTime, null);
        if ($breakError) {
            return $this->respondError($breakError, 422);
        }

        $planning = new Planning();
        $planning->setUser($user);
        $planning->setWorkDate($workDate);
        $planning->setStartTime($startTime);
        $planning->setEndTime($endTime);
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

        if (array_key_exists('workDate', $data) || array_key_exists('startTime', $data) || array_key_exists('endTime', $data)) {
            $breakError = $this->checkMinimumBreak(
                $planning->getUser(),
                $planning->getWorkDate(),
                $planning->getStartTime(),
                $planning->getEndTime(),
                $planning->getId(),
            );
            if ($breakError) {
                return $this->respondError($breakError, 422);
            }
        }

        $planning->touch();
        $this->em->flush();

        return $this->respond($planning, 200, ['planning:read', 'user:read', 'site:read']);
    }

    /**
     * Vérifie qu'il y a au moins {@see PlanningBreakRule::MIN_BREAK_MINUTES}
     * minutes de coupure entre le créneau donné et tout autre créneau déjà
     * planifié pour le même employé le même jour.
     */
    private function checkMinimumBreak(
        User $user,
        \DateTimeImmutable $workDate,
        \DateTimeImmutable $startTime,
        \DateTimeImmutable $endTime,
        ?int $excludeId,
    ): ?string {
        $otherSlots = [];
        foreach ($this->planningRepository->findForUserAndDate((int) $user->getId(), $workDate, $excludeId) as $other) {
            $otherSlots[] = [
                'startTime' => $other->getStartTime(),
                'endTime' => $other->getEndTime(),
            ];
        }

        return $this->planningBreakRule->validateAgainstSlots($startTime, $endTime, $otherSlots);
    }

    /**
     * Attribue (ou retire) une affectation de caisse à un créneau existant :
     * soit une affectation simple pour tout le créneau (`registerNumber`),
     * soit une bascule en cours de créneau (`segments`, 2 ou 3 tranches
     * horaires). Ces deux paramètres sont mutuellement exclusifs. Accessible
     * à l'accueil (hôte/hôtesse) en plus de la Direction/Admin (cf.
     * security.yaml), contrairement aux autres écritures sur les plannings
     * qui restent réservées à la Direction/Admin.
     */
    #[Route('/{id}/register-number', name: 'api_plannings_set_register_number', methods: ['PATCH'])]
    public function setRegisterNumber(int $id, Request $request): JsonResponse
    {
        $planning = $this->planningRepository->find($id);
        if (!$planning) {
            return $this->respondError('Planning introuvable', 404);
        }

        $data = $this->decode($request->getContent());
        $hasSegments = array_key_exists('segments', $data) && $data['segments'] !== null;
        $hasRegisterNumber = array_key_exists('registerNumber', $data);

        if ($hasSegments) {
            $result = $this->registerAssignmentValidator->validateSegments(
                $data['segments'],
                $planning->getStartTime()->format('H:i'),
                $planning->getEndTime()->format('H:i'),
            );
            if (null !== $result['error']) {
                return $this->respondError($result['error'], 422);
            }

            $planning->setRegisterSegments($result['normalized']);
            $planning->setRegisterNumber(null);
        } elseif ($hasRegisterNumber) {
            $registerNumber = $data['registerNumber'];
            if (null !== $registerNumber) {
                $registerNumber = (int) $registerNumber;
                $error = $this->registerAssignmentValidator->validateRegisterNumber($registerNumber);
                if (null !== $error) {
                    return $this->respondError($error, 422);
                }
            }

            $planning->setRegisterNumber($registerNumber);
            $planning->setRegisterSegments(null);
        } else {
            return $this->respondError('registerNumber ou segments est obligatoire.', 422);
        }

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
