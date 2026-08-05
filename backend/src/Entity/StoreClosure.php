<?php

namespace App\Entity;

use App\Enum\HalfDay;
use App\Repository\StoreClosureRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Context;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Serializer\Normalizer\DateTimeNormalizer;

/**
 * Fermeture magasin sur une période : bloque la saisie d'horaires
 * pour tous les employés à partir d'une demi-journée de début.
 */
#[ORM\Entity(repositoryClass: StoreClosureRepository::class)]
#[ORM\Table(name: 'store_closure')]
#[ORM\Index(columns: ['start_date', 'end_date'], name: 'idx_store_closure_dates')]
class StoreClosure
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['closure:read'])]
    private ?int $id = null;

    #[ORM\Column(name: 'start_date', type: 'date_immutable')]
    #[Groups(['closure:read', 'closure:write'])]
    #[Context([DateTimeNormalizer::FORMAT_KEY => 'Y-m-d'])]
    private \DateTimeImmutable $startDate;

    #[ORM\Column(name: 'start_half_day', length: 20, enumType: HalfDay::class)]
    #[Groups(['closure:read', 'closure:write'])]
    private HalfDay $startHalfDay;

    #[ORM\Column(name: 'end_date', type: 'date_immutable')]
    #[Groups(['closure:read', 'closure:write'])]
    #[Context([DateTimeNormalizer::FORMAT_KEY => 'Y-m-d'])]
    private \DateTimeImmutable $endDate;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'created_by_id', nullable: true, onDelete: 'SET NULL')]
    #[Groups(['closure:read'])]
    private ?User $createdBy = null;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
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

    public function getStartHalfDay(): HalfDay
    {
        return $this->startHalfDay;
    }

    public function setStartHalfDay(HalfDay $startHalfDay): static
    {
        $this->startHalfDay = $startHalfDay;

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

    /**
     * Indique si la demi-journée donnée est couverte par cette fermeture.
     */
    public function covers(\DateTimeImmutable $date, HalfDay $halfDay): bool
    {
        $day = $date->setTime(0, 0);
        $start = $this->startDate->setTime(0, 0);
        $end = $this->endDate->setTime(0, 0);

        if ($day < $start || $day > $end) {
            return false;
        }

        if ($day > $start) {
            return true;
        }

        // Jour de début : à partir de la demi-journée choisie.
        if ($this->startHalfDay === HalfDay::MATIN) {
            return true;
        }

        return $halfDay === HalfDay::APRES_MIDI;
    }
}
