<?php

namespace App\Tests\Integration;

use App\Enum\UserRole;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * Store annex: websites (Direction only) and named files (Direction + Accueil).
 */
final class AnnexeApiTest extends WebTestCase
{
    use ApiTestTrait;

    public function testDirectionCanCreateWebsiteAndHoteSeesItWhenAllowed(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('direction@test.local', UserRole::DIRECTION, $site);
        $this->createUser('hote@test.local', UserRole::HOTE, $site);
        $this->createUser('caisse@test.local', UserRole::CAISSIER, $site);

        $direction = $this->login($client, 'direction@test.local');

        $client->request(
            'POST',
            '/api/annexe/websites',
            server: $this->authHeaders($direction),
            content: json_encode([
                'name' => 'Caroline',
                'url' => 'intranet.carrefour.local/caroline',
                'allowedRoles' => ['ROLE_HOTE', 'ROLE_CAISSIER'],
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseStatusCodeSame(201);
        $created = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertSame('Caroline', $created['name']);
        self::assertSame('https://intranet.carrefour.local/caroline', $created['url']);
        self::assertContains('ROLE_HOTE', $created['allowedRoles']);

        $hote = $this->login($client, 'hote@test.local');
        $client->request('GET', '/api/annexe/websites', server: $this->authHeaders($hote));
        self::assertResponseIsSuccessful();
        $hoteList = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertCount(1, $hoteList);
        self::assertSame('Caroline', $hoteList[0]['name']);

        $caissier = $this->login($client, 'caisse@test.local');
        $client->request('GET', '/api/annexe/websites', server: $this->authHeaders($caissier));
        self::assertResponseIsSuccessful();
        $caisseList = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertCount(1, $caisseList);
    }

    public function testCaissierDoesNotSeeWebsiteReservedToHote(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('direction@test.local', UserRole::DIRECTION, $site);
        $this->createUser('caisse@test.local', UserRole::CAISSIER, $site);
        $direction = $this->login($client, 'direction@test.local');

        $client->request(
            'POST',
            '/api/annexe/websites',
            server: $this->authHeaders($direction),
            content: json_encode([
                'name' => 'Siebel interne',
                'url' => 'https://siebel.example',
                'allowedRoles' => ['ROLE_HOTE'],
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseStatusCodeSame(201);

        $caissier = $this->login($client, 'caisse@test.local');
        $client->request('GET', '/api/annexe/websites', server: $this->authHeaders($caissier));
        self::assertResponseIsSuccessful();
        $list = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertSame([], $list);
    }

    public function testHoteCannotCreateWebsite(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('hote@test.local', UserRole::HOTE, $site);
        $token = $this->login($client, 'hote@test.local');

        $client->request(
            'POST',
            '/api/annexe/websites',
            server: $this->authHeaders($token),
            content: json_encode([
                'name' => 'Interdit',
                'url' => 'https://example.test',
                'allowedRoles' => ['ROLE_HOTE'],
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseStatusCodeSame(403);
    }

    public function testHoteAndDirectionCanAddAndDeleteFiles(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('direction@test.local', UserRole::DIRECTION, $site);
        $this->createUser('hote@test.local', UserRole::HOTE, $site);
        $this->createUser('caisse@test.local', UserRole::CAISSIER, $site);

        $hote = $this->login($client, 'hote@test.local');
        $client->request(
            'POST',
            '/api/annexe/files',
            server: $this->authHeaders($hote),
            content: json_encode(['name' => 'consigne-accueil.pdf'], JSON_THROW_ON_ERROR),
        );
        self::assertResponseStatusCodeSame(201);
        $created = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertSame('consigne-accueil.pdf', $created['name']);

        $direction = $this->login($client, 'direction@test.local');
        $client->request(
            'POST',
            '/api/annexe/files',
            server: $this->authHeaders($direction),
            content: json_encode(['name' => 'note-direction.docx'], JSON_THROW_ON_ERROR),
        );
        self::assertResponseStatusCodeSame(201);

        $client->request('GET', '/api/annexe/files', server: $this->authHeaders($direction));
        self::assertResponseIsSuccessful();
        $list = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertCount(2, $list);

        $caissier = $this->login($client, 'caisse@test.local');
        $client->request('GET', '/api/annexe/files', server: $this->authHeaders($caissier));
        self::assertResponseStatusCodeSame(403);

        $client->request(
            'DELETE',
            '/api/annexe/files/'.$created['id'],
            server: $this->authHeaders($direction),
        );
        self::assertResponseStatusCodeSame(204);
    }

    public function testWebsiteRequiresAtLeastOneMetier(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('direction@test.local', UserRole::DIRECTION, $site);
        $token = $this->login($client, 'direction@test.local');

        $client->request(
            'POST',
            '/api/annexe/websites',
            server: $this->authHeaders($token),
            content: json_encode([
                'name' => 'Sans métier',
                'url' => 'https://example.test',
                'allowedRoles' => [],
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseStatusCodeSame(422);
    }

    public function testDirectionCanDeleteWebsite(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('direction@test.local', UserRole::DIRECTION, $site);
        $token = $this->login($client, 'direction@test.local');

        $client->request(
            'POST',
            '/api/annexe/websites',
            server: $this->authHeaders($token),
            content: json_encode([
                'name' => 'Menu Carrefour',
                'url' => 'https://menu.example',
                'allowedRoles' => ['ROLE_DIRECTION'],
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseStatusCodeSame(201);
        $created = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);

        $client->request(
            'DELETE',
            '/api/annexe/websites/'.$created['id'],
            server: $this->authHeaders($token),
        );
        self::assertResponseStatusCodeSame(204);

        $client->request('GET', '/api/annexe/websites', server: $this->authHeaders($token));
        $list = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertSame([], $list);
    }
}
