export type UserRole =
  | "ROLE_ADMIN"
  | "ROLE_DIRECTION"
  | "ROLE_HOTE"
  | "ROLE_CAISSIER"
  | "ROLE_RAYON"
  | "ROLE_SECURITE"
  | "ROLE_USER";

export interface Site {
  id: number;
  name: string;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  active: boolean;
}

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  roles?: UserRole[];
  site?: Site | null;
  active: boolean;
  /** Contrat horaire hebdomadaire de l'employé, en minutes (ex: 36h45 = 2205). */
  contractMinutes?: number;
}

export interface RequestCategory {
  id: number;
  code: string;
  label: string;
  description?: string | null;
  active: boolean;
  position: number;
}

export type DemandeStatus = "NOUVELLE" | "EN_COURS" | "TRAITEE" | "ANNULEE";

export interface AccueilRequest {
  id: number;
  hote: User;
  category: RequestCategory;
  site?: Site | null;
  visitorName?: string | null;
  subject: string;
  description?: string | null;
  status: DemandeStatus;
  createdAt: string;
  resolvedAt?: string | null;
}

export type PlanningStatus = "PLANIFIE" | "CONFIRME" | "ANNULE";

export interface Planning {
  id: number;
  user: User;
  site?: Site | null;
  workDate: string;
  startTime: string;
  endTime: string;
  status: PlanningStatus;
  note?: string | null;
  createdBy?: User | null;
  /**
   * Numéro de caisse attribué à ce créneau (plan de caisse) : caisse
   * numérotée (1-8), caisses automatiques (0) ou pauses/retour (-1).
   * Mutuellement exclusif avec `registerSegments` (null si le créneau est
   * découpé en bascule).
   */
  registerNumber?: number | null;
  /**
   * Découpage du créneau en plusieurs affectations de caisse (bascule en
   * cours de poste, ex. caisse 3 puis caisses automatiques à 10:00).
   * Mutuellement exclusif avec `registerNumber`.
   */
  registerSegments?: { startTime: string; registerNumber: number }[] | null;
}

export type PauseType = "COURTE" | "DEJEUNER" | "AUTRE";
export type PauseStatus = "EN_COURS" | "TERMINEE";

export interface Pause {
  id: number;
  user: User;
  declaredBy?: User | null;
  type: PauseType;
  status: PauseStatus;
  startedAt: string;
  endedAt?: string | null;
}

export type InsightType =
  | "SOUS_EFFECTIF"
  | "SURCHARGE"
  | "CONFLIT_PAUSE"
  | "ANOMALIE_PLANNING"
  | "AUTRE";
export type InsightSeverity = "INFO" | "ATTENTION" | "CRITIQUE";
export type InsightStatus = "NOUVELLE" | "VUE" | "TRAITEE" | "IGNOREE";

export interface PlanningInsight {
  id: number;
  type: InsightType;
  severity: InsightSeverity;
  site?: Site | null;
  targetDate: string;
  message: string;
  payload?: Record<string, unknown> | null;
  status: InsightStatus;
  createdAt: string;
}
