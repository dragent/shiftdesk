<?php

namespace App\Entity;

use App\Enum\PlanningStatus;
use App\Repository\PlanningRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Context;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Serializer\Normalizer\DateTimeNormalizer;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Work slot scheduled by management for an employee (reception host or
 * cashier): day plus start/end time on a given site.
 */
#[ORM\Entity(repositoryClass: PlanningRepository::class)]
#[ORM\Table(name: 'planning')]
#[ORM\Index(columns: ['work_date'], name: 'idx_planning_date')]
class Planning
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['planning:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: User::class, inversedBy: 'plannings')]
    #[ORM\JoinColumn(name: 'user_id', nullable: false, onDelete: 'CASCADE')]
    #[Groups(['planning:read', 'planning:write'])]
    private User $user;

    #[ORM\ManyToOne(targetEntity: Site::class, inversedBy: 'plannings')]
    #[ORM\JoinColumn(name: 'site_id', nullable: true, onDelete: 'SET NULL')]
    #[Groups(['planning:read', 'planning:write'])]
    private ?Site $site = null;

    #[ORM\Column(name: 'work_date', type: 'date_immutable')]
    #[Groups(['planning:read', 'planning:write'])]
    #[Context([DateTimeNormalizer::FORMAT_KEY => 'Y-m-d'])]
    private \DateTimeImmutable $workDate;

    #[ORM\Column(type: 'time_immutable')]
    #[Groups(['planning:read', 'planning:write'])]
    #[Context([DateTimeNormalizer::FORMAT_KEY => 'H:i'])]
    private \DateTimeImmutable $startTime;

    #[ORM\Column(type: 'time_immutable')]
    #[Groups(['planning:read', 'planning:write'])]
    #[Context([DateTimeNormalizer::FORMAT_KEY => 'H:i'])]
    private \DateTimeImmutable $endTime;

    #[ORM\Column(length: 20, enumType: PlanningStatus::class)]
    #[Groups(['planning:read', 'planning:write'])]
    private PlanningStatus $status = PlanningStatus::PLANIFIE;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'created_by_id', nullable: true, onDelete: 'SET NULL')]
    #[Groups(['planning:read'])]
    private ?User $createdBy = null;

    #[ORM\Column(length: 255, nullable: true)]
    #[Groups(['planning:read', 'planning:write'])]
    private ?string $note = null;

    /**
     * Indicates that a LAD or a reception host is assigned to a register for
     * this slot (rather than to their usual position). Cashiers do not use
     * this flag (their role already places them on a register).
     */
    #[ORM\Column(name: 'en_caisse', options: ['default' => false])]
    #[Groups(['planning:read', 'planning:write'])]
    private bool $enCaisse = false;

    /**
     * Register number assigned to this slot (register layout): 1 to 8 for a
     * numbered register, 0 for supervising the self-service registers, or -1
     * for a "Pauses / Retour" assignment (the cashier holds no register:
     * they cover colleagues' breaks or handle returns). Set by reception or
     * management, and only relevant for cashier slots. Mutually exclusive
     * with $registerSegments (null when the slot is split into successive
     * register assignments).
     */
    #[ORM\Column(nullable: true)]
    #[Groups(['planning:read', 'planning:write'])]
    private ?int $registerNumber = null;

    /**
     * Split of a slot into several register assignments (switching register
     * during the shift), e.g. register 3 from 07:30 to 10:00 then the
     * self-service registers from 10:00 to 14:00. Array of
     * {startTime: "HH:mm", registerNumber: int} objects ordered by ascending
     * time, restricted to numbered registers (1-8) and self-service
     * registers (0) — no "Pauses / Retour" within a split. The first segment
     * always starts at the slot start time. Mutually exclusive with
     * $registerNumber (one or the other, never both at once).
     *
     * @var array<int, array{startTime: string, registerNumber: int}>|null
     */
    #[ORM\Column(type: 'json', nullable: true)]
    #[Groups(['planning:read', 'planning:write'])]
    private ?array $registerSegments = null;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column]
    private \DateTimeImmutable $updatedAt;

    /** @var Collection<int, Pause> */
    #[ORM\OneToMany(targetEntity: Pause::class, mappedBy: 'planning')]
    private Collection $pauses;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
        $this->updatedAt = new \DateTimeImmutable();
        $this->pauses = new ArrayCollection();
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

    public function getSite(): ?Site
    {
        return $this->site;
    }

    public function setSite(?Site $site): static
    {
        $this->site = $site;

        return $this;
    }

    public function getWorkDate(): \DateTimeImmutable
    {
        return $this->workDate;
    }

    public function setWorkDate(\DateTimeImmutable $workDate): static
    {
        $this->workDate = $workDate;

        return $this;
    }

    public function getStartTime(): \DateTimeImmutable
    {
        return $this->startTime;
    }

    public function setStartTime(\DateTimeImmutable $startTime): static
    {
        $this->startTime = $startTime;

        return $this;
    }

    public function getEndTime(): \DateTimeImmutable
    {
        return $this->endTime;
    }

    public function setEndTime(\DateTimeImmutable $endTime): static
    {
        $this->endTime = $endTime;

        return $this;
    }

    public function getStatus(): PlanningStatus
    {
        return $this->status;
    }

    public function setStatus(PlanningStatus $status): static
    {
        $this->status = $status;
        $this->touch();

        return $this;
    }

    public function getCreatedBy(): ?User
    {
        return $this->createdBy;
    }

    public function setCreatedBy(?User $createdBy): static
    {
        $this->createdBy = $createdBy;

        return $this;
    }

    public function getNote(): ?string
    {
        return $this->note;
    }

    public function setNote(?string $note): static
    {
        $this->note = $note;

        return $this;
    }

    public function isEnCaisse(): bool
    {
        return $this->enCaisse;
    }

    public function setEnCaisse(bool $enCaisse): static
    {
        $this->enCaisse = $enCaisse;

        return $this;
    }

    public function getRegisterNumber(): ?int
    {
        return $this->registerNumber;
    }

    public function setRegisterNumber(?int $registerNumber): static
    {
        $this->registerNumber = $registerNumber;
        $this->touch();

        return $this;
    }

    /** @return array<int, array{startTime: string, registerNumber: int}>|null */
    public function getRegisterSegments(): ?array
    {
        return $this->registerSegments;
    }

    /** @param array<int, array{startTime: string, registerNumber: int}>|null $registerSegments */
    public function setRegisterSegments(?array $registerSegments): static
    {
        $this->registerSegments = $registerSegments;
        $this->touch();

        return $this;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getUpdatedAt(): \DateTimeImmutable
    {
        return $this->updatedAt;
    }

    public function touch(): void
    {
        $this->updatedAt = new \DateTimeImmutable();
    }

    /** @return Collection<int, Pause> */
    public function getPauses(): Collection
    {
        return $this->pauses;
    }
}
