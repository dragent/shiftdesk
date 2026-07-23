<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260722120726 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Ajoute la bascule en cours de créneau (register_segments) sur le planning.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE planning ADD register_segments JSON DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE planning DROP register_segments');
    }
}
