<?php

namespace App\Tests\Integration;

use App\Entity\User;
use App\Enum\UserRole;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

/**
 * First-login password change after recruitment with a temporary password.
 */
final class ChangePasswordApiTest extends WebTestCase
{
    use ApiTestTrait;

    public function testRecruitedUserMustChangePasswordThenCanSignInWithNewOne(): void
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
        $directionLogin = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);

        $client->request(
            'POST',
            '/api/users',
            server: $this->authHeaders($directionLogin['token']),
            content: json_encode([
                'email' => 'nouveau@test.local',
                'firstName' => 'Alice',
                'lastName' => 'Martin',
                'role' => 'CAISSIER',
                'siteId' => $site->getId(),
                'contractMinutes' => 2205,
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseStatusCodeSame(201);
        $created = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertTrue($created['mustChangePassword']);

        /** @var User $employee */
        $employee = $this->em()->getRepository(User::class)->findOneBy(['email' => 'nouveau@test.local']);
        self::assertTrue($employee->isMustChangePassword());

        // Peek the hashed password by resetting it to a known temporary value
        // (the plain temp password from the mailer is not returned by the API).
        /** @var UserPasswordHasherInterface $hasher */
        $hasher = static::getContainer()->get(UserPasswordHasherInterface::class);
        $employee->setPassword($hasher->hashPassword($employee, 'TempPass99!'));
        $this->em()->flush();

        $client->request(
            'POST',
            '/api/login',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode([
                'email' => 'nouveau@test.local',
                'password' => 'TempPass99!',
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseIsSuccessful();
        $employeeLogin = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);

        $client->request('GET', '/api/me', server: $this->authHeaders($employeeLogin['token']));
        self::assertResponseIsSuccessful();
        $me = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertTrue($me['mustChangePassword']);

        $client->request(
            'POST',
            '/api/me/password',
            server: $this->authHeaders($employeeLogin['token']),
            content: json_encode([
                'newPassword' => 'MonMdpPerso1!',
                'confirmPassword' => 'MonMdpPerso1!',
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseIsSuccessful();
        $after = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertFalse($after['mustChangePassword']);

        $client->request(
            'POST',
            '/api/login',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode([
                'email' => 'nouveau@test.local',
                'password' => 'MonMdpPerso1!',
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseIsSuccessful();
    }

    public function testExistingUserNeedsCurrentPasswordToRotate(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('hote@test.local', UserRole::HOTE, $site);

        $client->request(
            'POST',
            '/api/login',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode([
                'email' => 'hote@test.local',
                'password' => 'Password123!',
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseIsSuccessful();
        $login = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);

        $client->request(
            'POST',
            '/api/me/password',
            server: $this->authHeaders($login['token']),
            content: json_encode([
                'newPassword' => 'AutreMdp123!',
                'confirmPassword' => 'AutreMdp123!',
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseStatusCodeSame(422);

        $client->request(
            'POST',
            '/api/me/password',
            server: $this->authHeaders($login['token']),
            content: json_encode([
                'currentPassword' => 'Password123!',
                'newPassword' => 'AutreMdp123!',
                'confirmPassword' => 'AutreMdp123!',
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseIsSuccessful();
    }

    public function testWeakPasswordIsRejectedByBackend(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $user = $this->createUser('nouveau@test.local', UserRole::CAISSIER, $site);
        $user->setMustChangePassword(true);
        $this->em()->flush();

        $client->request(
            'POST',
            '/api/login',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode([
                'email' => 'nouveau@test.local',
                'password' => 'Password123!',
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseIsSuccessful();
        $login = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);

        $client->request(
            'POST',
            '/api/me/password',
            server: $this->authHeaders($login['token']),
            content: json_encode([
                'newPassword' => 'faible',
                'confirmPassword' => 'faible',
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseStatusCodeSame(422);
        $body = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertArrayHasKey('error', $body);

        $this->em()->clear();
        $reloaded = $this->em()->getRepository(User::class)->findOneBy(['email' => 'nouveau@test.local']);
        self::assertTrue($reloaded->isMustChangePassword());
    }
}
