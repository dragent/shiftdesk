<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260819090000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return "Ajoute le téléphone de contact sur app_user (fiche employés).";
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE app_user ADD phone VARCHAR(30) DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE app_user DROP phone');
    }
}
