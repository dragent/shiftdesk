<?php

namespace App\Entity;

use App\Enum\UserRole;
use App\Repository\UserRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity(repositoryClass: UserRepository::class)]
#[ORM\Table(name: 'app_user')]
#[ORM\UniqueConstraint(name: 'uniq_user_email', fields: ['email'])]
class User implements UserInterface, PasswordAuthenticatedUserInterface
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['user:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 180)]
    #[Assert\NotBlank(message: "L'email est obligatoire.")]
    #[Assert\Email(message: "L'email n'est pas valide.")]
    #[Groups(['user:read', 'user:write'])]
    private string $email;

    /**
     * Rôles Symfony (ROLE_ADMIN, ROLE_DIRECTION, ROLE_HOTE, ROLE_USER...).
     *
     * @var list<string>
     */
    #[ORM\Column]
    #[Groups(['user:read'])]
    private array $roles = [];

    #[ORM\Column]
    private string $password;

    #[ORM\Column(length: 100)]
    #[Groups(['user:read', 'user:write'])]
    private string $firstName;

    #[ORM\Column(length: 100)]
    #[Groups(['user:read', 'user:write'])]
    private string $lastName;

    #[ORM\ManyToOne(targetEntity: Site::class, inversedBy: 'users')]
    #[ORM\JoinColumn(name: 'site_id', nullable: true, onDelete: 'SET NULL')]
    #[Groups(['user:read', 'user:write'])]
    private ?Site $site = null;

    #[ORM\Column]
    #[Groups(['user:read', 'user:write'])]
    private bool $active = true;

    /**
     * Contrat horaire hebdomadaire de l'employé, en minutes (ex: 36h45 =
     * 2205). Utilisé pour comparer le total planifié sur la semaine au
     * contrat (planning direction).
     */
    #[ORM\Column]
    #[Groups(['user:read', 'user:write'])]
    private int $contractMinutes = 0;

    /**
     * Numéro de caissier (identifiant login caisse), distinct du numéro
     * de caisse physique. Utilisé sur le plan de caisse imprimé.
     */
    #[ORM\Column(length: 20, nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?string $cashierNumber = null;

    /** Téléphone de contact de l'employé (fiche employés direction). */
    #[ORM\Column(length: 30, nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?string $phone = null;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    /** @var Collection<int, Planning> */
    #[ORM\OneToMany(targetEntity: Planning::class, mappedBy: 'user')]
    private Collection $plannings;

    /** @var Collection<int, Pause> */
    #[ORM\OneToMany(targetEntity: Pause::class, mappedBy: 'user')]
    private Collection $pauses;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
        $this->plannings = new ArrayCollection();
        $this->pauses = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getEmail(): string
    {
        return $this->email;
    }

    public function setEmail(string $email): static
    {
        $this->email = $email;

        return $this;
    }

    /**
     * A visual identifier that represents this user.
     */
    public function getUserIdentifier(): string
    {
        return (string) $this->email;
    }

    /**
     * @return list<string>
     */
    public function getRoles(): array
    {
        $roles = $this->roles;
        // Tout utilisateur authentifié possède au moins ROLE_USER.
        $roles[] = 'ROLE_USER';

        return array_values(array_unique($roles));
    }

    /**
     * @param list<string> $roles
     */
    public function setRoles(array $roles): static
    {
        $this->roles = $roles;

        return $this;
    }

    public function hasRole(UserRole $role): bool
    {
        return in_array($role->value, $this->getRoles(), true);
    }

    public function getPassword(): string
    {
        return $this->password;
    }

    public function setPassword(string $password): static
    {
        $this->password = $password;

        return $this;
    }

    /**
     * @see PasswordAuthenticatedUserInterface
     */
    public function eraseCredentials(): void
    {
        // Si vous stockez des données temporaires et sensibles sur l'utilisateur, effacez-les ici.
    }

    public function getFirstName(): string
    {
        return $this->firstName;
    }

    public function setFirstName(string $firstName): static
    {
        $this->firstName = $firstName;

        return $this;
    }

    public function getLastName(): string
    {
        return $this->lastName;
    }

    public function setLastName(string $lastName): static
    {
        $this->lastName = $lastName;

        return $this;
    }

    public function getFullName(): string
    {
        return trim($this->firstName.' '.$this->lastName);
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

    public function isActive(): bool
    {
        return $this->active;
    }

    public function setActive(bool $active): static
    {
        $this->active = $active;

        return $this;
    }

    public function getContractMinutes(): int
    {
        return $this->contractMinutes;
    }

    public function setContractMinutes(int $contractMinutes): static
    {
        $this->contractMinutes = max(0, $contractMinutes);

        return $this;
    }

    public function getCashierNumber(): ?string
    {
        return $this->cashierNumber;
    }

    public function setCashierNumber(?string $cashierNumber): static
    {
        $value = $cashierNumber !== null ? trim($cashierNumber) : null;
        $this->cashierNumber = $value === '' ? null : $value;

        return $this;
    }

    public function getPhone(): ?string
    {
        return $this->phone;
    }

    public function setPhone(?string $phone): static
    {
        $value = $phone !== null ? trim($phone) : null;
        $this->phone = $value === '' ? null : $value;

        return $this;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    /** @return Collection<int, Planning> */
    public function getPlannings(): Collection
    {
        return $this->plannings;
    }

    /** @return Collection<int, Pause> */
    public function getPauses(): Collection
    {
        return $this->pauses;
    }
}
