<?php

namespace App\Entity;

use App\Enum\PauseStatus;
use App\Enum\PauseType;
use App\Repository\PauseRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

/**
 * Une pause d'un(e) caissier(ère), saisie en temps réel par l'accueil
 * (hôte/hôtesse) ou la direction pour le compte de ce caissier.
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
     * Le caissier / la caissière qui prend la pause.
     */
    #[ORM\ManyToOne(targetEntity: User::class, inversedBy: 'pauses')]
    #[ORM\JoinColumn(name: 'user_id', nullable: false, onDelete: 'CASCADE')]
    #[Groups(['pause:read', 'pause:write'])]
    private User $user;

    /**
     * La personne de l'accueil/direction qui a saisi la pause.
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
     * Termine la pause en cours et calcule sa durée.
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
