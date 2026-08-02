<?php

namespace App\Controller\Api;

use App\Entity\Absence;
use App\Entity\User;
use App\Enum\AbsenceReason;
use App\Repository\AbsenceRepository;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Serializer\SerializerInterface;

#[Route('/api/absences')]
class AbsenceController extends AbstractApiController
{
    public function __construct(
        SerializerInterface $serializer,
        private readonly AbsenceRepository $absenceRepository,
        private readonly UserRepository $userRepository,
        private readonly EntityManagerInterface $em,
    ) {
        parent::__construct($serializer);
    }

    #[Route('', name: 'api_absences_list', methods: ['GET'])]
    public function list(Request $request): JsonResponse
    {
        $from = $request->query->get('from');
        $to = $request->query->get('to');

        $fromDate = $from ? new \DateTimeImmutable($from) : new \DateTimeImmutable('monday this week');
        $toDate = $to ? new \DateTimeImmutable($to) : $fromDate->modify('+6 days');

        $absences = $this->absenceRepository->findOverlapping($fromDate, $toDate);

        return $this->respond($absences, 200, ['absence:read', 'user:read']);
    }

    #[Route('', name: 'api_absences_create', methods: ['POST'])]
    public function create(Request $request, #[CurrentUser] User $currentUser): JsonResponse
    {
        $data = $this->decode($request->getContent());

        $user = $this->userRepository->find($data['userId'] ?? 0);
        if (!$user) {
            return $this->respondError("L'employé sélectionné est introuvable.", 404);
        }

        $reason = AbsenceReason::tryFrom((string) ($data['reason'] ?? ''));
        if (!$reason) {
            return $this->respondError('Raison d\'absence invalide (ARRET_TRAVAIL ou CONGE).', 422);
        }

        if (empty($data['startDate']) || empty($data['endDate'])) {
            return $this->respondError('startDate et endDate sont obligatoires.', 422);
        }

        $startDate = new \DateTimeImmutable($data['startDate']);
        $endDate = new \DateTimeImmutable($data['endDate']);
        if ($endDate < $startDate) {
            return $this->respondError('La date de fin doit être postérieure ou égale à la date de début.', 422);
        }

        $startTime = null;
        $endTime = null;
        if ($reason === AbsenceReason::ARRET_TRAVAIL) {
            if (empty($data['startTime']) || empty($data['endTime'])) {
                return $this->respondError('Les horaires de début et de fin sont obligatoires pour un arrêt de travail.', 422);
            }
            if (!preg_match('/^\d{2}:\d{2}$/', (string) $data['startTime'])
                || !preg_match('/^\d{2}:\d{2}$/', (string) $data['endTime'])) {
                return $this->respondError('Format d\'horaire invalide (attendu HH:mm).', 422);
            }
            $startTime = new \DateTimeImmutable($data['startTime']);
            $endTime = new \DateTimeImmutable($data['endTime']);
            if ($startDate->format('Y-m-d') === $endDate->format('Y-m-d') && $endTime <= $startTime) {
                return $this->respondError('L\'heure de fin doit être postérieure à l\'heure de début le même jour.', 422);
            }
        }

        $absence = new Absence();
        $absence->setUser($user);
        $absence->setReason($reason);
        $absence->setStartDate($startDate);
        $absence->setEndDate($endDate);
        $absence->setStartTime($startTime);
        $absence->setEndTime($endTime);
        $absence->setCreatedBy($currentUser);

        $this->em->persist($absence);
        $this->em->flush();

        return $this->respond($absence, 201, ['absence:read', 'user:read']);
    }

    #[Route('/{id}', name: 'api_absences_delete', methods: ['DELETE'])]
    public function delete(int $id): JsonResponse
    {
        $absence = $this->absenceRepository->find($id);
        if (!$absence) {
            return $this->respondError('Absence introuvable', 404);
        }

        $this->em->remove($absence);
        $this->em->flush();

        return new JsonResponse(null, 204);
    }
}
