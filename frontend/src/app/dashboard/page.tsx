"use client";

import { RoleGuard } from "@/components/RoleGuard";
import { AppShell } from "@/components/AppShell";
import { DirectionNotesCard } from "@/components/DirectionNotesCard";
import { useAuth } from "@/lib/AuthContext";

export default function DashboardPage() {
  return (
    <RoleGuard>
      <AppShell>
        <DashboardContent />
      </AppShell>
    </RoleGuard>
  );
}

function DashboardContent() {
  const { user, hasRole } = useAuth();
  // ROLE_ADMIN has the same note privileges as ROLE_DIRECTION.
  const isDirectionOrAdmin = hasRole("ROLE_DIRECTION", "ROLE_ADMIN");
  const isHote = hasRole("ROLE_HOTE");
  const canSeeDirectionNotes = isDirectionOrAdmin;
  const canSeeAccueilNotes = isDirectionOrAdmin || isHote;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">
          Bonjour {user?.firstName}
        </h1>
        <p className="text-sm text-slate-500">
          Notes de la direction pour l&apos;équipe.
        </p>
      </div>

      {canSeeDirectionNotes || canSeeAccueilNotes ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {canSeeDirectionNotes && (
            <DirectionNotesCard
              title="Direction envers Direction"
              channel="DIRECTION_DIRECTION"
              canWrite={isDirectionOrAdmin}
              canManage={isDirectionOrAdmin}
              emptyLabel="Aucune note interne pour le moment."
            />
          )}
          {canSeeAccueilNotes && (
            <DirectionNotesCard
              title="Direction envers Accueil"
              channel="DIRECTION_ACCUEIL"
              canWrite={isDirectionOrAdmin}
              canManage={isDirectionOrAdmin}
              emptyLabel="Aucune note pour l'accueil pour le moment."
            />
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          Aucune note à afficher pour votre rôle.
        </p>
      )}
    </div>
  );
}
