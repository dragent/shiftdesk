<?php

namespace App\Entity;

use App\Repository\RequestCategoryRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Catégorie de demande d'accueil, affichée dans le dropdown de saisie
 * (ex. "Caroline", "Siebel", "Menu Carrefour"). Entièrement configurable
 * par un administrateur, sans redéploiement.
 */
#[ORM\Entity(repositoryClass: RequestCategoryRepository::class)]
#[ORM\Table(name: 'request_category')]
#[ORM\UniqueConstraint(name: 'uniq_category_code', fields: ['code'])]
class RequestCategory
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['category:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 50)]
    #[Assert\NotBlank(message: 'Le code de la catégorie est obligatoire.')]
    #[Groups(['category:read', 'category:write'])]
    private string $code;

    #[ORM\Column(length: 100)]
    #[Assert\NotBlank(message: 'Le libellé de la catégorie est obligatoire.')]
    #[Groups(['category:read', 'category:write'])]
    private string $label;

    #[ORM\Column(length: 255, nullable: true)]
    #[Groups(['category:read', 'category:write'])]
    private ?string $description = null;

    #[ORM\Column]
    #[Groups(['category:read', 'category:write'])]
    private bool $active = true;

    #[ORM\Column]
    #[Groups(['category:read', 'category:write'])]
    private int $position = 0;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getCode(): string
    {
        return $this->code;
    }

    public function setCode(string $code): static
    {
        $this->code = $code;

        return $this;
    }

    public function getLabel(): string
    {
        return $this->label;
    }

    public function setLabel(string $label): static
    {
        $this->label = $label;

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

    public function isActive(): bool
    {
        return $this->active;
    }

    public function setActive(bool $active): static
    {
        $this->active = $active;

        return $this;
    }

    public function getPosition(): int
    {
        return $this->position;
    }

    public function setPosition(int $position): static
    {
        $this->position = $position;

        return $this;
    }
}
