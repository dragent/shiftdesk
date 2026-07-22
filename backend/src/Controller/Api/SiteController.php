<?php

namespace App\Controller\Api;

use App\Entity\Site;
use App\Repository\SiteRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Serializer\SerializerInterface;
use Symfony\Component\Validator\Validator\ValidatorInterface;

#[Route('/api/sites')]
class SiteController extends AbstractApiController
{
    public function __construct(
        SerializerInterface $serializer,
        private readonly SiteRepository $siteRepository,
        private readonly EntityManagerInterface $em,
        private readonly ValidatorInterface $validator,
    ) {
        parent::__construct($serializer);
    }

    #[Route('', name: 'api_sites_list', methods: ['GET'])]
    public function list(): JsonResponse
    {
        return $this->respond($this->siteRepository->findBy([], ['name' => 'ASC']), 200, ['site:read']);
    }

    #[Route('/{id}', name: 'api_sites_show', methods: ['GET'])]
    public function show(int $id): JsonResponse
    {
        $site = $this->siteRepository->find($id);
        if (!$site) {
            return $this->respondError('Site introuvable', 404);
        }

        return $this->respond($site, 200, ['site:read']);
    }

    #[Route('', name: 'api_sites_create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $data = $this->decode($request->getContent());

        $site = new Site();
        $site->setName($data['name'] ?? '');
        $site->setAddress($data['address'] ?? null);
        $site->setPostalCode($data['postalCode'] ?? null);
        $site->setCity($data['city'] ?? null);

        $violations = $this->validator->validate($site);
        if (count($violations) > 0) {
            return $this->respondValidationErrors($violations);
        }

        $this->em->persist($site);
        $this->em->flush();

        return $this->respond($site, 201, ['site:read']);
    }

    #[Route('/{id}', name: 'api_sites_update', methods: ['PUT', 'PATCH'])]
    public function update(int $id, Request $request): JsonResponse
    {
        $site = $this->siteRepository->find($id);
        if (!$site) {
            return $this->respondError('Site introuvable', 404);
        }

        $data = $this->decode($request->getContent());

        if (array_key_exists('name', $data)) {
            $site->setName($data['name']);
        }
        if (array_key_exists('address', $data)) {
            $site->setAddress($data['address']);
        }
        if (array_key_exists('postalCode', $data)) {
            $site->setPostalCode($data['postalCode']);
        }
        if (array_key_exists('city', $data)) {
            $site->setCity($data['city']);
        }
        if (array_key_exists('active', $data)) {
            $site->setActive((bool) $data['active']);
        }

        $this->em->flush();

        return $this->respond($site, 200, ['site:read']);
    }

    #[Route('/{id}', name: 'api_sites_delete', methods: ['DELETE'])]
    public function delete(int $id): JsonResponse
    {
        $site = $this->siteRepository->find($id);
        if (!$site) {
            return $this->respondError('Site introuvable', 404);
        }

        $this->em->remove($site);
        $this->em->flush();

        return new JsonResponse(null, 204);
    }
}
