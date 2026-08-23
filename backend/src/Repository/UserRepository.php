<?php

namespace App\Repository;

use App\Entity\User;
use App\Enum\UserRole;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Security\Core\Exception\UnsupportedUserException;
use Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface;
use Symfony\Component\Security\Core\User\PasswordUpgraderInterface;

/**
 * @extends ServiceEntityRepository<User>
 */
class UserRepository extends ServiceEntityRepository implements PasswordUpgraderInterface
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, User::class);
    }

    public function upgradePassword(PasswordAuthenticatedUserInterface $user, string $newHashedPassword): void
    {
        if (!$user instanceof User) {
            throw new UnsupportedUserException(sprintf('Instances of "%s" are not supported.', $user::class));
        }

        $user->setPassword($newHashedPassword);
        $this->getEntityManager()->persist($user);
        $this->getEntityManager()->flush();
    }

    public function findOneByEmail(string $email): ?User
    {
        return $this->findOneBy(['email' => $email]);
    }

    /**
     * Deactivates the accounts whose dismissal date has been reached. The
     * stack has no scheduler: dated dismissals therefore take effect on the
     * first read of the employee list occurring after their date.
     *
     * @return int number of accounts switched to dismissed
     */
    public function deactivateDueDismissals(\DateTimeImmutable $today): int
    {
        return (int) $this->createQueryBuilder('u')
            ->update()
            ->set('u.active', ':inactive')
            ->andWhere('u.active = :stillActive')
            ->andWhere('u.dismissedAt IS NOT NULL')
            ->andWhere('u.dismissedAt <= :today')
            ->setParameter('inactive', false)
            ->setParameter('stillActive', true)
            ->setParameter('today', $today, Types::DATE_IMMUTABLE)
            ->getQuery()
            ->execute();
    }

    /**
     * Returns the users holding a given business role (e.g. all the
     * cashiers). The role is stored in a JSON column, hence the filtering
     * through a text search on its serialized representation.
     *
     * @return User[]
     */
    public function findByRole(UserRole $role): array
    {
        return $this->createQueryBuilder('u')
            ->andWhere('u.roles LIKE :role')
            ->setParameter('role', '%"'.$role->value.'"%')
            ->orderBy('u.lastName', 'ASC')
            ->addOrderBy('u.firstName', 'ASC')
            ->getQuery()
            ->getResult();
    }
}
