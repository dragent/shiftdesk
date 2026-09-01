<?php

namespace App\Controller\Api;

use App\Entity\Job;
use App\Entity\Site;
use App\Entity\User;
use App\Enum\UserRole;
use App\Repository\JobRepository;
use App\Repository\SiteRepository;
use App\Repository\UserRepository;
use App\Security\RoleAssignmentPolicy;
use App\Service\RecruitmentMailer;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Serializer\SerializerInterface;
use Symfony\Component\Validator\Validator\ValidatorInterface;

/**
 * User account management (admin only, see security.yaml). Allows
 * management/admin to create reception host accounts.
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
        private readonly RecruitmentMailer $recruitmentMailer,
        private readonly JobRepository $jobRepository,
        private readonly RoleAssignmentPolicy $roleAssignment,
    ) {
        parent::__construct($serializer);
    }

    #[Route('', name: 'api_users_list', methods: ['GET'])]
    public function list(): JsonResponse
    {
        // Dated dismissals take effect here, on the first read that follows
        // their effective date (see UserRepository).
        $this->userRepository->deactivateDueDismissals(new \DateTimeImmutable('today'));

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
    public function create(Request $request, #[CurrentUser] User $currentUser): JsonResponse
    {
        $data = $this->decode($request->getContent());

        if ($this->userRepository->findOneByEmail($data['email'] ?? '')) {
            return $this->respondError('Un compte existe déjà avec cet email.', 409);
        }

        $rawRole = (string) ($data['role'] ?? 'HOTE');
        $targetRole = $this->roleAssignment->parse($rawRole);
        $job = $this->resolveJob($rawRole, $targetRole);
        $targetRole = $job?->getGrantsRole() ?? $targetRole;
        if (!$this->roleAssignment->canAssign($currentUser, $targetRole)) {
            return $this->respondError('Vous ne pouvez pas attribuer ce rôle.', 403);
        }

        $user = new User();
        $user->setEmail($data['email'] ?? '');
        $user->setFirstName($data['firstName'] ?? '');
        $user->setLastName($data['lastName'] ?? '');
        if ($job) {
            $user->assignJob($job);
        } else {
            $user->setRoles([$targetRole->value]);
        }
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

        // Recruitment no longer collects a provisional password in the form: a
        // temporary one is generated and emailed to the employee. Only an
        // administrator may set a known password at creation (admin UI).
        $plainPassword = $currentUser->hasRole(UserRole::ADMIN) ? ($data['password'] ?? null) : null;
        if ($plainPassword && strlen((string) $plainPassword) < 8) {
            return $this->respondError('Le mot de passe doit contenir au moins 8 caractères.', 422);
        }
        if (!$plainPassword) {
            $plainPassword = bin2hex(random_bytes(8));
            // Temporary password from the welcome email: the employee must
            // replace it on first login.
            $user->setMustChangePassword(true);
        }
        $user->setPassword($this->passwordHasher->hashPassword($user, $plainPassword));

        $violations = $this->validator->validate($user);
        if (count($violations) > 0) {
            return $this->respondValidationErrors($violations);
        }

        $this->em->persist($user);
        $this->em->flush();

        $this->recruitmentMailer->sendWelcome($user, $plainPassword);

        return $this->respond($user, 201, ['user:read', 'site:read']);
    }

    #[Route('/{id}', name: 'api_users_update', methods: ['PUT', 'PATCH'])]
    public function update(int $id, Request $request, #[CurrentUser] User $currentUser): JsonResponse
    {
        $user = $this->userRepository->find($id);
        if (!$user) {
            return $this->respondError('Utilisateur introuvable', 404);
        }

        $data = $this->decode($request->getContent());

        if (!empty($data['password'])) {
            return $this->respondError('Le mot de passe se change depuis le profil de l\'employé.', 403);
        }

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
            $rawRole = (string) $data['role'];
            $targetRole = $this->roleAssignment->parse($rawRole);
            $job = $this->resolveJob($rawRole, $targetRole);
            $targetRole = $job?->getGrantsRole() ?? $targetRole;
            if (!$this->roleAssignment->canAssign($currentUser, $targetRole)) {
                return $this->respondError('Vous ne pouvez pas attribuer ce rôle.', 403);
            }
            if (!$this->roleAssignment->canReplaceRole($user, $targetRole)) {
                return $this->respondError(
                    'Le poste de directeur/rice ne peut pas être retiré.',
                    403,
                );
            }
            if ($job) {
                $user->assignJob($job);
            } else {
                $user->setJob(null);
                $user->setRoles([$targetRole->value]);
            }
        }
        if (array_key_exists('active', $data)) {
            $user->setActive((bool) $data['active']);
            // A rehire clears the previous dismissal date.
            if ($user->isActive()) {
                $user->setDismissedAt(null);
            }
        }
        if (array_key_exists('dismissedAt', $data)) {
            $raw = $data['dismissedAt'];
            if ($raw !== null && !$this->isValidDate((string) $raw)) {
                return $this->respondError('La date de licenciement est invalide.', 422);
            }
            $dismissedAt = $raw !== null ? new \DateTimeImmutable((string) $raw) : null;
            $user->setDismissedAt($dismissedAt);
            // The dismissal takes effect on the chosen date: until then the
            // employee remains on duty, and therefore schedulable.
            $user->setActive($dismissedAt === null || $dismissedAt > new \DateTimeImmutable('today'));
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

        $violations = $this->validator->validate($user);
        if (count($violations) > 0) {
            return $this->respondValidationErrors($violations);
        }

        $this->em->flush();

        return $this->respond($user, 200, ['user:read', 'site:read']);
    }

    #[Route('/{id}', name: 'api_users_delete', methods: ['DELETE'])]
    public function delete(int $id, #[CurrentUser] User $currentUser): JsonResponse
    {
        $user = $this->userRepository->find($id);
        if (!$user) {
            return $this->respondError('Utilisateur introuvable', 404);
        }

        // Direction may only hard-delete dismissed cashiers (dev cleanup tool).
        // Admins keep full deletion rights.
        if (!$currentUser->hasRole(UserRole::ADMIN)) {
            if ($user->isActive()) {
                return $this->respondError(
                    'Seul un employé licencié peut être supprimé définitivement.',
                    422,
                );
            }
            if (!$user->hasRole(UserRole::CAISSIER)) {
                return $this->respondError(
                    'Seuls les caissiers licenciés peuvent être supprimés depuis cet outil.',
                    422,
                );
            }
        }

        $this->em->remove($user);
        $this->em->flush();

        return new JsonResponse(null, 204);
    }

    /** Date in `Y-m-d` format (the one sent by an HTML date field). */
    private function isValidDate(string $value): bool
    {
        $date = \DateTimeImmutable::createFromFormat('!Y-m-d', $value);

        return $date !== false && $date->format('Y-m-d') === $value;
    }

    private function resolveJob(string $raw, UserRole $fallbackRole): ?Job
    {
        $raw = strtoupper(trim($raw));
        $code = str_starts_with($raw, 'ROLE_') ? substr($raw, 5) : $raw;
        if ($code !== '') {
            $byCode = $this->jobRepository->findOneByCode($code);
            if ($byCode) {
                return $byCode;
            }
        }

        if ($fallbackRole === UserRole::ADMIN) {
            return null;
        }

        if ($code === $fallbackRole->name || $raw === $fallbackRole->value) {
            return $this->jobRepository->findOneBy(['grantsRole' => $fallbackRole]);
        }

        return null;
    }
}
