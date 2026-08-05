<?php

namespace App\Repository;

use App\Entity\StoreClosure;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<StoreClosure>
 */
class StoreClosureRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, StoreClosure::class);
    }

    /**
     * Fermetures qui chevauchent la période [from, to].
     *
     * @return StoreClosure[]
     */
    public function findOverlapping(\DateTimeImmutable $from, \DateTimeImmutable $to): array
    {
        return $this->createQueryBuilder('c')
            ->andWhere('c.startDate <= :to')
            ->andWhere('c.endDate >= :from')
            ->setParameter('from', $from, Types::DATE_IMMUTABLE)
            ->setParameter('to', $to, Types::DATE_IMMUTABLE)
            ->orderBy('c.startDate', 'ASC')
            ->addOrderBy('c.endDate', 'ASC')
            ->getQuery()
            ->getResult();
    }
}
