<?php

namespace App\Tests\Unit\Entity;

use App\Entity\AnnexeWebsite;
use App\Entity\User;
use App\Enum\UserRole;
use PHPUnit\Framework\TestCase;

final class AnnexeWebsiteTest extends TestCase
{
    public function testSetUrlPrefixesHttpsWhenSchemeIsMissing(): void
    {
        $website = new AnnexeWebsite();
        $website->setUrl('intranet.carrefour.local/caroline');

        self::assertSame('https://intranet.carrefour.local/caroline', $website->getUrl());
    }

    public function testSetUrlKeepsExistingScheme(): void
    {
        $website = new AnnexeWebsite();
        $website->setUrl('http://intranet/menu');

        self::assertSame('http://intranet/menu', $website->getUrl());
    }

    public function testCaissierCannotAccessWebsiteReservedToHote(): void
    {
        $website = new AnnexeWebsite();
        $website->setAllowedRoles([UserRole::HOTE->value]);

        $caissier = $this->user(UserRole::CAISSIER);
        $hote = $this->user(UserRole::HOTE);
        $direction = $this->user(UserRole::DIRECTION);

        self::assertFalse($website->isAccessibleBy($caissier));
        self::assertTrue($website->isAccessibleBy($hote));
        self::assertTrue($website->isAccessibleBy($direction));
    }

    private function user(UserRole $role): User
    {
        $user = new User();
        $user->setEmail(strtolower($role->name).'@test.local');
        $user->setFirstName('Test');
        $user->setLastName($role->name);
        $user->setPassword('x');
        $user->setRoles([$role->value]);

        return $user;
    }
}
