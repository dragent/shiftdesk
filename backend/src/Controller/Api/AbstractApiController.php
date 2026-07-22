<?php

namespace App\Controller\Api;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Serializer\SerializerInterface;
use Symfony\Component\Validator\ConstraintViolationListInterface;

abstract class AbstractApiController extends AbstractController
{
    public function __construct(
        protected readonly SerializerInterface $serializer,
    ) {
    }

    /**
     * Sérialise $data avec les groupes donnés et renvoie une JsonResponse.
     */
    protected function respond(mixed $data, int $status = 200, array $groups = []): JsonResponse
    {
        $json = $this->serializer->serialize($data, 'json', ['groups' => $groups]);

        return new JsonResponse($json, $status, [], true);
    }

    protected function respondError(string $message, int $status = 400, array $details = []): JsonResponse
    {
        return new JsonResponse(['error' => $message, 'details' => $details], $status);
    }

    protected function respondValidationErrors(ConstraintViolationListInterface $violations): JsonResponse
    {
        $errors = [];
        foreach ($violations as $violation) {
            $errors[$violation->getPropertyPath()] = $violation->getMessage();
        }

        return new JsonResponse(['error' => 'Données invalides', 'details' => $errors], 422);
    }

    /**
     * @return array<string, mixed>
     */
    protected function decode(string $content): array
    {
        if ('' === trim($content)) {
            return [];
        }

        $data = json_decode($content, true);

        return is_array($data) ? $data : [];
    }
}
