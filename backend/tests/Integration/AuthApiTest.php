<?php

namespace App\Tests\Integration;

use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Tools\SchemaTool;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * Intégration HTTP : auth JWT et routes protégées.
 */
final class AuthApiTest extends WebTestCase
{
    public function testLoginRejectsMissingCredentials(): void
    {
        $client = static::createClient();
        $client->request(
            'POST',
            '/api/login',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode(['email' => '', 'password' => ''], JSON_THROW_ON_ERROR),
        );

        // JsonLoginAuthenticator exige des chaînes non vides → 400.
        self::assertResponseStatusCodeSame(400);
    }

    public function testLoginRejectsUnknownUser(): void
    {
        $client = static::createClient();
        $this->resetDatabaseSchema();

        $client->request(
            'POST',
            '/api/login',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode([
                'email' => 'nobody@example.invalid',
                'password' => 'wrong-password',
            ], JSON_THROW_ON_ERROR),
        );

        self::assertResponseStatusCodeSame(401);
    }

    public function testProtectedRouteRequiresJwt(): void
    {
        $client = static::createClient();
        $client->request('GET', '/api/plannings');

        self::assertResponseStatusCodeSame(401);
    }

    private function resetDatabaseSchema(): void
    {
        /** @var EntityManagerInterface $em */
        $em = static::getContainer()->get('doctrine')->getManager();
        $metadata = $em->getMetadataFactory()->getAllMetadata();
        $tool = new SchemaTool($em);
        $tool->dropSchema($metadata);
        $tool->createSchema($metadata);
    }
}
