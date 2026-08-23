<?php

namespace App\Tests\Integration;

use App\Entity\User;
use App\Enum\UserRole;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * Insertion / persistance des contrats horaires (code couleur planning).
 */
final class UserContractInsertionTest extends WebTestCase
{
    use ApiTestTrait;

    public function testContractMinutesArePersistedForAllDemoRoles(): void
    {
        static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();

        $contracts = [
            ['direction@test.local', UserRole::DIRECTION, 2100],
            ['rayon@test.local', UserRole::RAYON, 2100],
            ['lad@test.local', UserRole::LAD, 2100],
            ['securite@test.local', UserRole::SECURITE, 2100],
            ['hote@test.local', UserRole::HOTE, 2205],
            ['caissier@test.local', UserRole::CAISSIER, 1800],
        ];

        foreach ($contracts as [$email, $role, $minutes]) {
            $this->createUser($email, $role, $site, contractMinutes: $minutes);
        }

        $repo = $this->em()->getRepository(User::class);
        foreach ($contracts as [$email, $role, $minutes]) {
            $user = $repo->findOneBy(['email' => $email]);
            self::assertInstanceOf(User::class, $user, $email);
            self::assertSame($minutes, $user->getContractMinutes(), $email);
            self::assertTrue($user->hasRole($role), $email);
        }
    }

    public function testUsersListExposesContractMinutesToDirection(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('direction@test.local', UserRole::DIRECTION, $site, contractMinutes: 2100);
        $this->createUser('rayon@test.local', UserRole::RAYON, $site, contractMinutes: 2100);

        $client->request(
            'POST',
            '/api/login',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode([
                'email' => 'direction@test.local',
                'password' => 'Password123!',
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseIsSuccessful();
        $login = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);

        $client->request(
            'GET',
            '/api/users',
            server: [
                'HTTP_AUTHORIZATION' => 'Bearer '.$login['token'],
                'CONTENT_TYPE' => 'application/json',
            ],
        );
        self::assertResponseIsSuccessful();
        $users = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);

        $byEmail = [];
        foreach ($users as $user) {
            $byEmail[$user['email']] = $user;
        }

        self::assertSame(2100, $byEmail['direction@test.local']['contractMinutes']);
        self::assertSame(2100, $byEmail['rayon@test.local']['contractMinutes']);
    }

    public function testRecruitmentStoresTheContractSentByManagement(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('direction@test.local', UserRole::DIRECTION, $site);

        $client->request(
            'POST',
            '/api/login',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode([
                'email' => 'direction@test.local',
                'password' => 'Password123!',
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseIsSuccessful();
        $login = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);

        // La fiche employés n'envoie plus de mot de passe : le backend en génère
        // un temporaire et l'envoie par email à la personne recrutée.
        $client->request(
            'POST',
            '/api/users',
            server: $this->authHeaders($login['token']),
            content: json_encode([
                'firstName' => 'Julie',
                'lastName' => 'Moreau',
                'email' => 'julie.moreau@test.local',
                'role' => 'HOTE',
                'contractMinutes' => 1800,
                'siteId' => $site->getId(),
            ], JSON_THROW_ON_ERROR),
        );

        self::assertResponseStatusCodeSame(201);
        $payload = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertSame(1800, $payload['contractMinutes']);

        $this->em()->clear();
        $stored = $this->em()->getRepository(User::class)->find($payload['id']);
        self::assertInstanceOf(User::class, $stored);
        self::assertSame(1800, $stored->getContractMinutes());
        self::assertTrue($stored->hasRole(UserRole::HOTE));
    }

    public function testSeedDemoAssignsContractsToEveryone(): void
    {
        static::createClient();
        $this->resetDatabaseSchema();

        $application = new \Symfony\Bundle\FrameworkBundle\Console\Application(static::$kernel);
        $application->setAutoExit(false);

        $tester = new \Symfony\Component\Console\Tester\CommandTester(
            $application->find('app:seed-demo'),
        );
        $status = $tester->execute([]);
        self::assertSame(0, $status);

        // Recharger l'EM après la commande (elle utilise le même kernel/container).
        $this->em()->clear();
        $repo = $this->em()->getRepository(User::class);
        $expected = [
            'direction@carrefour-accueil.local' => 2100,
            'hote@carrefour-accueil.local' => 2205,
            'lad@carrefour-accueil.local' => 2100,
            'rayon@carrefour-accueil.local' => 2100,
            'securite@carrefour-accueil.local' => 2100,
            'karim.benali@caissier.carrefour-accueil.local' => 2205,
            'sophie.durand@caissier.carrefour-accueil.local' => 2205,
            'julie.martin@caissier.carrefour-accueil.local' => 1800,
        ];

        foreach ($expected as $email => $minutes) {
            $user = $repo->findOneBy(['email' => $email]);
            self::assertInstanceOf(User::class, $user, $email);
            self::assertSame($minutes, $user->getContractMinutes(), $email);
        }
    }
}
