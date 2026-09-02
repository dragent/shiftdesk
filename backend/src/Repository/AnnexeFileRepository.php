<?php

namespace App\Repository;

use App\Entity\AnnexeFile;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<AnnexeFile>
 */
class AnnexeFileRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, AnnexeFile::class);
    }

    /**
     * @return AnnexeFile[]
     */
    public function findVisible(?int $siteId): array
    {
        $qb = $this->createQueryBuilder('f')
            ->orderBy('f.name', 'ASC');
        $this->applySiteScope($qb, $siteId);

        return $qb->getQuery()->getResult();
    }

    private function applySiteScope(\Doctrine\ORM\QueryBuilder $qb, ?int $siteId): void
    {
        if ($siteId !== null) {
            $qb->andWhere('IDENTITY(f.site) = :siteId OR f.site IS NULL')
                ->setParameter('siteId', $siteId);

            return;
        }

        $qb->andWhere('f.site IS NULL');
    }
}
