<?php

namespace App\Controller\Api;

use App\Entity\DirectionNote;
use App\Entity\DirectionNoteSeen;
use App\Entity\User;
use App\Enum\DirectionNoteChannel;
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
 * Direction can close a note for everyone (`PATCH /{id}/close`). Any
 * reader can mark it seen personally (`POST /{id}/seen`).
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

        $siteId = $currentUser->getSite()?->getId();
        $notes = $this->directionNoteRepository->findRecentByChannel($channel, $siteId, 20);
        $this->hydrateSeenByMe($notes, $currentUser);

        return $this->respond($notes, 200, ['direction_note:read', 'user:read', 'site:read']);
    }

    /**
     * Unread open notes across every channel the current user can read.
     * Used by the nav badge on "Tableau de bord".
     */
    #[Route('/unread-count', name: 'api_direction_notes_unread_count', methods: ['GET'])]
    public function unreadCount(#[CurrentUser] User $currentUser): JsonResponse
    {
        $channels = $this->readableChannels($currentUser);
        $siteId = $currentUser->getSite()?->getId();
        $count = $this->directionNoteRepository->countUnreadForUser($currentUser, $channels, $siteId);

        return new JsonResponse(['count' => $count]);
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

        $note = new DirectionNote();
        $note->setChannel($channel);
        $note->setBody($body);
        $note->setAuthor($currentUser);
        $note->setSite($currentUser->getSite());

        $this->em->persist($note);
        $this->em->flush();

        $note->setSeenByMe(false);

        return $this->respond($note, 201, ['direction_note:read', 'user:read', 'site:read']);
    }

    /**
     * Direction closes the note for everyone (both channels / categories).
     * Closed notes disappear from the open list for all readers.
     */
    #[Route('/{id}/close', name: 'api_direction_notes_close', methods: ['PATCH'])]
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
     * Any reader of the channel can mark the note as personally seen.
     */
    #[Route('/{id}/seen', name: 'api_direction_notes_seen', methods: ['POST'])]
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

    #[Route('/{id}', name: 'api_direction_notes_delete', methods: ['DELETE'])]
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
}
