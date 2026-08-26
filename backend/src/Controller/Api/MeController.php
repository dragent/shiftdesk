<?php

namespace App\Controller\Api;

use App\Entity\User;
use App\Repository\UserRepository;
use App\Service\PasswordSecurityChecker;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Serializer\SerializerInterface;
use Symfony\Component\Validator\Validator\ValidatorInterface;

/**
 * Returns the currently authenticated user (used by the frontend right after
 * login to determine their role and adapt the navigation).
 */
#[Route('/api/me')]
class MeController extends AbstractApiController
{
    public function __construct(
        SerializerInterface $serializer,
        private readonly EntityManagerInterface $em,
        private readonly UserPasswordHasherInterface $passwordHasher,
        private readonly PasswordSecurityChecker $passwordSecurity,
        private readonly UserRepository $userRepository,
        private readonly ValidatorInterface $validator,
        private readonly JWTTokenManagerInterface $jwtManager,
    ) {
        parent::__construct($serializer);
    }

    #[Route('', name: 'api_me', methods: ['GET'])]
    public function me(#[CurrentUser] User $user): JsonResponse
    {
        return $this->respond($user, 200, ['user:read', 'site:read']);
    }

    /**
     * Lets the authenticated user update their own contact details (email
     * and phone). Changing the email issues a fresh JWT, because the token
     * identity is the email address.
     */
    #[Route('', name: 'api_me_update', methods: ['PATCH', 'PUT'])]
    public function update(Request $request, #[CurrentUser] User $user): JsonResponse
    {
        $data = $this->decode($request->getContent());
        $emailChanged = false;

        if (array_key_exists('email', $data)) {
            $email = trim((string) $data['email']);
            if ($email !== $user->getEmail()) {
                $existing = $this->userRepository->findOneByEmail($email);
                if ($existing !== null && $existing->getId() !== $user->getId()) {
                    return $this->respondError('Un compte existe déjà avec cet email.', 409);
                }
                $user->setEmail($email);
                $emailChanged = true;
            }
        }

        if (array_key_exists('phone', $data)) {
            $raw = $data['phone'];
            $user->setPhone($raw === null ? null : (string) $raw);
        }

        $violations = $this->validator->validate($user);
        if (count($violations) > 0) {
            return $this->respondValidationErrors($violations);
        }

        $this->em->flush();

        $payload = json_decode(
            $this->serializer->serialize($user, 'json', ['groups' => ['user:read', 'site:read']]),
            true,
            512,
            JSON_THROW_ON_ERROR,
        );
        if ($emailChanged) {
            $payload['token'] = $this->jwtManager->create($user);
        }

        return new JsonResponse($payload);
    }

    /**
     * Sets a personal password after recruitment (or when the user chooses
     * to rotate credentials). Validates strength, then hashes (bcrypt/argon)
     * before persisting — the plain password is never stored.
     */
    #[Route('/password', name: 'api_me_password', methods: ['POST'])]
    public function changePassword(Request $request, #[CurrentUser] User $user): JsonResponse
    {
        $data = $this->decode($request->getContent());
        $newPassword = (string) ($data['newPassword'] ?? '');
        $confirmPassword = (string) ($data['confirmPassword'] ?? $data['newPassword'] ?? '');

        if ($newPassword !== $confirmPassword) {
            return $this->respondError('La confirmation ne correspond pas au nouveau mot de passe.', 422);
        }

        $securityError = $this->passwordSecurity->validate($newPassword);
        if ($securityError !== null) {
            return $this->respondError($securityError, 422);
        }

        // When the user already chose a personal password, require the current
        // one. On first login after recruitment, only the new password is asked.
        if (!$user->isMustChangePassword()) {
            $currentPassword = (string) ($data['currentPassword'] ?? '');
            if ($currentPassword === '' || !$this->passwordHasher->isPasswordValid($user, $currentPassword)) {
                return $this->respondError('Le mot de passe actuel est incorrect.', 422);
            }
        }

        $user->setPassword($this->passwordHasher->hashPassword($user, $newPassword));
        $user->setMustChangePassword(false);
        $this->em->flush();

        return $this->respond($user, 200, ['user:read', 'site:read']);
    }
}
