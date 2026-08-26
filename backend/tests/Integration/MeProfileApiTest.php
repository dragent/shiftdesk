<?php

namespace App\Tests\Integration;

use App\Enum\UserRole;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * An employee can update their own email and phone from the profile page.
 */
final class MeProfileApiTest extends WebTestCase
{
    use ApiTestTrait;

    public function testCashierCanUpdateEmailAndPhone(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('caissier@test.local', UserRole::CAISSIER, $site);

        $token = $this->login($client, 'caissier@test.local');

        $client->request(
            'PATCH',
            '/api/me',
            server: $this->authHeaders($token),
            content: json_encode([
                'email' => 'sophie.nouveau@test.local',
                'phone' => '06 99 00 00 01',
            ], JSON_THROW_ON_ERROR),
        );

        self::assertResponseIsSuccessful();
        $payload = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertSame('sophie.nouveau@test.local', $payload['email']);
        self::assertSame('06 99 00 00 01', $payload['phone']);
        self::assertArrayHasKey('token', $payload);
        self::assertNotSame('', $payload['token']);

        $client->request('GET', '/api/me', server: $this->authHeaders($payload['token']));
        self::assertResponseIsSuccessful();
        $me = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertSame('sophie.nouveau@test.local', $me['email']);
        self::assertSame('06 99 00 00 01', $me['phone']);
    }

    public function testPhoneOnlyUpdateKeepsTheCurrentSession(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $user = $this->createUser('hote@test.local', UserRole::HOTE, $site);
        $user->setPhone('06 12 00 00 00');
        $this->em()->flush();

        $token = $this->login($client, 'hote@test.local');

        $client->request(
            'PATCH',
            '/api/me',
            server: $this->authHeaders($token),
            content: json_encode([
                'email' => 'hote@test.local',
                'phone' => '07 11 22 33 44',
            ], JSON_THROW_ON_ERROR),
        );

        self::assertResponseIsSuccessful();
        $payload = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertSame('07 11 22 33 44', $payload['phone']);
        self::assertArrayNotHasKey('token', $payload);

        $client->request('GET', '/api/me', server: $this->authHeaders($token));
        self::assertResponseIsSuccessful();
        $me = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertSame('hote@test.local', $me['email']);
        self::assertSame('07 11 22 33 44', $me['phone']);
    }

    public function testDuplicateEmailIsRejected(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('caissier@test.local', UserRole::CAISSIER, $site);
        $this->createUser('pris@test.local', UserRole::HOTE, $site);

        $token = $this->login($client, 'caissier@test.local');

        $client->request(
            'PATCH',
            '/api/me',
            server: $this->authHeaders($token),
            content: json_encode([
                'email' => 'pris@test.local',
                'phone' => '06 00 00 00 00',
            ], JSON_THROW_ON_ERROR),
        );

        self::assertResponseStatusCodeSame(409);
    }

    public function testInvalidEmailIsRejected(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('caissier@test.local', UserRole::CAISSIER, $site);

        $token = $this->login($client, 'caissier@test.local');

        $client->request(
            'PATCH',
            '/api/me',
            server: $this->authHeaders($token),
            content: json_encode([
                'email' => 'pas-un-email',
                'phone' => null,
            ], JSON_THROW_ON_ERROR),
        );

        self::assertResponseStatusCodeSame(422);
    }
}
