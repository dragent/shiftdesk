<?php

namespace App\Controller\Api;

use App\Entity\Site;
use App\Entity\User;
use App\Enum\UserRole;
use App\Repository\SiteRepository;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Serializer\SerializerInterface;
use Symfony\Component\Validator\Validator\ValidatorInterface;

/**
 * Gestion des comptes utilisateurs (admin uniquement, cf. security.yaml).
 * Permet à la direction/l'admin de créer les comptes hôtes/hôtesses.
 */
#[Route('/api/users')]
class UserController extends AbstractApiController
{
    public function __construct(
        SerializerInterface $serializer,
        private readonly UserRepository $userRepository,
        private readonly SiteRepository $siteRepository,
        private readonly EntityManagerInterface $em,
        private readonly ValidatorInterface $validator,
        private readonly UserPasswordHasherInterface $passwordHasher,
    ) {
        parent::__construct($serializer);
    }

    #[Route('', name: 'api_users_list', methods: ['GET'])]
    public function list(): JsonResponse
    {
        return $this->respond($this->userRepository->findBy([], ['lastName' => 'ASC']), 200, ['user:read', 'site:read']);
    }

    #[Route('/{id}', name: 'api_users_show', methods: ['GET'])]
    public function show(int $id): JsonResponse
    {
        $user = $this->userRepository->find($id);
        if (!$user) {
            return $this->respondError('Utilisateur introuvable', 404);
        }

        return $this->respond($user, 200, ['user:read', 'site:read']);
    }

    #[Route('', name: 'api_users_create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $data = $this->decode($request->getContent());

        if ($this->userRepository->findOneByEmail($data['email'] ?? '')) {
            return $this->respondError('Un compte existe déjà avec cet email.', 409);
        }

        $user = new User();
        $user->setEmail($data['email'] ?? '');
        $user->setFirstName($data['firstName'] ?? '');
        $user->setLastName($data['lastName'] ?? '');
        $user->setRoles($this->resolveRoles($data['role'] ?? 'HOTE'));
        $user->setPhone($data['phone'] ?? null);

        if (array_key_exists('contractMinutes', $data)) {
            $user->setContractMinutes((int) $data['contractMinutes']);
        }

        if (isset($data['siteId'])) {
            $site = $this->siteRepository->find($data['siteId']);
            if (!$site) {
                return $this->respondError('Site introuvable.', 404);
            }
            $user->setSite($site);
        }

        $plainPassword = $data['password'] ?? null;
        if (!$plainPassword || strlen($plainPassword) < 8) {
            return $this->respondError('Le mot de passe doit contenir au moins 8 caractères.', 422);
        }
        $user->setPassword($this->passwordHasher->hashPassword($user, $plainPassword));

        $violations = $this->validator->validate($user);
        if (count($violations) > 0) {
            return $this->respondValidationErrors($violations);
        }

        $this->em->persist($user);
        $this->em->flush();

        return $this->respond($user, 201, ['user:read', 'site:read']);
    }

    #[Route('/{id}', name: 'api_users_update', methods: ['PUT', 'PATCH'])]
    public function update(int $id, Request $request): JsonResponse
    {
        $user = $this->userRepository->find($id);
        if (!$user) {
            return $this->respondError('Utilisateur introuvable', 404);
        }

        $data = $this->decode($request->getContent());

        if (array_key_exists('firstName', $data)) {
            $user->setFirstName($data['firstName']);
        }
        if (array_key_exists('lastName', $data)) {
            $user->setLastName($data['lastName']);
        }
        if (array_key_exists('email', $data)) {
            $user->setEmail($data['email']);
        }
        if (array_key_exists('role', $data)) {
            $user->setRoles($this->resolveRoles($data['role']));
        }
        if (array_key_exists('active', $data)) {
            $user->setActive((bool) $data['active']);
        }
        if (array_key_exists('phone', $data)) {
            $user->setPhone($data['phone']);
        }
        if (array_key_exists('siteId', $data)) {
            $site = $data['siteId'] ? $this->siteRepository->find($data['siteId']) : null;
            $user->setSite($site instanceof Site ? $site : null);
        }
        if (array_key_exists('contractMinutes', $data)) {
            $user->setContractMinutes((int) $data['contractMinutes']);
        }
        if (!empty($data['password'])) {
            $user->setPassword($this->passwordHasher->hashPassword($user, $data['password']));
        }

        $violations = $this->validator->validate($user);
        if (count($violations) > 0) {
            return $this->respondValidationErrors($violations);
        }

        $this->em->flush();

        return $this->respond($user, 200, ['user:read', 'site:read']);
    }

    #[Route('/{id}', name: 'api_users_delete', methods: ['DELETE'])]
    public function delete(int $id): JsonResponse
    {
        $user = $this->userRepository->find($id);
        if (!$user) {
            return $this->respondError('Utilisateur introuvable', 404);
        }

        $this->em->remove($user);
        $this->em->flush();

        return new JsonResponse(null, 204);
    }

    /**
     * @return list<string>
     */
    private function resolveRoles(string $role): array
    {
        $role = strtoupper($role);
        $enum = UserRole::tryFrom('ROLE_'.$role) ?? UserRole::tryFrom($role);

        return $enum ? [$enum->value] : [UserRole::HOTE->value];
    }
}
