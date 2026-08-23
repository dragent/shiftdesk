/**
 * Fixed half-day slots used by the schedule: on weekdays the store is covered from 07:00 to
 * 20:15, split into two half-days (morning / afternoon). Sunday afternoon is closed; Sunday
 * morning ends at 13:15.
 *
 * Exact start times depend on the role (reception, cashiers, etc.) — see
 * `earliestStartForUser` / `latestEndForDay`.
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
 * Store opening range (earliest possible start time to latest possible end time). The half-day
 * (morning/afternoon) only determines the START time of a slot (see `slotKeyForTime`): someone
 * starting in the morning may well finish in the afternoon (e.g. 07:30-16:00), so the end time
 * is bounded only by the store closing time, not by the end of the starting half-day.
 */
export const STORE_OPEN = HALF_DAY_SLOTS[0].start;
export const STORE_CLOSE = HALF_DAY_SLOTS[HALF_DAY_SLOTS.length - 1].end;

/** Sunday closing time (morning only). */
export const SUNDAY_CLOSE = "13:15";

/** Reception start (ROLE_HOTE): 07:00 on weekdays, 07:30 on Sunday. */
export const ACCUEIL_WEEKDAY_START = "07:00";
export const ACCUEIL_SUNDAY_START = "07:30";

/** Cashier start: 07:30 on weekdays, 08:00 on Sunday. */
export const CAISSIER_WEEKDAY_START = "07:30";
export const CAISSIER_SUNDAY_START = "08:00";

/** Earliest time offered for an SCO relief (select). */
export const SCO_RELIEF_START = "07:45";

/** Step (minutes) between two offered relief times. */
export const SCO_RELIEF_STEP_MINUTES = 15;

/**
 * Relief times available in the SCO select, from `SCO_RELIEF_START` up to just before the store
 * closing time (15-minute steps).
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
 * Management and shop floor may start as early as 04:00 (store preparation). Reception from
 * 07:00 on weekdays / 07:30 on Sunday. Cashiers from 07:30 on weekdays / 08:00 on Sunday.
 * Other roles: store opening at 07:30.
 */
export const EARLY_SHIFT_START = "04:00";
export const EARLY_SHIFT_ROLES = ["ROLE_DIRECTION", "ROLE_RAYON"] as const;

export const DAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

/** Index of Sunday within the week (Monday = 0). */
export const SUNDAY_INDEX = 6;

/** Latest end time allowed on a given day (13:15 on Sunday). */
export function latestEndForDay(dayIndex: number): string {
  return dayIndex === SUNDAY_INDEX ? SUNDAY_CLOSE : STORE_CLOSE;
}

/**
 * Default end time proposed for a half-day: end of the slot on weekday mornings (14:00), Sunday
 * closing time (13:15) on Sunday morning, store closing time (20:15) in the afternoon.
 */
export function defaultEndForSlot(slotKey: HalfDayKey, dayIndex: number): string {
  if (dayIndex === SUNDAY_INDEX) return SUNDAY_CLOSE;
  const slot = HALF_DAY_SLOTS.find((s) => s.key === slotKey);
  return slot?.end ?? STORE_CLOSE;
}

/** Earliest start time allowed for a user on a half-day. */
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
 * Determines which half-day a slot belongs to from its start time (before 14:00 = morning,
 * otherwise afternoon).
 */
export function slotKeyForTime(startTime: string): HalfDayKey {
  const hour = parseInt(startTime.split(":")[0] ?? "0", 10);
  return hour < 14 ? "MATIN" : "APRES_MIDI";
}

/** Sunday afternoon is closed: nobody works. */
export function isClosedSlot(dayIndex: number, slotKey: HalfDayKey): boolean {
  return dayIndex === SUNDAY_INDEX && slotKey === "APRES_MIDI";
}

/** Indicates whether a store closure covers the given half-day. */
export function coversStoreClosureSlot(
  closure: { startDate: string; startHalfDay: HalfDayKey; endDate: string },
  dayKey: string,
  slotKey: HalfDayKey,
): boolean {
  if (dayKey < closure.startDate || dayKey > closure.endDate) return false;
  if (dayKey > closure.startDate) return true;
  // Start day: from the selected half-day onwards.
  if (closure.startHalfDay === "MATIN") return true;
  return slotKey === "APRES_MIDI";
}

/** Fixed Sunday afternoon, or a recorded store closure. */
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
 * Adds (or subtracts) a number of hours to a time in "HH:mm" format, staying within the same day
 * (00:00-23:59).
 */
