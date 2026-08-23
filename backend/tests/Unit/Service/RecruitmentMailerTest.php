<?php

namespace App\Tests\Unit\Service;

use App\Entity\Site;
use App\Entity\User;
use App\Enum\UserRole;
use App\Service\RecruitmentMailer;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Email;

final class RecruitmentMailerTest extends TestCase
{
    public function testWelcomeEmailContainsCredentialsAndLoginLink(): void
    {
        $captured = null;
        $mailer = $this->createMock(MailerInterface::class);
        $mailer->expects($this->once())
            ->method('send')
            ->with($this->callback(function (Email $email) use (&$captured): bool {
                $captured = $email;

                return true;
            }));

        $site = new Site();
        $site->setName('Carrefour Market - Test');
        $site->setAddress('1 rue Test');
        $site->setPostalCode('69001');
        $site->setCity('Lyon');

        $user = new User();
        $user->setEmail('julie.moreau@test.local');
        $user->setFirstName('Julie');
        $user->setLastName('Moreau');
        $user->setRoles([UserRole::HOTE->value]);
        $user->setPassword('hashed');
        $user->setSite($site);

        $service = new RecruitmentMailer(
            $mailer,
            new NullLogger(),
            'noreply@test.local',
            'http://localhost:3000',
        );
        $service->sendWelcome($user, 'temp-secret-42');

        self::assertInstanceOf(Email::class, $captured);
        self::assertSame('Bienvenue sur ShiftDesk — vos identifiants', $captured->getSubject());
        self::assertSame('julie.moreau@test.local', $captured->getTo()[0]->getAddress());
        self::assertSame('noreply@test.local', $captured->getFrom()[0]->getAddress());

        $text = $captured->getTextBody() ?? '';
        self::assertStringContainsString('Julie', $text);
        self::assertStringContainsString('julie.moreau@test.local', $text);
        self::assertStringContainsString('temp-secret-42', $text);
        self::assertStringContainsString("Hôte(sse) d'accueil", $text);
        self::assertStringContainsString('http://localhost:3000/login', $text);
        self::assertStringContainsString('Carrefour Market - Test', $text);

        $html = $captured->getHtmlBody() ?? '';
        self::assertStringContainsString('#0a4b9f', $html);
        self::assertStringContainsString('#e30613', $html);
        self::assertStringContainsString('Se connecter à ShiftDesk', $html);
        self::assertStringContainsString('Vos identifiants', $html);
        self::assertStringContainsString('Carrefour Accueil', $html);
    }
}
