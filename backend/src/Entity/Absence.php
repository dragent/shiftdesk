<?php

namespace App\Entity;

use App\Enum\AbsenceReason;
use App\Repository\AbsenceRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Context;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Serializer\Normalizer\DateTimeNormalizer;

/**
 * Absence d'un employé sur une période (arrêt de travail ou congé) :
 * bloque la saisie d'horaires et l'émargement sur le planning imprimé.
 */
#[ORM\Entity(repositoryClass: AbsenceRepository::class)]
#[ORM\Table(name: 'absence')]
#[ORM\Index(columns: ['start_date', 'end_date'], name: 'idx_absence_dates')]
class Absence
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['absence:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'user_id', nullable: false, onDelete: 'CASCADE')]
    #[Groups(['absence:read', 'absence:write'])]
    private User $user;

    #[ORM\Column(length: 30, enumType: AbsenceReason::class)]
    #[Groups(['absence:read', 'absence:write'])]
    private AbsenceReason $reason;

    #[ORM\Column(name: 'start_date', type: 'date_immutable')]
    #[Groups(['absence:read', 'absence:write'])]
    #[Context([DateTimeNormalizer::FORMAT_KEY => 'Y-m-d'])]
    private \DateTimeImmutable $startDate;

    #[ORM\Column(name: 'end_date', type: 'date_immutable')]
    #[Groups(['absence:read', 'absence:write'])]
    #[Context([DateTimeNormalizer::FORMAT_KEY => 'Y-m-d'])]
    private \DateTimeImmutable $endDate;

    /**
     * Horaires de début/fin de l'arrêt de travail (null pour un congé,
     * qui reste affiché sans horaires).
     */
    #[ORM\Column(name: 'start_time', type: 'time_immutable', nullable: true)]
    #[Groups(['absence:read', 'absence:write'])]
    #[Context([DateTimeNormalizer::FORMAT_KEY => 'H:i'])]
    private ?\DateTimeImmutable $startTime = null;

    #[ORM\Column(name: 'end_time', type: 'time_immutable', nullable: true)]
    #[Groups(['absence:read', 'absence:write'])]
    #[Context([DateTimeNormalizer::FORMAT_KEY => 'H:i'])]
    private ?\DateTimeImmutable $endTime = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'created_by_id', nullable: true, onDelete: 'SET NULL')]
    #[Groups(['absence:read'])]
    private ?User $createdBy = null;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column]
    private \DateTimeImmutable $updatedAt;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
        $this->updatedAt = new \DateTimeImmutable();
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

    public function getReason(): AbsenceReason
    {
        return $this->reason;
    }

    public function setReason(AbsenceReason $reason): static
    {
        $this->reason = $reason;

        return $this;
    }

    public function getStartDate(): \DateTimeImmutable
    {
        return $this->startDate;
    }

    public function setStartDate(\DateTimeImmutable $startDate): static
    {
        $this->startDate = $startDate;

        return $this;
    }

    public function getEndDate(): \DateTimeImmutable
    {
        return $this->endDate;
    }

    public function setEndDate(\DateTimeImmutable $endDate): static
    {
        $this->endDate = $endDate;

        return $this;
    }

    public function getStartTime(): ?\DateTimeImmutable
    {
        return $this->startTime;
    }

    public function setStartTime(?\DateTimeImmutable $startTime): static
    {
        $this->startTime = $startTime;

        return $this;
    }

    public function getEndTime(): ?\DateTimeImmutable
    {
        return $this->endTime;
    }

    public function setEndTime(?\DateTimeImmutable $endTime): static
    {
        $this->endTime = $endTime;

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

    public function coversDate(\DateTimeImmutable $date): bool
    {
        $day = $date->setTime(0, 0);
        $start = $this->startDate->setTime(0, 0);
        $end = $this->endDate->setTime(0, 0);

        return $day >= $start && $day <= $end;
    }
}
