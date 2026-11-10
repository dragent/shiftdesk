<?php

namespace App\Repository;

use App\Entity\AnnexeWebsite;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<AnnexeWebsite>
 */
class AnnexeWebsiteRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, AnnexeWebsite::class);
    }

    /**
     * @return AnnexeWebsite[]
     */
    public function findVisible(?int $siteId): array
    {
        $qb = $this->createQueryBuilder('w')
            ->orderBy('w.name', 'ASC');
        $this->applySiteScope($qb, $siteId);

        return $qb->getQuery()->getResult();
    }

    private function applySiteScope(\Doctrine\ORM\QueryBuilder $qb, ?int $siteId): void
    {
        if ($siteId !== null) {
            $qb->andWhere('IDENTITY(w.site) = :siteId OR w.site IS NULL')
                ->setParameter('siteId', $siteId);

            return;
        }

        $qb->andWhere('w.site IS NULL');
    }
}
