<?php

namespace App\Entity;

use App\Repository\SiteRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * A site represents a physical reception point: store, hypermarket or
 * office location. Allows several locations to be managed from a single
 * instance of the application.
 */
#[ORM\Entity(repositoryClass: SiteRepository::class)]
#[ORM\Table(name: 'site')]
class Site
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['site:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 150)]
    #[Assert\NotBlank(message: 'Le nom du site est obligatoire.')]
    #[Groups(['site:read', 'site:write'])]
    private string $name;

    #[ORM\Column(length: 255, nullable: true)]
    #[Groups(['site:read', 'site:write'])]
    private ?string $address = null;

    #[ORM\Column(length: 20, nullable: true)]
    #[Groups(['site:read', 'site:write'])]
    private ?string $postalCode = null;

    #[ORM\Column(length: 100, nullable: true)]
    #[Groups(['site:read', 'site:write'])]
    private ?string $city = null;

    #[ORM\Column]
    #[Groups(['site:read', 'site:write'])]
    private bool $active = true;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    /** @var Collection<int, User> */
    #[ORM\OneToMany(targetEntity: User::class, mappedBy: 'site')]
    private Collection $users;

    /** @var Collection<int, Planning> */
    #[ORM\OneToMany(targetEntity: Planning::class, mappedBy: 'site')]
    private Collection $plannings;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
        $this->users = new ArrayCollection();
        $this->plannings = new ArrayCollection();
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
        $this->name = $name;

        return $this;
    }

    public function getAddress(): ?string
    {
        return $this->address;
    }

    public function setAddress(?string $address): static
    {
        $this->address = $address;

        return $this;
    }

    public function getPostalCode(): ?string
    {
        return $this->postalCode;
    }

    public function setPostalCode(?string $postalCode): static
    {
        $this->postalCode = $postalCode;

        return $this;
    }

    public function getCity(): ?string
    {
        return $this->city;
    }

    public function setCity(?string $city): static
    {
        $this->city = $city;

        return $this;
    }

    public function isActive(): bool
    {
        return $this->active;
    }

    public function setActive(bool $active): static
    {
        $this->active = $active;

        return $this;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }
}