export function addHours(time: string, hours: number): string {
  const [h, m] = time.split(":").map((v) => parseInt(v, 10));
  const totalMinutes = ((h * 60 + m + hours * 60) % (24 * 60) + 24 * 60) % (24 * 60);
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Duration in minutes between two "HH:mm" times on the same day. */
export function durationMinutes(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map((v) => parseInt(v, 10));
  const [eh, em] = endTime.split(":").map((v) => parseInt(v, 10));
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

/**
 * Break time granted: 3 minutes per full hour worked (always a multiple of 3).
 */
export function pauseMinutesForWork(workMinutes: number): number {
  return Math.max(0, Math.floor(workMinutes / 60) * 3);
}

/** Formats a number of minutes as a readable duration "36h45" (or "30h" when whole). */
export function formatMinutesAsHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

/**
 * Formats a "HH:mm" time (00h-24h) in the French format, using "h" as the separator instead of
 * ":" (e.g. "07:30" → "07h30"), without AM/PM notation.
 */
export function formatFrenchTime(time: string | null | undefined): string {
  if (!time) return "";
  const [h, m] = time.split(":");
  if (h == null || m == null) return time;
  return `${h}h${m}`;
}

/**
 * Formats the local time of a date (or ISO timestamp) in the French "HHhmm" format (used for
 * example for the start/end time of a break).
 */
export function formatFrenchTimeOfDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}h${m}`;
}

/**
 * Register layout: the store has 8 numbered registers, plus a self-checkout supervision station
 * that requires at least one cashier assigned on every open slot.
 */
export const REGISTER_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8];

/**
 * Special `registerNumber` value representing self-checkout supervision rather than a numbered
 * physical register.
 */
export const SELF_CHECKOUT_REGISTER = 0;

/**
 * Special `registerNumber` value representing a "Pauses / Retour" assignment: the cashier staffs
 * no register on that slot (they cover colleagues' breaks or handle returns). Neutral for
 * self-checkout coverage and never subject to duplicate numbered register conflicts. Not
 * available for switch segments (see `SplitSegment`).
 */
export const PAUSES_RETOUR_REGISTER = -1;

/**
 * Register numbers usable for a mid-slot switch segment (numbered register or self-checkout
 * only — not "Pauses / Retour").
 */
export const SPLIT_REGISTER_NUMBERS = [SELF_CHECKOUT_REGISTER, ...REGISTER_NUMBERS];

/** Maximum number of segments in a slot with switches (2 switches max). */
export const MAX_SPLIT_SEGMENTS = 3;

/**
 * A switch segment: from `startTime` (switch time, in "HH:mm" format), the cashier is assigned
 * to `registerNumber` until the next segment (or until the end of the slot for the last
 * segment). The first segment always starts at the start time of the scheduled slot.
 */
export interface RegisterSegment {
  startTime: string;
  registerNumber: number;
}

/** Readable label for a register number ("Caisse 3", "Caisses automatiques" or "Pauses / Retour"). */
export function registerLabel(registerNumber: number | null | undefined): string {
  if (registerNumber == null) return "";
  if (registerNumber === SELF_CHECKOUT_REGISTER) return "Caisses automatiques";
  if (registerNumber === PAUSES_RETOUR_REGISTER) return "Pauses / Retour";
  return `Caisse ${registerNumber}`;
}

/** Short label for a register number, for compact display ("C3", "Auto", "P/R"). */
export function registerShortLabel(registerNumber: number | null | undefined): string {
  if (registerNumber == null) return "";
  if (registerNumber === SELF_CHECKOUT_REGISTER) return "Auto";
  if (registerNumber === PAUSES_RETOUR_REGISTER) return "P/R";
  return `C${registerNumber}`;
}

/** Register label used when printing the register layout (SCO, not Auto). */
export function printRegisterShort(registerNumber: number | null | undefined): string {
  if (registerNumber == null) return "";
  if (registerNumber === SELF_CHECKOUT_REGISTER) return "SCO";
  if (registerNumber === PAUSES_RETOUR_REGISTER) return "P/R";
  return String(registerNumber);
}

/** Registers assigned on a slot, for printing (e.g. "3 → SCO"). */
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

/** Switch times for printing, or a dash when there are none. */
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

/** Slot with a register assignment (minimal shape for the SCO helpers). */
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
 * Breaks an assignment (simple or with switches) down into time intervals.
 * Ignores "Pauses / Retour" (negative value).
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

/** Normalizes "HH:mm" / "HH:mm:ss" to "HH:mm" for comparisons. */
export function normalizeTimeHHmm(time: string): string {
  const parts = time.split(":");
  if (parts.length < 2) return time;
  const h = parts[0].padStart(2, "0");
  const m = parts[1].padStart(2, "0");
  return `${h}:${m}`;
}

/** True when the intervals [aStart, aEnd) and [bStart, bEnd) overlap. */
export function intervalsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const a0 = normalizeTimeHHmm(aStart);
  const a1 = normalizeTimeHHmm(aEnd);
  const b0 = normalizeTimeHHmm(bStart);
  const b1 = normalizeTimeHHmm(bEnd);
  return a0 < b1 && b0 < a1;
}

/** True when `time` is within [start, end). */
export function timeInRange(time: string, start: string, end: string): boolean {
  const t = normalizeTimeHHmm(time);
  return normalizeTimeHHmm(start) <= t && t < normalizeTimeHHmm(end);
}

/**
 * Register number active at `time` (start inclusive, end exclusive).
 * Null when no 0–8 assignment covers that moment.
 */
export function registerAtTime(p: PlanningAssignment, time: string): number | null {
  const t = normalizeTimeHHmm(time);
  for (const iv of planningIntervals(p)) {
    if (timeInRange(t, iv.start, iv.end)) return iv.registerNumber;
  }
  return null;
}

/** Numbered register 1–8 at `time`, otherwise null. */
export function numberedRegisterAtTime(p: PlanningAssignment, time: string): number | null {
  const reg = registerAtTime(p, time);
  return reg != null && REGISTER_NUMBERS.includes(reg) ? reg : null;
}

/** True when the person is on self-checkout at `time`. */
export function isOnScoAtTime(p: PlanningAssignment, time: string): boolean {
  return registerAtTime(p, time) === SELF_CHECKOUT_REGISTER;
}

/** API payload: simple assignment or switch segments. */
export type RegisterAssignmentPayload =
  | { registerNumber: number; segments?: undefined }
  | { segments: RegisterSegment[]; registerNumber?: undefined };

/**
 * Rebuilds the assignment of a slot after a relief at `reliefTime`: keeps what comes before,
 * then applies `registerFromRelief` until the end.
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

  // No assignment before that time: the whole half-day moves to the new station.
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
 * Registers 1–8 free over [from, to) on the given day, ignoring the schedule entries listed in
 * `excludeIds`.
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
