<?php

namespace App\Tests\Integration;

use App\Entity\User;
use App\Enum\UserRole;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

/**
 * Negative authorization tests: they fail if a role gains more access than
 * the product allows. Written from a cold audit (fresh session + independent
 * security review) of the API vs frontend-only RoleGuard.
 */
final class AuthorizationBoundaryApiTest extends WebTestCase
{
    use ApiTestTrait;

    public function testDirectionCannotCreateAnAdminAccount(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('direction@test.local', UserRole::DIRECTION, $site);
        $token = $this->login($client, 'direction@test.local');

        $client->request(
            'POST',
            '/api/users',
            server: $this->authHeaders($token),
            content: json_encode([
                'firstName' => 'Super',
                'lastName' => 'Admin',
                'email' => 'promoted@test.local',
                'role' => 'ADMIN',
                'siteId' => $site->getId(),
            ], JSON_THROW_ON_ERROR),
        );

        self::assertResponseStatusCodeSame(403);
        self::assertNull($this->em()->getRepository(User::class)->findOneBy(['email' => 'promoted@test.local']));
    }

    public function testDirectionCannotCreateADirecteurAccount(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('direction@test.local', UserRole::DIRECTION, $site);
        $token = $this->login($client, 'direction@test.local');

        $client->request(
            'POST',
            '/api/users',
            server: $this->authHeaders($token),
            content: json_encode([
                'firstName' => 'Camille',
                'lastName' => 'Directeur',
                'email' => 'directeur@test.local',
                'role' => 'DIRECTEUR',
                'siteId' => $site->getId(),
            ], JSON_THROW_ON_ERROR),
        );

        self::assertResponseStatusCodeSame(403);
        self::assertNull($this->em()->getRepository(User::class)->findOneBy(['email' => 'directeur@test.local']));
    }

    public function testDirectionCannotPromoteAnEmployeeToAdmin(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('direction@test.local', UserRole::DIRECTION, $site);
        $hote = $this->createUser('hote@test.local', UserRole::HOTE, $site);
        $token = $this->login($client, 'direction@test.local');

        $client->request(
            'PATCH',
            '/api/users/'.$hote->getId(),
            server: $this->authHeaders($token),
            content: json_encode(['role' => 'ADMIN'], JSON_THROW_ON_ERROR),
        );

        self::assertResponseStatusCodeSame(403);
        $this->em()->clear();
        $stored = $this->em()->getRepository(User::class)->find($hote->getId());
        self::assertInstanceOf(User::class, $stored);
        self::assertTrue($stored->hasRole(UserRole::HOTE));
        self::assertFalse($stored->hasRole(UserRole::ADMIN));
    }

    public function testDirectionCannotSilentlyResetAnEmployeePassword(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('direction@test.local', UserRole::DIRECTION, $site);
        $hote = $this->createUser('hote@test.local', UserRole::HOTE, $site);
        $token = $this->login($client, 'direction@test.local');

        $client->request(
            'PATCH',
            '/api/users/'.$hote->getId(),
            server: $this->authHeaders($token),
            content: json_encode(['password' => 'Hijacked1!'], JSON_THROW_ON_ERROR),
        );

        self::assertResponseStatusCodeSame(403);
        $this->em()->clear();
        $stored = $this->em()->getRepository(User::class)->find($hote->getId());
        self::assertInstanceOf(User::class, $stored);
        /** @var UserPasswordHasherInterface $hasher */
        $hasher = static::getContainer()->get(UserPasswordHasherInterface::class);
        self::assertTrue($hasher->isPasswordValid($stored, 'Password123!'));
        self::assertFalse($hasher->isPasswordValid($stored, 'Hijacked1!'));
    }

    public function testHoteCannotResetACashierPasswordOrDeactivateTheAccount(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('hote@test.local', UserRole::HOTE, $site);
        $caissier = $this->createUser('caissier@test.local', UserRole::CAISSIER, $site);
        $token = $this->login($client, 'hote@test.local');

        $client->request(
            'PATCH',
            '/api/caissiers/'.$caissier->getId(),
            server: $this->authHeaders($token),
            content: json_encode([
                'password' => 'Hijacked1!',
                'active' => false,
            ], JSON_THROW_ON_ERROR),
        );

        self::assertResponseStatusCodeSame(403);
        $this->em()->clear();
        $stored = $this->em()->getRepository(User::class)->find($caissier->getId());
        self::assertInstanceOf(User::class, $stored);
        self::assertTrue($stored->isActive());
        /** @var UserPasswordHasherInterface $hasher */
        $hasher = static::getContainer()->get(UserPasswordHasherInterface::class);
        self::assertTrue($hasher->isPasswordValid($stored, 'Password123!'));
    }

