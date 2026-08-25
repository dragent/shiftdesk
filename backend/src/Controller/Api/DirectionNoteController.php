<?php

namespace App\Controller\Api;

use App\Entity\DirectionNote;
use App\Entity\DirectionNoteSeen;
use App\Entity\User;
use App\Enum\DirectionNoteChannel;
use App\Enum\DirectionNotePriority;
use App\Enum\UserRole;
use App\Repository\DirectionNoteRepository;
use App\Repository\DirectionNoteSeenRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Serializer\SerializerInterface;

/**
 * Dashboard notes posted by management: internal (Direction → Direction)
 * or shared with reception hosts (Direction → Accueil).
 *
 * Access:
 * - ROLE_ADMIN / ROLE_DIRECTION: full CRUD, both channels, readers list, close
 * - ROLE_HOTE: read DIRECTION_ACCUEIL + mark seen only
 *
 * Site scope: notes of the user's site (or notes without a site). Users
 * without a site only see unscoped notes.
 */
#[Route('/api/direction-notes')]
class DirectionNoteController extends AbstractApiController
{
    public function __construct(
        SerializerInterface $serializer,
        private readonly DirectionNoteRepository $directionNoteRepository,
        private readonly DirectionNoteSeenRepository $directionNoteSeenRepository,
        private readonly EntityManagerInterface $em,
    ) {
        parent::__construct($serializer);
    }

