"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { LoadingScreen } from "@/components/LoadingScreen";
import type { UserRole } from "@/lib/types";

interface RoleGuardProps {
  roles?: UserRole[];
  children: React.ReactNode;
}

/**
 * Protects a page: redirects to /login when not authenticated, to the password
 * change screen when a temporary password is still in force, or to /dashboard
 * when the user does not have one of the allowed roles.
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
    if (user.mustChangePassword) {
      router.replace("/changer-mot-de-passe");
      return;
    }
    if (roles && roles.length > 0 && !hasRole(...roles)) {
      router.replace("/dashboard");
    }
  }, [loading, user, roles, hasRole, router]);

  if (loading || !user) {
    return <LoadingScreen />;
  }

  if (user.mustChangePassword) {
    return <LoadingScreen />;
  }

  if (roles && roles.length > 0 && !hasRole(...roles)) {
    return null;
  }

  return <>{children}</>;
}
