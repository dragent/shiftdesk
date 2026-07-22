<?php

namespace App\Entity;

use App\Enum\DemandeStatus;
use App\Repository\AccueilRequestRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

/**
 * Demande/interaction traitée par un hôte/hôtesse d'accueil,
 * classée selon une RequestCategory (dropdown Caroline / Siebel / Menu Carrefour...).
 */
#[ORM\Entity(repositoryClass: AccueilRequestRepository::class)]
#[ORM\Table(name: 'accueil_request')]
#[ORM\Index(columns: ['created_at'], name: 'idx_request_created_at')]
class AccueilRequest
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['request:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'hote_id', nullable: false, onDelete: 'CASCADE')]
    #[Groups(['request:read', 'request:write'])]
    private User $hote;

    #[ORM\ManyToOne(targetEntity: RequestCategory::class)]
    #[ORM\JoinColumn(name: 'category_id', nullable: false, onDelete: 'RESTRICT')]
    #[Groups(['request:read', 'request:write'])]
    private RequestCategory $category;

    #[ORM\ManyToOne(targetEntity: Site::class)]
    #[ORM\JoinColumn(name: 'site_id', nullable: true, onDelete: 'SET NULL')]
    #[Groups(['request:read', 'request:write'])]
    private ?Site $site = null;

    #[ORM\Column(length: 150, nullable: true)]
    #[Groups(['request:read', 'request:write'])]
    private ?string $visitorName = null;

    #[ORM\Column(length: 200)]
    #[Groups(['request:read', 'request:write'])]
    private string $subject;

    #[ORM\Column(type: 'text', nullable: true)]
    #[Groups(['request:read', 'request:write'])]
    private ?string $description = null;

    #[ORM\Column(length: 20, enumType: DemandeStatus::class)]
    #[Groups(['request:read', 'request:write'])]
    private DemandeStatus $status = DemandeStatus::NOUVELLE;

    #[ORM\Column]
    #[Groups(['request:read'])]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(nullable: true)]
    #[Groups(['request:read'])]
    private ?\DateTimeImmutable $resolvedAt = null;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getHote(): User
    {
        return $this->hote;
    }

    public function setHote(User $hote): static
    {
        $this->hote = $hote;

        return $this;
    }

    public function getCategory(): RequestCategory
    {
        return $this->category;
    }

    public function setCategory(RequestCategory $category): static
    {
        $this->category = $category;

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

    public function getVisitorName(): ?string
    {
        return $this->visitorName;
    }

    public function setVisitorName(?string $visitorName): static
    {
        $this->visitorName = $visitorName;

        return $this;
    }

    public function getSubject(): string
    {
        return $this->subject;
    }

    public function setSubject(string $subject): static
    {
        $this->subject = $subject;

        return $this;
    }

    public function getDescription(): ?string
    {
        return $this->description;
    }

    public function setDescription(?string $description): static
    {
        $this->description = $description;

        return $this;
    }

    public function getStatus(): DemandeStatus
    {
        return $this->status;
    }

    public function setStatus(DemandeStatus $status): static
    {
        $this->status = $status;

        if (DemandeStatus::TRAITEE === $status && null === $this->resolvedAt) {
            $this->resolvedAt = new \DateTimeImmutable();
        }

        return $this;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getResolvedAt(): ?\DateTimeImmutable
    {
        return $this->resolvedAt;
    }
}
