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
     * Notes for a channel, optionally filtered by open/closed status.
     * Scoped to the user's site: same site OR notes without a site.
     * When the user has no site, only notes without a site are returned
     * (avoids leaking multi-site notes).
     *
     * @return DirectionNote[]
     */
    public function findByChannel(
        DirectionNoteChannel $channel,
        ?int $siteId = null,
        string $status = 'open',
        int $limit = 20,
        int $offset = 0,
    ): array {
        $qb = $this->createQueryBuilder('n')
            ->andWhere('n.channel = :channel')
            ->setParameter('channel', $channel)
            ->setFirstResult(max(0, $offset))
            ->setMaxResults(max(1, min(50, $limit)));

        if ($status === 'closed') {
            $qb->andWhere('n.closedAt IS NOT NULL')
                ->orderBy('n.closedAt', 'DESC');
        } elseif ($status === 'all') {
            $qb->orderBy('n.createdAt', 'DESC');
        } else {
            // URGENT sorts after NORMAL alphabetically → DESC puts urgents first.
            $qb->andWhere('n.closedAt IS NULL')
                ->addOrderBy('n.priority', 'DESC')
                ->addOrderBy('n.createdAt', 'DESC');
        }

        $this->applySiteScope($qb, $siteId);

        return $qb->getQuery()->getResult();
    }

    /**
     * @deprecated Use findByChannel(..., status: open)
     *
     * @return DirectionNote[]
     */
    public function findRecentByChannel(
        DirectionNoteChannel $channel,
        ?int $siteId = null,
        int $limit = 20,
    ): array {
        return $this->findByChannel($channel, $siteId, 'open', $limit, 0);
    }

    /**
     * Open notes visible to the user that they have not personally marked as seen.
     *
     * @param list<DirectionNoteChannel> $channels
     *
     * @return array{count: int, latestCreatedAt: ?string}
     */
    public function unreadSummaryForUser(User $user, array $channels, ?int $siteId = null): array
    {
        if ($channels === []) {
            return ['count' => 0, 'latestCreatedAt' => null];
        }

        $qb = $this->createQueryBuilder('n')
            ->select('COUNT(n.id) AS cnt', 'MAX(n.createdAt) AS latest')
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

        $this->applySiteScope($qb, $siteId);

        /** @var array{cnt: string|int, latest: mixed} $row */
        $row = $qb->getQuery()->getSingleResult();
        $latest = $row['latest'] ?? null;
        $latestFormatted = null;
        if ($latest instanceof \DateTimeInterface) {
            $latestFormatted = $latest->format(\DateTimeInterface::ATOM);
        } elseif (\is_string($latest) && $latest !== '') {
            $latestFormatted = (new \DateTimeImmutable($latest))->format(\DateTimeInterface::ATOM);
        }

        return [
            'count' => (int) ($row['cnt'] ?? 0),
            'latestCreatedAt' => $latestFormatted,
        ];
    }

    /**
     * @param list<DirectionNoteChannel> $channels
     */
    public function countUnreadForUser(User $user, array $channels, ?int $siteId = null): int
    {
        return $this->unreadSummaryForUser($user, $channels, $siteId)['count'];
    }

    /**
     * Permanently delete notes closed before the given cutoff (retention).
     */
    public function purgeClosedBefore(\DateTimeImmutable $cutoff): int
    {
        return $this->createQueryBuilder('n')
            ->delete()
            ->andWhere('n.closedAt IS NOT NULL')
            ->andWhere('n.closedAt < :cutoff')
            ->setParameter('cutoff', $cutoff)
            ->getQuery()
            ->execute();
    }

    private function applySiteScope(\Doctrine\ORM\QueryBuilder $qb, ?int $siteId): void
    {
        if ($siteId !== null) {
            $qb->andWhere('IDENTITY(n.site) = :siteId OR n.site IS NULL')
                ->setParameter('siteId', $siteId);

            return;
        }

        // User without a site: never expose notes attached to another site.
        $qb->andWhere('n.site IS NULL');
    }
}
