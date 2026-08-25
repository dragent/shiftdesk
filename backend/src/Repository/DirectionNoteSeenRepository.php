<?php

namespace App\Repository;

use App\Entity\DirectionNote;
use App\Entity\DirectionNoteSeen;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<DirectionNoteSeen>
 */
class DirectionNoteSeenRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, DirectionNoteSeen::class);
    }

    public function findOneByNoteAndUser(DirectionNote $note, User $user): ?DirectionNoteSeen
    {
        return $this->findOneBy([
            'note' => $note,
            'user' => $user,
        ]);
    }

    /**
     * @param DirectionNote[] $notes
     *
     * @return array<int, true> note ids already seen by this user
     */
    public function seenNoteIdsForUser(array $notes, User $user): array
    {
        if ($notes === []) {
            return [];
        }

        $ids = array_values(array_filter(array_map(
            static fn (DirectionNote $note) => $note->getId(),
            $notes,
        )));
        if ($ids === []) {
            return [];
        }

        /** @var list<int> $seenIds */
        $seenIds = $this->createQueryBuilder('s')
            ->select('IDENTITY(s.note)')
            ->andWhere('s.note IN (:notes)')
            ->andWhere('s.user = :user')
            ->setParameter('notes', $notes)
            ->setParameter('user', $user)
            ->getQuery()
            ->getSingleColumnResult();

        $map = [];
        foreach ($seenIds as $id) {
            $map[(int) $id] = true;
        }

        return $map;
    }

    /**
     * @param DirectionNote[] $notes
     *
     * @return array<int, int> noteId => seen count
     */
    public function seenCountsForNotes(array $notes): array
    {
        if ($notes === []) {
            return [];
        }

        /** @var list<array{noteId: string|int, cnt: string|int}> $rows */
        $rows = $this->createQueryBuilder('s')
            ->select('IDENTITY(s.note) AS noteId', 'COUNT(s.id) AS cnt')
            ->andWhere('s.note IN (:notes)')
            ->setParameter('notes', $notes)
            ->groupBy('s.note')
            ->getQuery()
            ->getArrayResult();

        $map = [];
        foreach ($rows as $row) {
            $map[(int) $row['noteId']] = (int) $row['cnt'];
        }

        return $map;
    }

    /**
     * @return list<array{user: User, seenAt: \DateTimeImmutable}>
     */
    public function findReadersForNote(DirectionNote $note): array
    {
        /** @var DirectionNoteSeen[] $rows */
        $rows = $this->createQueryBuilder('s')
            ->addSelect('u')
            ->join('s.user', 'u')
            ->andWhere('s.note = :note')
            ->setParameter('note', $note)
            ->orderBy('s.seenAt', 'DESC')
            ->getQuery()
            ->getResult();

        $out = [];
        foreach ($rows as $row) {
            $out[] = [
                'user' => $row->getUser(),
                'seenAt' => $row->getSeenAt(),
            ];
        }

        return $out;
    }
}
