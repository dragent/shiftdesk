<?php

namespace App\Repository;

use App\Entity\Pause;
use App\Entity\User;
use App\Enum\PauseStatus;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Pause>
 */
class PauseRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Pause::class);
    }

    public function findOngoingForUser(User $user): ?Pause
    {
        return $this->findOneBy(['user' => $user, 'status' => PauseStatus::EN_COURS]);
    }

    /**
     * @return Pause[]
     */
    public function findOngoing(): array
    {
        return $this->findBy(['status' => PauseStatus::EN_COURS]);
    }

    /**
     * Retourne les pauses de tous les employés démarrées un jour donné
     * (vue d'équipe "pauses de la journée"), triées par heure de début.
     *
     * @return Pause[]
     */
    public function findForDate(\DateTimeImmutable $date): array
    {
        $start = $date->setTime(0, 0, 0);
        $end = $start->modify('+1 day');

        return $this->createQueryBuilder('p')
            ->andWhere('p.startedAt >= :start')
            ->andWhere('p.startedAt < :end')
            ->setParameter('start', $start)
            ->setParameter('end', $end)
            ->orderBy('p.startedAt', 'ASC')
            ->getQuery()
            ->getResult();
    }
}
