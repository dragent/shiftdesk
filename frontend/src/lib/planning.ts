/**
 * Créneaux fixes de demi-journée utilisés par le planning : le magasin est
 * couvert en semaine de 07h00 à 20h15, coupé en deux demi-journées
 * (matin / après-midi). Le dimanche après-midi est fermé ; le dimanche
 * matin se termine à 13h15.
 *
 * Les heures de début exactes dépendent du rôle (accueil, caissiers, etc.)
 * — voir `earliestStartForUser` / `latestEndForDay`.
 */
export type HalfDayKey = "MATIN" | "APRES_MIDI";

export interface HalfDaySlot {
  key: HalfDayKey;
  label: string;
  start: string;
  end: string;
}

export const HALF_DAY_SLOTS: HalfDaySlot[] = [
  { key: "MATIN", label: "Matin", start: "07:30", end: "14:00" },
  { key: "APRES_MIDI", label: "Après-midi", start: "14:00", end: "20:15" },
];

/**
 * Amplitude d'ouverture du magasin (première heure de début possible à
 * dernière heure de fin possible). La demi-journée (matin/après-midi) ne
 * détermine que l'heure de DÉBUT d'un créneau (cf. `slotKeyForTime`) : une
 * personne qui commence le matin peut très bien terminer en après-midi
 * (ex. 07h30-16h00), donc l'heure de fin n'est bornée que par la fermeture
 * du magasin, pas par la fin de la demi-journée de démarrage.
 */
export const STORE_OPEN = HALF_DAY_SLOTS[0].start;
export const STORE_CLOSE = HALF_DAY_SLOTS[HALF_DAY_SLOTS.length - 1].end;

/** Fermeture du dimanche (matin uniquement). */
export const SUNDAY_CLOSE = "13:15";

/** Début Accueil (ROLE_HOTE) : 7h00 en semaine, 7h30 le dimanche. */
export const ACCUEIL_WEEKDAY_START = "07:00";
export const ACCUEIL_SUNDAY_START = "07:30";

/** Début Caissiers : 7h30 en semaine, 8h00 le dimanche. */
export const CAISSIER_WEEKDAY_START = "07:30";
export const CAISSIER_SUNDAY_START = "08:00";

/** Première heure proposée pour une relève SCO (select). */
export const SCO_RELIEF_START = "07:45";

/** Pas (minutes) entre deux heures de relève proposées. */
export const SCO_RELIEF_STEP_MINUTES = 15;

/**
 * Heures de relève disponibles pour le select SCO, de `SCO_RELIEF_START`
 * jusqu'à juste avant la fermeture magasin (pas de 15 min).
 */
export function scoReliefTimeOptions(
  from: string = SCO_RELIEF_START,
  untilExclusive: string = STORE_CLOSE,
  stepMinutes: number = SCO_RELIEF_STEP_MINUTES,
): string[] {
  const toMinutes = (time: string) => {
    const [h, m] = time.split(":").map((v) => parseInt(v, 10));
    return h * 60 + m;
  };
  const fromMin = toMinutes(from);
  const untilMin = toMinutes(untilExclusive);
  const times: string[] = [];
  for (let t = fromMin; t < untilMin; t += stepMinutes) {
    const hh = String(Math.floor(t / 60)).padStart(2, "0");
    const mm = String(t % 60).padStart(2, "0");
    times.push(`${hh}:${mm}`);
  }
  return times;
}

/**
 * Direction et Rayon peuvent démarrer dès 04h00 le matin (préparation
 * magasin). Accueil dès 07h00 en semaine / 07h30 le dimanche. Caissiers
 * dès 07h30 en semaine / 08h00 le dimanche. Autres rôles : ouverture
 * magasin 07h30.
 */
export const EARLY_SHIFT_START = "04:00";
export const EARLY_SHIFT_ROLES = ["ROLE_DIRECTION", "ROLE_RAYON"] as const;

