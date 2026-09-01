<?php

namespace App\Controller\Api;

use App\Entity\Job;
use App\Enum\JobCategory;
use App\Repository\JobRepository;
use App\Service\JobCatalog;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Serializer\SerializerInterface;
use Symfony\Component\Validator\Validator\ValidatorInterface;

/**
 * Catalogue des métiers, groupés par catégorie. La direction peut
 * ajouter un métier dans une catégorie existante, et le retirer
 * tant qu'aucun employé n'y est affecté. Directeur/rice est intouchable.
 */
#[Route('/api/jobs')]
class JobController extends AbstractApiController
{
    public function __construct(
        SerializerInterface $serializer,
        private readonly JobRepository $jobs,
        private readonly JobCatalog $catalog,
        private readonly EntityManagerInterface $em,
        private readonly ValidatorInterface $validator,
    ) {
        parent::__construct($serializer);
    }

    #[Route('', name: 'api_jobs_list', methods: ['GET'])]
    public function list(): JsonResponse
    {
        $this->catalog->ensureBuiltins();

        return $this->respond($this->jobs->findAllOrdered(), 200, ['job:read']);
    }

    #[Route('', name: 'api_jobs_create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $this->catalog->ensureBuiltins();
        $data = $this->decode($request->getContent());

        $category = JobCategory::tryFrom(strtoupper((string) ($data['category'] ?? '')));
        if ($category === null) {
            return $this->respondError('Catégorie inconnue.', 422);
        }

        $label = trim((string) ($data['label'] ?? ''));
        if ($label === '') {
            return $this->respondError('Le libellé du poste est obligatoire.', 422);
        }

        $job = new Job();
        $job->setLabel($label);
        $job->setCategory($category);
        $job->setCode($this->catalog->codeFromLabel($label));
        $job->setGrantsRole($category->defaultGrantsRole());
        $job->setProtected(false);
        $job->setPosition($this->nextPosition($category));

        $violations = $this->validator->validate($job);
        if (count($violations) > 0) {
            return $this->respondValidationErrors($violations);
        }

        $this->em->persist($job);
        $this->em->flush();

        return $this->respond($job, 201, ['job:read']);
    }

    #[Route('/{id}', name: 'api_jobs_delete', methods: ['DELETE'])]
    public function delete(int $id): JsonResponse
    {
        $job = $this->jobs->find($id);
        if (!$job) {
            return $this->respondError('Poste introuvable.', 404);
        }

        if ($job->isProtected() || $job->getCode() === Job::CODE_DIRECTEUR) {
            return $this->respondError('Le poste de directeur/rice ne peut pas être supprimé.', 403);
        }

        $occupied = $job->getOccupantCount();
        if ($occupied > 0) {
            return $this->respondError(
                sprintf(
                    'Impossible de supprimer ce poste : %d personne%s l\'occupe encore.',
                    $occupied,
                    $occupied > 1 ? 's' : '',
                ),
                409,
            );
        }

        $this->em->remove($job);
        $this->em->flush();

        return new JsonResponse(null, 204);
    }

    private function nextPosition(JobCategory $category): int
    {
        $max = 0;
        foreach ($this->jobs->findBy(['category' => $category]) as $job) {
            $max = max($max, $job->getPosition());
        }

        return $max + 10;
    }
}
