<?php

namespace App\Tests\Integration;

use App\Entity\User;
use App\Enum\UserRole;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * Licenciement depuis la fiche employés : la date saisie est une date
 * d'effet. L'employé reste en poste jusque-là, puis bascule dans les
 * licenciés. Les dates sont relatives pour que les tests ne périment pas.
 */
final class UserDismissalTest extends WebTestCase
{
    use ApiTestTrait;

    /** @return array{0: \Symfony\Bundle\FrameworkBundle\KernelBrowser, 1: string, 2: User} */
    private function bootWithDirection(): array
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('direction@test.local', UserRole::DIRECTION, $site);
        $employee = $this->createUser('caissier@test.local', UserRole::CAISSIER, $site);

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

        return [$client, $login['token'], $employee];
    }

    /** @return array<string, mixed> */
    private function patchUser(object $client, string $token, int $id, array $payload): array
    {
        $client->request(
            'PATCH',
            '/api/users/'.$id,
            server: $this->authHeaders($token),
            content: json_encode($payload, JSON_THROW_ON_ERROR),
        );

        return json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
    }

    private function date(string $modifier): string
    {
        return (new \DateTimeImmutable('today'))->modify($modifier)->format('Y-m-d');
    }

    public function testDismissalDatedTodayTakesEffectImmediately(): void
    {
        [$client, $token, $employee] = $this->bootWithDirection();
        $today = $this->date('+0 day');

        $payload = $this->patchUser($client, $token, $employee->getId(), ['dismissedAt' => $today]);

        self::assertResponseIsSuccessful();
        self::assertSame($today, $payload['dismissedAt']);
        self::assertFalse($payload['active']);
    }

    public function testFutureDismissalKeepsTheEmployeeInPost(): void
    {
        [$client, $token, $employee] = $this->bootWithDirection();
        $later = $this->date('+10 days');

        $payload = $this->patchUser($client, $token, $employee->getId(), ['dismissedAt' => $later]);

        self::assertResponseIsSuccessful();
        self::assertSame($later, $payload['dismissedAt']);
        self::assertTrue($payload['active'], "L'employé doit rester planifiable jusqu'à son départ.");
    }

    public function testDueDismissalIsAppliedWhenListingUsers(): void
    {
        [$client, $token, $employee] = $this->bootWithDirection();

        // Départ programmé hier : la liste doit le basculer en licencié.
        $employee->setDismissedAt(new \DateTimeImmutable('yesterday'));
        $this->em()->flush();

        $client->request('GET', '/api/users', server: $this->authHeaders($token));
        self::assertResponseIsSuccessful();

        $users = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        $byEmail = [];
        foreach ($users as $user) {
            $byEmail[$user['email']] = $user;
        }

        self::assertFalse($byEmail['caissier@test.local']['active']);
        self::assertTrue($byEmail['direction@test.local']['active']);
    }

    public function testCancelledDismissalKeepsTheEmployeeActive(): void
    {
        [$client, $token, $employee] = $this->bootWithDirection();
        $this->patchUser($client, $token, $employee->getId(), ['dismissedAt' => $this->date('+10 days')]);
        self::assertResponseIsSuccessful();

        $payload = $this->patchUser($client, $token, $employee->getId(), ['dismissedAt' => null]);

        self::assertResponseIsSuccessful();
        self::assertNull($payload['dismissedAt']);
        self::assertTrue($payload['active']);
    }

    public function testRehireClearsTheDismissalDate(): void
    {
        [$client, $token, $employee] = $this->bootWithDirection();
        $this->patchUser($client, $token, $employee->getId(), ['dismissedAt' => $this->date('+0 day')]);
        self::assertResponseIsSuccessful();

        $payload = $this->patchUser($client, $token, $employee->getId(), ['active' => true]);

        self::assertResponseIsSuccessful();
        self::assertTrue($payload['active']);
        self::assertNull($payload['dismissedAt']);
    }

    public function testInvalidDismissalDateIsRejected(): void
    {
        [$client, $token, $employee] = $this->bootWithDirection();

        $this->patchUser($client, $token, $employee->getId(), ['dismissedAt' => '20/08/2026']);

        self::assertResponseStatusCodeSame(422);

        $this->em()->clear();
        $stored = $this->em()->getRepository(User::class)->find($employee->getId());
        self::assertInstanceOf(User::class, $stored);
        self::assertNull($stored->getDismissedAt());
        self::assertTrue($stored->isActive());
    }
}
