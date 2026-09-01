<?php

namespace App\Entity;

use App\Enum\JobCategory;
use App\Enum\UserRole;
use App\Repository\JobRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * A métier inside a job category (e.g. Directeur/rice in Direction).
 * Categories are fixed; direction may add jobs and remove a vacant one,
 * except the protected Directeur/rice job.
 */
#[ORM\Entity(repositoryClass: JobRepository::class)]
#[ORM\Table(name: 'job')]
#[ORM\UniqueConstraint(name: 'uniq_job_code', fields: ['code'])]
class Job
{
    public const CODE_DIRECTEUR = 'DIRECTEUR';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['job:read', 'user:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 50)]
    #[Assert\NotBlank(message: 'Le code du poste est obligatoire.')]
    #[Assert\Regex(pattern: '/^[A-Z][A-Z0-9_]{0,48}$/', message: 'Code de poste invalide.')]
    #[Groups(['job:read', 'user:read'])]
    private string $code;

    #[ORM\Column(length: 100)]
    #[Assert\NotBlank(message: 'Le libellé du poste est obligatoire.')]
    #[Groups(['job:read', 'user:read'])]
    private string $label;

    #[ORM\Column(enumType: JobCategory::class, length: 30)]
    #[Groups(['job:read', 'user:read'])]
    private JobCategory $category;

    /**
     * Symfony role stored on the employee for access control.
     */
    #[ORM\Column(enumType: UserRole::class, length: 50)]
    #[Groups(['job:read'])]
    private UserRole $grantsRole;

    #[ORM\Column]
    #[Groups(['job:read', 'user:read'])]
    private bool $protected = false;

    #[ORM\Column]
    #[Groups(['job:read'])]
    private int $position = 0;

    /** @var Collection<int, User> */
    #[ORM\OneToMany(targetEntity: User::class, mappedBy: 'job')]
    private Collection $users;

    public function __construct()
    {
        $this->users = new ArrayCollection();
    }

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

    public function getCategory(): JobCategory
    {
        return $this->category;
    }

    public function setCategory(JobCategory $category): static
    {
        $this->category = $category;

        return $this;
    }

    public function getGrantsRole(): UserRole
    {
        return $this->grantsRole;
    }

    public function setGrantsRole(UserRole $grantsRole): static
    {
        $this->grantsRole = $grantsRole;

        return $this;
    }

    public function isProtected(): bool
    {
        return $this->protected;
    }

    public function setProtected(bool $protected): static
    {
        $this->protected = $protected;

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

    /** @return Collection<int, User> */
    public function getUsers(): Collection
    {
        return $this->users;
    }

    /** Employees still in post on this job. */
    #[Groups(['job:read'])]
    public function getOccupantCount(): int
    {
        $count = 0;
        foreach ($this->users as $user) {
            if ($user->isActive()) {
                ++$count;
            }
        }

        return $count;
    }
}
