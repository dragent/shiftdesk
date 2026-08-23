<?php

namespace App\Repository;

use App\Entity\Absence;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Absence>
 */
class AbsenceRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Absence::class);
    }

    /**
     * Absences overlapping the [from, to] period.
     *
     * @return Absence[]
     */
    public function findOverlapping(\DateTimeImmutable $from, \DateTimeImmutable $to): array
    {
        return $this->createQueryBuilder('a')
            ->andWhere('a.startDate <= :to')
            ->andWhere('a.endDate >= :from')
            ->setParameter('from', $from, Types::DATE_IMMUTABLE)
            ->setParameter('to', $to, Types::DATE_IMMUTABLE)
            ->orderBy('a.startDate', 'ASC')
            ->addOrderBy('a.endDate', 'ASC')
            ->getQuery()
            ->getResult();
    }
}
