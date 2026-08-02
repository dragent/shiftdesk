<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260731010000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Ajoute le flag en_caisse sur le planning (LAD / hôtes affectés en caisse).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE planning ADD en_caisse TINYINT(1) DEFAULT 0 NOT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE planning DROP en_caisse');
    }
}
