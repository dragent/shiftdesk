<?php

namespace App\Tests\Integration;

use App\Entity\User;
use App\Enum\UserRole;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * Intégration API caissiers : création / mise à jour du numéro de caissier.
 */
final class CaissierApiTest extends WebTestCase
{
    use ApiTestTrait;

    public function testDirectionCanCreateCaissierWithCashierNumber(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();

        $site = $this->createSite();
        $this->createUser('direction@test.local', UserRole::DIRECTION, $site);
        $auth = $this->loginAs($client, 'direction@test.local');

        $client->request(
            'POST',
            '/api/caissiers',
            server: $this->authHeaders($auth['token']),
            content: json_encode([
                'firstName' => 'Julie',
                'lastName' => 'Martin',
                'cashierNumber' => '101',
                'siteId' => $site->getId(),
                'contractMinutes' => 1800,
            ], JSON_THROW_ON_ERROR),
        );

        self::assertResponseStatusCodeSame(201);
        $payload = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertSame('Julie', $payload['firstName']);
        self::assertSame('Martin', $payload['lastName']);
        self::assertSame('101', $payload['cashierNumber']);
        self::assertSame(1800, $payload['contractMinutes']);

        $stored = $this->em()->getRepository(User::class)->find($payload['id']);
        self::assertInstanceOf(User::class, $stored);
        self::assertSame('101', $stored->getCashierNumber());
        self::assertTrue($stored->hasRole(UserRole::CAISSIER));
    }

    public function testHoteCanPatchCashierNumber(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();

        $site = $this->createSite();
        $this->createUser('hote@test.local', UserRole::HOTE, $site);
        $caissier = $this->createUser(
            'caissier@test.local',
            UserRole::CAISSIER,
            $site,
            firstName: 'Karim',
            lastName: 'Benali',
        );
        $caissier->setCashierNumber('102');
        $this->em()->flush();

        $auth = $this->loginAs($client, 'hote@test.local');

        $client->request(
            'PATCH',
            '/api/caissiers/'.$caissier->getId(),
            server: $this->authHeaders($auth['token']),
            content: json_encode(['cashierNumber' => '202'], JSON_THROW_ON_ERROR),
        );

        self::assertResponseIsSuccessful();
        $payload = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertSame('202', $payload['cashierNumber']);

        $this->em()->clear();
        $stored = $this->em()->getRepository(User::class)->find($caissier->getId());
        self::assertInstanceOf(User::class, $stored);
        self::assertSame('202', $stored->getCashierNumber());
    }

    public function testListExposesCashierNumber(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();

        $site = $this->createSite();
        $this->createUser('hote@test.local', UserRole::HOTE, $site);
        $caissier = $this->createUser(
            'caissier@test.local',
            UserRole::CAISSIER,
            $site,
            firstName: 'Sophie',
            lastName: 'Durand',
        );
        $caissier->setCashierNumber('103');
        $this->em()->flush();

        $auth = $this->loginAs($client, 'hote@test.local');
        $client->request(
            'GET',
            '/api/caissiers',
            server: $this->authHeaders($auth['token']),
        );

        self::assertResponseIsSuccessful();
        $list = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertCount(1, $list);
        self::assertSame('103', $list[0]['cashierNumber']);
    }

    public function testClearCashierNumberWithEmptyString(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();

        $site = $this->createSite();
        $this->createUser('direction@test.local', UserRole::DIRECTION, $site);
        $caissier = $this->createUser('caissier@test.local', UserRole::CAISSIER, $site);
        $caissier->setCashierNumber('101');
        $this->em()->flush();

        $auth = $this->loginAs($client, 'direction@test.local');
        $client->request(
            'PATCH',
            '/api/caissiers/'.$caissier->getId(),
            server: $this->authHeaders($auth['token']),
            content: json_encode(['cashierNumber' => ''], JSON_THROW_ON_ERROR),
        );

        self::assertResponseIsSuccessful();
        $payload = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertTrue(
            !array_key_exists('cashierNumber', $payload)
            || $payload['cashierNumber'] === null
            || $payload['cashierNumber'] === '',
        );

        $this->em()->clear();
        $stored = $this->em()->getRepository(User::class)->find($caissier->getId());
        self::assertInstanceOf(User::class, $stored);
        self::assertNull($stored->getCashierNumber());
    }

    public function testSeedDemoAssignsCashierNumbers(): void
    {
        static::createClient();
        $this->resetDatabaseSchema();

        $application = new \Symfony\Bundle\FrameworkBundle\Console\Application(static::$kernel);
        $application->setAutoExit(false);

        $tester = new \Symfony\Component\Console\Tester\CommandTester(
            $application->find('app:seed-demo'),
        );
        self::assertSame(0, $tester->execute([]));

        $this->em()->clear();
        $repo = $this->em()->getRepository(User::class);
        $expected = [
            'julie.martin@caissier.carrefour-accueil.local' => '101',
            'karim.benali@caissier.carrefour-accueil.local' => '102',
            'sophie.durand@caissier.carrefour-accueil.local' => '103',
        ];

        foreach ($expected as $email => $number) {
            $user = $repo->findOneBy(['email' => $email]);
            self::assertInstanceOf(User::class, $user, $email);
            self::assertSame($number, $user->getCashierNumber(), $email);
        }
    }

    /** @return array{token: string, user: User} */
    private function loginAs(KernelBrowser $client, string $email, string $password = 'Password123!'): array
    {
        $client->request(
            'POST',
            '/api/login',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode(['email' => $email, 'password' => $password], JSON_THROW_ON_ERROR),
        );

        self::assertResponseIsSuccessful();
        $payload = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertArrayHasKey('token', $payload);

        $user = $this->em()->getRepository(User::class)->findOneBy(['email' => $email]);
        self::assertInstanceOf(User::class, $user);

        return ['token' => $payload['token'], 'user' => $user];
    }
}
