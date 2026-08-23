<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260820080000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return "Ajoute la date de licenciement sur app_user (fiche employés).";
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE app_user ADD dismissed_at DATE DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE app_user DROP dismissed_at');
    }
}
