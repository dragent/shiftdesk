<?php

namespace App\Controller\Api;

use App\Entity\User;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Serializer\SerializerInterface;

/**
 * Returns the currently authenticated user (used by the frontend right after
 * login to determine their role and adapt the navigation).
 */
#[Route('/api/me')]
class MeController extends AbstractApiController
{
    public function __construct(SerializerInterface $serializer)
    {
        parent::__construct($serializer);
    }

    #[Route('', name: 'api_me', methods: ['GET'])]
    public function me(): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        return $this->respond($user, 200, ['user:read', 'site:read']);
    }
}
