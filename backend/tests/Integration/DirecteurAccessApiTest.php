<?php

namespace App\Tests\Integration;

use App\Enum\UserRole;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * Directeur/rice logs in with Direction access, plus the right to assign
 * Directeur/rice — which Direction itself cannot do.
 */
final class DirecteurAccessApiTest extends WebTestCase
{
    use ApiTestTrait;

    public function testDirecteurCanUseDirectionEndpoints(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('directeur@test.local', UserRole::DIRECTEUR, $site);
        $token = $this->login($client, 'directeur@test.local');

        $client->request('GET', '/api/users', server: $this->authHeaders($token));
        self::assertResponseIsSuccessful();

        $client->request('GET', '/api/ai/insights', server: $this->authHeaders($token));
        self::assertResponseIsSuccessful();

        $client->request(
            'POST',
            '/api/direction-notes',
            server: $this->authHeaders($token),
            content: json_encode([
                'channel' => 'DIRECTION_DIRECTION',
                'body' => 'Note du directeur.',
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseStatusCodeSame(201);
    }

    public function testDirecteurCanRecruitDirection(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('directeur@test.local', UserRole::DIRECTEUR, $site);
        $token = $this->login($client, 'directeur@test.local');

        $client->request(
            'POST',
            '/api/users',
            server: $this->authHeaders($token),
            content: json_encode([
                'firstName' => 'Nadia',
                'lastName' => 'Direction',
                'email' => 'nadia@test.local',
                'role' => 'DIRECTION',
                'siteId' => $site->getId(),
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseStatusCodeSame(201);
    }
}
