<?php

namespace App\Repository;

use App\Entity\PlanningInsight;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<PlanningInsight>
 */
class PlanningInsightRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, PlanningInsight::class);
    }

    /**
     * @return PlanningInsight[]
     */
    public function findActive(?int $siteId = null): array
    {
        $qb = $this->createQueryBuilder('i')
            ->andWhere('i.status != :ignoree')
            ->setParameter('ignoree', \App\Enum\InsightStatus::IGNOREE)
            ->orderBy('i.targetDate', 'DESC')
            ->addOrderBy('i.createdAt', 'DESC');

        if (null !== $siteId) {
            $qb->andWhere('i.site = :siteId')->setParameter('siteId', $siteId);
        }

        return $qb->getQuery()->getResult();
    }
}
