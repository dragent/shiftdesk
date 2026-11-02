<?php

namespace App\Tests\Integration;

use App\Enum\UserRole;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * Direction dashboard notes: Direction→Direction (private) and
 * Direction→Accueil (readable by reception hosts).
 */
final class DirectionNoteApiTest extends WebTestCase
{
    use ApiTestTrait;

    public function testDirectionCanPostAndListInternalNotes(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('direction@test.local', UserRole::DIRECTION, $site);
        $auth = $this->loginAs($client, 'direction@test.local');

        $client->request(
            'POST',
            '/api/direction-notes',
            server: $this->authHeaders($auth['token']),
            content: json_encode([
                'channel' => 'DIRECTION_DIRECTION',
                'body' => 'Briefing managers demain 8h.',
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseStatusCodeSame(201);
        $created = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertSame('DIRECTION_DIRECTION', $created['channel']);
        self::assertSame('Briefing managers demain 8h.', $created['body']);

        $client->request(
            'GET',
            '/api/direction-notes?channel=DIRECTION_DIRECTION',
            server: $this->authHeaders($auth['token']),
        );
        self::assertResponseIsSuccessful();
        $list = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertCount(1, $list);
        self::assertSame($created['id'], $list[0]['id']);
    }

    public function testHoteCanReadAccueilChannelButNotInternal(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('direction@test.local', UserRole::DIRECTION, $site);
        $this->createUser('hote@test.local', UserRole::HOTE, $site);
        $direction = $this->loginAs($client, 'direction@test.local');

        $client->request(
            'POST',
            '/api/direction-notes',
            server: $this->authHeaders($direction['token']),
            content: json_encode([
                'channel' => 'DIRECTION_ACCUEIL',
                'body' => 'Prévoir un hôte supplémentaire samedi.',
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseStatusCodeSame(201);

        $client->request(
            'POST',
            '/api/direction-notes',
            server: $this->authHeaders($direction['token']),
            content: json_encode([
                'channel' => 'DIRECTION_DIRECTION',
                'body' => 'Note interne confidentielle.',
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseStatusCodeSame(201);

        $hote = $this->loginAs($client, 'hote@test.local');

        $client->request(
            'GET',
            '/api/direction-notes?channel=DIRECTION_ACCUEIL',
            server: $this->authHeaders($hote['token']),
        );
        self::assertResponseIsSuccessful();
        $accueil = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertCount(1, $accueil);
        self::assertSame('Prévoir un hôte supplémentaire samedi.', $accueil[0]['body']);

        $client->request(
            'GET',
            '/api/direction-notes?channel=DIRECTION_DIRECTION',
            server: $this->authHeaders($hote['token']),
        );
        self::assertResponseStatusCodeSame(403);
    }

    public function testHoteCannotCreateOrDeleteNotes(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('direction@test.local', UserRole::DIRECTION, $site);
        $this->createUser('hote@test.local', UserRole::HOTE, $site);
        $direction = $this->loginAs($client, 'direction@test.local');

        $client->request(
            'POST',
            '/api/direction-notes',
            server: $this->authHeaders($direction['token']),
            content: json_encode([
                'channel' => 'DIRECTION_ACCUEIL',
                'body' => 'Note à supprimer.',
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseStatusCodeSame(201);
        $created = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);

        $hote = $this->loginAs($client, 'hote@test.local');

        $client->request(
            'POST',
            '/api/direction-notes',
            server: $this->authHeaders($hote['token']),
            content: json_encode([
                'channel' => 'DIRECTION_ACCUEIL',
                'body' => 'Tentative hôte.',
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseStatusCodeSame(403);

        $client->request(
            'DELETE',
            '/api/direction-notes/'.$created['id'],
            server: $this->authHeaders($hote['token']),
        );
        self::assertResponseStatusCodeSame(403);
    }

    public function testDirectionCanDeleteANote(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('direction@test.local', UserRole::DIRECTION, $site);
        $auth = $this->loginAs($client, 'direction@test.local');

        $client->request(
            'POST',
            '/api/direction-notes',
            server: $this->authHeaders($auth['token']),
            content: json_encode([
                'channel' => 'DIRECTION_DIRECTION',
                'body' => 'À retirer.',
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseStatusCodeSame(201);
        $created = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);

        $client->request(
            'DELETE',
            '/api/direction-notes/'.$created['id'],
            server: $this->authHeaders($auth['token']),
        );
        self::assertResponseStatusCodeSame(204);

        $client->request(
            'GET',
            '/api/direction-notes?channel=DIRECTION_DIRECTION',
            server: $this->authHeaders($auth['token']),
        );
        self::assertResponseIsSuccessful();
        $list = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertCount(0, $list);
    }

    public function testDirectionCloseHidesNoteForEveryoneOnBothChannels(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('direction@test.local', UserRole::DIRECTION, $site);
        $this->createUser('hote@test.local', UserRole::HOTE, $site);
        $direction = $this->loginAs($client, 'direction@test.local');

        $client->request(
            'POST',
            '/api/direction-notes',
            server: $this->authHeaders($direction['token']),
            content: json_encode([
                'channel' => 'DIRECTION_ACCUEIL',
                'body' => 'Note à clore pour tout le monde.',
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseStatusCodeSame(201);
        $created = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);

        $client->request(
            'PATCH',
            '/api/direction-notes/'.$created['id'].'/close',
            server: $this->authHeaders($direction['token']),
            content: '{}',
        );
        self::assertResponseStatusCodeSame(200);
        $closed = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertNotNull($closed['closedAt'] ?? null);

        $client->request(
            'GET',
            '/api/direction-notes?channel=DIRECTION_ACCUEIL',
            server: $this->authHeaders($direction['token']),
        );
        self::assertResponseIsSuccessful();
        $listDirection = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertCount(0, $listDirection);

        $hote = $this->loginAs($client, 'hote@test.local');
        $client->request(
            'GET',
            '/api/direction-notes?channel=DIRECTION_ACCUEIL',
            server: $this->authHeaders($hote['token']),
        );
        self::assertResponseIsSuccessful();
        $listHote = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertCount(0, $listHote);
    }

    public function testHoteCannotCloseButCanMarkSeen(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('direction@test.local', UserRole::DIRECTION, $site);
        $this->createUser('hote@test.local', UserRole::HOTE, $site);
        $direction = $this->loginAs($client, 'direction@test.local');

        $client->request(
            'POST',
            '/api/direction-notes',
            server: $this->authHeaders($direction['token']),
            content: json_encode([
                'channel' => 'DIRECTION_ACCUEIL',
                'body' => 'À marquer comme vue.',
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseStatusCodeSame(201);
        $created = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertFalse($created['seenByMe'] ?? true);

        $hote = $this->loginAs($client, 'hote@test.local');

        $client->request(
            'PATCH',
            '/api/direction-notes/'.$created['id'].'/close',
            server: $this->authHeaders($hote['token']),
            content: '{}',
        );
        self::assertResponseStatusCodeSame(403);

        $client->request(
            'POST',
            '/api/direction-notes/'.$created['id'].'/seen',
            server: $this->authHeaders($hote['token']),
            content: '{}',
        );
        self::assertResponseStatusCodeSame(200);
        $seen = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertTrue($seen['seenByMe'] ?? false);

        $client->request(
            'GET',
            '/api/direction-notes?channel=DIRECTION_ACCUEIL',
            server: $this->authHeaders($hote['token']),
        );
        self::assertResponseIsSuccessful();
        $list = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertCount(1, $list);
        self::assertTrue($list[0]['seenByMe'] ?? false);
    }

    public function testUnreadCountUpdatesAfterSeen(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('direction@test.local', UserRole::DIRECTION, $site);
        $this->createUser('hote@test.local', UserRole::HOTE, $site);
        $direction = $this->loginAs($client, 'direction@test.local');

        $client->request(
            'POST',
            '/api/direction-notes',
            server: $this->authHeaders($direction['token']),
            content: json_encode([
                'channel' => 'DIRECTION_ACCUEIL',
                'body' => 'Première note non lue.',
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseStatusCodeSame(201);
        $created = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);

        $client->request(
            'POST',
            '/api/direction-notes',
            server: $this->authHeaders($direction['token']),
            content: json_encode([
                'channel' => 'DIRECTION_ACCUEIL',
                'body' => 'Deuxième note non lue.',
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseStatusCodeSame(201);

        $hote = $this->loginAs($client, 'hote@test.local');
        $client->request(
            'GET',
            '/api/direction-notes/unread-count',
            server: $this->authHeaders($hote['token']),
        );
        self::assertResponseIsSuccessful();
        $before = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertSame(2, $before['count']);

        $client->request(
            'POST',
            '/api/direction-notes/'.$created['id'].'/seen',
            server: $this->authHeaders($hote['token']),
            content: '{}',
        );
        self::assertResponseStatusCodeSame(200);

        $client->request(
            'GET',
            '/api/direction-notes/unread-count',
            server: $this->authHeaders($hote['token']),
        );
        self::assertResponseIsSuccessful();
        $after = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertSame(1, $after['count']);
        self::assertArrayHasKey('latestCreatedAt', $after);
    }

    public function testDirectionCanEditPriorityAndListClosedHistory(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('direction@test.local', UserRole::DIRECTION, $site);
        $this->createUser('hote@test.local', UserRole::HOTE, $site);
        $direction = $this->loginAs($client, 'direction@test.local');

        $client->request(
            'POST',
            '/api/direction-notes',
            server: $this->authHeaders($direction['token']),
            content: json_encode([
                'channel' => 'DIRECTION_ACCUEIL',
                'body' => 'Note à éditer.',
                'priority' => 'URGENT',
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseStatusCodeSame(201);
        $created = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertSame('URGENT', $created['priority']);

        $client->request(
            'PATCH',
            '/api/direction-notes/'.$created['id'],
            server: $this->authHeaders($direction['token']),
            content: json_encode([
                'body' => 'Note éditée.',
                'priority' => 'NORMAL',
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseStatusCodeSame(200);
        $updated = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertSame('Note éditée.', $updated['body']);
        self::assertSame('NORMAL', $updated['priority']);

        $hote = $this->loginAs($client, 'hote@test.local');
        $client->request(
            'POST',
            '/api/direction-notes/'.$created['id'].'/seen',
            server: $this->authHeaders($hote['token']),
            content: '{}',
        );
        self::assertResponseStatusCodeSame(200);

        $client->request(
            'GET',
            '/api/direction-notes/'.$created['id'].'/readers',
            server: $this->authHeaders($direction['token']),
        );
        self::assertResponseIsSuccessful();
        $readers = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertCount(1, $readers);
        self::assertSame('hote@test.local', $readers[0]['user']['email']);

        $client->request(
            'PATCH',
            '/api/direction-notes/'.$created['id'].'/close',
            server: $this->authHeaders($direction['token']),
            content: '{}',
        );
        self::assertResponseStatusCodeSame(200);

        $client->request(
            'GET',
            '/api/direction-notes?channel=DIRECTION_ACCUEIL&status=closed',
            server: $this->authHeaders($direction['token']),
        );
        self::assertResponseIsSuccessful();
        $history = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertCount(1, $history);
        self::assertNotNull($history[0]['closedAt']);

        $client->request(
            'GET',
            '/api/direction-notes?channel=DIRECTION_ACCUEIL&status=closed',
            server: $this->authHeaders($hote['token']),
        );
        self::assertResponseStatusCodeSame(403);
    }

    /** @return array{token: string} */
    private function loginAs(object $client, string $email, string $password = 'Password123!'): array
    {
        $client->request(
            'POST',
            '/api/login',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode(['email' => $email, 'password' => $password], JSON_THROW_ON_ERROR),
        );
        self::assertResponseIsSuccessful();
        $payload = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);

        return ['token' => $payload['token']];
    }
}
