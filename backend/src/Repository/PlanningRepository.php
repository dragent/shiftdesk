<?php

namespace App\Repository;

use App\Entity\Planning;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Planning>
 */
class PlanningRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Planning::class);
    }

    /**
     * @return Planning[]
     */
    public function findBetweenDates(\DateTimeImmutable $from, \DateTimeImmutable $to, ?int $siteId = null): array
    {
        $qb = $this->createQueryBuilder('p')
            ->andWhere('p.workDate >= :from')
            ->andWhere('p.workDate <= :to')
            ->setParameter('from', $from)
            ->setParameter('to', $to)
            ->orderBy('p.workDate', 'ASC')
            ->addOrderBy('p.startTime', 'ASC');

        if (null !== $siteId) {
            $qb->andWhere('p.site = :siteId')->setParameter('siteId', $siteId);
        }

        return $qb->getQuery()->getResult();
    }
}
