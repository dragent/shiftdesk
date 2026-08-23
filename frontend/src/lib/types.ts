export type UserRole =
  | "ROLE_ADMIN"
  | "ROLE_DIRECTION"
  | "ROLE_HOTE"
  | "ROLE_CAISSIER"
  | "ROLE_LAD"
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
  /** Weekly contract hours for the employee, in minutes (e.g. 36h45 = 2205). */
  contractMinutes?: number;
  /** Cashier number (register login), distinct from the physical register number. */
  cashierNumber?: string | null;
  /** Contact phone number displayed on the employee record. */
  phone?: string | null;
  /** Effective date of the dismissal (`YYYY-MM-DD`), null when the employee is still employed. */
  dismissedAt?: string | null;
  /** When true, the user must set a personal password before using the app. */
  mustChangePassword?: boolean;
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

export type AbsenceReason = "ARRET_TRAVAIL" | "CONGE";

export interface Absence {
  id: number;
  user: User;
  reason: AbsenceReason;
  startDate: string;
  endDate: string;
  /** Present for sick leave; null/absent for leave. */
  startTime?: string | null;
  endTime?: string | null;
  createdBy?: User | null;
}

/** Store closure: blocks half-days from startHalfDay onwards. */
export interface StoreClosure {
  id: number;
  startDate: string;
  startHalfDay: "MATIN" | "APRES_MIDI";
  endDate: string;
  createdBy?: User | null;
}

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
   * LAD or reception host assigned to a register for this slot (otherwise their usual station).
   * Ignored for cashiers.
   */
  enCaisse?: boolean;
  /**
   * Register number assigned to this slot (register layout): numbered register (1-8),
   * self-checkout (0) or breaks/returns (-1). Mutually exclusive with `registerSegments` (null
   * when the slot is split into switch segments).
   */
  registerNumber?: number | null;
  /**
   * Split of the slot into several register assignments (mid-shift switch, e.g. register 3 then
   * self-checkout at 10:00). Mutually exclusive with `registerNumber`.
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
