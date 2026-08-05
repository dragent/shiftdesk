<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260731230000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Ajoute start_time / end_time sur absence (horaires pour arrêt de travail).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE absence ADD start_time TIME DEFAULT NULL, ADD end_time TIME DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE absence DROP start_time, DROP end_time');
    }
}
