<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260722100127 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE pause ADD declared_by_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE pause ADD CONSTRAINT FK_D79A92EDC48B85B0 FOREIGN KEY (declared_by_id) REFERENCES app_user (id) ON DELETE SET NULL');
        $this->addSql('CREATE INDEX IDX_D79A92EDC48B85B0 ON pause (declared_by_id)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE pause DROP FOREIGN KEY FK_D79A92EDC48B85B0');
        $this->addSql('DROP INDEX IDX_D79A92EDC48B85B0 ON pause');
        $this->addSql('ALTER TABLE pause DROP declared_by_id');
    }
}
