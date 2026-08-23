<?php

namespace App\Controller\Api;

use App\Entity\RequestCategory;
use App\Repository\RequestCategoryRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Serializer\SerializerInterface;
use Symfony\Component\Validator\Validator\ValidatorInterface;

/**
 * Manages the categories shown in the dropdown used to record reception
 * requests (e.g. "Caroline", "Siebel", "Menu Carrefour"). Editable
 * dynamically by an administrator, without a redeployment.
 */
#[Route('/api/categories')]
class RequestCategoryController extends AbstractApiController
{
    public function __construct(
        SerializerInterface $serializer,
        private readonly RequestCategoryRepository $categoryRepository,
        private readonly EntityManagerInterface $em,
        private readonly ValidatorInterface $validator,
    ) {
        parent::__construct($serializer);
    }

    #[Route('', name: 'api_categories_list', methods: ['GET'])]
    public function list(Request $request): JsonResponse
    {
        $onlyActive = $request->query->getBoolean('active', false);
        $categories = $onlyActive
            ? $this->categoryRepository->findActiveOrdered()
            : $this->categoryRepository->findBy([], ['position' => 'ASC', 'label' => 'ASC']);

        return $this->respond($categories, 200, ['category:read']);
    }

    #[Route('', name: 'api_categories_create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $data = $this->decode($request->getContent());

        $category = new RequestCategory();
        $category->setCode($data['code'] ?? '');
        $category->setLabel($data['label'] ?? '');
        $category->setDescription($data['description'] ?? null);
        $category->setPosition((int) ($data['position'] ?? 0));
        $category->setActive((bool) ($data['active'] ?? true));

        $violations = $this->validator->validate($category);
        if (count($violations) > 0) {
            return $this->respondValidationErrors($violations);
        }

        $this->em->persist($category);
        $this->em->flush();

        return $this->respond($category, 201, ['category:read']);
    }

    #[Route('/{id}', name: 'api_categories_update', methods: ['PUT', 'PATCH'])]
    public function update(int $id, Request $request): JsonResponse
    {
        $category = $this->categoryRepository->find($id);
        if (!$category) {
            return $this->respondError('Catégorie introuvable', 404);
        }

        $data = $this->decode($request->getContent());

        if (array_key_exists('code', $data)) {
            $category->setCode($data['code']);
        }
        if (array_key_exists('label', $data)) {
            $category->setLabel($data['label']);
        }
        if (array_key_exists('description', $data)) {
            $category->setDescription($data['description']);
        }
        if (array_key_exists('position', $data)) {
            $category->setPosition((int) $data['position']);
        }
        if (array_key_exists('active', $data)) {
            $category->setActive((bool) $data['active']);
        }

        $violations = $this->validator->validate($category);
        if (count($violations) > 0) {
            return $this->respondValidationErrors($violations);
        }

        $this->em->flush();

        return $this->respond($category, 200, ['category:read']);
    }

    #[Route('/{id}', name: 'api_categories_delete', methods: ['DELETE'])]
    public function delete(int $id): JsonResponse
    {
        $category = $this->categoryRepository->find($id);
        if (!$category) {
            return $this->respondError('Catégorie introuvable', 404);
        }

        $this->em->remove($category);
        $this->em->flush();

        return new JsonResponse(null, 204);
    }
}
