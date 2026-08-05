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
            // Types::DATE_IMMUTABLE évite les écarts SQLite (datetime vs date)
            // qui faisaient rater les filtres jour / pause déjeuner en tests.
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
     * Tous les créneaux déjà planifiés pour un employé un jour donné, hors
     * un éventuel créneau exclu (utilisé lors d'une modification, pour ne
     * pas se comparer à soi-même). Sert notamment à vérifier la pause
     * déjeuner minimale entre deux créneaux du même jour.
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
