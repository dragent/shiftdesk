<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260722085333 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE accueil_request (id INT AUTO_INCREMENT NOT NULL, visitor_name VARCHAR(150) DEFAULT NULL, subject VARCHAR(200) NOT NULL, description LONGTEXT DEFAULT NULL, status VARCHAR(20) NOT NULL, created_at DATETIME NOT NULL, resolved_at DATETIME DEFAULT NULL, hote_id INT NOT NULL, category_id INT NOT NULL, site_id INT DEFAULT NULL, INDEX IDX_4FA1A191453D3D6F (hote_id), INDEX IDX_4FA1A19112469DE2 (category_id), INDEX IDX_4FA1A191F6BD1646 (site_id), INDEX idx_request_created_at (created_at), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE app_user (id INT AUTO_INCREMENT NOT NULL, email VARCHAR(180) NOT NULL, roles JSON NOT NULL, password VARCHAR(255) NOT NULL, first_name VARCHAR(100) NOT NULL, last_name VARCHAR(100) NOT NULL, active TINYINT NOT NULL, created_at DATETIME NOT NULL, site_id INT DEFAULT NULL, INDEX IDX_88BDF3E9F6BD1646 (site_id), UNIQUE INDEX uniq_user_email (email), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE pause (id INT AUTO_INCREMENT NOT NULL, type VARCHAR(20) NOT NULL, status VARCHAR(20) NOT NULL, started_at DATETIME NOT NULL, ended_at DATETIME DEFAULT NULL, user_id INT NOT NULL, planning_id INT DEFAULT NULL, INDEX IDX_D79A92EDA76ED395 (user_id), INDEX IDX_D79A92ED3D865311 (planning_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE planning (id INT AUTO_INCREMENT NOT NULL, work_date DATE NOT NULL, start_time TIME NOT NULL, end_time TIME NOT NULL, status VARCHAR(20) NOT NULL, note VARCHAR(255) DEFAULT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, user_id INT NOT NULL, site_id INT DEFAULT NULL, created_by_id INT DEFAULT NULL, INDEX IDX_D499BFF6A76ED395 (user_id), INDEX IDX_D499BFF6F6BD1646 (site_id), INDEX IDX_D499BFF6B03A8386 (created_by_id), INDEX idx_planning_date (work_date), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE planning_insight (id INT AUTO_INCREMENT NOT NULL, type VARCHAR(30) NOT NULL, severity VARCHAR(20) NOT NULL, target_date DATE NOT NULL, message LONGTEXT NOT NULL, payload JSON DEFAULT NULL, status VARCHAR(20) NOT NULL, created_at DATETIME NOT NULL, site_id INT DEFAULT NULL, INDEX IDX_23594E30F6BD1646 (site_id), INDEX idx_insight_target_date (target_date), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE request_category (id INT AUTO_INCREMENT NOT NULL, code VARCHAR(50) NOT NULL, label VARCHAR(100) NOT NULL, description VARCHAR(255) DEFAULT NULL, active TINYINT NOT NULL, position INT NOT NULL, UNIQUE INDEX uniq_category_code (code), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE site (id INT AUTO_INCREMENT NOT NULL, name VARCHAR(150) NOT NULL, address VARCHAR(255) DEFAULT NULL, postal_code VARCHAR(20) DEFAULT NULL, city VARCHAR(100) DEFAULT NULL, active TINYINT NOT NULL, created_at DATETIME NOT NULL, PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('ALTER TABLE accueil_request ADD CONSTRAINT FK_4FA1A191453D3D6F FOREIGN KEY (hote_id) REFERENCES app_user (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE accueil_request ADD CONSTRAINT FK_4FA1A19112469DE2 FOREIGN KEY (category_id) REFERENCES request_category (id) ON DELETE RESTRICT');
        $this->addSql('ALTER TABLE accueil_request ADD CONSTRAINT FK_4FA1A191F6BD1646 FOREIGN KEY (site_id) REFERENCES site (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE app_user ADD CONSTRAINT FK_88BDF3E9F6BD1646 FOREIGN KEY (site_id) REFERENCES site (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE pause ADD CONSTRAINT FK_D79A92EDA76ED395 FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE pause ADD CONSTRAINT FK_D79A92ED3D865311 FOREIGN KEY (planning_id) REFERENCES planning (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE planning ADD CONSTRAINT FK_D499BFF6A76ED395 FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE planning ADD CONSTRAINT FK_D499BFF6F6BD1646 FOREIGN KEY (site_id) REFERENCES site (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE planning ADD CONSTRAINT FK_D499BFF6B03A8386 FOREIGN KEY (created_by_id) REFERENCES app_user (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE planning_insight ADD CONSTRAINT FK_23594E30F6BD1646 FOREIGN KEY (site_id) REFERENCES site (id) ON DELETE SET NULL');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE accueil_request DROP FOREIGN KEY FK_4FA1A191453D3D6F');
        $this->addSql('ALTER TABLE accueil_request DROP FOREIGN KEY FK_4FA1A19112469DE2');
        $this->addSql('ALTER TABLE accueil_request DROP FOREIGN KEY FK_4FA1A191F6BD1646');
        $this->addSql('ALTER TABLE app_user DROP FOREIGN KEY FK_88BDF3E9F6BD1646');
        $this->addSql('ALTER TABLE pause DROP FOREIGN KEY FK_D79A92EDA76ED395');
        $this->addSql('ALTER TABLE pause DROP FOREIGN KEY FK_D79A92ED3D865311');
        $this->addSql('ALTER TABLE planning DROP FOREIGN KEY FK_D499BFF6A76ED395');
        $this->addSql('ALTER TABLE planning DROP FOREIGN KEY FK_D499BFF6F6BD1646');
        $this->addSql('ALTER TABLE planning DROP FOREIGN KEY FK_D499BFF6B03A8386');
        $this->addSql('ALTER TABLE planning_insight DROP FOREIGN KEY FK_23594E30F6BD1646');
        $this->addSql('DROP TABLE accueil_request');
        $this->addSql('DROP TABLE app_user');
        $this->addSql('DROP TABLE pause');
        $this->addSql('DROP TABLE planning');
        $this->addSql('DROP TABLE planning_insight');
        $this->addSql('DROP TABLE request_category');
        $this->addSql('DROP TABLE site');
    }
}
