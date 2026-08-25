<?php

namespace App\Entity;

use App\Repository\DirectionNoteSeenRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Context;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Serializer\Normalizer\DateTimeNormalizer;

/**
 * Personal "seen" receipt on a direction note. Closing a note is global
 * (Direction only); marking it seen is per user.
 */
#[ORM\Entity(repositoryClass: DirectionNoteSeenRepository::class)]
#[ORM\Table(name: 'direction_note_seen')]
#[ORM\UniqueConstraint(name: 'uniq_direction_note_seen_user', columns: ['note_id', 'user_id'])]
class DirectionNoteSeen
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: DirectionNote::class, inversedBy: 'seens')]
    #[ORM\JoinColumn(name: 'note_id', nullable: false, onDelete: 'CASCADE')]
    private DirectionNote $note;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'user_id', nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\Column]
    #[Groups(['direction_note:read'])]
    #[Context([DateTimeNormalizer::FORMAT_KEY => \DateTimeInterface::ATOM])]
    private \DateTimeImmutable $seenAt;

    public function __construct()
    {
        $this->seenAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getNote(): DirectionNote
    {
        return $this->note;
    }

    public function setNote(DirectionNote $note): static
    {
        $this->note = $note;

        return $this;
    }

    public function getUser(): User
    {
        return $this->user;
    }

    public function setUser(User $user): static
    {
        $this->user = $user;

        return $this;
    }

    public function getSeenAt(): \DateTimeImmutable
    {
        return $this->seenAt;
    }

    public function touchSeenAt(): static
    {
        $this->seenAt = new \DateTimeImmutable();

        return $this;
    }
}
