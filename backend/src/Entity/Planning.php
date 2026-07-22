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
 * Créneau de travail planifié par la direction pour un hôte/hôtesse
 * d'accueil (jour + heure de début/fin sur un site donné).
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
