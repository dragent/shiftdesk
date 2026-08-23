<?php

namespace App\Service;

use App\Entity\User;
use App\Enum\UserRole;
use Psr\Log\LoggerInterface;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;

/**
 * Sends the welcome message when management recruits an employee: the
 * direction no longer chooses a provisional password in the form, so the
 * temporary credentials are delivered by email instead.
 */
class RecruitmentMailer
{
    public function __construct(
        private readonly MailerInterface $mailer,
        private readonly LoggerInterface $logger,
        private readonly string $fromAddress,
        private readonly string $frontendUrl,
    ) {
    }

    public function sendWelcome(User $user, string $plainPassword): void
    {
        $loginUrl = rtrim($this->frontendUrl, '/').'/login';
        $roleLabel = $this->roleLabel($user);
        $siteName = $user->getSite()?->getName() ?? 'votre magasin';
        $firstName = $user->getFirstName();
        $emailAddress = $user->getEmail();

        $email = (new Email())
            ->from(Address::create($this->fromAddress))
            ->to($emailAddress)
            ->subject('Bienvenue sur ShiftDesk — vos identifiants')
            ->text($this->buildTextBody($firstName, $siteName, $emailAddress, $plainPassword, $roleLabel, $loginUrl))
            ->html($this->buildHtmlBody($firstName, $siteName, $emailAddress, $plainPassword, $roleLabel, $loginUrl));

        try {
            $this->mailer->send($email);
        } catch (TransportExceptionInterface $exception) {
            // The account is already created: a mail failure must not roll it
            // back, but it must be visible in the logs for operations.
            $this->logger->error('Failed to send the recruitment welcome email.', [
                'email' => $emailAddress,
                'exception' => $exception->getMessage(),
            ]);
        }
    }

    private function buildTextBody(
        string $firstName,
        string $siteName,
        string $emailAddress,
        string $plainPassword,
        string $roleLabel,
        string $loginUrl,
    ): string {
        return <<<TXT
Bonjour {$firstName},

Votre compte employé a été créé sur ShiftDesk ({$siteName}).

Identifiant : {$emailAddress}
Mot de passe temporaire : {$plainPassword}
Poste : {$roleLabel}

Connectez-vous ici : {$loginUrl}

Conservez ce mot de passe temporaire. À la première connexion, vous serez
invité(e) à choisir votre propre mot de passe.

— L'équipe ShiftDesk
TXT;
    }

    /**
     * HTML layout aligned with the ShiftDesk / Carrefour UI: brand stripe,
     * blue header, white card, primary CTA. Styles are inlined for mail clients.
     */
    private function buildHtmlBody(
        string $firstName,
        string $siteName,
        string $emailAddress,
        string $plainPassword,
        string $roleLabel,
        string $loginUrl,
    ): string {
        $firstName = $this->e($firstName);
        $siteName = $this->e($siteName);
        $emailAddress = $this->e($emailAddress);
        $plainPassword = $this->e($plainPassword);
        $roleLabel = $this->e($roleLabel);
        $loginUrl = $this->e($loginUrl);

        return <<<HTML
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenue sur ShiftDesk</title>
</head>
<body style="margin:0;padding:0;background-color:#eef3fb;font-family:Segoe UI,Roboto,Helvetica Neue,Arial,sans-serif;color:#0f1b2d;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#eef3fb;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #d5e0ef;box-shadow:0 2px 8px rgba(6,49,107,0.12);">
          <tr>
            <td style="height:4px;line-height:4px;font-size:0;background:linear-gradient(90deg,#e30613 0%,#0a4b9f 45%,#0a4b9f 100%);">&nbsp;</td>
          </tr>
          <tr>
            <td style="background:linear-gradient(115deg,#06316b 0%,#0a4b9f 55%,#1462c4 100%);padding:28px 32px;text-align:center;">
              <p style="margin:0 0 6px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#eaf1fb;font-weight:600;">Carrefour Accueil</p>
              <h1 style="margin:0;font-size:26px;line-height:1.2;color:#ffffff;font-weight:700;">ShiftDesk</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#0f1b2d;">Bonjour {$firstName},</p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:#5b6b7c;">
                Votre compte employé a été créé sur <strong style="color:#0f1b2d;">ShiftDesk</strong>
                pour <strong style="color:#0f1b2d;">{$siteName}</strong>.
              </p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;background-color:#f4f7fb;border:1px solid #d5e0ef;border-radius:8px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="margin:0 0 14px;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#0a4b9f;font-weight:700;">Vos identifiants</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding:0 0 12px;font-size:13px;color:#5b6b7c;width:42%;vertical-align:top;">Identifiant</td>
                        <td style="padding:0 0 12px;font-size:14px;color:#0f1b2d;font-weight:600;word-break:break-all;">{$emailAddress}</td>
                      </tr>
                      <tr>
                        <td style="padding:0 0 12px;font-size:13px;color:#5b6b7c;width:42%;vertical-align:top;">Mot de passe temporaire</td>
                        <td style="padding:0 0 12px;font-size:14px;color:#0f1b2d;font-weight:700;font-family:Consolas,Menlo,Monaco,monospace;letter-spacing:0.02em;">{$plainPassword}</td>
                      </tr>
                      <tr>
                        <td style="padding:0;font-size:13px;color:#5b6b7c;width:42%;vertical-align:top;">Poste</td>
                        <td style="padding:0;font-size:14px;color:#0f1b2d;font-weight:600;">{$roleLabel}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;">
                <tr>
                  <td align="center" bgcolor="#0a4b9f" style="border-radius:8px;background:linear-gradient(180deg,#1462c4 0%,#0a4b9f 100%);">
                    <a href="{$loginUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">
                      Se connecter à ShiftDesk
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;line-height:1.5;color:#5b6b7c;">
                À la première connexion, vous serez invité(e) à choisir votre propre mot de passe.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px 24px;background-color:#f4f7fb;border-top:1px solid #d5e0ef;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#5b6b7c;text-align:center;">
                — L'équipe ShiftDesk<br>
                <span style="color:#8fa3bd;">Carrefour Accueil · planning &amp; équipe magasin</span>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
HTML;
    }

    private function roleLabel(User $user): string
    {
        foreach ($user->getRoles() as $role) {
            $enum = UserRole::tryFrom($role);
            if ($enum && $enum !== UserRole::ADMIN) {
                return $enum->label();
            }
        }

        return 'Employé';
    }

    private function e(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}
