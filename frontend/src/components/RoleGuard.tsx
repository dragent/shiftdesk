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
 * Protects a page: redirects to /login when not authenticated, or to /dashboard when the user
 * does not have one of the allowed roles.
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
    return <LoadingScreen />;
  }

  if (roles && roles.length > 0 && !hasRole(...roles)) {
    return null;
  }

  return <>{children}</>;
}
