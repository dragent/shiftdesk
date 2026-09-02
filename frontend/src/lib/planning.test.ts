import { describe, expect, it } from "vitest";
import {
  addHours,
  buildReliefAssignment,
  durationMinutes,
  pauseMinutesForWork,
  earliestStartForUser,
  defaultEndForSlot,
  formatFrenchTime,
  formatMinutesAsHours,
  freeNumberedRegisters,
  coversStoreClosureSlot,
  isClosedSlot,
  isOnScoAtTime,
  latestEndForDay,
  numberedRegisterAtTime,
  normalizeTimeHHmm,
  printBasculeTimes,
  printRegisterShort,
  printRegisters,
  registerAtTime,
  registerLabel,
  registerShortLabel,
  scoReliefTimeOptions,
  slotKeyForTime,
  timeInRange,
  PAUSES_RETOUR_REGISTER,
  SELF_CHECKOUT_REGISTER,
} from "./planning";

describe("slotKeyForTime", () => {
  it("classifie le matin avant 14h", () => {
    expect(slotKeyForTime("04:00")).toBe("MATIN");
    expect(slotKeyForTime("07:30")).toBe("MATIN");
    expect(slotKeyForTime("13:59")).toBe("MATIN");
  });

  it("classifie l'après-midi à partir de 14h", () => {
    expect(slotKeyForTime("14:00")).toBe("APRES_MIDI");
    expect(slotKeyForTime("20:15")).toBe("APRES_MIDI");
  });
});

describe("earliestStartForUser", () => {
  it("autorise Directeur/rice, Direction et Rayon dès 04h00 le matin", () => {
    expect(earliestStartForUser({ roles: ["ROLE_DIRECTEUR"] }, "MATIN")).toBe("04:00");
    expect(earliestStartForUser({ roles: ["ROLE_DIRECTION"] }, "MATIN")).toBe("04:00");
    expect(earliestStartForUser({ roles: ["ROLE_RAYON"] }, "MATIN")).toBe("04:00");
  });

  it("place l'accueil à 07h00 en semaine et 07h30 le dimanche", () => {
    expect(earliestStartForUser({ roles: ["ROLE_HOTE"] }, "MATIN", 0)).toBe("07:00");
    expect(earliestStartForUser({ roles: ["ROLE_HOTE"] }, "MATIN", 6)).toBe("07:30");
  });

  it("place les caissiers à 07h30 en semaine et 08h00 le dimanche", () => {
    expect(earliestStartForUser({ roles: ["ROLE_CAISSIER"] }, "MATIN", 0)).toBe("07:30");
    expect(earliestStartForUser({ roles: ["ROLE_CAISSIER"] }, "MATIN", 6)).toBe("08:00");
  });

  it("garde 07h30 pour les autres rôles et l'après-midi", () => {
    expect(earliestStartForUser({ roles: ["ROLE_LAD"] }, "MATIN")).toBe("07:30");
    expect(earliestStartForUser({ roles: ["ROLE_DIRECTION"] }, "APRES_MIDI")).toBe("14:00");
  });
});

describe("latestEndForDay / defaultEndForSlot", () => {
  it("ferme à 13h15 le dimanche et 20h15 en semaine", () => {
    expect(latestEndForDay(6)).toBe("13:15");
    expect(latestEndForDay(0)).toBe("20:15");
  });

  it("propose 13h15 le dimanche matin et la fin de créneau en semaine", () => {
    expect(defaultEndForSlot("MATIN", 6)).toBe("13:15");
    expect(defaultEndForSlot("MATIN", 0)).toBe("14:00");
    expect(defaultEndForSlot("APRES_MIDI", 1)).toBe("20:15");
  });
});

describe("isClosedSlot", () => {
  it("ferme le dimanche après-midi uniquement", () => {
    expect(isClosedSlot(6, "APRES_MIDI")).toBe(true);
    expect(isClosedSlot(6, "MATIN")).toBe(false);
    expect(isClosedSlot(0, "APRES_MIDI")).toBe(false);
  });
});

describe("coversStoreClosureSlot", () => {
  const closure = {
    startDate: "2026-08-01",
    startHalfDay: "APRES_MIDI" as const,
    endDate: "2026-08-03",
  };

  it("ne couvre pas le matin du jour de début si démarrage après-midi", () => {
    expect(coversStoreClosureSlot(closure, "2026-08-01", "MATIN")).toBe(false);
    expect(coversStoreClosureSlot(closure, "2026-08-01", "APRES_MIDI")).toBe(true);
  });

  it("couvre toute la journée les jours suivants", () => {
    expect(coversStoreClosureSlot(closure, "2026-08-02", "MATIN")).toBe(true);
    expect(coversStoreClosureSlot(closure, "2026-08-03", "APRES_MIDI")).toBe(true);
  });
});

describe("durationMinutes / formatMinutesAsHours", () => {
  it("calcule la durée d'un créneau", () => {
    expect(durationMinutes("07:30", "14:00")).toBe(390);
    expect(formatMinutesAsHours(390)).toBe("6h30");
    expect(formatMinutesAsHours(1800)).toBe("30h");
  });
});

