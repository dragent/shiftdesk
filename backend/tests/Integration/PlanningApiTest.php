<?php

namespace App\Tests\Integration;

use App\Entity\Planning;
use App\Entity\User;
use App\Enum\UserRole;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * Intégration + insertion : création de créneaux planning via l'API
 * (début 4h Direction/Rayon, pause déjeuner, droits, lecture).
 */
final class PlanningApiTest extends WebTestCase
{
    use ApiTestTrait;

    public function testDirectionCanInsertEarlyMorningShiftForDirectionEmployee(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();

        $site = $this->createSite();
        $direction = $this->createUser(
            'direction@test.local',
            UserRole::DIRECTION,
            $site,
            contractMinutes: 2100,
            firstName: 'Nadia',
            lastName: 'Direction',
        );
        $auth = $this->loginAs($client, 'direction@test.local');

        $client->request(
            'POST',
            '/api/plannings',
            server: $this->authHeaders($auth['token']),
            content: json_encode([
                'userId' => $direction->getId(),
                'workDate' => '2026-07-27',
                'startTime' => '04:00',
                'endTime' => '12:00',
            ], JSON_THROW_ON_ERROR),
        );

        self::assertResponseStatusCodeSame(201);
        $payload = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertSame('04:00', $payload['startTime']);
        self::assertSame('12:00', $payload['endTime']);
        self::assertSame('2026-07-27', $payload['workDate']);
        self::assertSame($direction->getId(), $payload['user']['id']);

        $stored = $this->em()->getRepository(Planning::class)->find($payload['id']);
        self::assertInstanceOf(Planning::class, $stored);
        self::assertSame('04:00', $stored->getStartTime()->format('H:i'));
        self::assertSame('12:00', $stored->getEndTime()->format('H:i'));
    }

    public function testDirectionCanInsertEarlyMorningShiftForRayonEmployee(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();

        $site = $this->createSite();
        $this->createUser('direction@test.local', UserRole::DIRECTION, $site, contractMinutes: 2100);
        $rayon = $this->createUser(
            'rayon@test.local',
            UserRole::RAYON,
            $site,
            contractMinutes: 2100,
            firstName: 'Fatou',
            lastName: 'Rayon',
        );
        $auth = $this->loginAs($client, 'direction@test.local');

        $client->request(
            'POST',
            '/api/plannings',
            server: $this->authHeaders($auth['token']),
            content: json_encode([
                'userId' => $rayon->getId(),
                'workDate' => '2026-07-28',
                'startTime' => '04:00',
                'endTime' => '11:30',
            ], JSON_THROW_ON_ERROR),
        );

        self::assertResponseStatusCodeSame(201);
        $payload = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertSame('04:00', $payload['startTime']);
        self::assertSame($rayon->getId(), $payload['user']['id']);
        self::assertSame(2100, $payload['user']['contractMinutes']);
    }

