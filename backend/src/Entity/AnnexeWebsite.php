<?php

namespace App\Entity;

use App\Enum\UserRole;
use App\Repository\AnnexeWebsiteRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Context;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Serializer\Normalizer\DateTimeNormalizer;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Useful website listed in the store annex. Created by Direction.
 * Visibility for other jobs is gated by {@see $allowedRoles}.
 */
#[ORM\Entity(repositoryClass: AnnexeWebsiteRepository::class)]
#[ORM\Table(name: 'annexe_website')]
class AnnexeWebsite
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['annexe_website:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 150)]
    #[Assert\NotBlank(message: 'Le nom du site est obligatoire.')]
    #[Assert\Length(max: 150)]
    #[Groups(['annexe_website:read', 'annexe_website:write'])]
    private string $name = '';

    #[ORM\Column(length: 500)]
    #[Assert\NotBlank(message: "L'adresse du site est obligatoire.")]
    #[Assert\Length(max: 500)]
    #[Assert\Url(message: "L'adresse du site n'est pas une URL valide.", requireTld: false)]
    #[Groups(['annexe_website:read', 'annexe_website:write'])]
    private string $url = '';

    /**
     * Symfony roles allowed to see this website (e.g. ROLE_CAISSIER).
     *
     * @var list<string>
     */
    #[ORM\Column(type: 'json')]
    #[Groups(['annexe_website:read', 'annexe_website:write'])]
    private array $allowedRoles = [];

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'created_by_id', nullable: false, onDelete: 'CASCADE')]
    #[Groups(['annexe_website:read'])]
    private User $createdBy;

    #[ORM\ManyToOne(targetEntity: Site::class)]
    #[ORM\JoinColumn(name: 'site_id', nullable: true, onDelete: 'SET NULL')]
    #[Groups(['annexe_website:read'])]
    private ?Site $site = null;

    #[ORM\Column]
    #[Groups(['annexe_website:read'])]
    #[Context([DateTimeNormalizer::FORMAT_KEY => \DateTimeInterface::ATOM])]
    private \DateTimeImmutable $createdAt;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): static
    {
        $this->name = trim($name);

        return $this;
    }

    public function getUrl(): string
    {
        return $this->url;
    }

    public function setUrl(string $url): static
    {
        $trimmed = trim($url);
        if ($trimmed !== '' && !preg_match('#^https?://#i', $trimmed)) {
            $trimmed = 'https://'.$trimmed;
        }
        $this->url = $trimmed;

        return $this;
    }

    /**
     * @return list<string>
     */
    public function getAllowedRoles(): array
    {
        return $this->allowedRoles;
    }

    /**
     * @param list<string> $allowedRoles
     */
    public function setAllowedRoles(array $allowedRoles): static
    {
        $this->allowedRoles = array_values(array_unique($allowedRoles));

        return $this;
    }

    public function isAccessibleBy(User $user): bool
    {
        foreach ($user->getRoles() as $role) {
            if (\in_array($role, $this->allowedRoles, true)) {
                return true;
            }
        }

        return $user->hasAccess(UserRole::DIRECTION);
    }

    public function getCreatedBy(): User
    {
        return $this->createdBy;
    }

    public function setCreatedBy(User $createdBy): static
    {
        $this->createdBy = $createdBy;

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
}
