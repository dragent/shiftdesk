<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260825113000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Direction notes: priority (NORMAL/URGENT) + updated_at for edit tracking.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql("ALTER TABLE direction_note ADD priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL', ADD updated_at DATETIME DEFAULT NULL");
        $this->addSql("UPDATE direction_note SET updated_at = created_at WHERE updated_at IS NULL");
        $this->addSql('ALTER TABLE direction_note MODIFY updated_at DATETIME NOT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE direction_note DROP priority, DROP updated_at');
    }
}
