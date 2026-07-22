<?php

namespace App\Entity;

use App\Enum\InsightSeverity;
use App\Enum\InsightStatus;
use App\Enum\InsightType;
use App\Repository\PlanningInsightRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Context;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Serializer\Normalizer\DateTimeNormalizer;

/**
 * Alerte/insight généré par le module IA de supervision de planning
 * (ex. sous-effectif détecté, conflit de pauses, surcharge sur un créneau).
 *
 * Cette entité est le point d'intégration entre le back Symfony et le
 * micro-service IA (voir ai-service/). Le back peut soit :
 *  - interroger le micro-service IA à la demande (endpoint /api/ai/analyze),
 *  - soit recevoir un webhook du micro-service et persister le résultat ici.
 */
#[ORM\Entity(repositoryClass: PlanningInsightRepository::class)]
#[ORM\Table(name: 'planning_insight')]
#[ORM\Index(columns: ['target_date'], name: 'idx_insight_target_date')]
class PlanningInsight
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['insight:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 30, enumType: InsightType::class)]
    #[Groups(['insight:read'])]
    private InsightType $type;

    #[ORM\Column(length: 20, enumType: InsightSeverity::class)]
    #[Groups(['insight:read'])]
    private InsightSeverity $severity;

    #[ORM\ManyToOne(targetEntity: Site::class)]
    #[ORM\JoinColumn(name: 'site_id', nullable: true, onDelete: 'SET NULL')]
    #[Groups(['insight:read'])]
    private ?Site $site = null;

    #[ORM\Column(name: 'target_date', type: 'date_immutable')]
    #[Groups(['insight:read'])]
    #[Context([DateTimeNormalizer::FORMAT_KEY => 'Y-m-d'])]
    private \DateTimeImmutable $targetDate;

    #[ORM\Column(type: 'text')]
    #[Groups(['insight:read'])]
    private string $message;

    /**
     * Données brutes retournées par le micro-service IA (détails, scores,
     * effectifs calculés, etc.), utile pour audit/debug/future UI avancée.
     *
     * @var array<string, mixed>|null
     */
    #[ORM\Column(type: 'json', nullable: true)]
    #[Groups(['insight:read'])]
    private ?array $payload = null;

    #[ORM\Column(length: 20, enumType: InsightStatus::class)]
    #[Groups(['insight:read', 'insight:write'])]
    private InsightStatus $status = InsightStatus::NOUVELLE;

    #[ORM\Column]
    #[Groups(['insight:read'])]
    private \DateTimeImmutable $createdAt;

    public function __construct(InsightType $type, InsightSeverity $severity, \DateTimeImmutable $targetDate, string $message)
    {
        $this->type = $type;
        $this->severity = $severity;
        $this->targetDate = $targetDate;
        $this->message = $message;
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getType(): InsightType
    {
        return $this->type;
    }

    public function getSeverity(): InsightSeverity
    {
        return $this->severity;
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

    public function getTargetDate(): \DateTimeImmutable
    {
        return $this->targetDate;
    }

    public function getMessage(): string
    {
        return $this->message;
    }

    /** @return array<string, mixed>|null */
    public function getPayload(): ?array
    {
        return $this->payload;
    }

    /** @param array<string, mixed>|null $payload */
    public function setPayload(?array $payload): static
    {
        $this->payload = $payload;

        return $this;
    }

    public function getStatus(): InsightStatus
    {
        return $this->status;
    }

    public function setStatus(InsightStatus $status): static
    {
        $this->status = $status;

        return $this;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }
}
