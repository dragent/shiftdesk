<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260901110000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Job catalogue: métiers by category, Directeur/rice protected, user.job_id.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE job (
                id INT AUTO_INCREMENT NOT NULL,
                code VARCHAR(50) NOT NULL,
                label VARCHAR(100) NOT NULL,
                category VARCHAR(30) NOT NULL,
                grants_role VARCHAR(50) NOT NULL,
                protected TINYINT(1) NOT NULL,
                position INT NOT NULL,
                UNIQUE INDEX uniq_job_code (code),
                PRIMARY KEY(id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
            SQL);

        $this->addSql(<<<'SQL'
            INSERT INTO job (code, label, category, grants_role, protected, position) VALUES
            ('DIRECTEUR', 'Directeur/rice', 'DIRECTION', 'ROLE_DIRECTEUR', 1, 10),
            ('CAISSIER', 'Caissier(ère)', 'ACCUEIL_CAISSE', 'ROLE_CAISSIER', 0, 20),
            ('LAD', 'LAD', 'ACCUEIL_CAISSE', 'ROLE_LAD', 0, 30),
            ('HOTE', 'Hôte(sse) d''accueil', 'ACCUEIL_CAISSE', 'ROLE_HOTE', 0, 40),
            ('SECURITE', 'Sécurité', 'SECURITE', 'ROLE_SECURITE', 0, 50),
            ('RAYON', 'Rayon', 'RAYON', 'ROLE_RAYON', 0, 60)
            SQL);

        $this->addSql('ALTER TABLE app_user ADD job_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE app_user ADD CONSTRAINT FK_88BDF3E9BE04EA9 FOREIGN KEY (job_id) REFERENCES job (id) ON DELETE SET NULL');
        $this->addSql('CREATE INDEX IDX_88BDF3E9BE04EA9 ON app_user (job_id)');

        $this->addSql(<<<'SQL'
            UPDATE app_user SET job_id = (SELECT id FROM job WHERE code = 'DIRECTEUR')
            WHERE roles LIKE '%ROLE_DIRECTEUR%' OR roles LIKE '%ROLE_DIRECTION%'
            SQL);
        $this->addSql(<<<'SQL'
            UPDATE app_user SET job_id = (SELECT id FROM job WHERE code = 'CAISSIER')
            WHERE roles LIKE '%ROLE_CAISSIER%'
            SQL);
        $this->addSql(<<<'SQL'
            UPDATE app_user SET job_id = (SELECT id FROM job WHERE code = 'LAD')
            WHERE roles LIKE '%ROLE_LAD%'
            SQL);
        $this->addSql(<<<'SQL'
            UPDATE app_user SET job_id = (SELECT id FROM job WHERE code = 'HOTE')
            WHERE roles LIKE '%ROLE_HOTE%'
            SQL);
        $this->addSql(<<<'SQL'
            UPDATE app_user SET job_id = (SELECT id FROM job WHERE code = 'SECURITE')
            WHERE roles LIKE '%ROLE_SECURITE%'
            SQL);
        $this->addSql(<<<'SQL'
            UPDATE app_user SET job_id = (SELECT id FROM job WHERE code = 'RAYON')
            WHERE roles LIKE '%ROLE_RAYON%'
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE app_user DROP FOREIGN KEY FK_88BDF3E9BE04EA9');
        $this->addSql('DROP INDEX IDX_88BDF3E9BE04EA9 ON app_user');
        $this->addSql('ALTER TABLE app_user DROP job_id');
        $this->addSql('DROP TABLE job');
    }
}
