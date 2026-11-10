<?php

namespace App\Entity;

use App\Enum\UserRole;
use App\Repository\UserRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Component\Serializer\Attribute\Context;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Serializer\Attribute\SerializedName;
use Symfony\Component\Serializer\Normalizer\DateTimeNormalizer;
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
     * Stored Symfony roles. Serialized through {@see getRoles()} so implied
     * category roles (e.g. ROLE_DIRECTION on a Directeur/rice) are visible
     * to the frontend, matching the firewall hierarchy.
     *
     * @var list<string>
     */
    #[ORM\Column]
    private array $roles = [];

    #[ORM\ManyToOne(targetEntity: Job::class, inversedBy: 'users')]
    #[ORM\JoinColumn(name: 'job_id', nullable: true, onDelete: 'SET NULL')]
    #[Groups(['user:read'])]
    private ?Job $job = null;

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
     * Weekly contract hours of the employee, in minutes (e.g. 36h45 =
     * 2205). Used to compare the total scheduled over the week against
     * the contract (management schedule).
     */
    #[ORM\Column]
    #[Groups(['user:read', 'user:write'])]
    private int $contractMinutes = 0;

    /**
     * Cashier number (register login identifier), distinct from the
     * physical register number. Used on the printed register layout.
     */
    #[ORM\Column(length: 20, nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?string $cashierNumber = null;

    /** Contact phone number of the employee (management employee record). */
    #[ORM\Column(length: 30, nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?string $phone = null;

    /**
     * Effective date of the dismissal, entered by management. Null while the
     * employee is still in post (and reset to null on rehire).
     */
    #[ORM\Column(name: 'dismissed_at', type: 'date_immutable', nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    #[Context([DateTimeNormalizer::FORMAT_KEY => 'Y-m-d'])]
    private ?\DateTimeImmutable $dismissedAt = null;

    /**
     * When true, the user must set a personal password before using the app
     * (set on recruitment with a temporary password emailed to them).
     */
    #[ORM\Column(name: 'must_change_password')]
    #[Groups(['user:read'])]
    private bool $mustChangePassword = false;

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
    #[Groups(['user:read'])]
    #[SerializedName('roles')]
    public function getRoles(): array
    {
        $roles = $this->roles;

        // A job also carries the roles of its category (e.g. Directeur/rice
        // holds ROLE_DIRECTION), so that permission checks made in PHP see the
        // same set as the firewall, which applies security.yaml role_hierarchy.
        foreach ($this->roles as $role) {
            foreach (UserRole::tryFrom($role)?->impliedRoles() ?? [] as $implied) {
                $roles[] = $implied->value;
            }
        }

        // Every authenticated user holds at least ROLE_USER.
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

    public function getJob(): ?Job
    {
        return $this->job;
    }

    public function setJob(?Job $job): static
    {
        $this->job = $job;

        return $this;
    }

    /** Binds the métier and the permission role it grants. */
    public function assignJob(Job $job): static
    {
        $this->job = $job;
        $this->roles = [$job->getGrantsRole()->value];

        return $this;
    }

    public function hasRole(UserRole $role): bool
    {
        return in_array($role->value, $this->getRoles(), true);
    }

    /**
     * Permission check that follows the store hierarchy (Directeur/rice →
     * Direction → other jobs). Use {@see hasRole()} when the question is
     * the person's actual job, not what they are allowed to do.
     */
    public function hasAccess(UserRole $role): bool
    {
        foreach ($this->roles as $stored) {
            $owned = UserRole::tryFrom($stored);
            if ($owned?->grants($role)) {
                return true;
            }
        }

        return false;
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
        // Clear any temporary, sensitive data stored on the user here.
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

    public function getDismissedAt(): ?\DateTimeImmutable
    {
        return $this->dismissedAt;
    }

    public function setDismissedAt(?\DateTimeImmutable $dismissedAt): static
    {
        $this->dismissedAt = $dismissedAt;

        return $this;
    }

    public function isMustChangePassword(): bool
    {
        return $this->mustChangePassword;
    }

    public function setMustChangePassword(bool $mustChangePassword): static
    {
        $this->mustChangePassword = $mustChangePassword;

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
