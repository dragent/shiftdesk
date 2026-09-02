<?php

namespace App\Controller\Api;

use App\Entity\AnnexeFile;
use App\Entity\User;
use App\Repository\AnnexeFileRepository;
use App\Security\AnnexeAccess;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Serializer\SerializerInterface;
use Symfony\Component\Validator\Validator\ValidatorInterface;

/**
 * Named files in the store annex. Direction/Admin and Accueil (hôte) can add
 * and delete them.
 */
#[Route('/api/annexe/files')]
class AnnexeFileController extends AbstractApiController
{
    public function __construct(
        SerializerInterface $serializer,
        private readonly AnnexeFileRepository $annexeFileRepository,
        private readonly EntityManagerInterface $em,
        private readonly ValidatorInterface $validator,
    ) {
        parent::__construct($serializer);
    }

    #[Route('', name: 'api_annexe_files_list', methods: ['GET'])]
    public function list(#[CurrentUser] User $currentUser): JsonResponse
    {
        if (!AnnexeAccess::canManageFiles($currentUser)) {
            return $this->respondError('Accès refusé.', 403);
        }

        $files = $this->annexeFileRepository->findVisible($currentUser->getSite()?->getId());

        return $this->respond($files, 200, ['annexe_file:read', 'user:read', 'site:read']);
    }

    #[Route('', name: 'api_annexe_files_create', methods: ['POST'])]
    public function create(Request $request, #[CurrentUser] User $currentUser): JsonResponse
    {
        if (!AnnexeAccess::canManageFiles($currentUser)) {
            return $this->respondError('Seule la direction ou l\'accueil peut ajouter un fichier.', 403);
        }

        $data = $this->decode($request->getContent());

        $file = new AnnexeFile();
        $file->setName((string) ($data['name'] ?? ''));
        $file->setCreatedBy($currentUser);
        $file->setSite($currentUser->getSite());

        $violations = $this->validator->validate($file);
        if (count($violations) > 0) {
            return $this->respondValidationErrors($violations);
        }

        $this->em->persist($file);
        $this->em->flush();

        return $this->respond($file, 201, ['annexe_file:read', 'user:read', 'site:read']);
    }

    #[Route('/{id}', name: 'api_annexe_files_delete', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function delete(int $id, #[CurrentUser] User $currentUser): JsonResponse
    {
        if (!AnnexeAccess::canManageFiles($currentUser)) {
            return $this->respondError('Seule la direction ou l\'accueil peut supprimer un fichier.', 403);
        }

        $file = $this->annexeFileRepository->find($id);
        if (!$file || !AnnexeAccess::isInSiteScope($file->getSite(), $currentUser)) {
            return $this->respondError('Fichier introuvable.', 404);
        }

        $this->em->remove($file);
        $this->em->flush();

        return new JsonResponse(null, 204);
    }
}
