<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260823220000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Adds direction_note for Direction→Direction and Direction→Accueil dashboard notes.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE direction_note (id INT AUTO_INCREMENT NOT NULL, channel VARCHAR(40) NOT NULL, body LONGTEXT NOT NULL, created_at DATETIME NOT NULL, author_id INT NOT NULL, site_id INT DEFAULT NULL, INDEX IDX_DIRECTION_NOTE_AUTHOR (author_id), INDEX IDX_DIRECTION_NOTE_SITE (site_id), INDEX idx_direction_note_channel_created (channel, created_at), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('ALTER TABLE direction_note ADD CONSTRAINT FK_DIRECTION_NOTE_AUTHOR FOREIGN KEY (author_id) REFERENCES app_user (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE direction_note ADD CONSTRAINT FK_DIRECTION_NOTE_SITE FOREIGN KEY (site_id) REFERENCES site (id) ON DELETE SET NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE direction_note DROP FOREIGN KEY FK_DIRECTION_NOTE_AUTHOR');
        $this->addSql('ALTER TABLE direction_note DROP FOREIGN KEY FK_DIRECTION_NOTE_SITE');
        $this->addSql('DROP TABLE direction_note');
    }
}