    public function testInsertRejectsInsufficientLunchBreak(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();

        $site = $this->createSite();
        $direction = $this->createUser('direction@test.local', UserRole::DIRECTION, $site, contractMinutes: 2100);
        $auth = $this->loginAs($client, 'direction@test.local');

        $client->request(
            'POST',
            '/api/plannings',
            server: $this->authHeaders($auth['token']),
            content: json_encode([
                'userId' => $direction->getId(),
                'workDate' => '2026-07-27',
                'startTime' => '04:00',
                'endTime' => '12:00',
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseStatusCodeSame(201);

        // Coupure de 30 min seulement (< 1h exigée).
        $client->request(
            'POST',
            '/api/plannings',
            server: $this->authHeaders($auth['token']),
            content: json_encode([
                'userId' => $direction->getId(),
                'workDate' => '2026-07-27',
                'startTime' => '12:30',
                'endTime' => '20:15',
            ], JSON_THROW_ON_ERROR),
        );

        self::assertResponseStatusCodeSame(422);
        $payload = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertArrayHasKey('error', $payload);
        self::assertStringContainsString('1h', $payload['error']);
    }

    public function testInsertAcceptsValidLunchBreakThenListsWeek(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();

        $site = $this->createSite();
        $direction = $this->createUser('direction@test.local', UserRole::DIRECTION, $site, contractMinutes: 2100);
        $auth = $this->loginAs($client, 'direction@test.local');

        $client->request(
            'POST',
            '/api/plannings',
            server: $this->authHeaders($auth['token']),
            content: json_encode([
                'userId' => $direction->getId(),
                'workDate' => '2026-07-27',
                'startTime' => '04:00',
                'endTime' => '12:00',
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseStatusCodeSame(201);

        $client->request(
            'POST',
            '/api/plannings',
            server: $this->authHeaders($auth['token']),
            content: json_encode([
                'userId' => $direction->getId(),
                'workDate' => '2026-07-27',
                'startTime' => '13:00',
                'endTime' => '20:15',
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseStatusCodeSame(201);

        $client->request(
            'GET',
            '/api/plannings?from=2026-07-27&to=2026-08-02',
            server: $this->authHeaders($auth['token']),
        );
        self::assertResponseIsSuccessful();
        $list = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertCount(2, $list);
        $starts = array_column($list, 'startTime');
        sort($starts);
        self::assertSame(['04:00', '13:00'], $starts);
    }

    public function testHoteCannotInsertPlanning(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();

        $site = $this->createSite();
        $hote = $this->createUser(
            'hote@test.local',
            UserRole::HOTE,
            $site,
            contractMinutes: 2205,
            firstName: 'Caroline',
            lastName: 'Hotesse',
        );
        $auth = $this->loginAs($client, 'hote@test.local');

        $client->request(
            'POST',
            '/api/plannings',
            server: $this->authHeaders($auth['token']),
            content: json_encode([
                'userId' => $hote->getId(),
                'workDate' => '2026-07-27',
                'startTime' => '07:30',
                'endTime' => '14:00',
            ], JSON_THROW_ON_ERROR),
        );

        self::assertResponseStatusCodeSame(403);
    }

    public function testMissingFieldsRejectedOnInsert(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();

        $site = $this->createSite();
        $direction = $this->createUser('direction@test.local', UserRole::DIRECTION, $site);
        $auth = $this->loginAs($client, 'direction@test.local');

        $client->request(
            'POST',
            '/api/plannings',
            server: $this->authHeaders($auth['token']),
            content: json_encode(['userId' => $direction->getId()], JSON_THROW_ON_ERROR),
        );

        self::assertResponseStatusCodeSame(422);
    }

    public function testLadCanBeMarkedEnCaisseOnInsert(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();

        $site = $this->createSite();
        $this->createUser('direction@test.local', UserRole::DIRECTION, $site);
        $lad = $this->createUser(
            'lad@test.local',
            UserRole::LAD,
            $site,
            contractMinutes: 2100,
            firstName: 'Yanis',
            lastName: 'Lad',
        );
        $auth = $this->loginAs($client, 'direction@test.local');

        $client->request(
            'POST',
            '/api/plannings',
            server: $this->authHeaders($auth['token']),
            content: json_encode([
                'userId' => $lad->getId(),
                'workDate' => '2026-07-27',
                'startTime' => '07:30',
                'endTime' => '14:00',
                'enCaisse' => true,
            ], JSON_THROW_ON_ERROR),
        );

        self::assertResponseStatusCodeSame(201);
        $payload = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertTrue($payload['enCaisse']);

        $stored = $this->em()->getRepository(Planning::class)->find($payload['id']);
        self::assertInstanceOf(Planning::class, $stored);
        self::assertTrue($stored->isEnCaisse());
    }

    public function testHoteCanBeMarkedEnCaisseOnInsert(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();

        $site = $this->createSite();
        $this->createUser('direction@test.local', UserRole::DIRECTION, $site);
        $hote = $this->createUser(
            'hote@test.local',
            UserRole::HOTE,
            $site,
            contractMinutes: 2205,
            firstName: 'Caroline',
            lastName: 'Hotesse',
        );
        $auth = $this->loginAs($client, 'direction@test.local');

        $client->request(
            'POST',
            '/api/plannings',
            server: $this->authHeaders($auth['token']),
            content: json_encode([
                'userId' => $hote->getId(),
                'workDate' => '2026-07-27',
                'startTime' => '07:30',
                'endTime' => '14:00',
                'enCaisse' => true,
            ], JSON_THROW_ON_ERROR),
        );

        self::assertResponseStatusCodeSame(201);
        $payload = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertTrue($payload['enCaisse']);
    }

    public function testCaissierCannotBeMarkedEnCaisse(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();

        $site = $this->createSite();
        $this->createUser('direction@test.local', UserRole::DIRECTION, $site);
        $caissier = $this->createUser(
            'caissier@test.local',
            UserRole::CAISSIER,
            $site,
            contractMinutes: 2205,
            firstName: 'Julie',
            lastName: 'Martin',
        );
        $auth = $this->loginAs($client, 'direction@test.local');

        $client->request(
            'POST',
            '/api/plannings',
            server: $this->authHeaders($auth['token']),
            content: json_encode([
                'userId' => $caissier->getId(),
                'workDate' => '2026-07-27',
                'startTime' => '07:30',
                'endTime' => '14:00',
                'enCaisse' => true,
            ], JSON_THROW_ON_ERROR),
        );

        self::assertResponseStatusCodeSame(422);
        $payload = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertArrayHasKey('error', $payload);
        self::assertStringContainsString('caisse', mb_strtolower($payload['error']));
    }

    public function testHoteCanAssignRegisterNumberOnPlanning(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();

        $site = $this->createSite();
        $this->createUser('hote@test.local', UserRole::HOTE, $site);
        $this->createUser('direction@test.local', UserRole::DIRECTION, $site);
        $caissier = $this->createUser(
            'caissier@test.local',
            UserRole::CAISSIER,
            $site,
            contractMinutes: 2205,
            firstName: 'Julie',
            lastName: 'Martin',
        );

        $directionAuth = $this->loginAs($client, 'direction@test.local');
        $client->request(
            'POST',
            '/api/plannings',
            server: $this->authHeaders($directionAuth['token']),
            content: json_encode([
                'userId' => $caissier->getId(),
                'workDate' => '2026-07-27',
                'startTime' => '07:30',
                'endTime' => '14:00',
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseStatusCodeSame(201);
        $created = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);

        $hoteAuth = $this->loginAs($client, 'hote@test.local');
        $client->request(
            'PATCH',
            '/api/plannings/'.$created['id'].'/register-number',
            server: $this->authHeaders($hoteAuth['token']),
            content: json_encode([
                'registerNumber' => 0,
            ], JSON_THROW_ON_ERROR),
        );

        self::assertResponseIsSuccessful();
        $payload = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertSame(0, $payload['registerNumber']);

        $stored = $this->em()->getRepository(Planning::class)->find($created['id']);
        self::assertInstanceOf(Planning::class, $stored);
        self::assertSame(0, $stored->getRegisterNumber());
    }

    public function testHoteCanAssignRegisterSegmentsOnPlanning(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();

        $site = $this->createSite();
        $this->createUser('hote@test.local', UserRole::HOTE, $site);
        $this->createUser('direction@test.local', UserRole::DIRECTION, $site);
        $caissier = $this->createUser('caissier@test.local', UserRole::CAISSIER, $site, contractMinutes: 2205);

        $directionAuth = $this->loginAs($client, 'direction@test.local');
        $client->request(
            'POST',
            '/api/plannings',
            server: $this->authHeaders($directionAuth['token']),
            content: json_encode([
                'userId' => $caissier->getId(),
                'workDate' => '2026-07-28',
                'startTime' => '07:30',
                'endTime' => '14:00',
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseStatusCodeSame(201);
        $created = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);

        $hoteAuth = $this->loginAs($client, 'hote@test.local');
        $client->request(
            'PATCH',
            '/api/plannings/'.$created['id'].'/register-number',
            server: $this->authHeaders($hoteAuth['token']),
            content: json_encode([
                'segments' => [
                    ['startTime' => '07:30', 'registerNumber' => 3],
                    ['startTime' => '10:00', 'registerNumber' => 0],
                ],
            ], JSON_THROW_ON_ERROR),
        );

        self::assertResponseIsSuccessful();
        $payload = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertNull($payload['registerNumber']);
        self::assertCount(2, $payload['registerSegments']);
        self::assertSame(3, $payload['registerSegments'][0]['registerNumber']);
        self::assertSame(0, $payload['registerSegments'][1]['registerNumber']);
    }

    public function testCaissiersOnlyListIncludesLadMarkedEnCaisse(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();

        $site = $this->createSite();
        $this->createUser('direction@test.local', UserRole::DIRECTION, $site);
        $lad = $this->createUser('lad@test.local', UserRole::LAD, $site, contractMinutes: 2100);
        $hote = $this->createUser('hote@test.local', UserRole::HOTE, $site, contractMinutes: 2205);
        $caissier = $this->createUser('caissier@test.local', UserRole::CAISSIER, $site, contractMinutes: 2205);
        $auth = $this->loginAs($client, 'direction@test.local');

        foreach (
            [
                ['userId' => $lad->getId(), 'enCaisse' => true, 'startTime' => '07:30', 'endTime' => '12:00'],
                ['userId' => $hote->getId(), 'enCaisse' => false, 'startTime' => '07:30', 'endTime' => '12:00'],
                ['userId' => $caissier->getId(), 'enCaisse' => false, 'startTime' => '08:00', 'endTime' => '14:00'],
            ] as $body
        ) {
            $client->request(
                'POST',
                '/api/plannings',
                server: $this->authHeaders($auth['token']),
                content: json_encode([
                    'userId' => $body['userId'],
                    'workDate' => '2026-07-27',
                    'startTime' => $body['startTime'],
                    'endTime' => $body['endTime'],
                    'enCaisse' => $body['enCaisse'],
                ], JSON_THROW_ON_ERROR),
            );
            self::assertResponseStatusCodeSame(201);
        }

        $client->request(
            'GET',
            '/api/plannings?from=2026-07-27&to=2026-07-27&caissiersOnly=1',
            server: $this->authHeaders($auth['token']),
        );
        self::assertResponseIsSuccessful();
        $list = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertCount(2, $list);
        $userIds = array_map(static fn (array $p) => $p['user']['id'], $list);
        sort($userIds);
        $expected = [$lad->getId(), $caissier->getId()];
        sort($expected);
        self::assertSame($expected, $userIds);
    }

    public function testCannotScheduleOnOrAfterDismissalDate(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();

        $site = $this->createSite();
        $this->createUser('direction@test.local', UserRole::DIRECTION, $site);
        $employee = $this->createUser('caissier@test.local', UserRole::CAISSIER, $site);
        $auth = $this->loginAs($client, 'direction@test.local');

        $dismissedAt = (new \DateTimeImmutable('today'))->modify('+5 days')->format('Y-m-d');
        $before = (new \DateTimeImmutable('today'))->modify('+4 days')->format('Y-m-d');
        $onOrAfter = $dismissedAt;

        $employee->setDismissedAt(new \DateTimeImmutable($dismissedAt));
        $employee->setActive(true);
        $this->em()->flush();

        $client->request(
            'POST',
            '/api/plannings',
            server: $this->authHeaders($auth['token']),
            content: json_encode([
                'userId' => $employee->getId(),
                'workDate' => $before,
                'startTime' => '09:00',
                'endTime' => '12:00',
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseStatusCodeSame(201);

        $client->request(
            'POST',
            '/api/plannings',
            server: $this->authHeaders($auth['token']),
            content: json_encode([
                'userId' => $employee->getId(),
                'workDate' => $onOrAfter,
                'startTime' => '09:00',
                'endTime' => '12:00',
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseStatusCodeSame(422);
        $payload = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertArrayHasKey('error', $payload);
        self::assertStringContainsString('licenciement', $payload['error']);
    }

    public function testCannotScheduleInactiveEmployee(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();

        $site = $this->createSite();
        $this->createUser('direction@test.local', UserRole::DIRECTION, $site);
        $employee = $this->createUser('caissier@test.local', UserRole::CAISSIER, $site);
        $employee->setActive(false);
        $this->em()->flush();
        $auth = $this->loginAs($client, 'direction@test.local');

        $client->request(
            'POST',
            '/api/plannings',
            server: $this->authHeaders($auth['token']),
            content: json_encode([
                'userId' => $employee->getId(),
                'workDate' => '2026-07-27',
                'startTime' => '09:00',
                'endTime' => '12:00',
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseStatusCodeSame(422);
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
