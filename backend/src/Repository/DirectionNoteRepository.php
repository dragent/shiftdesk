<?php

namespace App\Repository;

use App\Entity\DirectionNote;
use App\Entity\User;
use App\Enum\DirectionNoteChannel;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<DirectionNote>
 */
class DirectionNoteRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, DirectionNote::class);
    }

    /**
     * Most recent open notes for a channel, optionally scoped to a site.
     * Closed notes are excluded: Direction closes them for everyone.
     *
     * @return DirectionNote[]
     */
    public function findRecentByChannel(
        DirectionNoteChannel $channel,
        ?int $siteId = null,
        int $limit = 20,
    ): array {
        $qb = $this->createQueryBuilder('n')
            ->andWhere('n.channel = :channel')
            ->andWhere('n.closedAt IS NULL')
            ->setParameter('channel', $channel)
            ->orderBy('n.createdAt', 'DESC')
            ->setMaxResults($limit);

        if ($siteId !== null) {
            $qb->andWhere('IDENTITY(n.site) = :siteId OR n.site IS NULL')
                ->setParameter('siteId', $siteId);
        }

        return $qb->getQuery()->getResult();
    }

    /**
     * Open notes visible to the user that they have not personally marked as seen.
     *
     * @param list<DirectionNoteChannel> $channels
     */
    public function countUnreadForUser(User $user, array $channels, ?int $siteId = null): int
    {
        if ($channels === []) {
            return 0;
        }

        $qb = $this->createQueryBuilder('n')
            ->select('COUNT(n.id)')
            ->andWhere('n.channel IN (:channels)')
            ->andWhere('n.closedAt IS NULL')
            ->andWhere(
                'NOT EXISTS (
                    SELECT 1 FROM App\Entity\DirectionNoteSeen s
                    WHERE s.note = n AND s.user = :user
                )',
            )
            ->setParameter('channels', $channels)
            ->setParameter('user', $user);

        if ($siteId !== null) {
            $qb->andWhere('IDENTITY(n.site) = :siteId OR n.site IS NULL')
                ->setParameter('siteId', $siteId);
        }

        return (int) $qb->getQuery()->getSingleScalarResult();
    }
}
