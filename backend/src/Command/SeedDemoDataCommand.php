<?php

namespace App\Command;

use App\Entity\RequestCategory;
use App\Entity\Site;
use App\Entity\User;
use App\Enum\UserRole;
use App\Repository\RequestCategoryRepository;
use App\Repository\SiteRepository;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

/**
 * Initialise des données de démonstration : un site, les 3 comptes de
 * rôle (admin/direction/hôte) et les catégories de demandes par défaut
 * (Caroline, Siebel, Menu Carrefour). Idempotent : peut être relancée
 * sans dupliquer les données.
 */
#[AsCommand(name: 'app:seed-demo', description: 'Initialise les données de démonstration (site, comptes, catégories).')]
class SeedDemoDataCommand extends Command
{
    private const DEMO_PASSWORD = 'Password123!';

    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly SiteRepository $siteRepository,
        private readonly UserRepository $userRepository,
        private readonly RequestCategoryRepository $categoryRepository,
        private readonly UserPasswordHasherInterface $passwordHasher,
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        $site = $this->siteRepository->findOneBy(['name' => 'Carrefour Market - Centre Ville']);
        if (!$site) {
            $site = new Site();
            $site->setName('Carrefour Market - Centre Ville');
            $site->setAddress('12 rue de la République');
            $site->setPostalCode('69001');
            $site->setCity('Lyon');
            $this->em->persist($site);
            $io->text('Site créé : Carrefour Market - Centre Ville');
        }

        $this->createUserIfMissing('admin@carrefour-accueil.local', 'Admin', 'Système', UserRole::ADMIN, $site, $io);
        $this->createUserIfMissing('direction@carrefour-accueil.local', 'Nadia', 'Direction', UserRole::DIRECTION, $site, $io);
        $this->createUserIfMissing('hote@carrefour-accueil.local', 'Caroline', 'Hôtesse', UserRole::HOTE, $site, $io);
        $this->createUserIfMissing('rayon@carrefour-accueil.local', 'Fatou', 'Rayon', UserRole::RAYON, $site, $io);
        $this->createUserIfMissing('securite@carrefour-accueil.local', 'Marc', 'Sécurité', UserRole::SECURITE, $site, $io);

        $this->createUserIfMissing('julie.martin@caissier.carrefour-accueil.local', 'Julie', 'Martin', UserRole::CAISSIER, $site, $io);
        $this->createUserIfMissing('karim.benali@caissier.carrefour-accueil.local', 'Karim', 'Benali', UserRole::CAISSIER, $site, $io);
        $this->createUserIfMissing('sophie.durand@caissier.carrefour-accueil.local', 'Sophie', 'Durand', UserRole::CAISSIER, $site, $io);

        // Contrats horaires hebdomadaires par défaut des employés de démo
        // (en minutes : 36h45 = 2205min, 30h00 = 1800min).
        $this->setContractMinutes('hote@carrefour-accueil.local', 2205, $io); // Caroline : 36h45
        $this->setContractMinutes('karim.benali@caissier.carrefour-accueil.local', 2205, $io); // 36h45
        $this->setContractMinutes('sophie.durand@caissier.carrefour-accueil.local', 2205, $io); // 36h45
        $this->setContractMinutes('julie.martin@caissier.carrefour-accueil.local', 1800, $io); // 30h00

        $this->createCategoryIfMissing('CAROLINE', 'Caroline', 'Demandes liées à l\'outil Caroline.', 1, $io);
        $this->createCategoryIfMissing('SIEBEL', 'Siebel', 'Demandes liées au CRM Siebel.', 2, $io);
        $this->createCategoryIfMissing('MENU_CARREFOUR', 'Menu Carrefour', 'Demandes liées au menu / catalogue de services Carrefour.', 3, $io);

        $this->em->flush();

        $io->success('Données de démonstration prêtes. Mot de passe pour tous les comptes : '.self::DEMO_PASSWORD);

        return Command::SUCCESS;
    }

    private function createUserIfMissing(string $email, string $firstName, string $lastName, UserRole $role, Site $site, SymfonyStyle $io): void
    {
        if ($this->userRepository->findOneByEmail($email)) {
            return;
        }

        $user = new User();
        $user->setEmail($email);
        $user->setFirstName($firstName);
        $user->setLastName($lastName);
        $user->setRoles([$role->value]);
        $user->setSite($site);
        $user->setPassword($this->passwordHasher->hashPassword($user, self::DEMO_PASSWORD));

        $this->em->persist($user);
        $io->text(sprintf('Utilisateur créé : %s (%s)', $email, $role->label()));
    }

    private function setContractMinutes(string $email, int $minutes, SymfonyStyle $io): void
    {
        $user = $this->userRepository->findOneByEmail($email);
        if (!$user) {
            return;
        }

        if ($user->getContractMinutes() === $minutes) {
            return;
        }

        $user->setContractMinutes($minutes);
        $io->text(sprintf('Contrat mis à jour : %s -> %dh%02d', $email, intdiv($minutes, 60), $minutes % 60));
    }

    private function createCategoryIfMissing(string $code, string $label, string $description, int $position, SymfonyStyle $io): void
    {
        if ($this->categoryRepository->findOneBy(['code' => $code])) {
            return;
        }

        $category = new RequestCategory();
        $category->setCode($code);
        $category->setLabel($label);
        $category->setDescription($description);
        $category->setPosition($position);

        $this->em->persist($category);
        $io->text(sprintf('Catégorie créée : %s', $label));
    }
}
