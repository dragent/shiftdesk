<?php

namespace App\Controller\Api;

use App\Entity\User;
use App\Service\PasswordSecurityChecker;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Serializer\SerializerInterface;

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
    ) {
        parent::__construct($serializer);
    }

    #[Route('', name: 'api_me', methods: ['GET'])]
    public function me(#[CurrentUser] User $user): JsonResponse
    {
        return $this->respond($user, 200, ['user:read', 'site:read']);
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
