<?php

namespace App\Tests\Integration;

use App\Entity\Job;
use App\Enum\JobCategory;
use App\Enum\UserRole;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

final class JobApiTest extends WebTestCase
{
    use ApiTestTrait;

    public function testDirectionCanListBuiltInJobs(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('direction@test.local', UserRole::DIRECTEUR, $site);

        $token = $this->login($client, 'direction@test.local');
        $client->request('GET', '/api/jobs', server: $this->authHeaders($token));
        self::assertResponseIsSuccessful();

        $jobs = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        $codes = array_column($jobs, 'code');
        self::assertContains(Job::CODE_DIRECTEUR, $codes);
        self::assertContains('CAISSIER', $codes);

        $directeur = $this->byCode($jobs, Job::CODE_DIRECTEUR);
        self::assertTrue($directeur['protected']);
        self::assertSame(JobCategory::DIRECTION->value, $directeur['category']);
        self::assertSame('Directeur/rice', $directeur['label']);
    }

    public function testDirectionCategoryCanReceiveAnExtraJob(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('direction@test.local', UserRole::DIRECTEUR, $site);
        $token = $this->login($client, 'direction@test.local');

        $client->request(
            'POST',
            '/api/jobs',
            server: $this->authHeaders($token),
            content: json_encode([
                'category' => JobCategory::DIRECTION->value,
                'label' => 'Adjoint de direction',
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseStatusCodeSame(201);
        $created = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertSame('Adjoint de direction', $created['label']);
        self::assertSame(JobCategory::DIRECTION->value, $created['category']);
        self::assertSame(UserRole::DIRECTION->value, $created['grantsRole']);
        self::assertFalse($created['protected']);
        self::assertNotSame(Job::CODE_DIRECTEUR, $created['code']);
    }

    public function testDirectionCanAddAndDeleteAnEmptyJob(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('direction@test.local', UserRole::DIRECTEUR, $site);
        $token = $this->login($client, 'direction@test.local');

        $client->request(
            'POST',
            '/api/jobs',
            server: $this->authHeaders($token),
            content: json_encode([
                'category' => JobCategory::ACCUEIL_CAISSE->value,
                'label' => 'Chef de caisse',
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseStatusCodeSame(201);
        $created = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertSame('Chef de caisse', $created['label']);
        self::assertSame(JobCategory::ACCUEIL_CAISSE->value, $created['category']);
        self::assertSame(UserRole::CAISSIER->value, $created['grantsRole']);
        self::assertFalse($created['protected']);
        self::assertSame(0, $created['occupantCount']);

        $client->request(
            'DELETE',
            '/api/jobs/'.$created['id'],
            server: $this->authHeaders($token),
        );
        self::assertResponseStatusCodeSame(204);
    }

    public function testProtectedDirecteurJobCannotBeDeleted(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('direction@test.local', UserRole::DIRECTEUR, $site);
        $token = $this->login($client, 'direction@test.local');

        $client->request('GET', '/api/jobs', server: $this->authHeaders($token));
        $jobs = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        $directeur = $this->byCode($jobs, Job::CODE_DIRECTEUR);

        $client->request(
            'DELETE',
            '/api/jobs/'.$directeur['id'],
            server: $this->authHeaders($token),
        );
        self::assertResponseStatusCodeSame(403);
    }

    public function testOccupiedJobCannotBeDeleted(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('direction@test.local', UserRole::DIRECTEUR, $site);
        $this->createUser('sophie@test.local', UserRole::CAISSIER, $site);
        $token = $this->login($client, 'direction@test.local');

        $client->request('GET', '/api/jobs', server: $this->authHeaders($token));
        self::assertResponseIsSuccessful();
        $jobs = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        $cashier = $this->byCode($jobs, 'CAISSIER');

        $job = $this->em()->getRepository(Job::class)->find($cashier['id']);
        $sophie = $this->em()->getRepository(\App\Entity\User::class)->findOneBy(['email' => 'sophie@test.local']);
        self::assertInstanceOf(Job::class, $job);
        self::assertNotNull($sophie);
        $sophie->assignJob($job);
        $this->em()->flush();

        $client->request(
            'DELETE',
            '/api/jobs/'.$cashier['id'],
            server: $this->authHeaders($token),
        );
        self::assertResponseStatusCodeSame(409);
    }

    public function testHoteCannotManageJobs(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('hote@test.local', UserRole::HOTE, $site);
        $token = $this->login($client, 'hote@test.local');

        $client->request('GET', '/api/jobs', server: $this->authHeaders($token));
        self::assertResponseStatusCodeSame(403);
    }

    public function testUnknownCategoryIsRejected(): void
    {
        [$client, $token] = $this->loggedDirection();

        $client->request(
            'POST',
            '/api/jobs',
            server: $this->authHeaders($token),
            content: json_encode([
                'category' => 'DIRECTEUR',
                'label' => 'Adjoint',
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseStatusCodeSame(422);
        self::assertSame('Catégorie inconnue.', $this->errorMessage($client));
    }

    public function testBlankLabelIsRejected(): void
    {
        [$client, $token] = $this->loggedDirection();

        $client->request(
            'POST',
            '/api/jobs',
            server: $this->authHeaders($token),
            content: json_encode([
                'category' => JobCategory::RAYON->value,
                'label' => '   ',
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseStatusCodeSame(422);
        self::assertSame('Le libellé du poste est obligatoire.', $this->errorMessage($client));
    }

    public function testMissingJobCannotBeDeleted(): void
    {
        [$client, $token] = $this->loggedDirection();

        $client->request('DELETE', '/api/jobs/999999', server: $this->authHeaders($token));
        self::assertResponseStatusCodeSame(404);
        self::assertSame('Poste introuvable.', $this->errorMessage($client));
    }

    public function testReservedDirecteurLabelDoesNotReuseTheProtectedCode(): void
    {
        [$client, $token] = $this->loggedDirection();

        $client->request(
            'POST',
            '/api/jobs',
            server: $this->authHeaders($token),
            content: json_encode([
                'category' => JobCategory::DIRECTION->value,
                'label' => 'Directeur',
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseStatusCodeSame(201);
        $created = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertSame('JOB_DIRECTEUR', $created['code']);
        self::assertFalse($created['protected']);
        self::assertNotSame(Job::CODE_DIRECTEUR, $created['code']);
    }

    public function testDuplicateLabelsGetDistinctCodes(): void
    {
        [$client, $token] = $this->loggedDirection();

        $payload = json_encode([
            'category' => JobCategory::SECURITE->value,
            'label' => 'Agent cynophile',
        ], JSON_THROW_ON_ERROR);

        $client->request('POST', '/api/jobs', server: $this->authHeaders($token), content: $payload);
        self::assertResponseStatusCodeSame(201);
        $first = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);

        $client->request('POST', '/api/jobs', server: $this->authHeaders($token), content: $payload);
        self::assertResponseStatusCodeSame(201);
        $second = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);

        self::assertSame('AGENT_CYNOPHILE', $first['code']);
        self::assertSame('AGENT_CYNOPHILE_2', $second['code']);
        self::assertSame(UserRole::SECURITE->value, $first['grantsRole']);
        self::assertGreaterThan($first['position'], $second['position']);
    }

    public function testOccupiedJobErrorMentionsTheHeadcount(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('direction@test.local', UserRole::DIRECTEUR, $site);
        $this->createUser('sophie@test.local', UserRole::CAISSIER, $site);
        $token = $this->login($client, 'direction@test.local');

        $client->request('GET', '/api/jobs', server: $this->authHeaders($token));
        $jobs = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        $cashier = $this->byCode($jobs, 'CAISSIER');

        $job = $this->em()->getRepository(Job::class)->find($cashier['id']);
        $sophie = $this->em()->getRepository(\App\Entity\User::class)->findOneBy(['email' => 'sophie@test.local']);
        self::assertInstanceOf(Job::class, $job);
        self::assertNotNull($sophie);
        $sophie->assignJob($job);
        $this->em()->flush();

        $client->request(
            'DELETE',
            '/api/jobs/'.$cashier['id'],
            server: $this->authHeaders($token),
        );
        self::assertResponseStatusCodeSame(409);
        self::assertSame(
            'Impossible de supprimer ce poste : 1 personne l\'occupe encore.',
            $this->errorMessage($client),
        );
    }

    public function testInactiveOccupantDoesNotBlockDeletion(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('direction@test.local', UserRole::DIRECTEUR, $site);
        $this->createUser('julie@test.local', UserRole::CAISSIER, $site);
        $token = $this->login($client, 'direction@test.local');

        $client->request(
            'POST',
            '/api/jobs',
            server: $this->authHeaders($token),
            content: json_encode([
                'category' => JobCategory::ACCUEIL_CAISSE->value,
                'label' => 'Chef de caisse',
            ], JSON_THROW_ON_ERROR),
        );
        $created = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);

        $job = $this->em()->getRepository(Job::class)->find($created['id']);
        $julie = $this->em()->getRepository(\App\Entity\User::class)->findOneBy(['email' => 'julie@test.local']);
        self::assertInstanceOf(Job::class, $job);
        self::assertNotNull($julie);
        $julie->assignJob($job);
        $julie->setActive(false);
        $this->em()->flush();

        $client->request(
            'DELETE',
            '/api/jobs/'.$created['id'],
            server: $this->authHeaders($token),
        );
        self::assertResponseStatusCodeSame(204);
    }

    public function testDirectionCategoryRoleCanManageJobs(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('adjoint@test.local', UserRole::DIRECTION, $site);
        $token = $this->login($client, 'adjoint@test.local');

        $client->request('GET', '/api/jobs', server: $this->authHeaders($token));
        self::assertResponseIsSuccessful();

        $client->request(
            'POST',
            '/api/jobs',
            server: $this->authHeaders($token),
            content: json_encode([
                'category' => JobCategory::RAYON->value,
                'label' => 'Chef de rayon',
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseStatusCodeSame(201);
        $created = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertSame(UserRole::RAYON->value, $created['grantsRole']);
    }

    public function testRecruitmentOnACustomJobUsesTheCategoryPermissionRole(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('direction@test.local', UserRole::DIRECTEUR, $site);
        $token = $this->login($client, 'direction@test.local');

        $client->request(
            'POST',
            '/api/jobs',
            server: $this->authHeaders($token),
            content: json_encode([
                'category' => JobCategory::ACCUEIL_CAISSE->value,
                'label' => 'Chef de caisse',
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseStatusCodeSame(201);
        $job = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);

        $client->request(
            'POST',
            '/api/users',
            server: $this->authHeaders($token),
            content: json_encode([
                'firstName' => 'Paul',
                'lastName' => 'Martin',
                'email' => 'paul.martin@test.local',
                'role' => $job['code'],
                'contractMinutes' => 2100,
                'siteId' => $site->getId(),
            ], JSON_THROW_ON_ERROR),
        );
        self::assertResponseStatusCodeSame(201);
        $user = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertSame($job['code'], $user['job']['code']);
        self::assertSame('Chef de caisse', $user['job']['label']);
        self::assertContains(UserRole::CAISSIER->value, $user['roles']);

        $client->request('GET', '/api/jobs', server: $this->authHeaders($token));
        $jobs = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertSame(1, $this->byCode($jobs, $job['code'])['occupantCount']);
    }

    /** @return array{0: \Symfony\Bundle\FrameworkBundle\KernelBrowser, 1: string} */
    private function loggedDirection(): array
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();
        $site = $this->createSite();
        $this->createUser('direction@test.local', UserRole::DIRECTEUR, $site);

        return [$client, $this->login($client, 'direction@test.local')];
    }

    private function errorMessage(\Symfony\Bundle\FrameworkBundle\KernelBrowser $client): string
    {
        $body = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);

        return (string) ($body['error'] ?? '');
    }

    /** @param list<array<string, mixed>> $jobs */
    private function byCode(array $jobs, string $code): array
    {
        foreach ($jobs as $job) {
            if (($job['code'] ?? '') === $code) {
                return $job;
            }
        }

        self::fail('Job '.$code.' missing from catalogue');
    }
}