    public function testHoteCanStillUpdateCashierNumber(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('hote@test.local', UserRole::HOTE, $site);
        $caissier = $this->createUser('caissier@test.local', UserRole::CAISSIER, $site);
        $token = $this->login($client, 'hote@test.local');

        $client->request(
            'PATCH',
            '/api/caissiers/'.$caissier->getId(),
            server: $this->authHeaders($token),
            content: json_encode(['cashierNumber' => '404'], JSON_THROW_ON_ERROR),
        );

        self::assertResponseIsSuccessful();
        $payload = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertSame('404', $payload['cashierNumber']);
    }

    public function testInactiveUserCannotLogin(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $user = $this->createUser('caissier@test.local', UserRole::CAISSIER, $site);
        $user->setActive(false);
        $this->em()->flush();

        $client->request(
            'POST',
            '/api/login',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode([
                'email' => 'caissier@test.local',
                'password' => 'Password123!',
            ], JSON_THROW_ON_ERROR),
        );

        self::assertResponseStatusCodeSame(401);
    }

    public function testDeactivatedUserJwtIsRejected(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('direction@test.local', UserRole::DIRECTION, $site);
        $caissier = $this->createUser('caissier@test.local', UserRole::CAISSIER, $site);
        $cashierToken = $this->login($client, 'caissier@test.local');
        $directionToken = $this->login($client, 'direction@test.local');

        $client->request(
            'PATCH',
            '/api/users/'.$caissier->getId(),
            server: $this->authHeaders($directionToken),
            content: json_encode(['active' => false], JSON_THROW_ON_ERROR),
        );
        self::assertResponseIsSuccessful();

        $client->request('GET', '/api/me', server: $this->authHeaders($cashierToken));

        self::assertResponseStatusCodeSame(401);
    }

    public function testDirectionOnlyListsUsersFromItsOwnSite(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $lyon = $this->createSite('Carrefour Market - Lyon');
        $paris = $this->createSite('Carrefour Market - Paris');
        $direction = $this->createUser('direction.lyon@test.local', UserRole::DIRECTION, $lyon);
        $lyonEmployee = $this->createUser('employee.lyon@test.local', UserRole::CAISSIER, $lyon);
        $parisDirection = $this->createUser('direction.paris@test.local', UserRole::DIRECTION, $paris);
        $parisEmployee = $this->createUser('employee.paris@test.local', UserRole::CAISSIER, $paris);
        $token = $this->login($client, 'direction.lyon@test.local');

        $client->request('GET', '/api/users', server: $this->authHeaders($token));

        self::assertResponseIsSuccessful();
        $payload = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        $ids = array_column($payload, 'id');
        self::assertContains($direction->getId(), $ids);
        self::assertContains($lyonEmployee->getId(), $ids);
        self::assertNotContains($parisDirection->getId(), $ids);
        self::assertNotContains($parisEmployee->getId(), $ids);
    }

    public function testAdminCanListUsersAcrossSites(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $lyon = $this->createSite('Carrefour Market - Lyon');
        $paris = $this->createSite('Carrefour Market - Paris');
        $this->createUser('admin@test.local', UserRole::ADMIN, $lyon);
        $lyonEmployee = $this->createUser('employee.lyon@test.local', UserRole::CAISSIER, $lyon);
        $parisEmployee = $this->createUser('employee.paris@test.local', UserRole::CAISSIER, $paris);
        $token = $this->login($client, 'admin@test.local');

        $client->request('GET', '/api/users', server: $this->authHeaders($token));

        self::assertResponseIsSuccessful();
        $payload = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        $ids = array_column($payload, 'id');
        self::assertContains($lyonEmployee->getId(), $ids);
        self::assertContains($parisEmployee->getId(), $ids);
    }

    public function testAdminCanStillCreateAnAdminAccount(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('admin@test.local', UserRole::ADMIN, $site);
        $token = $this->login($client, 'admin@test.local');

        $client->request(
            'POST',
            '/api/users',
            server: $this->authHeaders($token),
            content: json_encode([
                'firstName' => 'Autre',
                'lastName' => 'Admin',
                'email' => 'autre.admin@test.local',
                'password' => 'Password123!',
                'role' => 'ADMIN',
                'siteId' => $site->getId(),
            ], JSON_THROW_ON_ERROR),
        );

        self::assertResponseStatusCodeSame(201);
        $stored = $this->em()->getRepository(User::class)->findOneBy(['email' => 'autre.admin@test.local']);
        self::assertInstanceOf(User::class, $stored);
        self::assertTrue($stored->hasRole(UserRole::ADMIN));
    }
}
