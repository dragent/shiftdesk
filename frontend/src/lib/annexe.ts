import type { UserRole } from "@/lib/types";

/** Jobs Direction can grant access to an annex website. */
export const ANNEXE_ACCESS_JOBS: { role: UserRole; label: string }[] = [
  { role: "ROLE_DIRECTEUR", label: "Directeur/rice" },
  { role: "ROLE_DIRECTION", label: "Direction" },
  { role: "ROLE_HOTE", label: "Hôte(sse) d'accueil" },
  { role: "ROLE_CAISSIER", label: "Caissier(ère)" },
  { role: "ROLE_LAD", label: "LAD" },
  { role: "ROLE_RAYON", label: "Rayon" },
  { role: "ROLE_SECURITE", label: "Sécurité" },
];

export function annexeJobLabel(role: string): string {
  return ANNEXE_ACCESS_JOBS.find((job) => job.role === role)?.label ?? role;
}