describe("pauseMinutesForWork", () => {
  it("accorde 3 min par heure complète (multiple de 3)", () => {
    expect(pauseMinutesForWork(360)).toBe(18); // 6h
    expect(pauseMinutesForWork(390)).toBe(18); // 6h30 → 6 h complètes
    expect(pauseMinutesForWork(480)).toBe(24); // 8h
    expect(pauseMinutesForWork(420)).toBe(21); // 7h
    expect(pauseMinutesForWork(0)).toBe(0);
    expect(pauseMinutesForWork(59)).toBe(0);
  });

  it("ne produit jamais un résultat hors multiple de 3", () => {
    for (const minutes of [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360, 390, 420, 450, 480]) {
      expect(pauseMinutesForWork(minutes) % 3).toBe(0);
    }
  });
});

describe("printRegisterShort / printRegisters / printBasculeTimes", () => {
  it("utilise SCO pour les automatiques à l'impression", () => {
    expect(printRegisterShort(SELF_CHECKOUT_REGISTER)).toBe("SCO");
    expect(printRegisterShort(PAUSES_RETOUR_REGISTER)).toBe("P/R");
    expect(printRegisterShort(3)).toBe("3");
  });

  it("affiche les caisses et bascules pour l'impression", () => {
    expect(printRegisters({ registerNumber: 4 })).toBe("4");
    expect(printRegisters({ registerNumber: null })).toBe("—");
    expect(
      printRegisters({
        registerSegments: [
          { startTime: "07:30", registerNumber: 3 },
          { startTime: "10:00", registerNumber: SELF_CHECKOUT_REGISTER },
        ],
      }),
    ).toBe("3 → SCO");
  });

  it("affiche les heures de bascule ou un tiret", () => {
    expect(printBasculeTimes({})).toBe("—");
    expect(
      printBasculeTimes({
        registerSegments: [{ startTime: "07:30", registerNumber: 1 }],
      }),
    ).toBe("—");
    expect(
      printBasculeTimes({
        registerSegments: [
          { startTime: "07:30", registerNumber: 1 },
          { startTime: "10:15", registerNumber: 0 },
          { startTime: "12:00", registerNumber: 5 },
        ],
      }),
    ).toBe("10h15, 12h00");
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

describe("normalizeTimeHHmm / timeInRange", () => {
  it("normalise les secondes et compare correctement", () => {
    expect(normalizeTimeHHmm("14:00:00")).toBe("14:00");
    expect(timeInRange("07:45", "07:30:00", "14:00:00")).toBe(true);
    expect(timeInRange("14:00", "07:30", "14:00")).toBe(false);
  });
});

describe("scoReliefTimeOptions", () => {
  it("commence à 07h45 et avance par pas de 15 min jusqu'avant fermeture", () => {
    const times = scoReliefTimeOptions();
    expect(times[0]).toBe("07:45");
    expect(times).toContain("08:00");
    expect(times).toContain("14:00");
    expect(times[times.length - 1]).toBe("20:00");
    expect(times).not.toContain("20:15");
    expect(times).not.toContain("07:30");
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

describe("registerAtTime / SCO relief helpers", () => {
  const sco = {
    id: 1,
    startTime: "07:30",
    endTime: "14:00",
    registerNumber: SELF_CHECKOUT_REGISTER,
    workDate: "2026-07-27",
  };
  const caisse3 = {
    id: 2,
    startTime: "07:30",
    endTime: "14:00",
    registerNumber: 3,
    workDate: "2026-07-27",
  };
  const split = {
    id: 3,
    startTime: "07:30",
    endTime: "14:00",
    registerSegments: [
      { startTime: "07:30", registerNumber: 2 },
      { startTime: "11:00", registerNumber: SELF_CHECKOUT_REGISTER },
    ],
    workDate: "2026-07-27",
  };

  it("détecte la caisse active à une heure donnée", () => {
    expect(registerAtTime(sco, "09:00")).toBe(SELF_CHECKOUT_REGISTER);
    expect(numberedRegisterAtTime(caisse3, "09:00")).toBe(3);
    expect(isOnScoAtTime(split, "10:59")).toBe(false);
    expect(isOnScoAtTime(split, "11:00")).toBe(true);
    expect(numberedRegisterAtTime(split, "08:00")).toBe(2);
  });

  it("construit un échange SCO → caisse à l'heure de relève", () => {
    expect(buildReliefAssignment(sco, "11:00", 3)).toEqual({
      segments: [
        { startTime: "07:30", registerNumber: SELF_CHECKOUT_REGISTER },
        { startTime: "11:00", registerNumber: 3 },
      ],
    });
    expect(buildReliefAssignment(caisse3, "11:00", SELF_CHECKOUT_REGISTER)).toEqual({
      segments: [
        { startTime: "07:30", registerNumber: 3 },
        { startTime: "11:00", registerNumber: SELF_CHECKOUT_REGISTER },
      ],
    });
  });

  it("assigne toute la demi-journée si la relève commence au début du créneau", () => {
    expect(buildReliefAssignment(caisse3, "07:30", SELF_CHECKOUT_REGISTER)).toEqual({
      registerNumber: SELF_CHECKOUT_REGISTER,
    });
  });

  it("liste les caisses libres en ignorant les exclus", () => {
    const free = freeNumberedRegisters(
      [sco, caisse3, { id: 4, startTime: "07:30", endTime: "14:00", registerNumber: 5, workDate: "2026-07-27" }],
      "2026-07-27",
      "11:00",
      "14:00",
      [2], // caisse 3 libérée par le relève
    );
    expect(free).toContain(3);
    expect(free).not.toContain(5);
    expect(free).toContain(1);
  });
});