export const DAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

/** Index du dimanche dans la semaine (lundi = 0). */
export const SUNDAY_INDEX = 6;

/** Heure de fin maximale autorisée un jour donné (13h15 le dimanche). */
export function latestEndForDay(dayIndex: number): string {
  return dayIndex === SUNDAY_INDEX ? SUNDAY_CLOSE : STORE_CLOSE;
}

/**
 * Heure de fin proposée par défaut pour une demi-journée : fin du créneau
 * le matin en semaine (14h00), fermeture dimanche (13h15) le dimanche matin,
 * fermeture magasin (20h15) l'après-midi.
 */
export function defaultEndForSlot(slotKey: HalfDayKey, dayIndex: number): string {
  if (dayIndex === SUNDAY_INDEX) return SUNDAY_CLOSE;
  const slot = HALF_DAY_SLOTS.find((s) => s.key === slotKey);
  return slot?.end ?? STORE_CLOSE;
}

/** Heure de début minimale autorisée pour un utilisateur sur une demi-journée. */
export function earliestStartForUser(
  user: { roles?: string[] | null },
  slotKey: HalfDayKey,
  dayIndex: number = 0,
): string {
  const slot = HALF_DAY_SLOTS.find((s) => s.key === slotKey);
  const defaultStart = slot?.start ?? STORE_OPEN;
  if (slotKey !== "MATIN") return defaultStart;
  const roles = user.roles ?? [];
  if (EARLY_SHIFT_ROLES.some((role) => roles.includes(role))) {
    return EARLY_SHIFT_START;
  }
  const isSunday = dayIndex === SUNDAY_INDEX;
  if (roles.includes("ROLE_HOTE")) {
    return isSunday ? ACCUEIL_SUNDAY_START : ACCUEIL_WEEKDAY_START;
  }
  if (roles.includes("ROLE_CAISSIER")) {
    return isSunday ? CAISSIER_SUNDAY_START : CAISSIER_WEEKDAY_START;
  }
  return defaultStart;
}

/**
 * Détermine à quelle demi-journée appartient un créneau à partir de son
 * heure de début (avant 14h = matin, sinon après-midi).
 */
export function slotKeyForTime(startTime: string): HalfDayKey {
  const hour = parseInt(startTime.split(":")[0] ?? "0", 10);
  return hour < 14 ? "MATIN" : "APRES_MIDI";
}

/** Le dimanche après-midi est fermé : personne ne travaille. */
export function isClosedSlot(dayIndex: number, slotKey: HalfDayKey): boolean {
  return dayIndex === SUNDAY_INDEX && slotKey === "APRES_MIDI";
}

/** Indique si une fermeture magasin couvre la demi-journée donnée. */
export function coversStoreClosureSlot(
  closure: { startDate: string; startHalfDay: HalfDayKey; endDate: string },
  dayKey: string,
  slotKey: HalfDayKey,
): boolean {
  if (dayKey < closure.startDate || dayKey > closure.endDate) return false;
  if (dayKey > closure.startDate) return true;
  // Jour de début : à partir de la demi-journée choisie.
  if (closure.startHalfDay === "MATIN") return true;
  return slotKey === "APRES_MIDI";
}

/** Dimanche après-midi fixe, ou fermeture magasin saisie. */
export function isPlanningSlotClosed(
  dayIndex: number,
  dayKey: string,
  slotKey: HalfDayKey,
  closures: { startDate: string; startHalfDay: HalfDayKey; endDate: string }[],
): boolean {
  if (isClosedSlot(dayIndex, slotKey)) return true;
  return closures.some((c) => coversStoreClosureSlot(c, dayKey, slotKey));
}

export function slotLabel(startTime: string): string {
  const slot = HALF_DAY_SLOTS.find((s) => s.key === slotKeyForTime(startTime));
  return slot ? slot.label : "";
}

