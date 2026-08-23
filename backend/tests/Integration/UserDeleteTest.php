<?php

namespace App\Tests\Integration;

use App\Entity\User;
use App\Enum\UserRole;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * Hard-delete of dismissed cashiers (dev cleanup tool exposed to direction).
 */
final class UserDeleteTest extends WebTestCase
{
    use ApiTestTrait;

    /** @return array{0: KernelBrowser, 1: string, 2: User} */
    private function bootWithDirectionAndDismissedCashier(): array
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('direction@test.local', UserRole::DIRECTION, $site);
        $cashier = $this->createUser('caissier@test.local', UserRole::CAISSIER, $site);
        $cashier->setActive(false);
        $cashier->setDismissedAt(new \DateTimeImmutable('yesterday'));
        $this->em()->flush();

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

        return [$client, $login['token'], $cashier];
    }

    public function testDirectionCanDeleteADismissedCashier(): void
    {
        [$client, $token, $cashier] = $this->bootWithDirectionAndDismissedCashier();
        $id = $cashier->getId();

        $client->request('DELETE', '/api/users/'.$id, server: $this->authHeaders($token));

        self::assertResponseStatusCodeSame(204);
        $this->em()->clear();
        self::assertNull($this->em()->getRepository(User::class)->find($id));
    }

    public function testDirectionCannotDeleteAnActiveCashier(): void
    {
        [$client, $token, $cashier] = $this->bootWithDirectionAndDismissedCashier();
        $cashier->setActive(true);
        $cashier->setDismissedAt(null);
        $this->em()->flush();

        $client->request('DELETE', '/api/users/'.$cashier->getId(), server: $this->authHeaders($token));

        self::assertResponseStatusCodeSame(422);
        $this->em()->clear();
        self::assertInstanceOf(User::class, $this->em()->getRepository(User::class)->find($cashier->getId()));
    }

    public function testDirectionCannotDeleteADismissedNonCashier(): void
    {
        [$client, $token, $cashier] = $this->bootWithDirectionAndDismissedCashier();
        $site = $cashier->getSite();
        self::assertNotNull($site);

        $hote = $this->createUser('hote@test.local', UserRole::HOTE, $site);
        $hote->setActive(false);
        $this->em()->flush();

        $client->request('DELETE', '/api/users/'.$hote->getId(), server: $this->authHeaders($token));

        self::assertResponseStatusCodeSame(422);
    }
}
