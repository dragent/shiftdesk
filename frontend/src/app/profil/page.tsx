"use client";

import { useQueryClient } from "@tanstack/react-query";
import { RoleGuard } from "@/components/RoleGuard";
import { AppShell } from "@/components/AppShell";
import { UserProfile } from "@/components/UserProfile";
import { useAuth } from "@/lib/AuthContext";
import { canEditJobAndContract } from "@/lib/employees";
import { saveJobAndContract, saveOwnContact } from "@/lib/profile";
import { queryKeys } from "@/lib/queryKeys";

export default function ProfilPage() {
  return (
    <RoleGuard>
      <AppShell>
        <OwnProfileContent />
      </AppShell>
    </RoleGuard>
  );
}

function OwnProfileContent() {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  if (!user) return null;

  return (
    <UserProfile
      profile={user}
      isOwn
      onSaveContact={async (payload) => {
        await refreshUser(await saveOwnContact(payload));
      }}
      onSaveJob={
        canEditJobAndContract(user)
          ? async (payload) => {
              const updated = await saveJobAndContract(user.id, payload);
              queryClient.setQueryData(queryKeys.user(user.id), updated);
              queryClient.invalidateQueries({ queryKey: queryKeys.employeesPage });
              await refreshUser(updated);
            }
          : undefined
      }
    />
  );
}
