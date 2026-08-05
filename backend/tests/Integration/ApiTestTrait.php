<?php

namespace App\Tests\Integration;

use App\Entity\Site;
use App\Entity\User;
use App\Enum\UserRole;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Tools\SchemaTool;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

/**
 * Helpers partagés pour les tests d'intégration HTTP (schéma SQLite en
 * mémoire, création d'utilisateurs, login JWT).
 */
trait ApiTestTrait
{
    private function resetDatabaseSchema(): void
    {
        /** @var EntityManagerInterface $em */
        $em = static::getContainer()->get('doctrine')->getManager();
        $em->clear();

        // Supprimer le fichier SQLite de test pour repartir d'une base vide
        // (évite les résidus entre tests et les soucis de :memory: multi-connexions).
        $params = $em->getConnection()->getParams();
        $path = $params['path'] ?? null;
        if (is_string($path) && $path !== '' && is_file($path)) {
            $em->getConnection()->close();
            unlink($path);
        }

        $metadata = $em->getMetadataFactory()->getAllMetadata();
        $tool = new SchemaTool($em);
        $tool->dropSchema($metadata);
        $tool->createSchema($metadata);
    }

    private function em(): EntityManagerInterface
    {
        /** @var EntityManagerInterface $em */
        $em = static::getContainer()->get('doctrine')->getManager();

        return $em;
    }

    private function createSite(string $name = 'Carrefour Market - Test'): Site
    {
        $site = new Site();
        $site->setName($name);
        $site->setAddress('1 rue Test');
        $site->setPostalCode('69001');
        $site->setCity('Lyon');
        $this->em()->persist($site);
        $this->em()->flush();

        return $site;
    }

    private function createUser(
        string $email,
        UserRole $role,
        Site $site,
        string $password = 'Password123!',
        int $contractMinutes = 0,
        string $firstName = 'Test',
        string $lastName = 'User',
    ): User {
        /** @var UserPasswordHasherInterface $hasher */
        $hasher = static::getContainer()->get(UserPasswordHasherInterface::class);

        $user = new User();
        $user->setEmail($email);
        $user->setFirstName($firstName);
        $user->setLastName($lastName);
        $user->setRoles([$role->value]);
        $user->setSite($site);
        $user->setContractMinutes($contractMinutes);
        $user->setPassword($hasher->hashPassword($user, $password));

        $this->em()->persist($user);
        $this->em()->flush();

        return $user;
    }

    /** @return array<string, string> */
    private function authHeaders(string $token): array
    {
        return [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
        ];
    }
}
