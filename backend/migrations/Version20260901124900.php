<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260901124900 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Annexe: useful websites (direction) and named files (direction + accueil).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE annexe_website (id INT AUTO_INCREMENT NOT NULL, name VARCHAR(150) NOT NULL, url VARCHAR(500) NOT NULL, allowed_roles JSON NOT NULL, created_at DATETIME NOT NULL, created_by_id INT NOT NULL, site_id INT DEFAULT NULL, INDEX IDX_ANNEXE_WEBSITE_AUTHOR (created_by_id), INDEX IDX_ANNEXE_WEBSITE_SITE (site_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('ALTER TABLE annexe_website ADD CONSTRAINT FK_ANNEXE_WEBSITE_AUTHOR FOREIGN KEY (created_by_id) REFERENCES app_user (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE annexe_website ADD CONSTRAINT FK_ANNEXE_WEBSITE_SITE FOREIGN KEY (site_id) REFERENCES site (id) ON DELETE SET NULL');

        $this->addSql('CREATE TABLE annexe_file (id INT AUTO_INCREMENT NOT NULL, name VARCHAR(255) NOT NULL, created_at DATETIME NOT NULL, created_by_id INT NOT NULL, site_id INT DEFAULT NULL, INDEX IDX_ANNEXE_FILE_AUTHOR (created_by_id), INDEX IDX_ANNEXE_FILE_SITE (site_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('ALTER TABLE annexe_file ADD CONSTRAINT FK_ANNEXE_FILE_AUTHOR FOREIGN KEY (created_by_id) REFERENCES app_user (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE annexe_file ADD CONSTRAINT FK_ANNEXE_FILE_SITE FOREIGN KEY (site_id) REFERENCES site (id) ON DELETE SET NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE annexe_website DROP FOREIGN KEY FK_ANNEXE_WEBSITE_AUTHOR');
        $this->addSql('ALTER TABLE annexe_website DROP FOREIGN KEY FK_ANNEXE_WEBSITE_SITE');
        $this->addSql('DROP TABLE annexe_website');

        $this->addSql('ALTER TABLE annexe_file DROP FOREIGN KEY FK_ANNEXE_FILE_AUTHOR');
        $this->addSql('ALTER TABLE annexe_file DROP FOREIGN KEY FK_ANNEXE_FILE_SITE');
        $this->addSql('DROP TABLE annexe_file');
    }
}
