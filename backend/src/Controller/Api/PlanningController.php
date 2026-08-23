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
 * Weekly schedule created by Management for every employee (reception hosts
 * and cashiers). Only Management (and Admin) may create, update or delete
 * slots (see security.yaml for write access). On read, each employee (host or
 * cashier) only sees their own personal schedule — Management/Admin sees
 * everyone.
 *
 * The "register layout" (register number assigned to a cashier slot) is an
 * exception to that write rule: it can be edited by reception (host) in
 * addition to Management/Admin, through the dedicated endpoint
 * {@see self::setRegisterNumber()}.
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
        // "Register layout" view: reception (host) needs to see the slots of
        // every cashier (not only their own) in order to assign them a
        // register number.
        $caissiersOnly = $request->query->getBoolean('caissiersOnly', false);
        // Register layout view (printing): reception also needs to know which
        // LAD is on duty for each half-day, without diluting the register grid
        // (dedicated parameter, parallel to caissiersOnly).
        $ladOnly = $request->query->getBoolean('ladOnly', false);

        $from = $from ? new \DateTimeImmutable($from) : new \DateTimeImmutable('monday this week');
        $to = $to ? new \DateTimeImmutable($to) : $from->modify('+6 days');

        $plannings = $this->planningRepository->findBetweenDates($from, $to, $siteId ? (int) $siteId : null);

        $isDirectionOrAdmin = $this->isGranted('ROLE_DIRECTION') || $this->isGranted('ROLE_ADMIN');

        if ($caissiersOnly) {
            // Cashiers plus LAD/hosts explicitly flagged as "on register".
            $plannings = array_values(array_filter(
                $plannings,
                static fn (Planning $p) => $p->getUser()->hasRole(UserRole::CAISSIER) || $p->isEnCaisse(),
            ));
        } elseif ($ladOnly) {
            $plannings = array_values(array_filter(
                $plannings,
                static fn (Planning $p) => $p->getUser()->hasRole(UserRole::LAD),
            ));
        } elseif ($mine || !$isDirectionOrAdmin) {
            // Only Management/Admin sees everyone's schedule. Any other
            // employee (host or cashier) only sees their own personal
            // schedule, even without the "mine" parameter.
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

        $enCaisse = !empty($data['enCaisse']);
        $enCaisseError = $this->validateEnCaisse($user, $enCaisse);
        if ($enCaisseError) {
            return $this->respondError($enCaisseError, 422);
        }

        $planning = new Planning();
        $planning->setUser($user);
        $planning->setWorkDate($workDate);
        $planning->setStartTime($startTime);
        $planning->setEndTime($endTime);
        $planning->setNote($data['note'] ?? null);
        $planning->setEnCaisse($enCaisse);
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
        if (array_key_exists('enCaisse', $data)) {
            $enCaisse = (bool) $data['enCaisse'];
            $enCaisseError = $this->validateEnCaisse($planning->getUser(), $enCaisse);
            if ($enCaisseError) {
                return $this->respondError($enCaisseError, 422);
            }
            $planning->setEnCaisse($enCaisse);
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
     * "On register" is only allowed for LAD and reception hosts. For any other
     * role, a request setting it to true is rejected; false is always
     * accepted.
     */
    private function validateEnCaisse(User $user, bool $enCaisse): ?string
    {
        if (!$enCaisse) {
            return null;
        }

        if ($user->hasRole(UserRole::LAD) || $user->hasRole(UserRole::HOTE)) {
            return null;
        }

        return 'Seuls les LAD et hôtes/hôtesses d\'accueil peuvent être marqués en caisse.';
    }

    /**
     * Checks that there are at least {@see PlanningBreakRule::MIN_BREAK_MINUTES}
     * minutes of break between the given slot and any other slot already
     * scheduled for the same employee on the same day.
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
     * Assigns (or clears) a register assignment on an existing slot: either a
     * single assignment for the whole slot (`registerNumber`), or a switch
     * during the slot (`segments`, 2 or 3 time ranges). These two parameters
     * are mutually exclusive. Available to reception (host) in addition to
     * Management/Admin (see security.yaml), unlike the other schedule writes
     * which remain restricted to Management/Admin.
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
