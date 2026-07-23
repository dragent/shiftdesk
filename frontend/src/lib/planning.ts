/**
 * Créneaux fixes de demi-journée utilisés par le planning : le magasin est
 * couvert de 07h30 à 20h15, coupé en deux demi-journées (matin / après-midi).
 * Le dimanche après-midi est fermé : personne n'y travaille.
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

export const DAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

/** Index du dimanche dans la semaine (lundi = 0). */
export const SUNDAY_INDEX = 6;

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