    #[Route('', name: 'api_direction_notes_list', methods: ['GET'])]
    public function list(Request $request, #[CurrentUser] User $currentUser): JsonResponse
    {
        $channel = DirectionNoteChannel::tryFrom((string) $request->query->get('channel', ''));
        if (!$channel) {
            return $this->respondError('Canal invalide (DIRECTION_DIRECTION ou DIRECTION_ACCUEIL).', 422);
        }

        if (!$this->canReadChannel($currentUser, $channel)) {
            return $this->respondError('Accès refusé à ce canal de notes.', 403);
        }

        $status = (string) $request->query->get('status', 'open');
        if (!\in_array($status, ['open', 'closed', 'all'], true)) {
            return $this->respondError('Statut invalide (open, closed ou all).', 422);
        }

        // Closed / all history is Direction-only (hôtes only need open notes).
        if ($status !== 'open' && !$this->isDirectionOrAdmin($currentUser)) {
            return $this->respondError('Seul la direction peut consulter l\'historique des notes.', 403);
        }

        $limit = (int) $request->query->get('limit', 20);
        $offset = (int) $request->query->get('offset', 0);
        $siteId = $currentUser->getSite()?->getId();
        $notes = $this->directionNoteRepository->findByChannel($channel, $siteId, $status, $limit, $offset);
        $this->hydrateSeenByMe($notes, $currentUser);
        if ($this->isDirectionOrAdmin($currentUser)) {
            $this->hydrateSeenCounts($notes);
        }

        return $this->respond($notes, 200, ['direction_note:read', 'user:read', 'site:read']);
    }

    /**
     * Unread open notes across every channel the current user can read.
     * Used by the nav badge, browser tab title, and toast notifications.
     */
    #[Route('/unread-count', name: 'api_direction_notes_unread_count', methods: ['GET'])]
    public function unreadCount(#[CurrentUser] User $currentUser): JsonResponse
    {
        $channels = $this->readableChannels($currentUser);
        $siteId = $currentUser->getSite()?->getId();
        $summary = $this->directionNoteRepository->unreadSummaryForUser($currentUser, $channels, $siteId);

        return new JsonResponse($summary);
    }

    #[Route('', name: 'api_direction_notes_create', methods: ['POST'])]
    public function create(Request $request, #[CurrentUser] User $currentUser): JsonResponse
    {
        if (!$this->isDirectionOrAdmin($currentUser)) {
            return $this->respondError('Seule la direction peut publier une note.', 403);
        }

        $data = $this->decode($request->getContent());
        $channel = DirectionNoteChannel::tryFrom((string) ($data['channel'] ?? ''));
        if (!$channel) {
            return $this->respondError('Canal invalide (DIRECTION_DIRECTION ou DIRECTION_ACCUEIL).', 422);
        }

        $body = trim((string) ($data['body'] ?? ''));
        if ($body === '') {
            return $this->respondError('Le contenu de la note est obligatoire.', 422);
        }
        if (mb_strlen($body) > 2000) {
            return $this->respondError('La note ne peut pas dépasser 2000 caractères.', 422);
        }

        $priority = DirectionNotePriority::tryFrom((string) ($data['priority'] ?? 'NORMAL'))
            ?? DirectionNotePriority::NORMAL;

        $note = new DirectionNote();
        $note->setChannel($channel);
        $note->setBody($body);
        $note->setPriority($priority);
        $note->setAuthor($currentUser);
        $note->setSite($currentUser->getSite());

        $this->em->persist($note);
        $this->em->flush();

        $note->setSeenByMe(false);
        $note->setSeenCount(0);

        return $this->respond($note, 201, ['direction_note:read', 'user:read', 'site:read']);
    }

    #[Route('/{id}', name: 'api_direction_notes_update', methods: ['PATCH'], requirements: ['id' => '\d+'])]
    public function update(int $id, Request $request, #[CurrentUser] User $currentUser): JsonResponse
    {
        if (!$this->isDirectionOrAdmin($currentUser)) {
            return $this->respondError('Seule la direction peut modifier une note.', 403);
        }

        $note = $this->directionNoteRepository->find($id);
        if (!$note) {
            return $this->respondError('Note introuvable.', 404);
        }
        if ($note->isClosed()) {
            return $this->respondError('Impossible de modifier une note close.', 422);
        }

        $data = $this->decode($request->getContent());
        if (\array_key_exists('body', $data)) {
            $body = trim((string) $data['body']);
            if ($body === '') {
                return $this->respondError('Le contenu de la note est obligatoire.', 422);
            }
            if (mb_strlen($body) > 2000) {
                return $this->respondError('La note ne peut pas dépasser 2000 caractères.', 422);
            }
            $note->setBody($body);
        }
        if (\array_key_exists('priority', $data)) {
            $priority = DirectionNotePriority::tryFrom((string) $data['priority']);
            if (!$priority) {
                return $this->respondError('Priorité invalide (NORMAL ou URGENT).', 422);
            }
            $note->setPriority($priority);
        }

        $this->em->flush();
        $note->setSeenByMe($this->directionNoteSeenRepository->findOneByNoteAndUser($note, $currentUser) !== null);
        $counts = $this->directionNoteSeenRepository->seenCountsForNotes([$note]);
        $note->setSeenCount($counts[(int) $note->getId()] ?? 0);

        return $this->respond($note, 200, ['direction_note:read', 'user:read', 'site:read']);
    }

    /**
     * Direction closes the note for everyone. Closed notes leave the open list
     * and appear in the closed history.
     */
    #[Route('/{id}/close', name: 'api_direction_notes_close', methods: ['PATCH'], requirements: ['id' => '\d+'])]
    public function close(int $id, #[CurrentUser] User $currentUser): JsonResponse
    {
        if (!$this->isDirectionOrAdmin($currentUser)) {
            return $this->respondError('Seule la direction peut clore une note.', 403);
        }

        $note = $this->directionNoteRepository->find($id);
        if (!$note) {
            return $this->respondError('Note introuvable.', 404);
        }
        if ($note->isClosed()) {
            return $this->respondError('Cette note est déjà close.', 422);
        }

        $note->close($currentUser);
        $this->em->flush();

        $note->setSeenByMe($this->directionNoteSeenRepository->findOneByNoteAndUser($note, $currentUser) !== null);

        return $this->respond($note, 200, ['direction_note:read', 'user:read', 'site:read']);
    }

    /**
     * Who has personally marked the note as seen (Direction / Admin only).
     */
    #[Route('/{id}/readers', name: 'api_direction_notes_readers', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function readers(int $id, #[CurrentUser] User $currentUser): JsonResponse
    {
        if (!$this->isDirectionOrAdmin($currentUser)) {
            return $this->respondError('Seul la direction peut consulter les lecteurs.', 403);
        }

        $note = $this->directionNoteRepository->find($id);
        if (!$note) {
            return $this->respondError('Note introuvable.', 404);
        }

        $readers = $this->directionNoteSeenRepository->findReadersForNote($note);
        $payload = array_map(static fn (array $row): array => [
            'user' => $row['user'],
            'seenAt' => $row['seenAt']->format(\DateTimeInterface::ATOM),
        ], $readers);

        return $this->respond($payload, 200, ['user:read']);
    }

    /**
     * Any reader of the channel can mark the note as personally seen.
     */
    #[Route('/{id}/seen', name: 'api_direction_notes_seen', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function markSeen(int $id, #[CurrentUser] User $currentUser): JsonResponse
    {
        $note = $this->directionNoteRepository->find($id);
        if (!$note) {
            return $this->respondError('Note introuvable.', 404);
        }
        if ($note->isClosed()) {
            return $this->respondError('Cette note est close.', 422);
        }
        if (!$this->canReadChannel($currentUser, $note->getChannel())) {
            return $this->respondError('Accès refusé à ce canal de notes.', 403);
        }

        $seen = $this->directionNoteSeenRepository->findOneByNoteAndUser($note, $currentUser);
        if (!$seen) {
            $seen = new DirectionNoteSeen();
            $seen->setNote($note);
            $seen->setUser($currentUser);
            $this->em->persist($seen);
        } else {
            $seen->touchSeenAt();
        }
        $this->em->flush();

        $note->setSeenByMe(true);

        return $this->respond($note, 200, ['direction_note:read', 'user:read', 'site:read']);
    }

    #[Route('/{id}', name: 'api_direction_notes_delete', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function delete(int $id, #[CurrentUser] User $currentUser): JsonResponse
    {
        if (!$this->isDirectionOrAdmin($currentUser)) {
            return $this->respondError('Seule la direction peut supprimer une note.', 403);
        }

        $note = $this->directionNoteRepository->find($id);
        if (!$note) {
            return $this->respondError('Note introuvable.', 404);
        }

        $this->em->remove($note);
        $this->em->flush();

        return new JsonResponse(null, 204);
    }

    private function isDirectionOrAdmin(User $user): bool
    {
        return $user->hasRole(UserRole::DIRECTION) || $user->hasRole(UserRole::ADMIN);
    }

    private function canReadChannel(User $user, DirectionNoteChannel $channel): bool
    {
        if ($this->isDirectionOrAdmin($user)) {
            return true;
        }

        return $user->hasRole(UserRole::HOTE)
            && $channel === DirectionNoteChannel::DIRECTION_ACCUEIL;
    }

    /**
     * @return list<DirectionNoteChannel>
     */
    private function readableChannels(User $user): array
    {
        if ($this->isDirectionOrAdmin($user)) {
            return [
                DirectionNoteChannel::DIRECTION_DIRECTION,
                DirectionNoteChannel::DIRECTION_ACCUEIL,
            ];
        }

        if ($user->hasRole(UserRole::HOTE)) {
            return [DirectionNoteChannel::DIRECTION_ACCUEIL];
        }

        return [];
    }

    /**
     * @param DirectionNote[] $notes
     */
    private function hydrateSeenByMe(array $notes, User $currentUser): void
    {
        $seenIds = $this->directionNoteSeenRepository->seenNoteIdsForUser($notes, $currentUser);
        foreach ($notes as $note) {
            $note->setSeenByMe(isset($seenIds[(int) $note->getId()]));
        }
    }

    /**
     * @param DirectionNote[] $notes
     */
    private function hydrateSeenCounts(array $notes): void
    {
        $counts = $this->directionNoteSeenRepository->seenCountsForNotes($notes);
        foreach ($notes as $note) {
            $note->setSeenCount($counts[(int) $note->getId()] ?? 0);
        }
    }
}
