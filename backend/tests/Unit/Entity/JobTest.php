<?php

namespace App\Tests\Unit\Entity;

use App\Entity\Job;
use App\Entity\User;
use App\Enum\JobCategory;
use App\Enum\UserRole;
use PHPUnit\Framework\TestCase;

final class JobTest extends TestCase
{
    public function testOccupantCountIgnoresInactiveEmployees(): void
    {
        $job = $this->cashierJob();
        $job->getUsers()->add($this->user(true));
        $job->getUsers()->add($this->user(true));
        $job->getUsers()->add($this->user(false));

        self::assertSame(2, $job->getOccupantCount());
    }

    public function testAssignJobBindsTheMetierAndItsPermissionRole(): void
    {
        $job = $this->cashierJob();
        $user = $this->user(true);
        $user->setRoles([UserRole::HOTE->value]);
        $user->assignJob($job);

        self::assertSame($job, $user->getJob());
        self::assertTrue($user->hasRole(UserRole::CAISSIER));
        self::assertFalse($user->hasRole(UserRole::HOTE));
    }

    private function cashierJob(): Job
    {
        $job = new Job();
        $job->setCode('CHEF_DE_CAISSE');
        $job->setLabel('Chef de caisse');
        $job->setCategory(JobCategory::ACCUEIL_CAISSE);
        $job->setGrantsRole(UserRole::CAISSIER);
        $job->setProtected(false);
        $job->setPosition(70);

        return $job;
    }

    private function user(bool $active): User
    {
        $user = new User();
        $user->setEmail(($active ? 'actif' : 'inactif').'@test.local');
        $user->setFirstName('Test');
        $user->setLastName('User');
        $user->setPassword('hash');
        $user->setActive($active);

        return $user;
    }
}