/**
 * Ajoute (ou retire) un nombre d'heures à une heure au format "HH:mm",
 * en restant dans une même journée (00:00-23:59).
 */
export function addHours(time: string, hours: number): string {
  const [h, m] = time.split(":").map((v) => parseInt(v, 10));
  const totalMinutes = ((h * 60 + m + hours * 60) % (24 * 60) + 24 * 60) % (24 * 60);
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Durée en minutes entre deux heures "HH:mm" du même jour. */
export function durationMinutes(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map((v) => parseInt(v, 10));
  const [eh, em] = endTime.split(":").map((v) => parseInt(v, 10));
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

/**
 * Temps de pause accordé : 3 minutes par heure complète travaillée
 * (toujours un multiple de 3).
 */
export function pauseMinutesForWork(workMinutes: number): number {
  return Math.max(0, Math.floor(workMinutes / 60) * 3);
}

/** Formate un nombre de minutes en durée lisible "36h45" (ou "30h" si rond). */
export function formatMinutesAsHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

/**
 * Formate une heure "HH:mm" (00h-24h) au format français, avec un "h"
 * comme séparateur plutôt que ":" (ex. "07:30" → "07h30"), sans notation
 * AM/PM.
 */
export function formatFrenchTime(time: string | null | undefined): string {
  if (!time) return "";
  const [h, m] = time.split(":");
  if (h == null || m == null) return time;
  return `${h}h${m}`;
}

/**
 * Formate l'heure locale d'une date (ou horodatage ISO) au format français
 * "HHhmm" (ex. utilisé pour l'heure de début/fin d'une pause).
 */
export function formatFrenchTimeOfDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}h${m}`;
}

/**
 * Plan de caisse : le magasin dispose de 8 caisses numérotées, plus un poste
 * de supervision des caisses automatiques (libre-service) qui nécessite au
 * moins un(e) caissier(ère) affecté(e) à chaque créneau ouvert.
 */
export const REGISTER_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8];

/**
 * Valeur spéciale de `registerNumber` représentant la supervision des
 * caisses automatiques, plutôt qu'une caisse physique numérotée.
 */
export const SELF_CHECKOUT_REGISTER = 0;

/**
 * Valeur spéciale de `registerNumber` représentant une affectation "Pauses /
 * Retour" : le/la caissier(ère) ne tient aucune caisse sur ce créneau (il/elle
 * fait passer les pauses des collègues ou gère les retours). Neutre pour la
 * couverture des caisses automatiques et jamais concerné(e) par les conflits
 * de doublon de caisse numérotée. Non disponible pour les segments de
 * bascule (voir `SplitSegment`).
 */
export const PAUSES_RETOUR_REGISTER = -1;

/**
 * Numéros de caisse utilisables pour un segment de bascule en cours de
 * créneau (caisse numérotée ou caisses automatiques uniquement — pas
 * "Pauses / Retour").
 */
export const SPLIT_REGISTER_NUMBERS = [SELF_CHECKOUT_REGISTER, ...REGISTER_NUMBERS];

/** Nombre maximal de segments dans un créneau en bascule (2 bascules max). */
export const MAX_SPLIT_SEGMENTS = 3;

/**
 * Un segment de bascule : à partir de `startTime` (heure de bascule, au
 * format "HH:mm"), le/la caissier(ère) est affecté(e) à `registerNumber`
 * jusqu'au segment suivant (ou jusqu'à la fin du créneau pour le dernier
 * segment). Le premier segment démarre toujours à l'heure de début du
 * créneau planifié.
 */
export interface RegisterSegment {
  startTime: string;
  registerNumber: number;
}

/** Libellé lisible d'un numéro de caisse ("Caisse 3", "Caisses automatiques" ou "Pauses / Retour"). */
export function registerLabel(registerNumber: number | null | undefined): string {
  if (registerNumber == null) return "";
  if (registerNumber === SELF_CHECKOUT_REGISTER) return "Caisses automatiques";
  if (registerNumber === PAUSES_RETOUR_REGISTER) return "Pauses / Retour";
  return `Caisse ${registerNumber}`;
}

/** Libellé court d'un numéro de caisse, pour un affichage compact ("C3", "Auto", "P/R"). */
export function registerShortLabel(registerNumber: number | null | undefined): string {
  if (registerNumber == null) return "";
  if (registerNumber === SELF_CHECKOUT_REGISTER) return "Auto";
  if (registerNumber === PAUSES_RETOUR_REGISTER) return "P/R";
  return `C${registerNumber}`;
}

/** Libellé caisse pour l'impression du plan de caisse (SCO, pas Auto). */
export function printRegisterShort(registerNumber: number | null | undefined): string {
  if (registerNumber == null) return "";
  if (registerNumber === SELF_CHECKOUT_REGISTER) return "SCO";
  if (registerNumber === PAUSES_RETOUR_REGISTER) return "P/R";
  return String(registerNumber);
}

/** Caisses affectées sur un créneau, pour l'impression (ex. "3 → SCO"). */
export function printRegisters(entry: {
  registerNumber?: number | null;
  registerSegments?: RegisterSegment[] | null;
}): string {
  if (entry.registerSegments && entry.registerSegments.length > 0) {
    return entry.registerSegments.map((s) => printRegisterShort(s.registerNumber)).join(" → ");
  }
  if (entry.registerNumber != null) return printRegisterShort(entry.registerNumber);
  return "—";
}

/** Heures de bascule pour l'impression, ou tiret s'il n'y en a pas. */
export function printBasculeTimes(entry: {
  registerSegments?: RegisterSegment[] | null;
}): string {
  const segments = entry.registerSegments;
  if (!segments || segments.length < 2) return "—";
  return segments
    .slice(1)
    .map((s) => formatFrenchTime(s.startTime))
    .join(", ");
}

/** Créneau avec affectation de caisse (forme minimale pour les helpers SCO). */
export interface PlanningAssignment {
  id?: number;
  startTime: string;
  endTime: string;
  registerNumber?: number | null;
  registerSegments?: RegisterSegment[] | null;
}

export interface RegisterInterval {
  start: string;
  end: string;
  registerNumber: number;
}

/**
 * Décompose une affectation (simple ou bascule) en intervalles horaires.
 * Ignore "Pauses / Retour" (valeur négative).
 */
export function planningIntervals(p: PlanningAssignment): RegisterInterval[] {
  if (p.registerSegments && p.registerSegments.length > 0) {
    return p.registerSegments.map((seg, i) => ({
      start: seg.startTime,
      end: p.registerSegments![i + 1]?.startTime ?? p.endTime,
      registerNumber: seg.registerNumber,
    }));
  }
  if (p.registerNumber != null && p.registerNumber >= 0) {
    return [{ start: p.startTime, end: p.endTime, registerNumber: p.registerNumber }];
  }
  return [];
}

/** Normalise "HH:mm" / "HH:mm:ss" en "HH:mm" pour les comparaisons. */
export function normalizeTimeHHmm(time: string): string {
  const parts = time.split(":");
  if (parts.length < 2) return time;
  const h = parts[0].padStart(2, "0");
  const m = parts[1].padStart(2, "0");
  return `${h}:${m}`;
}

/** True si les intervalles [aStart, aEnd) et [bStart, bEnd) se chevauchent. */
export function intervalsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const a0 = normalizeTimeHHmm(aStart);
  const a1 = normalizeTimeHHmm(aEnd);
  const b0 = normalizeTimeHHmm(bStart);
  const b1 = normalizeTimeHHmm(bEnd);
  return a0 < b1 && b0 < a1;
}

/** True si `time` est dans [start, end). */
export function timeInRange(time: string, start: string, end: string): boolean {
  const t = normalizeTimeHHmm(time);
  return normalizeTimeHHmm(start) <= t && t < normalizeTimeHHmm(end);
}

/**
 * Numéro de caisse actif à `time` (début inclus, fin exclue).
 * Null si aucune affectation 0–8 ne couvre cet instant.
 */
export function registerAtTime(p: PlanningAssignment, time: string): number | null {
  const t = normalizeTimeHHmm(time);
  for (const iv of planningIntervals(p)) {
    if (timeInRange(t, iv.start, iv.end)) return iv.registerNumber;
  }
  return null;
}

/** Caisse numérotée 1–8 à `time`, sinon null. */
export function numberedRegisterAtTime(p: PlanningAssignment, time: string): number | null {
  const reg = registerAtTime(p, time);
  return reg != null && REGISTER_NUMBERS.includes(reg) ? reg : null;
}

/** True si la personne est aux caisses automatiques à `time`. */
export function isOnScoAtTime(p: PlanningAssignment, time: string): boolean {
  return registerAtTime(p, time) === SELF_CHECKOUT_REGISTER;
}

/** Payload API : affectation simple ou segments de bascule. */
export type RegisterAssignmentPayload =
  | { registerNumber: number; segments?: undefined }
  | { segments: RegisterSegment[]; registerNumber?: undefined };

/**
 * Reconstruit l'affectation d'un créneau après une relève à `reliefTime` :
 * conserve ce qui précède, puis applique `registerFromRelief` jusqu'à la fin.
 */
export function buildReliefAssignment(
  entry: PlanningAssignment,
  reliefTime: string,
  registerFromRelief: number,
): RegisterAssignmentPayload {
  if (reliefTime <= entry.startTime) {
    return { registerNumber: registerFromRelief };
  }
  if (reliefTime >= entry.endTime) {
    throw new Error("L'heure de relève doit être avant la fin du créneau.");
  }

  const before = planningIntervals(entry)
    .filter((iv) => iv.start < reliefTime)
    .map((iv) => ({
      start: iv.start,
      end: iv.end < reliefTime ? iv.end : reliefTime,
      registerNumber: iv.registerNumber,
    }))
    .filter((iv) => iv.start < iv.end);

  // Pas d'affectation avant l'heure : toute la demi-journée passe au nouveau poste.
  if (before.length === 0) {
    return { registerNumber: registerFromRelief };
  }

  const merged: RegisterInterval[] = [];
  for (const iv of [...before, { start: reliefTime, end: entry.endTime, registerNumber: registerFromRelief }]) {
    const last = merged[merged.length - 1];
    if (last && last.registerNumber === iv.registerNumber && last.end === iv.start) {
      last.end = iv.end;
    } else {
      merged.push({ ...iv });
    }
  }

  if (
    merged.length === 1
    && merged[0].start === entry.startTime
    && merged[0].end === entry.endTime
  ) {
    return { registerNumber: merged[0].registerNumber };
  }

  return {
    segments: merged.map((iv) => ({
      startTime: iv.start,
      registerNumber: iv.registerNumber,
    })),
  };
}

/**
 * Caisses 1–8 libres sur [from, to) pour le jour donné, en ignorant les
 * plannings listés dans `excludeIds`.
 */
export function freeNumberedRegisters(
  dayPlannings: Array<PlanningAssignment & { id: number; workDate: string }>,
  workDate: string,
  from: string,
  to: string,
  excludeIds: number[] = [],
): number[] {
  const exclude = new Set(excludeIds);
  const occupied = new Set<number>();
  for (const p of dayPlannings) {
    if (p.workDate !== workDate || exclude.has(p.id)) continue;
    for (const iv of planningIntervals(p)) {
      if (!REGISTER_NUMBERS.includes(iv.registerNumber)) continue;
      if (intervalsOverlap(from, to, iv.start, iv.end)) {
        occupied.add(iv.registerNumber);
      }
    }
  }
  return REGISTER_NUMBERS.filter((n) => !occupied.has(n));
}
