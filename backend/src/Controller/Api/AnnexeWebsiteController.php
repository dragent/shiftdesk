<?php

namespace App\Controller\Api;

use App\Entity\AnnexeWebsite;
use App\Entity\User;
use App\Repository\AnnexeWebsiteRepository;
use App\Security\AnnexeAccess;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Serializer\SerializerInterface;
use Symfony\Component\Validator\Validator\ValidatorInterface;

/**
 * Store annex websites. Direction/Admin create and delete them.
 * Other jobs only see websites whose allowedRoles include theirs.
 */
#[Route('/api/annexe/websites')]
class AnnexeWebsiteController extends AbstractApiController
{
    public function __construct(
        SerializerInterface $serializer,
        private readonly AnnexeWebsiteRepository $annexeWebsiteRepository,
        private readonly EntityManagerInterface $em,
        private readonly ValidatorInterface $validator,
    ) {
        parent::__construct($serializer);
    }

    #[Route('', name: 'api_annexe_websites_list', methods: ['GET'])]
    public function list(#[CurrentUser] User $currentUser): JsonResponse
    {
        $websites = $this->annexeWebsiteRepository->findVisible($currentUser->getSite()?->getId());
        $visible = array_values(array_filter(
            $websites,
            static fn (AnnexeWebsite $website): bool => $website->isAccessibleBy($currentUser),
        ));

        return $this->respond($visible, 200, ['annexe_website:read', 'user:read', 'site:read']);
    }

    #[Route('', name: 'api_annexe_websites_create', methods: ['POST'])]
    public function create(Request $request, #[CurrentUser] User $currentUser): JsonResponse
    {
        if (!AnnexeAccess::isDirectionOrAdmin($currentUser)) {
            return $this->respondError('Seule la direction peut ajouter un site web.', 403);
        }

        $data = $this->decode($request->getContent());
        $allowedRoles = AnnexeAccess::parseAllowedRoles($data['allowedRoles'] ?? null);
        if ($allowedRoles === null) {
            return $this->respondError('Indiquez au moins un métier autorisé à accéder à ce site.', 422);
        }

        $website = new AnnexeWebsite();
        $website->setName((string) ($data['name'] ?? ''));
        $website->setUrl((string) ($data['url'] ?? ''));
        $website->setAllowedRoles($allowedRoles);
        $website->setCreatedBy($currentUser);
        $website->setSite($currentUser->getSite());

        $violations = $this->validator->validate($website);
        if (count($violations) > 0) {
            return $this->respondValidationErrors($violations);
        }

        $this->em->persist($website);
        $this->em->flush();

        return $this->respond($website, 201, ['annexe_website:read', 'user:read', 'site:read']);
    }

    #[Route('/{id}', name: 'api_annexe_websites_delete', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function delete(int $id, #[CurrentUser] User $currentUser): JsonResponse
    {
        if (!AnnexeAccess::isDirectionOrAdmin($currentUser)) {
            return $this->respondError('Seule la direction peut supprimer un site web.', 403);
        }

        $website = $this->annexeWebsiteRepository->find($id);
        if (!$website || !AnnexeAccess::isInSiteScope($website->getSite(), $currentUser)) {
            return $this->respondError('Site web introuvable.', 404);
        }

        $this->em->remove($website);
        $this->em->flush();

        return new JsonResponse(null, 204);
    }
}
