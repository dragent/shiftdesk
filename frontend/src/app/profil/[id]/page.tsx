"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { RoleGuard } from "@/components/RoleGuard";
import { AppShell } from "@/components/AppShell";
import { UserProfile } from "@/components/UserProfile";
import { Alert, Card } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { canEditJobAndContract, canViewUserProfile } from "@/lib/employees";
import { queryKeys } from "@/lib/queryKeys";
import { saveJobAndContract, saveOwnContact, type JobUpdate } from "@/lib/profile";
import { usePageQuery } from "@/lib/usePageQuery";
import type { User } from "@/lib/types";

export default function UserProfilPage() {
  return (
    <RoleGuard>
      <AppShell>
        <UserProfileContent />
      </AppShell>
    </RoleGuard>
  );
}

function UserProfileContent() {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const targetId = Number(params.id);
  const validId = Number.isInteger(targetId) && targetId > 0;
  const isOwn = Boolean(user && validId && user.id === targetId);
  const allowed = Boolean(user && validId && canViewUserProfile(user, targetId));
  const canEditJob = Boolean(user && canEditJobAndContract(user));

  async function handleSaveJob(userId: number, payload: JobUpdate) {
    const updated = await saveJobAndContract(userId, payload);
    queryClient.setQueryData(queryKeys.user(updated.id), updated);
    queryClient.invalidateQueries({ queryKey: queryKeys.employeesPage });
    if (user?.id === updated.id) {
      await refreshUser(updated);
    }
  }

  useEffect(() => {
    if (!user) return;
    if (!allowed) {
      router.replace(validId ? "/dashboard" : "/profil");
    }
  }, [user, allowed, validId, router]);

  const { data, loading, error } = usePageQuery({
    queryKey: queryKeys.user(targetId),
    queryFn: () => api.get<User>(`/api/users/${targetId}`),
    enabled: allowed && !isOwn,
    fallbackError: "Impossible de charger ce profil.",
  });

  if (!user || !allowed) {
    return null;
  }

  if (isOwn) {
    return (
      <UserProfile
        profile={user}
        isOwn
        backToEmployees
        onSaveContact={async (payload) => {
          await refreshUser(await saveOwnContact(payload));
        }}
        onSaveJob={canEditJob ? (payload) => handleSaveJob(user.id, payload) : undefined}
        viewer={user}
      />
    );
  }

  if (loading) {
    return (
      <Card>
        <p className="text-sm text-slate-400">Chargement...</p>
      </Card>
    );
  }

  if (error || !data) {
    return <Alert>{error ?? "Utilisateur introuvable."}</Alert>;
  }

  return (
    <UserProfile
      profile={data}
      isOwn={false}
      onSaveJob={canEditJob ? (payload) => handleSaveJob(data.id, payload) : undefined}
      viewer={user}
    />
  );
}
