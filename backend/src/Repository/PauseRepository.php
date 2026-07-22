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
}
