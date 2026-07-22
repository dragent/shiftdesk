"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import type { UserRole } from "@/lib/types";

interface RoleGuardProps {
  roles?: UserRole[];
  children: React.ReactNode;
}

/**
 * Protège une page : redirige vers /login si non authentifié, ou vers
 * /dashboard si l'utilisateur n'a pas l'un des rôles autorisés.
 */
export function RoleGuard({ roles, children }: RoleGuardProps) {
  const { user, loading, hasRole } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (roles && roles.length > 0 && !hasRole(...roles)) {
      router.replace("/dashboard");
    }
  }, [loading, user, roles, hasRole, router]);

  if (loading || !user) {
    return (
      <div className="flex flex-1 items-center justify-center p-10 text-slate-500">
        Chargement...
      </div>
    );
  }

  if (roles && roles.length > 0 && !hasRole(...roles)) {
    return null;
  }

  return <>{children}</>;
}
