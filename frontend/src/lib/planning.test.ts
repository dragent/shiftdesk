import { describe, expect, it } from "vitest";
import {
  addHours,
  durationMinutes,
  formatFrenchTime,
  formatMinutesAsHours,
  isClosedSlot,
  registerLabel,
  registerShortLabel,
  slotKeyForTime,
  PAUSES_RETOUR_REGISTER,
  SELF_CHECKOUT_REGISTER,
} from "./planning";

describe("slotKeyForTime", () => {
  it("classifie le matin avant 14h", () => {
    expect(slotKeyForTime("07:30")).toBe("MATIN");
    expect(slotKeyForTime("13:59")).toBe("MATIN");
  });

  it("classifie l'après-midi à partir de 14h", () => {
    expect(slotKeyForTime("14:00")).toBe("APRES_MIDI");
    expect(slotKeyForTime("20:15")).toBe("APRES_MIDI");
  });
});

describe("isClosedSlot", () => {
  it("ferme le dimanche après-midi uniquement", () => {
    expect(isClosedSlot(6, "APRES_MIDI")).toBe(true);
    expect(isClosedSlot(6, "MATIN")).toBe(false);
    expect(isClosedSlot(0, "APRES_MIDI")).toBe(false);
  });
});

describe("durationMinutes / formatMinutesAsHours", () => {
  it("calcule la durée d'un créneau", () => {
    expect(durationMinutes("07:30", "14:00")).toBe(390);
    expect(formatMinutesAsHours(390)).toBe("6h30");
    expect(formatMinutesAsHours(1800)).toBe("30h");
  });
});

describe("formatFrenchTime", () => {
  it("formate en HHhmm sans AM/PM", () => {
    expect(formatFrenchTime("07:30")).toBe("07h30");
    expect(formatFrenchTime("")).toBe("");
    expect(formatFrenchTime(null)).toBe("");
  });
});

describe("addHours", () => {
  it("ajoute une heure pour la pause déjeuner par défaut", () => {
    expect(addHours("14:00", 1)).toBe("15:00");
  });
});

describe("register labels", () => {
  it("libellés longs et courts", () => {
    expect(registerLabel(SELF_CHECKOUT_REGISTER)).toBe("Caisses automatiques");
    expect(registerLabel(PAUSES_RETOUR_REGISTER)).toBe("Pauses / Retour");
    expect(registerLabel(3)).toBe("Caisse 3");
    expect(registerShortLabel(SELF_CHECKOUT_REGISTER)).toBe("Auto");
    expect(registerShortLabel(PAUSES_RETOUR_REGISTER)).toBe("P/R");
    expect(registerShortLabel(3)).toBe("C3");
  });
});
