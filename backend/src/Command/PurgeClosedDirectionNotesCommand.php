<?php

namespace App\Command;

use App\Repository\DirectionNoteRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Retention policy: permanently remove direction notes that were closed
 * more than N days ago (default 90). Run via cron, e.g. weekly.
 */
#[AsCommand(
    name: 'app:direction-notes:purge',
    description: 'Supprime les notes de direction closes depuis plus de N jours.',
)]
class PurgeClosedDirectionNotesCommand extends Command
{
    public function __construct(
        private readonly DirectionNoteRepository $directionNoteRepository,
        private readonly EntityManagerInterface $em,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addOption(
            'days',
            null,
            InputOption::VALUE_REQUIRED,
            'Nombre de jours après clôture avant suppression définitive',
            '90',
        );
        $this->addOption(
            'dry-run',
            null,
            InputOption::VALUE_NONE,
            'Affiche le nombre sans supprimer',
        );
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $days = max(1, (int) $input->getOption('days'));
        $cutoff = new \DateTimeImmutable(sprintf('-%d days', $days));
        $dryRun = (bool) $input->getOption('dry-run');

        if ($dryRun) {
            $count = (int) $this->directionNoteRepository->createQueryBuilder('n')
                ->select('COUNT(n.id)')
                ->andWhere('n.closedAt IS NOT NULL')
                ->andWhere('n.closedAt < :cutoff')
                ->setParameter('cutoff', $cutoff)
                ->getQuery()
                ->getSingleScalarResult();
            $io->success(sprintf(
                'Dry-run: %d note(s) closes avant le %s seraient supprimées.',
                $count,
                $cutoff->format('Y-m-d H:i'),
            ));

            return Command::SUCCESS;
        }

        $deleted = $this->directionNoteRepository->purgeClosedBefore($cutoff);
        $this->em->clear();

        $io->success(sprintf(
            '%d note(s) closes avant le %s ont été supprimées.',
            $deleted,
            $cutoff->format('Y-m-d H:i'),
        ));

        return Command::SUCCESS;
    }
}
