<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260731020000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Ajoute la table absence (arrêt de travail / congé).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE absence (id INT AUTO_INCREMENT NOT NULL, user_id INT NOT NULL, created_by_id INT DEFAULT NULL, reason VARCHAR(30) NOT NULL, start_date DATE NOT NULL, end_date DATE NOT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, INDEX idx_absence_dates (start_date, end_date), INDEX IDX_437B304CA76ED395 (user_id), INDEX IDX_437B304CB03A8386 (created_by_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('ALTER TABLE absence ADD CONSTRAINT FK_437B304CA76ED395 FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE absence ADD CONSTRAINT FK_437B304CB03A8386 FOREIGN KEY (created_by_id) REFERENCES app_user (id) ON DELETE SET NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE absence DROP FOREIGN KEY FK_437B304CA76ED395');
        $this->addSql('ALTER TABLE absence DROP FOREIGN KEY FK_437B304CB03A8386');
        $this->addSql('DROP TABLE absence');
    }
}
