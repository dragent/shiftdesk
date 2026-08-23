<?php

namespace App\Repository;

use App\Entity\Planning;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\DBAL\Types\Types;
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
            // Types::DATE_IMMUTABLE avoids the SQLite discrepancies (datetime vs date)
            // that made the day / lunch break filters fail in tests.
            ->setParameter('from', $from, Types::DATE_IMMUTABLE)
            ->setParameter('to', $to, Types::DATE_IMMUTABLE)
            ->orderBy('p.workDate', 'ASC')
            ->addOrderBy('p.startTime', 'ASC');

        if (null !== $siteId) {
            $qb->andWhere('p.site = :siteId')->setParameter('siteId', $siteId);
        }

        return $qb->getQuery()->getResult();
    }

    /**
     * All the slots already scheduled for an employee on a given day, except
     * an optionally excluded slot (used on update, so that a slot is not
     * compared with itself). Used in particular to check the minimum lunch
     * break between two slots on the same day.
     *
     * @return Planning[]
     */
    public function findForUserAndDate(int $userId, \DateTimeImmutable $workDate, ?int $excludeId = null): array
    {
        $qb = $this->createQueryBuilder('p')
            ->andWhere('p.user = :userId')
            ->andWhere('p.workDate = :workDate')
            ->setParameter('userId', $userId)
            ->setParameter('workDate', $workDate, Types::DATE_IMMUTABLE);

        if (null !== $excludeId) {
            $qb->andWhere('p.id != :excludeId')->setParameter('excludeId', $excludeId);
        }

        return $qb->getQuery()->getResult();
    }
}
