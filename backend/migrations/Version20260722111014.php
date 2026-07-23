<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260722111014 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Ajoute le numéro de caisse (plan de caisse) sur les créneaux de planning.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE planning ADD register_number INT DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE planning DROP register_number');
    }
}
