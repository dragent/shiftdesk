<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260731240000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Ajoute la table store_closure (fermetures magasin).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE store_closure (id INT AUTO_INCREMENT NOT NULL, created_by_id INT DEFAULT NULL, start_date DATE NOT NULL, start_half_day VARCHAR(20) NOT NULL, end_date DATE NOT NULL, created_at DATETIME NOT NULL, INDEX idx_store_closure_dates (start_date, end_date), INDEX IDX_STORE_CLOSURE_CREATED_BY (created_by_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('ALTER TABLE store_closure ADD CONSTRAINT FK_STORE_CLOSURE_CREATED_BY FOREIGN KEY (created_by_id) REFERENCES app_user (id) ON DELETE SET NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE store_closure DROP FOREIGN KEY FK_STORE_CLOSURE_CREATED_BY');
        $this->addSql('DROP TABLE store_closure');
    }
}
