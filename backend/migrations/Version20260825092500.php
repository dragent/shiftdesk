<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260825092500 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Direction notes: global close (closed_at) + personal seen receipts.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE direction_note ADD closed_at DATETIME DEFAULT NULL, ADD closed_by_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE direction_note ADD CONSTRAINT FK_DIRECTION_NOTE_CLOSED_BY FOREIGN KEY (closed_by_id) REFERENCES app_user (id) ON DELETE SET NULL');
        $this->addSql('CREATE INDEX IDX_DIRECTION_NOTE_CLOSED_BY ON direction_note (closed_by_id)');

        $this->addSql('CREATE TABLE direction_note_seen (id INT AUTO_INCREMENT NOT NULL, seen_at DATETIME NOT NULL, note_id INT NOT NULL, user_id INT NOT NULL, INDEX IDX_DIRECTION_NOTE_SEEN_NOTE (note_id), INDEX IDX_DIRECTION_NOTE_SEEN_USER (user_id), UNIQUE INDEX uniq_direction_note_seen_user (note_id, user_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('ALTER TABLE direction_note_seen ADD CONSTRAINT FK_DIRECTION_NOTE_SEEN_NOTE FOREIGN KEY (note_id) REFERENCES direction_note (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE direction_note_seen ADD CONSTRAINT FK_DIRECTION_NOTE_SEEN_USER FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE CASCADE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE direction_note_seen DROP FOREIGN KEY FK_DIRECTION_NOTE_SEEN_NOTE');
        $this->addSql('ALTER TABLE direction_note_seen DROP FOREIGN KEY FK_DIRECTION_NOTE_SEEN_USER');
        $this->addSql('DROP TABLE direction_note_seen');
        $this->addSql('ALTER TABLE direction_note DROP FOREIGN KEY FK_DIRECTION_NOTE_CLOSED_BY');
        $this->addSql('DROP INDEX IDX_DIRECTION_NOTE_CLOSED_BY ON direction_note');
        $this->addSql('ALTER TABLE direction_note DROP closed_at, DROP closed_by_id');
    }
}
