<?php

namespace App\Service;

use App\Entity\Job;
use App\Enum\JobCategory;
use App\Enum\UserRole;
use App\Repository\JobRepository;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Built-in métiers seeded once. Categories stay fixed; direction may add
 * jobs inside them, and remove a job that still has no occupant.
 * Directeur/rice is never deleted.
 */
final class JobCatalog
{
    /**
     * @return list<array{code: string, label: string, category: JobCategory, grantsRole: UserRole, protected: bool, position: int}>
     */
    public static function builtins(): array
    {
        return [
            [
                'code' => Job::CODE_DIRECTEUR,
                'label' => 'Directeur/rice',
                'category' => JobCategory::DIRECTION,
                'grantsRole' => UserRole::DIRECTEUR,
                'protected' => true,
                'position' => 10,
            ],
            [
                'code' => 'CAISSIER',
                'label' => 'Caissier(ère)',
                'category' => JobCategory::ACCUEIL_CAISSE,
                'grantsRole' => UserRole::CAISSIER,
                'protected' => false,
                'position' => 20,
            ],
            [
                'code' => 'LAD',
                'label' => 'LAD',
                'category' => JobCategory::ACCUEIL_CAISSE,
                'grantsRole' => UserRole::LAD,
                'protected' => false,
                'position' => 30,
            ],
            [
                'code' => 'HOTE',
                'label' => "Hôte(sse) d'accueil",
                'category' => JobCategory::ACCUEIL_CAISSE,
                'grantsRole' => UserRole::HOTE,
                'protected' => false,
                'position' => 40,
            ],
            [
                'code' => 'SECURITE',
                'label' => 'Sécurité',
                'category' => JobCategory::SECURITE,
                'grantsRole' => UserRole::SECURITE,
                'protected' => false,
                'position' => 50,
            ],
            [
                'code' => 'RAYON',
                'label' => 'Rayon',
                'category' => JobCategory::RAYON,
                'grantsRole' => UserRole::RAYON,
                'protected' => false,
                'position' => 60,
            ],
        ];
    }

    public function __construct(
        private readonly JobRepository $jobs,
        private readonly EntityManagerInterface $em,
    ) {
    }

    /** Idempotent: creates any missing built-in job. */
    public function ensureBuiltins(): void
    {
        foreach (self::builtins() as $def) {
            if ($this->jobs->findOneByCode($def['code'])) {
                continue;
            }

            $job = new Job();
            $job->setCode($def['code']);
            $job->setLabel($def['label']);
            $job->setCategory($def['category']);
            $job->setGrantsRole($def['grantsRole']);
            $job->setProtected($def['protected']);
            $job->setPosition($def['position']);
            $this->em->persist($job);
        }

        $this->em->flush();
    }

    public function codeFromLabel(string $label): string
    {
        $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $label) ?: $label;
        $code = strtoupper((string) preg_replace('/[^A-Z0-9]+/', '_', strtoupper($ascii)));
        $code = trim($code, '_');
        if ($code === '' || !preg_match('/^[A-Z]/', $code)) {
            $code = 'JOB_'.$code;
        }

        $base = substr($code, 0, 40);
        if (\in_array($base, ['ADMIN', 'USER', 'DIRECTION', Job::CODE_DIRECTEUR], true)) {
            $base = 'JOB_'.$base;
        }

        $candidate = $base;
        $n = 2;
        while ($this->jobs->findOneByCode($candidate) !== null) {
            $candidate = $base.'_'.$n;
            ++$n;
        }

        return $candidate;
    }
}
