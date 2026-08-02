<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/** Numéro de caissier (login caisse) pour le plan de caisse imprimé. */
final class Version20260802150000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Ajoute cashier_number sur app_user';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE app_user ADD cashier_number VARCHAR(20) DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE app_user DROP cashier_number');
    }
}
