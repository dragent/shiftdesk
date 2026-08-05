<?php

namespace App\Controller\Api;

use App\Entity\StoreClosure;
use App\Entity\User;
use App\Enum\HalfDay;
use App\Repository\StoreClosureRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Serializer\SerializerInterface;

#[Route('/api/store-closures')]
class StoreClosureController extends AbstractApiController
{
    public function __construct(
        SerializerInterface $serializer,
        private readonly StoreClosureRepository $storeClosureRepository,
        private readonly EntityManagerInterface $em,
    ) {
        parent::__construct($serializer);
    }

    #[Route('', name: 'api_store_closures_list', methods: ['GET'])]
    public function list(Request $request): JsonResponse
    {
        $from = $request->query->get('from');
        $to = $request->query->get('to');

        $fromDate = $from ? new \DateTimeImmutable($from) : new \DateTimeImmutable('monday this week');
        $toDate = $to ? new \DateTimeImmutable($to) : $fromDate->modify('+6 days');

        $closures = $this->storeClosureRepository->findOverlapping($fromDate, $toDate);

        return $this->respond($closures, 200, ['closure:read', 'user:read']);
    }

    #[Route('', name: 'api_store_closures_create', methods: ['POST'])]
    public function create(Request $request, #[CurrentUser] User $currentUser): JsonResponse
    {
        $data = $this->decode($request->getContent());

        if (empty($data['startDate']) || empty($data['endDate']) || empty($data['startHalfDay'])) {
            return $this->respondError('startDate, startHalfDay et endDate sont obligatoires.', 422);
        }

        $startHalfDay = HalfDay::tryFrom((string) $data['startHalfDay']);
        if (!$startHalfDay) {
            return $this->respondError('Demi-journée invalide (MATIN ou APRES_MIDI).', 422);
        }

        $startDate = new \DateTimeImmutable($data['startDate']);
        $endDate = new \DateTimeImmutable($data['endDate']);
        if ($endDate < $startDate) {
            return $this->respondError('La date de fin doit être postérieure ou égale à la date de début.', 422);
        }

        $closure = new StoreClosure();
        $closure->setStartDate($startDate);
        $closure->setStartHalfDay($startHalfDay);
        $closure->setEndDate($endDate);
        $closure->setCreatedBy($currentUser);

        $this->em->persist($closure);
        $this->em->flush();

        return $this->respond($closure, 201, ['closure:read', 'user:read']);
    }

    #[Route('/{id}', name: 'api_store_closures_delete', methods: ['DELETE'])]
    public function delete(int $id): JsonResponse
    {
        $closure = $this->storeClosureRepository->find($id);
        if (!$closure) {
            return $this->respondError('Fermeture introuvable', 404);
        }

        $this->em->remove($closure);
        $this->em->flush();

        return new JsonResponse(null, 204);
    }
}
