<?php

namespace App\Repository;

use App\Entity\Job;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Job>
 */
class JobRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Job::class);
    }

    public function findOneByCode(string $code): ?Job
    {
        return $this->findOneBy(['code' => strtoupper($code)]);
    }

    /**
     * @return Job[]
     */
    public function findAllOrdered(): array
    {
        return $this->createQueryBuilder('j')
            ->leftJoin('j.users', 'u')
            ->addSelect('u')
            ->orderBy('j.position', 'ASC')
            ->addOrderBy('j.label', 'ASC')
            ->getQuery()
            ->getResult();
    }
}
