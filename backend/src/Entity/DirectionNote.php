<?php

namespace App\Entity;

use App\Enum\DirectionNoteChannel;
use App\Repository\DirectionNoteRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Context;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Serializer\Normalizer\DateTimeNormalizer;

/**
 * Short operational note posted by management on the dashboard:
 * either internal (Direction → Direction) or shared with reception
 * (Direction → Accueil).
 *
 * Closing (`closedAt`) hides the note for everyone. Marking as seen is
 * personal via {@see DirectionNoteSeen}.
 */
#[ORM\Entity(repositoryClass: DirectionNoteRepository::class)]
#[ORM\Table(name: 'direction_note')]
#[ORM\Index(columns: ['channel', 'created_at'], name: 'idx_direction_note_channel_created')]
class DirectionNote
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['direction_note:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 40, enumType: DirectionNoteChannel::class)]
    #[Groups(['direction_note:read', 'direction_note:write'])]
    private DirectionNoteChannel $channel;

    #[ORM\Column(type: 'text')]
    #[Groups(['direction_note:read', 'direction_note:write'])]
    private string $body;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'author_id', nullable: false, onDelete: 'CASCADE')]
    #[Groups(['direction_note:read'])]
    private User $author;

    #[ORM\ManyToOne(targetEntity: Site::class)]
    #[ORM\JoinColumn(name: 'site_id', nullable: true, onDelete: 'SET NULL')]
    #[Groups(['direction_note:read'])]
    private ?Site $site = null;

    #[ORM\Column]
    #[Groups(['direction_note:read'])]
    #[Context([DateTimeNormalizer::FORMAT_KEY => \DateTimeInterface::ATOM])]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(nullable: true)]
    #[Groups(['direction_note:read'])]
    #[Context([DateTimeNormalizer::FORMAT_KEY => \DateTimeInterface::ATOM])]
    private ?\DateTimeImmutable $closedAt = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'closed_by_id', nullable: true, onDelete: 'SET NULL')]
    #[Groups(['direction_note:read'])]
    private ?User $closedBy = null;

    /** @var Collection<int, DirectionNoteSeen> */
    #[ORM\OneToMany(targetEntity: DirectionNoteSeen::class, mappedBy: 'note', orphanRemoval: true)]
    private Collection $seens;

    /**
     * Hydrated by the API for the current viewer (not persisted).
     */
    #[Groups(['direction_note:read'])]
    private bool $seenByMe = false;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
        $this->seens = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getChannel(): DirectionNoteChannel
    {
        return $this->channel;
    }

    public function setChannel(DirectionNoteChannel $channel): static
    {
        $this->channel = $channel;

        return $this;
    }

    public function getBody(): string
    {
        return $this->body;
    }

    public function setBody(string $body): static
    {
        $this->body = $body;

        return $this;
    }

    public function getAuthor(): User
    {
        return $this->author;
    }

    public function setAuthor(User $author): static
    {
        $this->author = $author;

        return $this;
    }

    public function getSite(): ?Site
    {
        return $this->site;
    }

    public function setSite(?Site $site): static
    {
        $this->site = $site;

        return $this;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getClosedAt(): ?\DateTimeImmutable
    {
        return $this->closedAt;
    }

    public function isClosed(): bool
    {
        return null !== $this->closedAt;
    }

    public function close(User $closedBy): static
    {
        $this->closedAt = new \DateTimeImmutable();
        $this->closedBy = $closedBy;

        return $this;
    }

    public function getClosedBy(): ?User
    {
        return $this->closedBy;
    }

    /** @return Collection<int, DirectionNoteSeen> */
    public function getSeens(): Collection
    {
        return $this->seens;
    }

    public function isSeenByMe(): bool
    {
        return $this->seenByMe;
    }

    public function setSeenByMe(bool $seenByMe): static
    {
        $this->seenByMe = $seenByMe;

        return $this;
    }
}
