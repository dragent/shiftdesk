<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260901090000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Directeur/rice job: existing ROLE_DIRECTION holders become ROLE_DIRECTEUR (which still carries ROLE_DIRECTION).';
    }

    public function up(Schema $schema): void
    {
        // « Direction » is now the category; « Directeur/rice » is the job
        // inside it. The stored role becomes the job, the category role being
        // re-added at runtime by UserRole::impliedRoles().
        $this->addSql(<<<'SQL'
            UPDATE app_user
            SET roles = REPLACE(roles, '"ROLE_DIRECTION"', '"ROLE_DIRECTEUR"')
            WHERE roles LIKE '%"ROLE_DIRECTION"%'
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            UPDATE app_user
            SET roles = REPLACE(roles, '"ROLE_DIRECTEUR"', '"ROLE_DIRECTION"')
            WHERE roles LIKE '%"ROLE_DIRECTEUR"%'
            SQL);
    }
}
