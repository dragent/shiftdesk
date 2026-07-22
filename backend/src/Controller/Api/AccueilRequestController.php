<?php

namespace App\Controller\Api;

use App\Entity\AccueilRequest;
use App\Entity\User;
use App\Enum\DemandeStatus;
use App\Repository\AccueilRequestRepository;
use App\Repository\RequestCategoryRepository;
use App\Repository\SiteRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Serializer\SerializerInterface;

/**
 * Demandes/interactions traitées à l'accueil, classées via le dropdown
 * de catégories (RequestCategory : Caroline / Siebel / Menu Carrefour...).
 */
#[Route('/api/requests')]
class AccueilRequestController extends AbstractApiController
{
    public function __construct(
        SerializerInterface $serializer,
        private readonly AccueilRequestRepository $requestRepository,
        private readonly RequestCategoryRepository $categoryRepository,
        private readonly SiteRepository $siteRepository,
        private readonly EntityManagerInterface $em,
    ) {
        parent::__construct($serializer);
    }

    #[Route('', name: 'api_requests_list', methods: ['GET'])]
    public function list(Request $request): JsonResponse
    {
        $limit = $request->query->getInt('limit', 50);

        return $this->respond(
            $this->requestRepository->findRecent($limit),
            200,
            ['request:read', 'user:read', 'category:read', 'site:read']
        );
    }

    #[Route('', name: 'api_requests_create', methods: ['POST'])]
    public function create(Request $request, #[CurrentUser] User $currentUser): JsonResponse
    {
        $data = $this->decode($request->getContent());

        $category = $this->categoryRepository->find($data['categoryId'] ?? 0);
        if (!$category) {
            return $this->respondError('Catégorie de demande introuvable ou non fournie.', 422);
        }

        if (empty($data['subject'])) {
            return $this->respondError('Le sujet de la demande est obligatoire.', 422);
        }

        $accueilRequest = new AccueilRequest();
        $accueilRequest->setHote($currentUser);
        $accueilRequest->setCategory($category);
        $accueilRequest->setSubject($data['subject']);
        $accueilRequest->setDescription($data['description'] ?? null);
        $accueilRequest->setVisitorName($data['visitorName'] ?? null);

        if (!empty($data['siteId'])) {
            $site = $this->siteRepository->find($data['siteId']);
            if ($site) {
                $accueilRequest->setSite($site);
            }
        } elseif ($currentUser->getSite()) {
            $accueilRequest->setSite($currentUser->getSite());
        }

        $this->em->persist($accueilRequest);
        $this->em->flush();

        return $this->respond($accueilRequest, 201, ['request:read', 'user:read', 'category:read', 'site:read']);
    }

    #[Route('/{id}', name: 'api_requests_update', methods: ['PUT', 'PATCH'])]
    public function update(int $id, Request $request): JsonResponse
    {
        $accueilRequest = $this->requestRepository->find($id);
        if (!$accueilRequest) {
            return $this->respondError('Demande introuvable', 404);
        }

        $data = $this->decode($request->getContent());

        if (array_key_exists('status', $data)) {
            $status = DemandeStatus::tryFrom($data['status']);
            if (!$status) {
                return $this->respondError('Statut invalide.', 422);
            }
            $accueilRequest->setStatus($status);
        }
        if (array_key_exists('description', $data)) {
            $accueilRequest->setDescription($data['description']);
        }
        if (array_key_exists('categoryId', $data)) {
            $category = $this->categoryRepository->find($data['categoryId']);
            if ($category) {
                $accueilRequest->setCategory($category);
            }
        }

        $this->em->flush();

        return $this->respond($accueilRequest, 200, ['request:read', 'user:read', 'category:read', 'site:read']);
    }
}
