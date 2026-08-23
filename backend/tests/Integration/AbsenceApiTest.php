<?php

namespace App\Tests\Integration;

use App\Entity\Absence;
use App\Entity\User;
use App\Enum\AbsenceReason;
use App\Enum\UserRole;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * Intégration API absences : déclaration d'un arrêt de travail ou de
 * vacances depuis la fiche employés, consultation par semaine de planning
 * et suppression.
 */
final class AbsenceApiTest extends WebTestCase
{
    use ApiTestTrait;

    /** @return array{0: KernelBrowser, 1: string, 2: User} */
    private function bootWithDirection(): array
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();

        $site = $this->createSite();
        $this->createUser('direction@test.local', UserRole::DIRECTION, $site);
        $employee = $this->createUser(
            'caissier@test.local',
            UserRole::CAISSIER,
            $site,
            firstName: 'Sophie',
            lastName: 'Durand',
        );

        return [$client, $this->loginAs($client, 'direction@test.local'), $employee];
    }

    private function loginAs(KernelBrowser $client, string $email, string $password = 'Password123!'): string
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

        return $payload['token'];
    }

    private function sendAbsence(KernelBrowser $client, string $token, array $payload): void
    {
        $client->request(
            'POST',
            '/api/absences',
            server: $this->authHeaders($token),
            content: json_encode($payload, JSON_THROW_ON_ERROR),
        );
    }

    /** @return array<string, mixed> */
    private function postAbsence(KernelBrowser $client, string $token, array $payload): array
    {
        $this->sendAbsence($client, $token, $payload);

        return json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
    }

    public function testLeaveIsRecordedWithoutTimes(): void
    {
        [$client, $token, $employee] = $this->bootWithDirection();

        $payload = $this->postAbsence($client, $token, [
            'userId' => $employee->getId(),
            'reason' => 'CONGE',
            'startDate' => '2026-03-02',
            'endDate' => '2026-03-06',
        ]);

        self::assertResponseStatusCodeSame(201);
        self::assertSame('CONGE', $payload['reason']);
        self::assertSame('2026-03-02', $payload['startDate']);
        self::assertSame('2026-03-06', $payload['endDate']);
        self::assertNull($payload['startTime']);
        self::assertNull($payload['endTime']);
        self::assertSame($employee->getId(), $payload['user']['id']);
        // L'auteur de la déclaration est tracé pour savoir qui a saisi l'absence.
        self::assertSame('direction@test.local', $payload['createdBy']['email']);
    }

    public function testSickLeaveIsRecordedWithItsTimes(): void
    {
        [$client, $token, $employee] = $this->bootWithDirection();

        $payload = $this->postAbsence($client, $token, [
            'userId' => $employee->getId(),
            'reason' => 'ARRET_TRAVAIL',
            'startDate' => '2026-03-02',
            'endDate' => '2026-03-02',
            'startTime' => '07:00',
            'endTime' => '20:15',
        ]);

        self::assertResponseStatusCodeSame(201);
        self::assertSame('ARRET_TRAVAIL', $payload['reason']);
        self::assertSame('07:00', $payload['startTime']);
        self::assertSame('20:15', $payload['endTime']);
    }

    public function testSickLeaveRequiresTimes(): void
    {
        [$client, $token, $employee] = $this->bootWithDirection();

        $this->postAbsence($client, $token, [
            'userId' => $employee->getId(),
            'reason' => 'ARRET_TRAVAIL',
            'startDate' => '2026-03-02',
            'endDate' => '2026-03-02',
        ]);

        self::assertResponseStatusCodeSame(422);
        self::assertSame([], $this->em()->getRepository(Absence::class)->findAll());
    }

    public function testMalformedTimeIsRejected(): void
    {
        [$client, $token, $employee] = $this->bootWithDirection();

        $this->postAbsence($client, $token, [
            'userId' => $employee->getId(),
            'reason' => 'ARRET_TRAVAIL',
            'startDate' => '2026-03-02',
            'endDate' => '2026-03-02',
            'startTime' => '7h',
            'endTime' => '20:15',
        ]);

        self::assertResponseStatusCodeSame(422);
    }

    public function testSickLeaveEndingBeforeItStartsOnTheSameDayIsRejected(): void
    {
        [$client, $token, $employee] = $this->bootWithDirection();

        $this->postAbsence($client, $token, [
            'userId' => $employee->getId(),
            'reason' => 'ARRET_TRAVAIL',
            'startDate' => '2026-03-02',
            'endDate' => '2026-03-02',
            'startTime' => '14:00',
            'endTime' => '09:00',
        ]);

        self::assertResponseStatusCodeSame(422);
    }

    public function testEndDateBeforeStartDateIsRejected(): void
    {
        [$client, $token, $employee] = $this->bootWithDirection();

        $this->postAbsence($client, $token, [
            'userId' => $employee->getId(),
            'reason' => 'CONGE',
            'startDate' => '2026-03-06',
            'endDate' => '2026-03-02',
        ]);

        self::assertResponseStatusCodeSame(422);
    }

    public function testUnknownReasonIsRejected(): void
    {
        [$client, $token, $employee] = $this->bootWithDirection();

        $this->postAbsence($client, $token, [
            'userId' => $employee->getId(),
            'reason' => 'RTT',
            'startDate' => '2026-03-02',
            'endDate' => '2026-03-02',
        ]);

        self::assertResponseStatusCodeSame(422);
    }

    public function testUnknownEmployeeIsRejected(): void
    {
        [$client, $token] = $this->bootWithDirection();

        $this->postAbsence($client, $token, [
            'userId' => 999999,
            'reason' => 'CONGE',
            'startDate' => '2026-03-02',
            'endDate' => '2026-03-02',
        ]);

        self::assertResponseStatusCodeSame(404);
    }

    public function testListOnlyReturnsAbsencesOverlappingThePeriod(): void
    {
        [$client, $token, $employee] = $this->bootWithDirection();

        // Congé à cheval sur la semaine demandée, puis un autre bien après.
        $this->postAbsence($client, $token, [
            'userId' => $employee->getId(),
            'reason' => 'CONGE',
            'startDate' => '2026-02-26',
            'endDate' => '2026-03-03',
        ]);
        self::assertResponseStatusCodeSame(201);

        $this->postAbsence($client, $token, [
            'userId' => $employee->getId(),
            'reason' => 'CONGE',
            'startDate' => '2026-04-06',
            'endDate' => '2026-04-10',
        ]);
        self::assertResponseStatusCodeSame(201);

        $client->request(
            'GET',
            '/api/absences?from=2026-03-02&to=2026-03-08',
            server: $this->authHeaders($token),
        );

        self::assertResponseIsSuccessful();
        $absences = json_decode($client->getResponse()->getContent() ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        self::assertCount(1, $absences);
        self::assertSame('2026-02-26', $absences[0]['startDate']);
    }

    public function testAbsenceCanBeDeleted(): void
    {
        [$client, $token, $employee] = $this->bootWithDirection();

        $created = $this->postAbsence($client, $token, [
            'userId' => $employee->getId(),
            'reason' => 'CONGE',
            'startDate' => '2026-03-02',
            'endDate' => '2026-03-06',
        ]);
        self::assertResponseStatusCodeSame(201);

        $client->request('DELETE', '/api/absences/'.$created['id'], server: $this->authHeaders($token));

        self::assertResponseStatusCodeSame(204);
        $this->em()->clear();
        self::assertNull($this->em()->getRepository(Absence::class)->find($created['id']));
    }

    public function testDeletingAnUnknownAbsenceReturnsNotFound(): void
    {
        [$client, $token] = $this->bootWithDirection();

        $client->request('DELETE', '/api/absences/999999', server: $this->authHeaders($token));

        self::assertResponseStatusCodeSame(404);
    }

    public function testAnEmployeeCanReadButNotDeclareAbsences(): void
    {
        [$client, $directionToken, $employee] = $this->bootWithDirection();
        $this->postAbsence($client, $directionToken, [
            'userId' => $employee->getId(),
            'reason' => 'CONGE',
            'startDate' => '2026-03-02',
            'endDate' => '2026-03-06',
        ]);
        self::assertResponseStatusCodeSame(201);

        $employeeToken = $this->loginAs($client, 'caissier@test.local');

        $client->request(
            'GET',
            '/api/absences?from=2026-03-02&to=2026-03-08',
            server: $this->authHeaders($employeeToken),
        );
        self::assertResponseIsSuccessful();

        // Réponse d'erreur du pare-feu : on ne décode pas son corps.
        $this->sendAbsence($client, $employeeToken, [
            'userId' => $employee->getId(),
            'reason' => 'CONGE',
            'startDate' => '2026-03-09',
            'endDate' => '2026-03-13',
        ]);
        self::assertResponseStatusCodeSame(403);
    }

    public function testAbsenceCoversEveryDayOfItsPeriod(): void
    {
        $absence = new Absence();
        $absence->setReason(AbsenceReason::CONGE);
        $absence->setStartDate(new \DateTimeImmutable('2026-03-02'));
        $absence->setEndDate(new \DateTimeImmutable('2026-03-06'));

        self::assertTrue($absence->coversDate(new \DateTimeImmutable('2026-03-02 23:30')));
        self::assertTrue($absence->coversDate(new \DateTimeImmutable('2026-03-04')));
        self::assertTrue($absence->coversDate(new \DateTimeImmutable('2026-03-06 08:00')));
        self::assertFalse($absence->coversDate(new \DateTimeImmutable('2026-03-01')));
        self::assertFalse($absence->coversDate(new \DateTimeImmutable('2026-03-07')));
    }
}
