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
 * Gestion de la liste des caissiers/caissières (comptes avec ROLE_CAISSIER).
 * Ce sont eux dont l'accueil saisit les pauses. Droits (cf. security.yaml) :
 * - Lecture : accueil, direction, admin.
 * - Création / suppression : direction, admin.
 * - Modification : accueil, direction, admin.
 */
#[Route('/api/caissiers')]
class CaissierController extends AbstractApiController
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

    #[Route('', name: 'api_caissiers_list', methods: ['GET'])]
    public function list(): JsonResponse
    {
        return $this->respond($this->userRepository->findByRole(UserRole::CAISSIER), 200, ['user:read', 'site:read']);
    }

    #[Route('', name: 'api_caissiers_create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $data = $this->decode($request->getContent());

        $firstName = trim((string) ($data['firstName'] ?? ''));
        $lastName = trim((string) ($data['lastName'] ?? ''));
        if ('' === $firstName || '' === $lastName) {
            return $this->respondError('Le prénom et le nom sont obligatoires.', 422);
        }

        $email = trim((string) ($data['email'] ?? ''));
        if ('' === $email) {
            $email = $this->generateUniqueEmail($firstName, $lastName);
        } elseif ($this->userRepository->findOneByEmail($email)) {
            return $this->respondError('Un compte existe déjà avec cet email.', 409);
        }

        $caissier = new User();
        $caissier->setFirstName($firstName);
        $caissier->setLastName($lastName);
        $caissier->setEmail($email);
        $caissier->setRoles([UserRole::CAISSIER->value]);

        if (!empty($data['siteId'])) {
            $site = $this->siteRepository->find($data['siteId']);
            if (!$site) {
                return $this->respondError('Site introuvable.', 404);
            }
            $caissier->setSite($site);
        }

        if (array_key_exists('contractMinutes', $data)) {
            $caissier->setContractMinutes((int) $data['contractMinutes']);
        }

        // Pas de connexion prévue dans l'immédiat pour les caissiers : un mot
        // de passe aléatoire est généré si aucun n'est fourni. La direction
        // pourra en définir un plus tard si un accès leur est ouvert.
        $plainPassword = $data['password'] ?? null;
        if ($plainPassword && strlen($plainPassword) < 8) {
            return $this->respondError('Le mot de passe doit contenir au moins 8 caractères.', 422);
        }
        $caissier->setPassword($this->passwordHasher->hashPassword($caissier, $plainPassword ?: bin2hex(random_bytes(16))));

        $violations = $this->validator->validate($caissier);
        if (count($violations) > 0) {
            return $this->respondValidationErrors($violations);
        }

        $this->em->persist($caissier);
        $this->em->flush();

        return $this->respond($caissier, 201, ['user:read', 'site:read']);
    }

    #[Route('/{id}', name: 'api_caissiers_update', methods: ['PUT', 'PATCH'])]
    public function update(int $id, Request $request): JsonResponse
    {
        $caissier = $this->findCaissierOrNull($id);
        if (!$caissier) {
            return $this->respondError('Caissier introuvable', 404);
        }

        $data = $this->decode($request->getContent());

        if (array_key_exists('firstName', $data)) {
            $caissier->setFirstName($data['firstName']);
        }
        if (array_key_exists('lastName', $data)) {
            $caissier->setLastName($data['lastName']);
        }
        if (array_key_exists('email', $data) && !empty($data['email'])) {
            $existing = $this->userRepository->findOneByEmail($data['email']);
            if ($existing && $existing->getId() !== $caissier->getId()) {
                return $this->respondError('Un compte existe déjà avec cet email.', 409);
            }
            $caissier->setEmail($data['email']);
        }
        if (array_key_exists('active', $data)) {
            $caissier->setActive((bool) $data['active']);
        }
        if (array_key_exists('siteId', $data)) {
            $site = $data['siteId'] ? $this->siteRepository->find($data['siteId']) : null;
            $caissier->setSite($site instanceof Site ? $site : null);
        }
        if (array_key_exists('contractMinutes', $data)) {
            $caissier->setContractMinutes((int) $data['contractMinutes']);
        }
        if (!empty($data['password'])) {
            if (strlen($data['password']) < 8) {
                return $this->respondError('Le mot de passe doit contenir au moins 8 caractères.', 422);
            }
            $caissier->setPassword($this->passwordHasher->hashPassword($caissier, $data['password']));
        }

        $violations = $this->validator->validate($caissier);
        if (count($violations) > 0) {
            return $this->respondValidationErrors($violations);
        }

        $this->em->flush();

        return $this->respond($caissier, 200, ['user:read', 'site:read']);
    }

    #[Route('/{id}', name: 'api_caissiers_delete', methods: ['DELETE'])]
    public function delete(int $id): JsonResponse
    {
        $caissier = $this->findCaissierOrNull($id);
        if (!$caissier) {
            return $this->respondError('Caissier introuvable', 404);
        }

        $this->em->remove($caissier);
        $this->em->flush();

        return new JsonResponse(null, 204);
    }

    private function findCaissierOrNull(int $id): ?User
    {
        $user = $this->userRepository->find($id);
        if (!$user || !$user->hasRole(UserRole::CAISSIER)) {
            return null;
        }

        return $user;
    }

    private function generateUniqueEmail(string $firstName, string $lastName): string
    {
        $slugify = static function (string $value): string {
            $value = strtolower(trim($value));
            $value = preg_replace('/[^a-z0-9]+/', '.', $value) ?? $value;

            return trim($value, '.');
        };

        $base = $slugify($firstName).'.'.$slugify($lastName);
        $email = $base.'@caissier.carrefour-accueil.local';
        $suffix = 1;
        while ($this->userRepository->findOneByEmail($email)) {
            ++$suffix;
            $email = $base.$suffix.'@caissier.carrefour-accueil.local';
        }

        return $email;
    }
}
