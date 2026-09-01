<?php

namespace App\Tests\Unit\Enum;

use App\Enum\JobCategory;
use App\Enum\UserRole;
use PHPUnit\Framework\TestCase;

final class JobCategoryTest extends TestCase
{
    public function testDirectionIsACategoryNotAJob(): void
    {
        self::assertSame('Direction', JobCategory::DIRECTION->label());
        self::assertSame(UserRole::DIRECTION, JobCategory::DIRECTION->defaultGrantsRole());
        self::assertNull(JobCategory::tryFrom('DIRECTEUR'));
        self::assertNull(JobCategory::tryFrom('Directeur/rice'));
    }

    public function testNewJobsInheritTheCategoryPermissionRole(): void
    {
        self::assertSame(UserRole::CAISSIER, JobCategory::ACCUEIL_CAISSE->defaultGrantsRole());
        self::assertSame(UserRole::SECURITE, JobCategory::SECURITE->defaultGrantsRole());
        self::assertSame(UserRole::RAYON, JobCategory::RAYON->defaultGrantsRole());
    }

    public function testEveryCategoryHasAFrenchLabel(): void
    {
        self::assertSame('Accueil / Caisse', JobCategory::ACCUEIL_CAISSE->label());
        self::assertSame('Sécurité', JobCategory::SECURITE->label());
        self::assertSame('Rayon', JobCategory::RAYON->label());
        self::assertCount(4, JobCategory::cases());
    }
}
