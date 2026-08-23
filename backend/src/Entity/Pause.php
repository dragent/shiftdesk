<?php

namespace App\Entity;

use App\Enum\PauseStatus;
use App\Enum\PauseType;
use App\Repository\PauseRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

/**
 * A cashier's break, recorded in real time by reception (host) or by
 * management on behalf of that cashier.
 */
#[ORM\Entity(repositoryClass: PauseRepository::class)]
#[ORM\Table(name: 'pause')]
class Pause
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['pause:read'])]
    private ?int $id = null;

    /**
     * The cashier taking the break.
     */
    #[ORM\ManyToOne(targetEntity: User::class, inversedBy: 'pauses')]
    #[ORM\JoinColumn(name: 'user_id', nullable: false, onDelete: 'CASCADE')]
    #[Groups(['pause:read', 'pause:write'])]
    private User $user;

    /**
     * The reception or management member who recorded the break.
     */
    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'declared_by_id', nullable: true, onDelete: 'SET NULL')]
    #[Groups(['pause:read'])]
    private ?User $declaredBy = null;

    #[ORM\ManyToOne(targetEntity: Planning::class, inversedBy: 'pauses')]
    #[ORM\JoinColumn(name: 'planning_id', nullable: true, onDelete: 'SET NULL')]
    #[Groups(['pause:read', 'pause:write'])]
    private ?Planning $planning = null;

    #[ORM\Column(length: 20, enumType: PauseType::class)]
    #[Groups(['pause:read', 'pause:write'])]
    private PauseType $type = PauseType::COURTE;

    #[ORM\Column(length: 20, enumType: PauseStatus::class)]
    #[Groups(['pause:read'])]
    private PauseStatus $status = PauseStatus::EN_COURS;

    #[ORM\Column]
    #[Groups(['pause:read'])]
    private \DateTimeImmutable $startedAt;

    #[ORM\Column(nullable: true)]
    #[Groups(['pause:read'])]
    private ?\DateTimeImmutable $endedAt = null;

    public function __construct()
    {
        $this->startedAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
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

    public function getDeclaredBy(): ?User
    {
        return $this->declaredBy;
    }

    public function setDeclaredBy(?User $declaredBy): static
    {
        $this->declaredBy = $declaredBy;

        return $this;
    }

    public function getPlanning(): ?Planning
    {
        return $this->planning;
    }

    public function setPlanning(?Planning $planning): static
    {
        $this->planning = $planning;

        return $this;
    }

    public function getType(): PauseType
    {
        return $this->type;
    }

    public function setType(PauseType $type): static
    {
        $this->type = $type;

        return $this;
    }

    public function getStatus(): PauseStatus
    {
        return $this->status;
    }

    public function getStartedAt(): \DateTimeImmutable
    {
        return $this->startedAt;
    }

    public function getEndedAt(): ?\DateTimeImmutable
    {
        return $this->endedAt;
    }

    /**
     * Ends the break in progress and computes its duration.
     */
    public function end(): static
    {
        $this->endedAt = new \DateTimeImmutable();
        $this->status = PauseStatus::TERMINEE;

        return $this;
    }

    public function getDurationInMinutes(): ?int
    {
        if (null === $this->endedAt) {
            return null;
        }

        return (int) round(($this->endedAt->getTimestamp() - $this->startedAt->getTimestamp()) / 60);
    }
}
