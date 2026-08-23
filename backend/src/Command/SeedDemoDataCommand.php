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
 * Initialises demonstration data: one site, the 3 role accounts
 * (admin/management/host) and the default request categories (Caroline,
 * Siebel, Menu Carrefour). Idempotent: can be run again without duplicating
 * data.
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
        $this->createUserIfMissing('lad@carrefour-accueil.local', 'Yanis', 'Lad', UserRole::LAD, $site, $io);
        $this->createUserIfMissing('rayon@carrefour-accueil.local', 'Fatou', 'Rayon', UserRole::RAYON, $site, $io);
        $this->createUserIfMissing('securite@carrefour-accueil.local', 'Marc', 'Sécurité', UserRole::SECURITE, $site, $io);

        $this->createUserIfMissing('julie.martin@caissier.carrefour-accueil.local', 'Julie', 'Martin', UserRole::CAISSIER, $site, $io);
        $this->createUserIfMissing('karim.benali@caissier.carrefour-accueil.local', 'Karim', 'Benali', UserRole::CAISSIER, $site, $io);
        $this->createUserIfMissing('sophie.durand@caissier.carrefour-accueil.local', 'Sophie', 'Durand', UserRole::CAISSIER, $site, $io);

        // Flush before the contract updates: setContractMinutes() loads through
        // the repository (SQL), so the users must already exist in database.
        $this->em->flush();

        // Default weekly contract hours for every demo employee (in minutes:
        // 36h45 = 2205, 35h00 = 2100, 30h00 = 1800). Without contract hours
        // the Total column stays grey; one is set for each employee to enable
        // the green/red colour coding across the whole grid.
        $this->setContractMinutes('direction@carrefour-accueil.local', 2100, $io); // Nadia: 35h
        $this->setContractMinutes('hote@carrefour-accueil.local', 2205, $io); // Caroline: 36h45
        $this->setContractMinutes('lad@carrefour-accueil.local', 2100, $io); // Yanis: 35h
        $this->setContractMinutes('rayon@carrefour-accueil.local', 2100, $io); // Fatou: 35h
        $this->setContractMinutes('securite@carrefour-accueil.local', 2100, $io); // Marc: 35h
        $this->setContractMinutes('karim.benali@caissier.carrefour-accueil.local', 2205, $io); // 36h45
        $this->setContractMinutes('sophie.durand@caissier.carrefour-accueil.local', 2205, $io); // 36h45
        $this->setContractMinutes('julie.martin@caissier.carrefour-accueil.local', 1800, $io); // 30h00
        $this->setCashierNumber('julie.martin@caissier.carrefour-accueil.local', '101', $io);
        $this->setCashierNumber('karim.benali@caissier.carrefour-accueil.local', '102', $io);
        $this->setCashierNumber('sophie.durand@caissier.carrefour-accueil.local', '103', $io);

        // Contact phone numbers displayed on the employee record (management).
        $this->setPhone('direction@carrefour-accueil.local', '06 12 00 01 01', $io);
        $this->setPhone('hote@carrefour-accueil.local', '06 12 00 02 02', $io);
        $this->setPhone('lad@carrefour-accueil.local', '06 12 00 03 03', $io);
        $this->setPhone('rayon@carrefour-accueil.local', '06 12 00 04 04', $io);
        $this->setPhone('securite@carrefour-accueil.local', '06 12 00 05 05', $io);
        $this->setPhone('julie.martin@caissier.carrefour-accueil.local', '06 12 00 06 06', $io);
        $this->setPhone('karim.benali@caissier.carrefour-accueil.local', '06 12 00 07 07', $io);
        $this->setPhone('sophie.durand@caissier.carrefour-accueil.local', '06 12 00 08 08', $io);

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

    private function setCashierNumber(string $email, string $number, SymfonyStyle $io): void
    {
        $user = $this->userRepository->findOneByEmail($email);
        if (!$user || $user->getCashierNumber() === $number) {
            return;
        }

        $user->setCashierNumber($number);
        $io->text(sprintf('N° caissier mis à jour : %s -> %s', $email, $number));
    }

    private function setPhone(string $email, string $phone, SymfonyStyle $io): void
    {
        $user = $this->userRepository->findOneByEmail($email);
        if (!$user || $user->getPhone() !== null) {
            return;
        }

        $user->setPhone($phone);
        $io->text(sprintf('Téléphone mis à jour : %s -> %s', $email, $phone));
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
