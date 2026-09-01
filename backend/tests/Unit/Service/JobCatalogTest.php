<?php

namespace App\Tests\Unit\Service;

use App\Entity\Job;
use App\Enum\JobCategory;
use App\Enum\UserRole;
use App\Repository\JobRepository;
use App\Service\JobCatalog;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\TestCase;

final class JobCatalogTest extends TestCase
{
    public function testBuiltinsCoverTheFourCategoriesAndProtectOnlyDirecteur(): void
    {
        $builtins = JobCatalog::builtins();
        $codes = array_column($builtins, 'code');

        self::assertSame(['DIRECTEUR', 'CAISSIER', 'LAD', 'HOTE', 'SECURITE', 'RAYON'], $codes);
        self::assertTrue($builtins[0]['protected']);
        self::assertSame(UserRole::DIRECTEUR, $builtins[0]['grantsRole']);
        self::assertSame(JobCategory::DIRECTION, $builtins[0]['category']);

        foreach (array_slice($builtins, 1) as $def) {
            self::assertFalse($def['protected'], $def['code']);
        }
    }

    public function testEnsureBuiltinsInsertsMissingJobsOnce(): void
    {
        $jobs = $this->createStub(JobRepository::class);
        $jobs->method('findOneByCode')->willReturn(null);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->expects(self::exactly(count(JobCatalog::builtins())))->method('persist');
        $em->expects(self::once())->method('flush');

        (new JobCatalog($jobs, $em))->ensureBuiltins();
    }

    public function testEnsureBuiltinsIsIdempotentWhenJobsAlreadyExist(): void
    {
        $existing = (new Job())->setCode('CAISSIER');
        $jobs = $this->createStub(JobRepository::class);
        $jobs->method('findOneByCode')->willReturn($existing);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->expects(self::never())->method('persist');
        $em->expects(self::once())->method('flush');

        (new JobCatalog($jobs, $em))->ensureBuiltins();
    }

    public function testCodeFromLabelSlugifiesAPlainTitle(): void
    {
        $catalog = $this->catalogNeverColliding();

        self::assertSame('CHEF_DE_CAISSE', $catalog->codeFromLabel('Chef de caisse'));
        self::assertSame('ADJOINT_DE_DIRECTION', $catalog->codeFromLabel('Adjoint de direction'));
    }

    public function testReservedLabelsDoNotReuseProtectedOrSystemCodes(): void
    {
        $catalog = $this->catalogNeverColliding();

        self::assertSame('JOB_DIRECTEUR', $catalog->codeFromLabel('Directeur'));
        self::assertSame('JOB_DIRECTION', $catalog->codeFromLabel('Direction'));
        self::assertSame('JOB_ADMIN', $catalog->codeFromLabel('Admin'));
        self::assertSame('JOB_USER', $catalog->codeFromLabel('User'));
    }

    public function testDuplicateLabelsGetANumericSuffix(): void
    {
        $taken = ['CHEF_DE_CAISSE' => true];
        $jobs = $this->createStub(JobRepository::class);
        $jobs->method('findOneByCode')->willReturnCallback(
            function (string $code) use (&$taken): ?Job {
                return isset($taken[$code]) ? (new Job())->setCode($code) : null;
            },
        );

        $catalog = new JobCatalog($jobs, $this->createStub(EntityManagerInterface::class));

        self::assertSame('CHEF_DE_CAISSE_2', $catalog->codeFromLabel('Chef de caisse'));
    }

    public function testLabelWithoutALeadingLetterGetsAJobPrefix(): void
    {
        $catalog = $this->catalogNeverColliding();

        self::assertSame('JOB_2E_LIGNE', $catalog->codeFromLabel('2e ligne'));
        self::assertSame('JOB_', $catalog->codeFromLabel('...'));
    }

    private function catalogNeverColliding(): JobCatalog
    {
        $jobs = $this->createStub(JobRepository::class);
        $jobs->method('findOneByCode')->willReturn(null);

        return new JobCatalog($jobs, $this->createStub(EntityManagerInterface::class));
    }
}
